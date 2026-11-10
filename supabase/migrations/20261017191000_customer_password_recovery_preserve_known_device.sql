begin;

-- Preserves only a pre-existing, recently verified trusted device after password
-- recovery. ALL sessions are revoked by the underlying reset RPC regardless.
-- A new/revoked/stale device receives no exemption from the SMS step-up.
create or replace function public.customer_reset_password_with_otp_known_device_service_safe(
  p_store_id uuid,
  p_phone text,
  p_otp text,
  p_new_password text,
  p_device_token_hash text default null
) returns jsonb
language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $fn$
declare
  v_normalized jsonb;
  v_match text;
  v_known_device_id uuid;
  v_result jsonb;
  v_rows int;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  -- The device fingerprint is a high entropy secret held by the browser.
  -- Its presence alone never authorizes a password reset; the purpose-bound OTP
  -- remains mandatory in customer_reset_password_with_otp_service_safe.
  if coalesce(p_device_token_hash,'') ~ '^[0-9a-f]{64}$' then
    v_normalized := public.normalize_br_customer_phone(p_phone);
    if coalesce((v_normalized->>'valid')::boolean,false) then
      v_match := nullif(v_normalized->>'match_key','');
      select td.id into v_known_device_id
      from public.customer_auth_trusted_devices td
      join public.customers c
        on c.id=td.customer_id and c.store_id=td.store_id
      where td.store_id=p_store_id
        and c.phone_match_key=v_match
        and coalesce(c.status,'active')='active'
        and c.merged_into_customer_id is null
        and td.device_token_hash=p_device_token_hash
        and td.revoked_at is null
        and td.last_otp_verified_at >= clock_timestamp()-interval '30 days'
        and td.last_seen_at >= clock_timestamp()-interval '15 days'
      limit 1
      for update of td;
    end if;
  end if;

  v_result := public.customer_reset_password_with_otp_service_safe(
    p_store_id, p_phone, p_otp, p_new_password
  );
  if not coalesce((v_result->>'ok')::boolean,false) then
    return v_result;
  end if;

  if v_known_device_id is not null then
    update public.customer_auth_trusted_devices
    set revoked_at=null, updated_at=clock_timestamp()
    where id=v_known_device_id and store_id=p_store_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'trusted_device_recovery_restore_failed';
    end if;
  end if;

  return v_result || jsonb_build_object(
    'current_device_preserved',v_known_device_id is not null
  );
end;
$fn$;

revoke all on function public.customer_reset_password_with_otp_known_device_service_safe(uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.customer_reset_password_with_otp_known_device_service_safe(uuid,text,text,text,text)
  to service_role;

commit;
