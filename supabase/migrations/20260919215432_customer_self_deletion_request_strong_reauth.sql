create or replace function public.request_customer_self_account_deletion_safe(
  p_password text,
  p_otp text
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_credential public.customer_credentials%rowtype;
  v_otp_row public.customer_otps%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_next_attempts integer;
  v_clean_otp text:=regexp_replace(coalesce(p_otp,''),'\D','','g');
  v_request_id uuid;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if length(coalesce(p_password,''))<1 or length(v_clean_otp)<>6 then
    return jsonb_build_object('ok',false,'error','strong_reauth_required');
  end if;

  select * into v_customer from public.customers
  where id=v_customer_id and store_id=v_store_id
    and coalesce(status,'active')='active' and merged_into_customer_id is null
  for update;
  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;

  select * into v_credential from public.customer_credentials
  where customer_id=v_customer_id for update;
  if not found or v_credential.password_hash is null then
    return jsonb_build_object('ok',false,'error','password_not_configured');
  end if;
  if v_credential.locked_until is not null and v_credential.locked_until>v_now then
    return jsonb_build_object('ok',false,'error','locked','retry_after_seconds',
      greatest(1,ceil(extract(epoch from (v_credential.locked_until-v_now)))::int));
  end if;
  if crypt(p_password,v_credential.password_hash)<>v_credential.password_hash then
    v_next_attempts:=coalesce(v_credential.failed_attempts,0)+1;
    update public.customer_credentials
    set failed_attempts=v_next_attempts,
        locked_until=case when v_next_attempts>=5 then v_now+interval '15 minutes' else null end,
        updated_at=v_now
    where customer_id=v_customer_id;
    return jsonb_build_object('ok',false,'error','invalid_password');
  end if;
  update public.customer_credentials set failed_attempts=0,locked_until=null,updated_at=v_now
  where customer_id=v_customer_id;

  select * into v_otp_row from public.customer_otps
  where store_id=v_store_id and phone=v_customer.phone_e164 and purpose='account_delete'
    and coalesce(verified,false)=false and coalesce(used,false)=false and expires_at>v_now
  order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('ok',false,'error','invalid_or_expired_otp'); end if;
  if coalesce(v_otp_row.attempts,0)>=5 then
    update public.customer_otps set used=true,consumed_at=coalesce(consumed_at,v_now)
    where id=v_otp_row.id;
    return jsonb_build_object('ok',false,'error','otp_locked');
  end if;

  v_next_attempts:=coalesce(v_otp_row.attempts,0)+1;
  if coalesce(v_otp_row.otp_hash,v_otp_row.otp_code) is null
    or crypt(v_clean_otp,coalesce(v_otp_row.otp_hash,v_otp_row.otp_code))
       <>coalesce(v_otp_row.otp_hash,v_otp_row.otp_code) then
    update public.customer_otps
    set attempts=v_next_attempts,
        used=case when v_next_attempts>=5 then true else used end,
        consumed_at=case when v_next_attempts>=5 then coalesce(consumed_at,v_now) else consumed_at end
    where id=v_otp_row.id;
    return jsonb_build_object('ok',false,'error',
      case when v_next_attempts>=5 then 'otp_locked' else 'invalid_or_expired_otp' end);
  end if;

  update public.customer_otps
  set attempts=v_next_attempts,verified=true,used=true,verified_at=v_now,consumed_at=v_now,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'verified_purpose','account_delete','strong_reauth',true,'verified_at',v_now)
  where id=v_otp_row.id;

  select id into v_request_id from public.customer_account_deletion_audit
  where store_id=v_store_id and customer_id_snapshot=v_customer_id
    and status in ('pending','processing')
  order by requested_at desc limit 1;

  if v_request_id is null then
    insert into public.customer_account_deletion_audit(
      store_id,customer_id_snapshot,status,request_source,reauth_method,requested_at,metadata
    )
    values(
      v_store_id,v_customer_id,'pending','customer_portal','password+otp',v_now,
      jsonb_build_object('requested_by','customer_self_service','strong_reauth_at',v_now)
    )
    returning id into v_request_id;
  end if;

  return jsonb_build_object(
    'ok',true,'request_id',v_request_id,'status','pending','requested_at',v_now);
end;
$function$;

revoke all on function public.request_customer_self_account_deletion_safe(text,text)
  from public,anon;
grant execute on function public.request_customer_self_account_deletion_safe(text,text)
  to authenticated;
