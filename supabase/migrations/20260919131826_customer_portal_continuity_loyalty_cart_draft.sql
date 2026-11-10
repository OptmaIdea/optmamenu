-- OptmaMenu
-- Continuidade do portal do cliente: perfil seguro, fidelidade idempotente,
-- extrato de pontos e carrinho autenticado persistido no servidor.

create or replace function public.update_customer_self_profile_safe(
  p_full_name text default null,
  p_nickname text default null,
  p_email text default null,
  p_cpf text default null,
  p_birth_date date default null,
  p_is_whatsapp boolean default null,
  p_contact_preference text default null,
  p_loyalty_opt_in boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_current public.customers%rowtype;
  v_email text;
  v_cpf text;
  v_next_loyalty boolean;
  v_contact_preference text;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  select * into v_current
  from public.customers
  where id = v_customer_id and store_id = v_store_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  if v_current.status not in ('active','inactive') then
    return jsonb_build_object('ok', false, 'error', 'customer_not_editable');
  end if;

  v_email := case
    when p_email is null then v_current.email
    else nullif(lower(trim(p_email)), '')
  end;

  if v_email is not null
     and v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  v_cpf := case
    when p_cpf is null then v_current.cpf
    else nullif(regexp_replace(p_cpf, '\D', '', 'g'), '')
  end;

  if v_current.cpf is not null
     and p_cpf is not null
     and v_cpf is distinct from regexp_replace(v_current.cpf, '\D', '', 'g') then
    return jsonb_build_object('ok', false, 'error', 'cpf_locked');
  end if;

  if v_cpf is not null and length(v_cpf) <> 11 then
    return jsonb_build_object('ok', false, 'error', 'invalid_cpf');
  end if;

  if p_birth_date is not null and p_birth_date > current_date then
    return jsonb_build_object('ok', false, 'error', 'invalid_birth_date');
  end if;

  if v_current.birth_date is not null
     and p_birth_date is not null
     and p_birth_date is distinct from v_current.birth_date then
    return jsonb_build_object('ok', false, 'error', 'birth_date_locked');
  end if;

  v_contact_preference := coalesce(
    nullif(trim(p_contact_preference), ''),
    v_current.contact_preference,
    'whatsapp'
  );

  if v_contact_preference not in ('whatsapp','sms','both') then
    return jsonb_build_object('ok', false, 'error', 'invalid_contact_preference');
  end if;

  v_next_loyalty := coalesce(p_loyalty_opt_in, v_current.loyalty_opt_in, false);

  update public.customers
  set
    full_name = case when p_full_name is null then v_current.full_name else nullif(trim(p_full_name),'') end,
    nickname = case when p_nickname is null then v_current.nickname else nullif(trim(p_nickname),'') end,
    email = v_email,
    email_verified = case
      when v_email is not distinct from v_current.email then coalesce(v_current.email_verified,false)
      else false
    end,
    cpf = case when v_current.cpf is not null then v_current.cpf else v_cpf end,
    birth_date = case when v_current.birth_date is not null then v_current.birth_date else p_birth_date end,
    is_whatsapp = coalesce(p_is_whatsapp,v_current.is_whatsapp,true),
    contact_preference = v_contact_preference,
    loyalty_opt_in = v_next_loyalty,
    data_ownership = 'customer_owned',
    editable_by_store = false,
    updated_at = clock_timestamp()
  where id = v_customer_id and store_id = v_store_id;

  if p_loyalty_opt_in is not null
     and v_next_loyalty is distinct from coalesce(v_current.loyalty_opt_in,false) then
    insert into public.customer_consent_logs(
      customer_id,store_id,consent_type,action,source,revoked_at,metadata
    )
    values(
      v_customer_id,
      v_store_id,
      'loyalty_program',
      case when v_next_loyalty then 'granted' else 'revoked' end,
      'customer_portal_profile',
      case when v_next_loyalty then null else clock_timestamp() end,
      jsonb_build_object(
        'evidence','customer_self_service',
        'previous',v_current.loyalty_opt_in,
        'current',v_next_loyalty
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'customer_id', v_customer_id);
end;
$function$;

create or replace function public.set_customer_self_consent_safe(
  p_consent_type text,
  p_granted boolean,
  p_terms_version text default null,
  p_privacy_version text default null,
  p_source text default 'customer_portal'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_action text := case when coalesce(p_granted,false) then 'granted' else 'revoked' end;
  v_event_at timestamptz := clock_timestamp();
  v_marketing_consent boolean := false;
  v_loyalty_opt_in boolean := false;
  v_previous_action text;
  v_unchanged boolean := false;
  v_customer public.customers%rowtype;
  v_missing text[] := array[]::text[];
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if p_consent_type not in ('loyalty_program','marketing_whatsapp','marketing_email','marketing_sms') then
    return jsonb_build_object('ok',false,'error','invalid_consent_type');
  end if;

  select * into v_customer
  from public.customers
  where id = v_customer_id and store_id = v_store_id
  for update;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  if p_consent_type = 'loyalty_program' and coalesce(p_granted,false) then
    if coalesce(length(trim(v_customer.full_name)),0) < 3 then
      v_missing := array_append(v_missing,'nome');
    end if;
    if v_customer.birth_date is null then
      v_missing := array_append(v_missing,'data de nascimento');
    end if;
    if v_customer.birth_date is not null
       and age(current_date, v_customer.birth_date) >= interval '18 years'
       and length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g')) <> 11 then
      v_missing := array_append(v_missing,'CPF');
    end if;
    if v_customer.email is null
       or v_customer.email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
      v_missing := array_append(v_missing,'e-mail válido');
    end if;

    if array_length(v_missing,1) is not null then
      return jsonb_build_object(
        'ok',false,
        'error','loyalty_profile_incomplete',
        'missing_fields',to_jsonb(v_missing),
        'message','Complete seu cadastro antes de entrar no programa: ' || array_to_string(v_missing, ', ') || '.'
      );
    end if;
  end if;

  select ccl.action
    into v_previous_action
  from public.customer_consent_logs ccl
  where ccl.customer_id = v_customer_id
    and ccl.store_id = v_store_id
    and ccl.consent_type = p_consent_type
  order by ccl.created_at desc, ccl.id desc
  limit 1;

  v_unchanged := v_previous_action = v_action;

  if not v_unchanged then
    insert into public.customer_consent_logs(
      customer_id, store_id, consent_type, action,
      terms_version, privacy_version, source, revoked_at, metadata, created_at
    )
    values(
      v_customer_id, v_store_id, p_consent_type, v_action,
      p_terms_version, p_privacy_version,
      coalesce(nullif(trim(p_source), ''), 'customer_portal'),
      case when v_action='revoked' then v_event_at else null end,
      jsonb_build_object('recorded_by','customer_self_service'),
      v_event_at
    );
  end if;

  select exists (
    select 1
    from (
      select distinct on (consent_type)
        consent_type,
        action
      from public.customer_consent_logs
      where customer_id = v_customer_id
        and store_id = v_store_id
        and consent_type in ('marketing_whatsapp','marketing_email','marketing_sms')
      order by consent_type, created_at desc, id desc
    ) latest
    where latest.action = 'granted'
  )
  into v_marketing_consent;

  select coalesce((
    select action = 'granted'
    from public.customer_consent_logs
    where customer_id = v_customer_id
      and store_id = v_store_id
      and consent_type = 'loyalty_program'
    order by created_at desc, id desc
    limit 1
  ), false)
  into v_loyalty_opt_in;

  update public.customers
  set
    marketing_consent = v_marketing_consent,
    loyalty_opt_in = v_loyalty_opt_in,
    updated_at = clock_timestamp()
  where id = v_customer_id
    and store_id = v_store_id;

  return jsonb_build_object(
    'ok',true,
    'consent_type',p_consent_type,
    'action',v_action,
    'unchanged',v_unchanged,
    'marketing_consent',v_marketing_consent,
    'loyalty_opt_in',v_loyalty_opt_in,
    'recorded_at',v_event_at
  );
end;
$function$;

revoke all on function public.set_customer_self_consent_safe(text,boolean,text,text,text) from public, anon;
grant execute on function public.set_customer_self_consent_safe(text,boolean,text,text,text) to authenticated, service_role;

create or replace function public.get_customer_self_loyalty_transactions_safe(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_items jsonb;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if not exists (
    select 1 from public.customers
    where id=v_customer_id and store_id=v_store_id and status not in ('merged','anonymized')
  ) then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',x.id,
      'type',x.type,
      'points',x.points,
      'description',x.description,
      'order_id',x.order_id,
      'order_code',x.order_code,
      'created_at',x.created_at,
      'reward_id',x.reward_id
    )
    order by x.created_at desc
  ), '[]'::jsonb)
  into v_items
  from (
    select lt.id, lt.type, lt.points, lt.description, lt.order_id,
           lt.created_at, lt.reward_id, o.order_code
    from public.loyalty_transactions lt
    left join public.orders o
      on o.id = lt.order_id
     and o.customer_id = v_customer_id
     and o.store_id = v_store_id
    where lt.customer_id = v_customer_id
    order by lt.created_at desc
    limit v_limit
  ) x;

  return jsonb_build_object('ok',true,'transactions',v_items);
end;
$function$;

revoke all on function public.get_customer_self_loyalty_transactions_safe(integer) from public, anon;
grant execute on function public.get_customer_self_loyalty_transactions_safe(integer) to authenticated, service_role;

create table if not exists public.customer_cart_drafts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  cart jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint customer_cart_drafts_store_customer_key unique(store_id, customer_id)
);

create index if not exists customer_cart_drafts_customer_idx
  on public.customer_cart_drafts(customer_id, updated_at desc);

alter table public.customer_cart_drafts enable row level security;
revoke all on table public.customer_cart_drafts from public, anon, authenticated;
grant all on table public.customer_cart_drafts to service_role;

create or replace function public.get_customer_self_cart_draft_safe()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_cart jsonb;
  v_updated_at timestamptz;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select cart, updated_at into v_cart, v_updated_at
  from public.customer_cart_drafts
  where customer_id=v_customer_id and store_id=v_store_id;

  return jsonb_build_object(
    'ok',true,
    'cart',coalesce(v_cart,'{}'::jsonb),
    'updated_at',v_updated_at
  );
end;
$function$;

create or replace function public.save_customer_self_cart_draft_safe(p_cart jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_store_from_cart text;
  v_items jsonb;
  v_updated_at timestamptz;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if p_cart is null or jsonb_typeof(p_cart) <> 'object' then
    return jsonb_build_object('ok',false,'error','invalid_cart');
  end if;

  if pg_column_size(p_cart) > 262144 then
    return jsonb_build_object('ok',false,'error','cart_too_large');
  end if;

  v_items := coalesce(p_cart->'items','[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) > 100 then
    return jsonb_build_object('ok',false,'error','invalid_cart_items');
  end if;

  v_store_from_cart := nullif(p_cart #>> '{context,storeId}','');
  if v_store_from_cart is not null and v_store_from_cart <> v_store_id::text then
    return jsonb_build_object('ok',false,'error','cart_store_mismatch');
  end if;

  insert into public.customer_cart_drafts(store_id,customer_id,cart,updated_at)
  values(v_store_id,v_customer_id,p_cart,clock_timestamp())
  on conflict (store_id,customer_id)
  do update set cart=excluded.cart, updated_at=clock_timestamp()
  returning updated_at into v_updated_at;

  return jsonb_build_object('ok',true,'updated_at',v_updated_at);
end;
$function$;

create or replace function public.clear_customer_self_cart_draft_safe()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  delete from public.customer_cart_drafts
  where customer_id=v_customer_id and store_id=v_store_id;

  return jsonb_build_object('ok',true);
end;
$function$;

revoke all on function public.get_customer_self_cart_draft_safe() from public, anon;
revoke all on function public.save_customer_self_cart_draft_safe(jsonb) from public, anon;
revoke all on function public.clear_customer_self_cart_draft_safe() from public, anon;

grant execute on function public.get_customer_self_cart_draft_safe() to authenticated, service_role;
grant execute on function public.save_customer_self_cart_draft_safe(jsonb) to authenticated, service_role;
grant execute on function public.clear_customer_self_cart_draft_safe() to authenticated, service_role;
