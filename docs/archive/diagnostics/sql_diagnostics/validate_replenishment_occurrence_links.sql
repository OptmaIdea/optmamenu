-- POS_9 — Validação — vínculo da ocorrência com reposição no Livro Diário
-- Execute após aplicar:
-- supabase/migrations/20260703034500_sync_replenishment_occurrence_links.sql

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
  metadata ->> 'replenishment_destination_account_id' as destination_account_id,
  metadata ->> 'replenishment_link_synced_at' as link_synced_at
from public.cashbook_closing_occurrences
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and metadata ->> 'replenishment_cashbook_created' = 'true'
order by updated_at desc;

select
  'linked_cashbook_entries' as section,
  e.id,
  e.entry_code,
  e.entry_date,
  e.amount,
  e.description,
  e.account_plan_code,
  e.destination_financial_account_id,
  a.code as destination_account_code,
  a.name as destination_account_name,
  e.affects_cash_drawer,
  e.affects_financial_result,
  e.metadata ->> 'occurrence_id' as occurrence_id
from public.cashbook_entries e
left join public.store_financial_accounts a on a.id = e.destination_financial_account_id
where e.store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and e.metadata ->> 'source' = 'cashbook_closing_occurrence_resolution'
order by e.created_at desc;
