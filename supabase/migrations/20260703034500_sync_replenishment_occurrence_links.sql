-- POS_9 — Financeiro — sincronizar vínculo retroativo de reposição
--
-- Corrige ocorrências que já possuem reposição criada, mas ainda não guardam
-- o id do lançamento, plano de contas e conta destino no metadata.

WITH matched AS (
  SELECT DISTINCT ON (o.id)
    o.id AS occurrence_id,
    e.id AS cashbook_entry_id,
    e.account_plan_code,
    e.destination_financial_account_id
  FROM public.cashbook_closing_occurrences o
  JOIN public.cashbook_entries e
    ON e.store_id = o.store_id
   AND e.metadata ->> 'source' = 'cashbook_closing_occurrence_resolution'
   AND e.metadata ->> 'occurrence_id' = o.id::text
  WHERE o.metadata ->> 'replenishment_cashbook_created' = 'true'
    AND (
      o.metadata ->> 'replenishment_cashbook_entry_id' IS NULL
      OR o.metadata ->> 'replenishment_account_plan_code' IS NULL
      OR o.metadata ->> 'replenishment_destination_account_id' IS NULL
    )
  ORDER BY o.id, e.created_at DESC
)
UPDATE public.cashbook_closing_occurrences o
SET
  metadata = COALESCE(o.metadata, '{}'::jsonb) || jsonb_build_object(
    'replenishment_cashbook_entry_id', matched.cashbook_entry_id,
    'replenishment_account_plan_code', COALESCE(matched.account_plan_code, 'closing_replenishment'),
    'replenishment_destination_account_id', matched.destination_financial_account_id,
    'replenishment_link_synced_at', now()
  ),
  updated_at = now()
FROM matched
WHERE o.id = matched.occurrence_id;
