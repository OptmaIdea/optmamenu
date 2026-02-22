-- ============================================
-- MIGRATION: Stock Movements History
-- Data: 2026-02-18
-- Descrição: Cria tabela de histórico de movimentações de estoque
-- ============================================

-- 1. Criar tipo ENUM para tipos de movimentação (caso não exista)
DO $$ BEGIN
    CREATE TYPE stock_movement_type AS ENUM (
        'entry',           -- Entrada manual (onEntry)
        'exit',            -- Saída/perda manual (onExit)
        'reservation',     -- Reserva por pedido
        'confirmation',    -- Baixa por confirmação de pedido
        'cancellation',    -- Cancelamento de pedido (devolve estoque)
        'clearance'        -- Zeramento por descontinuação
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. A coluna discontinued já existe na tabela products
-- Apenas criar índice se não existir
CREATE INDEX IF NOT EXISTS idx_products_discontinued ON products(discontinued);

-- 3. Criar tabela stock_movements (caso não exista)
CREATE TABLE IF NOT EXISTS stock_movements (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL, -- NULL se não for movimento de pedido
    quantity integer NOT NULL, -- Positivo para entrada, negativo para saída
    type stock_movement_type NOT NULL,
    reason text, -- Motivo da movimentação
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3b. Adicionar colunas faltantes (caso a tabela já exista)
ALTER TABLE stock_movements 
ADD COLUMN IF NOT EXISTS previous_stock integer DEFAULT 0;

ALTER TABLE stock_movements 
ADD COLUMN IF NOT EXISTS new_stock integer DEFAULT 0;

-- 3c. Adicionar restrição de sinal (caso não exista)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_quantity_sign' 
        AND table_name = 'stock_movements'
    ) THEN
        ALTER TABLE stock_movements 
        ADD CONSTRAINT check_quantity_sign CHECK (
            (type IN ('entry', 'cancellation') AND quantity > 0) OR
            (type IN ('exit', 'confirmation', 'clearance') AND quantity < 0) OR
            (type = 'reservation' AND quantity > 0)
        );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order ON stock_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_date ON stock_movements(product_id, created_at DESC);

-- 4. Criar função para registrar movimentação e atualizar estoque automaticamente
CREATE OR REPLACE FUNCTION register_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    current_stock integer;
BEGIN
    -- Obter estoque atual do produto
    SELECT stock_quantity INTO current_stock
    FROM products
    WHERE id = NEW.product_id;
    
    -- Se não encontrou produto, abortar
    IF current_stock IS NULL THEN
        RAISE EXCEPTION 'Produto não encontrado: %', NEW.product_id;
    END IF;
    
    -- Definir previous_stock
    NEW.previous_stock := current_stock;
    
    -- Calcular e definir new_stock baseado no tipo de movimentação
    IF NEW.type IN ('entry', 'cancellation') THEN
        -- Entrada: adiciona ao estoque
        NEW.new_stock := current_stock + NEW.quantity;
        
        -- Atualizar estoque do produto
        UPDATE products
        SET stock_quantity = NEW.new_stock
        WHERE id = NEW.product_id;
        
    ELSIF NEW.type IN ('exit', 'confirmation', 'clearance') THEN
        -- Saída: subtrai do estoque (quantity já é negativo)
        NEW.new_stock := current_stock + NEW.quantity;
        
        -- Verificar se há estoque suficiente
        IF NEW.new_stock < 0 THEN
            RAISE EXCEPTION 'Estoque insuficiente para produto %. Estoque atual: %, necessário: %', 
                NEW.product_id, current_stock, ABS(NEW.quantity);
        END IF;
        
        -- Atualizar estoque do produto
        UPDATE products
        SET stock_quantity = NEW.new_stock
        WHERE id = NEW.product_id;
        
    ELSIF NEW.type = 'reservation' THEN
        -- Reserva: não altera estoque físico, apenas registra
        NEW.new_stock := current_stock;
        -- Para reservas, quantity é positivo mas representa quantidade reservada
    END IF;
    
    -- Se user_id não foi definido, tentar pegar do contexto
    IF NEW.user_id IS NULL THEN
        BEGIN
            NEW.user_id := auth.uid();
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar trigger para registrar movimentação automaticamente
DROP TRIGGER IF EXISTS trg_register_stock_movement ON stock_movements;
CREATE TRIGGER trg_register_stock_movement
    BEFORE INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION register_stock_movement();

-- 6. Habilitar RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- 7. Criar Policies para stock_movements (apenas se não existirem)

-- Policy: Usuários autenticados podem visualizar movimentações
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'stock_movements' AND policyname = 'Usuários autenticados podem visualizar movimentações'
    ) THEN
        CREATE POLICY "Usuários autenticados podem visualizar movimentações"
        ON stock_movements FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

-- Policy: Apenas usuários autenticados podem inserir movimentações
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'stock_movements' AND policyname = 'Usuários autenticados podem inserir movimentações'
    ) THEN
        CREATE POLICY "Usuários autenticados podem inserir movimentações"
        ON stock_movements FOR INSERT
        TO authenticated
        WITH CHECK (true);
    END IF;
END $$;

-- 8. Criar função para verificar se produto tem movimentações
CREATE OR REPLACE FUNCTION product_has_movements(p_product_id uuid)
RETURNS boolean AS $$
DECLARE
    has_mov boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM stock_movements WHERE product_id = p_product_id
    ) INTO has_mov;
    RETURN has_mov;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Criar view para produtos com informações de movimentação
CREATE OR REPLACE VIEW products_with_movement_info AS
SELECT 
    p.*,
    EXISTS (SELECT 1 FROM stock_movements sm WHERE sm.product_id = p.id) AS has_movements,
    (SELECT MAX(created_at) FROM stock_movements WHERE product_id = p.id) AS last_movement_date
FROM products p;

-- 10. Comentar tabelas e colunas para documentação
COMMENT ON TABLE stock_movements IS 'Histórico completo de todas as movimentações de estoque';
COMMENT ON COLUMN stock_movements.product_id IS 'Produto relacionado à movimentação';
COMMENT ON COLUMN stock_movements.order_id IS 'Pedido relacionado (NULL se for ajuste manual)';
COMMENT ON COLUMN stock_movements.quantity IS 'Quantidade movimentada (positivo para entrada, negativo para saída)';
COMMENT ON COLUMN stock_movements.type IS 'Tipo de movimentação: entry, exit, reservation, confirmation, cancellation, clearance';
COMMENT ON COLUMN stock_movements.reason IS 'Motivo/descrição da movimentação';
COMMENT ON COLUMN stock_movements.previous_stock IS 'Quantidade em estoque antes da movimentação';
COMMENT ON COLUMN stock_movements.new_stock IS 'Quantidade em estoque após a movimentação';
COMMENT ON COLUMN products.discontinued IS 'Indica se o produto foi descontinuado (não pode ser reativado)';

-- 11. Grant de permissões (caso necessário)
GRANT ALL ON stock_movements TO authenticated;
GRANT EXECUTE ON FUNCTION register_stock_movement() TO authenticated;
GRANT EXECUTE ON FUNCTION product_has_movements(uuid) TO authenticated;
GRANT SELECT ON products_with_movement_info TO authenticated;

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================
