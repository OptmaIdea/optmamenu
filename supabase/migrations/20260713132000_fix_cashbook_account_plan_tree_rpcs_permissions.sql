-- POS_9 — Corrige permissões das RPCs do plano de contas
-- Remove referencia indevida a public.store_users, que não existe no schema atual.
-- Usa o mesmo padrão das RPCs de contas financeiras: app_is_store_owner/user_has_store_permission.

CREATE OR REPLACE FUNCTION public.get_cashbook_account_plan_admin_store_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT s.id
  INTO v_store_id
  FROM public.stores s
  WHERE public.app_is_store_owner(s.id)
     OR public.user_has_store_permission(s.id, 'cashbook.create')
  ORDER BY s.created_at NULLS LAST
  LIMIT 1;

  RETURN v_store_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_cashbook_account_plan_safe()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN true;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.get_cashbook_account_plan_admin_store_id() IS NOT NULL;
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

  IF NOT public.can_manage_cashbook_account_plan_safe() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Você não tem permissão para alterar o plano de contas.');
  END IF;

  IF COALESCE(trim(p_code), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Informe o código interno da conta.');
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

  IF p_parent_code IS NOT NULL AND trim(p_parent_code) <> '' THEN
    SELECT level, path
    INTO v_level, v_parent_path
    FROM public.cashbook_account_plan
    WHERE code = p_parent_code;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Conta superior não encontrada.');
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
    NULLIF(trim(COALESCE(p_display_code, '')), ''),
    NULLIF(trim(COALESCE(p_parent_code, '')), ''),
    trim(p_name),
    p_kind,
    NULLIF(trim(COALESCE(p_description, '')), ''),
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

  IF NOT public.can_manage_cashbook_account_plan_safe() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Você não tem permissão para alterar o plano de contas.');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.cashbook_entries e
    WHERE e.account_plan_code = p_code
  ) INTO v_has_entries;

  UPDATE public.cashbook_account_plan
  SET active = COALESCE(p_active, true),
      metadata = CASE
        WHEN p_active = false AND v_has_entries THEN metadata || '{"inactive_with_entries": true}'::jsonb
        ELSE metadata
      END,
      updated_at = now()
  WHERE code = p_code
  RETURNING * INTO v_item;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Conta não encontrada.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'item', to_jsonb(v_item), 'has_entries', v_has_entries);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cashbook_account_plan_admin_store_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_cashbook_account_plan_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_cashbook_account_plan_safe(text, text, text, text, text, text, boolean, boolean, text, boolean, boolean, boolean, boolean, boolean, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cashbook_account_plan_active_safe(text, boolean) TO authenticated;
