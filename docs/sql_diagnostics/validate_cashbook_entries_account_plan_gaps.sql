-- POS_9 — Diagnóstico de lacunas de Plano de Contas no Livro Diário
-- Objetivo: identificar lançamentos sem account_plan_code e separar o que tem sugestão automática segura.
-- Uso: rode no SQL Editor do Supabase. Não altera dados.

CREATE TEMP TABLE tmp_cashbook_account_plan_gap_diagnostic AS
WITH entries AS (
  SELECT
    e.id,
    e.store_id,
    e.entry_date,
    e.occurred_at,
    e.entry_code,
    e.type,
    e.direction,
    e.description,
    e.amount,
    e.status,
    lower(COALESCE(e.payment_method_code, e.payment_method, '')) AS payment_method,
    e.account_plan_code,
    e.affects_financial_result,
    e.metadata
  FROM public.cashbook_entries e
  WHERE e.status NOT IN ('cancelled', 'canceled', 'voided')
    AND e.affects_balance IS DISTINCT FROM false
), suggestions AS (
  SELECT
    e.*,
    CASE
      WHEN e.type = 'sale' AND e.payment_method IN ('cash', 'dinheiro') THEN 'sale_cash'
      WHEN e.type = 'sale' AND e.payment_method = 'pix' THEN 'sale_pix'
      WHEN e.type = 'sale' AND e.payment_method = 'debit_card' THEN 'sale_debit'
      WHEN e.type = 'sale' AND e.payment_method = 'credit_card' THEN 'sale_credit'
      WHEN e.type = 'sale' AND e.payment_method = 'card' THEN 'sale_credit'
      ELSE NULL
    END AS suggested_account_plan_code,
    CASE
      WHEN e.type = 'sale' AND e.payment_method IN ('cash', 'dinheiro', 'pix', 'debit_card', 'credit_card', 'card') THEN 'auto_safe_sale_payment_method'
      WHEN e.type IN ('manual_income', 'manual_expense', 'refund', 'adjustment') THEN 'manual_review_needed'
      WHEN e.type = 'transfer' THEN 'transfer_review_needed'
      ELSE 'review_needed'
    END AS suggestion_reason
  FROM entries e
)
SELECT
  s.*,
  p.name AS suggested_account_plan_name,
  p.active AS suggested_account_plan_active,
  (s.suggested_account_plan_code IS NOT NULL AND p.code IS NOT NULL AND p.active = true) AS can_auto_apply
FROM suggestions s
LEFT JOIN public.cashbook_account_plan p ON p.code = s.suggested_account_plan_code;

SELECT
  'summary_by_store' AS section,
  st.name AS store_name,
  st.slug AS store_slug,
  COUNT(*)::integer AS total_entries,
  COUNT(*) FILTER (WHERE d.account_plan_code IS NULL)::integer AS missing_account_plan,
  COUNT(*) FILTER (WHERE d.account_plan_code IS NULL AND d.can_auto_apply = true)::integer AS auto_safe_candidates,
  COUNT(*) FILTER (WHERE d.account_plan_code IS NULL AND d.suggestion_reason = 'manual_review_needed')::integer AS manual_review_needed,
  COUNT(*) FILTER (WHERE d.account_plan_code IS NULL AND d.suggestion_reason = 'transfer_review_needed')::integer AS transfer_review_needed
FROM tmp_cashbook_account_plan_gap_diagnostic d
JOIN public.stores st ON st.id = d.store_id
GROUP BY st.name, st.slug
ORDER BY st.name;

SELECT
  'summary_by_type' AS section,
  st.name AS store_name,
  st.slug AS store_slug,
  d.type,
  d.direction,
  d.payment_method,
  d.suggestion_reason,
  d.suggested_account_plan_code,
  d.suggested_account_plan_name,
  d.can_auto_apply,
  COUNT(*)::integer AS entries_count,
  SUM(d.amount)::numeric(12,2) AS total_amount
FROM tmp_cashbook_account_plan_gap_diagnostic d
JOIN public.stores st ON st.id = d.store_id
WHERE d.account_plan_code IS NULL
GROUP BY st.name, st.slug, d.type, d.direction, d.payment_method, d.suggestion_reason, d.suggested_account_plan_code, d.suggested_account_plan_name, d.can_auto_apply
ORDER BY st.name, d.type, d.payment_method, d.suggestion_reason;

SELECT
  'sample_missing_account_plan' AS section,
  st.name AS store_name,
  st.slug AS store_slug,
  d.entry_date,
  d.entry_code,
  d.type,
  d.direction,
  d.payment_method,
  d.amount,
  d.description,
  d.suggestion_reason,
  d.suggested_account_plan_code,
  d.suggested_account_plan_name,
  d.can_auto_apply
FROM tmp_cashbook_account_plan_gap_diagnostic d
JOIN public.stores st ON st.id = d.store_id
WHERE d.account_plan_code IS NULL
ORDER BY st.name, d.entry_date DESC, d.type, d.amount DESC
LIMIT 80;

SELECT
  'missing_suggested_accounts' AS section,
  suggested_account_plan_code,
  COUNT(*)::integer AS affected_entries
FROM tmp_cashbook_account_plan_gap_diagnostic
WHERE account_plan_code IS NULL
  AND suggested_account_plan_code IS NOT NULL
  AND can_auto_apply = false
GROUP BY suggested_account_plan_code
ORDER BY suggested_account_plan_code;
