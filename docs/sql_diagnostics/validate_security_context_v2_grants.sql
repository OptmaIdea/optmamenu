-- POS_9 — Validação de grants do contexto de segurança v2
--
-- Execute após aplicar:
-- supabase/migrations/20260629150000_restore_authenticated_security_context_v2.sql

with fn as (
  select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as result_type,
    p.prosecdef as security_definer,
    p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_current_user_security_context_v2'
)
select
  f.schema_name,
  f.function_name,
  f.identity_arguments,
  f.result_type,
  f.security_definer,
  r.rolname,
  has_function_privilege(r.rolname, f.oid, 'EXECUTE') as can_execute
from fn f
cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
order by r.rolname;
