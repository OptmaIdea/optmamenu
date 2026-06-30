-- POS_9 — Validação financeira: pagamento pendente não compõe saldo
--
-- Execute após aplicar:
-- supabase/migrations/20260630153000_fix_pending_cashbook_balance.sql
--
-- Objetivo:
-- Confirmar que vendas/pedidos com pagamento pendente não afetam o saldo do Livro Diário de Caixa.

with pending_order_entries as (
  select
    ce.id as cashbook_entry_id,
    ce.store_id,
    ce.order_id,
    ce.entry_date,
    ce.description,
    ce.amount,
    ce.direction,
    ce.type,
    ce.status as cashbook_status,
    ce.affects_balance,
    ce.payment_method_code as cashbook_payment_method_code,
    o.order_code,
    o.payment_method_code as order_payment_method_code,
    o.payment_method::text as order_payment_method,
    o.customer_name,
    o.total as order_total,
    ce.metadata
  from public.cashbook_entries ce
  join public.orders o on o.id = ce.order_id
  where ce.type = 'sale'
    and coalesce(o.payment_method_code, o.payment_method::text, '') = 'pending'
)
select
  'pending_entries_summary' as section,
  count(*)::text as total_pending_entries,
  count(*) filter (where affects_balance = true)::text as pending_affecting_balance,
  count(*) filter (where affects_balance = false)::text as pending_not_affecting_balance,
  coalesce(sum(amount) filter (where affects_balance = true), 0)::text as amount_still_affecting_balance,
  coalesce(sum(amount) filter (where affects_balance = false), 0)::text as amount_excluded_from_balance
from pending_order_entries

union all

select
  'function_has_guard' as section,
  '1' as total_pending_entries,
  case
    when pg_get_functiondef(p.oid) like '%payment_pending%'
     and pg_get_functiondef(p.oid) like '%payment_method_does_not_affect_cashbook%'
    then 'true'
    else 'false'
  end as pending_affecting_balance,
  '' as pending_not_affecting_balance,
  '' as amount_still_affecting_balance,
  '' as amount_excluded_from_balance
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_admin_direct_sale_order_safe'
limit 20;

-- Detalhe opcional para auditoria manual:
select *
from (
  select
    ce.id as cashbook_entry_id,
    ce.store_id,
    ce.order_id,
    o.order_code,
    o.customer_name,
    o.payment_method_code,
    ce.amount,
    ce.status,
    ce.affects_balance,
    ce.description,
    ce.updated_at
  from public.cashbook_entries ce
  join public.orders o on o.id = ce.order_id
  where ce.type = 'sale'
    and coalesce(o.payment_method_code, o.payment_method::text, '') = 'pending'
  order by ce.updated_at desc nulls last, ce.created_at desc nulls last
  limit 50
) detail;
