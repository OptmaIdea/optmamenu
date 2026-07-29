-- POS_9 / v0.9.14 — Saneamento de dados do diagnóstico financeiro de pré-publicação
-- Objetivo:
-- - Resolver violações de observação obrigatória em lançamentos de teste com Outras entradas/saídas.
-- - Oferecer um bloco seguro para revisão manual de lançamentos antigos sem Plano de Contas.
--
-- Uso recomendado:
-- 1. Rode a PRÉVIA.
-- 2. Confira se os códigos são exatamente os registros de teste/histórico esperados.
-- 3. Aplique somente os blocos desejados.
-- 4. Rode novamente docs/sql_diagnostics/validate_pos9_financial_prepublish.sql.
--
-- Este arquivo não altera vendas reais, pedidos, transferências, valores, datas ou contas financeiras.

-- =========================================================
-- 1) PRÉVIA — lançamentos com categoria que exige observação
-- =========================================================
SELECT
  'preview_required_notes_violations' AS section,
  e.entry_code,
  s.name AS store_name,
  s.slug AS store_slug,
  e.entry_date,
  e.type,
  e.direction,
  e.amount,
  e.description,
  e.notes,
  e.account_plan_code,
  p.name AS account_plan_name
FROM public.cashbook_entries e
JOIN public.stores s ON s.id = e.store_id
JOIN public.cashbook_account_plan p ON p.code = e.account_plan_code
WHERE e.status NOT IN ('cancelled', 'canceled', 'voided')
  AND COALESCE((p.metadata ->> 'requires_notes')::boolean, false) IS TRUE
  AND (
    COALESCE(trim(e.description), '') = ''
    OR COALESCE(trim(e.notes), '') = ''
  )
ORDER BY e.entry_date DESC, e.created_at DESC;

-- =========================================================
-- 2) CORREÇÃO SEGURA — preencher observações dos testes feitos no fechamento
-- =========================================================
-- Estes dois códigos vieram do diagnóstico de 16/07/2026 e representam registros de teste.
-- Caso eles sejam registros reais, edite a observação abaixo antes de aplicar.
UPDATE public.cashbook_entries e
SET
  notes = CASE e.entry_code
    WHEN 'CXA-20260716-125813-460A' THEN 'Registro de teste usado para validar a categoria Outras entradas no fechamento financeiro da versão 0.9.14.'
    WHEN 'CXA-20260716-125741-D6F3' THEN 'Registro de teste usado para validar a categoria Outras saídas no fechamento financeiro da versão 0.9.14.'
    ELSE e.notes
  END,
  metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
    'prepublish_financial_cleanup_applied_at', now(),
    'prepublish_financial_cleanup_source', 'resolve_pos9_financial_prepublish_data',
    'prepublish_financial_cleanup_reason', 'required_notes_for_other_manual_categories'
  )
WHERE e.entry_code IN (
  'CXA-20260716-125813-460A',
  'CXA-20260716-125741-D6F3'
)
AND e.status NOT IN ('cancelled', 'canceled', 'voided')
AND COALESCE(trim(e.notes), '') = '';

-- =========================================================
-- 3) PRÉVIA — lançamentos antigos sem Plano de Contas
-- =========================================================
SELECT
  'preview_missing_account_plan' AS section,
  e.entry_code,
  s.name AS store_name,
  s.slug AS store_slug,
  e.entry_date,
  e.type,
  e.direction,
  lower(COALESCE(e.payment_method_code, e.payment_method, '')) AS payment_method,
  e.amount,
  e.description,
  e.notes,
  e.account_plan_code,
  CASE
    WHEN e.description ILIKE '%mercado%' THEN 'small_purchase'
    WHEN e.description ILIKE '%teste%' THEN NULL
    WHEN e.type = 'manual_income' THEN 'other_income'
    WHEN e.type = 'manual_expense' THEN 'other_expense'
    ELSE NULL
  END AS possible_account_plan_code,
  CASE
    WHEN e.description ILIKE '%teste%' THEN 'Registro aparenta ser teste; avaliar cancelar/remover do ambiente de publicação ou classificar manualmente.'
    WHEN e.description ILIKE '%mercado%' THEN 'Possível pequena compra.'
    WHEN e.type = 'manual_income' THEN 'Possível Outras entradas; exige observação.'
    WHEN e.type = 'manual_expense' THEN 'Possível Outras saídas; exige observação.'
    ELSE 'Revisão manual necessária.'
  END AS review_note
FROM public.cashbook_entries e
JOIN public.stores s ON s.id = e.store_id
WHERE e.account_plan_code IS NULL
  AND e.status NOT IN ('cancelled', 'canceled', 'voided')
  AND e.affects_balance IS DISTINCT FROM false
ORDER BY e.entry_date DESC, e.created_at DESC;

-- =========================================================
-- 4) TEMPLATE — classificação manual dos lançamentos antigos
-- =========================================================
-- Não aplicamos automaticamente porque estes lançamentos exigem decisão humana.
-- Depois de decidir, descomente e ajuste o bloco abaixo.
--
-- WITH decisions(entry_code, account_plan_code, notes_to_add) AS (
--   VALUES
--     ('CXA-20260706-220017-66F0', 'other_expense', 'Classificado manualmente na revisão financeira de pré-publicação.'),
--     ('CXA-20260706-215949-38CF', 'other_income', 'Classificado manualmente na revisão financeira de pré-publicação.'),
--     ('CXA-20260706-222329-3920', 'other_expense', 'Classificado manualmente na revisão financeira de pré-publicação.'),
--     ('CXA-20260706-215932-0BD7', 'other_income', 'Classificado manualmente na revisão financeira de pré-publicação.'),
--     ('CXA-20260505-163801-F263', 'small_purchase', 'Compra no Mercado Central classificada como pequena compra.'),
--     ('CXA-20260502-150614-CFC8', 'other_expense', 'Classificado manualmente na revisão financeira de pré-publicação.'),
--     ('CXA-20260502-150523-20D9', 'other_income', 'Classificado manualmente na revisão financeira de pré-publicação.')
-- ),
-- valid_decisions AS (
--   SELECT
--     e.id,
--     d.entry_code,
--     d.account_plan_code,
--     d.notes_to_add,
--     p.name AS account_plan_name,
--     COALESCE((p.metadata ->> 'requires_notes')::boolean, false) AS requires_notes
--   FROM decisions d
--   JOIN public.cashbook_entries e ON e.entry_code = d.entry_code
--   JOIN public.cashbook_account_plan p ON p.code = d.account_plan_code AND p.active = true
--   WHERE e.account_plan_code IS NULL
-- )
-- UPDATE public.cashbook_entries e
-- SET
--   account_plan_code = vd.account_plan_code,
--   notes = CASE
--     WHEN COALESCE(trim(e.notes), '') <> '' THEN e.notes
--     WHEN vd.requires_notes THEN vd.notes_to_add
--     ELSE e.notes
--   END,
--   metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
--     'account_plan_manual_review_applied_at', now(),
--     'account_plan_manual_review_source', 'resolve_pos9_financial_prepublish_data',
--     'account_plan_code', vd.account_plan_code,
--     'account_plan_name', vd.account_plan_name
--   )
-- FROM valid_decisions vd
-- WHERE e.id = vd.id;

-- =========================================================
-- 5) PÓS-CHECAGEM rápida dos registros tratados neste arquivo
-- =========================================================
SELECT
  'post_check_target_entries' AS section,
  e.entry_code,
  e.entry_date,
  e.type,
  e.direction,
  e.amount,
  e.description,
  e.notes,
  e.account_plan_code,
  p.name AS account_plan_name
FROM public.cashbook_entries e
LEFT JOIN public.cashbook_account_plan p ON p.code = e.account_plan_code
WHERE e.entry_code IN (
  'CXA-20260716-125813-460A',
  'CXA-20260716-125741-D6F3',
  'CXA-20260706-220017-66F0',
  'CXA-20260706-215949-38CF',
  'CXA-20260706-222329-3920',
  'CXA-20260706-215932-0BD7',
  'CXA-20260505-163801-F263',
  'CXA-20260502-150614-CFC8',
  'CXA-20260502-150523-20D9'
)
ORDER BY e.entry_date DESC, e.created_at DESC;
