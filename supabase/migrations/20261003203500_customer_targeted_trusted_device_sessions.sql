-- Bind each customer Auth session to the trusted browser/device that created it.
-- This enables targeted device revocation without invalidating unrelated sessions.

begin;

create table if not exists public.customer_auth_session_devices (
  session_id uuid primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  trusted_device_id uuid not null references public.customer_auth_trusted_devices(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists customer_auth_session_devices_customer_idx
  on public.customer_auth_session_devices(customer_id, store_id, revoked_at);

create index if not exists customer_auth_session_devices_device_idx
  on public.customer_auth_session_devices(trusted_device_id, revoked_at);

alter table public.customer_auth_session_devices enable row level security;

drop policy if exists customer_auth_session_devices_no_direct_access
  on public.customer_auth_session_devices;
create policy customer_auth_session_devices_no_direct_access
  on public.customer_auth_session_devices
  as restrictive
  for all
  to public
  using (false)
  with check (false);

revoke all on table public.customer_auth_session_devices
  from public, anon, authenticated;
grant all on table public.customer_auth_session_devices
  to service_role;

create or replace function public.customer_bind_session_device_service_safe(
  p_session_id uuid,
  p_customer_id uuid,
  p_store_id uuid,
  p_auth_user_id uuid,
  p_device_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_device_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if p_session_id is null
     or p_customer_id is null
     or p_store_id is null
     or p_auth_user_id is null
     or length(coalesce(p_device_token_hash, '')) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  if not exists (
    select 1
    from public.customer_auth_identities cai
    where cai.customer_id = p_customer_id
      and cai.store_id = p_store_id
      and cai.auth_user_id = p_auth_user_id
      and cai.revoked_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'identity_mismatch');
  end if;

  select td.id
    into v_device_id
  from public.customer_auth_trusted_devices td
  where td.customer_id = p_customer_id
    and td.store_id = p_store_id
    and td.device_token_hash = p_device_token_hash
    and td.revoked_at is null
  limit 1;

  if v_device_id is null then
    return jsonb_build_object('ok', false, 'error', 'device_not_trusted');
  end if;

  insert into public.customer_auth_session_devices(
    session_id,
    customer_id,
    store_id,
    auth_user_id,
    trusted_device_id,
    created_at,
    last_seen_at,
    revoked_at
  )
  values (
    p_session_id,
    p_customer_id,
    p_store_id,
    p_auth_user_id,
    v_device_id,
    v_now,
    v_now,
    null
  )
  on conflict (session_id) do update
  set customer_id = excluded.customer_id,
      store_id = excluded.store_id,
      auth_user_id = excluded.auth_user_id,
      trusted_device_id = excluded.trusted_device_id,
      last_seen_at = v_now,
      revoked_at = null;

  return jsonb_build_object('ok', true, 'trusted_device_id', v_device_id);
end;
$function$;

revoke all on function public.customer_bind_session_device_service_safe(uuid,uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.customer_bind_session_device_service_safe(uuid,uuid,uuid,uuid,text)
  to service_role;

create or replace function public.customer_touch_bound_session_service_safe(
  p_session_id uuid,
  p_customer_id uuid,
  p_store_id uuid,
  p_auth_user_id uuid,
  p_device_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
begin
  v_result := public.customer_bind_session_device_service_safe(
    p_session_id,
    p_customer_id,
    p_store_id,
    p_auth_user_id,
    p_device_token_hash
  );

  if coalesce((v_result->>'ok')::boolean, false) = false then
    return v_result;
  end if;

  update public.customer_auth_session_devices
     set last_seen_at = v_now
   where session_id = p_session_id
     and customer_id = p_customer_id
     and store_id = p_store_id
     and auth_user_id = p_auth_user_id
     and revoked_at is null;

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.customer_touch_bound_session_service_safe(uuid,uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.customer_touch_bound_session_service_safe(uuid,uuid,uuid,uuid,text)
  to service_role;

create or replace function public.customer_rename_trusted_device_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_current_device_hash text,
  p_target_device_id uuid,
  p_label text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_label text;
begin
  v_label := regexp_replace(btrim(coalesce(p_label, '')), '[[:cntrl:]]', '', 'g');
  if length(v_label) < 1 or length(v_label) > 40 then
    return jsonb_build_object('ok', false, 'error', 'invalid_label');
  end if;

  if not exists (
    select 1
    from public.customer_auth_trusted_devices td
    where td.customer_id = p_customer_id
      and td.store_id = p_store_id
      and td.device_token_hash = p_current_device_hash
      and td.revoked_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'reauth_required');
  end if;

  update public.customer_auth_trusted_devices
     set device_label = v_label,
         updated_at = clock_timestamp()
   where id = p_target_device_id
     and customer_id = p_customer_id
     and store_id = p_store_id
     and revoked_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'device_not_found');
  end if;

  return jsonb_build_object('ok', true, 'label', v_label);
end;
$function$;

revoke all on function public.customer_rename_trusted_device_service_safe(uuid,uuid,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.customer_rename_trusted_device_service_safe(uuid,uuid,text,uuid,text)
  to service_role;

create or replace function public.customer_revoke_trusted_device_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_current_device_hash text,
  p_target_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_current_device_id uuid;
  v_target_label text;
  v_now timestamptz := clock_timestamp();
  v_revoked_sessions integer := 0;
begin
  select td.id
    into v_current_device_id
  from public.customer_auth_trusted_devices td
  where td.customer_id = p_customer_id
    and td.store_id = p_store_id
    and td.device_token_hash = p_current_device_hash
    and td.revoked_at is null
  limit 1;

  if v_current_device_id is null then
    return jsonb_build_object('ok', false, 'error', 'reauth_required');
  end if;

  if p_target_device_id = v_current_device_id then
    return jsonb_build_object('ok', false, 'error', 'cannot_revoke_current_device');
  end if;

  select coalesce(nullif(btrim(td.device_label), ''), 'Dispositivo confiável')
    into v_target_label
  from public.customer_auth_trusted_devices td
  where td.id = p_target_device_id
    and td.customer_id = p_customer_id
    and td.store_id = p_store_id
    and td.revoked_at is null
  limit 1;

  if v_target_label is null then
    return jsonb_build_object('ok', false, 'error', 'device_not_found');
  end if;

  update public.customer_auth_trusted_devices
     set revoked_at = v_now,
         updated_at = v_now
   where id = p_target_device_id
     and customer_id = p_customer_id
     and store_id = p_store_id
     and revoked_at is null;

  update public.customer_auth_session_devices
     set revoked_at = coalesce(revoked_at, v_now),
         last_seen_at = v_now
   where trusted_device_id = p_target_device_id
     and customer_id = p_customer_id
     and store_id = p_store_id
     and revoked_at is null;

  get diagnostics v_revoked_sessions = row_count;

  insert into public.customer_notifications(
    customer_id, store_id, title, message, type, read, created_at
  ) values (
    p_customer_id,
    p_store_id,
    'Dispositivo desconectado',
    v_target_label || ' foi desconectado da sua conta.',
    'info',
    true,
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'device_id', p_target_device_id,
    'label', v_target_label,
    'revoked_sessions', v_revoked_sessions
  );
end;
$function$;

revoke all on function public.customer_revoke_trusted_device_service_safe(uuid,uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.customer_revoke_trusted_device_service_safe(uuid,uuid,text,uuid)
  to service_role;

-- A customer JWT is considered active only while its concrete Auth session remains
-- bound to an active trusted device. Staff/owner fallbacks are preserved.
create or replace function public.app_current_customer_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select (
    select cai.customer_id
    from public.customer_auth_identities cai
    join public.customer_auth_session_devices csd
      on csd.customer_id = cai.customer_id
     and csd.store_id = cai.store_id
     and csd.auth_user_id = cai.auth_user_id
     and csd.session_id = nullif(public.app_jwt_claim('session_id'), '')::uuid
     and csd.revoked_at is null
    join public.customer_auth_trusted_devices td
      on td.id = csd.trusted_device_id
     and td.customer_id = cai.customer_id
     and td.store_id = cai.store_id
     and td.revoked_at is null
    where cai.auth_user_id = auth.uid()
      and cai.revoked_at is null
      and (
        cai.sessions_valid_after is null
        or coalesce(nullif(public.app_jwt_claim('iat'), '')::bigint, 0)
           >= ceil(extract(epoch from cai.sessions_valid_after))::bigint
      )
    limit 1
  );
$function$;

create or replace function public.app_current_store_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (
      select cai.store_id
      from public.customer_auth_identities cai
      join public.customer_auth_session_devices csd
        on csd.customer_id = cai.customer_id
       and csd.store_id = cai.store_id
       and csd.auth_user_id = cai.auth_user_id
       and csd.session_id = nullif(public.app_jwt_claim('session_id'), '')::uuid
       and csd.revoked_at is null
      join public.customer_auth_trusted_devices td
        on td.id = csd.trusted_device_id
       and td.customer_id = cai.customer_id
       and td.store_id = cai.store_id
       and td.revoked_at is null
      where cai.auth_user_id = auth.uid()
        and cai.revoked_at is null
        and (
          cai.sessions_valid_after is null
          or coalesce(nullif(public.app_jwt_claim('iat'), '')::bigint, 0)
             >= ceil(extract(epoch from cai.sessions_valid_after))::bigint
        )
      limit 1
    ),
    (select s.id from public.stores s where s.user_id = auth.uid() limit 1)
  );
$function$;

create or replace function public.app_current_role()
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_customer uuid;
  v_claim text := public.app_jwt_claim('role');
begin
  select cai.customer_id
    into v_customer
  from public.customer_auth_identities cai
  join public.customer_auth_session_devices csd
    on csd.customer_id = cai.customer_id
   and csd.store_id = cai.store_id
   and csd.auth_user_id = cai.auth_user_id
   and csd.session_id = nullif(public.app_jwt_claim('session_id'), '')::uuid
   and csd.revoked_at is null
  join public.customer_auth_trusted_devices td
    on td.id = csd.trusted_device_id
   and td.customer_id = cai.customer_id
   and td.store_id = cai.store_id
   and td.revoked_at is null
  where cai.auth_user_id = auth.uid()
    and cai.revoked_at is null
    and (
      cai.sessions_valid_after is null
      or coalesce(nullif(public.app_jwt_claim('iat'), '')::bigint, 0)
         >= ceil(extract(epoch from cai.sessions_valid_after))::bigint
    )
  limit 1;

  if v_customer is not null then
    return 'customer';
  end if;

  return coalesce(v_claim, auth.role());
end;
$function$;

revoke all on function public.app_current_customer_id() from public, anon;
revoke all on function public.app_current_store_id() from public, anon;
revoke all on function public.app_current_role() from public, anon;
grant execute on function public.app_current_customer_id() to authenticated, service_role;
grant execute on function public.app_current_store_id() to authenticated, service_role;
grant execute on function public.app_current_role() to authenticated, service_role;

commit;
