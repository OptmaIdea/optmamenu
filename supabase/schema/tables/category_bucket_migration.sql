-- Create a bucket for category images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read of category images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'category-images' );

-- Policy to allow authenticated users to upload images to the bucket
CREATE POLICY "Authenticated Users Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'category-images' );

-- Policy to allow users to update/delete their own images (simplificado para authenticated por enquanto)
CREATE POLICY "Authenticated Users Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'category-images' );

CREATE POLICY "Authenticated Users Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'category-images' );
