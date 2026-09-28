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
  v_responsibility boolean := false;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if p_consent_type not in (
    'loyalty_program',
    'marketing_whatsapp',
    'marketing_email',
    'marketing_sms',
    'loyalty_webapp'
  ) then
    return jsonb_build_object('ok',false,'error','invalid_consent_type');
  end if;

  -- Web/App é um canal interno obrigatório do programa, não uma permissão
  -- promocional revogável. Mesmo uma chamada manipulada com false permanece granted.
  if p_consent_type='loyalty_webapp' then
    v_action:='granted';
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
      select 1 from public.fidelity_membership_blocks b
      where b.store_id=v_store_id and b.unblocked_at is null
        and (
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
    elsif coalesce(v_customer.email_verified,false)=false then
      v_missing:=array_append(v_missing,'e-mail confirmado');
    end if;

    if array_length(v_missing,1) is not null then
      return jsonb_build_object('ok',false,'error','loyalty_profile_incomplete','missing_fields',to_jsonb(v_missing),'message','Complete os requisitos antes de entrar no programa: '||array_to_string(v_missing,', ')||'.');
    end if;

    select coalesce((
      select action='granted'
      from public.customer_consent_logs
      where customer_id=v_customer_id and store_id=v_store_id and consent_type='loyalty_data_responsibility'
      order by created_at desc,id desc limit 1
    ),false) into v_responsibility;

    if not v_responsibility then
      return jsonb_build_object('ok',false,'error','loyalty_data_responsibility_required','message','Confirme a responsabilidade pelas informações fornecidas antes de aderir ao programa.');
    end if;
  end if;

  if p_consent_type='marketing_email' and coalesce(p_granted,false) and coalesce(v_customer.email_verified,false)=false then
    return jsonb_build_object('ok',false,'error','email_verification_required','message','Confirme seu e-mail antes de autorizar comunicações por e-mail.');
  end if;

  select ccl.action into v_previous_action
  from public.customer_consent_logs ccl
  where ccl.customer_id=v_customer_id and ccl.store_id=v_store_id and ccl.consent_type=p_consent_type
  order by ccl.created_at desc,ccl.id desc limit 1;

  v_unchanged:=v_previous_action=v_action;

  if not v_unchanged then
    insert into public.customer_consent_logs(
      customer_id,store_id,consent_type,action,terms_version,privacy_version,source,revoked_at,metadata,created_at
    ) values(
      v_customer_id,v_store_id,p_consent_type,v_action,p_terms_version,p_privacy_version,
      coalesce(nullif(trim(p_source),''),'customer_portal'),
      case when v_action='revoked' then v_event_at else null end,
      jsonb_build_object('recorded_by','customer_self_service'),
      v_event_at
    );
  end if;

  select exists(
    select 1 from (
      select distinct on (consent_type) consent_type,action
      from public.customer_consent_logs
      where customer_id=v_customer_id and store_id=v_store_id
        and consent_type in ('marketing_whatsapp','marketing_email','marketing_sms')
      order by consent_type,created_at desc,id desc
    ) latest where latest.action='granted'
  ) into v_marketing_consent;

  select coalesce((
    select action='granted'
    from public.customer_consent_logs
    where customer_id=v_customer_id and store_id=v_store_id and consent_type='loyalty_program'
    order by created_at desc,id desc limit 1
  ),false) into v_loyalty_opt_in;

  update public.customers
  set marketing_consent=v_marketing_consent,
      loyalty_opt_in=v_loyalty_opt_in,
      updated_at=clock_timestamp()
  where id=v_customer_id and store_id=v_store_id;

  return jsonb_build_object(
    'ok',true,'consent_type',p_consent_type,'action',v_action,'unchanged',v_unchanged,
    'marketing_consent',v_marketing_consent,'loyalty_opt_in',v_loyalty_opt_in,'recorded_at',v_event_at,
    'locked',p_consent_type='loyalty_webapp'
  );
end;
$function$;

revoke all on function public.set_customer_self_consent_safe(text,boolean,text,text,text) from public, anon;
grant execute on function public.set_customer_self_consent_safe(text,boolean,text,text,text) to authenticated, service_role;


-- Garante o estado corrente para participantes já ativos, inclusive quem tenha
-- revogado a opção durante a janela em que ela foi apresentada como editável.
insert into public.customer_consent_logs(
  customer_id,store_id,consent_type,action,source,metadata,created_at
)
select
  c.id,
  c.store_id,
  'loyalty_webapp',
  'granted',
  'system_required_webapp',
  jsonb_build_object('recorded_by','system_migration','mandatory_channel',true),
  clock_timestamp()
from public.customers c
where coalesce(c.loyalty_opt_in,false)=true
  and coalesce((
    select l.action
    from public.customer_consent_logs l
    where l.customer_id=c.id
      and l.store_id=c.store_id
      and l.consent_type='loyalty_webapp'
    order by l.created_at desc,l.id desc
    limit 1
  ),'') <> 'granted';
