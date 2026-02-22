-- Drop IBGE Code if it exists (for cleanup)
ALTER TABLE stores DROP COLUMN IF EXISTS address->'ibge_code'; 
-- Note: JSONB columns are flexible, so 'dropping' a key is just an update. 
-- But if it was a real column: ALTER TABLE stores DROP COLUMN ibge_code;
-- Since address is jsonb, we just update the json to remove the key, or simply ignore it.
-- Let's create a storage bucket for logos if it doesn't exist.

INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true) 
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated uploads to 'logos'
CREATE POLICY "Ensures authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Ensures public can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Update stores table to have logo_url if not already
ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo_url TEXT;
