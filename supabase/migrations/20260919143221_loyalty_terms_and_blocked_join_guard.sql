-- Regulamento do programa no portal do cliente e bloqueio de nova adesão por CPF.
create or replace function public.get_customer_self_loyalty_program_safe()
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
 v_customer_id uuid:=public.app_current_customer_id(); v_store_id uuid:=public.app_current_store_id();
 v_customer public.customers%rowtype; v_program public.fidelity_programs%rowtype; v_store_name text;
 v_blocked boolean:=false; v_block_reason text; v_terms text; v_voucher_terms text; v_voucher_days integer:=15;
begin
 if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 select * into v_customer from public.customers where id=v_customer_id and store_id=v_store_id limit 1;
 if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;
 select * into v_program from public.fidelity_programs where store_id=v_store_id order by is_active desc,updated_at desc limit 1;
 select s.name into v_store_name from public.stores s where s.id=v_store_id;
 select exists(select 1 from public.fidelity_membership_blocks b where b.store_id=v_store_id and b.unblocked_at is null
   and (b.customer_id=v_customer_id or (length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11 and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf))))
 into v_blocked;
 select b.reason into v_block_reason from public.fidelity_membership_blocks b where b.store_id=v_store_id and b.unblocked_at is null
   and (b.customer_id=v_customer_id or (length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11 and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)))
 order by b.blocked_at desc limit 1;
 if v_program.id is null then return jsonb_build_object('ok',true,'program',null,'membership_blocked',v_blocked,'block_reason',v_block_reason); end if;
 select coalesce(max(fr.voucher_validity_days),15) into v_voucher_days from public.fidelity_rewards fr where fr.program_id=v_program.id and coalesce(fr.is_active,true)=true;
 v_terms:=coalesce(v_program.program_terms,''); v_voucher_terms:=coalesce(v_program.voucher_terms,'');
 v_terms:=replace(replace(replace(replace(v_terms,'{{STORE_NAME}}',coalesce(v_store_name,'Loja')),'{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),'{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),'{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);
 v_voucher_terms:=replace(replace(replace(replace(v_voucher_terms,'{{STORE_NAME}}',coalesce(v_store_name,'Loja')),'{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),'{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),'{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);
 return jsonb_build_object('ok',true,'membership_blocked',v_blocked,'block_reason',v_block_reason,'program',jsonb_build_object(
   'id',v_program.id,'name',v_program.name,'is_active',v_program.is_active,'points_per_currency',v_program.points_per_currency,
   'min_order_value',v_program.min_order_value,'enable_join_bonus',v_program.enable_join_bonus,'join_bonus_points',v_program.join_bonus_points,
   'enable_birthday_bonus',v_program.enable_birthday_bonus,'birthday_bonus_points',v_program.birthday_bonus_points,
   'points_validity_months',v_program.points_validity_months,'min_points_redemption',v_program.min_points_redemption,
   'program_terms',v_terms,'voucher_terms',v_voucher_terms,'updated_at',v_program.updated_at
 ));
end;
$function$;
revoke all on function public.get_customer_self_loyalty_program_safe() from public,anon;
grant execute on function public.get_customer_self_loyalty_program_safe() to authenticated,service_role;

create or replace function public.set_customer_self_consent_safe(
  p_consent_type text,
  p_granted boolean,
  p_terms_version text default null,
  p_privacy_version text default null,
  p_source text default 'customer_portal'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_action text := case when coalesce(p_granted,false) then 'granted' else 'revoked' end;
  v_event_at timestamptz := clock_timestamp();
  v_marketing_consent boolean := false;
  v_loyalty_opt_in boolean := false;
  v_previous_action text;
  v_unchanged boolean := false;
  v_customer public.customers%rowtype;
  v_missing text[] := array[]::text[];
  v_blocked boolean := false;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if p_consent_type not in ('loyalty_program','marketing_whatsapp','marketing_email','marketing_sms') then
    return jsonb_build_object('ok',false,'error','invalid_consent_type');
  end if;

  select * into v_customer
  from public.customers
  where id=v_customer_id and store_id=v_store_id
  for update;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  if p_consent_type='loyalty_program' and coalesce(p_granted,false) then
    select exists(
      select 1
      from public.fidelity_membership_blocks b
      where b.store_id=v_store_id
        and b.unblocked_at is null
        and (
          b.customer_id=v_customer_id
          or (
            length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11
            and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)
          )
        )
    ) into v_blocked;

    if v_blocked then
      return jsonb_build_object(
        'ok',false,
        'error','loyalty_membership_blocked',
        'message','Sua participação neste programa de fidelidade está indisponível. Fale com a loja para mais informações.'
      );
    end if;

    if coalesce(length(trim(v_customer.full_name)),0)<3 then
      v_missing:=array_append(v_missing,'nome');
    end if;
    if v_customer.birth_date is null then
      v_missing:=array_append(v_missing,'data de nascimento');
    end if;
    if v_customer.birth_date is not null
       and age(current_date,v_customer.birth_date)>=interval '18 years'
       and length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))<>11 then
      v_missing:=array_append(v_missing,'CPF');
    end if;
    if v_customer.email is null
       or v_customer.email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,} then
      v_missing:=array_append(v_missing,'e-mail válido');
    end if;

    if array_length(v_missing,1) is not null then
      return jsonb_build_object(
        'ok',false,
        'error','loyalty_profile_incomplete',
        'missing_fields',to_jsonb(v_missing),
        'message','Complete seu cadastro antes de entrar no programa: '||array_to_string(v_missing,', ')||'.'
      );
    end if;
  end if;

  select ccl.action into v_previous_action
  from public.customer_consent_logs ccl
  where ccl.customer_id=v_customer_id
    and ccl.store_id=v_store_id
    and ccl.consent_type=p_consent_type
  order by ccl.created_at desc,ccl.id desc
  limit 1;

  v_unchanged:=v_previous_action=v_action;

  if not v_unchanged then
    insert into public.customer_consent_logs(
      customer_id,store_id,consent_type,action,
      terms_version,privacy_version,source,revoked_at,metadata,created_at
    )
    values(
      v_customer_id,v_store_id,p_consent_type,v_action,
      p_terms_version,p_privacy_version,
      coalesce(nullif(trim(p_source),''),'customer_portal'),
      case when v_action='revoked' then v_event_at else null end,
      jsonb_build_object('recorded_by','customer_self_service'),
      v_event_at
    );
  end if;

  select exists(
    select 1
    from (
      select distinct on (consent_type) consent_type,action
      from public.customer_consent_logs
      where customer_id=v_customer_id
        and store_id=v_store_id
        and consent_type in ('marketing_whatsapp','marketing_email','marketing_sms')
      order by consent_type,created_at desc,id desc
    ) latest
    where latest.action='granted'
  ) into v_marketing_consent;

  select coalesce((
    select action='granted'
    from public.customer_consent_logs
    where customer_id=v_customer_id
      and store_id=v_store_id
      and consent_type='loyalty_program'
    order by created_at desc,id desc
    limit 1
  ),false) into v_loyalty_opt_in;

  update public.customers
  set marketing_consent=v_marketing_consent,
      loyalty_opt_in=v_loyalty_opt_in,
      updated_at=clock_timestamp()
  where id=v_customer_id and store_id=v_store_id;

  return jsonb_build_object(
    'ok',true,
    'consent_type',p_consent_type,
    'action',v_action,
    'unchanged',v_unchanged,
    'marketing_consent',v_marketing_consent,
    'loyalty_opt_in',v_loyalty_opt_in,
    'recorded_at',v_event_at
  );
end;
$function$;

revoke all on function public.set_customer_self_consent_safe(text,boolean,text,text,text) from public,anon;
grant execute on function public.set_customer_self_consent_safe(text,boolean,text,text,text) to authenticated,service_role;
