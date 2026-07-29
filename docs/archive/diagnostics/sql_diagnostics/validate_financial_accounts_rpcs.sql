-- POS_9 — Validação — RPCs de contas financeiras
-- Execute após aplicar:
-- supabase/migrations/20260703015500_financial_accounts_rpcs.sql

-- 1) Funções criadas
select
  'functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'list_store_financial_accounts_safe',
    'upsert_store_financial_account_safe',
    'set_store_financial_account_active_safe'
  )
order by p.proname;

-- 2) Grants
select
  'grants' as section,
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'list_store_financial_accounts_safe',
    'upsert_store_financial_account_safe',
    'set_store_financial_account_active_safe'
  )
order by routine_name, grantee;

-- 3) Listagem segura da Gelinhares
select
  'list_accounts' as section,
  public.list_store_financial_accounts_safe(
    '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
    true
  ) as result;

-- 4) Criar/atualizar conta de teste idempotente
select
  'upsert_test_account' as section,
  public.upsert_store_financial_account_safe(
    '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
    null,
    'test_cashbox',
    'Caixa Teste',
    'cash_drawer',
    'Conta de teste para validacao das RPCs.',
    false,
    true,
    999,
    '{}'::jsonb
  ) as result;

-- 5) Conferir conta de teste
select
  'test_account_after_upsert' as section,
  id,
  code,
  name,
  account_type,
  active,
  is_default,
  sort_order
from public.store_financial_accounts
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and code = 'test_cashbox';
