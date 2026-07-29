-- POS_9 — Reparo controlado — ocorrência resolvida sem entrada de reposição
--
-- Contexto:
-- A ocorrência 47c80994-73c0-4ccb-ac48-ad0f68d75f55 foi marcada como resolvida,
-- mas ainda não possui lançamento de reposição vinculado no Livro Diário.
--
-- Este script chama a RPC nova para criar a entrada de reposição e atualizar metadata.

select public.resolve_cashbook_closing_occurrence_safe(
  '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
  '47c80994-73c0-4ccb-ac48-ad0f68d75f55'::uuid,
  'resolved',
  'cash_replenishment',
  'Reposição do valor de volta ao caixa',
  jsonb_build_object(
    'financial_effect', 'cash_replenishment',
    'replenishment_amount', 1.00,
    'payment_method_code', 'cash',
    'occurred_at', now()
  )
) as result;

select
  'cashbook_replenishment_entries' as section,
  id,
  entry_date,
  occurred_at,
  type,
  direction,
  amount,
  description,
  payment_method_code,
  status,
  affects_balance,
  metadata
from public.cashbook_entries
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and metadata ->> 'source' = 'cashbook_closing_occurrence_resolution'
order by created_at desc;

select
  'occurrence_after_repair' as section,
  id,
  closing_date,
  status,
  resolution_type,
  resolution_notes,
  metadata ->> 'replenishment_cashbook_created' as replenishment_cashbook_created,
  metadata ->> 'replenishment_amount' as replenishment_amount,
  metadata ->> 'replenishment_payment_method_code' as replenishment_payment_method_code,
  metadata -> 'replenishment_cashbook_result' as replenishment_cashbook_result
from public.cashbook_closing_occurrences
where id = '47c80994-73c0-4ccb-ac48-ad0f68d75f55'::uuid;
