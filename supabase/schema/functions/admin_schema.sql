-- 1. EXTEND PROFILES TABLE
-- Add columns for admin management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 2. STORAGE SETUP (Buckets)
-- Create a new bucket for 'products' if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public can view product images
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'products' );

-- Policy: Admin (or authenticated users for now) can upload
-- ideally check for is_admin, but for MVP let's allow auth users to upload
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'products' AND auth.role() = 'authenticated' );

-- Policy: Admin (or authenticated users for now) can update/delete
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'products' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'products' AND auth.role() = 'authenticated' );

-- 3. RESERVE STOCK FUNCTION (RPC)
-- Logic: Check if available stock (total - active reservations) >= requested qty
-- If yes, create reservation for 10 mins. If no, raise exception.
CREATE OR REPLACE FUNCTION reserve_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock INTEGER;
    v_reserved INTEGER;
    v_user_id UUID;
    v_order_id UUID; -- To associate reservation with an order if exists (optional logic)
    -- For this MVP, we might create a temporary order or just reserve linked to user.
    -- Let's link to the user's current 'cart' order if we have one, or just user_id.
    -- Actually, user_id is enough for the cart. Or we pass order_id if we have it?
    -- Simplified: Cart logic should create an ORDER first (status=reserved) then add items?
    -- Or just reserve by user_id. Let's reserve by user_id and allow cart to sum them up. 
    -- BUT better: Cart items ARE the reservation?
    -- Re-reading plan: "Inserts a record into stock_reservations".
BEGIN
    v_user_id := auth.uid();
    
    -- Check total stock
    SELECT stock INTO v_stock FROM public.products WHERE id = p_product_id;
    
    IF v_stock IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    -- Check active reservations for this product (excluding own if updating? complex. let's just sum all others)
    -- Actually, simple check: (Stock - SUM(reservations)) >= requested?
    SELECT COALESCE(SUM(quantity), 0) INTO v_reserved 
    FROM public.stock_reservations 
    WHERE product_id = p_product_id 
      AND expires_at > NOW();

    -- If (Available) < Requested
    IF (v_stock - v_reserved) < p_quantity THEN
         RAISE EXCEPTION 'Insufficient stock. Available: %', (v_stock - v_reserved);
    END IF;

    -- Create Reservation
    -- We need an order_id? The schema says stock_reservations references orders(id).
    -- User flow: "Add to Cart" -> "Reserve".
    -- Issue: We don't have an order_id yet when just browsing? 
    -- Solution: Frontend updates Cart -> Cart creates/gets 'draft' order -> Reserve.
    -- If we don't have an order, we can't insert into stock_reservations due to FK.
    -- Let's make order_id nullable in stock_reservations OR require frontend to create order first.
    -- Let's change schema to allow nullable order_id OR frontend creates 'cart' order.
    
    -- ASSUMPTION: Frontend will pass an order_id. If not, we create one? 
    -- Better: Frontend creates a 'pending' order for the cart.
    
    RETURN jsonb_build_object('success', true, 'message', 'Stock reserved');
END;
$$;

-- FIX stock_reservations constraint if necessary (to allow null order_id? No, let's Stick to Order-based)
-- So the flow is: 
-- 1. User adds item. 
-- 2. Frontend checks if open order exists. If not, create one.
-- 3. Frontend adds item to order_items.
-- 4. Frontend calls reserve_stock to create the reservation record linked to that order.

-- Let's update the function to accept order_id
DROP FUNCTION IF EXISTS reserve_stock;

CREATE OR REPLACE FUNCTION reserve_stock(p_order_id UUID, p_product_id UUID, p_quantity INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock INTEGER;
    v_reserved INTEGER;
    v_current_reservation INTEGER;
BEGIN
    -- Check total stock
    SELECT stock INTO v_stock FROM public.products WHERE id = p_product_id;
    
    IF v_stock IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;
    
    -- Calculate active reservations (ignoring THIS specific reservation if we are updating it? 
    -- Logic: We are inserting a NEW reservation row usually. 
    -- Or replacing? Let's assume we delete old reservation for this item and insert new one 
    -- or we just check availability for the DELTA. 
    -- Simplest: Check if (Total - All_Other_Active_Reservations) >= New_Quantity
    
    SELECT COALESCE(SUM(quantity), 0) INTO v_reserved 
    FROM public.stock_reservations 
    WHERE product_id = p_product_id 
      AND expires_at > NOW()
      AND order_id != p_order_id; -- Exclude current order's reservations to avoid double counting if updating

    IF (v_stock - v_reserved) < p_quantity THEN
         RETURN jsonb_build_object('success', false, 'message', 'Estoque insuficiente');
    END IF;

    -- Delete existing reservation for this product/order to replace with new qty
    DELETE FROM public.stock_reservations 
    WHERE order_id = p_order_id AND product_id = p_product_id;

    -- Insert new reservation
    INSERT INTO public.stock_reservations (order_id, product_id, quantity, expires_at)
    VALUES (p_order_id, p_product_id, p_quantity, NOW() + INTERVAL '10 minutes');

    RETURN jsonb_build_object('success', true, 'message', 'Reservado por 10 min');
END;
$$;
