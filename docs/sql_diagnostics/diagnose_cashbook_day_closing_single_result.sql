-- POS_9 — Diagnóstico financeiro — Fechamento do caixa do dia — resultado único
--
-- Use este diagnóstico no Supabase SQL Editor quando o script multi-SELECT mostrar/exportar
-- apenas a última seção.
--
-- Ele retorna um único JSON com todas as seções necessárias.

with related_tables as (
  select coalesce(jsonb_agg(to_jsonb(t) order by table_name), '[]'::jsonb) as data
  from (
    select table_schema, table_name
    from information_schema.tables
    where table_schema = 'public'
      and (
        table_name ilike '%cashbook%'
        or table_name ilike '%cash%'
        or table_name ilike '%closing%'
        or table_name ilike '%closure%'
        or table_name ilike '%finance%'
        or table_name ilike '%payment%'
      )
  ) t
),
cashbook_entries_columns as (
  select coalesce(jsonb_agg(to_jsonb(c) order by ordinal_position), '[]'::jsonb) as data
  from (
    select ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cashbook_entries'
  ) c
),
cashbook_constraints as (
  select coalesce(jsonb_agg(to_jsonb(c) order by table_name, conname), '[]'::jsonb) as data
  from (
    select
      conrelid::regclass::text as table_name,
      conname,
      contype,
      pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid in ('public.cashbook_entries'::regclass, 'public.orders'::regclass)
  ) c
),
store_payment_methods as (
  select coalesce(jsonb_agg(to_jsonb(pm) order by store_id, sort_order nulls last, name), '[]'::jsonb) as data
  from (
    select
      store_id,
      code,
      name,
      active,
      affects_cashbook,
      requires_proof,
      requires_change_for,
      sort_order,
      created_at,
      updated_at
    from public.store_payment_methods
  ) pm
),
realized_by_day_payment_method as (
  select coalesce(jsonb_agg(to_jsonb(r) order by entry_date desc, store_id, payment_method_code), '[]'::jsonb) as data
  from (
    select
      ce.store_id,
      ce.entry_date,
      coalesce(ce.payment_method_code, ce.payment_method, 'sem_metodo') as payment_method_code,
      count(*) as entries_count,
      coalesce(sum(ce.amount) filter (where ce.direction = 'in'), 0) as total_in,
      coalesce(sum(ce.amount) filter (where ce.direction = 'out'), 0) as total_out,
      coalesce(sum(case when ce.direction = 'in' then ce.amount else -ce.amount end), 0) as balance
    from public.cashbook_entries ce
    where ce.status <> 'cancelled'
      and coalesce(ce.affects_balance, true) = true
    group by ce.store_id, ce.entry_date, coalesce(ce.payment_method_code, ce.payment_method, 'sem_metodo')
    order by ce.entry_date desc, ce.store_id, payment_method_code
    limit 200
  ) r
),
pending_by_day as (
  select coalesce(jsonb_agg(to_jsonb(p) order by entry_date desc, store_id, payment_method_code), '[]'::jsonb) as data
  from (
    select
      ce.store_id,
      ce.entry_date,
      coalesce(ce.payment_method_code, ce.payment_method, 'sem_metodo') as payment_method_code,
      count(*) as pending_count,
      coalesce(sum(ce.amount) filter (where ce.direction = 'in'), 0) as pending_in,
      coalesce(sum(ce.amount) filter (where ce.direction = 'out'), 0) as pending_out,
      coalesce(sum(case when ce.direction = 'in' then ce.amount else -ce.amount end), 0) as pending_balance
    from public.cashbook_entries ce
    where ce.status <> 'cancelled'
      and (
        coalesce(ce.affects_balance, false) = false
        or ce.payment_method_code = 'pending'
        or ce.payment_method = 'pending'
      )
    group by ce.store_id, ce.entry_date, coalesce(ce.payment_method_code, ce.payment_method, 'sem_metodo')
    order by ce.entry_date desc, ce.store_id, payment_method_code
    limit 200
  ) p
),
recent_cashbook_entries as (
  select coalesce(jsonb_agg(to_jsonb(e) order by occurred_at desc nulls last, created_at desc nulls last), '[]'::jsonb) as data
  from (
    select
      ce.id,
      ce.store_id,
      ce.entry_code,
      ce.entry_date,
      ce.occurred_at,
      ce.type,
      ce.direction,
      ce.amount,
      ce.description,
      ce.payment_method,
      ce.payment_method_code,
      ce.status,
      ce.affects_balance,
      ce.source,
      ce.order_id,
      ce.customer_id,
      ce.metadata,
      ce.created_at,
      ce.updated_at
    from public.cashbook_entries ce
    order by ce.occurred_at desc nulls last, ce.created_at desc nulls last
    limit 100
  ) e
),
financial_functions as (
  select coalesce(jsonb_agg(to_jsonb(f) order by function_name), '[]'::jsonb) as data
  from (
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arguments,
      p.prosecdef as security_definer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname ilike '%cashbook%'
        or p.proname ilike '%payment%'
        or p.proname ilike '%finance%'
        or p.proname ilike '%closing%'
        or p.proname ilike '%closure%'
      )
  ) f
)
select jsonb_pretty(jsonb_build_object(
  'related_tables', related_tables.data,
  'cashbook_entries_columns', cashbook_entries_columns.data,
  'cashbook_constraints', cashbook_constraints.data,
  'store_payment_methods', store_payment_methods.data,
  'realized_by_day_payment_method', realized_by_day_payment_method.data,
  'pending_by_day', pending_by_day.data,
  'recent_cashbook_entries', recent_cashbook_entries.data,
  'financial_functions', financial_functions.data
)) as cashbook_day_closing_diagnostic
from related_tables,
     cashbook_entries_columns,
     cashbook_constraints,
     store_payment_methods,
     realized_by_day_payment_method,
     pending_by_day,
     recent_cashbook_entries,
     financial_functions;
