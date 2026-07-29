-- Fase 9.14C — Diagnóstico RLS/tabelas em resultado único
--
-- Rode no SQL Editor do Supabase.
-- Este arquivo NÃO altera dados.
--
-- Objetivo:
-- Retornar status RLS, policies, grants e contagem em um único result set JSON,
-- evitando que o SQL Editor/exportação capture apenas o último SELECT.

with target_tables(table_name) as (
    values
      ('store_permission_catalog'),
      ('store_role_permission_templates_backup_910c')
), table_status as (
    select
        c.relname as table_name,
        jsonb_build_object(
            'schema_name', n.nspname,
            'table_name', c.relname,
            'rls_enabled', c.relrowsecurity,
            'rls_forced', c.relforcerowsecurity,
            'relkind', c.relkind,
            'total_bytes', pg_total_relation_size(c.oid),
            'total_size', pg_size_pretty(pg_total_relation_size(c.oid))
        ) as payload
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join target_tables tt on tt.table_name = c.relname
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
), policies as (
    select
        p.tablename as table_name,
        coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'policyname', p.policyname,
                    'permissive', p.permissive,
                    'roles', p.roles,
                    'cmd', p.cmd,
                    'qual', p.qual,
                    'with_check', p.with_check
                )
                order by p.policyname
            ),
            '[]'::jsonb
        ) as payload
    from pg_policies p
    join target_tables tt on tt.table_name = p.tablename
    where p.schemaname = 'public'
    group by p.tablename
), grants as (
    select
        g.table_name,
        coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'grantee', g.grantee,
                    'privilege_type', g.privilege_type,
                    'is_grantable', g.is_grantable
                )
                order by g.grantee, g.privilege_type
            ),
            '[]'::jsonb
        ) as payload
    from information_schema.role_table_grants g
    join target_tables tt on tt.table_name = g.table_name
    where g.table_schema = 'public'
    group by g.table_name
), row_counts as (
    select 'store_permission_catalog' as table_name, count(*)::bigint as row_count
    from public.store_permission_catalog
    union all
    select 'store_role_permission_templates_backup_910c' as table_name, count(*)::bigint as row_count
    from public.store_role_permission_templates_backup_910c
)
select
    tt.table_name,
    coalesce(ts.payload, '{}'::jsonb) as table_status,
    coalesce(p.payload, '[]'::jsonb) as policies,
    coalesce(g.payload, '[]'::jsonb) as grants,
    rc.row_count
from target_tables tt
left join table_status ts on ts.table_name = tt.table_name
left join policies p on p.table_name = tt.table_name
left join grants g on g.table_name = tt.table_name
left join row_counts rc on rc.table_name = tt.table_name
order by tt.table_name;
