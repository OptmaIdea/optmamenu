-- POS_9 — Financeiro — corrige recursao de metadata no fechamento de caixa
--
-- Problema:
-- save_cashbook_day_closing_safe gravava o preview completo no metadata,
-- incluindo existing_closing, que por sua vez continha outro metadata.preview.
-- Isso criava uma cadeia recursiva grande e pouco legivel.
--
-- Correcao:
-- - recria save_cashbook_day_closing_safe para salvar somente snapshots limpos;
-- - remove a chave preview antiga dos registros existentes;
-- - preserva expected_snapshot, pending_snapshot, cancelled_snapshot e detalhes externos.

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

  v_clean_metadata := COALESCE(p_metadata, '{}'::jsonb) - 'preview';
  v_clean_metadata := v_clean_metadata || jsonb_build_object(
    'expected_snapshot', COALESCE(v_clean_metadata -> 'expected_snapshot', v_preview -> 'expected'),
    'pending_snapshot', COALESCE(v_clean_metadata -> 'pending_snapshot', v_preview -> 'pending'),
    'cancelled_snapshot', COALESCE(v_clean_metadata -> 'cancelled_snapshot', v_preview -> 'cancelled'),
    'closing_saved_at', now(),
    'closing_saved_by', v_user_id
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
    COALESCE(p_counted_cash_total, 0) - v_expected_cash,
    COALESCE(p_confirmed_pix_total, 0) - v_expected_pix,
    COALESCE(p_confirmed_debit_card_total, 0) - v_expected_debit,
    COALESCE(p_confirmed_credit_card_total, 0) - v_expected_credit,
    COALESCE(p_confirmed_other_total, 0) - v_expected_other,
    v_confirmed_total - v_expected_total,
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

-- Limpeza dos registros ja afetados: remove a chave preview recursiva e preserva snapshots/detalhes.
UPDATE public.cashbook_day_closings
SET
  metadata = COALESCE(metadata, '{}'::jsonb) - 'preview',
  updated_at = now()
WHERE metadata ? 'preview';

REVOKE ALL ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) TO service_role;
