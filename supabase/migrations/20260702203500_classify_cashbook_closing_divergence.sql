-- POS_9 — Financeiro — classifica divergencia no fechamento de caixa
--
-- Objetivo:
-- - classificar divergencia no backend ao salvar fechamento;
-- - registrar metadados minimos para futura ocorrencia financeira;
-- - manter a operacao fechando o caixa, mas com rastreabilidade.
--
-- Regra inicial temporaria:
-- - difference_total = 0: none
-- - ate R$ 2,00: low
-- - ate R$ 20,00: relevant
-- - acima de R$ 20,00: critical
--
-- Futuro: tornar limites configuraveis por loja.

CREATE OR REPLACE FUNCTION public.save_cashbook_day_closing_safe(
  p_store_id uuid,
  p_closing_date date,
  p_counted_denominations jsonb DEFAULT '{}'::jsonb,
  p_counted_cash_total numeric DEFAULT 0,
  p_confirmed_pix_total numeric DEFAULT 0,
  p_confirmed_debit_card_total numeric DEFAULT 0,
  p_confirmed_credit_card_total numeric DEFAULT 0,
  p_confirmed_other_total numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_status text DEFAULT 'closed',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
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

  v_expected_cash := COALESCE((v_preview #>> '{expected,cash}')::numeric, 0);
  v_expected_pix := COALESCE((v_preview #>> '{expected,pix}')::numeric, 0);
  v_expected_debit := COALESCE((v_preview #>> '{expected,debit_card}')::numeric, 0);
  v_expected_credit := COALESCE((v_preview #>> '{expected,credit_card}')::numeric, 0);
  v_expected_other := COALESCE((v_preview #>> '{expected,other}')::numeric, 0);
  v_expected_total := COALESCE((v_preview #>> '{expected,total}')::numeric, 0);
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
$function$;

-- Backfill simples para fechamentos existentes.
UPDATE public.cashbook_day_closings c
SET
  metadata = COALESCE(c.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'has_divergence', abs(COALESCE(c.difference_total, 0)) >= 0.01,
      'divergence_type', CASE
        WHEN abs(COALESCE(c.difference_total, 0)) < 0.01 THEN 'none'
        WHEN c.difference_total < 0 THEN 'shortage'
        ELSE 'surplus'
      END,
      'divergence_level', CASE
        WHEN abs(COALESCE(c.difference_total, 0)) < 0.01 THEN 'none'
        WHEN abs(COALESCE(c.difference_total, 0)) <= 2 THEN 'low'
        WHEN abs(COALESCE(c.difference_total, 0)) <= 20 THEN 'relevant'
        ELSE 'critical'
      END,
      'occurrence_required', abs(COALESCE(c.difference_total, 0)) >= 0.01,
      'divergence_backfilled_at', now()
    ),
  updated_at = now()
WHERE NOT (COALESCE(c.metadata, '{}'::jsonb) ? 'has_divergence');

REVOKE ALL ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) TO service_role;
