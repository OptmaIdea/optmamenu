-- POS_9 — Diagnóstico financeiro — Fechamento do caixa do dia
--
-- Objetivo:
-- Mapear a base atual antes de criar o fluxo de fechamento do caixa do dia.
--
-- A ideia é evitar criar schema/RPC/tela sem confirmar:
-- - tabelas existentes relacionadas a caixa/fechamento;
-- - formas de pagamento configuradas;
-- - estrutura de cashbook_entries;
-- - totais realizados por dia e forma de pagamento;
-- - pendentes que não devem entrar no fechamento;
-- - constraints importantes.

-- 1) Tabelas possivelmente relacionadas a caixa, fechamento e conferência
select
  'related_tables' as section,
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and (
    table_name ilike '%cashbook%'
    or table_name ilike '%cash%'
    or table_name ilike '%closing%'
    or table_name ilike '%closure%'
    or table_name ilike '%finance%'
    or table_name ilike '%payment%'
  )
order by table_name;

-- 2) Colunas de cashbook_entries
select
  'cashbook_entries_columns' as section,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cashbook_entries'
order by ordinal_position;

-- 3) Constraints relevantes
select
  'cashbook_constraints' as section,
  conrelid::regclass::text as table_name,
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.cashbook_entries'::regclass, 'public.orders'::regclass)
order by table_name, conname;

-- 4) Formas de pagamento configuradas por loja
select
  'store_payment_methods' as section,
  store_id,
  code,
  name,
  active,
  affects_cashbook,
  requires_proof,
  requires_change_for,
  sort_order,
  created_at,
  updated_at
from public.store_payment_methods
order by store_id, sort_order nulls last, name;

-- 5) Resumo realizado por dia e forma de pagamento no Livro Caixa
select
  'realized_by_day_payment_method' as section,
  ce.store_id,
  ce.entry_date,
  coalesce(ce.payment_method_code, ce.payment_method, 'sem_metodo') as payment_method_code,
  count(*) as entries_count,
  coalesce(sum(ce.amount) filter (where ce.direction = 'in'), 0) as total_in,
  coalesce(sum(ce.amount) filter (where ce.direction = 'out'), 0) as total_out,
  coalesce(sum(case when ce.direction = 'in' then ce.amount else -ce.amount end), 0) as balance
from public.cashbook_entries ce
where ce.status <> 'cancelled'
  and coalesce(ce.affects_balance, true) = true
group by ce.store_id, ce.entry_date, coalesce(ce.payment_method_code, ce.payment_method, 'sem_metodo')
order by ce.entry_date desc, ce.store_id, payment_method_code
limit 200;

-- 6) Pendentes por dia que devem ficar fora do fechamento realizado
select
  'pending_by_day' as section,
  ce.store_id,
  ce.entry_date,
  coalesce(ce.payment_method_code, ce.payment_method, 'sem_metodo') as payment_method_code,
  count(*) as pending_count,
  coalesce(sum(ce.amount) filter (where ce.direction = 'in'), 0) as pending_in,
  coalesce(sum(ce.amount) filter (where ce.direction = 'out'), 0) as pending_out,
  coalesce(sum(case when ce.direction = 'in' then ce.amount else -ce.amount end), 0) as pending_balance
from public.cashbook_entries ce
where ce.status <> 'cancelled'
  and (
    coalesce(ce.affects_balance, false) = false
    or ce.payment_method_code = 'pending'
    or ce.payment_method = 'pending'
  )
group by ce.store_id, ce.entry_date, coalesce(ce.payment_method_code, ce.payment_method, 'sem_metodo')
order by ce.entry_date desc, ce.store_id, payment_method_code
limit 200;

-- 7) Amostra de lançamentos recentes para validar campos usados no fechamento
select
  'recent_cashbook_entries' as section,
  ce.id,
  ce.store_id,
  ce.entry_code,
  ce.entry_date,
  ce.occurred_at,
  ce.type,
  ce.direction,
  ce.amount,
  ce.description,
  ce.payment_method,
  ce.payment_method_code,
  ce.status,
  ce.affects_balance,
  ce.source,
  ce.order_id,
  ce.customer_id,
  ce.metadata,
  ce.created_at,
  ce.updated_at
from public.cashbook_entries ce
order by ce.occurred_at desc nulls last, ce.created_at desc nulls last
limit 100;

-- 8) Funções/RPCs financeiras existentes
select
  'financial_functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%cashbook%'
    or p.proname ilike '%payment%'
    or p.proname ilike '%finance%'
    or p.proname ilike '%closing%'
    or p.proname ilike '%closure%'
  )
order by p.proname;
