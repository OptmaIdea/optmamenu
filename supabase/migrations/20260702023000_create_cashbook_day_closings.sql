-- POS_9 — Financeiro — Fechamento do caixa do dia
--
-- Primeira base segura para fechamento:
-- - cria tabela cashbook_day_closings;
-- - cria RPC de previa do fechamento;
-- - cria RPC para salvar/fechar conferencia;
-- - usa cashbook_entries como fonte de verdade;
-- - pendentes/cancelados/affects_balance=false ficam fora do realizado.

CREATE TABLE IF NOT EXISTS public.cashbook_day_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  closing_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft'::text, 'closed'::text, 'reopened'::text, 'adjusted'::text])),

  expected_cash numeric NOT NULL DEFAULT 0,
  expected_pix numeric NOT NULL DEFAULT 0,
  expected_debit_card numeric NOT NULL DEFAULT 0,
  expected_credit_card numeric NOT NULL DEFAULT 0,
  expected_other numeric NOT NULL DEFAULT 0,
  expected_total numeric NOT NULL DEFAULT 0,

  counted_cash_total numeric NOT NULL DEFAULT 0,
  counted_denominations jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_pix_total numeric NOT NULL DEFAULT 0,
  confirmed_debit_card_total numeric NOT NULL DEFAULT 0,
  confirmed_credit_card_total numeric NOT NULL DEFAULT 0,
  confirmed_other_total numeric NOT NULL DEFAULT 0,
  confirmed_total numeric NOT NULL DEFAULT 0,

  difference_cash numeric NOT NULL DEFAULT 0,
  difference_pix numeric NOT NULL DEFAULT 0,
  difference_debit_card numeric NOT NULL DEFAULT 0,
  difference_credit_card numeric NOT NULL DEFAULT 0,
  difference_other numeric NOT NULL DEFAULT 0,
  difference_total numeric NOT NULL DEFAULT 0,

  pending_total numeric NOT NULL DEFAULT 0,
  pending_count integer NOT NULL DEFAULT 0,
  cancelled_total numeric NOT NULL DEFAULT 0,
  cancelled_count integer NOT NULL DEFAULT 0,

  notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_by uuid NULL REFERENCES auth.users(id),
  closed_at timestamptz NULL,
  created_by uuid NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cashbook_day_closings_amounts_non_negative CHECK (
    expected_cash >= 0
    AND expected_pix >= 0
    AND expected_debit_card >= 0
    AND expected_credit_card >= 0
    AND expected_other >= 0
    AND expected_total >= 0
    AND counted_cash_total >= 0
    AND confirmed_pix_total >= 0
    AND confirmed_debit_card_total >= 0
    AND confirmed_credit_card_total >= 0
    AND confirmed_other_total >= 0
    AND confirmed_total >= 0
    AND pending_total >= 0
    AND pending_count >= 0
    AND cancelled_total >= 0
    AND cancelled_count >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cashbook_day_closings_store_date
  ON public.cashbook_day_closings(store_id, closing_date);

CREATE INDEX IF NOT EXISTS idx_cashbook_day_closings_store_status
  ON public.cashbook_day_closings(store_id, status, closing_date DESC);

CREATE OR REPLACE TRIGGER trg_cashbook_day_closings_updated_at
BEFORE UPDATE ON public.cashbook_day_closings
FOR EACH ROW
EXECUTE FUNCTION public.trg_cashbook_entries_updated_at();

ALTER TABLE public.cashbook_day_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashbook_day_closings_deny_anon ON public.cashbook_day_closings;
CREATE POLICY cashbook_day_closings_deny_anon
ON public.cashbook_day_closings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS cashbook_day_closings_owner_or_cashbook_read ON public.cashbook_day_closings;
CREATE POLICY cashbook_day_closings_owner_or_cashbook_read
ON public.cashbook_day_closings
FOR SELECT
TO authenticated
USING (
  public.app_is_store_owner(store_id)
  OR public.user_has_store_permission(store_id, 'cashbook.view')
  OR public.user_has_store_permission(store_id, 'cashbook.create')
);

DROP POLICY IF EXISTS cashbook_day_closings_owner_or_cashbook_write ON public.cashbook_day_closings;
CREATE POLICY cashbook_day_closings_owner_or_cashbook_write
ON public.cashbook_day_closings
FOR ALL
TO authenticated
USING (
  public.app_is_store_owner(store_id)
  OR public.user_has_store_permission(store_id, 'cashbook.create')
)
WITH CHECK (
  public.app_is_store_owner(store_id)
  OR public.user_has_store_permission(store_id, 'cashbook.create')
);

CREATE OR REPLACE FUNCTION public.get_cashbook_day_closing_preview_safe(
  p_store_id uuid,
  p_closing_date date DEFAULT CURRENT_DATE
)
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
    COALESCE(SUM(balance), 0),
    COALESCE(jsonb_agg(jsonb_build_object('payment_method_code', method_code, 'balance', balance) ORDER BY method_code), '[]'::jsonb)
  INTO v_expected_cash, v_expected_pix, v_expected_debit, v_expected_credit, v_expected_other, v_expected_total, v_by_method
  FROM realized;

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
    RETURN jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', SQLERRM);
END;
$function$;

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
    RETURN jsonb_build_object('ok', false, 'error', 'preview_failed', 'preview', v_preview);
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
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('preview', v_preview),
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

REVOKE ALL ON TABLE public.cashbook_day_closings FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cashbook_day_closings TO authenticated;
GRANT ALL ON TABLE public.cashbook_day_closings TO service_role;

REVOKE ALL ON FUNCTION public.get_cashbook_day_closing_preview_safe(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cashbook_day_closing_preview_safe(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_cashbook_day_closing_preview_safe(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cashbook_day_closing_preview_safe(uuid, date) TO service_role;

REVOKE ALL ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cashbook_day_closing_safe(uuid, date, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, jsonb) TO service_role;
