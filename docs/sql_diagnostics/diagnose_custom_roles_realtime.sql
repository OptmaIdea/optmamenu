-- Diagnóstico 9.13.1J — Funções personalizadas e realtime
-- Objetivo: extrair o corpo real das RPCs envolvidas antes de qualquer correção SQL.
--
-- Rode este arquivo no SQL Editor do Supabase ou via psql conectado ao projeto linked.
-- Ele não altera dados.

-- 1) Localizar funções relevantes e suas assinaturas.
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
      'list_store_custom_roles',
      'create_store_custom_role',
      'update_store_custom_role',
      'assign_store_custom_role_to_member',
      'get_effective_store_permissions',
      'get_store_member_permission_detail',
      'get_store_members_for_permissions',
      'touch_store_permission_version'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 2) Extrair corpo completo das funções relevantes.
select
    '-- ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || E'\n' ||
    pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
      'list_store_custom_roles',
      'create_store_custom_role',
      'update_store_custom_role',
      'assign_store_custom_role_to_member',
      'get_effective_store_permissions',
      'get_store_member_permission_detail',
      'get_store_members_for_permissions',
      'touch_store_permission_version'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 3) Conferir se funções personalizadas estão salvando permissões.
select
    id,
    store_id,
    name,
    base_role,
    active,
    permissions,
    sensitive_actions,
    created_at,
    updated_at
from public.store_custom_roles
order by updated_at desc nulls last, created_at desc nulls last
limit 20;

-- 4) Conferir membros com função personalizada e overrides individuais.
select
    sm.id as member_id,
    sm.store_id,
    sm.user_id,
    sm.role,
    sm.status,
    sm.custom_role_id,
    scr.name as custom_role_name,
    scr.base_role as custom_role_base_role,
    sm.permissions as individual_permissions,
    scr.permissions as custom_role_permissions,
    sm.updated_at as member_updated_at,
    scr.updated_at as custom_role_updated_at
from public.store_members sm
left join public.store_custom_roles scr on scr.id = sm.custom_role_id
where sm.custom_role_id is not null
order by sm.updated_at desc nulls last
limit 50;

-- 5) Conferir versões de permissão recentes por loja.
select
    store_id,
    version,
    reason,
    changed_by,
    changed_at
from public.store_permission_versions
order by changed_at desc nulls last
limit 50;
