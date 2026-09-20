-- Establish explicit financial routing for online orders by fulfillment, timing and payment method.

create table if not exists public.store_order_payment_account_routes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  scope text not null default 'public_store',
  fulfillment_type text not null check (fulfillment_type in ('delivery','pickup','table','any')),
  payment_timing text not null check (payment_timing in ('pay_on_fulfillment','advance','any')),
  payment_method_code text not null default '*',
  destination_financial_account_id uuid not null references public.store_financial_accounts(id),
  allow_override_on_receipt boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, scope, fulfillment_type, payment_timing, payment_method_code)
);

alter table public.store_order_payment_account_routes enable row level security;

drop policy if exists store_order_payment_account_routes_member_select on public.store_order_payment_account_routes;
create policy store_order_payment_account_routes_member_select
on public.store_order_payment_account_routes
for select
using (public.is_store_member(store_id));

drop policy if exists store_order_payment_account_routes_manager_write on public.store_order_payment_account_routes;
create policy store_order_payment_account_routes_manager_write
on public.store_order_payment_account_routes
for all
using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'financial.manage')
  or public.user_has_store_permission(store_id, 'settings.manage')
)
with check (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'financial.manage')
  or public.user_has_store_permission(store_id, 'settings.manage')
);

create or replace function public.get_order_payment_timing(
  p_payment_metadata jsonb,
  p_payment_status text default null
)
returns text
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_timing text;
begin
  v_timing := lower(coalesce(p_payment_metadata #>> '{checkout,timing}', ''));
  if v_timing in ('pay_on_fulfillment', 'pay_on_receipt', 'on_delivery', 'on_pickup') then
    return 'pay_on_fulfillment';
  end if;
  if v_timing in ('pay_now', 'advance', 'prepaid', 'online') then
    return 'advance';
  end if;

  if coalesce(p_payment_metadata, '{}'::jsonb) ? 'online_payment_intent_id'
     or coalesce(p_payment_metadata, '{}'::jsonb) ? 'payment_proof_id'
     or lower(coalesce(p_payment_metadata->>'confirmation_mode', '')) = 'api'
     or lower(coalesce(p_payment_metadata->>'paid_by_source', '')) in ('manual_proof_review', 'online_payment') then
    return 'advance';
  end if;

  return 'pay_on_fulfillment';
end;
$function$;

create or replace function public.format_order_cashbook_payment_label(
  p_fulfillment_type text,
  p_payment_method_code text,
  p_payment_timing text
)
returns text
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_method text := lower(coalesce(p_payment_method_code, ''));
  v_suffix text;
  v_base text;
begin
  v_base := case
    when v_method in ('cash','dinheiro') then 'Dinheiro'
    when v_method in ('pix','pix_manual_qr','asaas_pix','pix_asaas') then 'Pix'
    when v_method = 'debit_card' then 'Cartão de débito'
    when v_method = 'credit_card' then 'Cartão de crédito'
    when v_method in ('card') then 'Cartão'
    when v_method = 'payment_link' then 'Link de pagamento'
    else initcap(replace(replace(coalesce(nullif(v_method, ''), 'não informado'), '_', ' '), '-', ' '))
  end;

  if p_payment_timing = 'advance' then
    return v_base || ' antecipado';
  end if;

  v_suffix := case
    when coalesce(p_fulfillment_type, '') = 'delivery' then 'pago na entrega'
    when coalesce(p_fulfillment_type, '') = 'pickup' then 'pago na retirada'
    else 'pago no recebimento'
  end;

  return v_base || ' — ' || v_suffix;
end;
$function$;

create or replace function public.resolve_order_payment_destination_account(
  p_store_id uuid,
  p_scope text,
  p_fulfillment_type text,
  p_payment_timing text,
  p_payment_method_code text,
  p_override_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_account_id uuid;
  v_method text := lower(coalesce(nullif(trim(p_payment_method_code), ''), '*'));
  v_scope text := coalesce(nullif(trim(p_scope), ''), 'public_store');
  v_fulfillment text := coalesce(nullif(trim(p_fulfillment_type), ''), 'any');
  v_timing text := coalesce(nullif(trim(p_payment_timing), ''), 'any');
begin
  if p_override_account_id is not null then
    select a.id into v_account_id
    from public.store_financial_accounts a
    where a.id = p_override_account_id
      and a.store_id = p_store_id
      and a.active = true;
    if v_account_id is not null then
      return v_account_id;
    end if;
  end if;

  select r.destination_financial_account_id into v_account_id
  from public.store_order_payment_account_routes r
  join public.store_financial_accounts a on a.id = r.destination_financial_account_id
  where r.store_id = p_store_id
    and r.scope in (v_scope, 'any')
    and r.fulfillment_type in (v_fulfillment, 'any')
    and r.payment_timing in (v_timing, 'any')
    and r.payment_method_code in (v_method, '*')
    and r.active = true
    and a.active = true
  order by
    case when r.scope = v_scope then 0 else 1 end,
    case when r.fulfillment_type = v_fulfillment then 0 else 1 end,
    case when r.payment_timing = v_timing then 0 else 1 end,
    case when r.payment_method_code = v_method then 0 else 1 end,
    r.sort_order,
    r.created_at desc
  limit 1;

  if v_account_id is not null then
    return v_account_id;
  end if;

  select a.id into v_account_id
  from public.store_financial_accounts a
  where a.store_id = p_store_id
    and a.active = true
    and a.is_sales_clearing_default = true
  order by a.sort_order, a.name
  limit 1;

  if v_account_id is not null then
    return v_account_id;
  end if;

  select a.id into v_account_id
  from public.store_financial_accounts a
  where a.store_id = p_store_id
    and a.active = true
    and (
      (v_method in ('cash','dinheiro') and a.account_type = 'cash_drawer')
      or (v_method in ('pix','pix_manual_qr','asaas_pix','pix_asaas') and a.account_type = 'pix_wallet')
      or (v_method in ('card','credit_card','debit_card') and a.account_type in ('card_receivable','card_acquirer'))
    )
  order by a.is_default desc, a.sort_order, a.name
  limit 1;

  return v_account_id;
end;
$function$;

create or replace function public.list_order_payment_account_routes_safe(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_routes jsonb := '[]'::jsonb;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id', 'routes', '[]'::jsonb);
  end if;
  if auth.uid() is null or not public.is_store_member(p_store_id) then
    return jsonb_build_object('ok', false, 'error', 'access_denied', 'routes', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'scope', r.scope,
    'fulfillment_type', r.fulfillment_type,
    'payment_timing', r.payment_timing,
    'payment_method_code', r.payment_method_code,
    'destination_financial_account_id', r.destination_financial_account_id,
    'destination_account_name', a.name,
    'destination_account_code', a.code,
    'destination_account_type', a.account_type,
    'allow_override_on_receipt', r.allow_override_on_receipt,
    'active', r.active,
    'sort_order', r.sort_order,
    'metadata', r.metadata
  ) order by r.fulfillment_type, r.payment_timing, r.sort_order, r.payment_method_code), '[]'::jsonb)
  into v_routes
  from public.store_order_payment_account_routes r
  join public.store_financial_accounts a on a.id = r.destination_financial_account_id
  where r.store_id = p_store_id;

  return jsonb_build_object(
    'ok', true,
    'can_manage', (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id, 'financial.manage') or public.user_has_store_permission(p_store_id, 'settings.manage')),
    'routes', v_routes
  );
end;
$function$;

-- HML bootstrap for Gelinhares. It is safe in other databases: if the store/accounts do not exist, no rows are inserted.
do $$
declare
  v_store_id uuid := '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid;
  v_cash_id uuid;
  v_infinitepay_id uuid;
  v_asaas_id uuid;
begin
  if not exists (select 1 from public.stores where id = v_store_id) then
    return;
  end if;

  select id into v_cash_id
  from public.store_financial_accounts
  where store_id = v_store_id and active = true and lower(name) in ('caixa fisico','caixa físico')
  order by created_at desc
  limit 1;

  if v_cash_id is null then
    select id into v_cash_id
    from public.store_financial_accounts
    where store_id = v_store_id and active = true and account_type = 'cash_drawer'
    order by is_sales_clearing_default asc, is_default desc, sort_order, name
    limit 1;
  end if;

  select id into v_infinitepay_id
  from public.store_financial_accounts
  where store_id = v_store_id and active = true and lower(name) = 'infinitepay'
  order by case when code = 'infinitepay' then 0 else 1 end, created_at desc
  limit 1;

  select id into v_asaas_id
  from public.store_financial_accounts
  where store_id = v_store_id and active = true and lower(name) in ('asaas pix','asaas')
  order by case when code = 'asaas_pix' then 0 else 1 end, created_at desc
  limit 1;

  delete from public.store_order_payment_account_routes
  where store_id = v_store_id
    and scope = 'public_store'
    and metadata->>'managed_by' = 'optmamenu_default_online_route_seed_20260830';

  if v_cash_id is not null then
    insert into public.store_order_payment_account_routes (store_id, scope, fulfillment_type, payment_timing, payment_method_code, destination_financial_account_id, allow_override_on_receipt, sort_order, metadata)
    values
      (v_store_id, 'public_store', 'delivery', 'pay_on_fulfillment', 'cash', v_cash_id, true, 10, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · dinheiro · caixa físico')),
      (v_store_id, 'public_store', 'pickup', 'pay_on_fulfillment', '*', v_cash_id, true, 10, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Retirada · a receber · caixa físico'))
    on conflict (store_id, scope, fulfillment_type, payment_timing, payment_method_code)
    do update set destination_financial_account_id = excluded.destination_financial_account_id,
                  allow_override_on_receipt = excluded.allow_override_on_receipt,
                  active = true,
                  metadata = excluded.metadata,
                  updated_at = now();
  end if;

  if v_infinitepay_id is not null then
    insert into public.store_order_payment_account_routes (store_id, scope, fulfillment_type, payment_timing, payment_method_code, destination_financial_account_id, allow_override_on_receipt, sort_order, metadata)
    values
      (v_store_id, 'public_store', 'delivery', 'pay_on_fulfillment', 'pix', v_infinitepay_id, true, 20, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · pix a receber · InfinitePay')),
      (v_store_id, 'public_store', 'delivery', 'pay_on_fulfillment', 'debit_card', v_infinitepay_id, true, 21, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · cartão a receber · InfinitePay')),
      (v_store_id, 'public_store', 'delivery', 'pay_on_fulfillment', 'credit_card', v_infinitepay_id, true, 22, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · cartão a receber · InfinitePay'))
    on conflict (store_id, scope, fulfillment_type, payment_timing, payment_method_code)
    do update set destination_financial_account_id = excluded.destination_financial_account_id,
                  allow_override_on_receipt = excluded.allow_override_on_receipt,
                  active = true,
                  metadata = excluded.metadata,
                  updated_at = now();
  end if;

  if v_asaas_id is not null then
    insert into public.store_order_payment_account_routes (store_id, scope, fulfillment_type, payment_timing, payment_method_code, destination_financial_account_id, allow_override_on_receipt, sort_order, metadata)
    values
      (v_store_id, 'public_store', 'delivery', 'advance', 'pix', v_asaas_id, false, 30, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · pix antecipado · Asaas')),
      (v_store_id, 'public_store', 'delivery', 'advance', 'pix_manual_qr', v_asaas_id, false, 31, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · pix antecipado · Asaas')),
      (v_store_id, 'public_store', 'delivery', 'advance', 'asaas_pix', v_asaas_id, false, 32, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · pix antecipado · Asaas')),
      (v_store_id, 'public_store', 'delivery', 'advance', 'credit_card', v_asaas_id, false, 33, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · cartão antecipado · Asaas')),
      (v_store_id, 'public_store', 'delivery', 'advance', 'debit_card', v_asaas_id, false, 34, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · cartão antecipado · Asaas')),
      (v_store_id, 'public_store', 'delivery', 'advance', 'payment_link', v_asaas_id, false, 35, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Delivery · link antecipado · Asaas')),
      (v_store_id, 'public_store', 'pickup', 'advance', 'pix', v_asaas_id, false, 40, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Retirada · pix antecipado · Asaas')),
      (v_store_id, 'public_store', 'pickup', 'advance', 'pix_manual_qr', v_asaas_id, false, 41, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Retirada · pix antecipado · Asaas')),
      (v_store_id, 'public_store', 'pickup', 'advance', 'asaas_pix', v_asaas_id, false, 42, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Retirada · pix antecipado · Asaas')),
      (v_store_id, 'public_store', 'pickup', 'advance', 'credit_card', v_asaas_id, false, 43, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Retirada · cartão antecipado · Asaas')),
      (v_store_id, 'public_store', 'pickup', 'advance', 'debit_card', v_asaas_id, false, 44, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Retirada · cartão antecipado · Asaas')),
      (v_store_id, 'public_store', 'pickup', 'advance', 'payment_link', v_asaas_id, false, 45, jsonb_build_object('managed_by','optmamenu_default_online_route_seed_20260830','label','Retirada · link antecipado · Asaas'))
    on conflict (store_id, scope, fulfillment_type, payment_timing, payment_method_code)
    do update set destination_financial_account_id = excluded.destination_financial_account_id,
                  allow_override_on_receipt = excluded.allow_override_on_receipt,
                  active = true,
                  metadata = excluded.metadata,
                  updated_at = now();
  end if;
end $$;
