-- POS_9 — Financeiro — ocorrencias de divergencia no fechamento de caixa
--
-- Objetivo:
-- - criar base propria para ocorrencias de divergencia de fechamento;
-- - gerar/atualizar ocorrencia automaticamente quando um fechamento possuir divergencia;
-- - permitir resolucao posterior com rastreabilidade;
-- - manter a operacao de fechamento separada da auditoria/resolucao.

CREATE TABLE IF NOT EXISTS public.cashbook_closing_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  closing_id uuid NOT NULL REFERENCES public.cashbook_day_closings(id) ON DELETE CASCADE,
  closing_date date NOT NULL,
  occurrence_type text NOT NULL DEFAULT 'cashbook_closing_divergence',
  status text NOT NULL DEFAULT 'open',
  divergence_type text NOT NULL DEFAULT 'none',
  divergence_level text NOT NULL DEFAULT 'none',
  expected_total numeric(14,2) NOT NULL DEFAULT 0,
  confirmed_total numeric(14,2) NOT NULL DEFAULT 0,
  difference_total numeric(14,2) NOT NULL DEFAULT 0,
  difference_cash numeric(14,2) NOT NULL DEFAULT 0,
  difference_pix numeric(14,2) NOT NULL DEFAULT 0,
  difference_debit_card numeric(14,2) NOT NULL DEFAULT 0,
  difference_credit_card numeric(14,2) NOT NULL DEFAULT 0,
  difference_other numeric(14,2) NOT NULL DEFAULT 0,
  opening_notes text,
  resolution_type text,
  resolution_notes text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT cashbook_closing_occurrences_status_check CHECK (
    status IN (
      'open',
      'waiting_external_confirmation',
      'under_review',
      'resolved',
      'cancelled',
      'converted_to_loss',
      'converted_to_adjustment'
    )
  ),
  CONSTRAINT cashbook_closing_occurrences_divergence_type_check CHECK (
    divergence_type IN ('none', 'shortage', 'surplus')
  ),
  CONSTRAINT cashbook_closing_occurrences_divergence_level_check CHECK (
    divergence_level IN ('none', 'low', 'relevant', 'critical')
  ),
  CONSTRAINT cashbook_closing_occurrences_unique_closing UNIQUE (closing_id)
);

CREATE INDEX IF NOT EXISTS idx_cashbook_closing_occurrences_store_status
  ON public.cashbook_closing_occurrences (store_id, status, closing_date DESC);

CREATE INDEX IF NOT EXISTS idx_cashbook_closing_occurrences_closing_date
  ON public.cashbook_closing_occurrences (store_id, closing_date DESC);

ALTER TABLE public.cashbook_closing_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashbook_closing_occurrences_select_safe ON public.cashbook_closing_occurrences;
DROP POLICY IF EXISTS cashbook_closing_occurrences_insert_safe ON public.cashbook_closing_occurrences;
DROP POLICY IF EXISTS cashbook_closing_occurrences_update_safe ON public.cashbook_closing_occurrences;
DROP POLICY IF EXISTS cashbook_closing_occurrences_delete_blocked ON public.cashbook_closing_occurrences;

CREATE POLICY cashbook_closing_occurrences_select_safe
  ON public.cashbook_closing_occurrences
  FOR SELECT
  TO authenticated
  USING (
    public.app_is_store_owner(store_id)
    OR public.user_has_store_permission(store_id, 'cashbook.view')
    OR public.user_has_store_permission(store_id, 'cashbook.create')
  );

CREATE POLICY cashbook_closing_occurrences_insert_safe
  ON public.cashbook_closing_occurrences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.app_is_store_owner(store_id)
    OR public.user_has_store_permission(store_id, 'cashbook.create')
  );

CREATE POLICY cashbook_closing_occurrences_update_safe
  ON public.cashbook_closing_occurrences
  FOR UPDATE
  TO authenticated
  USING (
    public.app_is_store_owner(store_id)
    OR public.user_has_store_permission(store_id, 'cashbook.create')
  )
  WITH CHECK (
    public.app_is_store_owner(store_id)
    OR public.user_has_store_permission(store_id, 'cashbook.create')
  );

CREATE POLICY cashbook_closing_occurrences_delete_blocked
  ON public.cashbook_closing_occurrences
  FOR DELETE
  TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.trg_sync_cashbook_closing_occurrence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_divergence boolean;
  v_divergence_type text;
  v_divergence_level text;
  v_occurrence_required boolean;
BEGIN
  v_has_divergence := COALESCE((NEW.metadata ->> 'has_divergence')::boolean, abs(COALESCE(NEW.difference_total, 0)) >= 0.01);
  v_occurrence_required := COALESCE((NEW.metadata ->> 'occurrence_required')::boolean, v_has_divergence);

  IF NOT v_has_divergence OR NOT v_occurrence_required THEN
    UPDATE public.cashbook_closing_occurrences
    SET
      status = CASE WHEN status IN ('resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment') THEN status ELSE 'cancelled' END,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'auto_cancel_reason', 'closing_without_divergence',
        'auto_cancelled_at', now()
      ),
      updated_at = now()
    WHERE closing_id = NEW.id
      AND status NOT IN ('resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment');

    RETURN NEW;
  END IF;

  v_divergence_type := COALESCE(NULLIF(NEW.metadata ->> 'divergence_type', ''), CASE WHEN NEW.difference_total < 0 THEN 'shortage' ELSE 'surplus' END);
  v_divergence_level := COALESCE(NULLIF(NEW.metadata ->> 'divergence_level', ''), 'relevant');

  INSERT INTO public.cashbook_closing_occurrences (
    store_id,
    closing_id,
    closing_date,
    status,
    divergence_type,
    divergence_level,
    expected_total,
    confirmed_total,
    difference_total,
    difference_cash,
    difference_pix,
    difference_debit_card,
    difference_credit_card,
    difference_other,
    opening_notes,
    created_by,
    metadata
  ) VALUES (
    NEW.store_id,
    NEW.id,
    NEW.closing_date,
    'open',
    v_divergence_type,
    v_divergence_level,
    COALESCE(NEW.expected_total, 0),
    COALESCE(NEW.confirmed_total, 0),
    COALESCE(NEW.difference_total, 0),
    COALESCE(NEW.difference_cash, 0),
    COALESCE(NEW.difference_pix, 0),
    COALESCE(NEW.difference_debit_card, 0),
    COALESCE(NEW.difference_credit_card, 0),
    COALESCE(NEW.difference_other, 0),
    NEW.notes,
    COALESCE(NEW.closed_by, NEW.created_by),
    jsonb_build_object(
      'source', 'cashbook_day_closing_trigger',
      'closing_status', NEW.status,
      'closing_metadata', COALESCE(NEW.metadata, '{}'::jsonb),
      'synced_at', now()
    )
  )
  ON CONFLICT (closing_id)
  DO UPDATE SET
    store_id = EXCLUDED.store_id,
    closing_date = EXCLUDED.closing_date,
    divergence_type = EXCLUDED.divergence_type,
    divergence_level = EXCLUDED.divergence_level,
    expected_total = EXCLUDED.expected_total,
    confirmed_total = EXCLUDED.confirmed_total,
    difference_total = EXCLUDED.difference_total,
    difference_cash = EXCLUDED.difference_cash,
    difference_pix = EXCLUDED.difference_pix,
    difference_debit_card = EXCLUDED.difference_debit_card,
    difference_credit_card = EXCLUDED.difference_credit_card,
    difference_other = EXCLUDED.difference_other,
    opening_notes = EXCLUDED.opening_notes,
    status = CASE
      WHEN public.cashbook_closing_occurrences.status IN ('resolved', 'converted_to_loss', 'converted_to_adjustment') THEN public.cashbook_closing_occurrences.status
      ELSE public.cashbook_closing_occurrences.status
    END,
    metadata = COALESCE(public.cashbook_closing_occurrences.metadata, '{}'::jsonb) || jsonb_build_object(
      'last_sync_source', 'cashbook_day_closing_trigger',
      'last_sync_at', now(),
      'closing_metadata', COALESCE(NEW.metadata, '{}'::jsonb)
    ),
    updated_at = now();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_cashbook_closing_occurrence ON public.cashbook_day_closings;
CREATE TRIGGER trg_sync_cashbook_closing_occurrence
AFTER INSERT OR UPDATE OF status, expected_total, confirmed_total, difference_total, difference_cash, difference_pix, difference_debit_card, difference_credit_card, difference_other, notes, metadata, closed_by, closed_at
ON public.cashbook_day_closings
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_cashbook_closing_occurrence();

-- Backfill para fechamentos divergentes existentes.
INSERT INTO public.cashbook_closing_occurrences (
  store_id,
  closing_id,
  closing_date,
  status,
  divergence_type,
  divergence_level,
  expected_total,
  confirmed_total,
  difference_total,
  difference_cash,
  difference_pix,
  difference_debit_card,
  difference_credit_card,
  difference_other,
  opening_notes,
  created_by,
  metadata
)
SELECT
  c.store_id,
  c.id,
  c.closing_date,
  'open',
  COALESCE(NULLIF(c.metadata ->> 'divergence_type', ''), CASE WHEN c.difference_total < 0 THEN 'shortage' ELSE 'surplus' END),
  COALESCE(NULLIF(c.metadata ->> 'divergence_level', ''), CASE WHEN abs(c.difference_total) <= 2 THEN 'low' WHEN abs(c.difference_total) <= 20 THEN 'relevant' ELSE 'critical' END),
  COALESCE(c.expected_total, 0),
  COALESCE(c.confirmed_total, 0),
  COALESCE(c.difference_total, 0),
  COALESCE(c.difference_cash, 0),
  COALESCE(c.difference_pix, 0),
  COALESCE(c.difference_debit_card, 0),
  COALESCE(c.difference_credit_card, 0),
  COALESCE(c.difference_other, 0),
  c.notes,
  COALESCE(c.closed_by, c.created_by),
  jsonb_build_object(
    'source', 'backfill_cashbook_closing_occurrences',
    'closing_metadata', COALESCE(c.metadata, '{}'::jsonb),
    'backfilled_at', now()
  )
FROM public.cashbook_day_closings c
WHERE (
    COALESCE((c.metadata ->> 'has_divergence')::boolean, false) = true
    OR abs(COALESCE(c.difference_total, 0)) >= 0.01
  )
  AND COALESCE((c.metadata ->> 'occurrence_required')::boolean, true) = true
ON CONFLICT (closing_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.list_cashbook_closing_occurrences_safe(
  p_store_id uuid,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_items jsonb := '[]'::jsonb;
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

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.closing_date DESC, o.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT *
    FROM public.cashbook_closing_occurrences occ
    WHERE occ.store_id = p_store_id
      AND (p_status IS NULL OR p_status = '' OR occ.status = p_status)
    ORDER BY occ.closing_date DESC, occ.created_at DESC
    LIMIT v_limit
  ) o;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_cashbook_closing_occurrence_safe(
  p_store_id uuid,
  p_occurrence_id uuid,
  p_status text,
  p_resolution_type text,
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
  v_saved public.cashbook_closing_occurrences%rowtype;
  v_status text := COALESCE(NULLIF(trim(p_status), ''), 'resolved');
BEGIN
  IF p_store_id IS NULL OR p_occurrence_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_required_fields');
  END IF;

  IF v_status NOT IN ('waiting_external_confirmation', 'under_review', 'resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF v_status IN ('resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment')
     AND NULLIF(trim(COALESCE(p_resolution_notes, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'resolution_notes_required', 'message', 'Informe uma observacao para resolver a ocorrencia.');
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

  UPDATE public.cashbook_closing_occurrences
  SET
    status = v_status,
    resolution_type = NULLIF(trim(COALESCE(p_resolution_type, '')), ''),
    resolution_notes = NULLIF(trim(COALESCE(p_resolution_notes, '')), ''),
    resolved_by = CASE WHEN v_status IN ('resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment') THEN v_user_id ELSE resolved_by END,
    resolved_at = CASE WHEN v_status IN ('resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment') THEN now() ELSE resolved_at END,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_resolution_update_at', now(),
      'last_resolution_update_by', v_user_id,
      'last_resolution_metadata', COALESCE(p_metadata, '{}'::jsonb)
    ),
    updated_at = now()
  WHERE id = p_occurrence_id
    AND store_id = p_store_id
  RETURNING * INTO v_saved;

  IF v_saved.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'occurrence_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'occurrence', to_jsonb(v_saved));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', SQLERRM);
END;
$function$;

REVOKE ALL ON TABLE public.cashbook_closing_occurrences FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cashbook_closing_occurrences TO authenticated;
GRANT ALL ON TABLE public.cashbook_closing_occurrences TO service_role;

REVOKE ALL ON FUNCTION public.list_cashbook_closing_occurrences_safe(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_cashbook_closing_occurrences_safe(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_cashbook_closing_occurrences_safe(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_cashbook_closing_occurrences_safe(uuid, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.resolve_cashbook_closing_occurrence_safe(uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_cashbook_closing_occurrence_safe(uuid, uuid, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_cashbook_closing_occurrence_safe(uuid, uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_cashbook_closing_occurrence_safe(uuid, uuid, text, text, text, jsonb) TO service_role;
