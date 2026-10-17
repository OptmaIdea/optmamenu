-- Migration aplicada no Supabase: rc_public_checkout_sandbox_payment_visibility
-- Campos da forma de pagamento para seleção de operações inteiramente simuladas.
CREATE OR REPLACE FUNCTION public.get_public_checkout_payment_options_by_slug(p_slug text, p_fulfillment_type text DEFAULT 'pickup'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    'integration_enabled',coalesce((pm.metadata->'checkout'->>'integration_enabled')::boolean,false),
    'sandbox_only', (
      coalesce(pm.metadata->'checkout'->>'provider_code','')='optma_sandbox'
      and coalesce(pm.metadata->'checkout'->>'confirmation_mode','')='api'
      and coalesce((pm.metadata->'checkout'->>'integration_enabled')::boolean,false)=true
    )
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
          and coalesce(pm.base_code,pm.code)='pix'
          and pm.code<>'pix_manual_qr'
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
$function$
;