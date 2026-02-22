-- Create types if they don't exist
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('reserved', 'confirmed', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('pix', 'cash', 'card', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ORDERS table
CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "user_id" uuid REFERENCES auth.users(id), -- Optional (guest checkout)
  "store_id" uuid REFERENCES "stores"("id") ON DELETE CASCADE,
  "customer_name" text,
  "customer_phone" text,
  "status" order_status DEFAULT 'reserved',
  "total" decimal(10,2) NOT NULL DEFAULT 0,
  "payment_method" payment_method DEFAULT 'pending',
  "proof_url" text,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "confirmed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "delivery_address" text
);

-- Create ORDER ITEMS table
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_id" uuid REFERENCES "products"("id"),
  "quantity" integer NOT NULL,
  "unit_price" decimal(10,2) NOT NULL,
  "discount" decimal(10,2) DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS "orders_store_id_idx" ON "orders"("store_id");
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");

-- Enable RLS
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;

-- Policies for ORDERS
CREATE POLICY "Public can create orders" ON "orders" FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own orders" ON "orders" FOR SELECT USING (auth.uid() = user_id);
-- Policy for Store Owners to view orders (assuming RLS on stores checks owner)
CREATE POLICY "Store Owners can view store orders" ON "orders" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM stores WHERE stores.id = orders.store_id AND stores.user_id = auth.uid()
  )
);

-- Policies for ORDER ITEMS
-- Allow anyone to insert items if they can insert the order (cascading permission logic usually handled by app, but here explicit insert)
CREATE POLICY "Public can create order items" ON "order_items" FOR INSERT WITH CHECK (true);

-- Allow viewing items if you can view the order
CREATE POLICY "View items if can view order" ON "order_items" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (
       orders.user_id = auth.uid() OR -- User owns order
       EXISTS (SELECT 1 FROM stores WHERE stores.id = orders.store_id AND stores.user_id = auth.uid()) -- Store owner owns order
    )
  )
);
