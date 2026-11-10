CREATE OR REPLACE FUNCTION public.confirm_order_stock(
  p_store_id uuid,
  p_order_id uuid,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM public.stock_reservations
    WHERE store_id = p_store_id
      AND order_id = p_order_id
      AND status = 'active'
    ORDER BY created_at
  LOOP
    IF coalesce(r.quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'Reserva com quantidade inválida para o pedido %', p_order_id
        USING ERRCODE = '23514';
    END IF;

    PERFORM public.apply_stock_movement_delta_v2(
      p_store_id := p_store_id,
      p_product_id := r.product_id,
      p_movement_type := 'confirmation'::public.stock_movement_type,
      p_quantity := r.quantity,
      p_affects_physical := true,
      p_reason := 'order',
      p_order_id := p_order_id,
      p_source := 'confirm',
      p_metadata := coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object(
        'reservation_id', r.id,
        'confirmation_source', 'confirm_order_stock'
      ),
      p_created_by := p_created_by,
      p_location_id := r.location_id,
      p_from_location_id := NULL,
      p_to_location_id := NULL,
      p_transfer_id := NULL,
      p_supplier_id := NULL,
      p_reason_code := 'order_confirmed',
      p_variant_id := NULL,
      p_sync_legacy_balance := true
    );

    UPDATE public.stock_reservations
    SET status = 'consumed',
        consumed_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'consumed_at', now(),
          'consumed_by_function', 'confirm_order_stock'
        )
    WHERE id = r.id;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_order_reservations(
  p_store_id uuid,
  p_order_id uuid,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM public.stock_reservations
    WHERE store_id = p_store_id
      AND order_id = p_order_id
      AND status = 'active'
    ORDER BY created_at
  LOOP
    IF coalesce(r.quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'Reserva com quantidade inválida para o pedido %', p_order_id
        USING ERRCODE = '23514';
    END IF;

    PERFORM public.apply_stock_movement_delta_v2(
      p_store_id := p_store_id,
      p_product_id := r.product_id,
      p_movement_type := 'cancellation'::public.stock_movement_type,
      p_quantity := r.quantity,
      p_affects_physical := false,
      p_reason := 'order',
      p_order_id := p_order_id,
      p_source := 'cancel_before_confirm',
      p_metadata := coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object(
        'reservation_id', r.id,
        'cancelled_by_function', 'cancel_order_reservations'
      ),
      p_created_by := p_created_by,
      p_location_id := r.location_id,
      p_from_location_id := NULL,
      p_to_location_id := NULL,
      p_transfer_id := NULL,
      p_supplier_id := NULL,
      p_reason_code := 'order_cancelled',
      p_variant_id := NULL,
      p_sync_legacy_balance := true
    );

    UPDATE public.stock_reservations
    SET status = 'cancelled',
        cancelled_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'cancelled_at', now(),
          'cancelled_by_function', 'cancel_order_reservations'
        )
    WHERE id = r.id;
  END LOOP;

  PERFORM public.reconcile_inventory_reservations(p_store_id, true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_reservation_only(
  p_store_id uuid,
  p_order_id uuid,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM public.stock_reservations
    WHERE store_id = p_store_id
      AND order_id = p_order_id
      AND status = 'active'
    ORDER BY created_at
  LOOP
    IF coalesce(r.quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'Reserva com quantidade inválida para o pedido %', p_order_id
        USING ERRCODE = '23514';
    END IF;

    PERFORM public.apply_stock_movement_delta_v2(
      p_store_id := p_store_id,
      p_product_id := r.product_id,
      p_movement_type := 'cancellation'::public.stock_movement_type,
      p_quantity := r.quantity,
      p_affects_physical := false,
      p_reason := 'order',
      p_order_id := p_order_id,
      p_source := 'cancel_before_confirm',
      p_metadata := coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object(
        'reservation_id', r.id,
        'cancelled_by_function', 'cancel_reservation_only'
      ),
      p_created_by := p_created_by,
      p_location_id := r.location_id,
      p_from_location_id := NULL,
      p_to_location_id := NULL,
      p_transfer_id := NULL,
      p_supplier_id := NULL,
      p_reason_code := 'reservation_cancelled',
      p_variant_id := NULL,
      p_sync_legacy_balance := true
    );

    UPDATE public.stock_reservations
    SET status = 'cancelled',
        cancelled_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'cancelled_at', now(),
          'cancelled_by_function', 'cancel_reservation_only'
        )
    WHERE id = r.id;
  END LOOP;

  PERFORM public.reconcile_inventory_reservations(p_store_id, true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_public_order_by_slug_v3(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment_type text,
  p_sales_channel text,
  p_items jsonb,
  p_delivery_address jsonb DEFAULT '{}'::jsonb,
  p_table_code text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_payment_selection jsonb DEFAULT '{}'::jsonb,
  p_delivery_method_code text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_store_id uuid;
  v_fulfillment text := CASE WHEN p_fulfillment_type = 'table' THEN 'qr_table' ELSE coalesce(nullif(trim(p_fulfillment_type), ''), 'pickup') END;
  v_timing text := coalesce(nullif(trim(p_payment_selection->>'timing'), ''), 'pay_on_fulfillment');
  v_selected_method_code text := nullif(trim(p_payment_selection->>'method_code'), '');
  v_promised_method_code text := nullif(trim(p_payment_selection->>'promised_method_code'), '');
  v_change_for numeric := NULL;
  v_method record;
  v_effective_payment_code text := 'pending';
  v_effective_delivery_code text;
  v_result jsonb;
  v_order_id uuid;
  v_checkout_metadata jsonb;
  v_payment_enum public.payment_method := 'pending'::public.payment_method;
BEGIN
  v_store_id := public.resolve_public_store_id_by_slug(p_slug);
  IF v_store_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled'); END IF;

  v_effective_delivery_code := CASE
    WHEN nullif(trim(coalesce(p_delivery_method_code, '')), '') IS NULL THEN NULL
    WHEN p_delivery_method_code = 'delivery' THEN 'local_delivery'
    ELSE p_delivery_method_code
  END;

  IF p_payment_selection ? 'change_for' AND nullif(trim(p_payment_selection->>'change_for'), '') IS NOT NULL THEN
    BEGIN
      v_change_for := (p_payment_selection->>'change_for')::numeric;
    EXCEPTION WHEN others THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_change_for');
    END;
    IF v_change_for <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_change_for'); END IF;
  END IF;

  IF v_timing = 'pay_now' THEN
    IF v_selected_method_code IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'payment_method_required'); END IF;

    SELECT pm.code, pm.name, coalesce(pm.base_code, pm.code) AS base_code, pm.requires_proof, pm.metadata
      INTO v_method
    FROM public.store_payment_methods pm
    WHERE pm.store_id = v_store_id
      AND pm.code = v_selected_method_code
      AND pm.active = true
      AND pm.public_enabled = true
      AND coalesce((pm.metadata->'checkout'->>'pay_now')::boolean, false) = true
    LIMIT 1;

    IF v_method.code IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'payment_method_disabled'); END IF;

    IF coalesce(v_method.metadata->'checkout'->>'confirmation_mode', '') = 'api'
       AND coalesce((v_method.metadata->'checkout'->>'integration_enabled')::boolean, false) = false THEN
      RETURN jsonb_build_object('ok', false, 'error', 'payment_integration_unavailable');
    END IF;

    IF coalesce(v_method.metadata->'checkout'->>'confirmation_mode', '') = 'manual_proof'
       AND v_method.requires_proof IS NOT true THEN
      RETURN jsonb_build_object('ok', false, 'error', 'payment_method_misconfigured');
    END IF;

    v_effective_payment_code := v_method.code;
    v_payment_enum := CASE
      WHEN v_method.base_code = 'pix' THEN 'pix'::public.payment_method
      WHEN v_method.base_code = 'cash' THEN 'cash'::public.payment_method
      WHEN v_method.base_code IN ('debit_card', 'credit_card') THEN 'card'::public.payment_method
      ELSE 'pending'::public.payment_method
    END;
    v_checkout_metadata := jsonb_build_object(
      'timing', 'pay_now',
      'selected_method_code', v_method.code,
      'selected_method_name', v_method.name,
      'confirmation_mode', coalesce(v_method.metadata->'checkout'->>'confirmation_mode', 'api'),
      'requires_proof', coalesce(v_method.requires_proof, false),
      'awaiting_confirmation', true
    );
  ELSIF v_timing = 'pay_on_fulfillment' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.store_payment_methods pm
      WHERE pm.store_id = v_store_id AND pm.code = 'pending' AND pm.active = true AND pm.public_enabled = true
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'payment_method_disabled'); END IF;

    IF v_fulfillment = 'delivery' THEN
      IF v_promised_method_code NOT IN ('pix', 'card', 'cash') THEN RETURN jsonb_build_object('ok', false, 'error', 'delivery_payment_method_required'); END IF;

      IF v_promised_method_code = 'pix' AND NOT EXISTS (
        SELECT 1 FROM public.store_payment_methods pm WHERE pm.store_id = v_store_id AND pm.active = true AND pm.public_enabled = true
          AND coalesce(pm.base_code, pm.code) = 'pix' AND pm.code <> 'pix_manual_qr'
          AND coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean, false) = true
      ) THEN RETURN jsonb_build_object('ok', false, 'error', 'delivery_payment_method_disabled'); END IF;

      IF v_promised_method_code = 'card' AND NOT EXISTS (
        SELECT 1 FROM public.store_payment_methods pm WHERE pm.store_id = v_store_id AND pm.active = true AND pm.public_enabled = true
          AND coalesce(pm.base_code, pm.code) IN ('debit_card', 'credit_card')
          AND coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean, false) = true
      ) THEN RETURN jsonb_build_object('ok', false, 'error', 'delivery_payment_method_disabled'); END IF;

      IF v_promised_method_code = 'cash' AND NOT EXISTS (
        SELECT 1 FROM public.store_payment_methods pm WHERE pm.store_id = v_store_id AND pm.active = true AND pm.public_enabled = true
          AND coalesce(pm.base_code, pm.code) = 'cash'
          AND coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean, false) = true
      ) THEN RETURN jsonb_build_object('ok', false, 'error', 'delivery_payment_method_disabled'); END IF;
    ELSE
      v_promised_method_code := NULL;
      v_change_for := NULL;
    END IF;

    v_effective_payment_code := 'pending';
    v_payment_enum := 'pending'::public.payment_method;
    v_checkout_metadata := jsonb_build_object(
      'timing', 'pay_on_fulfillment',
      'fulfillment_label', CASE
        WHEN v_fulfillment = 'delivery' THEN 'Pagar na entrega'
        WHEN v_fulfillment IN ('qr_table', 'dine_in') THEN 'Pagar no atendimento'
        ELSE 'Pagar na retirada'
      END,
      'promised_method_code', v_promised_method_code,
      'change_for', v_change_for,
      'awaiting_confirmation', true
    );
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payment_timing');
  END IF;

  v_result := public.create_public_order_by_slug_v2(
    p_slug,
    p_customer_name,
    p_customer_phone,
    v_fulfillment,
    p_sales_channel,
    p_payment_method_code => v_effective_payment_code,
    p_delivery_method_code => v_effective_delivery_code,
    p_items => p_items,
    p_delivery_address => p_delivery_address,
    p_table_code => p_table_code,
    p_notes => p_notes
  );

  IF coalesce((v_result->>'ok')::boolean, false) = false THEN RETURN v_result; END IF;

  v_order_id := nullif(v_result->'order'->>'id', '')::uuid;
  IF v_order_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'order_result_missing_id'); END IF;

  UPDATE public.orders o
  SET payment_method = v_payment_enum,
      payment_method_code = v_effective_payment_code,
      payment_metadata = coalesce(o.payment_metadata, '{}'::jsonb) || jsonb_build_object('checkout', v_checkout_metadata),
      commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object(
        'payment_timing', v_timing,
        'promised_payment_method', v_promised_method_code,
        'payment_confirmation_mode', CASE WHEN v_timing = 'pay_now' THEN v_checkout_metadata->>'confirmation_mode' ELSE 'at_fulfillment' END
      )
  WHERE o.id = v_order_id AND o.store_id = v_store_id;

  v_result := jsonb_set(
    v_result,
    '{order}',
    coalesce(v_result->'order', '{}'::jsonb) || jsonb_build_object(
      'payment_method', v_payment_enum::text,
      'payment_timing', v_timing,
      'payment_method_code', v_effective_payment_code,
      'promised_payment_method_code', v_promised_method_code,
      'requires_proof', coalesce((v_checkout_metadata->>'requires_proof')::boolean, false),
      'payment_confirmation_mode', CASE WHEN v_timing = 'pay_now' THEN v_checkout_metadata->>'confirmation_mode' ELSE 'at_fulfillment' END
    ),
    true
  );

  RETURN v_result;
END;
$function$;

NOTIFY pgrst, 'reload schema';
