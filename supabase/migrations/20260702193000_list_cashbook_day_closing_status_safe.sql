-- POS_9 — Financeiro — status dos fechamentos do caixa
--
-- Objetivo:
-- - listar dias com movimento que ainda nao possuem fechamento fechado;
-- - listar fechamentos recentes;
-- - apoiar alertas de caixas abertos/atrasados;
-- - preparar tela de historico de conferencias.

CREATE OR REPLACE FUNCTION public.list_cashbook_day_closing_status_safe(
  p_store_id uuid,
  p_lookback_days integer DEFAULT 90,
  p_allowed_open_days integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_lookback_days integer := GREATEST(1, LEAST(COALESCE(p_lookback_days, 90), 365));
  v_allowed_open_days integer := GREATEST(1, LEAST(COALESCE(p_allowed_open_days, 3), 15));
  v_open_days jsonb := '[]'::jsonb;
  v_recent_closings jsonb := '[]'::jsonb;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store_id');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF v_user_id IS NULL
       OR NOT (
         public.app_is_store_owner(p_store_id)
         OR public.user_has_store_permission(p_store_id, 'cashbook.view')
         OR public.user_has_store_permission(p_store_id, 'cashbook.create')
       ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
  END IF;

  WITH movement_days AS (
    SELECT
      ce.entry_date,
      COUNT(*)::integer AS entries_count,
      COALESCE(SUM(CASE WHEN ce.direction = 'in' THEN ce.amount ELSE -ce.amount END) FILTER (
        WHERE ce.status <> 'cancelled' AND COALESCE(ce.affects_balance, true) = true
      ), 0) AS realized_total,
      COUNT(*) FILTER (
        WHERE ce.status <> 'cancelled'
          AND (
            COALESCE(ce.affects_balance, false) = false
            OR ce.payment_method_code = 'pending'
            OR ce.payment_method = 'pending'
          )
      )::integer AS pending_count,
      COALESCE(SUM(CASE WHEN ce.direction = 'in' THEN ce.amount ELSE -ce.amount END) FILTER (
        WHERE ce.status <> 'cancelled'
          AND (
            COALESCE(ce.affects_balance, false) = false
            OR ce.payment_method_code = 'pending'
            OR ce.payment_method = 'pending'
          )
      ), 0) AS pending_total
    FROM public.cashbook_entries ce
    WHERE ce.store_id = p_store_id
      AND ce.entry_date >= (CURRENT_DATE - (v_lookback_days || ' days')::interval)::date
    GROUP BY ce.entry_date
  ), closed_days AS (
    SELECT c.*
    FROM public.cashbook_day_closings c
    WHERE c.store_id = p_store_id
      AND c.status = 'closed'
  ), open_days AS (
    SELECT
      md.entry_date,
      md.entries_count,
      md.realized_total,
      md.pending_count,
      md.pending_total,
      COALESCE(c.status, 'open') AS status,
      c.id AS closing_id,
      (CURRENT_DATE - md.entry_date)::integer AS age_days,
      ((CURRENT_DATE - md.entry_date)::integer > v_allowed_open_days) AS is_overdue
    FROM movement_days md
    LEFT JOIN public.cashbook_day_closings c
      ON c.store_id = p_store_id
     AND c.closing_date = md.entry_date
    WHERE COALESCE(c.status, 'open') <> 'closed'
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.entry_date DESC), '[]'::jsonb)
  INTO v_open_days
  FROM open_days o;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.closing_date DESC), '[]'::jsonb)
  INTO v_recent_closings
  FROM (
    SELECT
      c.id,
      c.store_id,
      c.closing_date,
      c.status,
      c.expected_total,
      c.confirmed_total,
      c.difference_total,
      c.expected_cash,
      c.counted_cash_total,
      c.expected_pix,
      c.confirmed_pix_total,
      c.expected_debit_card,
      c.confirmed_debit_card_total,
      c.expected_credit_card,
      c.confirmed_credit_card_total,
      c.pending_total,
      c.pending_count,
      c.cancelled_total,
      c.cancelled_count,
      c.notes,
      c.metadata,
      c.closed_by,
      c.closed_at,
      c.created_at,
      c.updated_at
    FROM public.cashbook_day_closings c
    WHERE c.store_id = p_store_id
    ORDER BY c.closing_date DESC
    LIMIT 30
  ) c;

  RETURN jsonb_build_object(
    'ok', true,
    'store_id', p_store_id,
    'allowed_open_days', v_allowed_open_days,
    'lookback_days', v_lookback_days,
    'open_days', v_open_days,
    'recent_closings', v_recent_closings
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', SQLERRM);
END;
$function$;

REVOKE ALL ON FUNCTION public.list_cashbook_day_closing_status_safe(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_cashbook_day_closing_status_safe(uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_cashbook_day_closing_status_safe(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_cashbook_day_closing_status_safe(uuid, integer, integer) TO service_role;
