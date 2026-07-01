-- POS_9 — Financeiro — corrige confirmacao de recebimento pendente
--
-- Problema observado em runtime:
-- column "updated_at" of relation "orders" does not exist
--
-- Correcao:
-- recria a RPC confirm_pending_order_payment_safe sem atualizar orders.updated_at.
-- A auditoria continua registrada em payment_metadata, commercial_metadata e metadata.

CREATE OR REPLACE FUNCTION public.confirm_pending_order_payment_safe(
  p_store_id uuid,
  p_order_id uuid,
  p_payment_method_code text,
  p_received_at timestamptz DEFAULT now(),
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_order record;
  v_payment record;
  v_payment_code text;
  v_payment_method_enum payment_method;
  v_cashbook_entry record;
  v_cashbook_result jsonb := NULL;
  v_affects_cashbook boolean := true;
  v_received_at timestamptz := COALESCE(p_received_at, now());
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store_id');
  END IF;

  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_order_id');
  END IF;

  v_payment_code := COALESCE(NULLIF(trim(COALESCE(p_payment_method_code, '')), ''), 'pending');

  IF v_payment_code = 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payment_method', 'message', 'Informe a forma de pagamento recebida.');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF v_user_id IS NULL
       OR NOT (
         public.app_is_store_owner(p_store_id)
         OR public.user_has_store_permission(p_store_id, 'orders.manage')
       ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'access_denied',
        'message', 'Voce nao tem permissao para confirmar recebimento.'
      );
    END IF;
  END IF;

  SELECT o.*
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.store_id = p_store_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF COALESCE(v_order.status::text, '') = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_cancelled');
  END IF;

  IF COALESCE(v_order.payment_method_code, v_order.payment_method::text, '') <> 'pending' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'payment_not_pending',
      'payment_method_code', COALESCE(v_order.payment_method_code, v_order.payment_method::text)
    );
  END IF;

  SELECT
    pm.code,
    pm.name,
    COALESCE(pm.affects_cashbook, true) AS affects_cashbook,
    COALESCE(pm.requires_proof, false) AS requires_proof,
    COALESCE(pm.requires_change_for, false) AS requires_change_for
  INTO v_payment
  FROM public.store_payment_methods pm
  WHERE pm.store_id = p_store_id
    AND pm.code = v_payment_code
    AND pm.active = true
  LIMIT 1;

  IF v_payment.code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_method_disabled');
  END IF;

  v_affects_cashbook := COALESCE(v_payment.affects_cashbook, true);

  v_payment_method_enum :=
    CASE
      WHEN v_payment.code = 'cash' THEN 'cash'::payment_method
      WHEN v_payment.code = 'pix' THEN 'pix'::payment_method
      WHEN v_payment.code IN ('debit_card', 'credit_card', 'card') THEN 'card'::payment_method
      ELSE 'pending'::payment_method
    END;

  IF v_payment_method_enum = 'pending'::payment_method THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_method_not_mapped', 'payment_method_code', v_payment.code);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cashbook_entries ce
    WHERE ce.store_id = p_store_id
      AND ce.order_id = p_order_id
      AND ce.type = 'sale'
      AND ce.status = 'confirmed'
      AND COALESCE(ce.affects_balance, true) = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cashbook_entry_already_confirmed');
  END IF;

  UPDATE public.orders o
  SET
    payment_method = v_payment_method_enum,
    payment_method_code = v_payment.code,
    payment_metadata = COALESCE(o.payment_metadata, '{}'::jsonb) || jsonb_build_object(
      'code', v_payment.code,
      'name', v_payment.name,
      'affects_cashbook', v_affects_cashbook,
      'requires_proof', COALESCE(v_payment.requires_proof, false),
      'requires_change_for', COALESCE(v_payment.requires_change_for, false),
      'confirmed_from_pending', true,
      'confirmed_at', v_received_at,
      'confirmed_by', v_user_id,
      'notes', NULLIF(trim(COALESCE(p_notes, '')), '')
    ),
    commercial_metadata = COALESCE(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object(
      'payment_confirmed_from_pending', true,
      'payment_confirmed_at', v_received_at,
      'payment_confirmed_by', v_user_id,
      'payment_method_code', v_payment.code,
      'payment_method_name', v_payment.name
    ),
    metadata = COALESCE(o.metadata, '{}'::jsonb) || jsonb_build_object(
      'pending_payment_confirmed', true,
      'pending_payment_confirmed_at', v_received_at,
      'pending_payment_confirmed_by', v_user_id
    )
  WHERE o.id = p_order_id
    AND o.store_id = p_store_id;

  SELECT ce.*
  INTO v_cashbook_entry
  FROM public.cashbook_entries ce
  WHERE ce.store_id = p_store_id
    AND ce.order_id = p_order_id
    AND ce.type = 'sale'
  ORDER BY ce.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_cashbook_entry.id IS NOT NULL THEN
    UPDATE public.cashbook_entries ce
    SET
      status = 'confirmed',
      affects_balance = v_affects_cashbook,
      payment_method = v_payment.code,
      payment_method_code = v_payment.code,
      occurred_at = v_received_at,
      entry_date = (v_received_at AT TIME ZONE 'America/Sao_Paulo')::date,
      notes = COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), ce.notes),
      metadata = COALESCE(ce.metadata, '{}'::jsonb) || jsonb_build_object(
        'pending_payment_confirmed', true,
        'pending_payment_confirmed_at', v_received_at,
        'pending_payment_confirmed_by', v_user_id,
        'payment_method_code', v_payment.code,
        'payment_method_name', v_payment.name,
        'affects_balance_after_confirmation', v_affects_cashbook
      ) || COALESCE(p_metadata, '{}'::jsonb),
      updated_at = now()
    WHERE ce.id = v_cashbook_entry.id
    RETURNING to_jsonb(ce.*) INTO v_cashbook_result;
  ELSIF v_affects_cashbook THEN
    v_cashbook_result := public.create_cashbook_entry_from_order(p_order_id);
  ELSE
    v_cashbook_result := jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'payment_method_does_not_affect_cashbook',
      'payment_method_code', v_payment.code
    );
  END IF;

  IF v_order.customer_id IS NOT NULL THEN
    PERFORM public.refresh_customer_commercial_summary(v_order.customer_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'order_code', v_order.order_code,
    'payment_method_code', v_payment.code,
    'payment_method_name', v_payment.name,
    'affects_cashbook', v_affects_cashbook,
    'received_at', v_received_at,
    'cashbook', COALESCE(v_cashbook_result, 'null'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unexpected_error',
      'message', SQLERRM
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_pending_order_payment_safe(uuid, uuid, text, timestamptz, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_pending_order_payment_safe(uuid, uuid, text, timestamptz, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_pending_order_payment_safe(uuid, uuid, text, timestamptz, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_pending_order_payment_safe(uuid, uuid, text, timestamptz, text, jsonb) TO service_role;
