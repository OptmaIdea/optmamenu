-- POS_9 — Bloqueia duplicidade de código exibido no plano de contas
-- Objetivo: impedir duas contas ativas com o mesmo display_code, mesmo se a UI sugerir ou permitir edição manual.

-- 1) Renumera duplicidades ativas atuais de forma conservadora.
-- Mantém o primeiro registro do display_code e move os demais para o próximo código livre dentro do mesmo pai.
DO $$
DECLARE
  v_dup record;
  v_item record;
  v_parent public.cashbook_account_plan%ROWTYPE;
  v_next_number integer;
  v_new_display_code text;
BEGIN
  FOR v_dup IN
    SELECT display_code
    FROM public.cashbook_account_plan
    WHERE active = true
      AND display_code IS NOT NULL
    GROUP BY display_code
    HAVING COUNT(*) > 1
  LOOP
    FOR v_item IN
      SELECT p.*,
             ROW_NUMBER() OVER (
               PARTITION BY p.display_code
               ORDER BY
                 CASE WHEN public.is_cashbook_account_plan_system_protected(p) THEN 0 ELSE 1 END,
                 CASE WHEN EXISTS (SELECT 1 FROM public.cashbook_entries e WHERE e.account_plan_code = p.code) THEN 0 ELSE 1 END,
                 p.sort_order,
                 p.created_at,
                 p.code
             ) AS rn
      FROM public.cashbook_account_plan p
      WHERE p.active = true
        AND p.display_code = v_dup.display_code
    LOOP
      CONTINUE WHEN v_item.rn = 1;

      IF v_item.parent_code IS NULL THEN
        -- Duplicidade em raiz é anomalia estrutural: não renumera automaticamente.
        CONTINUE;
      END IF;

      SELECT * INTO v_parent
      FROM public.cashbook_account_plan
      WHERE code = v_item.parent_code;

      IF NOT FOUND OR COALESCE(v_parent.display_code, '') = '' THEN
        CONTINUE;
      END IF;

      SELECT COALESCE(MAX(
        CASE
          WHEN child.display_code ~ ('^' || replace(v_parent.display_code, '.', '\\.') || '\\.[0-9]+$')
          THEN regexp_replace(split_part(child.display_code, '.', array_length(string_to_array(child.display_code, '.'), 1)), '^0+', '')::integer
          ELSE NULL
        END
      ), 0) + 1
      INTO v_next_number
      FROM public.cashbook_account_plan child
      WHERE child.parent_code = v_parent.code
        AND child.code <> v_item.code;

      v_new_display_code := v_parent.display_code || '.' || v_next_number::text;

      UPDATE public.cashbook_account_plan
      SET display_code = v_new_display_code,
          path = COALESCE(v_parent.path, v_parent.display_code) || '/' || v_new_display_code,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'display_code_renumbered_by_migration', '20260713160000_cashbook_account_plan_unique_display_code',
            'previous_display_code', v_item.display_code
          ),
          updated_at = now()
      WHERE code = v_item.code;

      PERFORM public.insert_cashbook_account_plan_audit(
        v_item.code,
        'display_code_renumbered',
        to_jsonb(v_item),
        to_jsonb((SELECT p FROM public.cashbook_account_plan p WHERE p.code = v_item.code)),
        jsonb_build_object('source', '20260713160000_cashbook_account_plan_unique_display_code')
      );
    END LOOP;
  END LOOP;
END $$;

-- 2) Recria RPC de próximo código considerando zeros à esquerda como número.
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
      THEN regexp_replace(split_part(child.display_code, '.', array_length(string_to_array(child.display_code, '.'), 1)), '^0+', '')::integer
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

-- 3) Recria upsert com bloqueio explícito de display_code ativo duplicado.
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
  v_normalized_display_code text := NULLIF(trim(COALESCE(p_display_code, '')), '');
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

  IF COALESCE(p_active, true) = true AND v_normalized_display_code IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.cashbook_account_plan existing
    WHERE existing.active = true
      AND existing.display_code = v_normalized_display_code
      AND existing.code <> trim(p_code)
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Já existe uma conta ativa usando o código ' || v_normalized_display_code || '. Escolha outro código ou use a sugestão automática.'
    );
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
    v_path := COALESCE(v_parent_path, p_parent_code) || '/' || COALESCE(v_normalized_display_code, trim(p_code));
  ELSE
    v_level := 1;
    v_path := COALESCE(v_normalized_display_code, trim(p_code));
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
    v_normalized_display_code,
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

-- 4) Recria ativação com bloqueio contra duplicidade ao reativar.
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

  IF p_active = true AND v_old_item.display_code IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.cashbook_account_plan existing
    WHERE existing.active = true
      AND existing.display_code = v_old_item.display_code
      AND existing.code <> p_code
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Não é possível ativar: já existe outra conta ativa usando o código ' || v_old_item.display_code || '.'
    );
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

-- 5) Índice parcial como trava final no banco.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cashbook_account_plan_active_display_code
  ON public.cashbook_account_plan (display_code)
  WHERE active = true AND display_code IS NOT NULL;
