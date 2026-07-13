-- POS_9 — Bloqueio de identidade histórica em contas com lançamentos
-- Regra: conta com lançamentos não pode ter sua identidade histórica alterada.
-- Permitido: descrição, análise gerencial, ativo/inativo, ordem e metadados complementares.
-- Bloqueado: nome, código exibido, grupo pai, tipo, natureza, grupo/lançável e flags de classificação.

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
  v_old_item public.cashbook_account_plan%ROWTYPE;
  v_item public.cashbook_account_plan%ROWTYPE;
  v_is_update boolean := false;
  v_has_entries boolean := false;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_display_code text := NULLIF(trim(COALESCE(p_display_code, '')), '');
  v_parent_code text := NULLIF(trim(COALESCE(p_parent_code, '')), '');
  v_duplicate public.cashbook_account_plan%ROWTYPE;
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

  SELECT * INTO v_old_item
  FROM public.cashbook_account_plan
  WHERE code = trim(p_code);

  v_is_update := FOUND;

  IF v_is_update THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.cashbook_entries e
      WHERE e.account_plan_code = v_old_item.code
    ) INTO v_has_entries;

    IF v_has_entries AND (
      COALESCE(v_old_item.display_code, '') IS DISTINCT FROM COALESCE(v_display_code, '')
      OR COALESCE(v_old_item.parent_code, '') IS DISTINCT FROM COALESCE(v_parent_code, '')
      OR COALESCE(v_old_item.name, '') IS DISTINCT FROM trim(p_name)
      OR COALESCE(v_old_item.kind, '') IS DISTINCT FROM p_kind
      OR COALESCE(v_old_item.nature, '') IS DISTINCT FROM p_nature
      OR COALESCE(v_old_item.is_group, false) IS DISTINCT FROM COALESCE(p_is_group, false)
      OR COALESCE(v_old_item.is_postable, true) IS DISTINCT FROM CASE WHEN p_is_group THEN false ELSE COALESCE(p_is_postable, true) END
      OR COALESCE(v_old_item.affects_cash_drawer, false) IS DISTINCT FROM COALESCE(p_affects_cash_drawer, false)
      OR COALESCE(v_old_item.affects_financial_result, true) IS DISTINCT FROM COALESCE(p_affects_financial_result, true)
      OR COALESCE(v_old_item.is_transfer, false) IS DISTINCT FROM COALESCE(p_is_transfer, false)
    ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'message', 'Esta conta possui lançamentos e não pode ter nome, código, grupo, tipo ou natureza alterados. Inative-a e crie uma nova conta para preservar o histórico.'
      );
    END IF;
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
    v_path := COALESCE(v_parent_path, p_parent_code) || '/' || COALESCE(v_display_code, trim(p_code));
  ELSE
    v_level := 1;
    v_path := COALESCE(v_display_code, trim(p_code));
  END IF;

  IF v_display_code IS NOT NULL AND COALESCE(p_active, true) THEN
    SELECT * INTO v_duplicate
    FROM public.cashbook_account_plan p
    WHERE p.active = true
      AND p.display_code = v_display_code
      AND p.code <> trim(p_code)
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'message', 'Já existe uma conta ativa usando o código ' || v_display_code || '. Escolha outro código ou use a sugestão automática.'
      );
    END IF;
  END IF;

  IF NOT v_is_update THEN
    v_metadata := v_metadata || jsonb_build_object('user_created', true, 'created_from_ui', true);
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
    v_display_code,
    v_parent_code,
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
    v_metadata
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
    metadata = COALESCE(public.cashbook_account_plan.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
    updated_at = now()
  RETURNING * INTO v_item;

  PERFORM public.insert_cashbook_account_plan_audit(
    v_item.code,
    CASE WHEN v_is_update THEN 'updated' ELSE 'created' END,
    CASE WHEN v_is_update THEN to_jsonb(v_old_item) ELSE NULL END,
    to_jsonb(v_item),
    jsonb_build_object(
      'source', 'upsert_cashbook_account_plan_safe',
      'has_entries', v_has_entries,
      'historical_identity_guard', true
    )
  );

  RETURN jsonb_build_object('ok', true, 'item', to_jsonb(v_item));
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_cashbook_account_plan_safe(text, text, text, text, text, text, boolean, boolean, text, boolean, boolean, boolean, boolean, boolean, integer, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_cashbook_account_plan_safe(text, text, text, text, text, text, boolean, boolean, text, boolean, boolean, boolean, boolean, boolean, integer, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_cashbook_account_plan_safe(text, text, text, text, text, text, boolean, boolean, text, boolean, boolean, boolean, boolean, boolean, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_cashbook_account_plan_safe(text, text, text, text, text, text, boolean, boolean, text, boolean, boolean, boolean, boolean, boolean, integer, jsonb) TO service_role;
