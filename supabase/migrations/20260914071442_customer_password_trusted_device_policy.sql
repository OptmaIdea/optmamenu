-- Customer password login with periodic OTP step-up and trusted-browser policy.
--
-- Business rule:
-- - phone OTP proves ownership at registration/password recovery;
-- - normal login uses phone + password;
-- - OTP is required again after 30 days from the last OTP proof or after 15 days of inactivity.

create table if not exists public.customer_auth_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  device_token_hash text not null check (length(device_token_hash) = 64),
  first_verified_at timestamptz not null default clock_timestamp(),
  last_otp_verified_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (customer_id, device_token_hash)
);

create index if not exists customer_auth_trusted_devices_store_customer_idx
  on public.customer_auth_trusted_devices(store_id, customer_id);

create index if not exists customer_auth_trusted_devices_freshness_idx
  on public.customer_auth_trusted_devices(customer_id, last_otp_verified_at, last_seen_at)
  where revoked_at is null;

alter table public.customer_auth_trusted_devices enable row level security;

drop policy if exists customer_auth_trusted_devices_no_direct_access on public.customer_auth_trusted_devices;
create policy customer_auth_trusted_devices_no_direct_access
  on public.customer_auth_trusted_devices
  as restrictive
  for all
  to public
  using (false)
  with check (false);

revoke all on table public.customer_auth_trusted_devices from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_auth_trusted_devices to service_role;

create table if not exists public.customer_auth_password_challenges (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  challenge_hash text not null unique check (length(challenge_hash) = 64),
  device_token_hash text not null check (length(device_token_hash) = 64),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists customer_auth_password_challenges_lookup_idx
  on public.customer_auth_password_challenges(store_id, customer_id, expires_at)
  where consumed_at is null;

alter table public.customer_auth_password_challenges enable row level security;

drop policy if exists customer_auth_password_challenges_no_direct_access on public.customer_auth_password_challenges;
create policy customer_auth_password_challenges_no_direct_access
  on public.customer_auth_password_challenges
  as restrictive
  for all
  to public
  using (false)
  with check (false);

revoke all on table public.customer_auth_password_challenges from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_auth_password_challenges to service_role;

create or replace function public.customer_set_password_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
begin
  if p_customer_id is null or p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  if length(coalesce(p_password, '')) < 8
     or length(coalesce(p_password, '')) > 72
     or coalesce(p_password, '') !~ '[A-Za-z]'
     or coalesce(p_password, '') !~ '[0-9]' then
    return jsonb_build_object('ok', false, 'error', 'weak_password');
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and coalesce(c.status, 'active') = 'active'
      and c.merged_into_customer_id is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  insert into public.customer_credentials (
    customer_id,
    password_hash,
    failed_attempts,
    locked_until,
    password_changed_at,
    created_at,
    updated_at
  )
  values (
    p_customer_id,
    crypt(p_password, gen_salt('bf', 10)),
    0,
    null,
    clock_timestamp(),
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (customer_id) do update
  set password_hash = excluded.password_hash,
      failed_attempts = 0,
      locked_until = null,
      password_changed_at = clock_timestamp(),
      updated_at = clock_timestamp();

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.customer_set_password_service_safe(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.customer_set_password_service_safe(uuid, uuid, text) to service_role;

create or replace function public.customer_verify_password_service_safe(
  p_phone text,
  p_password text,
  p_store_id uuid,
  p_device_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_norm jsonb;
  v_match text;
  v_customer_id uuid;
  v_password_hash text;
  v_failed_attempts integer := 0;
  v_locked_until timestamptz;
  v_device record;
  v_otp_required boolean := true;
  v_reason text := 'new_device';
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or length(coalesce(p_password, '')) < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.public_store_enabled = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  v_norm := public.normalize_br_customer_phone(p_phone);
  v_match := nullif(v_norm->>'match_key', '');
  if v_match is null or coalesce((v_norm->>'valid')::boolean, false) = false then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  select c.id, cc.password_hash, cc.failed_attempts, cc.locked_until
  into v_customer_id, v_password_hash, v_failed_attempts, v_locked_until
  from public.customers c
  left join public.customer_credentials cc on cc.customer_id = c.id
  where c.store_id = p_store_id
    and c.phone_match_key = v_match
    and coalesce(c.status, 'active') = 'active'
    and c.merged_into_customer_id is null
  limit 1;

  if v_customer_id is null or v_password_hash is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  if v_locked_until is not null and v_locked_until > v_now then
    return jsonb_build_object(
      'ok', false,
      'error', 'locked',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_locked_until - v_now)))::int)
    );
  end if;

  if crypt(p_password, v_password_hash) <> v_password_hash then
    v_failed_attempts := coalesce(v_failed_attempts, 0) + 1;

    update public.customer_credentials
    set failed_attempts = v_failed_attempts,
        locked_until = case when v_failed_attempts >= 5 then v_now + interval '15 minutes' else null end,
        updated_at = v_now
    where customer_id = v_customer_id;

    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  update public.customer_credentials
  set failed_attempts = 0,
      locked_until = null,
      updated_at = v_now
  where customer_id = v_customer_id;

  if p_device_token_hash is not null and length(p_device_token_hash) = 64 then
    select td.last_otp_verified_at, td.last_seen_at
    into v_device
    from public.customer_auth_trusted_devices td
    where td.customer_id = v_customer_id
      and td.store_id = p_store_id
      and td.device_token_hash = p_device_token_hash
      and td.revoked_at is null
    limit 1;

    if found then
      if v_device.last_otp_verified_at < v_now - interval '30 days' then
        v_reason := 'verification_expired';
      elsif v_device.last_seen_at < v_now - interval '15 days' then
        v_reason := 'inactive';
      else
        v_otp_required := false;
        v_reason := null;

        update public.customer_auth_trusted_devices
        set last_seen_at = v_now,
            updated_at = v_now
        where customer_id = v_customer_id
          and store_id = p_store_id
          and device_token_hash = p_device_token_hash;

        update public.customers
        set last_login = v_now
        where id = v_customer_id and store_id = p_store_id;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'customer_id', v_customer_id,
    'otp_required', v_otp_required,
    'reason', v_reason
  );
end;
$function$;

revoke all on function public.customer_verify_password_service_safe(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.customer_verify_password_service_safe(text, text, uuid, text) to service_role;

create or replace function public.customer_trust_device_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_device_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_customer_id is null or p_store_id is null or length(coalesce(p_device_token_hash, '')) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and coalesce(c.status, 'active') = 'active'
      and c.merged_into_customer_id is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  insert into public.customer_auth_trusted_devices (
    customer_id,
    store_id,
    device_token_hash,
    first_verified_at,
    last_otp_verified_at,
    last_seen_at,
    revoked_at,
    created_at,
    updated_at
  )
  values (
    p_customer_id,
    p_store_id,
    p_device_token_hash,
    v_now,
    v_now,
    v_now,
    null,
    v_now,
    v_now
  )
  on conflict (customer_id, device_token_hash) do update
  set store_id = excluded.store_id,
      last_otp_verified_at = v_now,
      last_seen_at = v_now,
      revoked_at = null,
      updated_at = v_now;

  update public.customers
  set last_login = v_now,
      phone_verified_at = coalesce(phone_verified_at, v_now),
      identity_verified_at = coalesce(identity_verified_at, v_now)
  where id = p_customer_id and store_id = p_store_id;

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.customer_trust_device_service_safe(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.customer_trust_device_service_safe(uuid, uuid, text) to service_role;

create or replace function public.customer_touch_trusted_device_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_device_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_device record;
  v_now timestamptz := clock_timestamp();
begin
  if p_customer_id is null or p_store_id is null or length(coalesce(p_device_token_hash, '')) <> 64 then
    return jsonb_build_object('ok', false, 'reauth_required', true, 'reason', 'device_not_trusted');
  end if;

  select td.id, td.last_otp_verified_at, td.last_seen_at
  into v_device
  from public.customer_auth_trusted_devices td
  where td.customer_id = p_customer_id
    and td.store_id = p_store_id
    and td.device_token_hash = p_device_token_hash
    and td.revoked_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reauth_required', true, 'reason', 'device_not_trusted');
  end if;

  if v_device.last_otp_verified_at < v_now - interval '30 days' then
    return jsonb_build_object('ok', false, 'reauth_required', true, 'reason', 'verification_expired');
  end if;

  if v_device.last_seen_at < v_now - interval '15 days' then
    return jsonb_build_object('ok', false, 'reauth_required', true, 'reason', 'inactive');
  end if;

  update public.customer_auth_trusted_devices
  set last_seen_at = v_now,
      updated_at = v_now
  where id = v_device.id;

  return jsonb_build_object('ok', true, 'reauth_required', false);
end;
$function$;

revoke all on function public.customer_touch_trusted_device_service_safe(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.customer_touch_trusted_device_service_safe(uuid, uuid, text) to service_role;
