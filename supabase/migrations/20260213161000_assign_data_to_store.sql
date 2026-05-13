-- Assign existing orphaned data to the specific store provided
-- Store ID: 0abba741-0f77-4783-8cf8-58811cf7343b

-- Update Categories
UPDATE public.categories
SET store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'
WHERE store_id IS NULL;

-- Update Products
UPDATE public.products
SET store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'
WHERE store_id IS NULL;
