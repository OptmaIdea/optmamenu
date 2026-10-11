-- Online payments foundation: provider abstraction, permissions and disposable sandbox lab.

insert into public.security_permission_catalog (
  code,module,action,label,description,risk_level,active,sort_order,
  macro_group,group_key,group_label,item_key,item_label,action_key,action_label,
  depends_on,access_permission_key,default_role_allowed,ui_sort_order,show_in_permission_ui,updated_at
)
values
('payments.online.view','payments_online','view','Ver pagamentos online','Permite acessar a área de pagamentos online, provedores e estado das integrações.','medium',true,3530,'operational','financial','Financeiro','online_payments','Pagamentos online','view','Ver','financial.view','financial.view','{"owner":true,"admin":true,"manager":true,"cashier":true}',3530,true,now()),
('payments.online.manage','payments_online','manage','Gerenciar pagamentos online','Permite configurar comportamento não secreto dos provedores e do ambiente de pagamentos online.','high',true,3531,'operational','financial','Financeiro','online_payments','Pagamentos online','manage','Gerenciar','payments.online.view','financial.view','{"owner":true,"admin":true}',3531,true,now()),
('payments.online.credentials.manage','payments_online','credentials_manage','Gerenciar credenciais de pagamentos','Permite configurar ou substituir credenciais secretas de provedores de pagamento.','critical',true,3532,'operational','financial','Financeiro','online_payments','Pagamentos online','credentials_manage','Credenciais','payments.online.manage','payments.online.view','{"owner":true}',3532,true,now()),
('payments.online.proofs.review','payments_online','proofs_review','Revisar comprovantes','Permite aprovar ou rejeitar comprovantes manuais de pagamento.','high',true,3533,'operational','financial','Financeiro','online_payments','Pagamentos online','proofs_review','Comprovantes','payments.online.view','payments.online.view','{"owner":true,"admin":true,"manager":true,"cashier":true}',3533,true,now()),
('payments.online.transactions.view','payments_online','transactions_view','Ver transações online','Permite visualizar transações online e vínculos com pedidos.','medium',true,3534,'operational','financial','Financeiro','online_payments','Pagamentos online','transactions_view','Transações','payments.online.view','payments.online.view','{"owner":true,"admin":true,"manager":true,"cashier":true}',3534,true,now()),
('payments.online.refund','payments_online','refund','Estornar pagamento online','Permite solicitar ou registrar estornos de pagamentos online.','critical',true,3535,'operational','financial','Financeiro','online_payments','Pagamentos online','refund','Estornar','payments.online.transactions.view','payments.online.view','{"owner":true,"admin":true}',3535,true,now()),
('payments.online.events.view','payments_online','events_view','Ver eventos e webhooks','Permite visualizar eventos técnicos e webhooks de provedores de pagamento.','high',true,3536,'operational','financial','Financeiro','online_payments','Pagamentos online','events_view','Eventos/Webhooks','payments.online.view','payments.online.view','{"owner":true,"admin":true,"manager":true}',3536,true,now())
on conflict (code) do update set
  module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,
  risk_level=excluded.risk_level,active=true,macro_group=excluded.macro_group,group_key=excluded.group_key,
  group_label=excluded.group_label,item_key=excluded.item_key,item_label=excluded.item_label,
  action_key=excluded.action_key,action_label=excluded.action_label,depends_on=excluded.depends_on,
  access_permission_key=excluded.access_permission_key,default_role_allowed=excluded.default_role_allowed,
  ui_sort_order=excluded.ui_sort_order,show_in_permission_ui=true,updated_at=now();

insert into public.store_permission_catalog (
  permission_key,category,label,description,risk,active,sort_order,
  macro_group,group_key,group_label,item_key,item_label,action_key,action_label,
  depends_on,access_permission_key,default_role_allowed,ui_sort_order,show_in_permission_ui,updated_at
)
select code,'financial',label,description,risk_level,active,sort_order,
       macro_group,group_key,group_label,item_key,item_label,action_key,action_label,
       depends_on,access_permission_key,default_role_allowed,ui_sort_order,show_in_permission_ui,now()
from public.security_permission_catalog
where code like 'payments.online.%'
on conflict (permission_key) do update set
  category=excluded.category,label=excluded.label,description=excluded.description,risk=excluded.risk,
  active=true,sort_order=excluded.sort_order,macro_group=excluded.macro_group,group_key=excluded.group_key,
  group_label=excluded.group_label,item_key=excluded.item_key,item_label=excluded.item_label,
  action_key=excluded.action_key,action_label=excluded.action_label,depends_on=excluded.depends_on,
  access_permission_key=excluded.access_permission_key,default_role_allowed=excluded.default_role_allowed,
  ui_sort_order=excluded.ui_sort_order,show_in_permission_ui=true,updated_at=now();

insert into public.store_role_permission_templates (store_id,role,permission_code,allowed,source,metadata,created_at,updated_at)
select s.id,r.role,p.code,
       coalesce((p.default_role_allowed->>r.role)::boolean,false),
       'migration',jsonb_build_object('source','online_payments_foundation'),now(),now()
from public.stores s
cross join (values ('owner'),('admin'),('manager'),('stock_operator'),('cashier'),('sales'),('viewer'),('staff')) r(role)
cross join public.security_permission_catalog p
where p.code like 'payments.online.%'
on conflict (store_id,role,permission_code) do nothing;

create table if not exists public.store_online_payment_providers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider_code text not null check (provider_code in ('optma_sandbox','asaas')),
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  display_name text not null,
  enabled boolean not null default false,
  is_default boolean not null default false,
  credential_status text not null default 'not_configured' check (credential_status in ('not_required','not_configured','configured','invalid','ready')),
  capabilities jsonb not null default '{}'::jsonb,
  public_config jsonb not null default '{}'::jsonb,
  secret_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,provider_code,environment)
);

create table if not exists public.online_payment_intents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  provider_id uuid not null references public.store_online_payment_providers(id) on delete restrict,
  public_token text not null unique default encode(gen_random_bytes(24),'hex'),
  method_code text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'BRL',
  status text not null default 'pending' check (status in ('created','pending','authorized','paid','failed','expired','cancelled','partially_refunded','refunded')),
  external_customer_id text,
  external_payment_id text,
  external_reference text,
  checkout_url text,
  pix_payload text,
  pix_qr_code_url text,
  provider_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,provider_id,external_payment_id)
);

create table if not exists public.online_payment_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider_id uuid not null references public.store_online_payment_providers(id) on delete cascade,
  intent_id uuid references public.online_payment_intents(id) on delete set null,
  external_event_id text,
  event_type text not null,
  event_status text,
  signature_valid boolean,
  processed boolean not null default false,
  idempotency_key text not null,
  payload_sanitized jsonb not null default '{}'::jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(store_id,provider_id,idempotency_key)
);

create table if not exists public.online_payment_refunds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  intent_id uuid not null references public.online_payment_intents(id) on delete restrict,
  provider_id uuid not null references public.store_online_payment_providers(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'requested' check (status in ('requested','processing','paid','failed','cancelled')),
  reason text,
  external_refund_id text,
  metadata jsonb not null default '{}'::jsonb,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_online_payment_intents_store_created on public.online_payment_intents(store_id,created_at desc);
create index if not exists idx_online_payment_intents_order on public.online_payment_intents(store_id,order_id);
create index if not exists idx_online_payment_events_store_received on public.online_payment_events(store_id,received_at desc);
create index if not exists idx_online_payment_events_intent on public.online_payment_events(intent_id,received_at desc);
create index if not exists idx_online_payment_refunds_intent on public.online_payment_refunds(intent_id,requested_at desc);

alter table public.store_online_payment_providers enable row level security;
alter table public.online_payment_intents enable row level security;
alter table public.online_payment_events enable row level security;
alter table public.online_payment_refunds enable row level security;

revoke all on public.store_online_payment_providers from anon, authenticated;
revoke all on public.online_payment_intents from anon, authenticated;
revoke all on public.online_payment_events from anon, authenticated;
revoke all on public.online_payment_refunds from anon, authenticated;
grant all on public.store_online_payment_providers to service_role;
grant all on public.online_payment_intents to service_role;
grant all on public.online_payment_events to service_role;
grant all on public.online_payment_refunds to service_role;

create or replace function public.get_online_payments_workspace_safe(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_can_view boolean := false;
  v_can_manage boolean := false;
  v_can_credentials boolean := false;
  v_can_proofs boolean := false;
  v_can_refund boolean := false;
  v_can_events boolean := false;
  v_providers jsonb := '[]'::jsonb;
  v_intents jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  v_can_view := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.view');
  if not v_can_view then return jsonb_build_object('ok',false,'error','access_denied'); end if;

  v_can_manage := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.manage');
  v_can_credentials := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.credentials.manage');
  v_can_proofs := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.proofs.review');
  v_can_refund := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.refund');
  v_can_events := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.events.view');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'provider_code',p.provider_code,'environment',p.environment,'display_name',p.display_name,
    'enabled',p.enabled,'is_default',p.is_default,'credential_status',p.credential_status,
    'capabilities',p.capabilities,'public_config',p.public_config,'metadata',p.metadata,
    'created_at',p.created_at,'updated_at',p.updated_at
  ) order by p.provider_code,p.environment),'[]'::jsonb)
  into v_providers
  from public.store_online_payment_providers p where p.store_id=p_store_id;

  select coalesce(jsonb_agg(x.row),'[]'::jsonb) into v_intents from (
    select jsonb_build_object(
      'id',i.id,'order_id',i.order_id,'provider_id',i.provider_id,'provider_code',p.provider_code,
      'provider_name',p.display_name,'environment',p.environment,'method_code',i.method_code,'amount',i.amount,
      'currency',i.currency,'status',i.status,'external_payment_id',i.external_payment_id,
      'external_reference',i.external_reference,'checkout_url',i.checkout_url,'expires_at',i.expires_at,
      'paid_at',i.paid_at,'created_at',i.created_at,'metadata',i.metadata
    ) as row
    from public.online_payment_intents i
    join public.store_online_payment_providers p on p.id=i.provider_id
    where i.store_id=p_store_id
    order by i.created_at desc
    limit 50
  ) x;

  if v_can_events then
    select coalesce(jsonb_agg(x.row),'[]'::jsonb) into v_events from (
      select jsonb_build_object(
        'id',e.id,'intent_id',e.intent_id,'provider_id',e.provider_id,'provider_code',p.provider_code,
        'event_type',e.event_type,'event_status',e.event_status,'signature_valid',e.signature_valid,
        'processed',e.processed,'external_event_id',e.external_event_id,'idempotency_key',e.idempotency_key,
        'error_message',e.error_message,'received_at',e.received_at,'processed_at',e.processed_at
      ) as row
      from public.online_payment_events e
      join public.store_online_payment_providers p on p.id=e.provider_id
      where e.store_id=p_store_id
      order by e.received_at desc
      limit 100
    ) x;
  end if;

  return jsonb_build_object(
    'ok',true,
    'permissions',jsonb_build_object('view',v_can_view,'manage',v_can_manage,'credentials',v_can_credentials,'proofs',v_can_proofs,'refund',v_can_refund,'events',v_can_events),
    'providers',v_providers,'transactions',v_intents,'events',v_events,
    'counts',jsonb_build_object(
      'pending',(select count(*) from public.online_payment_intents where store_id=p_store_id and status in ('created','pending','authorized')),
      'paid',(select count(*) from public.online_payment_intents where store_id=p_store_id and status='paid'),
      'failed',(select count(*) from public.online_payment_intents where store_id=p_store_id and status in ('failed','expired','cancelled'))
    )
  );
end;
$function$;

create or replace function public.save_online_payment_provider_safe(
  p_store_id uuid,
  p_provider_code text,
  p_environment text,
  p_enabled boolean,
  p_is_default boolean default false,
  p_public_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_row public.store_online_payment_providers%rowtype;
  v_display_name text;
  v_capabilities jsonb;
  v_credential_status text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.manage')) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if p_provider_code not in ('optma_sandbox','asaas') then return jsonb_build_object('ok',false,'error','invalid_provider'); end if;
  if p_environment not in ('sandbox','production') then return jsonb_build_object('ok',false,'error','invalid_environment'); end if;
  if p_provider_code='optma_sandbox' and p_environment<>'sandbox' then return jsonb_build_object('ok',false,'error','sandbox_only_provider'); end if;

  v_display_name := case when p_provider_code='optma_sandbox' then 'OptmaPay Sandbox' else 'Asaas' end;
  v_capabilities := case when p_provider_code='optma_sandbox' then
    jsonb_build_object('pix',true,'credit_card',true,'payment_link',true,'webhooks',true,'refunds',true,'test_scenarios',true)
  else jsonb_build_object('pix',true,'credit_card',true,'payment_link',true,'webhooks',true,'refunds',true,'test_scenarios',p_environment='sandbox') end;
  v_credential_status := case when p_provider_code='optma_sandbox' then 'not_required' else 'not_configured' end;

  if p_is_default then
    update public.store_online_payment_providers set is_default=false,updated_at=now()
    where store_id=p_store_id and environment=p_environment;
  end if;

  insert into public.store_online_payment_providers(
    store_id,provider_code,environment,display_name,enabled,is_default,credential_status,capabilities,public_config,metadata,updated_at
  ) values (
    p_store_id,p_provider_code,p_environment,v_display_name,coalesce(p_enabled,false),coalesce(p_is_default,false),v_credential_status,
    v_capabilities,coalesce(p_public_config,'{}'::jsonb),jsonb_build_object('configured_from','admin_online_payments'),now()
  )
  on conflict (store_id,provider_code,environment) do update set
    enabled=excluded.enabled,is_default=excluded.is_default,capabilities=excluded.capabilities,
    public_config=excluded.public_config,updated_at=now()
  returning * into v_row;

  return jsonb_build_object('ok',true,'provider',jsonb_build_object(
    'id',v_row.id,'provider_code',v_row.provider_code,'environment',v_row.environment,'display_name',v_row.display_name,
    'enabled',v_row.enabled,'is_default',v_row.is_default,'credential_status',v_row.credential_status,
    'capabilities',v_row.capabilities,'public_config',v_row.public_config
  ));
end;
$function$;

create or replace function public.mark_online_payment_provider_credential_status_internal(
  p_store_id uuid,p_provider_code text,p_environment text,p_status text,p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if p_status not in ('not_configured','configured','invalid','ready') then raise exception 'invalid credential status'; end if;
  update public.store_online_payment_providers
  set credential_status=p_status,metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb),updated_at=now()
  where store_id=p_store_id and provider_code=p_provider_code and environment=p_environment;
end;
$function$;

create or replace function public.create_optma_sandbox_payment_intent_safe(
  p_store_id uuid,p_order_id uuid,p_method_code text,p_amount numeric,p_scenario text default 'pending',p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_provider public.store_online_payment_providers%rowtype;
  v_intent public.online_payment_intents%rowtype;
  v_status text := 'pending';
  v_event_type text := 'payment.pending';
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.manage')) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if p_amount is null or p_amount<=0 then return jsonb_build_object('ok',false,'error','invalid_amount'); end if;
  if p_scenario not in ('pending','approved','declined','expired') then return jsonb_build_object('ok',false,'error','invalid_scenario'); end if;

  insert into public.store_online_payment_providers(store_id,provider_code,environment,display_name,enabled,is_default,credential_status,capabilities,public_config,metadata)
  values (p_store_id,'optma_sandbox','sandbox','OptmaPay Sandbox',true,false,'not_required',
    jsonb_build_object('pix',true,'credit_card',true,'payment_link',true,'webhooks',true,'refunds',true,'test_scenarios',true),
    '{}'::jsonb,jsonb_build_object('created_from','sandbox_lab'))
  on conflict (store_id,provider_code,environment) do update set enabled=true,updated_at=now()
  returning * into v_provider;

  if p_scenario='approved' then v_status:='paid'; v_event_type:='payment.paid';
  elsif p_scenario='declined' then v_status:='failed'; v_event_type:='payment.failed';
  elsif p_scenario='expired' then v_status:='expired'; v_event_type:='payment.expired'; end if;

  insert into public.online_payment_intents(
    store_id,order_id,provider_id,method_code,amount,status,external_payment_id,external_reference,
    provider_snapshot,metadata,paid_at,created_by
  ) values (
    p_store_id,p_order_id,v_provider.id,coalesce(nullif(trim(p_method_code),''),'pix'),round(p_amount,2),v_status,
    'sbx_'||replace(gen_random_uuid()::text,'-',''),coalesce(p_order_id::text,'sandbox_lab'),
    jsonb_build_object('provider','optma_sandbox','scenario',p_scenario),
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('sandbox',true,'scenario',p_scenario),
    case when v_status='paid' then now() else null end,auth.uid()
  ) returning * into v_intent;

  insert into public.online_payment_events(
    store_id,provider_id,intent_id,external_event_id,event_type,event_status,signature_valid,processed,idempotency_key,payload_sanitized,processed_at
  ) values (
    p_store_id,v_provider.id,v_intent.id,'evt_'||replace(gen_random_uuid()::text,'-',''),v_event_type,v_status,true,true,
    'sbx:'||v_intent.id::text||':'||v_event_type||':'||extract(epoch from clock_timestamp())::bigint,
    jsonb_build_object('sandbox',true,'scenario',p_scenario,'status',v_status),now()
  );

  return jsonb_build_object('ok',true,'intent',jsonb_build_object(
    'id',v_intent.id,'provider_id',v_provider.id,'provider_code','optma_sandbox','method_code',v_intent.method_code,
    'amount',v_intent.amount,'status',v_intent.status,'external_payment_id',v_intent.external_payment_id,'created_at',v_intent.created_at
  ));
end;
$function$;

create or replace function public.simulate_optma_sandbox_payment_safe(p_store_id uuid,p_intent_id uuid,p_action text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_intent public.online_payment_intents%rowtype;
  v_provider public.store_online_payment_providers%rowtype;
  v_new_status text;
  v_event_type text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.manage')) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  select * into v_intent from public.online_payment_intents where id=p_intent_id and store_id=p_store_id for update;
  if v_intent.id is null then return jsonb_build_object('ok',false,'error','intent_not_found'); end if;
  select * into v_provider from public.store_online_payment_providers where id=v_intent.provider_id and provider_code='optma_sandbox';
  if v_provider.id is null then return jsonb_build_object('ok',false,'error','not_sandbox_intent'); end if;

  if p_action='approve' then v_new_status:='paid'; v_event_type:='payment.paid';
  elsif p_action='decline' then v_new_status:='failed'; v_event_type:='payment.failed';
  elsif p_action='expire' then v_new_status:='expired'; v_event_type:='payment.expired';
  elsif p_action='cancel' then v_new_status:='cancelled'; v_event_type:='payment.cancelled';
  elsif p_action='refund' then
    if v_intent.status<>'paid' then return jsonb_build_object('ok',false,'error','refund_requires_paid_intent'); end if;
    v_new_status:='refunded'; v_event_type:='payment.refunded';
    insert into public.online_payment_refunds(store_id,intent_id,provider_id,amount,status,reason,external_refund_id,metadata,requested_by,completed_at)
    values (p_store_id,v_intent.id,v_provider.id,v_intent.amount,'paid','Estorno simulado no laboratório','rf_sbx_'||replace(gen_random_uuid()::text,'-',''),jsonb_build_object('sandbox',true),auth.uid(),now());
  else return jsonb_build_object('ok',false,'error','invalid_action'); end if;

  update public.online_payment_intents set status=v_new_status,paid_at=case when v_new_status='paid' then coalesce(paid_at,now()) else paid_at end,updated_at=now() where id=v_intent.id;
  insert into public.online_payment_events(store_id,provider_id,intent_id,external_event_id,event_type,event_status,signature_valid,processed,idempotency_key,payload_sanitized,processed_at)
  values (p_store_id,v_provider.id,v_intent.id,'evt_'||replace(gen_random_uuid()::text,'-',''),v_event_type,v_new_status,true,true,
    'sbx:'||v_intent.id::text||':'||v_event_type||':'||extract(epoch from clock_timestamp())::bigint,
    jsonb_build_object('sandbox',true,'action',p_action,'status',v_new_status),now());

  return jsonb_build_object('ok',true,'intent_id',v_intent.id,'status',v_new_status,'event_type',v_event_type);
end;
$function$;

revoke all on function public.get_online_payments_workspace_safe(uuid) from public;
revoke all on function public.save_online_payment_provider_safe(uuid,text,text,boolean,boolean,jsonb) from public;
revoke all on function public.create_optma_sandbox_payment_intent_safe(uuid,uuid,text,numeric,text,jsonb) from public;
revoke all on function public.simulate_optma_sandbox_payment_safe(uuid,uuid,text) from public;
revoke all on function public.mark_online_payment_provider_credential_status_internal(uuid,text,text,text,jsonb) from public;

grant execute on function public.get_online_payments_workspace_safe(uuid) to authenticated, service_role;
grant execute on function public.save_online_payment_provider_safe(uuid,text,text,boolean,boolean,jsonb) to authenticated, service_role;
grant execute on function public.create_optma_sandbox_payment_intent_safe(uuid,uuid,text,numeric,text,jsonb) to authenticated, service_role;
grant execute on function public.simulate_optma_sandbox_payment_safe(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.mark_online_payment_provider_credential_status_internal(uuid,text,text,text,jsonb) to service_role;
