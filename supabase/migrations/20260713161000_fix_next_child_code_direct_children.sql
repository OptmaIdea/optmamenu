-- POS_9 — Corrige sugestão do próximo código por filhos diretos
-- A versão anterior dependia de regex do código completo e podia falhar com zeros à esquerda.
-- Esta versão usa parent_code e o último segmento numérico do display_code.

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

  IF COALESCE(trim(v_parent.display_code), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'A conta superior não possui código na árvore.');
  END IF;

  WITH direct_children AS (
    SELECT
      child.display_code,
      split_part(
        child.display_code,
        '.',
        array_length(string_to_array(child.display_code, '.'), 1)
      ) AS last_segment
    FROM public.cashbook_account_plan child
    WHERE child.parent_code = v_parent.code
      AND child.display_code IS NOT NULL
      AND child.display_code LIKE v_parent.display_code || '.%'
  )
  SELECT COALESCE(MAX(last_segment::integer), 0)
  INTO v_max_child_number
  FROM direct_children
  WHERE last_segment ~ '^[0-9]+$';

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
