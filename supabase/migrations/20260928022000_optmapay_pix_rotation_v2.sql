-- OptmaPay Pix v2: instrução de 15 minutos, até 2 rotações automáticas por ciclo.
-- Depois da segunda rotação automática, a UI exige regeneração explícita.
-- Cada emissão mantém a reserva ativa até a validade do código e adiciona 5 min de graça.

create or replace function public.create_or_reuse_optmapay_public_pix_intent_v2_internal(
  p_public_order_token text,
  p_candidate_intent_id uuid,
  p_external_reference text,
  p_pix_payload text,
  p_expires_at timestamptz,
  p_merchant_account_id uuid,
  p_rotation_mode text default 'initial'
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
  v_rotation_mode text;
  v_rotation_cycle integer := 0;
  v_auto_rotation_index integer := 0;
  v_latest_cycle integer := 0;
  v_latest_auto_rotation integer := 0;
  v_grace_until timestamptz;
  v_active_reservations integer := 0;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.role(), ''),
    current_user
  );

  if v_role not in ('service_role','postgres','supabase_admin') then
    return jsonb_build_object('ok',false,'error','service_role_required');
  end if;

  v_rotation_mode := lower(trim(coalesce(p_rotation_mode,'initial')));
  if v_rotation_mode not in ('initial','automatic','manual') then
    return jsonb_build_object('ok',false,'error','invalid_rotation_mode');
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

  if v_order.status::text in ('cancelled','expired','completed') then
    return jsonb_build_object(
      'ok',false,
      'error','order_not_eligible',
      'order_status',v_order.status::text
    );
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
      'manual_regeneration_required',false,
      'intent',case when v_intent.id is null then null else jsonb_build_object(
        'id',v_intent.id,
        'status',v_intent.status,
        'amount',v_intent.amount,
        'external_reference',v_intent.external_reference,
        'pix_payload',v_intent.pix_payload,
        'expires_at',v_intent.expires_at,
        'paid_at',v_intent.paid_at,
        'rotation_cycle',coalesce((v_intent.metadata->>'rotation_cycle')::integer,0),
        'auto_rotation_index',coalesce((v_intent.metadata->>'auto_rotation_index')::integer,0)
      ) end
    );
  end if;

  if v_order.cancellation_grace_until is not null
     and v_order.cancellation_grace_until<=now()
  then
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
  order by i.created_at desc
  limit 1
  for update;

  if v_intent.id is not null then
    v_latest_cycle := coalesce((v_intent.metadata->>'rotation_cycle')::integer,0);
    v_latest_auto_rotation := coalesce((v_intent.metadata->>'auto_rotation_index')::integer,0);

    if v_intent.status='paid' then
      return jsonb_build_object(
        'ok',true,'reused',true,'already_paid',true,
        'order_id',v_order.id,'order_code',v_order.order_code,
        'manual_regeneration_required',false,
        'intent',jsonb_build_object(
          'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
          'external_reference',v_intent.external_reference,'pix_payload',v_intent.pix_payload,
          'expires_at',v_intent.expires_at,'paid_at',v_intent.paid_at,
          'rotation_cycle',v_latest_cycle,
          'auto_rotation_index',v_latest_auto_rotation
        )
      );
    end if;

    if v_intent.status in ('created','pending','authorized')
       and v_intent.expires_at is not null
       and v_intent.expires_at>now()
    then
      return jsonb_build_object(
        'ok',true,'reused',true,
        'order_id',v_order.id,'order_code',v_order.order_code,
        'manual_regeneration_required',false,
        'intent',jsonb_build_object(
          'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
          'external_reference',v_intent.external_reference,'pix_payload',v_intent.pix_payload,
          'expires_at',v_intent.expires_at,'paid_at',v_intent.paid_at,
          'rotation_cycle',v_latest_cycle,
          'auto_rotation_index',v_latest_auto_rotation
        )
      );
    end if;

    if v_intent.status in ('created','pending','authorized') then
      update public.online_payment_intents
      set status='expired',updated_at=now()
      where id=v_intent.id;
    end if;
  end if;

  if v_rotation_mode='automatic' then
    if v_intent.id is null then
      v_rotation_cycle := 0;
      v_auto_rotation_index := 0;
    else
      if v_latest_auto_rotation>=2 then
        return jsonb_build_object(
          'ok',false,
          'error','manual_regeneration_required',
          'manual_regeneration_required',true,
          'rotation_cycle',v_latest_cycle,
          'auto_rotation_index',v_latest_auto_rotation
        );
      end if;
      v_rotation_cycle := v_latest_cycle;
      v_auto_rotation_index := v_latest_auto_rotation + 1;
    end if;
  elsif v_rotation_mode='manual' then
    v_rotation_cycle := case when v_intent.id is null then 0 else v_latest_cycle + 1 end;
    v_auto_rotation_index := 0;
  else
    v_rotation_cycle := case when v_intent.id is null then 0 else v_latest_cycle end;
    v_auto_rotation_index := case when v_intent.id is null then 0 else v_latest_auto_rotation end;
  end if;

  if p_candidate_intent_id is null
     or p_pix_payload is null
     or trim(p_pix_payload)=''
     or p_expires_at is null
     or p_expires_at<=now()
     or p_expires_at>now()+interval '16 minutes'
  then
    return jsonb_build_object('ok',false,'error','invalid_payment_instruction');
  end if;

  v_expected_reference :=
    'optmamenu:' || v_order.store_id::text || ':' || p_candidate_intent_id::text || ':pix';

  if p_external_reference<>v_expected_reference then
    return jsonb_build_object('ok',false,'error','invalid_external_reference');
  end if;

  select count(*)::integer
    into v_active_reservations
  from public.stock_reservations sr
  where sr.order_id=v_order.id
    and sr.store_id=v_order.store_id
    and sr.status='active';

  if v_active_reservations<=0 then
    return jsonb_build_object('ok',false,'error','active_reservation_required');
  end if;

  v_grace_until := p_expires_at + interval '5 minutes';

  update public.stock_reservations sr
  set expires_at=p_expires_at,
      metadata=coalesce(sr.metadata,'{}'::jsonb) || jsonb_build_object(
        'payment_instruction_expires_at',p_expires_at,
        'payment_rotation_cycle',v_rotation_cycle,
        'payment_auto_rotation_index',v_auto_rotation_index,
        'payment_rotation_mode',v_rotation_mode,
        'payment_timer_extended_at',now()
      )
  where sr.order_id=v_order.id
    and sr.store_id=v_order.store_id
    and sr.status='active';

  update public.orders
  set expires_at=p_expires_at,
      available_until=p_expires_at,
      cancellation_grace_until=v_grace_until,
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'payment_instruction_expires_at',p_expires_at,
        'payment_rotation_cycle',v_rotation_cycle,
        'payment_auto_rotation_index',v_auto_rotation_index
      ),
      commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb) || jsonb_build_object(
        'payment_instruction_expires_at',p_expires_at,
        'payment_rotation_cycle',v_rotation_cycle,
        'payment_auto_rotation_index',v_auto_rotation_index,
        'payment_regeneration_grace_until',v_grace_until
      ),
      updated_at=now()
  where id=v_order.id
    and store_id=v_order.store_id
    and coalesce(payment_status,'pending')<>'paid';

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
      'provider_contract','optmapay_sandbox_v2',
      'checkout_mode','embedded',
      'public_checkout',true,
      'idempotency_key',p_external_reference,
      'rotation_cycle',v_rotation_cycle,
      'auto_rotation_index',v_auto_rotation_index,
      'rotation_mode',v_rotation_mode,
      'validity_minutes',15,
      'manual_regeneration_after_auto_rotations',2
    ),
    p_expires_at,null
  )
  returning * into v_intent;

  return jsonb_build_object(
    'ok',true,
    'reused',false,
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'manual_regeneration_required',false,
    'intent',jsonb_build_object(
      'id',v_intent.id,
      'status',v_intent.status,
      'amount',v_intent.amount,
      'external_reference',v_intent.external_reference,
      'pix_payload',v_intent.pix_payload,
      'expires_at',v_intent.expires_at,
      'paid_at',v_intent.paid_at,
      'rotation_cycle',v_rotation_cycle,
      'auto_rotation_index',v_auto_rotation_index
    )
  );
end;
$function$;

revoke all on function public.create_or_reuse_optmapay_public_pix_intent_v2_internal(
  text,uuid,text,text,timestamptz,uuid,text
) from public,anon,authenticated;

grant execute on function public.create_or_reuse_optmapay_public_pix_intent_v2_internal(
  text,uuid,text,text,timestamptz,uuid,text
) to service_role;
