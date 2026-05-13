-- Add store_id column to orders table
ALTER TABLE "orders" 
ADD COLUMN "store_id" uuid REFERENCES "stores"("id") ON DELETE CASCADE;

-- Add index for performance queries by store
CREATE INDEX "orders_store_id_idx" ON "orders"("store_id");

-- Update RLS policies to allow store owners to view orders for their store (if needed future-proofing)
-- For now, ensure public/users can create orders linked to a store
create policy "Public can create orders" on orders for insert with check (true);
