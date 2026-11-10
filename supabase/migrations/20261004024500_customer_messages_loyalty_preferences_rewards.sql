begin;

-- ---------------------------------------------------------------------------
-- Customer notifications: keep severity (type) and add an independent category.
-- ---------------------------------------------------------------------------
alter table public.customer_notifications
  add column if not exists category text;

update public.customer_notifications
set category = case
  when lower(coalesce(title,'') || ' ' || coalesce(message,'')) ~ '(pedido|entrega|retirada|comanda|delivery)' then 'orders'
  when lower(coalesce(title,'') || ' ' || coalesce(message,'')) ~ '(fidelidade|ponto|pontos|benefício|beneficio|voucher|prêmio|premio)' then 'loyalty'
  when lower(coalesce(title,'') || ' ' || coalesce(message,'')) ~ '(dispositivo|senha|sessão|sessao|segurança|seguranca|acesso)' then 'security'
  when lower(coalesce(title,'') || ' ' || coalesce(message,'')) ~ '(perfil|cadastro|e-mail|email|telefone|dados)' then 'profile'
  when lower(coalesce(title,'') || ' ' || coalesce(message,'')) ~ '(campanha|promoção|promocao|novidade|marketing)' then 'marketing'
  else 'system'
end
where category is null
   or category not in ('orders','loyalty','system','profile','security','marketing','general');

alter table public.customer_notifications
  alter column category set default 'system';

alter table public.customer_notifications
  alter column category set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='customer_notifications_category_check'
      and conrelid='public.customer_notifications'::regclass
  ) then
    alter table public.customer_notifications
      add constraint customer_notifications_category_check
      check (category in ('orders','loyalty','system','profile','security','marketing','general'));
  end if;
end $$;

create or replace function public.customer_notification_category_fill()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_text text := lower(coalesce(new.title,'') || ' ' || coalesce(new.message,''));
begin
  if new.category is null
     or new.category not in ('orders','loyalty','system','profile','security','marketing','general') then
    new.category := case
      when v_text ~ '(pedido|entrega|retirada|comanda|delivery)' then 'orders'
      when v_text ~ '(fidelidade|ponto|pontos|benefício|beneficio|voucher|prêmio|premio)' then 'loyalty'
      when v_text ~ '(dispositivo|senha|sessão|sessao|segurança|seguranca|acesso)' then 'security'
      when v_text ~ '(perfil|cadastro|e-mail|email|telefone|dados)' then 'profile'
      when v_text ~ '(campanha|promoção|promocao|novidade|marketing)' then 'marketing'
      else 'system'
    end;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_customer_notification_category_fill
  on public.customer_notifications;
create trigger trg_customer_notification_category_fill
before insert or update of title,message,category
on public.customer_notifications
for each row execute function public.customer_notification_category_fill();

create or replace function public.get_customer_self_notifications_safe(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_rows jsonb;
  v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb)
  into v_rows
  from (
    select id,title,message,type,category,coalesce(read,false) as read,created_at
    from public.customer_notifications
    where customer_id=v_customer_id and store_id=v_store_id
    order by created_at desc
    limit v_limit
  ) n;

  return jsonb_build_object('ok',true,'notifications',v_rows);
end;
$function$;

revoke all on function public.get_customer_self_notifications_safe(integer)
  from public,anon;
grant execute on function public.get_customer_self_notifications_safe(integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Loyalty communications are distinct from general marketing permissions.
-- ---------------------------------------------------------------------------
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
    'loyalty_whatsapp',
    'loyalty_email',
    'loyalty_sms',
    'loyalty_webapp'
  ) then
    return jsonb_build_object('ok',false,'error','invalid_consent_type');
  end if;

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

  if p_consent_type in ('marketing_email','loyalty_email')
     and coalesce(p_granted,false)
     and coalesce(v_customer.email_verified,false)=false then
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

revoke all on function public.set_customer_self_consent_safe(text,boolean,text,text,text)
  from public,anon;
grant execute on function public.set_customer_self_consent_safe(text,boolean,text,text,text)
  to authenticated;

create or replace function public.join_customer_self_loyalty_profile_safe_internal(
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
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_program public.fidelity_programs%rowtype;
  v_missing text[] := array[]::text[];
  v_blocked boolean := false;
  v_now timestamptz := clock_timestamp();
  v_terms_version text;
  v_previous text;
  v_was_member boolean := false;
  v_statement text := 'Declaro que sou responsável pela veracidade e atualização das informações fornecidas à loja e que possuo legitimidade para aderir ao programa de fidelidade e aceitar seu regulamento.';
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if coalesce(p_accept_terms,false)=false then
    return jsonb_build_object('ok',false,'error','loyalty_terms_required','message','Leia e aceite o regulamento do programa para continuar.');
  end if;

  if coalesce(p_data_responsibility,false)=false then
    return jsonb_build_object('ok',false,'error','loyalty_data_responsibility_required','message','Confirme que você é responsável pelas informações fornecidas para continuar.');
  end if;

  select * into v_customer
  from public.customers
  where id=v_customer_id and store_id=v_store_id
  for update;

  if not found or v_customer.status in ('merged','anonymized','deleted_requested') then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  select * into v_program
  from public.fidelity_programs
  where store_id=v_store_id and coalesce(is_active,false)=true
  order by updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','loyalty_program_unavailable','message','O programa de fidelidade da loja não está disponível neste momento.');
  end if;

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

  if coalesce(length(trim(v_customer.full_name)),0)<3 then v_missing:=array_append(v_missing,'nome'); end if;
  if v_customer.birth_date is null then v_missing:=array_append(v_missing,'data de nascimento'); end if;
  if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))<>11 then v_missing:=array_append(v_missing,'CPF'); end if;
  if v_customer.email is null
     or v_customer.email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    v_missing:=array_append(v_missing,'e-mail válido');
  elsif coalesce(v_customer.email_verified,false)=false then
    v_missing:=array_append(v_missing,'e-mail confirmado');
  end if;

  if array_length(v_missing,1) is not null then
    return jsonb_build_object(
      'ok',false,
      'error','loyalty_profile_incomplete',
      'missing_fields',to_jsonb(v_missing),
      'message','Complete os requisitos antes de entrar no programa: '||array_to_string(v_missing,', ')||'.'
    );
  end if;

  v_was_member := coalesce(v_customer.loyalty_opt_in,false);
  v_terms_version := coalesce(v_program.updated_at::text,v_program.id::text);

  select action into v_previous
  from public.customer_consent_logs
  where customer_id=v_customer_id and store_id=v_store_id and consent_type='loyalty_data_responsibility'
  order by created_at desc,id desc limit 1;

  if v_previous is distinct from 'granted' then
    insert into public.customer_consent_logs(
      customer_id,store_id,consent_type,action,terms_version,source,metadata,created_at
    ) values (
      v_customer_id,v_store_id,'loyalty_data_responsibility','granted',v_terms_version,
      'customer_loyalty_join',
      jsonb_build_object('statement',v_statement,'customer_attested',true),
      v_now
    );
  end if;

  select action into v_previous
  from public.customer_consent_logs
  where customer_id=v_customer_id and store_id=v_store_id and consent_type='loyalty_program'
  order by created_at desc,id desc limit 1;

  if v_previous is distinct from 'granted' then
    insert into public.customer_consent_logs(
      customer_id,store_id,consent_type,action,terms_version,source,metadata,created_at
    ) values (
      v_customer_id,v_store_id,'loyalty_program','granted',v_terms_version,
      'customer_loyalty_join',
      jsonb_build_object('program_id',v_program.id,'program_name',v_program.name),
      v_now
    );
  end if;

  perform public.set_customer_self_consent_safe('loyalty_whatsapp',coalesce(p_marketing_whatsapp,false),null,null,'customer_loyalty_join');
  perform public.set_customer_self_consent_safe('loyalty_email',coalesce(p_marketing_email,false),null,null,'customer_loyalty_join');
  perform public.set_customer_self_consent_safe('loyalty_sms',coalesce(p_marketing_sms,false),null,null,'customer_loyalty_join');
  perform public.set_customer_self_consent_safe('loyalty_webapp',true,null,null,'customer_loyalty_join');

  update public.customers
  set loyalty_opt_in=true,
      updated_at=v_now
  where id=v_customer_id and store_id=v_store_id;

  return jsonb_build_object(
    'ok',true,
    'loyalty_opt_in',true,
    'already_member',v_was_member,
    'email_verified',true,
    'recorded_at',v_now
  );
end;
$function$;

revoke all on function public.join_customer_self_loyalty_profile_safe_internal(boolean,boolean,boolean,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.join_customer_self_loyalty_profile_safe_internal(boolean,boolean,boolean,boolean,boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- Customer-facing loyalty rewards/vouchers.
-- ---------------------------------------------------------------------------
create or replace function public.get_customer_self_loyalty_rewards_safe()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_points integer:=0;
  v_program_id uuid;
  v_rewards jsonb;
  v_vouchers jsonb;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select coalesce(c.loyalty_points,0)
    into v_points
  from public.customers c
  where c.id=v_customer_id and c.store_id=v_store_id;

  select fp.id
    into v_program_id
  from public.fidelity_programs fp
  where fp.store_id=v_store_id
    and coalesce(fp.is_active,false)=true
  order by fp.updated_at desc
  limit 1;

  if v_program_id is null then
    return jsonb_build_object('ok',true,'points',v_points,'rewards','[]'::jsonb,'vouchers','[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',r.id,
        'title',r.title,
        'description',r.description,
        'points_cost',r.points_cost,
        'type',r.type,
        'image_url',r.image_url,
        'additional_cash_cost',r.additional_cash_cost,
        'stock_quantity',r.stock_quantity,
        'voucher_validity_days',r.voucher_validity_days,
        'offer_valid_until',r.offer_valid_until,
        'product_id',r.product_id,
        'product_quantity',r.product_quantity,
        'discount_amount',r.discount_amount,
        'discount_percentage',r.discount_percentage,
        'max_discount_value',r.max_discount_value,
        'min_order_value',r.min_order_value,
        'affordable',coalesce(r.points_cost,0)<=v_points
      )
      order by (coalesce(r.points_cost,0)<=v_points) desc, r.points_cost asc, r.title
    ),
    '[]'::jsonb
  )
  into v_rewards
  from public.fidelity_rewards r
  where r.program_id=v_program_id
    and coalesce(r.is_active,true)=true
    and (r.offer_valid_until is null or r.offer_valid_until>clock_timestamp())
    and (r.stock_quantity is null or r.stock_quantity>0);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',v.id,
        'reward_id',v.reward_id,
        'code',v.code,
        'status',v.status,
        'expires_at',v.expires_at,
        'used_at',v.used_at,
        'created_at',v.created_at,
        'reward_title',r.title,
        'reward_type',r.type
      )
      order by v.created_at desc
    ),
    '[]'::jsonb
  )
  into v_vouchers
  from public.fidelity_vouchers v
  left join public.fidelity_rewards r on r.id=v.reward_id
  where v.customer_id=v_customer_id
    and v.store_id=v_store_id
    and coalesce(v.status,'active') not in ('cancelled','expired')
    and (v.expires_at is null or v.expires_at>clock_timestamp());

  return jsonb_build_object(
    'ok',true,
    'points',v_points,
    'rewards',v_rewards,
    'vouchers',v_vouchers
  );
end;
$function$;

revoke all on function public.get_customer_self_loyalty_rewards_safe()
  from public,anon;
grant execute on function public.get_customer_self_loyalty_rewards_safe()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Public institutional loyalty data for the storefront "Loja" area.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_loyalty_program_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_store_id uuid;
  v_store_name text;
  v_program public.fidelity_programs%rowtype;
  v_rewards jsonb;
  v_terms text;
  v_voucher_terms text;
  v_voucher_days integer:=15;
begin
  v_store_id:=public.resolve_public_store_id_by_slug(p_slug);
  if v_store_id is null then
    return jsonb_build_object('ok',false,'error','store_not_found_or_disabled');
  end if;

  select s.name into v_store_name
  from public.stores s
  where s.id=v_store_id;

  select * into v_program
  from public.fidelity_programs fp
  where fp.store_id=v_store_id
    and coalesce(fp.is_active,false)=true
  order by fp.updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok',true,'program',null,'rewards','[]'::jsonb);
  end if;

  select coalesce(max(fr.voucher_validity_days),15)
    into v_voucher_days
  from public.fidelity_rewards fr
  where fr.program_id=v_program.id and coalesce(fr.is_active,true)=true;

  v_terms:=coalesce(v_program.program_terms,'');
  v_voucher_terms:=coalesce(v_program.voucher_terms,'');
  v_terms:=replace(replace(replace(replace(
    v_terms,
    '{{STORE_NAME}}',coalesce(v_store_name,'Loja')),
    '{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),
    '{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),
    '{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);
  v_voucher_terms:=replace(replace(replace(replace(
    v_voucher_terms,
    '{{STORE_NAME}}',coalesce(v_store_name,'Loja')),
    '{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),
    '{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),
    '{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',r.id,
        'title',r.title,
        'description',r.description,
        'points_cost',r.points_cost,
        'type',r.type,
        'image_url',r.image_url,
        'additional_cash_cost',r.additional_cash_cost,
        'offer_valid_until',r.offer_valid_until
      )
      order by r.points_cost asc,r.title
    ),
    '[]'::jsonb
  )
  into v_rewards
  from (
    select *
    from public.fidelity_rewards
    where program_id=v_program.id
      and coalesce(is_active,true)=true
      and (offer_valid_until is null or offer_valid_until>clock_timestamp())
      and (stock_quantity is null or stock_quantity>0)
    order by points_cost asc,title
    limit 8
  ) r;

  return jsonb_build_object(
    'ok',true,
    'program',jsonb_build_object(
      'id',v_program.id,
      'name',v_program.name,
      'points_per_currency',v_program.points_per_currency,
      'min_order_value',v_program.min_order_value,
      'enable_join_bonus',v_program.enable_join_bonus,
      'join_bonus_points',v_program.join_bonus_points,
      'enable_birthday_bonus',v_program.enable_birthday_bonus,
      'birthday_bonus_points',v_program.birthday_bonus_points,
      'points_validity_months',v_program.points_validity_months,
      'min_points_redemption',v_program.min_points_redemption,
      'program_terms',v_terms,
      'voucher_terms',v_voucher_terms,
      'updated_at',v_program.updated_at
    ),
    'rewards',v_rewards
  );
end;
$function$;

revoke all on function public.get_public_loyalty_program_by_slug(text)
  from public;
grant execute on function public.get_public_loyalty_program_by_slug(text)
  to anon,authenticated;

commit;
