-- 1. Garante que o bucket existe e é público
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Remove TODAS as políticas antigas vinculadas a este bucket para limpar conflitos
-- (Tenta remover variações de nomes que possamos ter criado)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Delete" ON storage.objects;
DROP POLICY IF EXISTS "Category Images Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Category Images Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Category Images Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Category Images Auth Delete" ON storage.objects;

-- 3. Cria as políticas CORRETAS
-- Permitir leitura pública (Necessário para exibir a imagem no site)
CREATE POLICY "Category Images Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'category-images' );

-- Permitir upload para usuários logados
CREATE POLICY "Category Images Auth Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'category-images' );

-- Permitir atualizar (substituir) imagens para usuários logados
CREATE POLICY "Category Images Auth Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'category-images' );

-- Permitir deletar imagens para usuários logados
CREATE POLICY "Category Images Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'category-images' );
