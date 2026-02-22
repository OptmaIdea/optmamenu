-- Drop the existing view
DROP VIEW IF EXISTS public.products_with_stock;

-- Recreate the view with store_id, proper stock calculations, and RLS enforcement
CREATE OR REPLACE VIEW public.products_with_stock WITH (security_invoker = true) AS
SELECT
    p.id,
    p.store_id,
    p.category_id,
    p.name,
    p.description,
    p.price,
    p.images,
    p.image_url,
    p.stock_quantity AS physical_stock,
    p.active,
    -- Calculate reserved stock
    COALESCE(
        (
            SELECT SUM(sr.quantity)
            FROM public.stock_reservations sr
            WHERE sr.product_id = p.id
            AND sr.expires_at > NOW()
        ),
        0
    ) AS reserved_stock,
    -- Calculate available stock
    (
        p.stock_quantity - COALESCE(
            (
                SELECT SUM(sr.quantity)
                FROM public.stock_reservations sr
                WHERE sr.product_id = p.id
                AND sr.expires_at > NOW()
            ),
            0
        )
    ) AS available_stock
FROM public.products p;

-- Grant access to authenticated users
GRANT SELECT ON public.products_with_stock TO authenticated;
GRANT SELECT ON public.products_with_stock TO service_role;

-- Note on Realtime:
-- Views cannot be directly added to Supabase Realtime publication.
-- To get real-time updates, the client must subscribe to the underlying tables:
-- 'products' and 'stock_reservations'.
