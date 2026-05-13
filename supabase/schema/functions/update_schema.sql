-- Adiciona colunas para Lógica de Preço Avançada e Estoque
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS use_category_pricing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS price_logic_type TEXT DEFAULT 'standard', -- 'standard' ou 'category_volume'
ADD COLUMN IF NOT EXISTS price_rules JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- Opcional: Atualizar produtos existentes para ter estoque 0 se for nulo
UPDATE products SET stock_quantity = 0 WHERE stock_quantity IS NULL;
UPDATE products SET use_category_pricing = FALSE WHERE use_category_pricing IS NULL;
