-- OptmaPay public checkout bridge.
-- 1) Sincroniza a disponibilidade pública do PIX API com o estado REAL do provider.
-- 2) Cria/reutiliza intent Pix de pedido sob lock transacional.
-- 3) Não aceita amount/store/payment dados do navegador como autoridade.

create or replace function public.sync_optmapay_checkout_availability_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_available boolean;
begin
  if new.provider_code <> 'optma_sandbox' or new.environment <> 'sandbox' then
    return new;
  end if;

  v_available := coalesce(new.enabled,false) and new.credential_status='ready';

  update public.store_payment_methods pm
  set metadata =
        coalesce(pm.metadata,'{}'::jsonb)
        || jsonb_build_object(
          'checkout',
          coalesce(pm.metadata->'checkout','{}'::jsonb)
          || jsonb_build_object(
            'pay_now',v_available,
            'confirmation_mode','api',
            'integration_enabled',v_available,
            'provider_code','optma_sandbox'
          )
        ),
      requires_proof=false,
      updated_at=now()
  where pm.store_id=new.store_id
    and pm.code='pix'
    and coalesce(pm.base_code,pm.code)='pix';

  return new;
end;
$function$;

drop trigger if exists trg_sync_optmapay_checkout_availability on public.store_online_payment_providers;
create trigger trg_sync_optmapay_checkout_availability
after insert or update of enabled,credential_status,public_config
on public.store_online_payment_providers
for each row
execute function public.sync_optmapay_checkout_availability_trigger();

revoke all on function public.sync_optmapay_checkout_availability_trigger() from public, anon, authenticated;

-- Sincroniza o estado já existente imediatamente.
update public.store_payment_methods pm
set metadata =
      coalesce(pm.metadata,'{}'::jsonb)
      || jsonb_build_object(
        'checkout',
        coalesce(pm.metadata->'checkout','{}'::jsonb)
        || jsonb_build_object(
          'pay_now',(
            select coalesce(p.enabled,false) and p.credential_status='ready'
            from public.store_online_payment_providers p
            where p.store_id=pm.store_id
              and p.provider_code='optma_sandbox'
              and p.environment='sandbox'
            limit 1
          ),
          'confirmation_mode','api',
          'integration_enabled',(
            select coalesce(p.enabled,false) and p.credential_status='ready'
            from public.store_online_payment_providers p
            where p.store_id=pm.store_id
              and p.provider_code='optma_sandbox'
              and p.environment='sandbox'
            limit 1
          ),
          'provider_code','optma_sandbox'
        )
      ),
    requires_proof=false,
    updated_at=now()
where pm.code='pix'
  and coalesce(pm.base_code,pm.code)='pix'
  and exists (
    select 1 from public.store_online_payment_providers p
    where p.store_id=pm.store_id
      and p.provider_code='optma_sandbox'
      and p.environment='sandbox'
  );

create or replace function public.create_or_reuse_optmapay_public_pix_intent_internal(
  p_public_order_token text,
  p_candidate_intent_id uuid,
  p_external_reference text,
  p_pix_payload text,
  p_expires_at timestamptz,
  p_merchant_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_role text;
  v_order public.orders%rowtype;
  v_method public.store_payment_methods%rowtype;
  v_provider public.store_online_payment_providers%rowtype;
  v_intent public.online_payment_intents%rowtype;
  v_account_ref text;
  v_settlement_account_id uuid;
  v_expected_reference text;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.role(), ''),
    current_user
  );

  if v_role not in ('service_role','postgres','supabase_admin') then
    return jsonb_build_object('ok',false,'error','service_role_required');
  end if;

  if p_public_order_token is null or length(trim(p_public_order_token)) < 24 then
    return jsonb_build_object('ok',false,'error','invalid_token');
  end if;

  select *
  into v_order
  from public.orders
  where public_order_token=trim(p_public_order_token)
  limit 1
  for update;

  if v_order.id is null then
    return jsonb_build_object('ok',false,'error','order_not_found');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_order.id::text,0));

  if v_order.status::text in ('cancelled','expired') then
    return jsonb_build_object('ok',false,'error','order_not_eligible','order_status',v_order.status::text);
  end if;

  if v_order.payment_status='paid' then
    select i.*
    into v_intent
    from public.online_payment_intents i
    join public.store_online_payment_providers p on p.id=i.provider_id
    where i.store_id=v_order.store_id
      and i.order_id=v_order.id
      and p.provider_code='optma_sandbox'
      and p.environment='sandbox'
      and i.method_code='pix'
    order by i.created_at desc
    limit 1;

    return jsonb_build_object(
      'ok',true,
      'already_paid',true,
      'order_id',v_order.id,
      'order_code',v_order.order_code,
      'intent',case when v_intent.id is null then null else jsonb_build_object(
        'id',v_intent.id,
        'status',v_intent.status,
        'amount',v_intent.amount,
        'external_reference',v_intent.external_reference,
        'pix_payload',v_intent.pix_payload,
        'expires_at',v_intent.expires_at,
        'paid_at',v_intent.paid_at
      ) end
    );
  end if;

  if v_order.expires_at is not null and v_order.expires_at<=now() then
    return jsonb_build_object('ok',false,'error','order_expired');
  end if;

  select *
  into v_method
  from public.store_payment_methods pm
  where pm.store_id=v_order.store_id
    and pm.code=v_order.payment_method_code
    and pm.active=true
    and pm.public_enabled=true
  limit 1;

  if v_method.id is null
     or coalesce(v_method.base_code,v_method.code)<>'pix'
     or v_method.requires_proof
     or coalesce(v_method.metadata->'checkout'->>'confirmation_mode','')<>'api'
     or coalesce((v_method.metadata->'checkout'->>'integration_enabled')::boolean,false) is not true
     or coalesce(v_method.metadata->'checkout'->>'provider_code','')<>'optma_sandbox'
  then
    return jsonb_build_object('ok',false,'error','payment_method_not_optmapay_pix');
  end if;

  select *
  into v_provider
  from public.store_online_payment_providers p
  where p.store_id=v_order.store_id
    and p.provider_code='optma_sandbox'
    and p.environment='sandbox'
  limit 1
  for update;

  if v_provider.id is null
     or not v_provider.enabled
     or v_provider.credential_status<>'ready'
     or coalesce((v_provider.capabilities->>'pix')::boolean,false) is not true
  then
    return jsonb_build_object('ok',false,'error','provider_not_ready');
  end if;

  if nullif(v_provider.public_config->>'optmapay_account_id','') is null
     or (v_provider.public_config->>'optmapay_account_id')::uuid<>p_merchant_account_id
  then
    return jsonb_build_object('ok',false,'error','merchant_account_mismatch');
  end if;

  v_account_ref := nullif(trim(coalesce(v_provider.public_config->>'settlement_financial_account_id','')),'');
  if v_account_ref is null then
    return jsonb_build_object('ok',false,'error','settlement_account_required');
  end if;

  begin
    v_settlement_account_id := v_account_ref::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok',false,'error','invalid_settlement_account');
  end;

  if not exists (
    select 1
    from public.store_financial_accounts a
    where a.id=v_settlement_account_id
      and a.store_id=v_order.store_id
      and a.active=true
      and exists (
        select 1
        from public.store_financial_account_payment_methods apm
        where apm.store_id=v_order.store_id
          and apm.account_id=a.id
          and apm.active=true
          and apm.payment_method_code in (v_method.code,coalesce(v_method.base_code,v_method.code))
      )
  ) then
    return jsonb_build_object('ok',false,'error','settlement_account_incompatible');
  end if;

  select i.*
  into v_intent
  from public.online_payment_intents i
  where i.store_id=v_order.store_id
    and i.order_id=v_order.id
    and i.provider_id=v_provider.id
    and i.method_code='pix'
    and i.status in ('created','pending','authorized','paid')
  order by i.created_at desc
  limit 1
  for update;

  if v_intent.id is not null and v_intent.status='paid' then
    return jsonb_build_object(
      'ok',true,'reused',true,'already_paid',true,
      'order_id',v_order.id,'order_code',v_order.order_code,
      'intent',jsonb_build_object(
        'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
        'external_reference',v_intent.external_reference,'pix_payload',v_intent.pix_payload,
        'expires_at',v_intent.expires_at,'paid_at',v_intent.paid_at
      )
    );
  end if;

  if v_intent.id is not null
     and v_intent.expires_at is not null
     and v_intent.expires_at>now()
  then
    return jsonb_build_object(
      'ok',true,'reused',true,
      'order_id',v_order.id,'order_code',v_order.order_code,
      'intent',jsonb_build_object(
        'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
        'external_reference',v_intent.external_reference,'pix_payload',v_intent.pix_payload,
        'expires_at',v_intent.expires_at,'paid_at',v_intent.paid_at
      )
    );
  end if;

  if v_intent.id is not null then
    update public.online_payment_intents
    set status='expired',updated_at=now()
    where id=v_intent.id and status in ('created','pending','authorized');
  end if;

  if p_candidate_intent_id is null
     or p_pix_payload is null
     or trim(p_pix_payload)=''
     or p_expires_at is null
     or p_expires_at<=now()
  then
    return jsonb_build_object('ok',false,'error','invalid_payment_instruction');
  end if;

  if v_order.expires_at is not null and p_expires_at>v_order.expires_at then
    return jsonb_build_object('ok',false,'error','payment_expiry_exceeds_order');
  end if;

  v_expected_reference := 'optmamenu:' || v_order.store_id::text || ':' || p_candidate_intent_id::text || ':pix';
  if p_external_reference<>v_expected_reference then
    return jsonb_build_object('ok',false,'error','invalid_external_reference');
  end if;

  insert into public.online_payment_intents(
    id,store_id,order_id,provider_id,method_code,amount,status,
    external_reference,pix_payload,provider_snapshot,metadata,expires_at,created_by
  ) values (
    p_candidate_intent_id,v_order.store_id,v_order.id,v_provider.id,'pix',v_order.total,'pending',
    p_external_reference,p_pix_payload,
    jsonb_build_object(
      'account_id',p_merchant_account_id,
      'environment','sandbox',
      'realMoney',false
    ),
    jsonb_build_object(
      'sandbox',true,
      'provider_contract','optmapay_sandbox_v1',
      'checkout_mode','embedded',
      'public_checkout',true,
      'idempotency_key',p_external_reference
    ),
    p_expires_at,null
  )
  returning * into v_intent;

  return jsonb_build_object(
    'ok',true,'reused',false,
    'order_id',v_order.id,'order_code',v_order.order_code,
    'intent',jsonb_build_object(
      'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
      'external_reference',v_intent.external_reference,'pix_payload',v_intent.pix_payload,
      'expires_at',v_intent.expires_at,'paid_at',v_intent.paid_at
    )
  );
end;
$function$;

revoke all on function public.create_or_reuse_optmapay_public_pix_intent_internal(text,uuid,text,text,timestamptz,uuid)
from public,anon,authenticated;
grant execute on function public.create_or_reuse_optmapay_public_pix_intent_internal(text,uuid,text,text,timestamptz,uuid)
to service_role;
