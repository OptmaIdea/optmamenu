-- POS_9 — Livro Diário: categorias genéricas para lançamentos manuais
-- Objetivo:
-- - Criar categorias "Outras entradas" e "Outras saídas".
-- - Marcar essas categorias como exigindo observações detalhadas.
-- - Proteger o backend para impedir lançamento sem descrição/observação quando a categoria exigir.

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
    NULL,
    'Outras entradas',
    'income',
    'Categoria genérica para entradas manuais que não se encaixam nas demais categorias. Exige observação detalhada.',
    false,
    true,
    false,
    true,
    1990,
    1,
    '1.9.9',
    false,
    true,
    'credit',
    true,
    jsonb_build_object(
      'requires_notes', true,
      'requires_detailed_notes', true,
      'manual_cashbook_category', true,
      'manual_cashbook_only', true,
      'review_reason_required', true
    )
  ),
  (
    'other_expense',
    '2.9.9',
    NULL,
    'Outras saídas',
    'expense',
    'Categoria genérica para saídas manuais que não se encaixam nas demais categorias. Exige observação detalhada.',
    false,
    true,
    false,
    true,
    2990,
    1,
    '2.9.9',
    false,
    true,
    'debit',
    true,
    jsonb_build_object(
      'requires_notes', true,
      'requires_detailed_notes', true,
      'manual_cashbook_category', true,
      'manual_cashbook_only', true,
      'review_reason_required', true
    )
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  description = EXCLUDED.description,
  affects_financial_result = EXCLUDED.affects_financial_result,
  is_transfer = EXCLUDED.is_transfer,
  active = true,
  is_group = false,
  is_postable = true,
  nature = EXCLUDED.nature,
  analysis_enabled = true,
  metadata = COALESCE(public.cashbook_account_plan.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.enforce_cashbook_required_notes_safe()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_requires_notes boolean := false;
BEGIN
  IF NEW.account_plan_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE((p.metadata ->> 'requires_notes')::boolean, false)
  INTO v_requires_notes
  FROM public.cashbook_account_plan p
  WHERE p.code = NEW.account_plan_code;

  IF v_requires_notes THEN
    IF COALESCE(trim(NEW.description), '') = '' THEN
      RAISE EXCEPTION 'Informe uma descrição para esta categoria.';
    END IF;

    IF COALESCE(trim(NEW.notes), '') = '' THEN
      RAISE EXCEPTION 'Informe observações detalhadas para esta categoria.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashbook_required_notes_safe ON public.cashbook_entries;

CREATE TRIGGER trg_cashbook_required_notes_safe
BEFORE INSERT OR UPDATE OF account_plan_code, description, notes ON public.cashbook_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cashbook_required_notes_safe();
