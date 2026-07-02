-- POS_9 — Validação — Status dos fechamentos de caixa
--
-- Execute após aplicar:
-- supabase/migrations/20260702193000_list_cashbook_day_closing_status_safe.sql

-- 1) Função criada
select
  'function_exists' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'list_cashbook_day_closing_status_safe';

-- 2) Grants
select
  'function_grants' as section,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'list_cashbook_day_closing_status_safe'
order by grantee, privilege_type;

-- 3) Teste com loja Gelinhares
select
  'status_sample' as section,
  public.list_cashbook_day_closing_status_safe(
    '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
    120,
    3
  ) as result;
