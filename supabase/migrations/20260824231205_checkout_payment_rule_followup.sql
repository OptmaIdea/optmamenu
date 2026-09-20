-- Tighten checkout payment semantics after separating timing from settlement method.

-- Standard integrated rails do not use customer-uploaded proof. Manual PIX keeps proof=true.
update public.store_payment_methods
set requires_proof = false,
    updated_at = now()
where code in ('pix','debit_card','credit_card');

-- Reserve a system rail for future API payment-link integration. It remains hidden until an integration explicitly enables it.
insert into public.store_payment_methods (
  store_id,code,base_code,name,description,active,public_enabled,sort_order,icon,
  requires_proof,requires_change_for,affects_cashbook,metadata
)
select distinct
  pm.store_id,
  'payment_link',
  'other',
  'Link de pagamento',
  'Pagamento online por link confirmado pela integração do provedor.',
  true,
  false,
  40,
  'link',
  false,
  false,
  true,
  jsonb_build_object(
    'system_variant','payment_link_api',
    'checkout',jsonb_build_object(
      'pay_now',true,
      'pay_on_pickup',false,
      'pay_on_delivery',false,
      'confirmation_mode','api',
      'integration_enabled',false
    )
  )
from public.store_payment_methods pm
where not exists (
  select 1 from public.store_payment_methods existing
  where existing.store_id=pm.store_id and existing.code='payment_link'
);

-- Recreate v3 with two safeguards:
-- (a) tolerate the UI alias "delivery" by resolving it to local_delivery;
-- (b) keep the coarse orders.payment_method enum aligned with the selected pay-now base method.
create or replace function public.create_public_order_by_slug_v3(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment_type text,
  p_sales_channel text,
  p_items jsonb,
  p_delivery_address jsonb default '{}'::jsonb,
  p_table_code text default null,
  p_notes text default null,
  p_payment_selection jsonb default '{}'::jsonb,
  p_delivery_method_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_store_id uuid;
  v_fulfillment text := case when p_fulfillment_type='table' then 'qr_table' else coalesce(nullif(trim(p_fulfillment_type),''),'pickup') end;
  v_timing text := coalesce(nullif(trim(p_payment_selection->>'timing'),''),'pay_on_fulfillment');
  v_selected_method_code text := nullif(trim(p_payment_selection->>'method_code'),'');
  v_promised_method_code text := nullif(trim(p_payment_selection->>'promised_method_code'),'');
  v_change_for numeric := null;
  v_method record;
  v_effective_payment_code text := 'pending';
  v_effective_delivery_code text;
  v_result jsonb;
  v_order_id uuid;
  v_checkout_metadata jsonb;
  v_payment_enum public.payment_method := 'pending'::public.payment_method;
begin
  v_store_id := public.resolve_public_store_id_by_slug(p_slug);
  if v_store_id is null then return jsonb_build_object('ok',false,'error','store_not_found_or_disabled'); end if;

  v_effective_delivery_code := case
    when nullif(trim(coalesce(p_delivery_method_code,'')),'') is null then null
    when p_delivery_method_code='delivery' then 'local_delivery'
    else p_delivery_method_code
  end;

  if p_payment_selection ? 'change_for' and nullif(trim(p_payment_selection->>'change_for'),'') is not null then
    begin
      v_change_for := (p_payment_selection->>'change_for')::numeric;
    exception when others then
      return jsonb_build_object('ok',false,'error','invalid_change_for');
    end;
    if v_change_for <= 0 then return jsonb_build_object('ok',false,'error','invalid_change_for'); end if;
  end if;

  if v_timing='pay_now' then
    if v_selected_method_code is null then return jsonb_build_object('ok',false,'error','payment_method_required'); end if;

    select pm.code,pm.name,coalesce(pm.base_code,pm.code) as base_code,pm.requires_proof,pm.metadata
    into v_method
    from public.store_payment_methods pm
    where pm.store_id=v_store_id
      and pm.code=v_selected_method_code
      and pm.active=true
      and pm.public_enabled=true
      and coalesce((pm.metadata->'checkout'->>'pay_now')::boolean,false)=true
    limit 1;

    if v_method.code is null then return jsonb_build_object('ok',false,'error','payment_method_disabled'); end if;

    if coalesce(v_method.metadata->'checkout'->>'confirmation_mode','')='api'
       and coalesce((v_method.metadata->'checkout'->>'integration_enabled')::boolean,false)=false then
      return jsonb_build_object('ok',false,'error','payment_integration_unavailable');
    end if;

    if coalesce(v_method.metadata->'checkout'->>'confirmation_mode','')='manual_proof'
       and v_method.requires_proof is not true then
      return jsonb_build_object('ok',false,'error','payment_method_misconfigured');
    end if;

    v_effective_payment_code := v_method.code;
    v_payment_enum := case
      when v_method.base_code='pix' then 'pix'::public.payment_method
      when v_method.base_code='cash' then 'cash'::public.payment_method
      when v_method.base_code in ('debit_card','credit_card') then 'card'::public.payment_method
      else 'pending'::public.payment_method
    end;
    v_checkout_metadata := jsonb_build_object(
      'timing','pay_now',
      'selected_method_code',v_method.code,
      'selected_method_name',v_method.name,
      'confirmation_mode',coalesce(v_method.metadata->'checkout'->>'confirmation_mode','api'),
      'requires_proof',coalesce(v_method.requires_proof,false),
      'awaiting_confirmation',true
    );

  elsif v_timing='pay_on_fulfillment' then
    if not exists(
      select 1 from public.store_payment_methods pm
      where pm.store_id=v_store_id and pm.code='pending' and pm.active=true and pm.public_enabled=true
    ) then return jsonb_build_object('ok',false,'error','payment_method_disabled'); end if;

    if v_fulfillment='delivery' then
      if v_promised_method_code not in ('pix','card','cash') then return jsonb_build_object('ok',false,'error','delivery_payment_method_required'); end if;

      if v_promised_method_code='pix' and not exists(
        select 1 from public.store_payment_methods pm where pm.store_id=v_store_id and pm.active=true and pm.public_enabled=true
          and coalesce(pm.base_code,pm.code)='pix' and pm.code<>'pix_manual_qr'
          and coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean,false)=true
      ) then return jsonb_build_object('ok',false,'error','delivery_payment_method_disabled'); end if;

      if v_promised_method_code='card' and not exists(
        select 1 from public.store_payment_methods pm where pm.store_id=v_store_id and pm.active=true and pm.public_enabled=true
          and coalesce(pm.base_code,pm.code) in ('debit_card','credit_card')
          and coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean,false)=true
      ) then return jsonb_build_object('ok',false,'error','delivery_payment_method_disabled'); end if;

      if v_promised_method_code='cash' and not exists(
        select 1 from public.store_payment_methods pm where pm.store_id=v_store_id and pm.active=true and pm.public_enabled=true
          and coalesce(pm.base_code,pm.code)='cash'
          and coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean,false)=true
      ) then return jsonb_build_object('ok',false,'error','delivery_payment_method_disabled'); end if;
    else
      v_promised_method_code := null;
      v_change_for := null;
    end if;

    v_effective_payment_code := 'pending';
    v_payment_enum := 'pending'::public.payment_method;
    v_checkout_metadata := jsonb_build_object(
      'timing','pay_on_fulfillment',
      'fulfillment_label',case
        when v_fulfillment='delivery' then 'Pagar na entrega'
        when v_fulfillment in ('qr_table','dine_in') then 'Pagar no atendimento'
        else 'Pagar na retirada'
      end,
      'promised_method_code',v_promised_method_code,
      'change_for',v_change_for,
      'awaiting_confirmation',true
    );
  else
    return jsonb_build_object('ok',false,'error','invalid_payment_timing');
  end if;

  v_result := public.create_public_order_by_slug_v2(
    p_slug,
    p_customer_name,
    p_customer_phone,
    v_fulfillment,
    p_sales_channel,
    p_payment_method_code => v_effective_payment_code,
    p_delivery_method_code => v_effective_delivery_code,
    p_items => p_items,
    p_delivery_address => p_delivery_address,
    p_table_code => p_table_code,
    p_notes => p_notes
  );

  if coalesce((v_result->>'ok')::boolean,false)=false then return v_result; end if;

  v_order_id := nullif(v_result->'order'->>'id','')::uuid;
  if v_order_id is null then return jsonb_build_object('ok',false,'error','order_result_missing_id'); end if;

  update public.orders o
  set payment_method=v_payment_enum,
      payment_metadata=coalesce(o.payment_metadata,'{}'::jsonb) || jsonb_build_object('checkout',v_checkout_metadata),
      commercial_metadata=coalesce(o.commercial_metadata,'{}'::jsonb) || jsonb_build_object(
        'payment_timing',v_timing,
        'promised_payment_method',v_promised_method_code,
        'payment_confirmation_mode',case when v_timing='pay_now' then v_checkout_metadata->>'confirmation_mode' else 'at_fulfillment' end
      )
  where o.id=v_order_id and o.store_id=v_store_id;

  v_result := jsonb_set(
    v_result,
    '{order}',
    coalesce(v_result->'order','{}'::jsonb) || jsonb_build_object(
      'payment_method',v_payment_enum::text,
      'payment_timing',v_timing,
      'payment_method_code',v_effective_payment_code,
      'promised_payment_method_code',v_promised_method_code,
      'requires_proof',coalesce((v_checkout_metadata->>'requires_proof')::boolean,false),
      'payment_confirmation_mode',case when v_timing='pay_now' then v_checkout_metadata->>'confirmation_mode' else 'at_fulfillment' end
    ),
    true
  );

  return v_result;
end;
$function$;

revoke all on function public.create_public_order_by_slug_v3(text,text,text,text,text,jsonb,jsonb,text,text,jsonb,text) from public;
grant execute on function public.create_public_order_by_slug_v3(text,text,text,text,text,jsonb,jsonb,text,text,jsonb,text) to anon, authenticated, service_role;
