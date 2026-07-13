-- POS_9 — Corrige hierarquia e numeração das contas de vendas
-- Objetivo:
-- 1.1 - Receitas operacionais
--   1.1.1 - Vendas
--     1.1.1.1 - Venda em dinheiro
--     1.1.1.2 - Venda via Pix
--     1.1.1.3 - Venda no débito
--     1.1.1.4 - Venda no crédito
--
-- Remove zeros à esquerda em display_code de vendas por forma de pagamento.
-- Não altera cashbook_entries.account_plan_code.

UPDATE public.cashbook_account_plan
SET is_group = true,
    is_postable = false,
    analysis_enabled = true,
    parent_code = 'grp_revenue_operational',
    display_code = '1.1.1',
    level = 3,
    path = '1/1.1/1.1.1',
    kind = 'income',
    nature = 'credit',
    affects_financial_result = true,
    is_transfer = false,
    sort_order = 1110,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'system_group', true,
      'protected_base_structure', true,
      'converted_to_group_by_migration', '20260713154500_cashbook_account_plan_fix_sales_hierarchy'
    ),
    updated_at = now()
WHERE code = 'sales';

UPDATE public.cashbook_account_plan
SET parent_code = 'sales',
    display_code = CASE code
      WHEN 'sale_cash' THEN '1.1.1.1'
      WHEN 'sale_pix' THEN '1.1.1.2'
      WHEN 'sale_debit' THEN '1.1.1.3'
      WHEN 'sale_credit' THEN '1.1.1.4'
      ELSE display_code
    END,
    level = 4,
    path = CASE code
      WHEN 'sale_cash' THEN '1/1.1/1.1.1/1.1.1.1'
      WHEN 'sale_pix' THEN '1/1.1/1.1.1/1.1.1.2'
      WHEN 'sale_debit' THEN '1/1.1/1.1.1/1.1.1.3'
      WHEN 'sale_credit' THEN '1/1.1/1.1.1/1.1.1.4'
      ELSE path
    END,
    kind = 'income',
    nature = 'credit',
    is_group = false,
    is_postable = true,
    analysis_enabled = true,
    affects_financial_result = true,
    is_transfer = false,
    sort_order = CASE code
      WHEN 'sale_cash' THEN 1111
      WHEN 'sale_pix' THEN 1112
      WHEN 'sale_debit' THEN 1113
      WHEN 'sale_credit' THEN 1114
      ELSE sort_order
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'sales_payment_method_child', true,
      'renumbered_without_leading_zero', true,
      'updated_by_migration', '20260713154500_cashbook_account_plan_fix_sales_hierarchy'
    ),
    updated_at = now()
WHERE code IN ('sale_cash', 'sale_pix', 'sale_debit', 'sale_credit');

-- Normaliza filhos diretos que eventualmente já tenham sido criados abaixo de sales com zero à esquerda.
WITH normalized AS (
  SELECT
    code,
    split_part(display_code, '.', array_length(string_to_array(display_code, '.'), 1))::integer AS last_number
  FROM public.cashbook_account_plan
  WHERE parent_code = 'sales'
    AND display_code ~ '^1\.1\.1\.0*[0-9]+$'
)
UPDATE public.cashbook_account_plan p
SET display_code = '1.1.1.' || normalized.last_number::text,
    path = '1/1.1/1.1.1/1.1.1.' || normalized.last_number::text,
    level = 4,
    updated_at = now(),
    metadata = COALESCE(p.metadata, '{}'::jsonb) || jsonb_build_object(
      'renumbered_without_leading_zero', true,
      'updated_by_migration', '20260713154500_cashbook_account_plan_fix_sales_hierarchy'
    )
FROM normalized
WHERE p.code = normalized.code;

-- Recria a RPC de sugestão para tratar último segmento com zero à esquerda como número normal.
CREATE OR REPLACE FUNCTION public.get_cashbook_account_plan_next_child_code_safe(
  p_parent_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.cashbook_account_plan%ROWTYPE;
  v_max_child_number integer := 0;
  v_next_number integer := 1;
  v_suggested_display_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado.');
  END IF;

  SELECT *
  INTO v_parent
  FROM public.cashbook_account_plan
  WHERE code = p_parent_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Conta superior não encontrada.');
  END IF;

  IF COALESCE(v_parent.display_code, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'A conta superior não possui código na árvore.');
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN child.display_code ~ ('^' || replace(v_parent.display_code, '.', '\\.') || '\\.[0-9]+$')
      THEN split_part(child.display_code, '.', array_length(string_to_array(child.display_code, '.'), 1))::integer
      ELSE NULL
    END
  ), 0)
  INTO v_max_child_number
  FROM public.cashbook_account_plan child
  WHERE child.parent_code = v_parent.code
    AND child.active = true;

  v_next_number := v_max_child_number + 1;
  v_suggested_display_code := v_parent.display_code || '.' || v_next_number::text;

  RETURN jsonb_build_object(
    'ok', true,
    'parent_code', v_parent.code,
    'parent_display_code', v_parent.display_code,
    'parent_name', v_parent.name,
    'next_number', v_next_number,
    'suggested_display_code', v_suggested_display_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_cashbook_account_plan_next_child_code_safe(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cashbook_account_plan_next_child_code_safe(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_cashbook_account_plan_next_child_code_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cashbook_account_plan_next_child_code_safe(text) TO service_role;
