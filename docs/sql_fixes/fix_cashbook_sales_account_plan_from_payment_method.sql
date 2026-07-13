-- POS_9 — Saneamento seguro do Plano de Contas em vendas do Livro Diário
-- Objetivo: preencher account_plan_code apenas para vendas antigas sem categoria,
-- usando o método de pagamento como regra objetiva.
--
-- Regra:
-- cash/dinheiro  -> sale_cash
-- pix            -> sale_pix
-- debit_card     -> sale_debit
-- credit_card    -> sale_credit
-- card           -> sale_credit
--
-- Segurança:
-- - Não altera lançamentos manuais.
-- - Não altera valor, data, status, tipo, descrição ou contas financeiras.
-- - Só aplica quando a conta sugerida existe e está ativa.
-- - Registra o backfill em metadata.

CREATE TEMP TABLE tmp_cashbook_sales_account_plan_backfill AS
WITH candidates AS (
  SELECT
    e.id,
    e.store_id,
    e.entry_code,
    e.entry_date,
    e.payment_method_code,
    e.payment_method,
    e.amount,
    e.description,
    CASE
      WHEN lower(COALESCE(e.payment_method_code, e.payment_method, '')) IN ('cash', 'dinheiro') THEN 'sale_cash'
      WHEN lower(COALESCE(e.payment_method_code, e.payment_method, '')) = 'pix' THEN 'sale_pix'
      WHEN lower(COALESCE(e.payment_method_code, e.payment_method, '')) = 'debit_card' THEN 'sale_debit'
      WHEN lower(COALESCE(e.payment_method_code, e.payment_method, '')) IN ('credit_card', 'card') THEN 'sale_credit'
      ELSE NULL
    END AS suggested_account_plan_code
  FROM public.cashbook_entries e
  WHERE e.type = 'sale'
    AND e.direction = 'in'
    AND e.account_plan_code IS NULL
    AND e.status NOT IN ('cancelled', 'canceled', 'voided')
    AND e.affects_balance IS DISTINCT FROM false
), valid_candidates AS (
  SELECT
    c.*,
    p.name AS suggested_account_plan_name
  FROM candidates c
  JOIN public.cashbook_account_plan p
    ON p.code = c.suggested_account_plan_code
   AND p.active = true
  WHERE c.suggested_account_plan_code IS NOT NULL
)
SELECT *
FROM valid_candidates;

-- Prévia do que será alterado.
SELECT
  'preview' AS section,
  s.name AS store_name,
  s.slug AS store_slug,
  lower(COALESCE(b.payment_method_code, b.payment_method, '')) AS payment_method,
  b.suggested_account_plan_code,
  b.suggested_account_plan_name,
  COUNT(*)::integer AS entries_to_update,
  SUM(b.amount)::numeric(12,2) AS amount_total
FROM tmp_cashbook_sales_account_plan_backfill b
JOIN public.stores s ON s.id = b.store_id
GROUP BY s.name, s.slug, lower(COALESCE(b.payment_method_code, b.payment_method, '')), b.suggested_account_plan_code, b.suggested_account_plan_name
ORDER BY s.name, payment_method;

-- Aplicação segura.
UPDATE public.cashbook_entries e
SET
  account_plan_code = b.suggested_account_plan_code,
  metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
    'account_plan_backfill_applied_at', now(),
    'account_plan_backfill_source', 'fix_cashbook_sales_account_plan_from_payment_method',
    'account_plan_backfill_reason', 'sale_payment_method_safe_mapping',
    'account_plan_code', b.suggested_account_plan_code,
    'account_plan_name', b.suggested_account_plan_name
  )
FROM tmp_cashbook_sales_account_plan_backfill b
WHERE e.id = b.id
  AND e.account_plan_code IS NULL;

-- Pós-checagem: vendas ainda sem categoria que poderiam ter sido classificadas.
SELECT
  'post_check_remaining_auto_safe_sales' AS section,
  s.name AS store_name,
  s.slug AS store_slug,
  lower(COALESCE(e.payment_method_code, e.payment_method, '')) AS payment_method,
  COUNT(*)::integer AS remaining_sales_without_account_plan
FROM public.cashbook_entries e
JOIN public.stores s ON s.id = e.store_id
WHERE e.type = 'sale'
  AND e.direction = 'in'
  AND e.account_plan_code IS NULL
  AND e.status NOT IN ('cancelled', 'canceled', 'voided')
  AND e.affects_balance IS DISTINCT FROM false
  AND lower(COALESCE(e.payment_method_code, e.payment_method, '')) IN ('cash', 'dinheiro', 'pix', 'debit_card', 'credit_card', 'card')
GROUP BY s.name, s.slug, lower(COALESCE(e.payment_method_code, e.payment_method, ''))
ORDER BY s.name, payment_method;
