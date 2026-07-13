-- POS_9 — Balancete gerencial por plano de contas
-- Base para analisar para onde gira o dinheiro, maiores receitas e maiores custos.

CREATE OR REPLACE FUNCTION public.get_cashbook_account_plan_trial_balance_safe(
  p_store_id uuid,
  p_start_date date,
  p_end_date date,
  p_include_inactive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb := '[]'::jsonb;
  v_totals jsonb := '{}'::jsonb;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Loja não informada.');
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Informe o período do balancete.');
  END IF;

  IF p_end_date < p_start_date THEN
    RETURN jsonb_build_object('ok', false, 'message', 'A data final não pode ser menor que a data inicial.');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission(p_store_id, 'cashbook.view')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Você não tem permissão para consultar o balancete.');
    END IF;
  END IF;

  WITH plan_items AS (
    SELECT
      p.code,
      p.display_code,
      p.parent_code,
      p.name,
      p.kind,
      p.level,
      p.path,
      p.is_group,
      p.is_postable,
      p.nature,
      p.analysis_enabled,
      p.active,
      p.sort_order
    FROM public.cashbook_account_plan p
    WHERE p_include_inactive OR p.active = true
  ),
  direct_entries AS (
    SELECT
      e.account_plan_code,
      SUM(CASE WHEN e.direction = 'in' THEN e.amount ELSE 0 END)::numeric(14,2) AS direct_in,
      SUM(CASE WHEN e.direction = 'out' THEN e.amount ELSE 0 END)::numeric(14,2) AS direct_out,
      COUNT(*)::integer AS entries_count
    FROM public.cashbook_entries e
    WHERE e.store_id = p_store_id
      AND e.account_plan_code IS NOT NULL
      AND e.entry_date >= p_start_date
      AND e.entry_date <= p_end_date
      AND COALESCE(e.affects_balance, true) = true
      AND COALESCE(e.status, 'active') NOT IN ('cancelled', 'canceled', 'voided')
    GROUP BY e.account_plan_code
  ),
  direct_by_plan AS (
    SELECT
      p.*,
      COALESCE(d.direct_in, 0)::numeric(14,2) AS direct_in,
      COALESCE(d.direct_out, 0)::numeric(14,2) AS direct_out,
      COALESCE(d.entries_count, 0)::integer AS direct_entries_count
    FROM plan_items p
    LEFT JOIN direct_entries d ON d.account_plan_code = p.code
  ),
  ancestor_map AS (
    SELECT
      child.code AS child_code,
      ancestor.code AS ancestor_code
    FROM plan_items child
    JOIN plan_items ancestor
      ON child.code = ancestor.code
      OR child.path LIKE ancestor.path || '/%'
  ),
  rolled AS (
    SELECT
      ancestor_map.ancestor_code AS code,
      SUM(direct_by_plan.direct_in)::numeric(14,2) AS total_in,
      SUM(direct_by_plan.direct_out)::numeric(14,2) AS total_out,
      SUM(direct_by_plan.direct_entries_count)::integer AS total_entries_count
    FROM ancestor_map
    JOIN direct_by_plan ON direct_by_plan.code = ancestor_map.child_code
    GROUP BY ancestor_map.ancestor_code
  ),
  final_items AS (
    SELECT
      p.code,
      p.display_code,
      p.parent_code,
      p.name,
      p.kind,
      p.level,
      p.path,
      p.is_group,
      p.is_postable,
      p.nature,
      p.analysis_enabled,
      p.active,
      p.sort_order,
      p.direct_in,
      p.direct_out,
      (p.direct_in - p.direct_out)::numeric(14,2) AS direct_balance,
      p.direct_entries_count,
      COALESCE(r.total_in, 0)::numeric(14,2) AS total_in,
      COALESCE(r.total_out, 0)::numeric(14,2) AS total_out,
      (COALESCE(r.total_in, 0) - COALESCE(r.total_out, 0))::numeric(14,2) AS total_balance,
      COALESCE(r.total_entries_count, 0)::integer AS total_entries_count
    FROM direct_by_plan p
    LEFT JOIN rolled r ON r.code = p.code
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(final_items) ORDER BY final_items.sort_order, final_items.display_code NULLS LAST, final_items.name), '[]'::jsonb)
  INTO v_items
  FROM final_items;

  WITH period_entries AS (
    SELECT
      e.direction,
      e.amount
    FROM public.cashbook_entries e
    WHERE e.store_id = p_store_id
      AND e.account_plan_code IS NOT NULL
      AND e.entry_date >= p_start_date
      AND e.entry_date <= p_end_date
      AND COALESCE(e.affects_balance, true) = true
      AND COALESCE(e.status, 'active') NOT IN ('cancelled', 'canceled', 'voided')
  )
  SELECT jsonb_build_object(
    'total_in', COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)::numeric(14,2),
    'total_out', COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)::numeric(14,2),
    'balance', COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0)::numeric(14,2),
    'entries_count', COUNT(*)::integer
  )
  INTO v_totals
  FROM period_entries;

  RETURN jsonb_build_object(
    'ok', true,
    'store_id', p_store_id,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'totals', v_totals,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_cashbook_account_plan_trial_balance_safe(uuid, date, date, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cashbook_account_plan_trial_balance_safe(uuid, date, date, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_cashbook_account_plan_trial_balance_safe(uuid, date, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cashbook_account_plan_trial_balance_safe(uuid, date, date, boolean) TO service_role;
