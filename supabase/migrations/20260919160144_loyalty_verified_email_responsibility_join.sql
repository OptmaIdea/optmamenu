-- Fidelidade: e-mail verificado obrigatório, declaração de responsabilidade e adesão atômica.
create or replace function public.purge_customer_loyalty_data_internal(p_store_id uuid,p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_vouchers integer:=0; v_transactions integer:=0; v_consents integer:=0;
begin
  delete from public.fidelity_vouchers where store_id=p_store_id and customer_id=p_customer_id;
  get diagnostics v_vouchers=row_count;

  delete from public.loyalty_transactions lt
  where lt.customer_id=p_customer_id and (
    lt.program_id is null
    or exists(select 1 from public.fidelity_programs fp where fp.id=lt.program_id and fp.store_id=p_store_id)
    or exists(select 1 from public.orders o where o.id=lt.order_id and o.store_id=p_store_id)
  );
  get diagnostics v_transactions=row_count;

  delete from public.customer_consent_logs
  where customer_id=p_customer_id and store_id=p_store_id
    and consent_type in ('loyalty_program','loyalty_data_responsibility');
  get diagnostics v_consents=row_count;

  update public.customers
  set loyalty_opt_in=false,loyalty_points=0,loyalty_tier='Bronze',current_tier_id=null,
      current_stamps=0,last_point_activity_at=null,updated_at=clock_timestamp()
  where id=p_customer_id and store_id=p_store_id;

  return jsonb_build_object('ok',true,'deleted_vouchers',v_vouchers,'deleted_transactions',v_transactions,'deleted_loyalty_consents',v_consents);
end;
$function$;
revoke all on function public.purge_customer_loyalty_data_internal(uuid,uuid) from public,anon,authenticated;
grant execute on function public.purge_customer_loyalty_data_internal(uuid,uuid) to service_role;

create or replace function public.join_customer_self_loyalty_safe(
  p_accept_terms boolean,
  p_data_responsibility boolean,
  p_marketing_whatsapp boolean default false,
  p_marketing_email boolean default false,
  p_marketing_sms boolean default false
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_program public.fidelity_programs%rowtype;
  v_missing text[]:=array[]::text[];
  v_blocked boolean:=false;
  v_now timestamptz:=clock_timestamp();
  v_terms_version text;
  v_previous text;
  v_was_member boolean:=false;
  v_marketing_consent boolean:=false;
  v_statement text:='Declaro que sou responsável pela veracidade e atualização das informações fornecidas à loja e que possuo legitimidade para aderir ao programa de fidelidade e aceitar seu regulamento.';
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if not coalesce(p_accept_terms,false) then
    return jsonb_build_object('ok',false,'error','loyalty_terms_required','message','Leia e aceite o regulamento do programa para continuar.');
  end if;
  if not coalesce(p_data_responsibility,false) then
    return jsonb_build_object('ok',false,'error','loyalty_data_responsibility_required','message','Confirme que você é responsável pelas informações fornecidas para continuar.');
  end if;

  select * into v_customer from public.customers
  where id=v_customer_id and store_id=v_store_id for update;
  if not found or v_customer.status in ('merged','anonymized','deleted_requested') then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  select * into v_program from public.fidelity_programs
  where store_id=v_store_id and coalesce(is_active,false)=true
  order by updated_at desc limit 1;
  if not found then
    return jsonb_build_object('ok',false,'error','loyalty_program_unavailable','message','O programa de fidelidade da loja não está disponível neste momento.');
  end if;

  select exists(
    select 1 from public.fidelity_membership_blocks b
    where b.store_id=v_store_id and b.unblocked_at is null and (
      b.customer_id=v_customer_id
      or (
        length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11
        and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)
      )
    )
  ) into v_blocked;
  if v_blocked then
    return jsonb_build_object('ok',false,'error','loyalty_membership_blocked','message','Sua participação neste programa de fidelidade está indisponível. Fale com a loja para mais informações.');
  end if;

  if coalesce(length(trim(v_customer.full_name)),0)<3 then v_missing:=array_append(v_missing,'nome'); end if;
  if v_customer.birth_date is null then v_missing:=array_append(v_missing,'data de nascimento'); end if;
  if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))<>11 then v_missing:=array_append(v_missing,'CPF'); end if;
  if v_customer.email is null or v_customer.email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    v_missing:=array_append(v_missing,'e-mail válido');
  elsif not coalesce(v_customer.email_verified,false) then
    v_missing:=array_append(v_missing,'e-mail confirmado');
  end if;
  if array_length(v_missing,1) is not null then
    return jsonb_build_object('ok',false,'error','loyalty_profile_incomplete','missing_fields',to_jsonb(v_missing),'message','Complete os requisitos antes de entrar no programa: '||array_to_string(v_missing,', ')||'.');
  end if;

  v_was_member:=coalesce(v_customer.loyalty_opt_in,false);
  v_terms_version:=coalesce(v_program.updated_at::text,v_program.id::text);

  select action into v_previous from public.customer_consent_logs
  where customer_id=v_customer_id and store_id=v_store_id and consent_type='loyalty_data_responsibility'
  order by created_at desc,id desc limit 1;
  if v_previous is distinct from 'granted' then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,terms_version,source,metadata,created_at)
    values(v_customer_id,v_store_id,'loyalty_data_responsibility','granted',v_terms_version,'customer_loyalty_join',
      jsonb_build_object('statement',v_statement,'customer_attested',true),v_now);
  end if;

  select action into v_previous from public.customer_consent_logs
  where customer_id=v_customer_id and store_id=v_store_id and consent_type='loyalty_program'
  order by created_at desc,id desc limit 1;
  if v_previous is distinct from 'granted' then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,terms_version,source,metadata,created_at)
    values(v_customer_id,v_store_id,'loyalty_program','granted',v_terms_version,'customer_loyalty_join',
      jsonb_build_object('program_id',v_program.id,'program_name',v_program.name),v_now);
  end if;

  select action into v_previous from public.customer_consent_logs
  where customer_id=v_customer_id and store_id=v_store_id and consent_type='marketing_whatsapp'
  order by created_at desc,id desc limit 1;
  if v_previous is distinct from (case when coalesce(p_marketing_whatsapp,false) then 'granted' else 'revoked' end) then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,source,revoked_at,metadata,created_at)
    values(v_customer_id,v_store_id,'marketing_whatsapp',
      case when coalesce(p_marketing_whatsapp,false) then 'granted' else 'revoked' end,
      'customer_loyalty_join',case when coalesce(p_marketing_whatsapp,false) then null else v_now end,
      jsonb_build_object('source_context','loyalty_join'),v_now);
  end if;

  select action into v_previous from public.customer_consent_logs
  where customer_id=v_customer_id and store_id=v_store_id and consent_type='marketing_email'
  order by created_at desc,id desc limit 1;
  if v_previous is distinct from (case when coalesce(p_marketing_email,false) then 'granted' else 'revoked' end) then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,source,revoked_at,metadata,created_at)
    values(v_customer_id,v_store_id,'marketing_email',
      case when coalesce(p_marketing_email,false) then 'granted' else 'revoked' end,
      'customer_loyalty_join',case when coalesce(p_marketing_email,false) then null else v_now end,
      jsonb_build_object('source_context','loyalty_join','email_verified',true),v_now);
  end if;

  select action into v_previous from public.customer_consent_logs
  where customer_id=v_customer_id and store_id=v_store_id and consent_type='marketing_sms'
  order by created_at desc,id desc limit 1;
  if v_previous is distinct from (case when coalesce(p_marketing_sms,false) then 'granted' else 'revoked' end) then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,source,revoked_at,metadata,created_at)
    values(v_customer_id,v_store_id,'marketing_sms',
      case when coalesce(p_marketing_sms,false) then 'granted' else 'revoked' end,
      'customer_loyalty_join',case when coalesce(p_marketing_sms,false) then null else v_now end,
      jsonb_build_object('source_context','loyalty_join'),v_now);
  end if;

  v_marketing_consent:=coalesce(p_marketing_whatsapp,false) or coalesce(p_marketing_email,false) or coalesce(p_marketing_sms,false);
  update public.customers
  set loyalty_opt_in=true,marketing_consent=v_marketing_consent,updated_at=v_now
  where id=v_customer_id and store_id=v_store_id;

  return jsonb_build_object('ok',true,'loyalty_opt_in',true,'already_member',v_was_member,'marketing_consent',v_marketing_consent,'email_verified',true,'recorded_at',v_now);
end;
$function$;
revoke all on function public.join_customer_self_loyalty_safe(boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.join_customer_self_loyalty_safe(boolean,boolean,boolean,boolean,boolean) to authenticated,service_role;

-- Mantém a RPC genérica protegida: aderir exige e-mail verificado e declaração prévia.
create or replace function public.set_customer_self_consent_safe(
  p_consent_type text,p_granted boolean,p_terms_version text default null,p_privacy_version text default null,p_source text default 'customer_portal'
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id(); v_store_id uuid:=public.app_current_store_id();
  v_action text:=case when coalesce(p_granted,false) then 'granted' else 'revoked' end;
  v_event_at timestamptz:=clock_timestamp(); v_marketing_consent boolean:=false; v_loyalty_opt_in boolean:=false;
  v_previous_action text; v_unchanged boolean:=false; v_customer public.customers%rowtype;
  v_missing text[]:=array[]::text[]; v_blocked boolean:=false; v_responsibility boolean:=false;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if p_consent_type not in ('loyalty_program','marketing_whatsapp','marketing_email','marketing_sms') then return jsonb_build_object('ok',false,'error','invalid_consent_type'); end if;
  select * into v_customer from public.customers where id=v_customer_id and store_id=v_store_id for update;
  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;

  if p_consent_type='loyalty_program' and coalesce(p_granted,false) then
    select exists(select 1 from public.fidelity_membership_blocks b where b.store_id=v_store_id and b.unblocked_at is null
      and (b.customer_id=v_customer_id or (length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11 and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)))) into v_blocked;
    if v_blocked then return jsonb_build_object('ok',false,'error','loyalty_membership_blocked','message','Sua participação neste programa de fidelidade está indisponível. Fale com a loja para mais informações.'); end if;
    if coalesce(length(trim(v_customer.full_name)),0)<3 then v_missing:=array_append(v_missing,'nome'); end if;
    if v_customer.birth_date is null then v_missing:=array_append(v_missing,'data de nascimento'); end if;
    if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))<>11 then v_missing:=array_append(v_missing,'CPF'); end if;
    if v_customer.email is null or v_customer.email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then v_missing:=array_append(v_missing,'e-mail válido');
    elsif not coalesce(v_customer.email_verified,false) then v_missing:=array_append(v_missing,'e-mail confirmado'); end if;
    if array_length(v_missing,1) is not null then return jsonb_build_object('ok',false,'error','loyalty_profile_incomplete','missing_fields',to_jsonb(v_missing),'message','Complete os requisitos antes de entrar no programa: '||array_to_string(v_missing,', ')||'.'); end if;
    select coalesce((select action='granted' from public.customer_consent_logs where customer_id=v_customer_id and store_id=v_store_id and consent_type='loyalty_data_responsibility' order by created_at desc,id desc limit 1),false) into v_responsibility;
    if not v_responsibility then return jsonb_build_object('ok',false,'error','loyalty_data_responsibility_required','message','Confirme a responsabilidade pelas informações fornecidas antes de aderir ao programa.'); end if;
  end if;

  if p_consent_type='marketing_email' and coalesce(p_granted,false) and not coalesce(v_customer.email_verified,false) then
    return jsonb_build_object('ok',false,'error','email_verification_required','message','Confirme seu e-mail antes de autorizar comunicações por e-mail.');
  end if;

  select ccl.action into v_previous_action from public.customer_consent_logs ccl
  where ccl.customer_id=v_customer_id and ccl.store_id=v_store_id and ccl.consent_type=p_consent_type
  order by ccl.created_at desc,ccl.id desc limit 1;
  v_unchanged:=v_previous_action=v_action;
  if not v_unchanged then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,terms_version,privacy_version,source,revoked_at,metadata,created_at)
    values(v_customer_id,v_store_id,p_consent_type,v_action,p_terms_version,p_privacy_version,coalesce(nullif(trim(p_source),''),'customer_portal'),
      case when v_action='revoked' then v_event_at else null end,jsonb_build_object('recorded_by','customer_self_service'),v_event_at);
  end if;

  select exists(select 1 from (
    select distinct on(consent_type) consent_type,action from public.customer_consent_logs
    where customer_id=v_customer_id and store_id=v_store_id and consent_type in ('marketing_whatsapp','marketing_email','marketing_sms')
    order by consent_type,created_at desc,id desc
  ) latest where latest.action='granted') into v_marketing_consent;

  select coalesce((select action='granted' from public.customer_consent_logs where customer_id=v_customer_id and store_id=v_store_id and consent_type='loyalty_program' order by created_at desc,id desc limit 1),false) into v_loyalty_opt_in;
  update public.customers set marketing_consent=v_marketing_consent,loyalty_opt_in=v_loyalty_opt_in,updated_at=clock_timestamp()
  where id=v_customer_id and store_id=v_store_id;

  return jsonb_build_object('ok',true,'consent_type',p_consent_type,'action',v_action,'unchanged',v_unchanged,'marketing_consent',v_marketing_consent,'loyalty_opt_in',v_loyalty_opt_in,'recorded_at',v_event_at);
end;
$function$;
revoke all on function public.set_customer_self_consent_safe(text,boolean,text,text,text) from public,anon;
grant execute on function public.set_customer_self_consent_safe(text,boolean,text,text,text) to authenticated,service_role;
