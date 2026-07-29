-- Pós-Fase 9 — Diagnóstico técnico de Clientes 360º, vendas online e vendas diretas
--
-- Objetivo:
-- Mapear schema, RPCs, policies, grants e permissões existentes antes de implementar
-- a próxima etapa funcional de clientes/vendas.
--
-- Como usar:
-- Execute no SQL Editor do Supabase e salve o resultado para análise.
-- Este script é somente leitura.
--
-- Observação:
-- A seção de permissões usa leitura via to_jsonb para evitar erro quando o catálogo
-- usa `permission_key`, `permission_code` ou outro nome equivalente.

with target_tables(table_name) as (
  values
    ('customers'),
    ('customer_addresses'),
    ('customer_consent_logs'),
    ('customer_consents'),
    ('customer_segments'),
    ('customer_segment_members'),
    ('customer_benefit_rules'),
    ('loyalty_point_rules'),
    ('loyalty_transactions'),
    ('promotion_campaigns'),
    ('promotion_campaign_recipients'),
    ('orders'),
    ('order_items'),
    ('store_permission_catalog'),
    ('store_role_permission_templates')
),
table_columns as (
  select
    'table_columns' as section,
    c.table_schema,
    c.table_name,
    c.ordinal_position::text as item_order,
    c.column_name as item_name,
    c.data_type as detail_1,
    coalesce(c.udt_name, '') as detail_2,
    c.is_nullable as detail_3,
    coalesce(c.column_default, '') as detail_4
  from information_schema.columns c
  join target_tables t on t.table_name = c.table_name
  where c.table_schema = 'public'
),
table_policies as (
  select
    'table_policies' as section,
    schemaname as table_schema,
    tablename as table_name,
    policyname as item_order,
    cmd as item_name,
    roles::text as detail_1,
    coalesce(qual, '') as detail_2,
    coalesce(with_check, '') as detail_3,
    '' as detail_4
  from pg_policies
  where schemaname = 'public'
    and tablename in (select table_name from target_tables)
),
table_grants as (
  select
    'table_grants' as section,
    table_schema,
    table_name,
    grantee as item_order,
    privilege_type as item_name,
    is_grantable as detail_1,
    '' as detail_2,
    '' as detail_3,
    '' as detail_4
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in (select table_name from target_tables)
    and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
),
target_functions as (
  select
    n.nspname as function_schema,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.oid,
    p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
      p.proname ilike '%customer%'
      or p.proname ilike '%loyalty%'
      or p.proname ilike '%campaign%'
      or p.proname ilike '%segment%'
      or p.proname ilike '%benefit%'
      or p.proname ilike '%reward%'
      or p.proname ilike '%order%'
      or p.proname ilike '%direct%'
      or p.proname in (
        'get_admin_customers_safe',
        'get_customer_360_safe',
        'create_admin_customer_safe',
        'update_admin_customer_safe',
        'create_public_order_by_slug',
        'create_reserved_public_order',
        'admin_complete_public_order_safe',
        'admin_cancel_public_order_safe',
        'confirm_order_payment'
      )
    )
),
function_grants as (
  select
    'function_grants' as section,
    tf.function_schema as table_schema,
    tf.function_name as table_name,
    tf.arguments as item_order,
    r.rolname as item_name,
    has_function_privilege(r.rolname, tf.oid, 'EXECUTE')::text as detail_1,
    tf.security_definer::text as detail_2,
    '' as detail_3,
    '' as detail_4
  from target_functions tf
  cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
),
function_defs as (
  select
    'function_defs' as section,
    tf.function_schema as table_schema,
    tf.function_name as table_name,
    tf.arguments as item_order,
    case when tf.security_definer then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as item_name,
    left(pg_get_functiondef(tf.oid), 3000) as detail_1,
    '' as detail_2,
    '' as detail_3,
    '' as detail_4
  from target_functions tf
),
permission_catalog_raw as (
  select
    to_jsonb(pc) as js
  from public.store_permission_catalog pc
),
permission_catalog as (
  select
    'permission_catalog' as section,
    'public' as table_schema,
    'store_permission_catalog' as table_name,
    coalesce(js->>'category', js->>'module', js->>'group', js->>'macro_group', '') as item_order,
    coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', js->>'id', '') as item_name,
    coalesce(js->>'label', js->>'title', js->>'display_name', js->>'item_label', '') as detail_1,
    coalesce(js->>'description', '') as detail_2,
    coalesce(js->>'active', js->>'enabled', '') as detail_3,
    coalesce(js->>'sort_order', js->>'position', js->>'ui_sort_order', '') as detail_4
  from permission_catalog_raw
  where coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'customers.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'orders.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'sales.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'marketing.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'loyalty.%'
)
select * from table_columns
union all
select * from table_policies
union all
select * from table_grants
union all
select * from function_grants
union all
select * from function_defs
union all
select * from permission_catalog
order by section, table_name, item_order, item_name;
