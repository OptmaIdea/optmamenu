-- POS_9 — Validação da RPC de venda direta administrativa
--
-- Execute após aplicar a migration:
-- supabase/migrations/20260629141000_create_admin_direct_sale_order_safe.sql
--
-- Este diagnóstico é somente leitura.

with fn as (
  select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as result_type,
    l.lanname as language,
    p.prosecdef as security_definer,
    p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
    and p.proname = 'create_admin_direct_sale_order_safe'
),
grants as (
  select
    f.schema_name,
    f.function_name,
    f.identity_arguments,
    f.result_type,
    f.language,
    f.security_definer,
    r.rolname,
    has_function_privilege(r.rolname, f.oid, 'EXECUTE') as can_execute
  from fn f
  cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
),
fn_def as (
  select
    f.schema_name,
    f.function_name,
    f.identity_arguments,
    left(pg_get_functiondef(f.oid), 5000) as function_definition_preview
  from fn f
)
select
  'function_grants' as section,
  schema_name,
  function_name,
  identity_arguments,
  result_type,
  language,
  security_definer::text as security_definer,
  rolname as detail_1,
  can_execute::text as detail_2,
  '' as detail_3
from grants
union all
select
  'function_definition' as section,
  schema_name,
  function_name,
  identity_arguments,
  '' as result_type,
  '' as language,
  '' as security_definer,
  'definition_preview' as detail_1,
  function_definition_preview as detail_2,
  '' as detail_3
from fn_def
order by section, detail_1;
