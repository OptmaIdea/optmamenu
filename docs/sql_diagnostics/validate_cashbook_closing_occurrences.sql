-- POS_9 — Validação — Ocorrências de divergência de fechamento de caixa
--
-- Execute após aplicar:
-- supabase/migrations/20260702221000_create_cashbook_closing_occurrences.sql

-- 1) Tabela criada
select
  'table_exists' as section,
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'cashbook_closing_occurrences';

-- 2) Colunas principais
select
  'columns' as section,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cashbook_closing_occurrences'
order by ordinal_position;

-- 3) Políticas RLS
select
  'policies' as section,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'cashbook_closing_occurrences'
order by policyname;

-- 4) Funções criadas
select
  'functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'list_cashbook_closing_occurrences_safe',
    'resolve_cashbook_closing_occurrence_safe',
    'trg_sync_cashbook_closing_occurrence'
  )
order by p.proname;

-- 5) Trigger criado
select
  'trigger' as section,
  tgname,
  tgenabled,
  pg_get_triggerdef(oid) as definition
from pg_trigger
where tgname = 'trg_sync_cashbook_closing_occurrence';

-- 6) Lista ocorrências da loja Gelinhares
select
  'occurrences_sample' as section,
  public.list_cashbook_closing_occurrences_safe(
    '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
    null,
    50
  ) as result;

-- 7) Contagem por status
select
  'count_by_status' as section,
  status,
  count(*) as total
from public.cashbook_closing_occurrences
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
 group by status
 order by status;
