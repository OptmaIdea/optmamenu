begin;

-- Password recovery is intentionally available WITHOUT the current password,
-- but only after consuming a one-time, purpose-bound OTP issued to the account.
-- Invocable exclusively by the controlled Edge Function via service_role.
create or replace function public.customer_reset_password_with_otp_service_safe(
  p_store_id uuid,
  p_phone text,
  p_otp text,
  p_new_password text
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_verified jsonb;
  v_customer_id uuid;
  v_password_result jsonb;
  v_now timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if p_store_id is null
     or p_phone is null
     or length(regexp_replace(coalesce(p_otp,''),'\D','','g')) <> 6
  then
    return jsonb_build_object('ok',false,'error','invalid_or_expired_otp');
  end if;

  -- Do not consume an OTP on a request with an invalid new password.
  if length(coalesce(p_new_password,'')) < 8
     or length(coalesce(p_new_password,'')) > 72
     or coalesce(p_new_password,'') !~ '[A-Za-z]'
     or coalesce(p_new_password,'') !~ '[0-9]'
  then
    return jsonb_build_object('ok',false,'error','weak_password');
  end if;

  v_verified := public.verify_customer_otp_sms_safe(
    p_phone, p_otp, p_store_id, 'password_reset'
  );

  if not coalesce((v_verified->>'isValid')::boolean,false)
     or coalesce((v_verified->>'isNewUser')::boolean,true)
     or nullif(v_verified#>>'{customer,id}','') is null
  then
    return jsonb_build_object(
      'ok',false,
      'error',case when coalesce((v_verified->>'locked')::boolean,false)
        then 'otp_locked' else 'invalid_or_expired_otp' end
    );
  end if;

  v_customer_id := (v_verified#>>'{customer,id}')::uuid;
  perform 1 from public.customers
    where id=v_customer_id and store_id=p_store_id
      and coalesce(status,'active')='active'
      and merged_into_customer_id is null
    for update;
  if not found then
    return jsonb_build_object('ok',false,'error','invalid_or_expired_otp');
  end if;

  v_password_result := public.customer_set_password_service_safe(
    v_customer_id, p_store_id, p_new_password
  );
  if not coalesce((v_password_result->>'ok')::boolean,false) then
    -- Raising rolls back OTP consumption; do not silently consume a valid code.
    raise exception 'password_reset_write_failed';
  end if;

  v_now := clock_timestamp();
  update public.customer_auth_identities
    set sessions_valid_after=v_now, updated_at=v_now
    where customer_id=v_customer_id and store_id=p_store_id and revoked_at is null;

  update public.customer_auth_session_devices
    set revoked_at=coalesce(revoked_at,v_now), last_seen_at=v_now
    where customer_id=v_customer_id and store_id=p_store_id and revoked_at is null;

  update public.customer_auth_trusted_devices
    set revoked_at=coalesce(revoked_at,v_now), updated_at=v_now
    where customer_id=v_customer_id and store_id=p_store_id and revoked_at is null;

  -- Other pending reset codes, including other channels, cannot be reused.
  update public.customer_otps set used=true,
      consumed_at=coalesce(consumed_at,v_now)
    where store_id=p_store_id and purpose='password_reset'
      and phone=(select phone_e164 from public.customers where id=v_customer_id)
      and coalesce(used,false)=false;

  return jsonb_build_object('ok',true,'sessions_revoked',true);
end;
$function$;

revoke all on function public.customer_reset_password_with_otp_service_safe(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.customer_reset_password_with_otp_service_safe(uuid,text,text,text)
  to service_role;

commit;
