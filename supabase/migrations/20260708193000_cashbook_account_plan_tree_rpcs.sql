-- POS_9 — RPCs seguras para plano de contas gerencial
-- Base inicial para tela administrativa do Plano de Contas.

CREATE OR REPLACE FUNCTION public.list_cashbook_account_plan_tree_safe(
  p_include_inactive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado.');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(item) ORDER BY item.sort_order, item.display_code NULLS LAST, item.name), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
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
      metadata,
      created_at,
      updated_at,
      EXISTS (
        SELECT 1
        FROM public.cashbook_entries e
        WHERE e.account_plan_code = p.code
        LIMIT 1
      ) AS has_entries
    FROM public.cashbook_account_plan p
    WHERE p_include_inactive OR p.active = true
  ) item;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_cashbook_account_plan_safe(
  p_code text,
  p_display_code text,
  p_parent_code text,
  p_name text,
  p_kind text,
  p_description text DEFAULT NULL,
  p_is_group boolean DEFAULT false,
  p_is_postable boolean DEFAULT true,
  p_nature text DEFAULT 'neutral',
  p_analysis_enabled boolean DEFAULT false,
  p_affects_cash_drawer boolean DEFAULT false,
  p_affects_financial_result boolean DEFAULT true,
  p_is_transfer boolean DEFAULT false,
  p_active boolean DEFAULT true,
  p_sort_order integer DEFAULT 0,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level integer := 1;
  v_parent_path text;
  v_path text;
  v_item public.cashbook_account_plan%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.store_users su
    WHERE su.user_id = auth.uid()
      AND su.role IN ('owner', 'admin')
      AND su.active = true
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Você não tem permissão para alterar o plano de contas.');
  END IF;

  IF COALESCE(trim(p_code), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Informe o código técnico da conta.');
  END IF;

  IF COALESCE(trim(p_name), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Informe o nome da conta.');
  END IF;

  IF p_kind NOT IN ('income', 'expense', 'transfer', 'adjustment') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Tipo de conta inválido.');
  END IF;

  IF p_nature NOT IN ('debit', 'credit', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Natureza da conta inválida.');
  END IF;

  IF p_parent_code IS NOT NULL THEN
    SELECT level, path
    INTO v_level, v_parent_path
    FROM public.cashbook_account_plan
    WHERE code = p_parent_code;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Conta pai não encontrada.');
    END IF;

    v_level := v_level + 1;
    v_path := COALESCE(v_parent_path, p_parent_code) || '/' || COALESCE(NULLIF(trim(p_display_code), ''), trim(p_code));
  ELSE
    v_level := 1;
    v_path := COALESCE(NULLIF(trim(p_display_code), ''), trim(p_code));
  END IF;

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
  VALUES (
    trim(p_code),
    NULLIF(trim(p_display_code), ''),
    NULLIF(trim(p_parent_code), ''),
    trim(p_name),
    p_kind,
    NULLIF(trim(p_description), ''),
    p_affects_cash_drawer,
    p_affects_financial_result,
    p_is_transfer,
    p_active,
    COALESCE(p_sort_order, 0),
    v_level,
    v_path,
    p_is_group,
    CASE WHEN p_is_group THEN false ELSE p_is_postable END,
    p_nature,
    p_analysis_enabled,
    COALESCE(p_metadata, '{}'::jsonb)
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
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    level = EXCLUDED.level,
    path = EXCLUDED.path,
    is_group = EXCLUDED.is_group,
    is_postable = EXCLUDED.is_postable,
    nature = EXCLUDED.nature,
    analysis_enabled = EXCLUDED.analysis_enabled,
    metadata = public.cashbook_account_plan.metadata || EXCLUDED.metadata,
    updated_at = now()
  RETURNING * INTO v_item;

  RETURN jsonb_build_object('ok', true, 'item', to_jsonb(v_item));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_cashbook_account_plan_active_safe(
  p_code text,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_entries boolean;
  v_item public.cashbook_account_plan%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.store_users su
    WHERE su.user_id = auth.uid()
      AND su.role IN ('owner', 'admin')
      AND su.active = true
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Você não tem permissão para alterar o plano de contas.');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.cashbook_entries e
    WHERE e.account_plan_code = p_code
  ) INTO v_has_entries;

  IF p_active = false AND v_has_entries THEN
    UPDATE public.cashbook_account_plan
    SET active = false,
        metadata = metadata || '{"inactive_with_entries": true}'::jsonb,
        updated_at = now()
    WHERE code = p_code
    RETURNING * INTO v_item;
  ELSE
    UPDATE public.cashbook_account_plan
    SET active = p_active,
        updated_at = now()
    WHERE code = p_code
    RETURNING * INTO v_item;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Conta não encontrada.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'item', to_jsonb(v_item), 'has_entries', v_has_entries);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_cashbook_account_plan_tree_safe(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_cashbook_account_plan_safe(text, text, text, text, text, text, boolean, boolean, text, boolean, boolean, boolean, boolean, boolean, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cashbook_account_plan_active_safe(text, boolean) TO authenticated;
