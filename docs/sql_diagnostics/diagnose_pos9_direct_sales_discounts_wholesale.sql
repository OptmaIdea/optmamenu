-- POS_9 — Diagnóstico de descontos e atacado para venda direta
--
-- Objetivo:
-- Mapear estrutura atual de produtos, categorias, clientes, pedidos, itens,
-- benefícios, fidelidade e campanhas antes de definir regra de preço/desconto.
--
-- Como usar:
-- Execute no SQL Editor do Supabase e envie o resultado.
-- Este script é somente leitura.

with target_tables(table_name) as (
  values
    ('products'),
    ('categories'),
    ('customers'),
    ('orders'),
    ('order_items'),
    ('customer_benefit_rules'),
    ('loyalty_point_rules'),
    ('loyalty_transactions'),
    ('customer_segments'),
    ('customer_segment_members'),
    ('promotion_campaigns'),
    ('promotion_campaign_recipients'),
    ('store_settings'),
    ('store_permission_catalog')
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
constraints_info as (
  select
    'constraints' as section,
    tc.table_schema,
    tc.table_name,
    tc.constraint_type as item_order,
    tc.constraint_name as item_name,
    coalesce(cc.check_clause, '') as detail_1,
    '' as detail_2,
    '' as detail_3,
    '' as detail_4
  from information_schema.table_constraints tc
  left join information_schema.check_constraints cc
    on cc.constraint_schema = tc.constraint_schema
   and cc.constraint_name = tc.constraint_name
  where tc.table_schema = 'public'
    and tc.table_name in (select table_name from target_tables)
),
indexes_info as (
  select
    'indexes' as section,
    schemaname as table_schema,
    tablename as table_name,
    indexname as item_order,
    indexname as item_name,
    indexdef as detail_1,
    '' as detail_2,
    '' as detail_3,
    '' as detail_4
  from pg_indexes
  where schemaname = 'public'
    and tablename in (select table_name from target_tables)
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
      p.proname ilike '%discount%'
      or p.proname ilike '%benefit%'
      or p.proname ilike '%price%'
      or p.proname ilike '%pricing%'
      or p.proname ilike '%wholesale%'
      or p.proname ilike '%loyalty%'
      or p.proname ilike '%campaign%'
      or p.proname ilike '%segment%'
      or p.proname ilike '%customer%'
      or p.proname ilike '%direct_sale%'
      or p.proname in (
        'create_admin_direct_sale_order_safe',
        'get_customer_360_safe',
        'get_admin_customers_safe',
        'upsert_customer_benefit_rule_safe',
        'upsert_loyalty_point_rule_safe',
        'calculate_order_loyalty_points_advanced',
        'apply_order_loyalty_points_advanced'
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
    left(pg_get_functiondef(tf.oid), 3500) as detail_1,
    '' as detail_2,
    '' as detail_3,
    '' as detail_4
  from target_functions tf
),
permission_catalog_raw as (
  select to_jsonb(pc) as js
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
  where coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'orders.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'customers.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'products.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'categories.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'loyalty.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'marketing.%'
     or coalesce(js->>'permission_key', js->>'permission_code', js->>'code', js->>'key', js->>'name', '') ilike 'sales.%'
),
sample_product_commercial_fields as (
  select
    'sample_products' as section,
    'public' as table_schema,
    'products' as table_name,
    coalesce(p.name, '') as item_order,
    p.id::text as item_name,
    jsonb_build_object(
      'price', p.price,
      'category_id', p.category_id,
      'active', p.active,
      'metadata', to_jsonb(p) - 'id' - 'name' - 'description' - 'created_at' - 'updated_at'
    )::text as detail_1,
    '' as detail_2,
    '' as detail_3,
    '' as detail_4
  from public.products p
  order by p.updated_at desc nulls last, p.created_at desc nulls last
  limit 20
),
sample_category_fields as (
  select
    'sample_categories' as section,
    'public' as table_schema,
    'categories' as table_name,
    coalesce(c.name, '') as item_order,
    c.id::text as item_name,
    (to_jsonb(c) - 'id' - 'name' - 'created_at' - 'updated_at')::text as detail_1,
    '' as detail_2,
    '' as detail_3,
    '' as detail_4
  from public.categories c
  order by c.updated_at desc nulls last, c.created_at desc nulls last
  limit 20
)
select * from table_columns
union all
select * from constraints_info
union all
select * from indexes_info
union all
select * from function_grants
union all
select * from function_defs
union all
select * from permission_catalog
union all
select * from sample_product_commercial_fields
union all
select * from sample_category_fields
order by section, table_name, item_order, item_name;
