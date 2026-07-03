-- POS_9 — Validação — contas e classificações do Livro Diário
-- Execute após aplicar:
-- 1) supabase/migrations/20260703013000_create_cashbook_accounts_base.sql
-- 2) supabase/migrations/20260703013500_seed_cashbook_account_plan.sql
-- 3) supabase/migrations/20260703014000_seed_store_financial_accounts.sql

-- 1) Tabelas criadas
select
  'tables' as section,
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('cashbook_account_plan', 'store_financial_accounts')
order by table_name;

-- 2) Novas colunas em cashbook_entries
select
  'cashbook_entries_columns' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cashbook_entries'
  and column_name in (
    'account_plan_code',
    'source_financial_account_id',
    'destination_financial_account_id',
    'is_transfer',
    'transfer_group_id',
    'affects_cash_drawer',
    'affects_financial_result'
  )
order by ordinal_position;

-- 3) Plano simples de categorias
select
  'account_plan' as section,
  code,
  name,
  kind,
  affects_cash_drawer,
  affects_financial_result,
  is_transfer,
  active,
  sort_order
from public.cashbook_account_plan
order by sort_order, code;

-- 4) Contas financeiras da Gelinhares
select
  'store_financial_accounts' as section,
  store_id,
  code,
  name,
  account_type,
  is_default,
  active,
  sort_order
from public.store_financial_accounts
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
order by sort_order, code;

-- 5) RLS/policies
select
  'policies' as section,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('cashbook_account_plan', 'store_financial_accounts')
order by tablename, policyname;
