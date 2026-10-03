-- OptmaMenu ↔ OptmaPay — cartões: recebíveis, taxas e liquidação.
-- Aplicada no Supabase em 2026-10-03 como migration 20261003174317.
-- Mantém PIX intacto e separa pagamento comercial de liquidação bancária.

insert into public.cashbook_account_plan (
  code, display_code, parent_code, level, path, name, kind, description,
  is_group, is_postable, nature, analysis_enabled,
  affects_cash_drawer, affects_financial_result, is_transfer, active, sort_order, metadata
) values (
  'payment_processing_fees','2.6.2','grp_expense_financial',3,'2.6.2',
  'Taxas de meios de pagamento','expense',
  'MDR, adquirência e demais taxas incidentes sobre recebimentos digitais.',
  false,true,'debit',true,false,true,false,true,2620,
  jsonb_build_object('system',true,'source','optmapay_card_receivables_foundation')
)
on conflict (code) do update
set name=excluded.name, description=excluded.description, active=true, updated_at=now();

create table if not exists public.online_payment_receivables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider_id uuid not null references public.store_online_payment_providers(id) on delete restrict,
  intent_id uuid not null references public.online_payment_intents(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  payment_method_code text not null,
  card_type text not null check (card_type in ('debit','credit')),
  installments integer not null default 1 check (installments between 1 and 12),
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  fee_amount numeric(14,2) not null default 0 check (fee_amount >= 0),
  anticipation_fee_amount numeric(14,2) not null default 0 check (anticipation_fee_amount >= 0),
  net_amount numeric(14,2) not null check (net_amount >= 0),
  settlement_plan text not null default 'standard',
  expected_settlement_at timestamptz,
  settled_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('receivable','scheduled','settled','cancelled','refunded','chargeback')),
  provider_transaction_id text,
  authorization_code text,
  card_brand text,
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  sale_cashbook_entry_id uuid references public.cashbook_entries(id) on delete set null,
  fee_cashbook_entry_id uuid references public.cashbook_entries(id) on delete set null,
  settlement_cashbook_entry_id uuid references public.cashbook_entries(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intent_id)
);

create index if not exists idx_online_payment_receivables_store_status
  on public.online_payment_receivables(store_id,status,expected_settlement_at);
create index if not exists idx_online_payment_receivables_order
  on public.online_payment_receivables(order_id);
create index if not exists idx_online_payment_receivables_provider_tx
  on public.online_payment_receivables(provider_id,provider_transaction_id)
  where provider_transaction_id is not null;

alter table public.online_payment_receivables enable row level security;
revoke all on table public.online_payment_receivables from public, anon, authenticated;
grant all on table public.online_payment_receivables to service_role;

insert into public.store_financial_accounts (
  store_id,code,name,account_type,description,active,is_default,sort_order,metadata
)
select p.store_id,'optmapay_receivable','Valores a receber — OptmaPay','card_receivable',
       'Recebíveis de cartão autorizados/confirmados ainda não liquidados pelo OptmaPay.',
       true,false,85,jsonb_build_object('provider_code','optma_sandbox','system',true)
from public.store_online_payment_providers p
where p.provider_code='optma_sandbox' and p.environment='sandbox'
on conflict (store_id,code) do update
set name=excluded.name, account_type=excluded.account_type, description=excluded.description,
    active=true, updated_at=now();

update public.store_online_payment_providers p
set public_config=coalesce(p.public_config,'{}'::jsonb)||jsonb_build_object(
      'receivable_financial_account_id',
      (select a.id from public.store_financial_accounts a
       where a.store_id=p.store_id and a.code='optmapay_receivable' limit 1)
    ),
    capabilities=coalesce(p.capabilities,'{}'::jsonb)||jsonb_build_object(
      'debit_card',true,'credit_card',true,'installments',true,
      'receivables',true,'settlement_events',true
    ),
    updated_at=now()
where p.provider_code='optma_sandbox' and p.environment='sandbox';

insert into public.store_financial_account_payment_methods(
  store_id,account_id,payment_method_code,active,metadata
)
select a.store_id,a.id,pm.code,true,
       jsonb_build_object('provider_code','optma_sandbox','purpose','receivable')
from public.store_financial_accounts a
join public.store_payment_methods pm
  on pm.store_id=a.store_id and pm.base_code in ('debit_card','credit_card')
where a.code='optmapay_receivable'
on conflict (account_id,payment_method_code) do update
set active=true, updated_at=now(),
    metadata=coalesce(public.store_financial_account_payment_methods.metadata,'{}'::jsonb)||excluded.metadata;


CREATE OR REPLACE FUNCTION public.apply_online_card_payment_confirmed_internal(p_intent_id uuid, p_provider_event_id text DEFAULT NULL::text, p_provider_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_role text;
  v_intent public.online_payment_intents%rowtype;
  v_provider public.store_online_payment_providers%rowtype;
  v_order public.orders%rowtype;
  v_method public.store_payment_methods%rowtype;
  v_base_code text;
  v_receivable_account_id uuid;
  v_sale_entry_id uuid;
  v_fee_entry_id uuid;
  v_receivable_id uuid;
  v_paid_at timestamptz;
  v_gross numeric;
  v_fee numeric;
  v_anticipation_fee numeric;
  v_net numeric;
  v_installments integer;
  v_plan text;
  v_card_type text;
  v_brand text;
  v_last4 text;
  v_masked text;
  v_provider_tx text;
  v_auth_code text;
  v_expected_settlement_at timestamptz;
  v_settlement jsonb := null;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(auth.role(),''),
    current_user
  );
  if v_role not in ('service_role','postgres','supabase_admin') then
    return jsonb_build_object('ok',false,'error','service_role_required');
  end if;

  select * into v_intent
  from public.online_payment_intents
  where id=p_intent_id
  for update;

  if v_intent.id is null then return jsonb_build_object('ok',false,'error','payment_intent_not_found'); end if;
  if v_intent.status<>'paid' then
    return jsonb_build_object('ok',false,'error','payment_not_confirmed','status',v_intent.status);
  end if;
  if v_intent.order_id is null then return jsonb_build_object('ok',true,'skipped',true,'reason','intent_without_order'); end if;

  select * into v_provider from public.store_online_payment_providers
  where id=v_intent.provider_id and store_id=v_intent.store_id
  for update;
  if v_provider.id is null or not v_provider.enabled then
    return jsonb_build_object('ok',false,'error','payment_provider_inactive');
  end if;

  select * into v_order from public.orders
  where id=v_intent.order_id and store_id=v_intent.store_id
  for update;
  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
  if v_order.status::text='cancelled' then return jsonb_build_object('ok',false,'error','order_cancelled'); end if;
  if abs(coalesce(v_order.total,0)-coalesce(v_intent.amount,0))>0.01 then
    return jsonb_build_object('ok',false,'error','payment_amount_mismatch');
  end if;

  select * into v_method from public.store_payment_methods
  where store_id=v_intent.store_id and code=v_intent.method_code and active=true limit 1;
  if v_method.id is null then return jsonb_build_object('ok',false,'error','payment_method_not_available'); end if;
  v_base_code := coalesce(nullif(v_method.base_code,''),v_method.code);
  if v_base_code not in ('debit_card','credit_card') then
    return jsonb_build_object('ok',false,'error','payment_method_not_card');
  end if;

  select id into v_receivable_account_id
  from public.store_financial_accounts
  where store_id=v_intent.store_id and code='optmapay_receivable' and active=true
  limit 1;
  if v_receivable_account_id is null then
    return jsonb_build_object('ok',false,'error','receivable_account_required');
  end if;

  v_paid_at := coalesce(v_intent.paid_at,now());
  v_gross := round(coalesce(
    nullif(p_provider_data->>'amountGross','')::numeric,
    nullif(p_provider_data->>'grossAmount','')::numeric,
    nullif(p_provider_data->>'amount_gross','')::numeric,
    v_intent.amount
  ),2);
  v_fee := round(coalesce(
    nullif(p_provider_data->>'feeAmount','')::numeric,
    nullif(p_provider_data->>'fee_amount','')::numeric,
    0
  ),2);
  v_anticipation_fee := round(coalesce(
    nullif(p_provider_data->>'anticipationFeeAmount','')::numeric,
    nullif(p_provider_data->>'anticipation_fee_amount','')::numeric,
    0
  ),2);
  v_net := round(coalesce(
    nullif(p_provider_data->>'amountNet','')::numeric,
    nullif(p_provider_data->>'netAmount','')::numeric,
    nullif(p_provider_data->>'amount_net','')::numeric,
    v_gross-v_fee-v_anticipation_fee
  ),2);

  if v_gross<=0 or v_fee<0 or v_anticipation_fee<0 or v_net<0
     or abs((v_gross-v_fee-v_anticipation_fee)-v_net)>0.01
  then
    return jsonb_build_object('ok',false,'error','invalid_receivable_math');
  end if;

  v_installments := greatest(1,least(12,coalesce(
    nullif(p_provider_data->>'installments','')::integer,
    nullif(v_intent.metadata->>'installments','')::integer,
    1
  )));
  if v_base_code='debit_card' and v_installments<>1 then
    return jsonb_build_object('ok',false,'error','invalid_debit_installments');
  end if;

  v_plan := coalesce(
    nullif(p_provider_data->>'settlementPlan',''),
    nullif(p_provider_data->>'settlement_plan',''),
    nullif(p_provider_data->>'plan',''),
    nullif(v_intent.metadata->>'settlement_plan',''),
    'standard'
  );
  v_card_type := case when v_base_code='debit_card' then 'debit' else 'credit' end;
  v_brand := nullif(coalesce(p_provider_data->>'cardBrand',p_provider_data->>'card_brand'),'');
  v_masked := coalesce(p_provider_data->>'cardMasked',p_provider_data->>'card_masked','');
  v_last4 := nullif(right(regexp_replace(v_masked,'[^0-9]','','g'),4),'');
  if v_last4 is not null and length(v_last4)<>4 then v_last4:=null; end if;
  v_provider_tx := nullif(coalesce(
    p_provider_data->>'transactionId',
    p_provider_data->>'transaction_id',
    v_intent.external_payment_id
  ),'');
  v_auth_code := nullif(coalesce(
    p_provider_data->>'authorizationCode',
    p_provider_data->>'authorization_code'
  ),'');

  begin
    v_expected_settlement_at := nullif(coalesce(
      p_provider_data->>'expectedSettlementAt',
      p_provider_data->>'expected_settlement_at'
    ),'')::timestamptz;
  exception when others then
    v_expected_settlement_at := null;
  end;
  if lower(v_plan) in ('ontime','nitro') and v_expected_settlement_at is null then
    v_expected_settlement_at := v_paid_at;
  end if;

  update public.orders
  set payment_status='paid',
      payment_method='card'::public.payment_method,
      payment_method_code=v_method.code,
      expires_at=null,available_until=null,cancellation_grace_until=null,
      payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
        'code',v_method.code,'name',v_method.name,'base_code',v_base_code,'status','paid',
        'confirmed_at',v_paid_at,'confirmation_mode','api',
        'provider_code',v_provider.provider_code,'provider_environment',v_provider.environment,
        'online_payment_intent_id',v_intent.id,'provider_event_id',p_provider_event_id,
        'card_type',v_card_type,'card_brand',v_brand,'card_last4',v_last4,
        'installments',v_installments,'settlement_plan',v_plan
      ),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'online_payment_received_at',v_paid_at,
        'online_payment_intent_id',v_intent.id,
        'online_payment_provider',v_provider.provider_code,
        'reservation_timer_suspended_at',v_paid_at,
        'reservation_timer_suspension_reason','payment_confirmed'
      ),
      commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)||jsonb_build_object(
        'timer_suspended_at',v_paid_at,'timer_suspended_reason','payment_confirmed'
      ),
      updated_at=now()
  where id=v_order.id and store_id=v_order.store_id;

  update public.stock_reservations sr
  set expires_at='infinity'::timestamptz,
      metadata=coalesce(sr.metadata,'{}'::jsonb)||jsonb_build_object(
        'timer_suspended_at',v_paid_at,'timer_suspended_reason','payment_confirmed',
        'payment_status','paid','online_payment_intent_id',v_intent.id,
        'provider_event_id',p_provider_event_id
      )
  where sr.order_id=v_order.id and sr.store_id=v_order.store_id and sr.status='active';

  select id into v_sale_entry_id
  from public.cashbook_entries
  where store_id=v_order.store_id and order_id=v_order.id
    and type='sale' and status<>'cancelled'
  order by created_at desc limit 1
  for update;

  if v_sale_entry_id is null then
    insert into public.cashbook_entries(
      store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,
      payment_method,payment_method_code,source,source_id,order_id,customer_id,status,
      affects_balance,account_plan_code,destination_financial_account_id,
      affects_cash_drawer,affects_financial_result,metadata,created_by
    ) values (
      v_order.store_id,public.generate_cashbook_entry_code(),
      (v_paid_at at time zone 'America/Sao_Paulo')::date,v_paid_at,
      'sale','in',v_gross,'Venda com cartão — pedido '||v_order.order_code,
      v_method.name,v_method.code,'order',v_order.id,v_order.id,v_order.customer_id,'confirmed',
      true,case when v_base_code='debit_card' then 'sale_debit' else 'sale_credit' end,
      v_receivable_account_id,false,true,
      jsonb_build_object(
        'order_code',v_order.order_code,'online_payment_intent_id',v_intent.id,
        'online_payment_receivable',true,'provider_code',v_provider.provider_code,
        'provider_event_id',p_provider_event_id,'gross_amount',v_gross,
        'fee_amount',v_fee,'net_amount',v_net,'settlement_plan',v_plan
      ),null
    ) returning id into v_sale_entry_id;
  else
    update public.cashbook_entries
    set entry_date=(v_paid_at at time zone 'America/Sao_Paulo')::date,
        occurred_at=v_paid_at,amount=v_gross,payment_method=v_method.name,
        payment_method_code=v_method.code,status='confirmed',affects_balance=true,
        account_plan_code=case when v_base_code='debit_card' then 'sale_debit' else 'sale_credit' end,
        destination_financial_account_id=v_receivable_account_id,
        source_financial_account_id=null,is_transfer=false,
        affects_cash_drawer=false,affects_financial_result=true,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'online_payment_intent_id',v_intent.id,'online_payment_receivable',true,
          'provider_code',v_provider.provider_code,'provider_event_id',p_provider_event_id,
          'gross_amount',v_gross,'fee_amount',v_fee,'net_amount',v_net,'settlement_plan',v_plan
        ),updated_at=now()
    where id=v_sale_entry_id;
  end if;

  if v_fee+v_anticipation_fee>0 then
    select id into v_fee_entry_id
    from public.cashbook_entries
    where store_id=v_order.store_id and order_id=v_order.id
      and type='manual_expense'
      and account_plan_code='payment_processing_fees'
      and metadata->>'online_payment_intent_id'=v_intent.id::text
      and status<>'cancelled'
    order by created_at desc limit 1
    for update;

    if v_fee_entry_id is null then
      insert into public.cashbook_entries(
        store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,
        payment_method,payment_method_code,source,source_id,order_id,customer_id,status,
        affects_balance,account_plan_code,source_financial_account_id,
        affects_cash_drawer,affects_financial_result,metadata,created_by
      ) values (
        v_order.store_id,public.generate_cashbook_entry_code(),
        (v_paid_at at time zone 'America/Sao_Paulo')::date,v_paid_at,
        'manual_expense','out',v_fee+v_anticipation_fee,
        'Taxa OptmaPay — pedido '||v_order.order_code,
        v_method.name,v_method.code,'online_payment_fee',v_intent.id,
        v_order.id,v_order.customer_id,'confirmed',true,'payment_processing_fees',
        v_receivable_account_id,false,true,
        jsonb_build_object(
          'online_payment_intent_id',v_intent.id,'provider_code',v_provider.provider_code,
          'provider_event_id',p_provider_event_id,'mdr_fee_amount',v_fee,
          'anticipation_fee_amount',v_anticipation_fee
        ),null
      ) returning id into v_fee_entry_id;
    end if;
  end if;

  insert into public.online_payment_receivables(
    store_id,provider_id,intent_id,order_id,payment_method_code,card_type,installments,
    gross_amount,fee_amount,anticipation_fee_amount,net_amount,settlement_plan,
    expected_settlement_at,status,provider_transaction_id,authorization_code,
    card_brand,card_last4,sale_cashbook_entry_id,fee_cashbook_entry_id,metadata
  ) values (
    v_intent.store_id,v_intent.provider_id,v_intent.id,v_order.id,v_method.code,v_card_type,v_installments,
    v_gross,v_fee,v_anticipation_fee,v_net,v_plan,v_expected_settlement_at,
    case when lower(v_plan) in ('ontime','nitro') then 'receivable' else 'scheduled' end,
    v_provider_tx,v_auth_code,v_brand,v_last4,v_sale_entry_id,v_fee_entry_id,
    jsonb_build_object(
      'provider_event_id',p_provider_event_id,
      'nsu',nullif(p_provider_data->>'nsu',''),
      'tid',nullif(p_provider_data->>'tid','')
    )
  )
  on conflict (intent_id) do update
  set gross_amount=excluded.gross_amount,
      fee_amount=excluded.fee_amount,
      anticipation_fee_amount=excluded.anticipation_fee_amount,
      net_amount=excluded.net_amount,
      settlement_plan=excluded.settlement_plan,
      expected_settlement_at=coalesce(excluded.expected_settlement_at,public.online_payment_receivables.expected_settlement_at),
      provider_transaction_id=coalesce(excluded.provider_transaction_id,public.online_payment_receivables.provider_transaction_id),
      authorization_code=coalesce(excluded.authorization_code,public.online_payment_receivables.authorization_code),
      card_brand=coalesce(excluded.card_brand,public.online_payment_receivables.card_brand),
      card_last4=coalesce(excluded.card_last4,public.online_payment_receivables.card_last4),
      sale_cashbook_entry_id=excluded.sale_cashbook_entry_id,
      fee_cashbook_entry_id=coalesce(excluded.fee_cashbook_entry_id,public.online_payment_receivables.fee_cashbook_entry_id),
      metadata=coalesce(public.online_payment_receivables.metadata,'{}'::jsonb)||excluded.metadata,
      updated_at=now()
  returning id into v_receivable_id;

  if lower(v_plan) in ('ontime','nitro') then
    v_settlement := public.apply_online_card_receivable_settlement_internal(
      v_intent.id,p_provider_event_id,v_paid_at,v_net
    );
    if coalesce((v_settlement->>'ok')::boolean,false) is not true then
      return jsonb_build_object(
        'ok',false,'error','immediate_settlement_failed','details',v_settlement
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok',true,'intent_id',v_intent.id,'order_id',v_order.id,
    'receivable_id',v_receivable_id,'sale_cashbook_entry_id',v_sale_entry_id,
    'fee_cashbook_entry_id',v_fee_entry_id,'gross_amount',v_gross,
    'fee_amount',v_fee,'net_amount',v_net,'settlement_plan',v_plan,
    'expected_settlement_at',v_expected_settlement_at,
    'reservation_timer_suspended',true,'settlement',v_settlement
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.apply_online_card_receivable_settlement_internal(p_intent_id uuid, p_provider_event_id text DEFAULT NULL::text, p_settled_at timestamp with time zone DEFAULT now(), p_net_amount numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_role text;
  v_receivable public.online_payment_receivables%rowtype;
  v_provider public.store_online_payment_providers%rowtype;
  v_settlement_account_id uuid;
  v_receivable_account_id uuid;
  v_account_ref text;
  v_entry_id uuid;
  v_group_id uuid := gen_random_uuid();
  v_amount numeric;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(auth.role(),''),
    current_user
  );
  if v_role not in ('service_role','postgres','supabase_admin') then
    return jsonb_build_object('ok',false,'error','service_role_required');
  end if;

  select * into v_receivable
  from public.online_payment_receivables
  where intent_id=p_intent_id
  for update;

  if v_receivable.id is null then return jsonb_build_object('ok',false,'error','receivable_not_found'); end if;
  if v_receivable.status='settled' then
    return jsonb_build_object(
      'ok',true,'duplicate',true,'receivable_id',v_receivable.id,
      'settlement_cashbook_entry_id',v_receivable.settlement_cashbook_entry_id
    );
  end if;
  if v_receivable.status in ('cancelled','refunded','chargeback') then
    return jsonb_build_object('ok',false,'error','receivable_not_settleable','status',v_receivable.status);
  end if;

  v_amount := round(coalesce(p_net_amount,v_receivable.net_amount),2);
  if abs(v_amount-v_receivable.net_amount)>0.01 then
    return jsonb_build_object(
      'ok',false,'error','settlement_amount_mismatch',
      'expected',v_receivable.net_amount,'received',v_amount
    );
  end if;

  select * into v_provider
  from public.store_online_payment_providers
  where id=v_receivable.provider_id and store_id=v_receivable.store_id
  for update;

  if v_provider.id is null then return jsonb_build_object('ok',false,'error','provider_not_found'); end if;

  v_account_ref := nullif(trim(coalesce(v_provider.public_config->>'settlement_financial_account_id','')),'');
  if v_account_ref is null then return jsonb_build_object('ok',false,'error','settlement_account_required'); end if;
  begin
    v_settlement_account_id := v_account_ref::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok',false,'error','invalid_settlement_account');
  end;

  select id into v_receivable_account_id
  from public.store_financial_accounts
  where store_id=v_receivable.store_id and code='optmapay_receivable' and active=true
  limit 1;

  if v_receivable_account_id is null then
    return jsonb_build_object('ok',false,'error','receivable_account_required');
  end if;
  if not exists (
    select 1 from public.store_financial_accounts
    where id=v_settlement_account_id and store_id=v_receivable.store_id and active=true
  ) then
    return jsonb_build_object('ok',false,'error','settlement_account_invalid');
  end if;

  insert into public.cashbook_entries(
    store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,
    payment_method,payment_method_code,source,source_id,order_id,status,affects_balance,
    account_plan_code,source_financial_account_id,destination_financial_account_id,
    is_transfer,transfer_group_id,affects_cash_drawer,affects_financial_result,metadata,created_by
  ) values (
    v_receivable.store_id,public.generate_cashbook_entry_code(),
    (coalesce(p_settled_at,now()) at time zone 'America/Sao_Paulo')::date,
    coalesce(p_settled_at,now()),'transfer','out',v_amount,
    'Liquidação de recebível OptmaPay',
    v_receivable.payment_method_code,v_receivable.payment_method_code,
    'online_payment_settlement',v_receivable.intent_id,v_receivable.order_id,
    'confirmed',true,'transfer_card_to_bank',
    v_receivable_account_id,v_settlement_account_id,
    true,v_group_id,false,false,
    jsonb_build_object(
      'online_payment_intent_id',v_receivable.intent_id,
      'online_payment_receivable_id',v_receivable.id,
      'provider_event_id',p_provider_event_id,
      'settlement_plan',v_receivable.settlement_plan,
      'gross_amount',v_receivable.gross_amount,
      'fee_amount',v_receivable.fee_amount,
      'net_amount',v_receivable.net_amount
    ),
    null
  )
  returning id into v_entry_id;

  update public.online_payment_receivables
  set status='settled',
      settled_at=coalesce(p_settled_at,now()),
      settlement_cashbook_entry_id=v_entry_id,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'settlement_provider_event_id',p_provider_event_id
      ),
      updated_at=now()
  where id=v_receivable.id;

  return jsonb_build_object(
    'ok',true,'receivable_id',v_receivable.id,'settled_amount',v_amount,
    'settled_at',coalesce(p_settled_at,now()),
    'settlement_cashbook_entry_id',v_entry_id,
    'source_financial_account_id',v_receivable_account_id,
    'destination_financial_account_id',v_settlement_account_id
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.create_or_reuse_optmapay_public_card_intent_internal(p_public_order_token text, p_candidate_intent_id uuid, p_external_reference text, p_method_code text, p_installments integer DEFAULT 1, p_settlement_plan text DEFAULT 'standard'::text, p_merchant_account_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_role text;
  v_order public.orders%rowtype;
  v_method public.store_payment_methods%rowtype;
  v_provider public.store_online_payment_providers%rowtype;
  v_intent public.online_payment_intents%rowtype;
  v_expected_reference text;
  v_base_code text;
  v_installments integer;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(auth.role(),''),
    current_user
  );
  if v_role not in ('service_role','postgres','supabase_admin') then
    return jsonb_build_object('ok',false,'error','service_role_required');
  end if;

  if p_public_order_token is null or length(trim(p_public_order_token))<24 then
    return jsonb_build_object('ok',false,'error','invalid_token');
  end if;
  if p_candidate_intent_id is null then
    return jsonb_build_object('ok',false,'error','invalid_intent_id');
  end if;

  select * into v_order
  from public.orders
  where public_order_token=trim(p_public_order_token)
  limit 1
  for update;

  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_order.id::text,0));

  if v_order.status::text in ('cancelled','expired','completed') then
    return jsonb_build_object('ok',false,'error','order_not_eligible','order_status',v_order.status::text);
  end if;

  if v_order.payment_status='paid' then
    select i.* into v_intent
    from public.online_payment_intents i
    join public.store_online_payment_providers p on p.id=i.provider_id
    where i.store_id=v_order.store_id and i.order_id=v_order.id
      and p.provider_code='optma_sandbox' and p.environment='sandbox'
      and i.method_code in ('debit_card','credit_card')
    order by i.created_at desc limit 1;

    return jsonb_build_object(
      'ok',true,'already_paid',true,'order_id',v_order.id,'order_code',v_order.order_code,
      'intent',case when v_intent.id is null then null else jsonb_build_object(
        'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
        'method_code',v_intent.method_code,'external_reference',v_intent.external_reference,
        'paid_at',v_intent.paid_at,'metadata',v_intent.metadata
      ) end
    );
  end if;

  select * into v_method
  from public.store_payment_methods pm
  where pm.store_id=v_order.store_id
    and pm.code=trim(p_method_code)
    and pm.active=true and pm.public_enabled=true
  limit 1;

  if v_method.id is null then return jsonb_build_object('ok',false,'error','payment_method_not_available'); end if;
  v_base_code := coalesce(nullif(v_method.base_code,''),v_method.code);

  if v_base_code not in ('debit_card','credit_card') then
    return jsonb_build_object('ok',false,'error','payment_method_not_card');
  end if;
  if v_order.payment_method_code is distinct from v_method.code then
    return jsonb_build_object('ok',false,'error','order_payment_method_mismatch');
  end if;
  if v_method.requires_proof
     or coalesce(v_method.metadata->'checkout'->>'confirmation_mode','')<>'api'
     or coalesce((v_method.metadata->'checkout'->>'integration_enabled')::boolean,false) is not true
     or coalesce(v_method.metadata->'checkout'->>'provider_code','')<>'optma_sandbox'
  then
    return jsonb_build_object('ok',false,'error','payment_method_not_optmapay_card');
  end if;

  select * into v_provider
  from public.store_online_payment_providers p
  where p.store_id=v_order.store_id
    and p.provider_code='optma_sandbox'
    and p.environment='sandbox'
  limit 1
  for update;

  if v_provider.id is null or not v_provider.enabled or v_provider.credential_status<>'ready' then
    return jsonb_build_object('ok',false,'error','provider_not_ready');
  end if;
  if v_base_code='debit_card' and coalesce((v_provider.capabilities->>'debit_card')::boolean,false) is not true then
    return jsonb_build_object('ok',false,'error','debit_card_not_supported');
  end if;
  if v_base_code='credit_card' and coalesce((v_provider.capabilities->>'credit_card')::boolean,false) is not true then
    return jsonb_build_object('ok',false,'error','credit_card_not_supported');
  end if;

  if p_merchant_account_id is null
     or nullif(v_provider.public_config->>'optmapay_account_id','') is null
     or (v_provider.public_config->>'optmapay_account_id')::uuid<>p_merchant_account_id
  then
    return jsonb_build_object('ok',false,'error','merchant_account_mismatch');
  end if;

  v_installments := greatest(1,least(12,coalesce(p_installments,1)));
  if v_base_code='debit_card' and v_installments<>1 then
    return jsonb_build_object('ok',false,'error','debit_installments_not_allowed');
  end if;

  select i.* into v_intent
  from public.online_payment_intents i
  where i.store_id=v_order.store_id and i.order_id=v_order.id
    and i.provider_id=v_provider.id and i.method_code=v_method.code
  order by i.created_at desc limit 1
  for update;

  if v_intent.id is not null and v_intent.status='paid' then
    return jsonb_build_object(
      'ok',true,'reused',true,'already_paid',true,
      'order_id',v_order.id,'order_code',v_order.order_code,
      'intent',jsonb_build_object(
        'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
        'method_code',v_intent.method_code,'external_reference',v_intent.external_reference,
        'paid_at',v_intent.paid_at,'metadata',v_intent.metadata
      )
    );
  end if;

  if v_intent.id is not null and v_intent.status in ('created','pending','authorized') then
    return jsonb_build_object(
      'ok',true,'reused',true,'already_paid',false,
      'order_id',v_order.id,'order_code',v_order.order_code,
      'intent',jsonb_build_object(
        'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
        'method_code',v_intent.method_code,'external_reference',v_intent.external_reference,
        'paid_at',v_intent.paid_at,'metadata',v_intent.metadata
      )
    );
  end if;

  if not exists (
    select 1 from public.stock_reservations sr
    where sr.order_id=v_order.id and sr.store_id=v_order.store_id and sr.status='active'
  ) then
    return jsonb_build_object('ok',false,'error','active_reservation_required');
  end if;

  v_expected_reference :=
    'optmamenu:'||v_order.store_id::text||':'||p_candidate_intent_id::text||':'||v_method.code;
  if p_external_reference<>v_expected_reference then
    return jsonb_build_object('ok',false,'error','invalid_external_reference');
  end if;

  insert into public.online_payment_intents(
    id,store_id,order_id,provider_id,method_code,amount,status,
    external_reference,provider_snapshot,metadata,expires_at,created_by
  ) values (
    p_candidate_intent_id,v_order.store_id,v_order.id,v_provider.id,v_method.code,v_order.total,'pending',
    p_external_reference,
    jsonb_build_object(
      'account_id',p_merchant_account_id,
      'environment','sandbox','realMoney',false
    ),
    jsonb_build_object(
      'sandbox',true,
      'provider_contract','optmapay_cards_v1',
      'checkout_mode','embedded',
      'public_checkout',true,
      'idempotency_key',p_external_reference,
      'installments',v_installments,
      'settlement_plan',coalesce(nullif(trim(p_settlement_plan),''),'standard'),
      'card_type',case when v_base_code='debit_card' then 'debit' else 'credit' end
    ),
    v_order.expires_at,null
  )
  returning * into v_intent;

  return jsonb_build_object(
    'ok',true,'reused',false,'already_paid',false,
    'order_id',v_order.id,'order_code',v_order.order_code,
    'intent',jsonb_build_object(
      'id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,
      'method_code',v_intent.method_code,'external_reference',v_intent.external_reference,
      'paid_at',v_intent.paid_at,'metadata',v_intent.metadata
    )
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.get_online_payments_workspace_safe(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
  v_proofs jsonb := '[]'::jsonb;
  v_receivables jsonb := '[]'::jsonb;
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
  into v_providers from public.store_online_payment_providers p where p.store_id=p_store_id;

  select coalesce(jsonb_agg(x.row),'[]'::jsonb) into v_intents from (
    select jsonb_build_object(
      'id',i.id,'order_id',i.order_id,'order_code',o.order_code,'provider_id',i.provider_id,'provider_code',p.provider_code,
      'provider_name',p.display_name,'environment',p.environment,'method_code',i.method_code,'amount',i.amount,
      'currency',i.currency,'status',i.status,'external_payment_id',i.external_payment_id,
      'external_reference',i.external_reference,'checkout_url',i.checkout_url,'expires_at',i.expires_at,
      'paid_at',i.paid_at,'created_at',i.created_at,'metadata',i.metadata
    ) as row
    from public.online_payment_intents i
    join public.store_online_payment_providers p on p.id=i.provider_id
    left join public.orders o on o.id=i.order_id
    where i.store_id=p_store_id
    order by i.created_at desc limit 50
  ) x;

  select coalesce(jsonb_agg(x.row),'[]'::jsonb) into v_receivables from (
    select jsonb_build_object(
      'id',r.id,'intent_id',r.intent_id,'order_id',r.order_id,'order_code',o.order_code,
      'provider_id',r.provider_id,'provider_code',p.provider_code,
      'payment_method_code',r.payment_method_code,'card_type',r.card_type,
      'card_brand',r.card_brand,'card_last4',r.card_last4,'installments',r.installments,
      'gross_amount',r.gross_amount,'fee_amount',r.fee_amount,
      'anticipation_fee_amount',r.anticipation_fee_amount,'net_amount',r.net_amount,
      'settlement_plan',r.settlement_plan,'expected_settlement_at',r.expected_settlement_at,
      'settled_at',r.settled_at,'status',r.status,'authorization_code',r.authorization_code,
      'provider_transaction_id',r.provider_transaction_id,'created_at',r.created_at,'updated_at',r.updated_at
    ) as row
    from public.online_payment_receivables r
    join public.store_online_payment_providers p on p.id=r.provider_id
    left join public.orders o on o.id=r.order_id
    where r.store_id=p_store_id
    order by r.created_at desc limit 100
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
      order by e.received_at desc limit 100
    ) x;
  end if;

  if v_can_proofs then
    select coalesce(jsonb_agg(x.row),'[]'::jsonb) into v_proofs from (
      select jsonb_build_object(
        'id',pr.id,'order_id',pr.order_id,'order_code',o.order_code,'status',pr.status,
        'original_file_name',pr.original_file_name,'content_type',pr.content_type,
        'declared_amount',pr.declared_amount,'declared_paid_at',pr.declared_paid_at,
        'submitted_at',pr.submitted_at,'decided_at',pr.decided_at,'decision_source',pr.decision_source,
        'decision_notes',pr.decision_notes,'cashbook_entry_id',pr.cashbook_entry_id,
        'financial_account_id',pr.financial_account_id,'created_at',pr.created_at
      ) as row
      from public.order_payment_proofs pr
      join public.orders o on o.id=pr.order_id
      where pr.store_id=p_store_id and pr.status<>'upload_pending'
      order by pr.created_at desc limit 50
    ) x;
  end if;

  return jsonb_build_object(
    'ok',true,
    'permissions',jsonb_build_object(
      'view',v_can_view,'manage',v_can_manage,'credentials',v_can_credentials,
      'proofs',v_can_proofs,'refund',v_can_refund,'events',v_can_events
    ),
    'providers',v_providers,'transactions',v_intents,'receivables',v_receivables,
    'events',v_events,'proofs',v_proofs,
    'counts',jsonb_build_object(
      'pending',(select count(*) from public.online_payment_intents where store_id=p_store_id and status in ('created','pending','authorized')),
      'paid',(select count(*) from public.online_payment_intents where store_id=p_store_id and status='paid'),
      'failed',(select count(*) from public.online_payment_intents where store_id=p_store_id and status in ('failed','expired','cancelled')),
      'receivables_pending',(select count(*) from public.online_payment_receivables where store_id=p_store_id and status in ('receivable','scheduled')),
      'receivables_settled',(select count(*) from public.online_payment_receivables where store_id=p_store_id and status='settled'),
      'proofs_pending',(select count(*) from public.order_payment_proofs where store_id=p_store_id and status='submitted')
    )
  );
end;
$function$


revoke all on function public.create_or_reuse_optmapay_public_card_intent_internal(text,uuid,text,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.create_or_reuse_optmapay_public_card_intent_internal(text,uuid,text,text,integer,text,uuid) to service_role;
revoke all on function public.apply_online_card_payment_confirmed_internal(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_online_card_payment_confirmed_internal(uuid,text,jsonb) to service_role;
revoke all on function public.apply_online_card_receivable_settlement_internal(uuid,text,timestamptz,numeric) from public,anon,authenticated;
grant execute on function public.apply_online_card_receivable_settlement_internal(uuid,text,timestamptz,numeric) to service_role;
