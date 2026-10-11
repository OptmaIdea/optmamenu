-- Checkout payment timing / confirmation rules
-- Separates pay-now from pay-on-fulfillment and keeps manual PIX proof distinct from API-confirmed rails.

update public.store_payment_methods pm
set metadata = jsonb_set(
      coalesce(pm.metadata, '{}'::jsonb),
      '{checkout}',
      coalesce(pm.metadata->'checkout', '{}'::jsonb) ||
      case
        when coalesce(pm.base_code, pm.code) = 'pending' then jsonb_build_object(
          'pay_now', false, 'pay_on_pickup', true, 'pay_on_delivery', false, 'confirmation_mode', 'at_fulfillment')
        when coalesce(pm.base_code, pm.code) = 'cash' then jsonb_build_object(
          'pay_now', false, 'pay_on_pickup', false, 'pay_on_delivery', true, 'confirmation_mode', 'at_fulfillment')
        when coalesce(pm.base_code, pm.code) = 'pix' then jsonb_build_object(
          'pay_now', false, 'pay_on_pickup', false, 'pay_on_delivery', true, 'confirmation_mode', 'api', 'integration_enabled', false)
        when coalesce(pm.base_code, pm.code) in ('debit_card','credit_card') then jsonb_build_object(
          'pay_now', false, 'pay_on_pickup', false, 'pay_on_delivery', true, 'confirmation_mode', 'api', 'integration_enabled', false)
        else jsonb_build_object(
          'pay_now', false, 'pay_on_pickup', false, 'pay_on_delivery', false, 'confirmation_mode', 'at_fulfillment')
      end,
      true
    ),
    updated_at = now();

insert into public.store_payment_methods (
  store_id, code, base_code, name, description, active, public_enabled, sort_order,
  icon, requires_proof, requires_change_for, affects_cashbook, metadata
)
select distinct
  pm.store_id, 'pix_manual_qr', 'pix', 'PIX copia e cola / QR Code',
  'Pagamento antecipado por PIX sem confirmação bancária automática. O cliente envia o comprovante para conferência.',
  true, true, 25, 'qr_code', true, false, true,
  jsonb_build_object(
    'custom_variant', true,
    'system_variant', 'manual_pix_proof',
    'checkout', jsonb_build_object(
      'pay_now', true, 'pay_on_pickup', false, 'pay_on_delivery', false,
      'confirmation_mode', 'manual_proof', 'integration_enabled', true
    )
  )
from public.store_payment_methods pm
where not exists (
  select 1 from public.store_payment_methods existing
  where existing.store_id = pm.store_id and existing.code = 'pix_manual_qr'
);

update public.store_payment_methods pm
set base_code='pix',
    name='PIX copia e cola / QR Code',
    description='Pagamento antecipado por PIX sem confirmação bancária automática. O cliente envia o comprovante para conferência.',
    active=true, public_enabled=true, requires_proof=true, requires_change_for=false, affects_cashbook=true,
    metadata=jsonb_set(
      coalesce(pm.metadata,'{}'::jsonb) || jsonb_build_object('system_variant','manual_pix_proof'),
      '{checkout}',
      coalesce(pm.metadata->'checkout','{}'::jsonb) || jsonb_build_object(
        'pay_now',true, 'pay_on_pickup',false, 'pay_on_delivery',false,
        'confirmation_mode','manual_proof', 'integration_enabled',true
      ), true
    ),
    updated_at=now()
where pm.code='pix_manual_qr';

create or replace function public.get_public_checkout_payment_options_by_slug(
  p_slug text,
  p_fulfillment_type text default 'pickup'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_store_id uuid;
  v_fulfillment text := case when p_fulfillment_type='table' then 'qr_table' else coalesce(nullif(trim(p_fulfillment_type),''),'pickup') end;
  v_pay_now jsonb := '[]'::jsonb;
  v_delivery_methods jsonb := '[]'::jsonb;
  v_pending_enabled boolean := false;
begin
  v_store_id := public.resolve_public_store_id_by_slug(p_slug);
  if v_store_id is null then
    return jsonb_build_object('ok',false,'error','store_not_found_or_disabled','pay_now','[]'::jsonb,'pay_on_fulfillment',jsonb_build_object('enabled',false));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',pm.code,
    'base_code',coalesce(pm.base_code,pm.code),
    'name',pm.name,
    'description',pm.description,
    'requires_proof',pm.requires_proof,
    'confirmation_mode',coalesce(pm.metadata->'checkout'->>'confirmation_mode','api'),
    'integration_enabled',coalesce((pm.metadata->'checkout'->>'integration_enabled')::boolean,false)
  ) order by pm.sort_order,pm.name),'[]'::jsonb)
  into v_pay_now
  from public.store_payment_methods pm
  where pm.store_id=v_store_id
    and pm.active=true
    and pm.public_enabled=true
    and coalesce((pm.metadata->'checkout'->>'pay_now')::boolean,false)=true
    and (
      coalesce(pm.metadata->'checkout'->>'confirmation_mode','')='manual_proof'
      or coalesce((pm.metadata->'checkout'->>'integration_enabled')::boolean,false)=true
    );

  select exists(
    select 1 from public.store_payment_methods pm
    where pm.store_id=v_store_id and pm.code='pending' and pm.active=true and pm.public_enabled=true
  ) into v_pending_enabled;

  if v_fulfillment='delivery' then
    select coalesce(jsonb_agg(x.item order by x.sort_order),'[]'::jsonb)
    into v_delivery_methods
    from (
      select 10 as sort_order, jsonb_build_object('code','pix','name','PIX na entrega','requires_change_for',false) as item
      where exists(
        select 1 from public.store_payment_methods pm
        where pm.store_id=v_store_id and pm.active=true and pm.public_enabled=true
          and coalesce(pm.base_code,pm.code)='pix' and pm.code<>'pix_manual_qr'
          and coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean,false)=true
      )
      union all
      select 20, jsonb_build_object('code','card','name','Cartão na entrega','requires_change_for',false)
      where exists(
        select 1 from public.store_payment_methods pm
        where pm.store_id=v_store_id and pm.active=true and pm.public_enabled=true
          and coalesce(pm.base_code,pm.code) in ('debit_card','credit_card')
          and coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean,false)=true
      )
      union all
      select 30, jsonb_build_object('code','cash','name','Dinheiro na entrega','requires_change_for',true)
      where exists(
        select 1 from public.store_payment_methods pm
        where pm.store_id=v_store_id and pm.active=true and pm.public_enabled=true
          and coalesce(pm.base_code,pm.code)='cash'
          and coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean,false)=true
      )
    ) x;
  end if;

  return jsonb_build_object(
    'ok',true,
    'fulfillment_type',v_fulfillment,
    'pay_now',v_pay_now,
    'pay_on_fulfillment',jsonb_build_object(
      'enabled',v_pending_enabled,
      'label',case
        when v_fulfillment='delivery' then 'Pagar na entrega'
        when v_fulfillment in ('qr_table','dine_in') then 'Pagar no atendimento'
        else 'Pagar na retirada'
      end,
      'requires_method_choice',v_fulfillment='delivery',
      'methods',case when v_fulfillment='delivery' then v_delivery_methods else '[]'::jsonb end
    )
  );
end;
$function$;

revoke all on function public.get_public_checkout_payment_options_by_slug(text,text) from public;
grant execute on function public.get_public_checkout_payment_options_by_slug(text,text) to anon, authenticated, service_role;

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
  v_result jsonb;
  v_order_id uuid;
  v_checkout_metadata jsonb;
begin
  v_store_id := public.resolve_public_store_id_by_slug(p_slug);
  if v_store_id is null then return jsonb_build_object('ok',false,'error','store_not_found_or_disabled'); end if;

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
    where pm.store_id=v_store_id and pm.code=v_selected_method_code and pm.active=true and pm.public_enabled=true
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
    v_checkout_metadata := jsonb_build_object(
      'timing','pay_now','selected_method_code',v_method.code,'selected_method_name',v_method.name,
      'confirmation_mode',coalesce(v_method.metadata->'checkout'->>'confirmation_mode','api'),
      'requires_proof',coalesce(v_method.requires_proof,false),'awaiting_confirmation',true
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
    v_checkout_metadata := jsonb_build_object(
      'timing','pay_on_fulfillment',
      'fulfillment_label',case
        when v_fulfillment='delivery' then 'Pagar na entrega'
        when v_fulfillment in ('qr_table','dine_in') then 'Pagar no atendimento'
        else 'Pagar na retirada'
      end,
      'promised_method_code',v_promised_method_code,'change_for',v_change_for,'awaiting_confirmation',true
    );
  else
    return jsonb_build_object('ok',false,'error','invalid_payment_timing');
  end if;

  v_result := public.create_public_order_by_slug_v2(
    p_slug,p_customer_name,p_customer_phone,v_fulfillment,p_sales_channel,
    p_payment_method_code => v_effective_payment_code,
    p_delivery_method_code => p_delivery_method_code,
    p_items => p_items,p_delivery_address => p_delivery_address,p_table_code => p_table_code,p_notes => p_notes
  );

  if coalesce((v_result->>'ok')::boolean,false)=false then return v_result; end if;
  v_order_id := nullif(v_result->'order'->>'id','')::uuid;
  if v_order_id is null then return jsonb_build_object('ok',false,'error','order_result_missing_id'); end if;

  update public.orders o
  set payment_metadata=coalesce(o.payment_metadata,'{}'::jsonb) || jsonb_build_object('checkout',v_checkout_metadata),
      commercial_metadata=coalesce(o.commercial_metadata,'{}'::jsonb) || jsonb_build_object(
        'payment_timing',v_timing,'promised_payment_method',v_promised_method_code,
        'payment_confirmation_mode',case when v_timing='pay_now' then v_checkout_metadata->>'confirmation_mode' else 'at_fulfillment' end
      )
  where o.id=v_order_id and o.store_id=v_store_id;

  v_result := jsonb_set(v_result,'{order}',coalesce(v_result->'order','{}'::jsonb) || jsonb_build_object(
    'payment_timing',v_timing,'payment_method_code',v_effective_payment_code,
    'promised_payment_method_code',v_promised_method_code,
    'requires_proof',coalesce((v_checkout_metadata->>'requires_proof')::boolean,false),
    'payment_confirmation_mode',case when v_timing='pay_now' then v_checkout_metadata->>'confirmation_mode' else 'at_fulfillment' end
  ),true);

  return v_result;
end;
$function$;

revoke all on function public.create_public_order_by_slug_v3(text,text,text,text,text,jsonb,jsonb,text,text,jsonb,text) from public;
grant execute on function public.create_public_order_by_slug_v3(text,text,text,text,text,jsonb,jsonb,text,text,jsonb,text) to anon, authenticated, service_role;

create or replace function public.get_public_order_payment_proof_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_order record;
  v_method record;
  v_proofs jsonb := '[]'::jsonb;
  v_eligible boolean := false;
begin
  select o.id,o.store_id,o.order_code,o.status::text as status,o.payment_status,o.payment_method_code,o.total
  into v_order from public.orders o where o.public_order_token=trim(coalesce(p_token,'')) limit 1;
  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;

  select pm.code,pm.name,coalesce(pm.base_code,pm.code) as base_code,pm.requires_proof,pm.metadata
  into v_method from public.store_payment_methods pm where pm.store_id=v_order.store_id and pm.code=v_order.payment_method_code limit 1;

  v_eligible := v_order.status in ('reserved','confirmed','ready')
    and coalesce(v_order.payment_status,'pending') <> 'paid'
    and coalesce(v_method.base_code,'')='pix'
    and coalesce(v_method.requires_proof,false)=true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'status',p.status,'original_file_name',p.original_file_name,'declared_amount',p.declared_amount,
    'declared_paid_at',p.declared_paid_at,'submitted_at',p.submitted_at,'decided_at',p.decided_at,
    'decision_notes',case when p.status='rejected' then p.decision_notes else null end
  ) order by p.created_at desc),'[]'::jsonb)
  into v_proofs from public.order_payment_proofs p where p.order_id=v_order.id and p.status <> 'upload_pending';

  return jsonb_build_object(
    'ok',true,'eligible',v_eligible,'order_code',v_order.order_code,'order_status',v_order.status,
    'payment_status',v_order.payment_status,'payment_method_code',v_method.code,'payment_method_name',v_method.name,
    'requires_proof',coalesce(v_method.requires_proof,false),'order_total',v_order.total,'proofs',v_proofs
  );
end;
$function$;

create or replace function public.create_public_order_payment_proof_ticket(
  p_token text,p_file_name text,p_content_type text,p_declared_amount numeric default null,p_declared_paid_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_order record;
  v_method record;
  v_id uuid := gen_random_uuid();
  v_extension text;
  v_storage_path text;
  v_file_name text;
  v_recent_count integer := 0;
begin
  if length(trim(coalesce(p_token,''))) < 16 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  if p_content_type not in ('image/jpeg','image/png','image/webp','application/pdf') then return jsonb_build_object('ok',false,'error','invalid_content_type'); end if;

  select o.id,o.store_id,o.order_code,o.status::text as status,o.payment_status,o.payment_method_code,o.total,o.created_at,o.public_order_token
  into v_order from public.orders o where o.public_order_token=trim(p_token) limit 1;
  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
  if v_order.status not in ('reserved','confirmed','ready') then return jsonb_build_object('ok',false,'error','order_not_eligible','status',v_order.status); end if;
  if coalesce(v_order.payment_status,'pending')='paid' then return jsonb_build_object('ok',false,'error','payment_already_confirmed'); end if;

  select pm.code,pm.name,coalesce(pm.base_code,pm.code) as base_code,pm.requires_proof,pm.active
  into v_method from public.store_payment_methods pm where pm.store_id=v_order.store_id and pm.code=v_order.payment_method_code and pm.active=true limit 1;
  if v_method.code is null or v_method.base_code<>'pix' then return jsonb_build_object('ok',false,'error','not_pix_order'); end if;
  if coalesce(v_method.requires_proof,false)=false then return jsonb_build_object('ok',false,'error','proof_not_required'); end if;

  if p_declared_amount is not null and p_declared_amount<=0 then return jsonb_build_object('ok',false,'error','invalid_declared_amount'); end if;
  if p_declared_paid_at is not null and p_declared_paid_at>now()+interval '10 minutes' then return jsonb_build_object('ok',false,'error','invalid_declared_paid_at'); end if;

  update public.order_payment_proofs set status='expired',updated_at=now()
  where order_id=v_order.id and status='upload_pending' and upload_expires_at<=now();
  select count(*) into v_recent_count from public.order_payment_proofs p where p.order_id=v_order.id and p.created_at>=now()-interval '1 hour';
  if v_recent_count>=5 then return jsonb_build_object('ok',false,'error','too_many_proof_attempts'); end if;

  v_extension := case p_content_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' when 'image/webp' then '.webp' when 'application/pdf' then '.pdf' end;
  v_file_name := nullif(trim(regexp_replace(left(coalesce(p_file_name,'comprovante'),180),'[^a-zA-Z0-9._ -]','','g')),'');
  v_storage_path := v_order.store_id::text||'/'||v_order.id::text||'/'||v_id::text||v_extension;

  insert into public.order_payment_proofs (
    id,store_id,order_id,status,storage_bucket,storage_path,original_file_name,content_type,
    declared_amount,declared_paid_at,upload_expires_at,metadata
  ) values (
    v_id,v_order.store_id,v_order.id,'upload_pending','order-payment-proofs',v_storage_path,
    coalesce(v_file_name,'comprovante'||v_extension),p_content_type,
    coalesce(p_declared_amount,v_order.total),p_declared_paid_at,now()+interval '15 minutes',
    jsonb_build_object('created_from','public_order_tracking','order_code',v_order.order_code)
  );

  return jsonb_build_object(
    'ok',true,'proof_id',v_id,'storage_bucket','order-payment-proofs','storage_path',v_storage_path,
    'upload_expires_at',now()+interval '15 minutes','max_file_size',8388608,
    'allowed_content_types',jsonb_build_array('image/jpeg','image/png','image/webp','application/pdf')
  );
end;
$function$;

create or replace function public.review_order_payment_proof_safe(
  p_store_id uuid,p_proof_id uuid,p_decision text,p_financial_account_id uuid default null,p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_proof record;
  v_order record;
  v_method record;
  v_account_id uuid;
  v_account_active boolean;
  v_account_has_routes boolean := false;
  v_account_accepts boolean := false;
  v_entry_id uuid;
  v_entry_code text;
  v_existing_entry_id uuid;
  v_existing_entry_code text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'financial.manage') or public.user_has_store_permission_v2(p_store_id,'cashbook.create')) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if p_decision not in ('confirm','reject') then return jsonb_build_object('ok',false,'error','invalid_decision'); end if;

  select p.* into v_proof from public.order_payment_proofs p where p.id=p_proof_id and p.store_id=p_store_id for update;
  if v_proof.id is null then return jsonb_build_object('ok',false,'error','proof_not_found'); end if;
  select o.id,o.store_id,o.order_code,o.status::text as status,o.payment_status,o.payment_method_code,o.total,o.customer_id,o.customer_name
  into v_order from public.orders o where o.id=v_proof.order_id and o.store_id=p_store_id for update;
  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;

  if v_proof.status='confirmed' then return jsonb_build_object('ok',true,'already_confirmed',true,'proof_id',v_proof.id,'cashbook_entry_id',v_proof.cashbook_entry_id); end if;
  if v_proof.status<>'submitted' then return jsonb_build_object('ok',false,'error','proof_not_submitted','status',v_proof.status); end if;

  if p_decision='reject' then
    if length(trim(coalesce(p_notes,'')))<3 then return jsonb_build_object('ok',false,'error','rejection_reason_required'); end if;
    update public.order_payment_proofs
    set status='rejected',decided_at=now(),decided_by=auth.uid(),decision_source='manual_proof_review',decision_notes=trim(p_notes),updated_at=now()
    where id=v_proof.id;
    update public.orders
    set payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
      'payment_proof_id',v_proof.id,'proof_status','rejected','proof_reviewed_at',now(),'proof_reviewed_by',auth.uid(),'proof_rejection_reason',trim(p_notes)
    ) where id=v_order.id;
    return jsonb_build_object('ok',true,'proof_id',v_proof.id,'status','rejected');
  end if;

  if v_order.status not in ('reserved','confirmed','ready') then return jsonb_build_object('ok',false,'error','order_not_eligible','status',v_order.status); end if;
  if coalesce(v_order.payment_status,'pending')='paid' then return jsonb_build_object('ok',false,'error','payment_already_confirmed'); end if;

  select pm.code,pm.name,coalesce(pm.base_code,pm.code) as base_code,pm.preferred_financial_account_id,pm.requires_proof
  into v_method from public.store_payment_methods pm
  where pm.store_id=p_store_id and pm.code=v_order.payment_method_code and pm.active=true limit 1;
  if v_method.code is null or v_method.base_code<>'pix' then return jsonb_build_object('ok',false,'error','not_pix_order'); end if;
  if coalesce(v_method.requires_proof,false)=false then return jsonb_build_object('ok',false,'error','proof_not_required'); end if;

  v_account_id := p_financial_account_id;
  if v_account_id is null then
    select a.id into v_account_id from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true and a.id=v_method.preferred_financial_account_id limit 1;
  end if;
  if v_account_id is null then
    select a.id into v_account_id from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true and a.is_sales_clearing_default=true order by a.sort_order,a.name limit 1;
  end if;
  if v_account_id is null then
    select a.id into v_account_id from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true and (
      not exists(select 1 from public.store_financial_account_payment_methods ap0 where ap0.store_id=p_store_id and ap0.account_id=a.id and ap0.active=true)
      or exists(select 1 from public.store_financial_account_payment_methods ap where ap.store_id=p_store_id and ap.account_id=a.id and ap.active=true and ap.payment_method_code in (v_method.code,v_method.base_code))
    ) order by a.sort_order,a.name limit 1;
  end if;
  if v_account_id is null then return jsonb_build_object('ok',false,'error','financial_account_required'); end if;

  select a.active into v_account_active from public.store_financial_accounts a where a.id=v_account_id and a.store_id=p_store_id;
  if not found then return jsonb_build_object('ok',false,'error','invalid_financial_account'); end if;
  if v_account_active is not true then return jsonb_build_object('ok',false,'error','financial_account_inactive'); end if;

  select exists(select 1 from public.store_financial_account_payment_methods ap where ap.store_id=p_store_id and ap.account_id=v_account_id and ap.active=true)
  into v_account_has_routes;
  if v_account_has_routes then
    select exists(select 1 from public.store_financial_account_payment_methods ap where ap.store_id=p_store_id and ap.account_id=v_account_id and ap.active=true and ap.payment_method_code in (v_method.code,v_method.base_code))
    into v_account_accepts;
    if not v_account_accepts then return jsonb_build_object('ok',false,'error','account_does_not_accept_pix'); end if;
  end if;

  select ce.id,ce.entry_code into v_existing_entry_id,v_existing_entry_code
  from public.cashbook_entries ce
  where ce.store_id=p_store_id and ce.order_id=v_order.id and ce.type='sale' and ce.direction='in'
    and ce.status='confirmed' and ce.affects_balance=true
  order by ce.created_at desc limit 1;
  if v_existing_entry_id is not null then
    return jsonb_build_object('ok',false,'error','financial_entry_already_exists','cashbook_entry_id',v_existing_entry_id,'cashbook_entry_code',v_existing_entry_code);
  end if;

  v_entry_code := public.generate_cashbook_entry_code();
  insert into public.cashbook_entries (
    store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,notes,payment_method,payment_method_code,
    source,source_id,order_id,customer_id,status,affects_balance,metadata,created_by,destination_financial_account_id,is_transfer
  ) values (
    p_store_id,v_entry_code,current_date,now(),'sale','in',v_order.total,'Pagamento antecipado confirmado do pedido '||v_order.order_code,
    nullif(trim(coalesce(p_notes,'')),''),v_method.name,v_method.code,'order',v_order.id,v_order.id,v_order.customer_id,'confirmed',true,
    jsonb_build_object(
      'order_code',v_order.order_code,'customer_name',v_order.customer_name,'payment_confirmation_source','manual_proof_review',
      'payment_proof_id',v_proof.id,'payment_proof_storage_path',v_proof.storage_path,'declared_amount',v_proof.declared_amount,
      'declared_paid_at',v_proof.declared_paid_at,'reviewed_by',auth.uid(),'reviewed_at',now(),'financial_account_id',v_account_id
    ),
    auth.uid(),v_account_id,false
  ) returning id into v_entry_id;

  update public.order_payment_proofs
  set status='confirmed',decided_at=now(),decided_by=auth.uid(),decision_source='manual_proof_review',
      decision_notes=nullif(trim(coalesce(p_notes,'')),''),cashbook_entry_id=v_entry_id,financial_account_id=v_account_id,updated_at=now()
  where id=v_proof.id;
  update public.order_payment_proofs
  set status='superseded',decision_source='payment_confirmed_with_other_proof',decision_notes='Outro comprovante deste pedido foi confirmado.',decided_at=now(),updated_at=now()
  where order_id=v_order.id and id<>v_proof.id and status='submitted';

  update public.orders
  set payment_status='paid',payment_method='pix'::public.payment_method,payment_method_code=v_method.code,
      proof_url='storage://'||v_proof.storage_bucket||'/'||v_proof.storage_path,
      payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
        'paid_at',now(),'paid_by_source','manual_proof_review','confirmed_at',now(),'confirmed_by',auth.uid(),
        'payment_method_code',v_method.code,'payment_proof_id',v_proof.id,'proof_status','confirmed','proof_reviewed_at',now(),
        'proof_reviewed_by',auth.uid(),'cashbook_entry_id',v_entry_id,'cashbook_entry_code',v_entry_code,'financial_account_id',v_account_id
      ),
      commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)||jsonb_build_object(
        'cashbook_entry_id',v_entry_id,'cashbook_entry_code',v_entry_code,'financial_posted',true,'payment_confirmation_source','manual_proof_review'
      )
  where id=v_order.id and store_id=p_store_id;

  return jsonb_build_object(
    'ok',true,'proof_id',v_proof.id,'status','confirmed','payment_status','paid',
    'cashbook_entry_id',v_entry_id,'cashbook_entry_code',v_entry_code,'financial_account_id',v_account_id,
    'payment_method_code',v_method.code,'payment_method_name',v_method.name,'amount',v_order.total
  );
end;
$function$;
