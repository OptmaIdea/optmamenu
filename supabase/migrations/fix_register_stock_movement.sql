-- ============================================
-- MIGRATION: Fix register_stock_movement function
-- Data: 2026-02-18
-- Descrição: Remove updated_at do UPDATE (coluna não existe)
-- ============================================

-- Recriar a função sem a coluna updated_at
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
