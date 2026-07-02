-- POS_9 — Validação — Metadata limpa do fechamento de caixa
--
-- Execute após aplicar:
-- supabase/migrations/20260702194500_fix_cashbook_day_closing_metadata_recursion.sql

-- 1) Função save continua disponível
select
  'function_exists' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'save_cashbook_day_closing_safe';

-- 2) Grants
select
  'function_grants' as section,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'save_cashbook_day_closing_safe'
order by grantee, privilege_type;

-- 3) Registros ainda com preview recursivo antigo
select
  'metadata_preview_remaining' as section,
  count(*) as rows_with_preview_key
from public.cashbook_day_closings
where metadata ? 'preview';

-- 4) Amostra de fechamentos recentes com metadata limpo
select
  'recent_closing_metadata' as section,
  id,
  closing_date,
  status,
  expected_total,
  confirmed_total,
  difference_total,
  notes,
  closed_by,
  closed_at,
  metadata
from public.cashbook_day_closings
order by closing_date desc, updated_at desc
limit 10;
