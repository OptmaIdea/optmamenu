-- POS_9 — Diagnóstico de classificação financeira do Livro Diário
-- Objetivo: identificar lançamentos sem Plano de Contas e/ou Conta Financeira vinculada.
-- Uso: rode no SQL Editor do Supabase. Não altera dados.

DROP TABLE IF EXISTS tmp_cashbook_entries_financial_classification;

CREATE TEMP TABLE tmp_cashbook_entries_financial_classification AS
SELECT
  e.id,
  e.store_id,
  s.name AS store_name,
  s.slug AS store_slug,
  e.entry_date,
  e.occurred_at,
  e.entry_code,
  e.type,
  e.direction,
  e.status,
  e.amount,
  e.description,
  COALESCE(e.payment_method_code, e.payment_method) AS payment_method_code,
  e.account_plan_code,
  e.source_financial_account_id,
  source_account.code AS source_financial_account_code,
  source_account.name AS source_financial_account_name,
  source_account.account_type AS source_financial_account_type,
  e.destination_financial_account_id,
  destination_account.code AS destination_financial_account_code,
  destination_account.name AS destination_financial_account_name,
  destination_account.account_type AS destination_financial_account_type,
  COALESCE(e.is_transfer, false) AS is_transfer,
  e.affects_cash_drawer,
  e.affects_financial_result,
  e.affects_balance,
  e.metadata,
  (e.account_plan_code IS NULL) AS missing_account_plan,
  (
    e.direction = 'out'
    AND e.source_financial_account_id IS NULL
    AND COALESCE(e.is_transfer, false) = false
    AND COALESCE(e.status, '') NOT IN ('cancelled', 'canceled', 'voided')
  ) AS missing_source_account,
  (
    e.direction = 'in'
    AND e.destination_financial_account_id IS NULL
    AND COALESCE(e.is_transfer, false) = false
    AND COALESCE(e.status, '') NOT IN ('cancelled', 'canceled', 'voided')
  ) AS missing_destination_account,
  (
    COALESCE(e.is_transfer, false) = true
    AND (e.source_financial_account_id IS NULL OR e.destination_financial_account_id IS NULL)
    AND COALESCE(e.status, '') NOT IN ('cancelled', 'canceled', 'voided')
  ) AS missing_transfer_side
FROM public.cashbook_entries e
JOIN public.stores s ON s.id = e.store_id
LEFT JOIN public.store_financial_accounts source_account ON source_account.id = e.source_financial_account_id
LEFT JOIN public.store_financial_accounts destination_account ON destination_account.id = e.destination_financial_account_id;

SELECT
  'summary_by_store' AS section,
  store_name,
  store_slug,
  COUNT(*)::integer AS total_entries,
  COUNT(*) FILTER (WHERE COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'voided'))::integer AS active_entries,
  COUNT(*) FILTER (WHERE missing_account_plan)::integer AS missing_account_plan,
  COUNT(*) FILTER (WHERE missing_source_account)::integer AS missing_source_account,
  COUNT(*) FILTER (WHERE missing_destination_account)::integer AS missing_destination_account,
  COUNT(*) FILTER (WHERE missing_transfer_side)::integer AS missing_transfer_side,
  COUNT(*) FILTER (
    WHERE missing_account_plan
       OR missing_source_account
       OR missing_destination_account
       OR missing_transfer_side
  )::integer AS entries_with_classification_issue
FROM tmp_cashbook_entries_financial_classification
GROUP BY store_name, store_slug
ORDER BY store_name;

SELECT
  'summary_by_type' AS section,
  store_name,
  store_slug,
  type,
  direction,
  payment_method_code,
  COUNT(*)::integer AS total_entries,
  COUNT(*) FILTER (WHERE missing_account_plan)::integer AS missing_account_plan,
  COUNT(*) FILTER (WHERE missing_source_account)::integer AS missing_source_account,
  COUNT(*) FILTER (WHERE missing_destination_account)::integer AS missing_destination_account,
  COUNT(*) FILTER (WHERE missing_transfer_side)::integer AS missing_transfer_side
FROM tmp_cashbook_entries_financial_classification
GROUP BY store_name, store_slug, type, direction, payment_method_code
ORDER BY store_name, type, direction, payment_method_code NULLS LAST;

SELECT
  'sample_issues' AS section,
  store_name,
  store_slug,
  entry_date,
  occurred_at,
  entry_code,
  type,
  direction,
  status,
  amount,
  description,
  payment_method_code,
  account_plan_code,
  source_financial_account_code,
  destination_financial_account_code,
  missing_account_plan,
  missing_source_account,
  missing_destination_account,
  missing_transfer_side
FROM tmp_cashbook_entries_financial_classification
WHERE missing_account_plan
   OR missing_source_account
   OR missing_destination_account
   OR missing_transfer_side
ORDER BY occurred_at DESC
LIMIT 100;

SELECT
  'cash_drawer_flags' AS section,
  store_name,
  store_slug,
  type,
  direction,
  payment_method_code,
  affects_cash_drawer,
  COUNT(*)::integer AS total_entries,
  SUM(CASE WHEN direction = 'out' THEN -amount ELSE amount END)::numeric(12,2) AS signed_total
FROM tmp_cashbook_entries_financial_classification
WHERE COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'voided')
GROUP BY store_name, store_slug, type, direction, payment_method_code, affects_cash_drawer
ORDER BY store_name, type, direction, payment_method_code NULLS LAST;
