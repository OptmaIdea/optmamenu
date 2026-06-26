-- ============================================
-- MIGRATION: Fix stock_movements id default
-- Data: 2026-02-18
-- Descrição: Corrige geração de UUID na tabela stock_movements
-- ============================================

-- Garantir que a extensão uuid-ossp está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Alterar a coluna id para ter o DEFAULT correto
ALTER TABLE stock_movements 
ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Se houver tabelas criadas sem o default, recriar a tabela
-- (opcional, apenas se o ALTER não funcionar)

-- Verificar se o DEFAULT foi aplicado
-- SELECT column_name, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'stock_movements' AND column_name = 'id';
