-- POS_9 — Correção de visibilidade das categorias manuais do Livro Diário
-- Objetivo:
-- - Garantir que "Outras entradas" e "Outras saídas" existam e apareçam no modal correto.
-- - Esconder devoluções/cancelamentos de venda do fluxo manual simples.
-- - Não altera lançamentos existentes.

-- 1) Garante as categorias genéricas, mesmo se a migration anterior não tiver sido aplicada.
INSERT INTO public.cashbook_account_plan (
  code,
  display_code,
  parent_code,
  name,
  kind,
  description,
  affects_cash_drawer,
  affects_financial_result,
  is_transfer,
  active,
  sort_order,
  level,
  path,
  is_group,
  is_postable,
  nature,
  analysis_enabled,
  metadata
)
VALUES
  (
    'other_income',
    '1.9.9',
    'grp_revenue',
    'Outras entradas',
    'income',
    'Categoria genérica para entradas manuais que não se encaixam nas demais categorias. Exige observação detalhada.',
    false,
    true,
    false,
    true,
    1990,
    2,
    '1/1.9.9',
    false,
    true,
    'credit',
    true,
    jsonb_build_object(
      'requires_notes', true,
      'requires_detailed_notes', true,
      'manual_cashbook_category', true,
      'manual_cashbook_only', true,
      'manual_cashbook_direction', 'in',
      'review_reason_required', true
    )
  ),
  (
    'other_expense',
    '2.9.9',
    'grp_expense',
    'Outras saídas',
    'expense',
    'Categoria genérica para saídas manuais que não se encaixam nas demais categorias. Exige observação detalhada.',
    false,
    true,
    false,
    true,
    2990,
    2,
    '2/2.9.9',
    false,
    true,
    'debit',
    true,
    jsonb_build_object(
      'requires_notes', true,
      'requires_detailed_notes', true,
      'manual_cashbook_category', true,
      'manual_cashbook_only', true,
      'manual_cashbook_direction', 'out',
      'review_reason_required', true
    )
  )
ON CONFLICT (code) DO UPDATE SET
  display_code = EXCLUDED.display_code,
  parent_code = EXCLUDED.parent_code,
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  description = EXCLUDED.description,
  affects_cash_drawer = EXCLUDED.affects_cash_drawer,
  affects_financial_result = EXCLUDED.affects_financial_result,
  is_transfer = EXCLUDED.is_transfer,
  active = true,
  sort_order = EXCLUDED.sort_order,
  level = EXCLUDED.level,
  path = EXCLUDED.path,
  is_group = false,
  is_postable = true,
  nature = EXCLUDED.nature,
  analysis_enabled = true,
  metadata = COALESCE(public.cashbook_account_plan.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

-- 2) Esconde categorias que pertencem a fluxos próprios de venda, não a lançamento manual.
-- Usa code, display_code e nome para cobrir variações legadas.
UPDATE public.cashbook_account_plan
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'manual_cashbook_hidden', true,
      'manual_cashbook_hidden_reason', 'sale_flow_specific'
    ),
    updated_at = now()
WHERE code IN (
    'refund',
    'sales_cancellation',
    'sale_cancellation',
    'sale_cancelled',
    'sale_refund',
    'sales_refund'
  )
  OR display_code IN ('1.1.3', '1.1.4', '2.7.3')
  OR lower(unaccent(name)) LIKE '%devolu%venda%'
  OR lower(unaccent(name)) LIKE '%cancelamento%venda%'
  OR lower(unaccent(name)) LIKE '%cancelamentos%sobre%venda%';

-- 3) Remove direção manual de qualquer categoria que foi marcada como fluxo próprio.
UPDATE public.cashbook_account_plan
SET metadata = (COALESCE(metadata, '{}'::jsonb) - 'manual_cashbook_direction') || jsonb_build_object(
      'manual_cashbook_hidden', true,
      'manual_cashbook_hidden_reason', COALESCE(metadata ->> 'manual_cashbook_hidden_reason', 'flow_specific')
    ),
    updated_at = now()
WHERE COALESCE((metadata ->> 'manual_cashbook_hidden')::boolean, false) = true;

-- 4) Pós-checagem para o SQL Editor.
SELECT
  'manual_cashbook_visibility_check' AS section,
  code,
  display_code,
  name,
  kind,
  nature,
  active,
  is_group,
  is_postable,
  metadata ->> 'manual_cashbook_direction' AS manual_cashbook_direction,
  metadata ->> 'manual_cashbook_hidden' AS manual_cashbook_hidden,
  metadata ->> 'manual_cashbook_hidden_reason' AS manual_cashbook_hidden_reason,
  metadata ->> 'requires_notes' AS requires_notes
FROM public.cashbook_account_plan
WHERE code IN ('other_income', 'other_expense', 'refund', 'sales_cancellation', 'sale_cancellation')
   OR display_code IN ('1.1.3', '1.1.4', '2.7.3', '1.9.9', '2.9.9')
   OR lower(unaccent(name)) LIKE '%devolu%venda%'
   OR lower(unaccent(name)) LIKE '%cancelamento%venda%'
ORDER BY display_code NULLS LAST, sort_order, name;
