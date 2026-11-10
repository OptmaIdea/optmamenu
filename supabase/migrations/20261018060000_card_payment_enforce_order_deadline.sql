begin;
CREATE OR REPLACE FUNCTION public.create_or_reuse_optmapay_public_card_intent_internal(p_public_order_token text, p_candidate_intent_id uuid, p_external_reference text, p_method_code text, p_installments integer DEFAULT 1, p_settlement_plan text DEFAULT 'standard'::text, p_merchant_account_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_role text;
  v_order public.orders%rowtype;
  v_method public.store_payment_methods%rowtype;
  v_provider public.store_online_payment_providers%rowtype;
  v_intent public.online_payment_intents%rowtype;
  v_expected_reference text;
  v_base_code text;
  v_installments integer;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(auth.role(),''),
    current_user
  );
  if v_role not in ('service_role','postgres','supabase_admin') then
    return jsonb_build_object('ok',false,'error','service_role_required');
  end if;

  if p_public_order_token is null or length(trim(p_public_order_token))<24 then
    return jsonb_build_object('ok',false,'error','invalid_token');
  end if;
  if p_candidate_intent_id is null then
    return jsonb_build_object('ok',false,'error','invalid_intent_id');
  end if;

  select * into v_order
  from public.orders
  where public_order_token=trim(p_public_order_token)
  limit 1
  for update;

  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_order.id::text,0));

  if v_order.status::text in ('cancelled','expired','completed') then
    return jsonb_build_object('ok',false,'error','order_not_eligible','order_status',v_order.status::text);
  end if;

  if v_order.payment_status='paid' then
    select i.* into v_intent
    from public.online_payment_intents i
    join public.store_online_payment_providers p on p.id=i.provider_id
    where i.store_id=v_order.store_id and i.order_id=v_order.id
      and p.provider_code='optma_sandbox' and p.environment='sandbox'
      and i.method_code in ('debit_card','credit_card')
    order by i.created_at desc limit 1;

    return jsonb_build_object(
      'ok',true,'already_paid',true,'order_id',v_order.id,'order_code',v_order.order_code,
      'intent',case when v_intent.id is null then null else jsonb_build_object(
        'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
        'method_code',v_intent.method_code,'external_reference',v_intent.external_reference,
        'paid_at',v_intent.paid_at,'metadata',v_intent.metadata
      ) end
    );
  end if;

  if v_order.expires_at is not null and v_order.expires_at<=clock_timestamp() then
    return jsonb_build_object('ok',false,'error','payment_deadline_expired');
  end if;

  select * into v_method
  from public.store_payment_methods pm
  where pm.store_id=v_order.store_id
    and pm.code=trim(p_method_code)
    and pm.active=true and pm.public_enabled=true
  limit 1;

  if v_method.id is null then return jsonb_build_object('ok',false,'error','payment_method_not_available'); end if;
  v_base_code := coalesce(nullif(v_method.base_code,''),v_method.code);

  if v_base_code not in ('debit_card','credit_card') then
    return jsonb_build_object('ok',false,'error','payment_method_not_card');
  end if;
  if v_order.payment_method_code is distinct from v_method.code then
    return jsonb_build_object('ok',false,'error','order_payment_method_mismatch');
  end if;
  if v_method.requires_proof
     or coalesce(v_method.metadata->'checkout'->>'confirmation_mode','')<>'api'
     or coalesce((v_method.metadata->'checkout'->>'integration_enabled')::boolean,false) is not true
     or coalesce(v_method.metadata->'checkout'->>'provider_code','')<>'optma_sandbox'
  then
    return jsonb_build_object('ok',false,'error','payment_method_not_optmapay_card');
  end if;

  select * into v_provider
  from public.store_online_payment_providers p
  where p.store_id=v_order.store_id
    and p.provider_code='optma_sandbox'
    and p.environment='sandbox'
  limit 1
  for update;

  if v_provider.id is null or not v_provider.enabled or v_provider.credential_status<>'ready' then
    return jsonb_build_object('ok',false,'error','provider_not_ready');
  end if;
  if v_base_code='debit_card' and coalesce((v_provider.capabilities->>'debit_card')::boolean,false) is not true then
    return jsonb_build_object('ok',false,'error','debit_card_not_supported');
  end if;
  if v_base_code='credit_card' and coalesce((v_provider.capabilities->>'credit_card')::boolean,false) is not true then
    return jsonb_build_object('ok',false,'error','credit_card_not_supported');
  end if;

  if p_merchant_account_id is null
     or nullif(v_provider.public_config->>'optmapay_account_id','') is null
     or (v_provider.public_config->>'optmapay_account_id')::uuid<>p_merchant_account_id
  then
    return jsonb_build_object('ok',false,'error','merchant_account_mismatch');
  end if;

  v_installments := greatest(1,least(12,coalesce(p_installments,1)));
  if v_base_code='debit_card' and v_installments<>1 then
    return jsonb_build_object('ok',false,'error','debit_installments_not_allowed');
  end if;

  select i.* into v_intent
  from public.online_payment_intents i
  where i.store_id=v_order.store_id and i.order_id=v_order.id
    and i.provider_id=v_provider.id and i.method_code=v_method.code
  order by i.created_at desc limit 1
  for update;

  if v_intent.id is not null and v_intent.status='paid' then
    return jsonb_build_object(
      'ok',true,'reused',true,'already_paid',true,
      'order_id',v_order.id,'order_code',v_order.order_code,
      'intent',jsonb_build_object(
        'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
        'method_code',v_intent.method_code,'external_reference',v_intent.external_reference,
        'paid_at',v_intent.paid_at,'metadata',v_intent.metadata
      )
    );
  end if;

  if v_intent.id is not null and v_intent.status in ('created','pending','authorized') then
    return jsonb_build_object(
      'ok',true,'reused',true,'already_paid',false,
      'order_id',v_order.id,'order_code',v_order.order_code,
      'intent',jsonb_build_object(
        'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
        'method_code',v_intent.method_code,'external_reference',v_intent.external_reference,
        'paid_at',v_intent.paid_at,'metadata',v_intent.metadata
      )
    );
  end if;

  if not exists (
    select 1 from public.stock_reservations sr
    where sr.order_id=v_order.id and sr.store_id=v_order.store_id and sr.status='active'
  ) then
    return jsonb_build_object('ok',false,'error','active_reservation_required');
  end if;

  v_expected_reference :=
    'optmamenu:'||v_order.store_id::text||':'||p_candidate_intent_id::text||':'||v_method.code;
  if p_external_reference<>v_expected_reference then
    return jsonb_build_object('ok',false,'error','invalid_external_reference');
  end if;

  insert into public.online_payment_intents(
    id,store_id,order_id,provider_id,method_code,amount,status,
    external_reference,provider_snapshot,metadata,expires_at,created_by
  ) values (
    p_candidate_intent_id,v_order.store_id,v_order.id,v_provider.id,v_method.code,v_order.total,'pending',
    p_external_reference,
    jsonb_build_object(
      'account_id',p_merchant_account_id,
      'environment','sandbox','realMoney',false
    ),
    jsonb_build_object(
      'sandbox',true,
      'provider_contract','optmapay_cards_v1',
      'checkout_mode','embedded',
      'public_checkout',true,
      'idempotency_key',p_external_reference,
      'installments',v_installments,
      'settlement_plan',coalesce(nullif(trim(p_settlement_plan),''),'standard'),
      'card_type',case when v_base_code='debit_card' then 'debit' else 'credit' end
    ),
    v_order.expires_at,null
  )
  returning * into v_intent;

  return jsonb_build_object(
    'ok',true,'reused',false,'already_paid',false,
    'order_id',v_order.id,'order_code',v_order.order_code,
    'intent',jsonb_build_object(
      'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
      'method_code',v_intent.method_code,'external_reference',v_intent.external_reference,
      'paid_at',v_intent.paid_at,'metadata',v_intent.metadata
    )
  );
end;
$function$
;
commit;