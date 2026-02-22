-- Adiciona colunas para lógica de precificação na tabela de categorias

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS price_logic_type TEXT DEFAULT 'standard'; 
-- Valores esperados: 'standard', 'category_volume'

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS price_rules JSONB DEFAULT '[]'::jsonb;
-- Exemplo de estrutura JSON:
-- [
--   { "min_quantity": 0, "price": 3.00 },
--   { "min_quantity": 10, "price": 2.80 },
--   { "min_quantity": 20, "price": 2.50 }
-- ]

COMMENT ON COLUMN categories.price_logic_type IS 'Tipo de precificação: "standard" (preço do produto) ou "category_volume" (preço baseado na qtd total da categoria)';
COMMENT ON COLUMN categories.price_rules IS 'Regras de preço progressivo em formato JSON';
