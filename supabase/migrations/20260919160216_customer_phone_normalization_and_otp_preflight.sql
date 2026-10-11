-- Telefone: Brasil é padrão (+55 opcional), internacional exige +código do país.
-- Cadastro duplicado é bloqueado antes da emissão do OTP.
create or replace function public.normalize_br_customer_phone(p_phone text)
returns jsonb language plpgsql immutable set search_path to 'public'
as $function$
declare
  v_raw text:=trim(coalesce(p_phone,''));
  v_digits text:=regexp_replace(coalesce(p_phone,''),'\D','','g');
  v_national text; v_ddd text; v_subscriber text; v_is_mobile boolean:=false;
  v_e164 text; v_match text; v_legacy text;
begin
  if v_digits='' then
    return jsonb_build_object('digits',null,'e164',null,'match_key',null,'legacy_match_key',null,'valid',false,'country','BR');
  end if;

  if left(v_raw,1)='+' and left(v_digits,2)<>'55' then
    if length(v_digits) between 8 and 15 then
      return jsonb_build_object('digits',v_digits,'national',null,'e164',v_digits,'match_key','INT:'||v_digits,
        'legacy_match_key',null,'is_mobile',null,'valid',true,'country','INT');
    end if;
    return jsonb_build_object('digits',v_digits,'e164',null,'match_key','RAW:'||v_digits,'legacy_match_key',null,'valid',false,'country','INT');
  end if;

  if left(v_digits,2)='55' and length(v_digits) in (12,13) then v_national:=substring(v_digits from 3);
  elsif length(v_digits) in (10,11) then v_national:=v_digits;
  else return jsonb_build_object('digits',v_digits,'e164',null,'match_key','RAW:'||v_digits,'legacy_match_key',null,'valid',false,'country','BR');
  end if;

  v_ddd:=left(v_national,2);
  v_subscriber:=substring(v_national from 3);

  if length(v_national)=11 and left(v_subscriber,1)='9' and substring(v_subscriber from 2 for 1) between '6' and '9' then
    v_is_mobile:=true; v_e164:='55'||v_national; v_match:='BRM:'||v_ddd||right(v_subscriber,8); v_legacy:='55'||v_ddd||right(v_subscriber,8);
  elsif length(v_national)=10 and left(v_subscriber,1) between '6' and '9' then
    v_is_mobile:=true; v_e164:='55'||v_ddd||'9'||v_subscriber; v_match:='BRM:'||v_ddd||v_subscriber; v_legacy:='55'||v_ddd||v_subscriber;
  elsif length(v_national) in (10,11) then
    v_e164:='55'||v_national; v_match:='BR:'||v_national;
  else
    v_match:='RAW:'||v_digits;
  end if;

  return jsonb_build_object('digits',v_digits,'national',v_national,'e164',v_e164,'match_key',v_match,
    'legacy_match_key',v_legacy,'is_mobile',v_is_mobile,'valid',v_e164 is not null,'country','BR');
end;
$function$;

create or replace function public.issue_customer_otp_for_sms_safe(p_phone text,p_store_id uuid,p_purpose text default 'login')
returns jsonb language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_norm jsonb; v_phone text; v_match text; v_purpose text:=lower(trim(coalesce(p_purpose,'login')));
  v_entropy bytea; v_random_number bigint; v_otp text; v_hash text; v_expires_at timestamptz;
  v_recent_count integer; v_daily_count integer; v_otp_id uuid; v_customer_exists boolean:=false;
begin
  if p_store_id is null then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
  if v_purpose not in ('login','registration','password_reset','profile_change','phone_change','sensitive_action','account_delete') then
    return jsonb_build_object('ok',false,'error','invalid_purpose');
  end if;
  if not exists(select 1 from public.stores s where s.id=p_store_id and s.public_store_enabled=true) then
    return jsonb_build_object('ok',false,'error','store_unavailable');
  end if;

  v_norm:=public.normalize_br_customer_phone(p_phone);
  if not coalesce((v_norm->>'valid')::boolean,false) then return jsonb_build_object('ok',false,'error','invalid_phone'); end if;
  v_phone:=nullif(v_norm->>'e164',''); v_match:=nullif(v_norm->>'match_key','');
  if v_phone is null or v_match is null then return jsonb_build_object('ok',false,'error','invalid_phone'); end if;

  select exists(select 1 from public.customers c
    where c.store_id=p_store_id and c.phone_match_key=v_match and coalesce(c.status,'active')='active' and c.merged_into_customer_id is null)
  into v_customer_exists;

  if v_purpose='registration' and v_customer_exists then
    return jsonb_build_object('ok',false,'error','phone_already_registered','message','Este telefone já possui cadastro nesta loja. Use a opção Entrar.');
  end if;
  if v_purpose='login' and not v_customer_exists then
    return jsonb_build_object('ok',false,'error','customer_not_found','message','Não encontramos uma conta com este telefone nesta loja. Use Criar conta.');
  end if;

  select count(*) into v_recent_count from public.customer_otps co
  where co.store_id=p_store_id and co.phone=v_phone and co.created_at>=clock_timestamp()-interval '10 minutes';
  if v_recent_count>=3 then return jsonb_build_object('ok',false,'error','rate_limited','retry_after_seconds',600); end if;

  select count(*) into v_daily_count from public.customer_otps co
  where co.store_id=p_store_id and co.phone=v_phone and co.created_at>=clock_timestamp()-interval '24 hours';
  if v_daily_count>=10 then return jsonb_build_object('ok',false,'error','daily_limit_reached','retry_after_seconds',86400); end if;

  update public.customer_otps
  set used=true,consumed_at=coalesce(consumed_at,clock_timestamp()),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('superseded_at',clock_timestamp())
  where store_id=p_store_id and phone=v_phone and purpose=v_purpose and not coalesce(verified,false) and not coalesce(used,false);

  v_expires_at:=clock_timestamp()+interval '5 minutes';
  v_entropy:=gen_random_bytes(4);
  v_random_number:=get_byte(v_entropy,0)::bigint*16777216+get_byte(v_entropy,1)::bigint*65536+get_byte(v_entropy,2)::bigint*256+get_byte(v_entropy,3)::bigint;
  v_otp:=lpad((v_random_number%1000000)::text,6,'0');
  v_hash:=crypt(v_otp,gen_salt('bf'));

  insert into public.customer_otps(phone,store_id,otp_code,otp_hash,expires_at,verified,attempts,used,last_sent_at,purpose,metadata)
  values(v_phone,p_store_id,v_hash,v_hash,v_expires_at,false,0,false,clock_timestamp(),v_purpose,
    jsonb_build_object('transport','optmasmsgate','delivery_status','issuing','phone_match_key',v_match,'requested_at',clock_timestamp()))
  returning id into v_otp_id;

  return jsonb_build_object('ok',true,'otp_id',v_otp_id,'phone_number',v_phone,'otp',v_otp,'purpose',v_purpose,'expires_at',v_expires_at);
end;
$function$;
revoke all on function public.issue_customer_otp_for_sms_safe(text,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_customer_otp_for_sms_safe(text,uuid,text) to service_role;
