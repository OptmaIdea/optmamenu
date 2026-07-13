-- POS_9 — Saneamento seguro do flag affects_cash_drawer no Livro Diário
-- Objetivo: preencher affects_cash_drawer quando estiver NULL, usando o método de pagamento.
-- Uso: rode no SQL Editor do Supabase. Altera apenas cashbook_entries.affects_cash_drawer e metadata.
-- Regra:
--   dinheiro/cash -> true
--   pix/cartao/outros digitais -> false

WITH candidates AS (
  SELECT
    e.id,
    e.store_id,
    s.name AS store_name,
    s.slug AS store_slug,
    e.type,
    e.direction,
    e.payment_method_code,
    e.amount,
    CASE
      WHEN lower(coalesce(e.payment_method_code, '')) IN ('cash', 'dinheiro') THEN true
      WHEN lower(coalesce(e.payment_method_code, '')) IN ('pix', 'card', 'debit_card', 'credit_card') THEN false
      ELSE false
    END AS next_affects_cash_drawer
  FROM public.cashbook_entries e
  JOIN public.stores s ON s.id = e.store_id
  WHERE e.affects_cash_drawer IS NULL
    AND coalesce(e.status, 'confirmed') NOT IN ('cancelled', 'canceled', 'voided')
    AND lower(coalesce(e.payment_method_code, '')) IN ('cash', 'dinheiro', 'pix', 'card', 'debit_card', 'credit_card')
), updated AS (
  UPDATE public.cashbook_entries e
  SET
    affects_cash_drawer = c.next_affects_cash_drawer,
    metadata = coalesce(e.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'affects_cash_drawer_backfilled', true,
        'affects_cash_drawer_backfill_source', 'fix_cashbook_entries_affects_cash_drawer_from_payment',
        'affects_cash_drawer_backfilled_at', now()
      )
  FROM candidates c
  WHERE e.id = c.id
  RETURNING
    e.id,
    c.store_name,
    c.store_slug,
    c.type,
    c.direction,
    c.payment_method_code,
    c.amount,
    c.next_affects_cash_drawer
)
SELECT
  'updated_summary' AS section,
  store_name,
  store_slug,
  type,
  direction,
  payment_method_code,
  next_affects_cash_drawer AS affects_cash_drawer,
  count(*)::integer AS updated_entries,
  sum(amount)::numeric(12, 2) AS updated_total
FROM updated
GROUP BY store_name, store_slug, type, direction, payment_method_code, next_affects_cash_drawer
ORDER BY store_name, type, direction, payment_method_code;
