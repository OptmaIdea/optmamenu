-- ============================================
-- MIGRATION: Recreate stock_movements with correct id
-- Data: 2026-02-18
-- Descrição: Recria tabela stock_movements com id correto
-- ============================================

-- 1. Salvar dados existentes (se houver)
CREATE TEMP TABLE temp_stock_movements AS SELECT * FROM stock_movements;

-- 2. Dropar tabela antiga e recriar
DROP TABLE IF EXISTS stock_movements CASCADE;

-- 3. Recriar tabela com id correto
CREATE TABLE stock_movements (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    quantity integer NOT NULL,
    type stock_movement_type NOT NULL,
    reason text,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    previous_stock integer NOT NULL DEFAULT 0,
    new_stock integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT check_quantity_sign CHECK (
        (type IN ('entry', 'cancellation') AND quantity > 0) OR
        (type IN ('exit', 'confirmation', 'clearance') AND quantity < 0) OR
        (type = 'reservation' AND quantity > 0)
    )
);

-- 4. Recriar índices
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_order ON stock_movements(order_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX idx_stock_movements_product_date ON stock_movements(product_id, created_at DESC);

-- 5. Recriar trigger
DROP TRIGGER IF EXISTS trg_register_stock_movement ON stock_movements;
CREATE TRIGGER trg_register_stock_movement
    BEFORE INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION register_stock_movement();

-- 6. Habilitar RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- 7. Recriar policies
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar movimentações" ON stock_movements;
CREATE POLICY "Usuários autenticados podem visualizar movimentações"
ON stock_movements FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem inserir movimentações" ON stock_movements;
CREATE POLICY "Usuários autenticados podem inserir movimentações"
ON stock_movements FOR INSERT
TO authenticated
WITH CHECK (true);

-- 8. Grants
GRANT ALL ON stock_movements TO authenticated;
