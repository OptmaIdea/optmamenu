begin;

create or replace function public.customer_is_valid_cpf(p_cpf text)
returns boolean
language plpgsql
immutable
strict
set search_path to 'public'
as $function$
declare
  v text := regexp_replace(p_cpf, '\D', '', 'g');
  v_sum integer;
  v_digit1 integer;
  v_digit2 integer;
  i integer;
begin
  if length(v) <> 11 or v ~ '^([0-9])\1{10}$' then
    return false;
  end if;

  v_sum := 0;
  for i in 1..9 loop
    v_sum := v_sum + substr(v, i, 1)::integer * (11 - i);
  end loop;
  v_digit1 := (v_sum * 10) % 11;
  if v_digit1 = 10 then v_digit1 := 0; end if;
  if v_digit1 <> substr(v, 10, 1)::integer then return false; end if;

  v_sum := 0;
  for i in 1..10 loop
    v_sum := v_sum + substr(v, i, 1)::integer * (12 - i);
  end loop;
  v_digit2 := (v_sum * 10) % 11;
  if v_digit2 = 10 then v_digit2 := 0; end if;

  return v_digit2 = substr(v, 11, 1)::integer;
end;
$function$;

revoke all on function public.customer_is_valid_cpf(text) from public, anon, authenticated;
grant execute on function public.customer_is_valid_cpf(text) to service_role;

create or replace function public.update_customer_self_profile_safe(
  p_full_name text default null,
  p_nickname text default null,
  p_email text default null,
  p_cpf text default null,
  p_birth_date date default null,
  p_is_whatsapp boolean default null,
  p_contact_preference text default null,
  p_loyalty_opt_in boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_current public.customers%rowtype;
  v_full_name text;
  v_nickname text;
  v_email text;
  v_cpf text;
  v_birth_date date;
  v_is_whatsapp boolean;
  v_contact_preference text;
  v_next_loyalty boolean;
  v_fields text[] := array[]::text[];
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  select * into v_current
  from public.customers
  where id = v_customer_id and store_id = v_store_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  if v_current.status not in ('active','inactive') then
    return jsonb_build_object('ok', false, 'error', 'customer_not_editable');
  end if;

  v_full_name := case when p_full_name is null then v_current.full_name else nullif(trim(p_full_name),'') end;
  v_nickname := case when p_nickname is null then v_current.nickname else nullif(trim(p_nickname),'') end;
  v_email := case when p_email is null then v_current.email else nullif(lower(trim(p_email)),'') end;
  v_cpf := case when p_cpf is null then v_current.cpf else nullif(regexp_replace(p_cpf,'\D','','g'),'') end;
  v_birth_date := case when p_birth_date is null then v_current.birth_date else p_birth_date end;
  v_is_whatsapp := coalesce(p_is_whatsapp, v_current.is_whatsapp, true);
  v_contact_preference := coalesce(nullif(trim(p_contact_preference),''), v_current.contact_preference, 'whatsapp');
  v_next_loyalty := coalesce(p_loyalty_opt_in, v_current.loyalty_opt_in, false);

  if v_email is not null and v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  if v_current.cpf is not null
     and p_cpf is not null
     and v_cpf is distinct from regexp_replace(v_current.cpf,'\D','','g') then
    return jsonb_build_object('ok', false, 'error', 'cpf_locked');
  end if;

  if v_cpf is not null and not public.customer_is_valid_cpf(v_cpf) then
    return jsonb_build_object('ok', false, 'error', 'invalid_cpf');
  end if;

  if v_birth_date is not null and v_birth_date > current_date then
    return jsonb_build_object('ok', false, 'error', 'invalid_birth_date');
  end if;

  if v_current.birth_date is not null
     and p_birth_date is not null
     and p_birth_date is distinct from v_current.birth_date then
    return jsonb_build_object('ok', false, 'error', 'birth_date_locked');
  end if;

  if v_contact_preference not in ('whatsapp','sms','both') then
    return jsonb_build_object('ok', false, 'error', 'invalid_contact_preference');
  end if;

  if v_full_name is distinct from v_current.full_name then v_fields := array_append(v_fields,'full_name'); end if;
  if v_nickname is distinct from v_current.nickname then v_fields := array_append(v_fields,'nickname'); end if;
  if v_email is distinct from v_current.email then v_fields := array_append(v_fields,'email'); end if;
  if v_cpf is distinct from v_current.cpf then v_fields := array_append(v_fields,'cpf'); end if;
  if v_birth_date is distinct from v_current.birth_date then v_fields := array_append(v_fields,'birth_date'); end if;
  if v_is_whatsapp is distinct from v_current.is_whatsapp then v_fields := array_append(v_fields,'is_whatsapp'); end if;
  if v_contact_preference is distinct from v_current.contact_preference then v_fields := array_append(v_fields,'contact_preference'); end if;
  if v_next_loyalty is distinct from coalesce(v_current.loyalty_opt_in,false) then v_fields := array_append(v_fields,'loyalty_opt_in'); end if;

  if coalesce(array_length(v_fields,1),0) = 0 then
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'customer_id', v_customer_id,
      'fields_changed', '[]'::jsonb
    );
  end if;

  update public.customers
  set
    full_name = v_full_name,
    nickname = v_nickname,
    email = v_email,
    email_verified = case
      when v_email is not distinct from v_current.email then coalesce(v_current.email_verified,false)
      else false
    end,
    cpf = case when v_current.cpf is not null then v_current.cpf else v_cpf end,
    birth_date = case when v_current.birth_date is not null then v_current.birth_date else v_birth_date end,
    is_whatsapp = v_is_whatsapp,
    contact_preference = v_contact_preference,
    loyalty_opt_in = v_next_loyalty,
    data_ownership = 'customer_owned',
    editable_by_store = false,
    updated_at = clock_timestamp()
  where id = v_customer_id and store_id = v_store_id;

  if p_loyalty_opt_in is not null
     and v_next_loyalty is distinct from coalesce(v_current.loyalty_opt_in,false) then
    insert into public.customer_consent_logs(
      customer_id,store_id,consent_type,action,source,revoked_at,metadata
    )
    values(
      v_customer_id,
      v_store_id,
      'loyalty_program',
      case when v_next_loyalty then 'granted' else 'revoked' end,
      'customer_portal_profile',
      case when v_next_loyalty then null else clock_timestamp() end,
      jsonb_build_object(
        'evidence','customer_self_service',
        'previous',v_current.loyalty_opt_in,
        'current',v_next_loyalty
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'unchanged', false,
    'customer_id', v_customer_id,
    'fields_changed', to_jsonb(v_fields)
  );
end;
$function$;

revoke all on function public.update_customer_self_profile_safe(text,text,text,text,date,boolean,text,boolean) from public, anon;
grant execute on function public.update_customer_self_profile_safe(text,text,text,text,date,boolean,text,boolean) to authenticated, service_role;

drop function if exists public.change_customer_self_sensitive_profile_safe(text,text,date);

create or replace function public.change_customer_self_sensitive_profile_safe(
  p_otp text,
  p_cpf text default null,
  p_birth_date date default null,
  p_data_attested boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_otp_row public.customer_otps%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next_attempts integer;
  v_clean_otp text := regexp_replace(coalesce(p_otp,''),'\D','','g');
  v_clean_cpf text;
  v_current_cpf text;
  v_fields text[] := array[]::text[];
  v_cpf_changed boolean := false;
  v_birth_changed boolean := false;
  v_old_adult boolean := false;
  v_new_adult boolean := false;
  v_age_eligibility_changed boolean := false;
  v_audit_id uuid;
  v_recent_changes integer := 0;
  v_notification_message text;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if not coalesce(p_data_attested,false) then
    return jsonb_build_object(
      'ok',false,
      'error','data_attestation_required',
      'message','Confirme que as informações corrigidas são verdadeiras e de sua responsabilidade.'
    );
  end if;

  if length(v_clean_otp)<>6 then
    return jsonb_build_object('ok',false,'error','strong_reauth_required');
  end if;

  select * into v_customer
  from public.customers
  where id=v_customer_id
    and store_id=v_store_id
    and coalesce(status,'active')='active'
    and merged_into_customer_id is null
  for update;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  v_current_cpf:=regexp_replace(coalesce(v_customer.cpf,''),'\D','','g');

  if p_cpf is not null then
    v_clean_cpf:=regexp_replace(p_cpf,'\D','','g');
    if not public.customer_is_valid_cpf(v_clean_cpf) then
      return jsonb_build_object('ok',false,'error','invalid_cpf');
    end if;
    v_cpf_changed:=v_clean_cpf is distinct from v_current_cpf;
    if v_cpf_changed then
      if exists(
        select 1 from public.customers c
        where c.store_id=v_store_id
          and c.id<>v_customer_id
          and c.cpf is not null
          and public.normalize_customer_cpf(c.cpf)=v_clean_cpf
          and coalesce(c.status,'active') not in ('merged','anonymized')
      ) then
        return jsonb_build_object('ok',false,'error','cpf_already_registered');
      end if;
      v_fields:=array_append(v_fields,'cpf');
    end if;
  end if;

  if p_birth_date is not null then
    if p_birth_date>current_date then
      return jsonb_build_object('ok',false,'error','invalid_birth_date');
    end if;
    v_birth_changed:=p_birth_date is distinct from v_customer.birth_date;
    if v_birth_changed then
      if coalesce(v_customer.loyalty_opt_in,false)
         and p_birth_date>(current_date-interval '18 years')::date then
        return jsonb_build_object(
          'ok',false,
          'error','loyalty_age_restricted_profile_change',
          'message','Saia do programa de fidelidade antes de corrigir a data de nascimento para uma idade inferior a 18 anos.'
        );
      end if;
      v_fields:=array_append(v_fields,'birth_date');
    end if;
  end if;

  if not v_cpf_changed and not v_birth_changed then
    return jsonb_build_object(
      'ok',true,'unchanged',true,
      'cpf',v_customer.cpf,'birth_date',v_customer.birth_date,
      'fields_changed','[]'::jsonb
    );
  end if;

  select count(*)::integer into v_recent_changes
  from public.customer_profile_sensitive_change_audit a
  where a.store_id=v_store_id
    and a.customer_id_snapshot=v_customer_id
    and a.created_at>=v_now-interval '30 days';

  if v_recent_changes>=3 then
    return jsonb_build_object(
      'ok',false,
      'error','sensitive_change_rate_limited',
      'message','Por segurança, o limite de correções de CPF/data de nascimento foi atingido neste período. Fale com a loja para uma revisão assistida.'
    );
  end if;

  v_old_adult := v_customer.birth_date is not null
    and v_customer.birth_date <= (current_date-interval '18 years')::date;
  v_new_adult := case
    when v_birth_changed then p_birth_date <= (current_date-interval '18 years')::date
    else v_old_adult
  end;
  v_age_eligibility_changed := v_birth_changed and (v_old_adult is distinct from v_new_adult);

  select * into v_otp_row
  from public.customer_otps
  where store_id=v_store_id
    and phone=coalesce(v_customer.phone_e164,v_customer.phone)
    and purpose='profile_change'
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
        'verified_purpose','profile_change',
        'strong_reauth','trusted_session+sms',
        'verified_at',v_now
      )
  where id=v_otp_row.id;

  update public.customers
  set cpf=case when v_cpf_changed then v_clean_cpf else cpf end,
      birth_date=case when v_birth_changed then p_birth_date else birth_date end,
      updated_at=v_now
  where id=v_customer_id and store_id=v_store_id;

  insert into public.customer_profile_sensitive_change_audit(
    store_id,customer_id_snapshot,fields_changed,source,metadata,created_at
  ) values(
    v_store_id,
    v_customer_id,
    v_fields,
    'customer_portal',
    jsonb_build_object(
      'strong_reauth','trusted_session+sms',
      'otp_purpose','profile_change',
      'customer_attested',true,
      'age_eligibility_changed',v_age_eligibility_changed,
      'old_age_band',case when v_customer.birth_date is null then 'unknown' when v_old_adult then 'adult' else 'minor' end,
      'new_age_band',case when v_customer.birth_date is null and not v_birth_changed then 'unknown' when v_new_adult then 'adult' else 'minor' end
    ),
    v_now
  )
  returning id into v_audit_id;

  v_notification_message := case
    when v_cpf_changed and v_birth_changed then 'CPF e data de nascimento foram corrigidos após confirmação por SMS.'
    when v_cpf_changed then 'O CPF do cadastro foi corrigido após confirmação por SMS.'
    else 'A data de nascimento do cadastro foi corrigida após confirmação por SMS.'
  end;

  insert into public.customer_notifications(
    customer_id,store_id,title,message,type,category,read,created_at
  ) values(
    v_customer_id,v_store_id,
    'Cadastro atualizado',
    v_notification_message,
    'info','profile',false,v_now
  );

  return jsonb_build_object(
    'ok',true,'unchanged',false,
    'cpf',case when v_cpf_changed then v_clean_cpf else v_customer.cpf end,
    'birth_date',case when v_birth_changed then p_birth_date else v_customer.birth_date end,
    'fields_changed',to_jsonb(v_fields),
    'audit_id',v_audit_id,
    'age_eligibility_changed',v_age_eligibility_changed
  );
end;
$function$;

revoke all on function public.change_customer_self_sensitive_profile_safe(text,text,date,boolean) from public,anon;
grant execute on function public.change_customer_self_sensitive_profile_safe(text,text,date,boolean) to authenticated,service_role;

create or replace function public.get_customer_self_sensitive_change_notice_safe(p_audit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_audit public.customer_profile_sensitive_change_audit%rowtype;
  v_customer public.customers%rowtype;
  v_store record;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select * into v_audit
  from public.customer_profile_sensitive_change_audit
  where id=p_audit_id
    and store_id=v_store_id
    and customer_id_snapshot=v_customer_id
    and created_at>=clock_timestamp()-interval '24 hours'
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','audit_not_found');
  end if;

  select * into v_customer
  from public.customers
  where id=v_customer_id and store_id=v_store_id
  limit 1;

  select s.name,s.slug,s.logo_url
  into v_store
  from public.stores s
  where s.id=v_store_id
  limit 1;

  return jsonb_build_object(
    'ok',true,
    'audit_id',v_audit.id,
    'fields_changed',to_jsonb(v_audit.fields_changed),
    'changed_at',v_audit.created_at,
    'already_notified',coalesce((v_audit.metadata->>'email_notification_sent')::boolean,false),
    'email',v_customer.email,
    'email_verified',coalesce(v_customer.email_verified,false),
    'full_name',coalesce(nullif(v_customer.full_name,''),nullif(v_customer.nickname,''),'Cliente'),
    'store_name',coalesce(v_store.name,v_store.slug,'Loja'),
    'store_slug',v_store.slug,
    'store_logo_url',v_store.logo_url
  );
end;
$function$;

revoke all on function public.get_customer_self_sensitive_change_notice_safe(uuid) from public,anon;
grant execute on function public.get_customer_self_sensitive_change_notice_safe(uuid) to authenticated,service_role;

create or replace function public.mark_customer_self_sensitive_change_notice_safe(
  p_audit_id uuid,
  p_provider text default null,
  p_provider_message_id text default null,
  p_failed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_now timestamptz:=clock_timestamp();
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  update public.customer_profile_sensitive_change_audit
  set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
    'email_notification_attempted_at',v_now,
    'email_notification_provider',nullif(trim(coalesce(p_provider,'')),''),
    'email_notification_message_id',nullif(trim(coalesce(p_provider_message_id,'')),''),
    'email_notification_failed',coalesce(p_failed,false),
    'email_notification_sent',not coalesce(p_failed,false)
  )
  where id=p_audit_id
    and store_id=v_store_id
    and customer_id_snapshot=v_customer_id;

  if not found then
    return jsonb_build_object('ok',false,'error','audit_not_found');
  end if;

  return jsonb_build_object('ok',true,'sent',not coalesce(p_failed,false),'recorded_at',v_now);
end;
$function$;

revoke all on function public.mark_customer_self_sensitive_change_notice_safe(uuid,text,text,boolean) from public,anon;
grant execute on function public.mark_customer_self_sensitive_change_notice_safe(uuid,text,text,boolean) to authenticated,service_role;

create or replace function public.join_customer_self_loyalty_safe(
  p_accept_terms boolean,
  p_data_responsibility boolean,
  p_marketing_whatsapp boolean default false,
  p_marketing_email boolean default false,
  p_marketing_sms boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_birth_date date;
  v_result jsonb;
  v_event jsonb;
  v_hold_until timestamptz;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select birth_date into v_birth_date
  from public.customers
  where id=v_customer_id and store_id=v_store_id;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  if v_birth_date is null then
    return jsonb_build_object(
      'ok',false,
      'error','loyalty_profile_incomplete',
      'missing_fields',jsonb_build_array('data de nascimento'),
      'message','Informe sua data de nascimento antes de participar do programa.'
    );
  end if;

  if v_birth_date>(current_date-interval '18 years')::date then
    return jsonb_build_object(
      'ok',false,
      'error','loyalty_age_restricted',
      'message','O programa de fidelidade desta loja é destinado apenas a clientes com 18 anos ou mais.'
    );
  end if;

  select max(a.created_at + interval '24 hours')
  into v_hold_until
  from public.customer_profile_sensitive_change_audit a
  where a.store_id=v_store_id
    and a.customer_id_snapshot=v_customer_id
    and 'birth_date'=any(a.fields_changed)
    and coalesce((a.metadata->>'age_eligibility_changed')::boolean,false)=true
    and a.metadata->>'new_age_band'='adult'
    and a.created_at>clock_timestamp()-interval '24 hours';

  if v_hold_until is not null and v_hold_until>clock_timestamp() then
    return jsonb_build_object(
      'ok',false,
      'error','loyalty_profile_correction_cooling',
      'eligible_after',v_hold_until,
      'message','Por segurança, uma correção recente da data de nascimento que alterou a faixa etária precisa aguardar 24 horas antes da adesão à fidelidade.'
    );
  end if;

  v_result:=public.join_customer_self_loyalty_profile_safe_internal(
    p_accept_terms,p_data_responsibility,p_marketing_whatsapp,p_marketing_email,p_marketing_sms
  );

  if coalesce((v_result->>'ok')::boolean,false) then
    select jsonb_build_object(
      'event_type',e.event_type,
      'bonus_points',e.bonus_points,
      'applied_rule',e.applied_rule,
      'occurred_at',e.occurred_at
    ) into v_event
    from public.loyalty_membership_audit_events e
    where e.store_id=v_store_id
      and e.customer_id=v_customer_id
      and e.event_type in ('first_join','reentry')
    order by e.occurred_at desc
    limit 1;

    v_result:=v_result||jsonb_build_object('join_bonus_result',coalesce(v_event,'null'::jsonb));
  end if;

  return v_result;
end;
$function$;

revoke all on function public.join_customer_self_loyalty_safe(boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.join_customer_self_loyalty_safe(boolean,boolean,boolean,boolean,boolean) to authenticated,service_role;

create or replace function public.get_customer_timeline_safe(
  p_store_id uuid,
  p_customer_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sensitive boolean := false;
  v_customer_exists boolean := false;
  v_events jsonb := '[]'::jsonb;
begin
  if p_store_id is null or p_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters', 'events', '[]'::jsonb);
  end if;

  if auth.uid() is null
     or not (
       public.app_is_store_owner(p_store_id)
       or public.user_has_store_permission(p_store_id, 'customers.view')
       or public.user_has_store_permission(p_store_id, 'customers.manage')
     ) then
    return jsonb_build_object('ok', false, 'error', 'access_denied', 'events', '[]'::jsonb);
  end if;

  v_sensitive := public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'customers.sensitive.view');

  select exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and c.status not in ('merged', 'anonymized')
  ) into v_customer_exists;

  if not v_customer_exists then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found', 'events', '[]'::jsonb);
  end if;

  with timeline_events as (
    select
      'customer:' || c.id::text || ':created' as event_id,
      'profile'::text as category,
      'customer_created'::text as event_type,
      'Cliente cadastrado'::text as title,
      case
        when c.source = 'admin' then 'Cadastro criado pelo administrativo.'
        when c.source = 'public_store' then 'Cadastro criado pela loja pública.'
        when c.source = 'whatsapp' then 'Cadastro criado a partir do WhatsApp.'
        when c.source = 'qr_table' then 'Cadastro criado a partir de QR/Mesa.'
        when c.source = 'direct_sale' then 'Cadastro criado durante uma venda direta.'
        when c.source = 'import' then 'Cadastro importado para a loja.'
        else 'Cadastro do cliente criado.'
      end as description,
      c.created_at as occurred_at,
      coalesce(c.source, 'customer')::text as source,
      c.id as related_id,
      jsonb_build_object('registration_method', c.registration_method, 'data_ownership', c.data_ownership) as metadata
    from public.customers c
    where c.id = p_customer_id and c.store_id = p_store_id

    union all

    select
      'customer:' || c.id::text || ':updated',
      'profile',
      'customer_updated',
      'Cadastro atualizado',
      'Os dados do cadastro receberam uma atualização.',
      c.updated_at,
      'customer',
      c.id,
      '{}'::jsonb
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and c.updated_at is not null
      and c.updated_at > c.created_at + interval '1 second'
      and not exists (
        select 1
        from public.customer_profile_sensitive_change_audit a
        where a.store_id=p_store_id
          and a.customer_id_snapshot=p_customer_id
          and abs(extract(epoch from (a.created_at-c.updated_at)))<2
      )

    union all

    select
      'sensitive-profile:' || a.id::text,
      'profile',
      'customer_sensitive_profile_updated',
      'Cadastro atualizado',
      case
        when a.fields_changed @> array['cpf','birth_date']::text[] then 'CPF e data de nascimento foram corrigidos pelo próprio cliente.'
        when 'cpf'=any(a.fields_changed) then 'CPF corrigido pelo próprio cliente.'
        when 'birth_date'=any(a.fields_changed) then 'Data de nascimento corrigida pelo próprio cliente.'
        else 'Dados protegidos do cadastro foram corrigidos pelo próprio cliente.'
      end,
      a.created_at,
      coalesce(a.source,'customer_portal'),
      a.id,
      jsonb_build_object(
        'fields_changed',to_jsonb(a.fields_changed),
        'strong_reauth',a.metadata->>'strong_reauth',
        'customer_attested',coalesce((a.metadata->>'customer_attested')::boolean,false),
        'age_eligibility_changed',coalesce((a.metadata->>'age_eligibility_changed')::boolean,false)
      )
    from public.customer_profile_sensitive_change_audit a
    where v_sensitive
      and a.store_id=p_store_id
      and a.customer_id_snapshot=p_customer_id

    union all

    select
      'customer:' || c.id::text || ':identity_verified',
      'profile',
      'identity_verified',
      'Identidade confirmada',
      'A identidade do cliente foi confirmada.',
      c.identity_verified_at,
      'customer_auth',
      c.id,
      '{}'::jsonb
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and c.identity_verified_at is not null

    union all

    select
      'customer:' || c.id::text || ':last_login',
      'profile',
      'customer_login',
      'Acesso ao portal do cliente',
      'Último acesso autenticado registrado para este cliente.',
      c.last_login,
      'customer_auth',
      c.id,
      '{}'::jsonb
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and c.last_login is not null

    union all

    select
      'order:' || o.id::text,
      'order',
      'order_created',
      case when o.order_code is not null then 'Pedido ' || o.order_code else 'Pedido registrado' end,
      'Pedido vinculado de forma confirmada a este cadastro.',
      o.created_at,
      coalesce(o.sales_channel, 'order'),
      o.id,
      jsonb_build_object(
        'order_id', o.id,
        'order_code', o.order_code,
        'status', o.status,
        'total', o.total,
        'sales_channel', o.sales_channel,
        'fulfillment_type', o.fulfillment_type
      )
    from public.orders o
    where o.store_id = p_store_id
      and o.customer_id = p_customer_id

    union all

    select
      'loyalty:' || lt.id::text,
      'loyalty',
      'loyalty_transaction',
      case when lt.points >= 0 then 'Pontos creditados' else 'Pontos debitados' end,
      coalesce(nullif(btrim(lt.description), ''), 'Movimentação no programa de fidelidade.'),
      lt.created_at,
      'loyalty',
      lt.id,
      jsonb_build_object(
        'points', lt.points,
        'transaction_type', lt.type,
        'order_id', lt.order_id
      )
    from public.loyalty_transactions lt
    where lt.customer_id = p_customer_id

    union all

    select
      'consent:' || cl.id::text,
      'consent',
      'consent_' || coalesce(cl.action, 'recorded'),
      case when cl.action = 'granted' then 'Consentimento concedido' else 'Consentimento revogado' end,
      'Registro de ' || coalesce(cl.consent_type, 'consentimento') || '.',
      cl.created_at,
      coalesce(cl.source, 'consent'),
      cl.id,
      jsonb_build_object(
        'consent_type', cl.consent_type,
        'action', cl.action,
        'terms_version', cl.terms_version,
        'privacy_version', cl.privacy_version
      )
    from public.customer_consent_logs cl
    where v_sensitive
      and cl.store_id = p_store_id
      and cl.customer_id = p_customer_id

    union all

    select
      'address:' || ca.id::text,
      'address',
      'address_added',
      'Endereço adicionado',
      'Um endereço foi incluído no cadastro do cliente.',
      ca.created_at,
      'customer_address',
      ca.id,
      jsonb_build_object('is_default', ca.is_default, 'city', ca.city, 'state', ca.state)
    from public.customer_addresses ca
    where v_sensitive
      and ca.customer_id = p_customer_id

    union all

    select
      'merge:' || me.id::text,
      'merge',
      'customer_merged',
      'Fusão de cadastros concluída',
      case
        when me.canonical_customer_id = p_customer_id then 'Outro cadastro foi consolidado neste cliente.'
        else 'Este cadastro foi consolidado em outro cliente.'
      end,
      me.created_at,
      'customer_merge',
      me.id,
      jsonb_build_object(
        'canonical_customer_id', me.canonical_customer_id,
        'duplicate_customer_id', me.duplicate_customer_id,
        'match_basis', me.match_basis,
        'moved_counts', me.moved_counts
      )
    from public.customer_merge_events me
    where v_sensitive
      and me.store_id = p_store_id
      and (me.canonical_customer_id = p_customer_id or me.duplicate_customer_id = p_customer_id)

    union all

    select
      'notification:' || cn.id::text,
      'communication',
      'customer_notification',
      coalesce(nullif(btrim(cn.title), ''), 'Comunicação registrada'),
      'Notificação registrada para o cliente.',
      cn.created_at,
      'customer_notification',
      cn.id,
      jsonb_build_object('notification_type', cn.type, 'read', cn.read)
    from public.customer_notifications cn
    where v_sensitive
      and cn.store_id = p_store_id
      and cn.customer_id = p_customer_id
  ), limited as (
    select *
    from timeline_events
    where occurred_at is not null
    order by occurred_at desc, event_id desc
    limit greatest(1, least(coalesce(p_limit, 100), 300))
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event_id,
        'category', category,
        'event_type', event_type,
        'title', title,
        'description', description,
        'occurred_at', occurred_at,
        'source', source,
        'related_id', related_id,
        'metadata', metadata
      ) order by occurred_at desc, event_id desc
    ),
    '[]'::jsonb
  ) into v_events
  from limited;

  return jsonb_build_object(
    'ok', true,
    'events', v_events,
    'sensitive_data_visible', v_sensitive,
    'identity_link_policy', 'confirmed_customer_id_only'
  );
end;
$function$;

revoke all on function public.get_customer_timeline_safe(uuid,uuid,integer) from public,anon;
grant execute on function public.get_customer_timeline_safe(uuid,uuid,integer) to authenticated,service_role;

commit;
