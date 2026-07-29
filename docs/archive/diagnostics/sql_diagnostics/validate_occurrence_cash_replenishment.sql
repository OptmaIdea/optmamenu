-- POS_9 — Validação — Reposição financeira de divergência de fechamento
-- Execute após aplicar:
-- supabase/migrations/20260703010000_resolve_occurrence_cash_replenishment.sql

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

-- 2) Ocorrências abertas
select
  'open_occurrences' as section,
  id,
  store_id,
  closing_id,
  closing_date,
  status,
  divergence_type,
  divergence_level,
  expected_total,
  confirmed_total,
  difference_total,
  opening_notes,
  resolution_type,
  resolution_notes,
  metadata
from public.cashbook_closing_occurrences
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and status in ('open', 'under_review', 'waiting_external_confirmation')
order by closing_date desc;

-- 3) Entradas de reposição no Livro Diário
select
  'cashbook_replenishment_entries' as section,
  id,
  store_id,
  entry_code,
  entry_date,
  occurred_at,
  type,
  direction,
  amount,
  description,
  payment_method_code,
  status,
  affects_balance,
  source,
  metadata,
  created_at
from public.cashbook_entries
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and metadata ->> 'source' = 'cashbook_closing_occurrence_resolution'
order by created_at desc;

-- 4) Ocorrências com metadata de reposição
select
  'occurrences_with_replenishment_metadata' as section,
  id,
  closing_date,
  status,
  divergence_type,
  difference_total,
  resolution_type,
  resolution_notes,
  resolved_at,
  metadata ->> 'replenishment_cashbook_created' as replenishment_cashbook_created,
  metadata ->> 'replenishment_amount' as replenishment_amount,
  metadata ->> 'replenishment_payment_method_code' as replenishment_payment_method_code,
  metadata -> 'replenishment_cashbook_result' as replenishment_cashbook_result
from public.cashbook_closing_occurrences
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
order by updated_at desc
limit 20;
