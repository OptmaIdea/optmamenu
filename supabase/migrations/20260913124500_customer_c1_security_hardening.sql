-- CLIENTES C1 — hardening estrutural e de segurança
-- 1) explicita bloqueio direto de credenciais;
-- 2) remove endpoints de enumeração por telefone/fidelidade do papel anônimo;
-- 3) separa customers.manage de customers.sensitive.view no servidor;
-- 4) preserva CPF/data de nascimento quando o operador não possui acesso sensível;
-- 5) registra no ledger alterações de adesão à fidelidade feitas pelo próprio cliente.

-- customer_credentials é acessada somente por rotinas SECURITY DEFINER controladas.
-- A policy explícita mantém deny-by-default para API e elimina ambiguidade operacional.
alter table public.customer_credentials enable row level security;
drop policy if exists customer_credentials_explicit_deny on public.customer_credentials;
create policy customer_credentials_explicit_deny
on public.customer_credentials
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table public.customer_credentials from public, anon, authenticated;

-- Este RPC revela diretamente se um telefone existe na loja e não possui uso atual
-- no frontend. Mantemos apenas para service_role/rotinas internas.
revoke all on function public.check_customer_phone_registration_safe(uuid,text) from public, anon, authenticated;
grant execute on function public.check_customer_phone_registration_safe(uuid,text) to service_role;

-- Consulta de pontos por telefone sem prova de posse permite enumeração de clientes.
-- A consulta pública será reintroduzida na integração Clientes + Fidelidade com identidade
-- comprovada (sessão/token), não apenas pela posse do número digitado.
revoke all on function public.get_public_customer_loyalty_by_phone(text,text) from public, anon, authenticated;
grant execute on function public.get_public_customer_loyalty_by_phone(text,text) to service_role;

create or replace function public.get_admin_customers_safe(
  p_store_id uuid,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_customers jsonb;
  v_sensitive boolean := false;
begin
  if p_store_id is null then
    return jsonb_build_object('ok',false,'error','missing_store_id','customers','[]'::jsonb);
  end if;

  if auth.uid() is null or not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id,'customers.view')
    or public.user_has_store_permission(p_store_id,'customers.manage')
  ) then
    return jsonb_build_object('ok',false,'error','access_denied','customers','[]'::jsonb);
  end if;

  -- Gerenciar cliente não implica acesso automático a CPF/data de nascimento.
  v_sensitive := public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id,'customers.sensitive.view');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'store_id',q.store_id,'full_name',q.full_name,'phone',q.phone,'email',q.email,
    'cpf',case when v_sensitive then q.cpf else null end,
    'birth_date',case when v_sensitive then q.birth_date else null end,
    'status',q.status,'source',q.source,'data_ownership',q.data_ownership,'editable_by_store',q.editable_by_store,
    'is_whatsapp',q.is_whatsapp,'contact_preference',q.contact_preference,
    'marketing_consent',q.marketing_consent,'loyalty_opt_in',q.loyalty_opt_in,
    'loyalty_points',q.loyalty_points,'loyalty_tier',q.loyalty_tier,'current_tier_id',q.current_tier_id,
    'current_tier_name',q.current_tier_name,'tags',q.tags,'internal_notes',q.internal_notes,
    'created_at',q.created_at,'last_login',q.last_login,'last_point_activity_at',q.last_point_activity_at,
    'last_order_at',q.last_order_at,'total_orders',q.total_orders,'total_spent',q.total_spent,
    'sensitive_data_visible',v_sensitive
  ) order by q.created_at desc),'[]'::jsonb)
  into v_customers
  from (
    select c.*,ft.name current_tier_name
    from public.customers c
    left join public.fidelity_tiers ft on ft.id=c.current_tier_id
    where c.store_id=p_store_id
    order by c.created_at desc
    limit greatest(1,least(coalesce(p_limit,500),1000))
  ) q;

  return jsonb_build_object('ok',true,'customers',v_customers,'sensitive_data_visible',v_sensitive);
end;
$$;

create or replace function public.get_customer_360_safe(
  p_store_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_customer jsonb;
  v_orders jsonb;
  v_loyalty_transactions jsonb;
  v_addresses jsonb := '[]'::jsonb;
  v_consents jsonb := '[]'::jsonb;
  v_sensitive boolean := false;
begin
  if p_store_id is null or p_customer_id is null then
    return jsonb_build_object('ok',false,'error','missing_parameters');
  end if;

  if auth.uid() is null or not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id,'customers.view')
    or public.user_has_store_permission(p_store_id,'customers.manage')
  ) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  v_sensitive := public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id,'customers.sensitive.view');

  select jsonb_build_object(
    'id',c.id,'store_id',c.store_id,'full_name',c.full_name,'phone',c.phone,'email',c.email,
    'cpf',case when v_sensitive then c.cpf else null end,
    'birth_date',case when v_sensitive then c.birth_date else null end,
    'status',c.status,'source',c.source,'data_ownership',c.data_ownership,'editable_by_store',c.editable_by_store,
    'is_whatsapp',c.is_whatsapp,'contact_preference',c.contact_preference,'marketing_consent',c.marketing_consent,
    'loyalty_opt_in',c.loyalty_opt_in,'loyalty_points',c.loyalty_points,'loyalty_tier',c.loyalty_tier,
    'current_tier_id',c.current_tier_id,'current_tier_name',ft.name,'current_tier_color',ft.color,
    'current_tier_min_points',ft.min_points,'tags',c.tags,'internal_notes',c.internal_notes,
    'created_at',c.created_at,'last_login',c.last_login,'last_point_activity_at',c.last_point_activity_at,
    'last_order_at',c.last_order_at,'total_orders',c.total_orders,'total_spent',c.total_spent,
    'customer_metadata',case when v_sensitive then c.customer_metadata else '{}'::jsonb end,
    'sensitive_data_visible',v_sensitive
  ) into v_customer
  from public.customers c
  left join public.fidelity_tiers ft on ft.id=c.current_tier_id
  where c.id=p_customer_id and c.store_id=p_store_id;

  if v_customer is null then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'order_code',o.order_code,'status',o.status,'total',o.total,'sales_channel',o.sales_channel,
    'fulfillment_type',o.fulfillment_type,'payment_method_code',o.payment_method_code,
    'delivery_method_code',o.delivery_method_code,'created_at',o.created_at,'confirmed_at',o.confirmed_at,'completed_at',o.completed_at
  ) order by o.created_at desc),'[]'::jsonb)
  into v_orders
  from (select * from public.orders where customer_id=p_customer_id and store_id=p_store_id order by created_at desc limit 50) o;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',lt.id,'type',lt.type,'points',lt.points,'description',lt.description,'order_id',lt.order_id,'created_at',lt.created_at
  ) order by lt.created_at desc),'[]'::jsonb)
  into v_loyalty_transactions
  from (select * from public.loyalty_transactions where customer_id=p_customer_id order by created_at desc limit 50) lt;

  if v_sensitive then
    select coalesce(jsonb_agg(to_jsonb(ca) order by ca.created_at desc),'[]'::jsonb)
      into v_addresses from public.customer_addresses ca where ca.customer_id=p_customer_id;
    select coalesce(jsonb_agg(to_jsonb(cl) order by cl.created_at desc),'[]'::jsonb)
      into v_consents from public.customer_consent_logs cl where cl.customer_id=p_customer_id and cl.store_id=p_store_id;
  end if;

  return jsonb_build_object(
    'ok',true,'customer',v_customer,'orders',coalesce(v_orders,'[]'::jsonb),
    'loyalty_transactions',coalesce(v_loyalty_transactions,'[]'::jsonb),
    'addresses',v_addresses,'consents',v_consents,'sensitive_data_visible',v_sensitive
  );
end;
$$;

create or replace function public.create_admin_customer_safe(
  p_store_id uuid,
  p_full_name text,
  p_phone text,
  p_email text default null,
  p_cpf text default null,
  p_birth_date date default null,
  p_tags text[] default '{}'::text[],
  p_internal_notes text default null,
  p_marketing_consent boolean default false,
  p_loyalty_opt_in boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_can_consent boolean := false;
  v_can_sensitive boolean := false;
begin
  if p_store_id is null then
    return jsonb_build_object('ok',false,'error','missing_store_id');
  end if;

  if coalesce(auth.role(),'') in ('anon','authenticated') then
    if auth.uid() is null
       or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id,'customers.manage')) then
      return jsonb_build_object('ok',false,'error','access_denied','message','Você não tem permissão para criar clientes.');
    end if;
  end if;

  v_can_consent := auth.uid() is null
    or public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id,'customers.consent.manage');
  v_can_sensitive := auth.uid() is null
    or public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id,'customers.sensitive.view');

  if (coalesce(p_marketing_consent,false) or coalesce(p_loyalty_opt_in,false)) and not v_can_consent then
    return jsonb_build_object(
      'ok',false,'error','consent_permission_required',
      'message','O cadastro pode ser criado, mas registrar adesão a marketing ou fidelidade exige permissão específica e consentimento explícito do cliente.'
    );
  end if;

  if (nullif(regexp_replace(coalesce(p_cpf,''),'\D','','g'),'') is not null or p_birth_date is not null)
     and not v_can_sensitive then
    return jsonb_build_object(
      'ok',false,'error','sensitive_permission_required',
      'message','CPF e data de nascimento exigem permissão específica para dados sensíveis.'
    );
  end if;

  v_phone := regexp_replace(coalesce(p_phone,''),'\D','','g');
  if length(v_phone)<8 then
    return jsonb_build_object('ok',false,'error','invalid_phone','message','Informe um telefone válido.');
  end if;

  if exists(
    select 1 from public.customers c
    where c.store_id=p_store_id and c.phone=v_phone and c.status<>'deleted_requested'
  ) then
    return jsonb_build_object('ok',false,'error','customer_phone_already_exists','message','Já existe um cliente com este telefone.');
  end if;

  insert into public.customers(
    store_id,full_name,phone,email,cpf,birth_date,is_whatsapp,contact_preference,
    marketing_consent,loyalty_opt_in,tags,internal_notes,source,data_ownership,
    editable_by_store,customer_metadata
  ) values (
    p_store_id,nullif(trim(coalesce(p_full_name,'')),''),v_phone,
    nullif(lower(trim(coalesce(p_email,''))),''),
    nullif(regexp_replace(coalesce(p_cpf,''),'\D','','g'),''),p_birth_date,true,'whatsapp',
    coalesce(p_marketing_consent,false),coalesce(p_loyalty_opt_in,false),coalesce(p_tags,'{}'),p_internal_notes,
    'admin','store_managed',true,
    jsonb_build_object('created_by',auth.uid(),'created_by_source','create_admin_customer_safe','created_at',now())
  ) returning id into v_customer_id;

  if coalesce(p_marketing_consent,false) then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,source,metadata)
    values(v_customer_id,p_store_id,'marketing_whatsapp','granted','admin_recorded',
      jsonb_build_object('recorded_by',auth.uid(),'evidence','explicit_customer_statement','channel','backoffice'));
  end if;

  if coalesce(p_loyalty_opt_in,false) then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,source,metadata)
    values(v_customer_id,p_store_id,'loyalty_program','granted','admin_recorded',
      jsonb_build_object('recorded_by',auth.uid(),'evidence','explicit_customer_statement','channel','backoffice'));
  end if;

  return jsonb_build_object('ok',true,'customer_id',v_customer_id);
end;
$$;

create or replace function public.update_admin_customer_safe(
  p_store_id uuid,
  p_customer_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_email text default null,
  p_cpf text default null,
  p_birth_date date default null,
  p_status text default 'active',
  p_tags text[] default '{}'::text[],
  p_internal_notes text default null,
  p_marketing_consent boolean default null,
  p_loyalty_opt_in boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_customer public.customers%rowtype;
  v_phone text;
  v_can_consent boolean := false;
  v_can_sensitive boolean := false;
  v_marketing_changed boolean := false;
  v_loyalty_changed boolean := false;
  v_next_marketing boolean;
  v_next_loyalty boolean;
  v_next_cpf text;
  v_next_birth_date date;
begin
  if p_store_id is null or p_customer_id is null then
    return jsonb_build_object('ok',false,'error','missing_parameters');
  end if;

  if coalesce(auth.role(),'') in ('anon','authenticated') then
    if auth.uid() is null
       or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id,'customers.manage')) then
      return jsonb_build_object('ok',false,'error','access_denied','message','Você não tem permissão para editar clientes.');
    end if;
  end if;

  select * into v_customer
  from public.customers c
  where c.id=p_customer_id and c.store_id=p_store_id
  for update;

  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;

  if p_status is not null and p_status <> all(array['active','inactive','deleted_requested']) then
    return jsonb_build_object('ok',false,'error','invalid_status');
  end if;

  if coalesce(v_customer.editable_by_store,false)=false or v_customer.data_ownership='customer_owned' then
    update public.customers
    set status=coalesce(p_status,status),
        tags=coalesce(p_tags,tags),
        internal_notes=p_internal_notes,
        customer_metadata=coalesce(customer_metadata,'{}'::jsonb)||jsonb_build_object(
          'last_internal_update_at',now(),
          'last_internal_update_by',auth.uid(),
          'protected_customer_data',true
        ),
        updated_at=now()
    where id=p_customer_id and store_id=p_store_id;

    return jsonb_build_object(
      'ok',true,'customer_id',p_customer_id,'protected_data',true,
      'message','Dados e consentimentos autodeclarados foram preservados. Apenas campos internos foram atualizados.'
    );
  end if;

  v_can_consent := auth.uid() is null
    or public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id,'customers.consent.manage');
  v_can_sensitive := auth.uid() is null
    or public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id,'customers.sensitive.view');

  v_next_marketing := coalesce(p_marketing_consent,v_customer.marketing_consent,false);
  v_next_loyalty := coalesce(p_loyalty_opt_in,v_customer.loyalty_opt_in,false);
  v_marketing_changed := v_next_marketing is distinct from coalesce(v_customer.marketing_consent,false);
  v_loyalty_changed := v_next_loyalty is distinct from coalesce(v_customer.loyalty_opt_in,false);

  if (v_marketing_changed or v_loyalty_changed) and not v_can_consent then
    return jsonb_build_object(
      'ok',false,'error','consent_permission_required',
      'message','Alterar marketing ou fidelidade exige permissão específica e consentimento explícito do cliente.'
    );
  end if;

  v_phone := regexp_replace(coalesce(p_phone,v_customer.phone),'\D','','g');
  if length(v_phone)<8 then return jsonb_build_object('ok',false,'error','invalid_phone'); end if;

  if exists(
    select 1 from public.customers c
    where c.store_id=p_store_id and c.phone=v_phone and c.id<>p_customer_id and c.status<>'deleted_requested'
  ) then
    return jsonb_build_object('ok',false,'error','customer_phone_already_exists','message','Já existe outro cliente com este telefone.');
  end if;

  -- Sem sensitive.view, entradas nulas/vazias do formulário nunca podem apagar
  -- silenciosamente CPF ou data de nascimento já armazenados.
  if v_can_sensitive then
    v_next_cpf := case when p_cpf is null then v_customer.cpf else nullif(regexp_replace(p_cpf,'\D','','g'),'') end;
    v_next_birth_date := coalesce(p_birth_date,v_customer.birth_date);
  else
    v_next_cpf := v_customer.cpf;
    v_next_birth_date := v_customer.birth_date;
  end if;

  update public.customers
  set full_name=nullif(trim(coalesce(p_full_name,full_name)),''),
      phone=v_phone,
      email=case when p_email is null then email else nullif(lower(trim(p_email)),'') end,
      cpf=v_next_cpf,
      birth_date=v_next_birth_date,
      status=coalesce(p_status,status),
      tags=coalesce(p_tags,tags),
      internal_notes=p_internal_notes,
      marketing_consent=v_next_marketing,
      loyalty_opt_in=v_next_loyalty,
      customer_metadata=coalesce(customer_metadata,'{}'::jsonb)||jsonb_build_object(
        'last_admin_update_at',now(),'last_admin_update_by',auth.uid()
      ),
      updated_at=now()
  where id=p_customer_id and store_id=p_store_id;

  if v_marketing_changed then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,source,revoked_at,metadata)
    values(
      p_customer_id,p_store_id,'marketing_whatsapp',case when v_next_marketing then 'granted' else 'revoked' end,
      'admin_recorded',case when v_next_marketing then null else now() end,
      jsonb_build_object('recorded_by',auth.uid(),'evidence','explicit_customer_statement','channel','backoffice','previous',v_customer.marketing_consent,'current',v_next_marketing)
    );
  end if;

  if v_loyalty_changed then
    insert into public.customer_consent_logs(customer_id,store_id,consent_type,action,source,revoked_at,metadata)
    values(
      p_customer_id,p_store_id,'loyalty_program',case when v_next_loyalty then 'granted' else 'revoked' end,
      'admin_recorded',case when v_next_loyalty then null else now() end,
      jsonb_build_object('recorded_by',auth.uid(),'evidence','explicit_customer_statement','channel','backoffice','previous',v_customer.loyalty_opt_in,'current',v_next_loyalty)
    );
  end if;

  return jsonb_build_object('ok',true,'customer_id',p_customer_id,'protected_data',false,'sensitive_data_updated',v_can_sensitive);
end;
$$;

create or replace function public.update_customer_self_profile_safe(
  p_full_name text default null,
  p_nickname text default null,
  p_email text default null,
  p_cpf text default null,
  p_birth_date date default null,
  p_is_whatsapp boolean default true,
  p_contact_preference text default 'whatsapp',
  p_loyalty_opt_in boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_current public.customers%rowtype;
  v_email text := nullif(lower(trim(coalesce(p_email,''))),'');
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf,''),'\D','','g'),'');
  v_next_loyalty boolean;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select * into v_current
  from public.customers
  where id=v_customer_id and store_id=v_store_id
  for update;

  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;
  if v_current.status not in ('active','inactive') then
    return jsonb_build_object('ok',false,'error','customer_not_editable');
  end if;
  if p_contact_preference not in ('whatsapp','sms','both') then
    return jsonb_build_object('ok',false,'error','invalid_contact_preference');
  end if;
  if v_cpf is not null and length(v_cpf)<>11 then
    return jsonb_build_object('ok',false,'error','invalid_cpf');
  end if;

  v_next_loyalty := coalesce(p_loyalty_opt_in,v_current.loyalty_opt_in,false);

  update public.customers set
    full_name=nullif(trim(coalesce(p_full_name,'')),''),
    nickname=nullif(trim(coalesce(p_nickname,'')),''),
    email=v_email,
    cpf=v_cpf,
    birth_date=case when coalesce(birth_date_locked,false) then birth_date else p_birth_date end,
    is_whatsapp=coalesce(p_is_whatsapp,true),
    contact_preference=p_contact_preference,
    loyalty_opt_in=v_next_loyalty,
    data_ownership='customer_owned',
    editable_by_store=false,
    updated_at=now()
  where id=v_customer_id and store_id=v_store_id;

  if p_loyalty_opt_in is not null
     and v_next_loyalty is distinct from coalesce(v_current.loyalty_opt_in,false) then
    insert into public.customer_consent_logs(
      customer_id,store_id,consent_type,action,source,revoked_at,metadata
    ) values (
      v_customer_id,v_store_id,'loyalty_program',
      case when v_next_loyalty then 'granted' else 'revoked' end,
      'customer_portal_profile',
      case when v_next_loyalty then null else now() end,
      jsonb_build_object('evidence','customer_self_service','previous',v_current.loyalty_opt_in,'current',v_next_loyalty)
    );
  end if;

  return jsonb_build_object('ok',true,'customer_id',v_customer_id);
end;
$$;

-- Restaura explicitamente os grants esperados para os RPCs administrativos/self-service alterados.
revoke all on function public.get_admin_customers_safe(uuid,integer) from public,anon;
revoke all on function public.get_customer_360_safe(uuid,uuid) from public,anon;
revoke all on function public.create_admin_customer_safe(uuid,text,text,text,text,date,text[],text,boolean,boolean) from public,anon;
revoke all on function public.update_admin_customer_safe(uuid,uuid,text,text,text,text,date,text,text[],text,boolean,boolean) from public,anon;
grant execute on function public.get_admin_customers_safe(uuid,integer) to authenticated,service_role;
grant execute on function public.get_customer_360_safe(uuid,uuid) to authenticated,service_role;
grant execute on function public.create_admin_customer_safe(uuid,text,text,text,text,date,text[],text,boolean,boolean) to authenticated,service_role;
grant execute on function public.update_admin_customer_safe(uuid,uuid,text,text,text,text,date,text,text[],text,boolean,boolean) to authenticated,service_role;

-- Self-service permanece acessível ao papel anon porque o JWT próprio do cliente usa
-- contexto de customer_id/store_id e o corpo exige app_current_role()='customer'.
-- Essa exposição é intencional e será reavaliada quando a emissão segura de JWT for reativada.
revoke all on function public.update_customer_self_profile_safe(text,text,text,text,date,boolean,text,boolean) from public;
grant execute on function public.update_customer_self_profile_safe(text,text,text,text,date,boolean,text,boolean) to anon,authenticated,service_role;
