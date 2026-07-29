-- Diagnóstico 9.13.1J — Nome/apelido em Permissões por usuário
-- Objetivo: entender por que alguns colaboradores aparecem por e-mail em vez de nome amigável.
--
-- Rode no SQL Editor do Supabase.
-- Este arquivo não altera dados.

-- 1) Extrair assinatura e corpo da RPC usada pela lista de colaboradores.
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
  and p.proname in (
      'get_store_members_for_permissions',
      'get_user_display_identity'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

select
    '-- ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || E'\n' ||
    pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
      'get_store_members_for_permissions',
      'get_user_display_identity'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 2) Ver retorno real da RPC para a loja ativa.
-- Substitua o UUID abaixo pelo store_id da loja Gelinhares, se necessário.
select *
from public.get_store_members_for_permissions('0abba741-0f77-4783-8cf8-58811cf7343b'::uuid)
order by user_name nulls last, user_email nulls last;

-- 3) Comparar membros, auth.users e possíveis identidades públicas.
-- Ajuda a descobrir se existe nome amigável em outra origem.
select
    sm.id as member_id,
    sm.store_id,
    sm.user_id,
    sm.role,
    sm.status,
    sm.custom_role_id,
    scr.name as custom_role_name,
    au.email as auth_email,
    au.raw_user_meta_data,
    public.get_user_display_identity(sm.user_id) as display_identity
from public.store_members sm
left join public.store_custom_roles scr on scr.id = sm.custom_role_id
left join auth.users au on au.id = sm.user_id
where sm.store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
order by sm.role, au.email;
