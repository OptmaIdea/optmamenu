-- POS_9 / v0.9.14 — Saneamento de lançamentos fictícios do Livro Diário
-- Objetivo:
-- - Cancelar/anular os lançamentos manuais antigos de teste da Gelinhares.
-- - Remover o warning cashbook_missing_account_plan do diagnóstico de pré-publicação.
-- - Preservar produtos, categorias, plano de contas e contas financeiras.
--
-- Uso: rode no SQL Editor do Supabase.
-- Segurança:
-- - Limitado à loja gelinharessjn.
-- - Limitado aos entry_code retornados no diagnóstico.
-- - Não apaga registros; marca como cancelado e sem impacto financeiro.

BEGIN;

WITH target_entries AS (
  SELECT e.id, e.entry_code, e.entry_date, e.description, e.amount, e.direction, e.status
  FROM public.cashbook_entries e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.slug = 'gelinharessjn'
    AND e.entry_code IN (
      'CXA-20260706-220017-66F0',
      'CXA-20260706-215949-38CF',
      'CXA-20260706-222329-3920',
      'CXA-20260706-215932-0BD7',
      'CXA-20260505-163801-F263',
      'CXA-20260502-150614-CFC8',
      'CXA-20260502-150523-20D9'
    )
)
SELECT
  'before_cancel_test_entries' AS section,
  COUNT(*) AS matched_count,
  jsonb_agg(
    jsonb_build_object(
      'entry_code', entry_code,
      'entry_date', entry_date,
      'description', description,
      'amount', amount,
      'direction', direction,
      'status', status
    )
    ORDER BY entry_date DESC, entry_code
  ) AS entries
FROM target_entries;

UPDATE public.cashbook_entries e
SET
  status = 'cancelled',
  affects_balance = false,
  affects_cash_drawer = false,
  affects_financial_result = false,
  notes = trim(BOTH from COALESCE(e.notes, '') || E'\n[Saneamento pré-publicação v0.9.14] Lançamento fictício de teste cancelado antes de testes reais.'),
  metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
    'prepublish_sanitized', true,
    'prepublish_sanitized_at', now(),
    'prepublish_sanitized_reason', 'test_cashbook_entry_before_real_clients',
    'prepublish_version', '0.9.14'
  ),
  updated_at = now()
FROM public.stores s
WHERE s.id = e.store_id
  AND s.slug = 'gelinharessjn'
  AND e.entry_code IN (
    'CXA-20260706-220017-66F0',
    'CXA-20260706-215949-38CF',
    'CXA-20260706-222329-3920',
    'CXA-20260706-215932-0BD7',
    'CXA-20260505-163801-F263',
    'CXA-20260502-150614-CFC8',
    'CXA-20260502-150523-20D9'
  );

WITH target_entries AS (
  SELECT e.id, e.entry_code, e.entry_date, e.description, e.amount, e.direction, e.status, e.affects_balance
  FROM public.cashbook_entries e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.slug = 'gelinharessjn'
    AND e.entry_code IN (
      'CXA-20260706-220017-66F0',
      'CXA-20260706-215949-38CF',
      'CXA-20260706-222329-3920',
      'CXA-20260706-215932-0BD7',
      'CXA-20260505-163801-F263',
      'CXA-20260502-150614-CFC8',
      'CXA-20260502-150523-20D9'
    )
)
SELECT
  'after_cancel_test_entries' AS section,
  COUNT(*) AS matched_count,
  COUNT(*) FILTER (WHERE status IN ('cancelled', 'canceled', 'voided') AND affects_balance IS DISTINCT FROM true) AS sanitized_count,
  jsonb_agg(
    jsonb_build_object(
      'entry_code', entry_code,
      'entry_date', entry_date,
      'description', description,
      'amount', amount,
      'direction', direction,
      'status', status,
      'affects_balance', affects_balance
    )
    ORDER BY entry_date DESC, entry_code
  ) AS entries
FROM target_entries;

COMMIT;
