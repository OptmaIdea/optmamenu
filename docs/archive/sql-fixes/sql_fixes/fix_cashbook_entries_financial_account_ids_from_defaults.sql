-- POS_9 — Saneamento seguro dos IDs de contas financeiras no Livro Diário
-- Objetivo: preencher source_financial_account_id / destination_financial_account_id
-- a partir das contas padrão ativas por loja e tipo, sem alterar valores, datas, status ou categorias.
--
-- Pré-requisito: rodar os saneamentos de padrões de contas financeiras antes deste arquivo.
-- Uso: rode no SQL Editor do Supabase.

CREATE TEMP TABLE tmp_cashbook_entries_financial_account_backfill AS
WITH default_accounts AS (
  SELECT
    store_id,
    account_type,
    id AS account_id,
    code AS account_code,
    name AS account_name
  FROM public.store_financial_accounts
  WHERE active = true
    AND is_default = true
), entry_targets AS (
  SELECT
    e.id,
    e.store_id,
    e.type,
    e.direction,
    lower(COALESCE(e.payment_method_code, e.payment_method, '')) AS payment_method,
    CASE
      WHEN lower(COALESCE(e.payment_method_code, e.payment_method, '')) IN ('cash', 'dinheiro') THEN 'cash_drawer'
      WHEN lower(COALESCE(e.payment_method_code, e.payment_method, '')) = 'pix' THEN 'pix_wallet'
      WHEN lower(COALESCE(e.payment_method_code, e.payment_method, '')) IN ('card', 'debit_card', 'credit_card') THEN 'card_receivable'
      ELSE NULL
    END AS target_account_type
  FROM public.cashbook_entries e
  WHERE e.status NOT IN ('cancelled', 'canceled', 'voided')
    AND e.affects_balance IS DISTINCT FROM false
    AND e.type IN ('sale', 'manual_income', 'manual_expense', 'refund', 'adjustment')
), candidates AS (
  SELECT
    e.id,
    e.store_id,
    e.type,
    e.direction,
    e.payment_method,
    e.target_account_type,
    d.account_id,
    d.account_code,
    d.account_name,
    CASE
      WHEN e.direction = 'in' THEN 'destination'
      WHEN e.direction = 'out' THEN 'source'
      ELSE NULL
    END AS target_side
  FROM entry_targets e
  JOIN default_accounts d
    ON d.store_id = e.store_id
   AND d.account_type = e.target_account_type
  WHERE e.target_account_type IS NOT NULL
)
SELECT *
FROM candidates;

-- Prévia do que será atualizado.
SELECT
  'preview' AS section,
  s.name AS store_name,
  s.slug AS store_slug,
  b.type,
  b.direction,
  b.payment_method,
  b.target_account_type,
  b.account_code,
  b.account_name,
  b.target_side,
  COUNT(*)::integer AS entries_to_update
FROM tmp_cashbook_entries_financial_account_backfill b
JOIN public.stores s ON s.id = b.store_id
JOIN public.cashbook_entries e ON e.id = b.id
WHERE (b.target_side = 'destination' AND e.destination_financial_account_id IS NULL)
   OR (b.target_side = 'source' AND e.source_financial_account_id IS NULL)
GROUP BY s.name, s.slug, b.type, b.direction, b.payment_method, b.target_account_type, b.account_code, b.account_name, b.target_side
ORDER BY s.name, b.type, b.payment_method, b.target_side;

-- Aplica entradas: destino financeiro.
UPDATE public.cashbook_entries e
SET
  destination_financial_account_id = b.account_id,
  metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
    'financial_account_backfill_applied_at', now(),
    'financial_account_backfill_source', 'fix_cashbook_entries_financial_account_ids_from_defaults',
    'destination_financial_account_code', b.account_code,
    'destination_financial_account_name', b.account_name
  )
FROM tmp_cashbook_entries_financial_account_backfill b
WHERE e.id = b.id
  AND b.target_side = 'destination'
  AND e.destination_financial_account_id IS NULL;

-- Aplica saídas: origem financeira.
UPDATE public.cashbook_entries e
SET
  source_financial_account_id = b.account_id,
  metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
    'financial_account_backfill_applied_at', now(),
    'financial_account_backfill_source', 'fix_cashbook_entries_financial_account_ids_from_defaults',
    'source_financial_account_code', b.account_code,
    'source_financial_account_name', b.account_name
  )
FROM tmp_cashbook_entries_financial_account_backfill b
WHERE e.id = b.id
  AND b.target_side = 'source'
  AND e.source_financial_account_id IS NULL;

-- Pós-checagem resumida.
SELECT
  'post_check_missing_financial_account' AS section,
  s.name AS store_name,
  s.slug AS store_slug,
  e.type,
  e.direction,
  lower(COALESCE(e.payment_method_code, e.payment_method, '')) AS payment_method,
  COUNT(*)::integer AS remaining_missing
FROM public.cashbook_entries e
JOIN public.stores s ON s.id = e.store_id
WHERE e.status NOT IN ('cancelled', 'canceled', 'voided')
  AND e.affects_balance IS DISTINCT FROM false
  AND e.type IN ('sale', 'manual_income', 'manual_expense', 'refund', 'adjustment')
  AND lower(COALESCE(e.payment_method_code, e.payment_method, '')) IN ('cash', 'dinheiro', 'pix', 'card', 'debit_card', 'credit_card')
  AND (
    (e.direction = 'in' AND e.destination_financial_account_id IS NULL)
    OR (e.direction = 'out' AND e.source_financial_account_id IS NULL)
  )
GROUP BY s.name, s.slug, e.type, e.direction, lower(COALESCE(e.payment_method_code, e.payment_method, ''))
ORDER BY s.name, e.type, payment_method;
