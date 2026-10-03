-- Reconciled from the live Supabase schema on 2026-09-20.
-- The migration version 20260919220128 was already applied remotely but the
-- corresponding SQL file was missing from the GitHub branch.
--
-- Strong self-service phone change:
-- - requires an authenticated customer JWT;
-- - validates a one-time OTP issued specifically for the NEW phone;
-- - refuses a phone already owned by another active/non-anonymized customer
--   in the same store;
-- - consumes/locks OTP attempts atomically;
-- - updates the customer phone (normalization/contact sync remain enforced by
--   existing customers triggers);
-- - revokes every trusted device so the customer must sign in again.

create or replace function public.change_customer_self_phone_safe(
  p_new_phone text,
  p_otp text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_norm jsonb;
  v_new_phone text;
  v_new_match text;
  v_otp_row public.customer_otps%rowtype;
  v_clean_otp text := regexp_replace(coalesce(p_otp, ''), '\\D', '', 'g');
  v_now timestamptz := clock_timestamp();
  v_next_attempts integer;
begin
  if public.app_current_role() <> 'customer'
     or v_customer_id is null
     or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  v_norm := public.normalize_br_customer_phone(p_new_phone);
  if coalesce((v_norm->>'valid')::boolean, false) = false then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  v_new_phone := nullif(v_norm->>'e164', '');
  v_new_match := nullif(v_norm->>'match_key', '');

  if v_new_phone is null
     or v_new_match is null
     or length(v_clean_otp) <> 6 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  select *
  into v_customer
  from public.customers
  where id = v_customer_id
    and store_id = v_store_id
    and coalesce(status, 'active') = 'active'
    and merged_into_customer_id is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  if v_customer.phone_match_key = v_new_match then
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'phone', v_customer.phone,
      'phone_e164', v_customer.phone_e164
    );
  end if;

  if exists (
    select 1
    from public.customers c
    where c.store_id = v_store_id
      and c.id <> v_customer_id
      and c.phone_match_key = v_new_match
      and coalesce(c.status, 'active') not in ('merged', 'anonymized')
  ) then
    return jsonb_build_object('ok', false, 'error', 'phone_already_registered');
  end if;

  select *
  into v_otp_row
  from public.customer_otps
  where store_id = v_store_id
    and phone = v_new_phone
    and purpose = 'phone_change'
    and coalesce(verified, false) = false
    and coalesce(used, false) = false
    and expires_at > v_now
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_otp');
  end if;

  if coalesce(v_otp_row.attempts, 0) >= 5 then
    update public.customer_otps
       set used = true,
           consumed_at = coalesce(consumed_at, v_now)
     where id = v_otp_row.id;

    return jsonb_build_object('ok', false, 'error', 'otp_locked');
  end if;

  v_next_attempts := coalesce(v_otp_row.attempts, 0) + 1;

  if coalesce(v_otp_row.otp_hash, v_otp_row.otp_code) is null
     or crypt(
          v_clean_otp,
          coalesce(v_otp_row.otp_hash, v_otp_row.otp_code)
        ) <> coalesce(v_otp_row.otp_hash, v_otp_row.otp_code) then

    update public.customer_otps
       set attempts = v_next_attempts,
           used = case when v_next_attempts >= 5 then true else used end,
           consumed_at = case
             when v_next_attempts >= 5 then coalesce(consumed_at, v_now)
             else consumed_at
           end
     where id = v_otp_row.id;

    return jsonb_build_object(
      'ok', false,
      'error', case
        when v_next_attempts >= 5 then 'otp_locked'
        else 'invalid_or_expired_otp'
      end
    );
  end if;

  update public.customer_otps
     set attempts = v_next_attempts,
         verified = true,
         used = true,
         verified_at = v_now,
         consumed_at = v_now,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'verified_purpose', 'phone_change',
           'customer_id', v_customer_id,
           'verified_at', v_now
         )
   where id = v_otp_row.id;

  update public.customers
     set phone = v_new_phone,
         phone_verified_at = v_now,
         updated_at = v_now
   where id = v_customer_id
     and store_id = v_store_id;

  update public.customer_auth_trusted_devices
     set revoked_at = coalesce(revoked_at, v_now),
         updated_at = v_now
   where customer_id = v_customer_id
     and store_id = v_store_id
     and revoked_at is null;

  return jsonb_build_object(
    'ok', true,
    'phone', v_new_phone,
    'phone_e164', v_new_phone,
    'requires_relogin', true
  );
end;
$function$;

revoke all on function public.change_customer_self_phone_safe(text, text) from public;
revoke all on function public.change_customer_self_phone_safe(text, text) from anon;
grant execute on function public.change_customer_self_phone_safe(text, text) to authenticated;
grant execute on function public.change_customer_self_phone_safe(text, text) to service_role;
