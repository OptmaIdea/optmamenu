-- Customer account session hardening:
-- - trusted-device self-service without exposing device hashes;
-- - strong current-password verification for password changes;
-- - session generation invalidation so revoked devices cannot keep calling customer RPCs
--   with an already-issued JWT;
-- - phone change also invalidates previously issued customer sessions.

begin;

alter table public.customer_auth_identities
  add column if not exists sessions_valid_after timestamptz;

alter table public.customer_auth_trusted_devices
  add column if not exists device_label text,
  add column if not exists user_agent text;

create or replace function public.app_current_customer_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    nullif(public.app_jwt_claim('customer_id'), '')::uuid,
    (
      select cai.customer_id
      from public.customer_auth_identities cai
      where cai.auth_user_id = auth.uid()
        and cai.revoked_at is null
        and (
          cai.sessions_valid_after is null
          or coalesce(nullif(public.app_jwt_claim('iat'), '')::bigint, 0)
             >= ceil(extract(epoch from cai.sessions_valid_after))::bigint
        )
      limit 1
    )
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
    nullif(public.app_jwt_claim('store_id'), '')::uuid,
    (
      select cai.store_id
      from public.customer_auth_identities cai
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
  v_claim text := public.app_jwt_claim('role');
  v_customer uuid;
begin
  if v_claim = 'customer' then
    return 'customer';
  end if;

  select cai.customer_id
    into v_customer
  from public.customer_auth_identities cai
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

create or replace function public.customer_verify_current_password_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_password_hash text;
  v_failed_attempts integer := 0;
  v_locked_until timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if p_customer_id is null or p_store_id is null or length(coalesce(p_password, '')) < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  select cc.password_hash, coalesce(cc.failed_attempts, 0), cc.locked_until
    into v_password_hash, v_failed_attempts, v_locked_until
  from public.customer_credentials cc
  join public.customers c on c.id = cc.customer_id
  where cc.customer_id = p_customer_id
    and c.store_id = p_store_id
    and coalesce(c.status, 'active') = 'active'
    and c.merged_into_customer_id is null
  limit 1;

  if v_password_hash is null then
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
    v_failed_attempts := v_failed_attempts + 1;

    update public.customer_credentials
       set failed_attempts = v_failed_attempts,
           locked_until = case when v_failed_attempts >= 5 then v_now + interval '15 minutes' else null end,
           updated_at = v_now
     where customer_id = p_customer_id;

    return jsonb_build_object(
      'ok', false,
      'error', case when v_failed_attempts >= 5 then 'locked' else 'invalid_credentials' end,
      'retry_after_seconds', case when v_failed_attempts >= 5 then 900 else null end
    );
  end if;

  update public.customer_credentials
     set failed_attempts = 0,
         locked_until = null,
         updated_at = v_now
   where customer_id = p_customer_id;

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.customer_verify_current_password_service_safe(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.customer_verify_current_password_service_safe(uuid, uuid, text)
  to service_role;

create or replace function public.customer_list_trusted_devices_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_current_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_devices jsonb;
begin
  if p_customer_id is null
     or p_store_id is null
     or length(coalesce(p_current_device_hash, '')) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', td.id,
        'label', coalesce(nullif(btrim(td.device_label), ''), 'Dispositivo confiável'),
        'is_current', td.device_token_hash = p_current_device_hash,
        'first_verified_at', td.first_verified_at,
        'last_otp_verified_at', td.last_otp_verified_at,
        'last_seen_at', td.last_seen_at
      )
      order by (td.device_token_hash = p_current_device_hash) desc, td.last_seen_at desc
    ),
    '[]'::jsonb
  )
    into v_devices
  from public.customer_auth_trusted_devices td
  where td.customer_id = p_customer_id
    and td.store_id = p_store_id
    and td.revoked_at is null;

  return jsonb_build_object(
    'ok', true,
    'devices', v_devices,
    'active_count', jsonb_array_length(v_devices)
  );
end;
$function$;

revoke all on function public.customer_list_trusted_devices_service_safe(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.customer_list_trusted_devices_service_safe(uuid, uuid, text)
  to service_role;

create or replace function public.customer_revoke_other_trusted_devices_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_current_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_revoked integer := 0;
begin
  if p_customer_id is null
     or p_store_id is null
     or length(coalesce(p_current_device_hash, '')) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
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
     set revoked_at = v_now,
         updated_at = v_now
   where customer_id = p_customer_id
     and store_id = p_store_id
     and device_token_hash <> p_current_device_hash
     and revoked_at is null;

  get diagnostics v_revoked = row_count;

  -- Rotate the customer session generation even when there were no other trusted
  -- devices. Password changes call this same primitive so any older JWT becomes
  -- unusable by app_current_customer_id/store_id/role immediately after rotation.
  update public.customer_auth_identities
     set sessions_valid_after = v_now,
         updated_at = v_now
   where customer_id = p_customer_id
     and store_id = p_store_id
     and revoked_at is null;

  if v_revoked > 0 then
    insert into public.customer_notifications(
      customer_id, store_id, title, message, type, read, created_at
    ) values (
      p_customer_id,
      p_store_id,
      'Outros dispositivos desconectados',
      case
        when v_revoked = 1 then 'Um outro dispositivo confiável foi desconectado da sua conta.'
        else v_revoked::text || ' outros dispositivos confiáveis foram desconectados da sua conta.'
      end,
      'info',
      true,
      v_now
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'revoked_count', v_revoked,
    'sessions_valid_after', v_now
  );
end;
$function$;

revoke all on function public.customer_revoke_other_trusted_devices_service_safe(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.customer_revoke_other_trusted_devices_service_safe(uuid, uuid, text)
  to service_role;

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
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_norm jsonb;
  v_new_phone text;
  v_new_match text;
  v_otp_row public.customer_otps%rowtype;
  v_clean_otp text:=regexp_replace(coalesce(p_otp,''),'\D','','g');
  v_now timestamptz:=clock_timestamp();
  v_next_attempts integer;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  v_norm:=public.normalize_br_customer_phone(p_new_phone);
  if coalesce((v_norm->>'valid')::boolean,false)=false then
    return jsonb_build_object('ok',false,'error','invalid_phone');
  end if;

  v_new_phone:=nullif(v_norm->>'e164','');
  v_new_match:=nullif(v_norm->>'match_key','');
  if v_new_phone is null or v_new_match is null or length(v_clean_otp)<>6 then
    return jsonb_build_object('ok',false,'error','invalid_request');
  end if;

  select * into v_customer
  from public.customers
  where id=v_customer_id and store_id=v_store_id
    and coalesce(status,'active')='active'
    and merged_into_customer_id is null
  for update;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  if v_customer.phone_match_key=v_new_match then
    return jsonb_build_object(
      'ok',true,'unchanged',true,'phone',v_customer.phone,'phone_e164',v_customer.phone_e164
    );
  end if;

  if exists (
    select 1 from public.customers c
    where c.store_id=v_store_id
      and c.id<>v_customer_id
      and c.phone_match_key=v_new_match
      and coalesce(c.status,'active') not in ('merged','anonymized')
  ) then
    return jsonb_build_object('ok',false,'error','phone_already_registered');
  end if;

  select * into v_otp_row
  from public.customer_otps
  where store_id=v_store_id
    and phone=v_new_phone
    and purpose='phone_change'
    and coalesce(verified,false)=false
    and coalesce(used,false)=false
    and expires_at>v_now
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok',false,'error','invalid_or_expired_otp');
  end if;

  if coalesce(v_otp_row.attempts,0)>=5 then
    update public.customer_otps
       set used=true,consumed_at=coalesce(consumed_at,v_now)
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

    return jsonb_build_object(
      'ok',false,
      'error',case when v_next_attempts>=5 then 'otp_locked' else 'invalid_or_expired_otp' end
    );
  end if;

  update public.customer_otps
     set attempts=v_next_attempts,
         verified=true,
         used=true,
         verified_at=v_now,
         consumed_at=v_now,
         metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
           'verified_purpose','phone_change',
           'customer_id',v_customer_id,
           'verified_at',v_now
         )
   where id=v_otp_row.id;

  update public.customers
     set phone=v_new_phone,
         phone_verified_at=v_now,
         updated_at=v_now
   where id=v_customer_id and store_id=v_store_id;

  update public.customer_auth_trusted_devices
     set revoked_at=coalesce(revoked_at,v_now),
         updated_at=v_now
   where customer_id=v_customer_id
     and store_id=v_store_id
     and revoked_at is null;

  update public.customer_auth_identities
     set sessions_valid_after=v_now,
         updated_at=v_now
   where customer_id=v_customer_id
     and store_id=v_store_id
     and revoked_at is null;

  return jsonb_build_object(
    'ok',true,
    'phone',v_new_phone,
    'phone_e164',v_new_phone,
    'requires_relogin',true
  );
end;
$function$;

revoke all on function public.change_customer_self_phone_safe(text,text)
  from public, anon;
grant execute on function public.change_customer_self_phone_safe(text,text)
  to authenticated, service_role;

commit;
