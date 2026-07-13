-- POS_9 — Expõe flags de governança na listagem do Plano de Contas
-- Objetivo: permitir que a UI mostre ações seguras sem tentar adivinhar regras no front.

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
      p.code,
      p.display_code,
      p.parent_code,
      p.name,
      p.kind,
      p.description,
      p.affects_cash_drawer,
      p.affects_financial_result,
      p.is_transfer,
      p.active,
      p.sort_order,
      p.level,
      p.path,
      p.is_group,
      p.is_postable,
      p.nature,
      p.analysis_enabled,
      p.metadata,
      p.created_at,
      p.updated_at,
      COALESCE(entry_stats.has_entries, false) AS has_entries,
      COALESCE(child_stats.children_count, 0) AS children_count,
      public.is_cashbook_account_plan_system_protected(p) AS is_system_protected,
      COALESCE(entry_stats.has_entries, false) AS identity_locked,
      (
        COALESCE((p.metadata->>'user_created')::boolean, false) IS TRUE
        AND public.is_cashbook_account_plan_system_protected(p) IS FALSE
        AND COALESCE(entry_stats.has_entries, false) IS FALSE
        AND COALESCE(child_stats.children_count, 0) = 0
      ) AS can_delete_safe
    FROM public.cashbook_account_plan p
    LEFT JOIN LATERAL (
      SELECT EXISTS (
        SELECT 1
        FROM public.cashbook_entries e
        WHERE e.account_plan_code = p.code
        LIMIT 1
      ) AS has_entries
    ) entry_stats ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS children_count
      FROM public.cashbook_account_plan child
      WHERE child.parent_code = p.code
    ) child_stats ON true
    WHERE p_include_inactive OR p.active = true
  ) item;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.list_cashbook_account_plan_tree_safe(boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_cashbook_account_plan_tree_safe(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_cashbook_account_plan_tree_safe(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_cashbook_account_plan_tree_safe(boolean) TO service_role;
