-- Homologação 0D — auditoria read-only de EXECUTE em SECURITY DEFINER.
-- Executar no projeto HML. Não altera dados nem grants.

-- 1) Resumo geral.
select
  count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')) as secdef_anon_exec,
  count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE')) as secdef_auth_exec,
  count(*) filter (where has_function_privilege('public', p.oid, 'EXECUTE')) as secdef_public_exec,
  count(*) as secdef_total
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef;

-- 2) Invariante: trigger SECURITY DEFINER nunca deve ser RPC externa.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and pg_get_function_result(p.oid) = 'trigger'
  and (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    or has_function_privilege('public', p.oid, 'EXECUTE')
  )
order by p.proname;

-- 3) Invariante: nenhuma SECURITY DEFINER deve depender de PUBLIC EXECUTE.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('public', p.oid, 'EXECUTE')
order by p.proname, identity_args;

-- 4) Maintenance crítica deve ser apenas service_role.
select
  has_function_privilege('anon', 'public.reconcile_inventory_reservations(uuid,boolean)', 'EXECUTE') as reconcile_anon_exec,
  has_function_privilege('authenticated', 'public.reconcile_inventory_reservations(uuid,boolean)', 'EXECUTE') as reconcile_auth_exec,
  has_function_privilege('service_role', 'public.reconcile_inventory_reservations(uuid,boolean)', 'EXECUTE') as reconcile_service_exec;

-- 5) Lista residual de SECURITY DEFINER expostas a anon para classificação explícita.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
  coalesce(array_to_string(p.proconfig, ','), '') as proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by p.proname, identity_args;
