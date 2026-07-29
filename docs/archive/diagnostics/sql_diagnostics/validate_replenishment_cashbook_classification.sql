-- POS_9 — Validação — classificação de reposição de divergência
-- Execute após aplicar:
-- supabase/migrations/20260703033000_classify_replenishment_cashbook_entry.sql

-- 1) Função atualizada
select
  'function' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'resolve_cashbook_closing_occurrence_safe';

-- 2) Conta caixa físico da loja
select
  'cash_drawer_account' as section,
  id,
  store_id,
  code,
  name,
  account_type,
  active,
  is_default
from public.store_financial_accounts
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and code = 'cash_drawer';

-- 3) Entradas de reposição classificadas
select
  'classified_replenishment_entries' as section,
  e.id,
  e.entry_code,
  e.entry_date,
  e.type,
  e.direction,
  e.amount,
  e.description,
  e.payment_method_code,
  e.account_plan_code,
  e.destination_financial_account_id,
  a.code as destination_account_code,
  a.name as destination_account_name,
  e.affects_cash_drawer,
  e.affects_financial_result,
  e.affects_balance,
  e.metadata
from public.cashbook_entries e
left join public.store_financial_accounts a on a.id = e.destination_financial_account_id
where e.store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and e.metadata ->> 'source' = 'cashbook_closing_occurrence_resolution'
order by e.created_at desc;

-- 4) Ocorrências resolvidas com vínculo de lançamento
select
  'occurrences_replenishment_links' as section,
  id,
  closing_date,
  status,
  resolution_type,
  resolution_notes,
  metadata ->> 'replenishment_cashbook_created' as created,
  metadata ->> 'replenishment_cashbook_entry_id' as cashbook_entry_id,
  metadata ->> 'replenishment_account_plan_code' as account_plan_code,
  metadata ->> 'replenishment_destination_account_id' as destination_account_id
from public.cashbook_closing_occurrences
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and metadata ->> 'replenishment_cashbook_created' = 'true'
order by updated_at desc;
