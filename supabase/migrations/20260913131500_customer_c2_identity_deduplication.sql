-- CLIENTES C2 — identidade e deduplicação segura
-- Objetivos:
-- 1) detectar duplicidades por sinais normalizados sem auto-fusão;
-- 2) criar trilha imutável de fusões;
-- 3) permitir fusão transacional e conservadora somente a operadores autorizados;
-- 4) preservar identidade verificada, credenciais, restrições, consentimentos e vínculos.

create or replace function public.normalize_customer_email(p_email text)
returns text
language sql
immutable
strict
set search_path = 'public'
as $$
  select nullif(lower(trim(p_email)), '');
$$;

create or replace function public.normalize_customer_cpf(p_cpf text)
returns text
language sql
immutable
strict
set search_path = 'public'
as $$
  select nullif(regexp_replace(p_cpf, '\D', '', 'g'), '');
$$;

create or replace function public.normalize_customer_name(p_name text)
returns text
language sql
immutable
strict
set search_path = 'public'
as $$
  select nullif(lower(trim(regexp_replace(p_name, '\s+', ' ', 'g'))), '');
$$;

create index if not exists idx_customers_store_email_normalized
  on public.customers (store_id, public.normalize_customer_email(email))
  where email is not null and status <> all (array['merged'::text, 'anonymized'::text]);

create index if not exists idx_customers_store_cpf_normalized
  on public.customers (store_id, public.normalize_customer_cpf(cpf))
  where cpf is not null and status <> all (array['merged'::text, 'anonymized'::text]);

create index if not exists idx_customers_store_name_birth
  on public.customers (store_id, public.normalize_customer_name(full_name), birth_date)
  where full_name is not null and birth_date is not null
    and status <> all (array['merged'::text, 'anonymized'::text]);

create table if not exists public.customer_merge_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  canonical_customer_id uuid not null references public.customers(id) on delete restrict,
  duplicate_customer_id uuid not null references public.customers(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  match_basis jsonb not null default '[]'::jsonb,
  moved_counts jsonb not null default '{}'::jsonb,
  canonical_snapshot jsonb not null,
  duplicate_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint customer_merge_events_distinct_customers_check
    check (canonical_customer_id <> duplicate_customer_id)
);

create index if not exists idx_customer_merge_events_store_created
  on public.customer_merge_events (store_id, created_at desc);
create index if not exists idx_customer_merge_events_canonical
  on public.customer_merge_events (canonical_customer_id, created_at desc);
create index if not exists idx_customer_merge_events_duplicate
  on public.customer_merge_events (duplicate_customer_id, created_at desc);

alter table public.customer_merge_events enable row level security;
drop policy if exists customer_merge_events_explicit_deny on public.customer_merge_events;
create policy customer_merge_events_explicit_deny
on public.customer_merge_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table public.customer_merge_events from public, anon, authenticated;
grant select on table public.customer_merge_events to service_role;

create or replace function public.get_customer_duplicate_candidates_safe(
  p_store_id uuid,
  p_customer_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_sensitive boolean := false;
  v_candidates jsonb := '[]'::jsonb;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id', 'candidates', '[]'::jsonb);
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission(p_store_id, 'customers.view')
      or public.user_has_store_permission(p_store_id, 'customers.manage')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied', 'candidates', '[]'::jsonb);
    end if;
  end if;

  v_sensitive := auth.uid() is null
    or public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'customers.sensitive.view');

  with candidate_pairs as (
    select
      a.id as a_id,
      b.id as b_id,
      a.full_name as a_name,
      b.full_name as b_name,
      a.phone as a_phone,
      b.phone as b_phone,
      a.email as a_email,
      b.email as b_email,
      a.birth_date as a_birth_date,
      b.birth_date as b_birth_date,
      a.status as a_status,
      b.status as b_status,
      a.source as a_source,
      b.source as b_source,
      a.data_ownership as a_ownership,
      b.data_ownership as b_ownership,
      a.total_orders as a_total_orders,
      b.total_orders as b_total_orders,
      a.total_spent as a_total_spent,
      b.total_spent as b_total_spent,
      a.created_at as a_created_at,
      b.created_at as b_created_at,
      (a.phone_match_key is not null and a.phone_match_key = b.phone_match_key) as same_phone,
      (v_sensitive and public.normalize_customer_cpf(a.cpf) is not null
        and public.normalize_customer_cpf(a.cpf) = public.normalize_customer_cpf(b.cpf)) as same_cpf,
      (public.normalize_customer_email(a.email) is not null
        and public.normalize_customer_email(a.email) = public.normalize_customer_email(b.email)) as same_email,
      (v_sensitive and a.birth_date is not null and a.birth_date = b.birth_date
        and public.normalize_customer_name(a.full_name) is not null
        and public.normalize_customer_name(a.full_name) = public.normalize_customer_name(b.full_name)) as same_name_birth,
      exists(select 1 from public.customer_credentials ca where ca.customer_id = a.id) as a_has_credentials,
      exists(select 1 from public.customer_credentials cb where cb.customer_id = b.id) as b_has_credentials,
      (a.phone_verified_at is not null) as a_phone_verified,
      (b.phone_verified_at is not null) as b_phone_verified
    from public.customers a
    join public.customers b
      on b.store_id = a.store_id
     and b.id > a.id
    where a.store_id = p_store_id
      and a.status <> all(array['merged'::text, 'anonymized'::text])
      and b.status <> all(array['merged'::text, 'anonymized'::text])
      and (p_customer_id is null or p_customer_id in (a.id, b.id))
  ), scored as (
    select *,
      least(100,
        (case when same_phone then 100 else 0 end)
        + (case when same_cpf then 95 else 0 end)
        + (case when same_email then 65 else 0 end)
        + (case when same_name_birth then 55 else 0 end)
      )::integer as score
    from candidate_pairs
    where same_phone or same_cpf or same_email or same_name_birth
  ), limited as (
    select *
    from scored
    order by score desc, least(a_created_at, b_created_at) asc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'score', score,
      'match_reasons', to_jsonb(array_remove(array[
        case when same_phone then 'phone' end,
        case when same_cpf then 'cpf' end,
        case when same_email then 'email' end,
        case when same_name_birth then 'name_birth_date' end
      ]::text[], null)),
      'suggested_canonical_id', case
        when a_ownership = 'customer_owned' and b_ownership <> 'customer_owned' then a_id
        when b_ownership = 'customer_owned' and a_ownership <> 'customer_owned' then b_id
        when a_has_credentials and not b_has_credentials then a_id
        when b_has_credentials and not a_has_credentials then b_id
        when a_phone_verified and not b_phone_verified then a_id
        when b_phone_verified and not a_phone_verified then b_id
        when a_total_orders > b_total_orders then a_id
        when b_total_orders > a_total_orders then b_id
        when a_created_at <= b_created_at then a_id
        else b_id
      end,
      'customer_a', jsonb_build_object(
        'id', a_id, 'full_name', a_name, 'phone', a_phone, 'email', a_email,
        'birth_date', case when v_sensitive then a_birth_date else null end,
        'status', a_status, 'source', a_source, 'data_ownership', a_ownership,
        'total_orders', a_total_orders, 'total_spent', a_total_spent,
        'has_credentials', a_has_credentials, 'phone_verified', a_phone_verified
      ),
      'customer_b', jsonb_build_object(
        'id', b_id, 'full_name', b_name, 'phone', b_phone, 'email', b_email,
        'birth_date', case when v_sensitive then b_birth_date else null end,
        'status', b_status, 'source', b_source, 'data_ownership', b_ownership,
        'total_orders', b_total_orders, 'total_spent', b_total_spent,
        'has_credentials', b_has_credentials, 'phone_verified', b_phone_verified
      )
    ) order by score desc, least(a_created_at, b_created_at) asc
  ), '[]'::jsonb)
  into v_candidates
  from limited;

  return jsonb_build_object(
    'ok', true,
    'candidates', v_candidates,
    'sensitive_data_visible', v_sensitive
  );
end;
$$;

create or replace function public.get_customer_merge_history_safe(
  p_store_id uuid,
  p_customer_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_events jsonb := '[]'::jsonb;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id', 'events', '[]'::jsonb);
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission(p_store_id, 'customers.view')
      or public.user_has_store_permission(p_store_id, 'customers.manage')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied', 'events', '[]'::jsonb);
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'canonical_customer_id', e.canonical_customer_id,
    'duplicate_customer_id', e.duplicate_customer_id,
    'actor_user_id', e.actor_user_id,
    'reason', e.reason,
    'match_basis', e.match_basis,
    'moved_counts', e.moved_counts,
    'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb)
  into v_events
  from (
    select *
    from public.customer_merge_events
    where store_id = p_store_id
      and (p_customer_id is null or p_customer_id in (canonical_customer_id, duplicate_customer_id))
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ) e;

  return jsonb_build_object('ok', true, 'events', v_events);
end;
$$;

create or replace function public.merge_customers_safe(
  p_store_id uuid,
  p_canonical_customer_id uuid,
  p_duplicate_customer_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_canonical public.customers%rowtype;
  v_duplicate public.customers%rowtype;
  v_merge_id uuid;
  v_canonical_has_credentials boolean := false;
  v_duplicate_has_credentials boolean := false;
  v_canonical_has_legal boolean := false;
  v_duplicate_has_legal boolean := false;
  v_cpf_canonical text;
  v_cpf_duplicate text;
  v_match_basis text[] := '{}'::text[];
  v_counts jsonb := '{}'::jsonb;
  v_count integer := 0;
  v_tags text[] := '{}'::text[];
  v_next_status text;
begin
  if p_store_id is null or p_canonical_customer_id is null or p_duplicate_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  if p_canonical_customer_id = p_duplicate_customer_id then
    return jsonb_build_object('ok', false, 'error', 'same_customer');
  end if;

  if length(trim(coalesce(p_reason, ''))) < 8 then
    return jsonb_build_object('ok', false, 'error', 'merge_reason_required', 'message', 'Informe um motivo claro para a fusão.');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or (
        public.user_has_store_permission(p_store_id, 'customers.manage')
        and public.user_has_store_permission(p_store_id, 'customers.sensitive.view')
      )
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied', 'message', 'A fusão exige gerenciar clientes e acesso a dados sensíveis.');
    end if;
  end if;

  select * into v_canonical
  from public.customers
  where id = p_canonical_customer_id
  for update;

  select * into v_duplicate
  from public.customers
  where id = p_duplicate_customer_id
  for update;

  if v_canonical.id is null or v_duplicate.id is null then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  if v_canonical.store_id <> p_store_id or v_duplicate.store_id <> p_store_id then
    return jsonb_build_object('ok', false, 'error', 'cross_store_merge_not_allowed');
  end if;

  if v_canonical.status in ('merged', 'anonymized') or v_duplicate.status in ('merged', 'anonymized')
     or v_canonical.merged_into_customer_id is not null or v_duplicate.merged_into_customer_id is not null then
    return jsonb_build_object('ok', false, 'error', 'customer_already_merged_or_anonymized');
  end if;

  select exists(select 1 from public.customer_credentials where customer_id = v_canonical.id)
    into v_canonical_has_credentials;
  select exists(select 1 from public.customer_credentials where customer_id = v_duplicate.id)
    into v_duplicate_has_credentials;
  select exists(select 1 from public.customer_legal_profiles where customer_id = v_canonical.id)
    into v_canonical_has_legal;
  select exists(select 1 from public.customer_legal_profiles where customer_id = v_duplicate.id)
    into v_duplicate_has_legal;

  if v_canonical_has_credentials and v_duplicate_has_credentials then
    return jsonb_build_object('ok', false, 'error', 'credentials_conflict', 'message', 'Os dois cadastros possuem credenciais. Resolva a identidade antes da fusão.');
  end if;

  if v_duplicate_has_credentials and not v_canonical_has_credentials then
    return jsonb_build_object('ok', false, 'error', 'credentialed_customer_must_be_canonical', 'message', 'O cadastro que possui credenciais deve ser mantido como principal.');
  end if;

  if v_duplicate.data_ownership = 'customer_owned' and v_canonical.data_ownership <> 'customer_owned' then
    return jsonb_build_object('ok', false, 'error', 'customer_owned_must_be_canonical', 'message', 'O cadastro controlado pelo cliente deve ser mantido como principal.');
  end if;

  if v_duplicate.identity_verified_at is not null and v_canonical.identity_verified_at is null then
    return jsonb_build_object('ok', false, 'error', 'verified_identity_must_be_canonical', 'message', 'A identidade verificada deve ser mantida como principal.');
  end if;

  if v_duplicate.phone_verified_at is not null and v_canonical.phone_verified_at is null
     and v_duplicate.phone_match_key is distinct from v_canonical.phone_match_key then
    return jsonb_build_object('ok', false, 'error', 'verified_phone_must_be_canonical', 'message', 'O telefone verificado deve pertencer ao cadastro principal.');
  end if;

  if v_canonical.phone_verified_at is not null and v_duplicate.phone_verified_at is not null
     and v_canonical.phone_match_key is distinct from v_duplicate.phone_match_key then
    return jsonb_build_object('ok', false, 'error', 'verified_phone_conflict', 'message', 'Os cadastros possuem telefones verificados diferentes.');
  end if;

  v_cpf_canonical := public.normalize_customer_cpf(v_canonical.cpf);
  v_cpf_duplicate := public.normalize_customer_cpf(v_duplicate.cpf);

  if v_cpf_canonical is not null and v_cpf_duplicate is not null and v_cpf_canonical <> v_cpf_duplicate then
    return jsonb_build_object('ok', false, 'error', 'cpf_conflict', 'message', 'Os cadastros possuem CPFs diferentes.');
  end if;

  if v_canonical.birth_date is not null and v_duplicate.birth_date is not null
     and v_canonical.birth_date <> v_duplicate.birth_date then
    return jsonb_build_object('ok', false, 'error', 'birth_date_conflict', 'message', 'Os cadastros possuem datas de nascimento diferentes.');
  end if;

  if v_canonical.person_type <> v_duplicate.person_type then
    return jsonb_build_object('ok', false, 'error', 'person_type_conflict', 'message', 'Os cadastros possuem tipos de pessoa diferentes.');
  end if;

  if v_canonical_has_legal and v_duplicate_has_legal then
    return jsonb_build_object('ok', false, 'error', 'legal_profile_conflict', 'message', 'Os dois cadastros possuem perfil legal. Revise-os antes da fusão.');
  end if;

  if exists (
    select 1
    from public.promotion_campaign_recipients d
    join public.promotion_campaign_recipients c
      on c.campaign_id = d.campaign_id
     and c.customer_id = v_canonical.id
    where d.customer_id = v_duplicate.id
  ) then
    return jsonb_build_object('ok', false, 'error', 'campaign_recipient_conflict', 'message', 'Há campanhas com os dois cadastros. Resolva os destinatários antes da fusão.');
  end if;

  if v_canonical.phone_match_key is not null and v_canonical.phone_match_key = v_duplicate.phone_match_key then
    v_match_basis := array_append(v_match_basis, 'phone');
  end if;
  if v_cpf_canonical is not null and v_cpf_canonical = v_cpf_duplicate then
    v_match_basis := array_append(v_match_basis, 'cpf');
  end if;
  if public.normalize_customer_email(v_canonical.email) is not null
     and public.normalize_customer_email(v_canonical.email) = public.normalize_customer_email(v_duplicate.email) then
    v_match_basis := array_append(v_match_basis, 'email');
  end if;
  if v_canonical.birth_date is not null and v_canonical.birth_date = v_duplicate.birth_date
     and public.normalize_customer_name(v_canonical.full_name) is not null
     and public.normalize_customer_name(v_canonical.full_name) = public.normalize_customer_name(v_duplicate.full_name) then
    v_match_basis := array_append(v_match_basis, 'name_birth_date');
  end if;

  insert into public.customer_merge_events(
    store_id, canonical_customer_id, duplicate_customer_id, actor_user_id,
    reason, match_basis, canonical_snapshot, duplicate_snapshot
  ) values (
    p_store_id, v_canonical.id, v_duplicate.id, auth.uid(),
    trim(p_reason), to_jsonb(v_match_basis), to_jsonb(v_canonical), to_jsonb(v_duplicate)
  ) returning id into v_merge_id;

  if exists(select 1 from public.customer_addresses where customer_id = v_canonical.id and is_default) then
    update public.customer_addresses set is_default = false
    where customer_id = v_duplicate.id and is_default;
  end if;
  update public.customer_addresses set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('addresses', v_count);

  update public.customer_benefit_rules set target_customer_id = v_canonical.id where target_customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('benefit_rules', v_count);

  update public.customer_consent_logs set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('consent_logs', v_count);

  update public.customer_contacts set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('contacts', v_count);

  if v_duplicate_has_legal and not v_canonical_has_legal then
    update public.customer_legal_profiles set customer_id = v_canonical.id where customer_id = v_duplicate.id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('legal_profiles', v_count);
  else
    v_counts := v_counts || jsonb_build_object('legal_profiles', 0);
  end if;

  update public.customer_notifications set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('notifications', v_count);

  delete from public.customer_segment_members d
  where d.customer_id = v_duplicate.id
    and exists (
      select 1 from public.customer_segment_members c
      where c.segment_id = d.segment_id and c.customer_id = v_canonical.id
    );
  update public.customer_segment_members set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('segment_memberships_moved', v_count);

  update public.fidelity_vouchers set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('vouchers', v_count);

  update public.loyalty_transactions set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('loyalty_transactions', v_count);

  update public.orders set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('orders', v_count);

  update public.promotion_campaign_recipients set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('campaign_recipients', v_count);

  select coalesce(array_agg(distinct x order by x), '{}'::text[])
  into v_tags
  from unnest(coalesce(v_canonical.tags, '{}'::text[]) || coalesce(v_duplicate.tags, '{}'::text[])) as t(x);

  v_next_status := case
    when v_canonical.status = 'blocked' or v_duplicate.status = 'blocked' then 'blocked'
    when v_canonical.status = 'restricted' or v_duplicate.status = 'restricted' then 'restricted'
    when v_canonical.status = 'active' or v_duplicate.status = 'active' then 'active'
    else v_canonical.status
  end;

  update public.customers
  set
    full_name = coalesce(nullif(trim(v_canonical.full_name), ''), v_duplicate.full_name),
    nickname = coalesce(nullif(trim(v_canonical.nickname), ''), v_duplicate.nickname),
    email = coalesce(nullif(trim(v_canonical.email), ''), v_duplicate.email),
    email_verified = case
      when nullif(trim(v_canonical.email), '') is not null then coalesce(v_canonical.email_verified, false)
      else coalesce(v_duplicate.email_verified, false)
    end,
    cpf = coalesce(nullif(regexp_replace(coalesce(v_canonical.cpf, ''), '\D', '', 'g'), ''), v_duplicate.cpf),
    birth_date = coalesce(v_canonical.birth_date, v_duplicate.birth_date),
    birth_date_locked = coalesce(v_canonical.birth_date_locked, false) or coalesce(v_duplicate.birth_date_locked, false),
    is_whatsapp = coalesce(v_canonical.is_whatsapp, false) or coalesce(v_duplicate.is_whatsapp, false),
    contact_preference = coalesce(v_canonical.contact_preference, v_duplicate.contact_preference),
    loyalty_points = coalesce(v_canonical.loyalty_points, 0) + coalesce(v_duplicate.loyalty_points, 0),
    current_stamps = coalesce(v_canonical.current_stamps, 0) + coalesce(v_duplicate.current_stamps, 0),
    last_login = greatest(v_canonical.last_login, v_duplicate.last_login),
    last_point_activity_at = greatest(v_canonical.last_point_activity_at, v_duplicate.last_point_activity_at),
    identity_verified_at = greatest(v_canonical.identity_verified_at, v_duplicate.identity_verified_at),
    tags = v_tags,
    internal_notes = concat_ws(E'\n\n', nullif(trim(coalesce(v_canonical.internal_notes, '')), ''),
      case when nullif(trim(coalesce(v_duplicate.internal_notes, '')), '') is not null
        then '[Fusão ' || v_merge_id::text || '] ' || trim(v_duplicate.internal_notes)
        else null end),
    data_ownership = case
      when v_canonical.data_ownership = v_duplicate.data_ownership then v_canonical.data_ownership
      else 'mixed'
    end,
    editable_by_store = coalesce(v_canonical.editable_by_store, true) and coalesce(v_duplicate.editable_by_store, true),
    status = v_next_status,
    restriction_reason = coalesce(v_canonical.restriction_reason, v_duplicate.restriction_reason),
    blocked_at = coalesce(v_canonical.blocked_at, v_duplicate.blocked_at),
    blocked_by = coalesce(v_canonical.blocked_by, v_duplicate.blocked_by),
    customer_metadata = coalesce(v_canonical.customer_metadata, '{}'::jsonb) || jsonb_build_object(
      'last_merge_id', v_merge_id,
      'last_merged_customer_id', v_duplicate.id,
      'last_merged_at', now()
    ),
    updated_at = now()
  where id = v_canonical.id;

  perform public.refresh_customer_commercial_summary(v_canonical.id);

  update public.customers
  set
    status = 'merged',
    merged_into_customer_id = v_canonical.id,
    merged_at = now(),
    merged_by = auth.uid(),
    editable_by_store = false,
    loyalty_points = 0,
    current_stamps = 0,
    total_orders = 0,
    total_spent = 0,
    last_order_at = null,
    customer_metadata = coalesce(customer_metadata, '{}'::jsonb) || jsonb_build_object(
      'merge_id', v_merge_id,
      'merged_into_customer_id', v_canonical.id,
      'merged_at', now()
    ),
    updated_at = now()
  where id = v_duplicate.id;

  update public.customer_merge_events
  set moved_counts = v_counts
  where id = v_merge_id;

  return jsonb_build_object(
    'ok', true,
    'merge_id', v_merge_id,
    'canonical_customer_id', v_canonical.id,
    'duplicate_customer_id', v_duplicate.id,
    'match_basis', to_jsonb(v_match_basis),
    'moved_counts', v_counts
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'merge_unique_conflict', 'message', 'A fusão encontrou um vínculo duplicado que precisa ser revisado antes de continuar.');
end;
$$;

revoke all on function public.get_customer_duplicate_candidates_safe(uuid, uuid, integer) from public, anon;
revoke all on function public.get_customer_merge_history_safe(uuid, uuid, integer) from public, anon;
revoke all on function public.merge_customers_safe(uuid, uuid, uuid, text) from public, anon;

grant execute on function public.get_customer_duplicate_candidates_safe(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.get_customer_merge_history_safe(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.merge_customers_safe(uuid, uuid, uuid, text) to authenticated, service_role;

comment on table public.customer_merge_events is 'Ledger imutável de fusões de clientes. Snapshots permanecem inacessíveis diretamente à API.';
comment on function public.get_customer_duplicate_candidates_safe(uuid, uuid, integer) is 'Detecta possíveis duplicidades sem realizar auto-fusão; dados sensíveis dependem de customers.sensitive.view.';
comment on function public.merge_customers_safe(uuid, uuid, uuid, text) is 'Funde dois clientes da mesma loja de forma transacional, conservadora e auditada.';
