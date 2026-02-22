-- Drop existing policies to avoid conflicts/confusion
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Delete" ON storage.objects;

-- Re-create policies with explicit names and checks
-- 1. Public Read Access
CREATE POLICY "Category Images Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'category-images' );

-- 2. Authenticated Upload (INSERT)
CREATE POLICY "Category Images Auth Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'category-images' );

-- 3. Authenticated Update
CREATE POLICY "Category Images Auth Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'category-images' );

-- 4. Authenticated Delete
CREATE POLICY "Category Images Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'category-images' );
