-- POS_9 — RPC para sugerir próximo código na árvore do plano de contas
-- Garante numeração baseada nos filhos diretos existentes.

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
  WHERE child.parent_code = v_parent.code;

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
