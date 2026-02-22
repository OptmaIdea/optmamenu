-- Create a bucket for product images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read of product images
CREATE POLICY "Public Access Products"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- Policy to allow authenticated users to upload images to the bucket
CREATE POLICY "Authenticated Users Upload Products"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'products' );

CREATE POLICY "Authenticated Users Update Products"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'products' );

CREATE POLICY "Authenticated Users Delete Products"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'products' );
