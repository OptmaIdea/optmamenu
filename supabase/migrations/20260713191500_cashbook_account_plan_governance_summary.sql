-- POS_9 — Resumo de governança do Plano de Contas
-- Objetivo: expor um painel sintético para auditoria/validação da árvore gerencial.

CREATE OR REPLACE FUNCTION public.get_cashbook_account_plan_governance_summary_safe()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_summary jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.store_users su
    WHERE su.user_id = auth.uid()
      AND su.active = true
      AND su.role IN ('owner', 'admin', 'manager')
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Você não tem permissão para consultar a governança do plano de contas.');
  END IF;

  WITH listed AS (
    SELECT jsonb_array_elements((public.list_cashbook_account_plan_tree_safe(true))->'items') AS item
  ), normalized AS (
    SELECT
      item->>'code' AS code,
      item->>'display_code' AS display_code,
      item->>'name' AS name,
      COALESCE((item->>'active')::boolean, false) AS active,
      COALESCE((item->>'is_group')::boolean, false) AS is_group,
      COALESCE((item->>'is_postable')::boolean, false) AS is_postable,
      COALESCE((item->>'has_entries')::boolean, false) AS has_entries,
      COALESCE((item->>'children_count')::integer, 0) AS children_count,
      COALESCE((item->>'is_system_protected')::boolean, false) AS is_system_protected,
      COALESCE((item->>'identity_locked')::boolean, false) AS identity_locked,
      COALESCE((item->>'can_delete_safe')::boolean, false) AS can_delete_safe
    FROM listed
  ), counters AS (
    SELECT
      COUNT(*)::integer AS total_accounts,
      COUNT(*) FILTER (WHERE active)::integer AS active_accounts,
      COUNT(*) FILTER (WHERE NOT active)::integer AS inactive_accounts,
      COUNT(*) FILTER (WHERE is_group)::integer AS group_accounts,
      COUNT(*) FILTER (WHERE is_postable AND NOT is_group)::integer AS postable_accounts,
      COUNT(*) FILTER (WHERE has_entries)::integer AS accounts_with_entries,
      COUNT(*) FILTER (WHERE children_count > 0)::integer AS accounts_with_children,
      COUNT(*) FILTER (WHERE is_system_protected)::integer AS protected_accounts,
      COUNT(*) FILTER (WHERE identity_locked)::integer AS identity_locked_accounts,
      COUNT(*) FILTER (WHERE can_delete_safe)::integer AS safe_delete_candidates,
      COUNT(*) FILTER (
        WHERE can_delete_safe = true
          AND (has_entries = true OR children_count > 0 OR is_system_protected = true)
      )::integer AS flag_consistency_errors
    FROM normalized
  )
  SELECT jsonb_build_object(
    'total_accounts', total_accounts,
    'active_accounts', active_accounts,
    'inactive_accounts', inactive_accounts,
    'group_accounts', group_accounts,
    'postable_accounts', postable_accounts,
    'accounts_with_entries', accounts_with_entries,
    'accounts_with_children', accounts_with_children,
    'protected_accounts', protected_accounts,
    'identity_locked_accounts', identity_locked_accounts,
    'safe_delete_candidates', safe_delete_candidates,
    'flag_consistency_errors', flag_consistency_errors
  )
  INTO v_summary
  FROM counters;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'code', code,
      'display_code', display_code,
      'name', name,
      'active', active,
      'has_entries', has_entries,
      'children_count', children_count,
      'is_system_protected', is_system_protected,
      'identity_locked', identity_locked,
      'can_delete_safe', can_delete_safe
    )
    ORDER BY display_code, name
  ), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT *
    FROM normalized
    WHERE can_delete_safe = true
       OR identity_locked = true
       OR is_system_protected = true
  ) highlighted;

  RETURN jsonb_build_object(
    'ok', true,
    'summary', COALESCE(v_summary, '{}'::jsonb),
    'highlighted_items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_cashbook_account_plan_governance_summary_safe() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cashbook_account_plan_governance_summary_safe() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_cashbook_account_plan_governance_summary_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cashbook_account_plan_governance_summary_safe() TO service_role;
