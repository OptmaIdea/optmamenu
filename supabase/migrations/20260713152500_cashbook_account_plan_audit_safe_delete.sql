-- POS_9 — Auditoria e exclusao segura do Plano de Contas
-- Regras:
-- - grupos/contas de sistema nao podem ser apagados pela UI comum;
-- - conta com lancamento nao pode ser apagada;
-- - grupo com filhos nao pode ser apagado;
-- - inativacao de grupos base/sistema fica bloqueada;
-- - alteracoes relevantes ficam auditadas.

CREATE TABLE IF NOT EXISTS public.cashbook_account_plan_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_plan_code text NOT NULL,
  action text NOT NULL,
  actor_user_id uuid DEFAULT auth.uid(),
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cashbook_account_plan_audit_code
  ON public.cashbook_account_plan_audit (account_plan_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cashbook_account_plan_audit_actor
  ON public.cashbook_account_plan_audit (actor_user_id, created_at DESC);

ALTER TABLE public.cashbook_account_plan_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashbook_account_plan_audit_select_authenticated ON public.cashbook_account_plan_audit;
CREATE POLICY cashbook_account_plan_audit_select_authenticated
ON public.cashbook_account_plan_audit
FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.is_cashbook_account_plan_system_protected(p_item public.cashbook_account_plan)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE((p_item.metadata->>'system_group')::boolean, false)
    OR COALESCE((p_item.metadata->>'protected_account')::boolean, false)
    OR p_item.code IN ('grp_revenue', 'grp_expense', 'grp_transfers')
$$;

CREATE OR REPLACE FUNCTION public.insert_cashbook_account_plan_audit(
  p_account_plan_code text,
  p_action text,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cashbook_account_plan_audit (
    account_plan_code,
    action,
    actor_user_id,
    old_data,
    new_data,
    metadata
  ) VALUES (
    p_account_plan_code,
    p_action,
    auth.uid(),
    p_old_data,
    p_new_data,
    COALESCE(p_metadata, '{}'::jsonb)
  );
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
  v_old_item public.cashbook_account_plan%ROWTYPE;
  v_item public.cashbook_account_plan%ROWTYPE;
  v_is_update boolean := false;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
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
    jsonb_build_object('source', 'upsert_cashbook_account_plan_safe')
  );

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
  v_old_item public.cashbook_account_plan%ROWTYPE;
  v_item public.cashbook_account_plan%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado.');
  END IF;

  IF NOT public.can_manage_cashbook_account_plan_safe() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Você não tem permissão para alterar o plano de contas.');
  END IF;

  SELECT * INTO v_old_item
  FROM public.cashbook_account_plan
  WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Conta não encontrada.');
  END IF;

  IF p_active = false AND public.is_cashbook_account_plan_system_protected(v_old_item) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Esta conta é parte da estrutura base e não pode ser inativada.');
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

  PERFORM public.insert_cashbook_account_plan_audit(
    v_item.code,
    CASE WHEN p_active THEN 'activated' ELSE 'inactivated' END,
    to_jsonb(v_old_item),
    to_jsonb(v_item),
    jsonb_build_object('source', 'set_cashbook_account_plan_active_safe', 'has_entries', v_has_entries)
  );

  RETURN jsonb_build_object('ok', true, 'item', to_jsonb(v_item), 'has_entries', v_has_entries);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_cashbook_account_plan_safe(
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.cashbook_account_plan%ROWTYPE;
  v_has_entries boolean;
  v_children_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado.');
  END IF;

  IF NOT public.can_manage_cashbook_account_plan_safe() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Você não tem permissão para apagar contas do plano de contas.');
  END IF;

  SELECT * INTO v_item
  FROM public.cashbook_account_plan
  WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Conta não encontrada.');
  END IF;

  IF public.is_cashbook_account_plan_system_protected(v_item) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Esta conta é parte da estrutura base e não pode ser apagada.');
  END IF;

  IF COALESCE((v_item.metadata->>'user_created')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Somente contas criadas pelo usuário podem ser apagadas.');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.cashbook_entries e
    WHERE e.account_plan_code = p_code
  ) INTO v_has_entries;

  IF v_has_entries THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Esta conta possui lançamentos e não pode ser apagada. Inative-a se não quiser mais utilizá-la.');
  END IF;

  SELECT COUNT(*)
  INTO v_children_count
  FROM public.cashbook_account_plan child
  WHERE child.parent_code = p_code;

  IF v_children_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Este grupo possui contas filhas e não pode ser apagado.');
  END IF;

  DELETE FROM public.cashbook_account_plan
  WHERE code = p_code;

  PERFORM public.insert_cashbook_account_plan_audit(
    p_code,
    'deleted',
    to_jsonb(v_item),
    NULL,
    jsonb_build_object('source', 'delete_cashbook_account_plan_safe')
  );

  RETURN jsonb_build_object('ok', true, 'message', 'Conta apagada com segurança.');
END;
$$;

REVOKE ALL ON FUNCTION public.delete_cashbook_account_plan_safe(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_cashbook_account_plan_safe(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_cashbook_account_plan_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_cashbook_account_plan_safe(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.is_cashbook_account_plan_system_protected(public.cashbook_account_plan) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_cashbook_account_plan_audit(text, text, jsonb, jsonb, jsonb) TO authenticated;
