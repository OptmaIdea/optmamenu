-- Drop conflicting versions of the function to resolve "Ambiguous Function Call" error
DROP FUNCTION IF EXISTS create_order_with_reservation(uuid, text, text, numeric, payment_method, jsonb);
DROP FUNCTION IF EXISTS create_order_with_reservation(uuid, text, text, numeric, text, jsonb);
DROP FUNCTION IF EXISTS create_order_with_reservation(uuid, text, text, jsonb, text, numeric, text, jsonb);

-- Recreate the single canonical version
CREATE OR REPLACE FUNCTION create_order_with_reservation(
  p_store_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_items JSONB,
  p_payment_method TEXT,
  p_total NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_current_stock INTEGER;
  v_order_status TEXT;
  v_reservation_listing_duration INTEGER;
  v_expires_at TIMESTAMPTZ;
  v_config JSONB;
BEGIN
  -- 1. Get Store Config for Reservation Duration
  SELECT config INTO v_config
  FROM stores
  WHERE id = p_store_id;

  v_reservation_listing_duration := COALESCE((v_config->>'timer_duration_minutes')::INTEGER, 10);
  v_expires_at := NOW() + (v_reservation_listing_duration || ' minutes')::INTERVAL;

  -- 2. Determine Initial Status
  -- Always 'reserved' to avoid Enum errors
  v_order_status := 'reserved'; 

  -- 3. Create Order Header
  INSERT INTO orders (
    store_id, customer_name, customer_phone, 
    status, payment_method, total, notes, metadata
  )
  VALUES (
    p_store_id, p_customer_name, p_customer_phone, 
    v_order_status, p_payment_method, p_total, p_notes, p_metadata
  )
  RETURNING id INTO v_order_id;

  -- 4. Process Items & Update Stock/Stats
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    -- Update Product Stats (Physical Stock & Last Sale)
    UPDATE products
    SET 
        physical_stock = physical_stock - v_quantity,
        sales_count = sales_count + v_quantity,
        last_sale_at = NOW()
    WHERE id = v_product_id;

    -- Create Order Item
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (v_order_id, v_product_id, v_quantity, (v_item->>'price')::NUMERIC);

    -- Create Reservation Record (Always for confirmed/reserved flow)
    IF v_order_status = 'reserved' THEN
        INSERT INTO stock_reservations (store_id, product_id, order_id, quantity, expires_at)
        VALUES (p_store_id, v_product_id, v_order_id, v_quantity, v_expires_at);
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'order_id', v_order_id,
    'expires_at', v_expires_at
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'message', SQLERRM
  );
END;
$$;
