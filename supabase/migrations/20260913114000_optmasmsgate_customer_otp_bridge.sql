create index if not exists customer_otps_store_phone_purpose_created_idx
on public.customer_otps (store_id, phone, purpose, created_at desc);

create or replace function public.issue_customer_otp_for_sms_safe(
  p_phone text,
  p_store_id uuid,
  p_purpose text default 'login'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_norm jsonb;
  v_phone text;
  v_match text;
  v_purpose text := lower(trim(coalesce(p_purpose, 'login')));
  v_entropy bytea;
  v_random_number bigint;
  v_otp text;
  v_hash text;
  v_expires_at timestamptz;
  v_recent_count integer;
  v_daily_count integer;
  v_otp_id uuid;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  if v_purpose not in (
    'login', 'registration', 'password_reset', 'profile_change',
    'phone_change', 'sensitive_action', 'account_delete'
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_purpose');
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id = p_store_id
      and s.public_store_enabled = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'store_unavailable');
  end if;

  v_norm := public.normalize_br_customer_phone(p_phone);
  if coalesce((v_norm->>'valid')::boolean, false) = false then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  v_phone := nullif(v_norm->>'e164', '');
  v_match := nullif(v_norm->>'match_key', '');
  if v_phone is null or v_match is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  select count(*) into v_recent_count
  from public.customer_otps co
  where co.store_id = p_store_id
    and co.phone = v_phone
    and co.created_at >= clock_timestamp() - interval '10 minutes';

  if v_recent_count >= 3 then
    return jsonb_build_object(
      'ok', false,
      'error', 'rate_limited',
      'retry_after_seconds', 600
    );
  end if;

  select count(*) into v_daily_count
  from public.customer_otps co
  where co.store_id = p_store_id
    and co.phone = v_phone
    and co.created_at >= clock_timestamp() - interval '24 hours';

  if v_daily_count >= 10 then
    return jsonb_build_object(
      'ok', false,
      'error', 'daily_limit_reached',
      'retry_after_seconds', 86400
    );
  end if;

  update public.customer_otps
  set used = true,
      consumed_at = coalesce(consumed_at, clock_timestamp()),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'superseded_at', clock_timestamp()
      )
  where store_id = p_store_id
    and phone = v_phone
    and purpose = v_purpose
    and coalesce(verified, false) = false
    and coalesce(used, false) = false;

  v_expires_at := clock_timestamp() + interval '5 minutes';
  v_entropy := gen_random_bytes(4);
  v_random_number :=
      get_byte(v_entropy, 0)::bigint * 16777216
    + get_byte(v_entropy, 1)::bigint * 65536
    + get_byte(v_entropy, 2)::bigint * 256
    + get_byte(v_entropy, 3)::bigint;
  v_otp := lpad((v_random_number % 1000000)::text, 6, '0');
  v_hash := crypt(v_otp, gen_salt('bf'));

  insert into public.customer_otps (
    phone, store_id, otp_code, otp_hash, expires_at, verified,
    attempts, used, last_sent_at, purpose, metadata
  ) values (
    v_phone, p_store_id, v_hash, v_hash, v_expires_at, false,
    0, false, clock_timestamp(), v_purpose,
    jsonb_build_object(
      'transport', 'optmasmsgate',
      'delivery_status', 'issuing',
      'phone_match_key', v_match,
      'requested_at', clock_timestamp()
    )
  ) returning id into v_otp_id;

  return jsonb_build_object(
    'ok', true,
    'otp_id', v_otp_id,
    'phone_number', v_phone,
    'otp', v_otp,
    'purpose', v_purpose,
    'expires_at', v_expires_at
  );
end;
$function$;

revoke all on function public.issue_customer_otp_for_sms_safe(text, uuid, text) from public;
revoke all on function public.issue_customer_otp_for_sms_safe(text, uuid, text) from anon;
revoke all on function public.issue_customer_otp_for_sms_safe(text, uuid, text) from authenticated;
grant execute on function public.issue_customer_otp_for_sms_safe(text, uuid, text) to service_role;

create or replace function public.mark_customer_otp_sms_delivery_safe(
  p_otp_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_provider_request_id text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if p_otp_id is null or v_status not in ('queued', 'failed') then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  update public.customer_otps
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'transport', 'optmasmsgate',
        'delivery_status', v_status,
        'provider_message_id', nullif(trim(coalesce(p_provider_message_id, '')), ''),
        'provider_request_id', nullif(trim(coalesce(p_provider_request_id, '')), ''),
        'provider_error_code', nullif(trim(coalesce(p_error_code, '')), ''),
        'delivery_updated_at', clock_timestamp()
      )),
      used = case when v_status = 'failed' then true else used end,
      consumed_at = case when v_status = 'failed' then coalesce(consumed_at, clock_timestamp()) else consumed_at end
  where id = p_otp_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'otp_not_found');
  end if;

  return jsonb_build_object('ok', true, 'otp_id', p_otp_id, 'status', v_status);
end;
$function$;

revoke all on function public.mark_customer_otp_sms_delivery_safe(uuid, text, text, text, text) from public;
revoke all on function public.mark_customer_otp_sms_delivery_safe(uuid, text, text, text, text) from anon;
revoke all on function public.mark_customer_otp_sms_delivery_safe(uuid, text, text, text, text) from authenticated;
grant execute on function public.mark_customer_otp_sms_delivery_safe(uuid, text, text, text, text) to service_role;

create or replace function public.verify_customer_otp_sms_safe(
  p_phone text,
  p_otp text,
  p_store_id uuid,
  p_purpose text default 'login'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_norm jsonb;
  v_match text;
  v_phone text;
  v_otp text;
  v_purpose text := lower(trim(coalesce(p_purpose, 'login')));
  v_hash text;
  v_row public.customer_otps%rowtype;
  v_customer public.customers%rowtype;
  v_is_new boolean := true;
  v_customer_json jsonb;
  v_next_attempts integer;
begin
  if p_store_id is null or v_purpose not in (
    'login', 'registration', 'password_reset', 'profile_change',
    'phone_change', 'sensitive_action', 'account_delete'
  ) then
    return jsonb_build_object('isValid', false);
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id = p_store_id
      and s.public_store_enabled = true
  ) then
    return jsonb_build_object('isValid', false);
  end if;

  v_norm := public.normalize_br_customer_phone(p_phone);
  if coalesce((v_norm->>'valid')::boolean, false) = false then
    return jsonb_build_object('isValid', false);
  end if;

  v_phone := nullif(v_norm->>'e164', '');
  v_match := nullif(v_norm->>'match_key', '');
  v_otp := regexp_replace(coalesce(p_otp, ''), '\D', '', 'g');

  if v_phone is null or v_match is null or length(v_otp) <> 6 then
    return jsonb_build_object('isValid', false);
  end if;

  select * into v_row
  from public.customer_otps
  where phone = v_phone
    and store_id = p_store_id
    and purpose = v_purpose
    and coalesce(verified, false) = false
    and coalesce(used, false) = false
    and expires_at > clock_timestamp()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('isValid', false);
  end if;

  if v_row.attempts >= 5 then
    update public.customer_otps
    set used = true,
        consumed_at = coalesce(consumed_at, clock_timestamp())
    where id = v_row.id;
    return jsonb_build_object('isValid', false, 'locked', true);
  end if;

  v_hash := coalesce(v_row.otp_hash, v_row.otp_code);
  v_next_attempts := v_row.attempts + 1;

  if v_hash is null or crypt(v_otp, v_hash) <> v_hash then
    update public.customer_otps
    set attempts = v_next_attempts,
        used = case when v_next_attempts >= 5 then true else used end,
        consumed_at = case when v_next_attempts >= 5 then coalesce(consumed_at, clock_timestamp()) else consumed_at end
    where id = v_row.id;

    return jsonb_build_object('isValid', false, 'locked', v_next_attempts >= 5);
  end if;

  update public.customer_otps
  set attempts = v_next_attempts,
      verified = true,
      used = true,
      verified_at = clock_timestamp(),
      consumed_at = clock_timestamp(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'verified_purpose', v_purpose,
        'verified_at', clock_timestamp()
      )
  where id = v_row.id;

  select * into v_customer
  from public.customers
  where phone_match_key = v_match
    and store_id = p_store_id
    and coalesce(status, 'active') = 'active'
  limit 1;

  if found then
    v_is_new := false;

    update public.customers
    set phone_verified_at = coalesce(phone_verified_at, clock_timestamp()),
        identity_verified_at = coalesce(identity_verified_at, clock_timestamp())
    where id = v_customer.id
      and store_id = p_store_id;

    v_customer_json := jsonb_build_object(
      'id', v_customer.id,
      'store_id', v_customer.store_id,
      'full_name', v_customer.full_name,
      'phone', v_customer.phone,
      'is_whatsapp', coalesce(v_customer.is_whatsapp, false),
      'contact_preference', v_customer.contact_preference,
      'loyalty_points', coalesce(v_customer.loyalty_points, 0),
      'loyalty_tier', coalesce(v_customer.loyalty_tier, 'Bronze'),
      'current_tier_id', v_customer.current_tier_id,
      'loyalty_opt_in', coalesce(v_customer.loyalty_opt_in, false),
      'status', coalesce(v_customer.status, 'active')
    );
  end if;

  return jsonb_build_object(
    'isValid', true,
    'isNewUser', v_is_new,
    'purpose', v_purpose,
    'customer', v_customer_json
  );
end;
$function$;

revoke all on function public.verify_customer_otp_sms_safe(text, text, uuid, text) from public;
grant execute on function public.verify_customer_otp_sms_safe(text, text, uuid, text) to anon, authenticated;
