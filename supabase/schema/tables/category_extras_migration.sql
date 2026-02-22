-- Adiciona colunas para descrição e imagem na tabela de categorias

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN categories.description IS 'Descrição opcional da categoria para exibição no cardápio';
COMMENT ON COLUMN categories.image_url IS 'URL da imagem de capa da categoria';
