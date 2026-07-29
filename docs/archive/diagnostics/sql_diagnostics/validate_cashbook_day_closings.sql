-- POS_9 — Validação — Fechamento do caixa do dia
--
-- Execute após aplicar:
-- supabase/migrations/20260702023000_create_cashbook_day_closings.sql

-- 1) Tabela
select
  'table_exists' as section,
  to_regclass('public.cashbook_day_closings') is not null as exists;

-- 2) Colunas principais
select
  'columns' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cashbook_day_closings'
order by ordinal_position;

-- 3) Funções
select
  'functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_cashbook_day_closing_preview_safe', 'save_cashbook_day_closing_safe')
order by p.proname;

-- 4) Grants das funções
select
  'function_grants' as section,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('get_cashbook_day_closing_preview_safe', 'save_cashbook_day_closing_safe')
order by routine_name, grantee, privilege_type;

-- 5) Políticas RLS
select
  'rls_policies' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'cashbook_day_closings'
order by policyname;

-- 6) Prévia de fechamento para uma loja com lançamentos recentes
-- Substitua store_id/data se quiser testar outro dia.
select
  'preview_sample' as section,
  public.get_cashbook_day_closing_preview_safe(
    '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
    '2026-07-01'::date
  ) as result;

-- 7) Exemplo opcional de salvamento em rascunho, com valores zerados/conferidos manualmente.
-- Execute manualmente apenas quando quiser testar gravação:
-- select public.save_cashbook_day_closing_safe(
--   '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
--   '2026-07-01'::date,
--   '{}'::jsonb,
--   0,
--   0,
--   0,
--   0,
--   0,
--   'Teste de rascunho de fechamento',
--   'draft',
--   jsonb_build_object('validated_from', 'validate_cashbook_day_closings')
-- );
