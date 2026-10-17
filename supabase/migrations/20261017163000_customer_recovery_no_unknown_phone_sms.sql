begin;

-- Both login and recovery must refuse OTP delivery to unregistered phones.
-- Public Edge maps absence to a generic, non-enumerating response for recovery.
CREATE OR REPLACE FUNCTION public.issue_customer_otp_for_sms_safe(p_phone text, p_store_id uuid, p_purpose text DEFAULT 'login'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_norm jsonb;
  v_phone text;
  v_match text;
  v_purpose text := lower(trim(coalesce(p_purpose,'login')));
  v_entropy bytea;
  v_random_number bigint;
  v_otp text;
  v_hash text;
  v_expires_at timestamptz;
  v_recent_count integer;
  v_daily_count integer;
  v_otp_id uuid;
  v_customer_exists boolean := false;
begin
  if p_store_id is null then
    return jsonb_build_object('ok',false,'error','invalid_request');
  end if;

  if v_purpose not in (
    'login','registration','password_reset','profile_change',
    'phone_change','sensitive_action','account_delete'
  ) then
    return jsonb_build_object('ok',false,'error','invalid_purpose');
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id=p_store_id and s.public_store_enabled=true
  ) then
    return jsonb_build_object('ok',false,'error','store_unavailable');
  end if;

  v_norm:=public.normalize_br_customer_phone(p_phone);
  if coalesce((v_norm->>'valid')::boolean,false)=false then
    return jsonb_build_object('ok',false,'error','invalid_phone');
  end if;

  v_phone:=nullif(v_norm->>'e164','');
  v_match:=nullif(v_norm->>'match_key','');
  if v_phone is null or v_match is null then
    return jsonb_build_object('ok',false,'error','invalid_phone');
  end if;

  select exists(
    select 1
    from public.customers c
    where c.store_id=p_store_id
      and c.phone_match_key=v_match
      and coalesce(c.status,'active')='active'
      and c.merged_into_customer_id is null
  ) into v_customer_exists;

  -- Evita SMS desnecessário e informa o fluxo correto antes do envio.
  if v_purpose='registration' and v_customer_exists then
    return jsonb_build_object(
      'ok',false,
      'error','phone_already_registered',
      'message','Este telefone já possui cadastro nesta loja. Use a opção Entrar.'
    );
  end if;

  if v_purpose in ('login','password_reset') and not v_customer_exists then
    return jsonb_build_object(
      'ok',false,
      'error','customer_not_found',
      'message','Não encontramos uma conta com este telefone nesta loja. Use Criar conta.'
    );
  end if;

  select count(*) into v_recent_count
  from public.customer_otps co
  where co.store_id=p_store_id
    and co.phone=v_phone
    and co.created_at>=clock_timestamp()-interval '10 minutes';

  if v_recent_count>=3 then
    return jsonb_build_object('ok',false,'error','rate_limited','retry_after_seconds',600);
  end if;

  select count(*) into v_daily_count
  from public.customer_otps co
  where co.store_id=p_store_id
    and co.phone=v_phone
    and co.created_at>=clock_timestamp()-interval '24 hours';

  if v_daily_count>=10 then
    return jsonb_build_object('ok',false,'error','daily_limit_reached','retry_after_seconds',86400);
  end if;

  update public.customer_otps
  set used=true,
      consumed_at=coalesce(consumed_at,clock_timestamp()),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('superseded_at',clock_timestamp())
  where store_id=p_store_id
    and phone=v_phone
    and purpose=v_purpose
    and coalesce(verified,false)=false
    and coalesce(used,false)=false;

  v_expires_at:=clock_timestamp()+interval '5 minutes';
  v_entropy:=gen_random_bytes(4);
  v_random_number:=
      get_byte(v_entropy,0)::bigint*16777216
    + get_byte(v_entropy,1)::bigint*65536
    + get_byte(v_entropy,2)::bigint*256
    + get_byte(v_entropy,3)::bigint;
  v_otp:=lpad((v_random_number%1000000)::text,6,'0');
  v_hash:=crypt(v_otp,gen_salt('bf'));

  insert into public.customer_otps(
    phone,store_id,otp_code,otp_hash,expires_at,verified,
    attempts,used,last_sent_at,purpose,metadata
  ) values(
    v_phone,p_store_id,v_hash,v_hash,v_expires_at,false,
    0,false,clock_timestamp(),v_purpose,
    jsonb_build_object(
      'transport','optmasmsgate',
      'delivery_status','issuing',
      'phone_match_key',v_match,
      'requested_at',clock_timestamp()
    )
  ) returning id into v_otp_id;

  return jsonb_build_object(
    'ok',true,
    'otp_id',v_otp_id,
    'phone_number',v_phone,
    'otp',v_otp,
    'purpose',v_purpose,
    'expires_at',v_expires_at
  );
end;
$function$
;

commit;
