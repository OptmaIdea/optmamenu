CREATE OR REPLACE FUNCTION public.create_admin_direct_sale_order_legacy_internal(p_store_id uuid, p_items jsonb, p_customer_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_payment_method_code text DEFAULT 'pending'::text, p_notes text DEFAULT NULL::text, p_location_id uuid DEFAULT NULL::uuid, p_sales_channel text DEFAULT 'direct'::text, p_fulfillment_type text DEFAULT 'pickup'::text, p_create_customer_if_missing boolean DEFAULT true, p_marketing_consent boolean DEFAULT false, p_loyalty_opt_in boolean DEFAULT true, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_store record;
  v_location_id uuid;
  v_location record;

  v_sales_channel text := 'direct';
  v_fulfillment_type text := 'pickup';

  v_payment_code text := 'pending';
  v_payment_name text := 'Pendente';
  v_payment_requires_proof boolean := false;
  v_payment_requires_change_for boolean := false;
  v_payment_affects_cashbook boolean := true;
  v_payment_method_enum payment_method := 'pending'::payment_method;

  v_customer record;
  v_customer_id uuid;
  v_customer_name text;
  v_customer_phone text;

  v_item jsonb;
  v_product record;
  v_product_id uuid;
  v_qty integer;
  v_unit_price numeric;
  v_discount numeric;
  v_line_total numeric;
  v_line_gross_total numeric;
  v_original_unit_price numeric;
  v_automatic_discount numeric;
  v_manual_discount numeric;
  v_discount_reason text;
  v_pricing_source text;
  v_price_rule jsonb;
  v_item_metadata jsonb;

  v_subtotal numeric := 0;
  v_gross_subtotal numeric := 0;
  v_discount_total numeric := 0;
  v_total numeric := 0;
  v_items_count integer := 0;

  v_on_hand_before numeric;
  v_reserved numeric;
  v_available numeric;
  v_on_hand_after numeric;

  v_order_id uuid;
  v_order_code text;
  v_cashbook_result jsonb := NULL;
  v_loyalty_result jsonb := NULL;
BEGIN
  v_sales_channel := COALESCE(NULLIF(trim(COALESCE(p_sales_channel, '')), ''), 'direct');
  v_fulfillment_type := COALESCE(NULLIF(trim(COALESCE(p_fulfillment_type, '')), ''), 'pickup');

  IF v_fulfillment_type = 'in_person' THEN
    v_fulfillment_type := 'pickup';
  END IF;

  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store_id');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_cart');
  END IF;

  IF jsonb_array_length(p_items) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_items');
  END IF;

  IF v_sales_channel NOT IN ('direct', 'in_person', 'phone', 'whatsapp', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_sales_channel');
  END IF;

  IF v_fulfillment_type NOT IN ('pickup', 'delivery', 'qr_table', 'dine_in', 'other') THEN
    v_fulfillment_type := 'pickup';
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
        'message', 'Você não tem permissão para criar venda direta.'
      );
    END IF;
  END IF;

  SELECT s.*
  INTO v_store
  FROM public.stores s
  WHERE s.id = p_store_id
  LIMIT 1;

  IF v_store.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_found');
  END IF;

  SELECT COALESCE(
    p_location_id,
    v_store.public_sales_location_id,
    (
      SELECT sl.id
      FROM public.stock_locations sl
      WHERE sl.store_id = p_store_id
        AND sl.active = true
        AND sl.allow_sales = true
      ORDER BY sl.is_default DESC, sl.sort_order, sl.name
      LIMIT 1
    ),
    (
      SELECT sl.id
      FROM public.stock_locations sl
      WHERE sl.store_id = p_store_id
        AND sl.active = true
        AND sl.is_default = true
      ORDER BY sl.sort_order, sl.name
      LIMIT 1
    )
  )
  INTO v_location_id;

  IF v_location_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sales_location_not_configured');
  END IF;

  SELECT sl.*
  INTO v_location
  FROM public.stock_locations sl
  WHERE sl.id = v_location_id
    AND sl.store_id = p_store_id
    AND sl.active = true
  LIMIT 1;

  IF v_location.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_sales_location');
  END IF;

  IF COALESCE(v_location.allow_sales, false) = false
     AND COALESCE(v_location.is_default, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_allowed_for_sales');
  END IF;

  v_payment_code := COALESCE(NULLIF(trim(COALESCE(p_payment_method_code, '')), ''), 'pending');

  IF v_payment_code <> 'pending' THEN
    SELECT
      pm.code,
      pm.name,
      COALESCE(pm.requires_proof, false),
      COALESCE(pm.requires_change_for, false),
      COALESCE(pm.affects_cashbook, true)
    INTO
      v_payment_code,
      v_payment_name,
      v_payment_requires_proof,
      v_payment_requires_change_for,
      v_payment_affects_cashbook
    FROM public.store_payment_methods pm
    WHERE pm.store_id = p_store_id
      AND pm.code = v_payment_code
      AND pm.active = true
    LIMIT 1;

    IF v_payment_code IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'payment_method_disabled');
    END IF;
  END IF;

  v_payment_method_enum :=
    CASE
      WHEN v_payment_code = 'cash' THEN 'cash'::payment_method
      WHEN v_payment_code = 'pix' THEN 'pix'::payment_method
      WHEN v_payment_code IN ('debit_card', 'credit_card') THEN 'card'::payment_method
      ELSE 'pending'::payment_method
    END;

  v_customer_phone := regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g');
  v_customer_name := NULLIF(trim(COALESCE(p_customer_name, '')), '');

  IF p_customer_id IS NOT NULL THEN
    SELECT *
    INTO v_customer
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.store_id = p_store_id
      AND COALESCE(c.status, 'active') <> 'deleted_requested'
    LIMIT 1;

    IF v_customer.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'customer_not_found');
    END IF;

    v_customer_id := v_customer.id;
    v_customer_name := COALESCE(v_customer_name, v_customer.full_name);
    v_customer_phone := COALESCE(NULLIF(v_customer_phone, ''), v_customer.phone);
  ELSIF length(v_customer_phone) >= 8 THEN
    SELECT *
    INTO v_customer
    FROM public.customers c
    WHERE c.store_id = p_store_id
      AND c.phone = v_customer_phone
      AND COALESCE(c.status, 'active') <> 'deleted_requested'
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF v_customer.id IS NOT NULL THEN
      v_customer_id := v_customer.id;
      v_customer_name := COALESCE(v_customer_name, v_customer.full_name);
    ELSIF COALESCE(p_create_customer_if_missing, true) = true THEN
      IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
        IF v_user_id IS NULL
           OR NOT (
             public.app_is_store_owner(p_store_id)
             OR public.user_has_store_permission(p_store_id, 'customers.manage')
           ) THEN
          RETURN jsonb_build_object(
            'ok', false,
            'error', 'customer_manage_required',
            'message', 'Você não tem permissão para criar cliente rápido.'
          );
        END IF;
      END IF;

      INSERT INTO public.customers (
        store_id,
        full_name,
        phone,
        is_whatsapp,
        contact_preference,
        marketing_consent,
        loyalty_opt_in,
        status,
        source,
        data_ownership,
        editable_by_store,
        customer_metadata
      )
      VALUES (
        p_store_id,
        COALESCE(v_customer_name, 'Cliente balcão'),
        v_customer_phone,
        true,
        'whatsapp',
        COALESCE(p_marketing_consent, false),
        COALESCE(p_loyalty_opt_in, true),
        'active',
        'direct_sale',
        'store_managed',
        true,
        jsonb_build_object(
          'created_by', v_user_id,
          'created_by_source', 'create_admin_direct_sale_order_safe',
          'created_at', now()
        )
      )
      RETURNING id INTO v_customer_id;
    END IF;
  END IF;

  v_customer_name := COALESCE(v_customer_name, 'Cliente balcão');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0)::integer;

    IF v_product_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'missing_product_id');
    END IF;

    IF v_qty <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_quantity', 'product_id', v_product_id);
    END IF;

    SELECT
      p.id,
      p.name,
      p.description,
      p.price,
      p.images,
      p.category_id,
      COALESCE(p.active, true) AS active,
      COALESCE(p.discontinued, false) AS discontinued,
      COALESCE(p.is_discontinued, false) AS is_discontinued,
      c.name AS category_name
    INTO v_product
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = v_product_id
      AND p.store_id = p_store_id
    LIMIT 1;

    IF v_product.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'product_not_found', 'product_id', v_product_id);
    END IF;

    IF v_product.active = false OR v_product.discontinued = true OR v_product.is_discontinued = true THEN
      RETURN jsonb_build_object('ok', false, 'error', 'product_unavailable', 'product_id', v_product_id);
    END IF;

    SELECT
      COALESCE(ilb.on_hand, 0),
      COALESCE(ilb.reserved, 0),
      COALESCE(ilb.on_hand, 0) - COALESCE(ilb.reserved, 0)
    INTO v_on_hand_before, v_reserved, v_available
    FROM public.inventory_location_balances ilb
    WHERE ilb.store_id = p_store_id
      AND ilb.location_id = v_location_id
      AND ilb.product_id = v_product_id
      AND ilb.variant_id IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      IF NOT coalesce((p_metadata->>'allow_stock_exception')::boolean, false) THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'insufficient_stock',
          'message', v_product.name || ' está sem saldo disponível em ' || v_location.name || '. Confirme a divergência de estoque para continuar a venda.',
          'product_id', v_product_id,
          'product_name', v_product.name,
          'available', 0,
          'requested', v_qty
        );
      END IF;

      INSERT INTO public.inventory_location_balances (
        store_id, location_id, product_id, variant_id, on_hand, reserved, updated_at
      )
      VALUES (
        p_store_id, v_location_id, v_product_id, NULL, 0, 0, now()
      )
      ON CONFLICT DO NOTHING;

      SELECT
        COALESCE(ilb.on_hand, 0),
        COALESCE(ilb.reserved, 0),
        COALESCE(ilb.on_hand, 0) - COALESCE(ilb.reserved, 0)
      INTO v_on_hand_before, v_reserved, v_available
      FROM public.inventory_location_balances ilb
      WHERE ilb.store_id = p_store_id
        AND ilb.location_id = v_location_id
        AND ilb.product_id = v_product_id
        AND ilb.variant_id IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'stock_balance_prepare_failed',
          'message', 'Não foi possível preparar o saldo de ' || v_product.name || ' em ' || v_location.name || '. Atualize o PDV e tente novamente.',
          'product_id', v_product_id,
          'product_name', v_product.name
        );
      END IF;
    END IF;

    IF v_available < v_qty AND NOT coalesce((p_metadata->>'allow_stock_exception')::boolean, false) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'insufficient_stock',
        'message', v_product.name || ' possui apenas ' || GREATEST(v_available, 0)::text || ' unidade(s) disponível(is) em ' || v_location.name || '. Confirme a divergência de estoque para continuar a venda.',
        'product_id', v_product_id,
        'product_name', v_product.name,
        'available', v_available,
        'requested', v_qty
      );
    END IF;

    v_unit_price := COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, v_product.price, 0);
    v_discount := GREATEST(COALESCE(NULLIF(v_item->>'discount', '')::numeric, 0), 0);
    v_original_unit_price := COALESCE(NULLIF(v_item->>'original_unit_price', '')::numeric, v_product.price, v_unit_price, 0);
    v_line_gross_total := GREATEST(v_qty * v_original_unit_price, 0);
    v_line_total := GREATEST((v_qty * v_unit_price) - v_discount, 0);
    v_automatic_discount := GREATEST((v_qty * v_original_unit_price) - (v_qty * v_unit_price), 0);
    v_manual_discount := v_discount;

    v_subtotal := v_subtotal + v_line_total;
    v_gross_subtotal := v_gross_subtotal + v_line_gross_total;
    v_discount_total := v_discount_total + v_automatic_discount + v_manual_discount;
    v_items_count := v_items_count + 1;
  END LOOP;

  IF v_items_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_cart');
  END IF;

  v_total := v_subtotal;
  v_order_code := public.generate_public_order_code();

  INSERT INTO public.orders (
    store_id,
    user_id,
    customer_id,
    customer_name,
    customer_phone,
    status,
    subtotal,
    delivery_fee,
    total,
    sales_channel,
    fulfillment_type,
    delivery_method_code,
    delivery_metadata,
    payment_method,
    payment_method_code,
    payment_metadata,
    delivery_address,
    delivery_address_snapshot,
    table_code,
    notes,
    order_code,
    public_order_token,
    expires_at,
    confirmed_at,
    completed_at,
    customer_snapshot,
    commercial_metadata,
    metadata
  )
  VALUES (
    p_store_id,
    v_user_id,
    v_customer_id,
    v_customer_name,
    NULLIF(v_customer_phone, ''),
    'completed'::order_status,
    v_subtotal,
    0,
    v_total,
    v_sales_channel,
    v_fulfillment_type,
    NULL,
    jsonb_build_object(
      'fulfillment_type', v_fulfillment_type,
      'direct_sale_fulfillment', COALESCE(NULLIF(trim(COALESCE(p_fulfillment_type, '')), ''), 'in_person'),
      'location_id', v_location_id,
      'location_name', v_location.name,
      'direct_sale', true
    ),
    v_payment_method_enum,
    v_payment_code,
    jsonb_build_object(
      'code', v_payment_code,
      'name', v_payment_name,
      'requires_proof', COALESCE(v_payment_requires_proof, false),
      'requires_change_for', COALESCE(v_payment_requires_change_for, false),
      'affects_cashbook', COALESCE(v_payment_affects_cashbook, true)
    ),
    NULL,
    '{}'::jsonb,
    NULL,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_order_code,
    NULL,
    NULL,
    now(),
    now(),
    jsonb_build_object(
      'customer_id', v_customer_id,
      'name', v_customer_name,
      'phone', NULLIF(v_customer_phone, ''),
      'source', 'admin_direct_sale_rpc',
      'data_ownership', CASE WHEN v_customer_id IS NULL THEN NULL ELSE 'store_managed' END
    ),
    jsonb_build_object(
      'sales_channel', v_sales_channel,
      'fulfillment_type', v_fulfillment_type,
      'direct_sale_fulfillment', COALESCE(NULLIF(trim(COALESCE(p_fulfillment_type, '')), ''), 'in_person'),
      'location_id', v_location_id,
      'payment_method_code', v_payment_code,
      'payment_method_name', v_payment_name,
      'created_by', v_user_id,
      'created_by_source', 'create_admin_direct_sale_order_safe',
      'direct_sale', true,
      'gross_subtotal', v_gross_subtotal,
      'discount_total', v_discount_total,
      'net_subtotal', v_subtotal,
      'total_final', v_total,
      'discounts_enabled', true
    ),
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'admin_direct_sale_rpc',
      'items_count', v_items_count,
      'gross_subtotal', v_gross_subtotal,
      'discount_total', v_discount_total,
      'total_final', v_total
    )
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0)::integer;

    SELECT
      p.id,
      p.name,
      p.description,
      p.price,
      p.images,
      p.category_id,
      c.name AS category_name
    INTO v_product
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = v_product_id
      AND p.store_id = p_store_id
    LIMIT 1;

    v_unit_price := COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, v_product.price, 0);
    v_discount := GREATEST(COALESCE(NULLIF(v_item->>'discount', '')::numeric, 0), 0);
    v_original_unit_price := COALESCE(NULLIF(v_item->>'original_unit_price', '')::numeric, v_product.price, v_unit_price, 0);
    v_line_gross_total := GREATEST(v_qty * v_original_unit_price, 0);
    v_line_total := GREATEST((v_qty * v_unit_price) - v_discount, 0);
    v_automatic_discount := GREATEST((v_qty * v_original_unit_price) - (v_qty * v_unit_price), 0);
    v_manual_discount := v_discount;
    v_discount_reason := NULLIF(trim(COALESCE(v_item->>'discount_reason', '')), '');
    v_pricing_source := COALESCE(NULLIF(trim(COALESCE(v_item->>'pricing_source', '')), ''), 'product_price');
    v_price_rule := COALESCE(v_item->'price_rule', 'null'::jsonb);
    v_item_metadata := COALESCE(v_item->'metadata', '{}'::jsonb);

    SELECT
      COALESCE(ilb.on_hand, 0),
      COALESCE(ilb.reserved, 0)
    INTO v_on_hand_before, v_reserved
    FROM public.inventory_location_balances ilb
    WHERE ilb.store_id = p_store_id
      AND ilb.location_id = v_location_id
      AND ilb.product_id = v_product_id
      AND ilb.variant_id IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'stock_balance_prepare_failed',
        'message', 'O saldo local de ' || v_product.name || ' mudou durante a finalização. Atualize o PDV e tente novamente.',
        'product_id', v_product_id,
        'product_name', v_product.name
      );
    END IF;

    v_on_hand_after := GREATEST(0, v_on_hand_before - v_qty);

    UPDATE public.inventory_location_balances ilb
    SET
      on_hand = v_on_hand_after,
      updated_at = now()
    WHERE ilb.store_id = p_store_id
      AND ilb.location_id = v_location_id
      AND ilb.product_id = v_product_id;

    UPDATE public.inventory_balances ib
    SET
      on_hand = GREATEST(0, COALESCE(ib.on_hand, 0) - v_qty),
      updated_at = now()
    WHERE ib.store_id = p_store_id
      AND ib.product_id = v_product_id;

    INSERT INTO public.order_items (
      store_id,
      order_id,
      product_id,
      quantity,
      unit_price,
      discount,
      product_snapshot,
      commercial_metadata
    )
    VALUES (
      p_store_id,
      v_order_id,
      v_product_id,
      v_qty,
      v_unit_price,
      v_discount,
      jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'description', v_product.description,
        'price', v_unit_price,
        'original_price', v_original_unit_price,
        'images', COALESCE(to_jsonb(v_product.images), '[]'::jsonb),
        'category_id', v_product.category_id,
        'category_name', v_product.category_name
      ),
      jsonb_build_object(
        'gross_total', v_line_gross_total,
        'line_total', v_line_total,
        'original_unit_price', v_original_unit_price,
        'applied_unit_price', v_unit_price,
        'automatic_discount_total', v_automatic_discount,
        'manual_discount_total', v_manual_discount,
        'discount', v_discount,
        'discount_reason', v_discount_reason,
        'pricing_source', v_pricing_source,
        'price_rule', v_price_rule,
        'source', 'admin_direct_sale_rpc',
        'location_id', v_location_id
      ) || v_item_metadata
    );

    INSERT INTO public.stock_movements (
      product_id,
      order_id,
      quantity,
      type,
      reason,
      previous_stock,
      new_stock,
      store_id,
      affects_physical,
      source,
      source_id,
      reason_code,
      metadata,
      created_by,
      location_id
    )
    VALUES (
      v_product_id,
      v_order_id,
      (v_qty * -1)::integer,
      'exit',
      'Venda direta concluída pelo pedido ' || v_order_code,
      v_on_hand_before::integer,
      v_on_hand_after::integer,
      p_store_id,
      true,
      'direct_sale',
      v_order_id,
      'direct_sale_completed',
      jsonb_build_object(
        'order_code', v_order_code,
        'sales_channel', v_sales_channel,
        'fulfillment_type', v_fulfillment_type,
        'direct_sale_fulfillment', COALESCE(NULLIF(trim(COALESCE(p_fulfillment_type, '')), ''), 'in_person'),
        'location_id', v_location_id,
        'absolute_quantity', v_qty,
        'unit_price', v_unit_price,
        'original_unit_price', v_original_unit_price,
        'discount_total', v_automatic_discount + v_manual_discount,
        'line_total', v_line_total
      ),
      v_user_id,
      v_location_id
    );
  END LOOP;

  IF v_customer_id IS NOT NULL THEN
    PERFORM public.refresh_customer_commercial_summary(v_customer_id);
    v_loyalty_result := public.apply_order_loyalty_points_advanced(v_order_id);
  END IF;

  IF v_payment_code <> 'pending' AND COALESCE(v_payment_affects_cashbook, true) = true THEN
    v_cashbook_result := public.create_cashbook_entry_from_order(v_order_id);
  ELSE
    v_cashbook_result := jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', CASE
        WHEN v_payment_code = 'pending' THEN 'payment_pending'
        ELSE 'payment_method_does_not_affect_cashbook'
      END,
      'payment_method_code', v_payment_code,
      'affects_cashbook', COALESCE(v_payment_affects_cashbook, true)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_order_id,
      'order_code', v_order_code,
      'status', 'completed',
      'subtotal', v_subtotal,
      'gross_subtotal', v_gross_subtotal,
      'discount_total', v_discount_total,
      'delivery_fee', 0,
      'total', v_total,
      'sales_channel', v_sales_channel,
      'fulfillment_type', v_fulfillment_type,
      'payment_method', v_payment_method_enum::text,
      'payment_method_code', v_payment_code,
      'payment_method_name', v_payment_name,
      'customer_id', v_customer_id,
      'customer_name', v_customer_name,
      'customer_phone', NULLIF(v_customer_phone, ''),
      'location_id', v_location_id,
      'items_count', v_items_count
    ),
    'cashbook', COALESCE(v_cashbook_result, 'null'::jsonb),
    'loyalty', COALESCE(v_loyalty_result, 'null'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unexpected_error',
      'message', SQLERRM
    );
END;
$function$
;

COMMENT ON FUNCTION public.create_admin_direct_sale_order_legacy_internal(
  uuid, jsonb, uuid, text, text, text, text, uuid, text, text, boolean, boolean, boolean, jsonb
) IS 'Núcleo transacional interno da venda direta/PDV; trata saldo local ausente como zero somente na exceção confirmada e mantém bloqueio de linha para concorrência.';
