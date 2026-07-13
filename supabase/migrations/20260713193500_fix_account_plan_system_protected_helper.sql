-- POS_9 — Helper explícita para proteção sistêmica do Plano de Contas
-- Corrige dependência da RPC de resumo quando a função auxiliar ainda não existe no banco.

CREATE OR REPLACE FUNCTION public.is_cashbook_account_plan_system_protected(
  p_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      p.code IN ('grp_revenue', 'grp_expense', 'grp_transfers')
      OR COALESCE((p.metadata->>'system_group')::boolean, false) = true
      OR COALESCE((p.metadata->>'protected_account')::boolean, false) = true
      OR COALESCE((p.metadata->>'protected_base_structure')::boolean, false) = true
    FROM public.cashbook_account_plan p
    WHERE p.code = p_code
    LIMIT 1
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.get_cashbook_account_plan_governance_summary_safe()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary jsonb;
  v_highlights jsonb;
BEGIN
  WITH base AS (
    SELECT
      p.code,
      p.display_code,
      p.name,
      p.parent_code,
      p.active,
      p.is_group,
      p.is_postable,
      p.metadata,
      EXISTS (
        SELECT 1
        FROM public.cashbook_entries e
        WHERE e.account_plan_code = p.code
        LIMIT 1
      ) AS has_entries,
      (
        SELECT count(*)::integer
        FROM public.cashbook_account_plan c
        WHERE c.parent_code = p.code
      ) AS children_count,
      public.is_cashbook_account_plan_system_protected(p.code) AS is_system_protected
    FROM public.cashbook_account_plan p
  ), normalized AS (
    SELECT
      *,
      has_entries AS identity_locked,
      (
        active = true
        AND COALESCE((metadata->>'user_created')::boolean, false) = true
        AND has_entries = false
        AND children_count = 0
        AND is_system_protected = false
      ) AS can_delete_safe
    FROM base
  ), counters AS (
    SELECT
      count(*)::integer AS total_accounts,
      count(*) FILTER (WHERE active = true)::integer AS active_accounts,
      count(*) FILTER (WHERE active = false)::integer AS inactive_accounts,
      count(*) FILTER (WHERE is_group = true)::integer AS group_accounts,
      count(*) FILTER (WHERE is_postable = true AND is_group = false)::integer AS postable_accounts,
      count(*) FILTER (WHERE has_entries = true)::integer AS accounts_with_entries,
      count(*) FILTER (WHERE children_count > 0)::integer AS accounts_with_children,
      count(*) FILTER (WHERE is_system_protected = true)::integer AS protected_accounts,
      count(*) FILTER (WHERE identity_locked = true)::integer AS identity_locked_accounts,
      count(*) FILTER (WHERE can_delete_safe = true)::integer AS safe_delete_candidates,
      count(*) FILTER (
        WHERE can_delete_safe = true
          AND (
            has_entries = true
            OR children_count > 0
            OR is_system_protected = true
          )
      )::integer AS flag_consistency_errors
    FROM normalized
  )
  SELECT to_jsonb(counters.*)
  INTO v_summary
  FROM counters;

  WITH base AS (
    SELECT
      p.code,
      p.display_code,
      p.name,
      p.parent_code,
      p.active,
      p.is_group,
      p.is_postable,
      p.metadata,
      EXISTS (
        SELECT 1
        FROM public.cashbook_entries e
        WHERE e.account_plan_code = p.code
        LIMIT 1
      ) AS has_entries,
      (
        SELECT count(*)::integer
        FROM public.cashbook_account_plan c
        WHERE c.parent_code = p.code
      ) AS children_count,
      public.is_cashbook_account_plan_system_protected(p.code) AS is_system_protected
    FROM public.cashbook_account_plan p
  ), normalized AS (
    SELECT
      *,
      has_entries AS identity_locked,
      (
        active = true
        AND COALESCE((metadata->>'user_created')::boolean, false) = true
        AND has_entries = false
        AND children_count = 0
        AND is_system_protected = false
      ) AS can_delete_safe
    FROM base
  )
  SELECT jsonb_build_object(
    'safe_delete_candidates', COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', code,
        'display_code', display_code,
        'name', name,
        'parent_code', parent_code
      ) ORDER BY display_code, name
    ) FILTER (WHERE can_delete_safe = true), '[]'::jsonb),
    'identity_locked_accounts', COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', code,
        'display_code', display_code,
        'name', name,
        'parent_code', parent_code
      ) ORDER BY display_code, name
    ) FILTER (WHERE identity_locked = true), '[]'::jsonb),
    'protected_accounts', COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', code,
        'display_code', display_code,
        'name', name,
        'parent_code', parent_code
      ) ORDER BY display_code, name
    ) FILTER (WHERE is_system_protected = true), '[]'::jsonb)
  )
  INTO v_highlights
  FROM normalized;

  RETURN jsonb_build_object(
    'ok', true,
    'summary', COALESCE(v_summary, '{}'::jsonb),
    'highlights', COALESCE(v_highlights, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_cashbook_account_plan_system_protected(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_cashbook_account_plan_governance_summary_safe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cashbook_account_plan_system_protected(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cashbook_account_plan_governance_summary_safe() TO authenticated;
