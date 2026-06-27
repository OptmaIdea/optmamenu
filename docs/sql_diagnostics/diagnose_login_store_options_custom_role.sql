-- Diagnóstico 9.13.1K — Função personalizada na escolha de loja/login
-- Objetivo: verificar se a RPC get_login_store_options já retorna custom_role_name.
--
-- Rode no SQL Editor do Supabase.
-- Este arquivo não altera dados.

select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as result_type,
    p.prosecdef as security_definer,
    p.provolatile as volatility
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_login_store_options'
order by p.proname, pg_get_function_identity_arguments(p.oid);

select
    pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_login_store_options';
