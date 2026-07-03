-- POS_9 — Validação — classificador de cashbook_entries por metadata
-- Execute após aplicar:
-- supabase/migrations/20260703040000_cashbook_entries_metadata_classifier.sql

-- 1) Função e trigger
select
  'trigger' as section,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
from pg_trigger
where tgrelid = 'public.cashbook_entries'::regclass
  and tgname = 'trg_cashbook_entry_metadata_classification';

select
  'function' as section,
  p.proname as function_name,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'apply_cashbook_entry_metadata_classification';

-- 2) Entradas classificadas por metadata
select
  'classified_entries' as section,
  e.id,
  e.entry_code,
  e.entry_date,
  e.type,
  e.direction,
  e.amount,
  e.description,
  e.account_plan_code,
  e.source_financial_account_id,
  e.destination_financial_account_id,
  src.code as source_account_code,
  dst.code as destination_account_code,
  e.is_transfer,
  e.affects_cash_drawer,
  e.affects_financial_result,
  e.metadata ->> 'classification_source' as classification_source,
  e.metadata ->> 'classification_applied_at' as classification_applied_at
from public.cashbook_entries e
left join public.store_financial_accounts src on src.id = e.source_financial_account_id
left join public.store_financial_accounts dst on dst.id = e.destination_financial_account_id
where e.store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and e.metadata ->> 'classification_source' = 'cashbook_entry_metadata_trigger'
order by e.updated_at desc
limit 20;

-- 3) Reposição de divergência continua classificada
select
  'replenishment_check' as section,
  e.id,
  e.entry_code,
  e.amount,
  e.description,
  e.account_plan_code,
  dst.code as destination_account_code,
  e.affects_cash_drawer,
  e.affects_financial_result,
  e.metadata ->> 'occurrence_id' as occurrence_id
from public.cashbook_entries e
left join public.store_financial_accounts dst on dst.id = e.destination_financial_account_id
where e.store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and e.metadata ->> 'source' = 'cashbook_closing_occurrence_resolution'
order by e.created_at desc;
