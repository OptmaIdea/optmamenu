-- Fase 9.14A — Diagnóstico separado: RLS/tabelas
--
-- Rode no SQL Editor do Supabase.
-- Este arquivo NÃO altera dados.
--
-- Objetivo: obter apenas os resultados de tabelas/RLS/grants,
-- evitando que a exportação do SQL Editor capture somente o último result set.

-- 1) Status RLS das tabelas apontadas pelo Advisor.
select
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    c.relkind,
    pg_total_relation_size(c.oid) as total_bytes,
    pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in (
      'store_permission_catalog',
      'store_role_permission_templates_backup_910c'
  )
order by c.relname;

-- 2) Policies existentes.
select
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
  and tablename in (
      'store_permission_catalog',
      'store_role_permission_templates_backup_910c'
  )
order by tablename, policyname;

-- 3) Grants diretos nas tabelas.
select
    table_schema,
    table_name,
    grantee,
    privilege_type,
    is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
      'store_permission_catalog',
      'store_role_permission_templates_backup_910c'
  )
order by table_name, grantee, privilege_type;

-- 4) Contagem de linhas.
select 'store_permission_catalog' as table_name, count(*)::bigint as row_count
from public.store_permission_catalog
union all
select 'store_role_permission_templates_backup_910c' as table_name, count(*)::bigint as row_count
from public.store_role_permission_templates_backup_910c;
