-- POS_9 — Diagnóstico financeiro — Recebíveis pendentes
--
-- Objetivo:
-- Mapear pedidos/vendas com pagamento pendente e situação no Livro Diário de Caixa.
--
-- Use antes de implementar o fluxo de "Confirmar recebimento".

-- 1) Pedidos com pagamento pendente
select
  'orders_pending_payment' as section,
  o.store_id,
  o.id as order_id,
  o.order_code,
  o.customer_id,
  o.customer_name,
  o.status as order_status,
  o.payment_method_code,
  o.payment_method::text as payment_method,
  o.total,
  o.created_at,
  o.completed_at,
  o.commercial_metadata,
  o.delivery_metadata
from public.orders o
where coalesce(o.payment_method_code, o.payment_method::text, '') = 'pending'
order by o.created_at desc
limit 100;

-- 2) Lançamentos de caixa ligados a pedidos pendentes
select
  'cashbook_entries_for_pending_orders' as section,
  ce.store_id,
  ce.id as cashbook_entry_id,
  ce.entry_code,
  ce.order_id,
  o.order_code,
  o.customer_name,
  ce.entry_date,
  ce.occurred_at,
  ce.type,
  ce.direction,
  ce.amount,
  ce.status as cashbook_status,
  ce.affects_balance,
  ce.payment_method_code as cashbook_payment_method_code,
  o.payment_method_code as order_payment_method_code,
  ce.description,
  ce.metadata
from public.cashbook_entries ce
join public.orders o on o.id = ce.order_id
where coalesce(o.payment_method_code, o.payment_method::text, '') = 'pending'
order by ce.occurred_at desc
limit 100;

-- 3) Resumo de pendentes por loja
select
  'pending_summary_by_store' as section,
  o.store_id,
  count(*) as pending_orders,
  coalesce(sum(o.total), 0) as pending_order_total,
  count(ce.id) as cashbook_entries_linked,
  count(ce.id) filter (where coalesce(ce.affects_balance, false) = true) as cashbook_entries_affecting_balance,
  coalesce(sum(ce.amount) filter (where coalesce(ce.affects_balance, false) = true), 0) as amount_affecting_balance,
  coalesce(sum(ce.amount) filter (where coalesce(ce.affects_balance, false) = false), 0) as amount_not_affecting_balance
from public.orders o
left join public.cashbook_entries ce on ce.order_id = o.id
where coalesce(o.payment_method_code, o.payment_method::text, '') = 'pending'
group by o.store_id
order by pending_order_total desc;

-- 4) Funções/RPCs relacionadas a pagamento/caixa
select
  'payment_cashbook_functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%payment%'
    or p.proname ilike '%cashbook%'
    or p.proname ilike '%order%confirm%'
  )
order by p.proname;

-- 5) Check constraints úteis do Livro Caixa e Pedidos
select
  'relevant_constraints' as section,
  conrelid::regclass::text as table_name,
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.cashbook_entries'::regclass, 'public.orders'::regclass)
  and contype = 'c'
order by table_name, conname;
