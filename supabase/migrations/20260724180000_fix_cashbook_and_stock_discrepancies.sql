-- Correção do fechamento de caixa, filtro por data operacional e fila de divergências de estoque.
-- 2026-07-24

CREATE OR REPLACE FUNCTION public.get_cashbook_day_closing_preview_safe(p_store_id uuid, p_closing_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_closing_date date := COALESCE(p_closing_date, CURRENT_DATE);
  v_expected_cash numeric := 0;
  v_expected_pix numeric := 0;
  v_expected_debit numeric := 0;
  v_expected_credit numeric := 0;
  v_expected_other numeric := 0;
  v_expected_total numeric := 0;
  v_cash_movement numeric := 0;
  v_cash_opening_suggested numeric := 0;
  v_cash_unfunded_outflow numeric := 0;
  v_pending_total numeric := 0;
  v_pending_count integer := 0;
  v_cancelled_total numeric := 0;
  v_cancelled_count integer := 0;
  v_existing jsonb := NULL;
  v_by_method jsonb := '[]'::jsonb;
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

  WITH realized AS (
    SELECT
      COALESCE(ce.payment_method_code, ce.payment_method, 'other') AS method_code,
      SUM(CASE WHEN ce.direction = 'in' THEN ce.amount ELSE -ce.amount END) AS balance
    FROM public.cashbook_entries ce
    WHERE ce.store_id = p_store_id
      AND ce.entry_date = v_closing_date
      AND ce.status <> 'cancelled'
      AND COALESCE(ce.affects_balance, true) = true
    GROUP BY COALESCE(ce.payment_method_code, ce.payment_method, 'other')
  )
  SELECT
    COALESCE(SUM(balance) FILTER (WHERE method_code = 'cash' OR lower(method_code) = 'dinheiro'), 0),
    COALESCE(SUM(balance) FILTER (WHERE method_code = 'pix' OR lower(method_code) = 'pix'), 0),
    COALESCE(SUM(balance) FILTER (WHERE method_code = 'debit_card'), 0),
    COALESCE(SUM(balance) FILTER (WHERE method_code = 'credit_card'), 0),
    COALESCE(SUM(balance) FILTER (WHERE method_code NOT IN ('cash', 'pix', 'debit_card', 'credit_card') AND lower(method_code) NOT IN ('dinheiro', 'pix')), 0),
    COALESCE(jsonb_agg(jsonb_build_object('payment_method_code', method_code, 'balance', balance) ORDER BY method_code), '[]'::jsonb)
  INTO v_cash_movement, v_expected_pix, v_expected_debit, v_expected_credit, v_expected_other, v_by_method
  FROM realized;

  SELECT COALESCE(c.counted_cash_total, 0)
  INTO v_cash_opening_suggested
  FROM public.cashbook_day_closings c
  WHERE c.store_id = p_store_id
    AND c.closing_date < v_closing_date
    AND c.status = 'closed'
  ORDER BY c.closing_date DESC, c.closed_at DESC NULLS LAST
  LIMIT 1;

  v_cash_opening_suggested := COALESCE(v_cash_opening_suggested, 0);
  v_expected_cash := GREATEST(v_cash_opening_suggested + v_cash_movement, 0);
  v_cash_unfunded_outflow := GREATEST(-(v_cash_opening_suggested + v_cash_movement), 0);
  v_expected_pix := GREATEST(v_expected_pix, 0);
  v_expected_debit := GREATEST(v_expected_debit, 0);
  v_expected_credit := GREATEST(v_expected_credit, 0);
  v_expected_other := GREATEST(v_expected_other, 0);
  v_expected_total := v_expected_cash + v_expected_pix + v_expected_debit + v_expected_credit + v_expected_other;

  SELECT
    COALESCE(SUM(CASE WHEN ce.direction = 'in' THEN ce.amount ELSE -ce.amount END), 0),
    COUNT(*)::integer
  INTO v_pending_total, v_pending_count
  FROM public.cashbook_entries ce
  WHERE ce.store_id = p_store_id
    AND ce.entry_date = v_closing_date
    AND ce.status <> 'cancelled'
    AND (
      COALESCE(ce.affects_balance, false) = false
      OR ce.payment_method_code = 'pending'
      OR ce.payment_method = 'pending'
    );

  SELECT
    COALESCE(SUM(ce.amount), 0),
    COUNT(*)::integer
  INTO v_cancelled_total, v_cancelled_count
  FROM public.cashbook_entries ce
  WHERE ce.store_id = p_store_id
    AND ce.entry_date = v_closing_date
    AND ce.status = 'cancelled';

  SELECT to_jsonb(c.*)
  INTO v_existing
  FROM public.cashbook_day_closings c
  WHERE c.store_id = p_store_id
    AND c.closing_date = v_closing_date
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'store_id', p_store_id,
    'closing_date', v_closing_date,
    'expected', jsonb_build_object(
      'cash', v_expected_cash,
      'cash_opening_suggested', v_cash_opening_suggested,
      'cash_movement', v_cash_movement,
      'cash_unfunded_outflow', v_cash_unfunded_outflow,
      'pix', v_expected_pix,
      'debit_card', v_expected_debit,
      'credit_card', v_expected_credit,
      'other', v_expected_other,
      'total', v_expected_total,
      'by_method', v_by_method
    ),
    'pending', jsonb_build_object('total', v_pending_total, 'count', v_pending_count),
    'cancelled', jsonb_build_object('total', v_cancelled_total, 'count', v_cancelled_count),
    'existing_closing', v_existing
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', 'Não foi possível calcular a prévia do fechamento.');
END;
$function$


CREATE OR REPLACE FUNCTION public.save_cashbook_day_closing_safe(p_store_id uuid, p_closing_date date, p_counted_denominations jsonb DEFAULT '{}'::jsonb, p_counted_cash_total numeric DEFAULT 0, p_confirmed_pix_total numeric DEFAULT 0, p_confirmed_debit_card_total numeric DEFAULT 0, p_confirmed_credit_card_total numeric DEFAULT 0, p_confirmed_other_total numeric DEFAULT 0, p_notes text DEFAULT NULL::text, p_status text DEFAULT 'closed'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_preview jsonb;
  v_clean_metadata jsonb;
  v_closing_date date := COALESCE(p_closing_date, CURRENT_DATE);
  v_status text := COALESCE(NULLIF(trim(p_status), ''), 'closed');
  v_expected_cash numeric := 0;
  v_expected_pix numeric := 0;
  v_expected_debit numeric := 0;
  v_expected_credit numeric := 0;
  v_expected_other numeric := 0;
  v_expected_total numeric := 0;
  v_cash_movement numeric := 0;
  v_cash_opening_suggested numeric := 0;
  v_opening_cash_total numeric := 0;
  v_cash_unfunded_outflow numeric := 0;
  v_pending_total numeric := 0;
  v_pending_count integer := 0;
  v_cancelled_total numeric := 0;
  v_cancelled_count integer := 0;
  v_confirmed_total numeric := 0;
  v_difference_cash numeric := 0;
  v_difference_pix numeric := 0;
  v_difference_debit numeric := 0;
  v_difference_credit numeric := 0;
  v_difference_other numeric := 0;
  v_difference_total numeric := 0;
  v_abs_difference_total numeric := 0;
  v_divergence_type text := 'none';
  v_divergence_level text := 'none';
  v_has_divergence boolean := false;
  v_occurrence_required boolean := false;
  v_saved record;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store_id');
  END IF;

  IF v_status NOT IN ('draft', 'closed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF COALESCE(p_counted_cash_total, 0) < 0
     OR COALESCE(p_confirmed_pix_total, 0) < 0
     OR COALESCE(p_confirmed_debit_card_total, 0) < 0
     OR COALESCE(p_confirmed_credit_card_total, 0) < 0
     OR COALESCE(p_confirmed_other_total, 0) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'negative_values_not_allowed');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF v_user_id IS NULL
       OR NOT (
         public.app_is_store_owner(p_store_id)
         OR public.user_has_store_permission(p_store_id, 'cashbook.create')
       ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
  END IF;

  v_preview := public.get_cashbook_day_closing_preview_safe(p_store_id, v_closing_date);
  IF NOT COALESCE((v_preview ->> 'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'preview_failed', 'preview', v_preview - 'existing_closing');
  END IF;

  v_cash_movement := COALESCE((v_preview #>> '{expected,cash_movement}')::numeric, 0);
  v_cash_opening_suggested := COALESCE((v_preview #>> '{expected,cash_opening_suggested}')::numeric, 0);

  IF COALESCE(p_metadata ->> 'opening_cash_total', '') <> ''
     AND (p_metadata ->> 'opening_cash_total') !~ '^[0-9]+([.][0-9]{1,2})?
  v_pending_total := COALESCE((v_preview #>> '{pending,total}')::numeric, 0);
  v_pending_count := COALESCE((v_preview #>> '{pending,count}')::integer, 0);
  v_cancelled_total := COALESCE((v_preview #>> '{cancelled,total}')::numeric, 0);
  v_cancelled_count := COALESCE((v_preview #>> '{cancelled,count}')::integer, 0);

  v_confirmed_total := COALESCE(p_counted_cash_total, 0)
    + COALESCE(p_confirmed_pix_total, 0)
    + COALESCE(p_confirmed_debit_card_total, 0)
    + COALESCE(p_confirmed_credit_card_total, 0)
    + COALESCE(p_confirmed_other_total, 0);

  v_difference_cash := COALESCE(p_counted_cash_total, 0) - v_expected_cash;
  v_difference_pix := COALESCE(p_confirmed_pix_total, 0) - v_expected_pix;
  v_difference_debit := COALESCE(p_confirmed_debit_card_total, 0) - v_expected_debit;
  v_difference_credit := COALESCE(p_confirmed_credit_card_total, 0) - v_expected_credit;
  v_difference_other := COALESCE(p_confirmed_other_total, 0) - v_expected_other;
  v_difference_total := v_confirmed_total - v_expected_total;
  v_abs_difference_total := abs(v_difference_total);

  IF v_abs_difference_total >= 0.01 OR v_cash_unfunded_outflow >= 0.01 THEN
    v_has_divergence := true;
    v_divergence_type := CASE WHEN v_cash_unfunded_outflow >= 0.01 OR v_difference_total < 0 THEN 'shortage' ELSE 'surplus' END;
    v_occurrence_required := true;

    v_abs_difference_total := GREATEST(v_abs_difference_total, v_cash_unfunded_outflow);

    IF v_abs_difference_total <= 2 THEN
      v_divergence_level := 'low';
    ELSIF v_abs_difference_total <= 20 THEN
      v_divergence_level := 'relevant';
    ELSE
      v_divergence_level := 'critical';
    END IF;
  END IF;

  IF v_status = 'closed'
     AND v_has_divergence
     AND NULLIF(trim(COALESCE(p_notes, '')), '') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'divergence_notes_required',
      'message', 'Informe uma observacao para fechar caixa com divergencia.',
      'difference_total', v_difference_total,
      'divergence_type', v_divergence_type,
      'divergence_level', v_divergence_level
    );
  END IF;

  v_clean_metadata := COALESCE(p_metadata, '{}'::jsonb) - 'preview';
  v_clean_metadata := v_clean_metadata || jsonb_build_object(
    'expected_snapshot', (v_preview -> 'expected') || jsonb_build_object(
      'cash', v_expected_cash,
      'total', v_expected_total,
      'cash_opening_suggested', v_cash_opening_suggested,
      'opening_cash_total', v_opening_cash_total,
      'cash_movement', v_cash_movement,
      'cash_unfunded_outflow', v_cash_unfunded_outflow
    ),
    'pending_snapshot', COALESCE(v_clean_metadata -> 'pending_snapshot', v_preview -> 'pending'),
    'cancelled_snapshot', COALESCE(v_clean_metadata -> 'cancelled_snapshot', v_preview -> 'cancelled'),
    'closing_saved_at', now(),
    'closing_saved_by', v_user_id,
    'has_divergence', v_has_divergence,
    'divergence_type', v_divergence_type,
    'divergence_level', v_divergence_level,
    'occurrence_required', v_occurrence_required,
    'divergence_tolerance_snapshot', jsonb_build_object(
      'low_until', 2,
      'relevant_until', 20,
      'critical_above', 20,
      'currency', 'BRL',
      'source', 'temporary_backend_rule'
    ),
    'divergence_snapshot', jsonb_build_object(
      'expected_total', v_expected_total,
      'confirmed_total', v_confirmed_total,
      'difference_total', v_difference_total,
      'difference_cash', v_difference_cash,
      'difference_pix', v_difference_pix,
      'difference_debit_card', v_difference_debit,
      'difference_credit_card', v_difference_credit,
      'difference_other', v_difference_other,
      'opening_cash_total', v_opening_cash_total,
      'cash_opening_suggested', v_cash_opening_suggested,
      'cash_movement', v_cash_movement,
      'cash_unfunded_outflow', v_cash_unfunded_outflow
    )
  );

  INSERT INTO public.cashbook_day_closings (
    store_id,
    closing_date,
    status,
    expected_cash,
    expected_pix,
    expected_debit_card,
    expected_credit_card,
    expected_other,
    expected_total,
    counted_cash_total,
    counted_denominations,
    confirmed_pix_total,
    confirmed_debit_card_total,
    confirmed_credit_card_total,
    confirmed_other_total,
    confirmed_total,
    difference_cash,
    difference_pix,
    difference_debit_card,
    difference_credit_card,
    difference_other,
    difference_total,
    pending_total,
    pending_count,
    cancelled_total,
    cancelled_count,
    notes,
    metadata,
    closed_by,
    closed_at,
    created_by
  ) VALUES (
    p_store_id,
    v_closing_date,
    v_status,
    v_expected_cash,
    v_expected_pix,
    v_expected_debit,
    v_expected_credit,
    v_expected_other,
    v_expected_total,
    COALESCE(p_counted_cash_total, 0),
    COALESCE(p_counted_denominations, '{}'::jsonb),
    COALESCE(p_confirmed_pix_total, 0),
    COALESCE(p_confirmed_debit_card_total, 0),
    COALESCE(p_confirmed_credit_card_total, 0),
    COALESCE(p_confirmed_other_total, 0),
    v_confirmed_total,
    v_difference_cash,
    v_difference_pix,
    v_difference_debit,
    v_difference_credit,
    v_difference_other,
    v_difference_total,
    v_pending_total,
    v_pending_count,
    v_cancelled_total,
    v_cancelled_count,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_clean_metadata,
    CASE WHEN v_status = 'closed' THEN v_user_id ELSE NULL END,
    CASE WHEN v_status = 'closed' THEN now() ELSE NULL END,
    v_user_id
  )
  ON CONFLICT (store_id, closing_date)
  DO UPDATE SET
    status = EXCLUDED.status,
    expected_cash = EXCLUDED.expected_cash,
    expected_pix = EXCLUDED.expected_pix,
    expected_debit_card = EXCLUDED.expected_debit_card,
    expected_credit_card = EXCLUDED.expected_credit_card,
    expected_other = EXCLUDED.expected_other,
    expected_total = EXCLUDED.expected_total,
    counted_cash_total = EXCLUDED.counted_cash_total,
    counted_denominations = EXCLUDED.counted_denominations,
    confirmed_pix_total = EXCLUDED.confirmed_pix_total,
    confirmed_debit_card_total = EXCLUDED.confirmed_debit_card_total,
    confirmed_credit_card_total = EXCLUDED.confirmed_credit_card_total,
    confirmed_other_total = EXCLUDED.confirmed_other_total,
    confirmed_total = EXCLUDED.confirmed_total,
    difference_cash = EXCLUDED.difference_cash,
    difference_pix = EXCLUDED.difference_pix,
    difference_debit_card = EXCLUDED.difference_debit_card,
    difference_credit_card = EXCLUDED.difference_credit_card,
    difference_other = EXCLUDED.difference_other,
    difference_total = EXCLUDED.difference_total,
    pending_total = EXCLUDED.pending_total,
    pending_count = EXCLUDED.pending_count,
    cancelled_total = EXCLUDED.cancelled_total,
    cancelled_count = EXCLUDED.cancelled_count,
    notes = EXCLUDED.notes,
    metadata = EXCLUDED.metadata,
    closed_by = EXCLUDED.closed_by,
    closed_at = EXCLUDED.closed_at,
    updated_at = now()
  RETURNING * INTO v_saved;

  RETURN jsonb_build_object('ok', true, 'closing', to_jsonb(v_saved));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', 'Não foi possível salvar o fechamento. Revise os valores e tente novamente.');
END;
$function$
 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_opening_cash_total',
      'message', 'Informe um saldo de abertura válido, igual ou maior que zero.'
    );
  END IF;

  v_opening_cash_total := COALESCE(
    NULLIF(p_metadata ->> 'opening_cash_total', '')::numeric,
    v_cash_opening_suggested,
    0
  );

  IF v_opening_cash_total < 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'negative_opening_cash_not_allowed',
      'message', 'O saldo de abertura do caixa não pode ser negativo.'
    );
  END IF;

  v_expected_cash := GREATEST(v_opening_cash_total + v_cash_movement, 0);
  v_cash_unfunded_outflow := GREATEST(-(v_opening_cash_total + v_cash_movement), 0);
  v_expected_pix := GREATEST(COALESCE((v_preview #>> '{expected,pix}')::numeric, 0), 0);
  v_expected_debit := GREATEST(COALESCE((v_preview #>> '{expected,debit_card}')::numeric, 0), 0);
  v_expected_credit := GREATEST(COALESCE((v_preview #>> '{expected,credit_card}')::numeric, 0), 0);
  v_expected_other := GREATEST(COALESCE((v_preview #>> '{expected,other}')::numeric, 0), 0);
  v_expected_total := v_expected_cash + v_expected_pix + v_expected_debit + v_expected_credit + v_expected_other;
  v_pending_total := COALESCE((v_preview #>> '{pending,total}')::numeric, 0);
  v_pending_count := COALESCE((v_preview #>> '{pending,count}')::integer, 0);
  v_cancelled_total := COALESCE((v_preview #>> '{cancelled,total}')::numeric, 0);
  v_cancelled_count := COALESCE((v_preview #>> '{cancelled,count}')::integer, 0);

  v_confirmed_total := COALESCE(p_counted_cash_total, 0)
    + COALESCE(p_confirmed_pix_total, 0)
    + COALESCE(p_confirmed_debit_card_total, 0)
    + COALESCE(p_confirmed_credit_card_total, 0)
    + COALESCE(p_confirmed_other_total, 0);

  v_difference_cash := COALESCE(p_counted_cash_total, 0) - v_expected_cash;
  v_difference_pix := COALESCE(p_confirmed_pix_total, 0) - v_expected_pix;
  v_difference_debit := COALESCE(p_confirmed_debit_card_total, 0) - v_expected_debit;
  v_difference_credit := COALESCE(p_confirmed_credit_card_total, 0) - v_expected_credit;
  v_difference_other := COALESCE(p_confirmed_other_total, 0) - v_expected_other;
  v_difference_total := v_confirmed_total - v_expected_total;
  v_abs_difference_total := abs(v_difference_total);

  IF v_abs_difference_total >= 0.01 THEN
    v_has_divergence := true;
    v_divergence_type := CASE WHEN v_difference_total < 0 THEN 'shortage' ELSE 'surplus' END;
    v_occurrence_required := true;

    IF v_abs_difference_total <= 2 THEN
      v_divergence_level := 'low';
    ELSIF v_abs_difference_total <= 20 THEN
      v_divergence_level := 'relevant';
    ELSE
      v_divergence_level := 'critical';
    END IF;
  END IF;

  IF v_status = 'closed'
     AND v_has_divergence
     AND NULLIF(trim(COALESCE(p_notes, '')), '') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'divergence_notes_required',
      'message', 'Informe uma observacao para fechar caixa com divergencia.',
      'difference_total', v_difference_total,
      'divergence_type', v_divergence_type,
      'divergence_level', v_divergence_level
    );
  END IF;

  v_clean_metadata := COALESCE(p_metadata, '{}'::jsonb) - 'preview';
  v_clean_metadata := v_clean_metadata || jsonb_build_object(
    'expected_snapshot', COALESCE(v_clean_metadata -> 'expected_snapshot', v_preview -> 'expected'),
    'pending_snapshot', COALESCE(v_clean_metadata -> 'pending_snapshot', v_preview -> 'pending'),
    'cancelled_snapshot', COALESCE(v_clean_metadata -> 'cancelled_snapshot', v_preview -> 'cancelled'),
    'closing_saved_at', now(),
    'closing_saved_by', v_user_id,
    'has_divergence', v_has_divergence,
    'divergence_type', v_divergence_type,
    'divergence_level', v_divergence_level,
    'occurrence_required', v_occurrence_required,
    'divergence_tolerance_snapshot', jsonb_build_object(
      'low_until', 2,
      'relevant_until', 20,
      'critical_above', 20,
      'currency', 'BRL',
      'source', 'temporary_backend_rule'
    ),
    'divergence_snapshot', jsonb_build_object(
      'expected_total', v_expected_total,
      'confirmed_total', v_confirmed_total,
      'difference_total', v_difference_total,
      'difference_cash', v_difference_cash,
      'difference_pix', v_difference_pix,
      'difference_debit_card', v_difference_debit,
      'difference_credit_card', v_difference_credit,
      'difference_other', v_difference_other
    )
  );

  INSERT INTO public.cashbook_day_closings (
    store_id,
    closing_date,
    status,
    expected_cash,
    expected_pix,
    expected_debit_card,
    expected_credit_card,
    expected_other,
    expected_total,
    counted_cash_total,
    counted_denominations,
    confirmed_pix_total,
    confirmed_debit_card_total,
    confirmed_credit_card_total,
    confirmed_other_total,
    confirmed_total,
    difference_cash,
    difference_pix,
    difference_debit_card,
    difference_credit_card,
    difference_other,
    difference_total,
    pending_total,
    pending_count,
    cancelled_total,
    cancelled_count,
    notes,
    metadata,
    closed_by,
    closed_at,
    created_by
  ) VALUES (
    p_store_id,
    v_closing_date,
    v_status,
    v_expected_cash,
    v_expected_pix,
    v_expected_debit,
    v_expected_credit,
    v_expected_other,
    v_expected_total,
    COALESCE(p_counted_cash_total, 0),
    COALESCE(p_counted_denominations, '{}'::jsonb),
    COALESCE(p_confirmed_pix_total, 0),
    COALESCE(p_confirmed_debit_card_total, 0),
    COALESCE(p_confirmed_credit_card_total, 0),
    COALESCE(p_confirmed_other_total, 0),
    v_confirmed_total,
    v_difference_cash,
    v_difference_pix,
    v_difference_debit,
    v_difference_credit,
    v_difference_other,
    v_difference_total,
    v_pending_total,
    v_pending_count,
    v_cancelled_total,
    v_cancelled_count,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_clean_metadata,
    CASE WHEN v_status = 'closed' THEN v_user_id ELSE NULL END,
    CASE WHEN v_status = 'closed' THEN now() ELSE NULL END,
    v_user_id
  )
  ON CONFLICT (store_id, closing_date)
  DO UPDATE SET
    status = EXCLUDED.status,
    expected_cash = EXCLUDED.expected_cash,
    expected_pix = EXCLUDED.expected_pix,
    expected_debit_card = EXCLUDED.expected_debit_card,
    expected_credit_card = EXCLUDED.expected_credit_card,
    expected_other = EXCLUDED.expected_other,
    expected_total = EXCLUDED.expected_total,
    counted_cash_total = EXCLUDED.counted_cash_total,
    counted_denominations = EXCLUDED.counted_denominations,
    confirmed_pix_total = EXCLUDED.confirmed_pix_total,
    confirmed_debit_card_total = EXCLUDED.confirmed_debit_card_total,
    confirmed_credit_card_total = EXCLUDED.confirmed_credit_card_total,
    confirmed_other_total = EXCLUDED.confirmed_other_total,
    confirmed_total = EXCLUDED.confirmed_total,
    difference_cash = EXCLUDED.difference_cash,
    difference_pix = EXCLUDED.difference_pix,
    difference_debit_card = EXCLUDED.difference_debit_card,
    difference_credit_card = EXCLUDED.difference_credit_card,
    difference_other = EXCLUDED.difference_other,
    difference_total = EXCLUDED.difference_total,
    pending_total = EXCLUDED.pending_total,
    pending_count = EXCLUDED.pending_count,
    cancelled_total = EXCLUDED.cancelled_total,
    cancelled_count = EXCLUDED.cancelled_count,
    notes = EXCLUDED.notes,
    metadata = EXCLUDED.metadata,
    closed_by = EXCLUDED.closed_by,
    closed_at = EXCLUDED.closed_at,
    updated_at = now()
  RETURNING * INTO v_saved;

  RETURN jsonb_build_object('ok', true, 'closing', to_jsonb(v_saved));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', SQLERRM);
END;
$function$



-- Lista lançamentos por data operacional; entry_date é a autoridade do filtro.
CREATE OR REPLACE FUNCTION public.list_cashbook_entries_by_period_safe(
  p_store_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entries jsonb := '[]'::jsonb;
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 500), 1000));
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store_id', 'entries', '[]'::jsonb);
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id, 'cashbook.view')
    OR public.user_has_store_permission(p_store_id, 'cashbook.create')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied', 'entries', '[]'::jsonb);
  END IF;

  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_start_date > p_end_date THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_date_range',
      'message', 'A data inicial não pode ser posterior à data final.',
      'entries', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.occurred_at DESC), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT ce.*, o.customer_name AS order_customer_name, o.order_code AS order_code
    FROM public.cashbook_entries ce
    LEFT JOIN public.orders o ON o.id = ce.order_id
    WHERE ce.store_id = p_store_id
      AND (p_start_date IS NULL OR ce.entry_date >= p_start_date)
      AND (p_end_date IS NULL OR ce.entry_date <= p_end_date)
    ORDER BY ce.entry_date DESC, ce.occurred_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'entries', v_entries);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unexpected_error',
      'message', 'Não foi possível listar os lançamentos do período.',
      'entries', '[]'::jsonb
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_cashbook_entries_by_period_safe(uuid, date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_cashbook_entries_by_period_safe(uuid, date, date, integer) TO authenticated, service_role;

-- Fila operacional das vendas concluídas com exceção de estoque.
CREATE TABLE IF NOT EXISTS public.stock_discrepancy_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source_audit_log_id uuid UNIQUE REFERENCES public.audit_logs(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  occurrence_type text NOT NULL DEFAULT 'pdv_sale_without_stock',
  status text NOT NULL DEFAULT 'open',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  opening_notes text,
  resolution_type text,
  resolution_notes text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT stock_discrepancy_occurrences_status_check
    CHECK (status IN ('open','under_review','waiting_stock_count','resolved','cancelled')),
  CONSTRAINT stock_discrepancy_occurrences_items_array_check
    CHECK (jsonb_typeof(items) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_stock_discrepancy_occurrences_store_status_created
  ON public.stock_discrepancy_occurrences (store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_discrepancy_occurrences_order
  ON public.stock_discrepancy_occurrences (order_id)
  WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_discrepancy_occurrences_location
  ON public.stock_discrepancy_occurrences (location_id, created_at DESC)
  WHERE location_id IS NOT NULL;

ALTER TABLE public.stock_discrepancy_occurrences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stock_discrepancy_occurrences FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.stock_discrepancy_occurrences TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.stock_discrepancy_occurrences TO service_role;

DROP POLICY IF EXISTS stock_discrepancy_occurrences_select ON public.stock_discrepancy_occurrences;
CREATE POLICY stock_discrepancy_occurrences_select
ON public.stock_discrepancy_occurrences
FOR SELECT
TO authenticated
USING (
  public.app_is_store_owner(store_id)
  OR public.user_has_store_permission(store_id, 'stock.view')
);

CREATE OR REPLACE FUNCTION public.sync_pdv_stock_exception_occurrence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.action <> 'pdv_stock_exception' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.stock_discrepancy_occurrences (
    store_id, source_audit_log_id, order_id, location_id, items,
    opening_notes, created_by, created_at, metadata
  )
  VALUES (
    NEW.store_id,
    NEW.id,
    NEW.entity_id,
    NULLIF(NEW.new_data ->> 'location_id', '')::uuid,
    COALESCE(NEW.new_data -> 'items', '[]'::jsonb),
    'Venda concluída no PDV com quantidade superior ao saldo disponível.',
    NEW.user_id,
    NEW.created_at,
    jsonb_build_object(
      'source', 'audit_logs_pdv_stock_exception',
      'source_event_created_at', NEW.created_at,
      'source_payload', COALESCE(NEW.new_data, '{}'::jsonb)
    )
  )
  ON CONFLICT (source_audit_log_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_pdv_stock_exception_occurrence ON public.audit_logs;
CREATE TRIGGER trg_sync_pdv_stock_exception_occurrence
AFTER INSERT ON public.audit_logs
FOR EACH ROW
WHEN (NEW.action = 'pdv_stock_exception')
EXECUTE FUNCTION public.sync_pdv_stock_exception_occurrence();

INSERT INTO public.stock_discrepancy_occurrences (
  store_id, source_audit_log_id, order_id, location_id, items,
  opening_notes, created_by, created_at, metadata
)
SELECT
  al.store_id,
  al.id,
  al.entity_id,
  NULLIF(al.new_data ->> 'location_id', '')::uuid,
  COALESCE(al.new_data -> 'items', '[]'::jsonb),
  'Venda concluída no PDV com quantidade superior ao saldo disponível.',
  al.user_id,
  al.created_at,
  jsonb_build_object(
    'source', 'backfill_audit_logs_pdv_stock_exception',
    'source_event_created_at', al.created_at,
    'source_payload', COALESCE(al.new_data, '{}'::jsonb)
  )
FROM public.audit_logs al
WHERE al.action = 'pdv_stock_exception'
ON CONFLICT (source_audit_log_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.list_stock_discrepancy_occurrences_safe(
  p_store_id uuid,
  p_status text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_items jsonb := '[]'::jsonb;
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store_id', 'items', '[]'::jsonb);
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id, 'stock.view')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied', 'items', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      occ.*,
      o.order_code,
      sl.name AS location_name,
      COALESCE(sm.internal_alias, p.name, au.email, 'Operador') AS operator_name
    FROM public.stock_discrepancy_occurrences occ
    LEFT JOIN public.orders o ON o.id = occ.order_id
    LEFT JOIN public.stock_locations sl ON sl.id = occ.location_id
    LEFT JOIN auth.users au ON au.id = occ.created_by
    LEFT JOIN public.profiles p ON p.id = occ.created_by
    LEFT JOIN public.store_members sm ON sm.store_id = occ.store_id AND sm.user_id = occ.created_by
    WHERE occ.store_id = p_store_id
      AND (p_status IS NULL OR p_status = '' OR p_status = 'all' OR occ.status = p_status)
      AND (p_start_date IS NULL OR (occ.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_start_date)
      AND (p_end_date IS NULL OR (occ.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_end_date)
    ORDER BY occ.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unexpected_error',
      'message', 'Não foi possível carregar as divergências de estoque.',
      'items', '[]'::jsonb
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_stock_discrepancy_occurrence_safe(
  p_store_id uuid,
  p_occurrence_id uuid,
  p_status text,
  p_resolution_type text DEFAULT NULL,
  p_resolution_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_saved public.stock_discrepancy_occurrences%rowtype;
  v_status text := COALESCE(NULLIF(trim(p_status), ''), 'under_review');
  v_resolution_type text := NULLIF(trim(COALESCE(p_resolution_type, '')), '');
  v_resolution_notes text := NULLIF(trim(COALESCE(p_resolution_notes, '')), '');
BEGIN
  IF p_store_id IS NULL OR p_occurrence_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_required_fields');
  END IF;

  IF v_status NOT IN ('under_review','waiting_stock_count','resolved','cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF v_user_id IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id, 'stock.manage')
    OR public.user_has_store_permission(p_store_id, 'stock.adjust')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
  END IF;

  IF v_status IN ('resolved','cancelled') AND (v_resolution_type IS NULL OR v_resolution_notes IS NULL) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'resolution_details_required',
      'message', 'Informe o tipo de resolução e descreva o que foi conferido.'
    );
  END IF;

  UPDATE public.stock_discrepancy_occurrences
  SET
    status = v_status,
    resolution_type = v_resolution_type,
    resolution_notes = v_resolution_notes,
    resolved_by = CASE WHEN v_status IN ('resolved','cancelled') THEN v_user_id ELSE NULL END,
    resolved_at = CASE WHEN v_status IN ('resolved','cancelled') THEN now() ELSE NULL END,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_updated_at', now(),
      'last_updated_by', v_user_id,
      'last_update_metadata', COALESCE(p_metadata, '{}'::jsonb)
    ),
    updated_at = now()
  WHERE id = p_occurrence_id AND store_id = p_store_id
  RETURNING * INTO v_saved;

  IF v_saved.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'occurrence_not_found');
  END IF;

  INSERT INTO public.audit_logs (store_id, user_id, action, entity, entity_id, old_data, new_data)
  VALUES (
    p_store_id,
    v_user_id,
    'stock_discrepancy_occurrence_updated',
    'stock_discrepancy_occurrences',
    v_saved.id,
    '{}'::jsonb,
    jsonb_build_object(
      'status', v_saved.status,
      'resolution_type', v_saved.resolution_type,
      'resolution_notes', v_saved.resolution_notes,
      'order_id', v_saved.order_id,
      'location_id', v_saved.location_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'occurrence', to_jsonb(v_saved));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unexpected_error',
      'message', 'Não foi possível atualizar a divergência de estoque.'
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_stock_discrepancy_occurrences_safe(uuid, text, date, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_stock_discrepancy_occurrence_safe(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_stock_discrepancy_occurrences_safe(uuid, text, date, date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_stock_discrepancy_occurrence_safe(uuid, uuid, text, text, text, jsonb) TO authenticated, service_role;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'stock_discrepancy_occurrences'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_discrepancy_occurrences;
  END IF;
END
$do$;
