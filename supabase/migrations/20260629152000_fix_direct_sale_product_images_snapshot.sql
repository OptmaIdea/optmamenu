-- POS_9 — Correção da venda direta — product_snapshot.images
--
-- Motivo:
-- A RPC usava `COALESCE(v_product.images, '[]'::jsonb)` ao montar o
-- `order_items.product_snapshot`, mas `products.images` no schema atual é `text[]`.
-- Isso gerava: COALESCE types text[] and jsonb cannot be matched.
--
-- Correção:
-- Recriar a função atual substituindo a montagem de imagens por conversão explícita:
-- `COALESCE(to_jsonb(v_product.images), '[]'::jsonb)`.

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_admin_direct_sale_order_safe'
    AND pg_get_function_identity_arguments(p.oid) = 'p_store_id uuid, p_items jsonb, p_customer_id uuid, p_customer_name text, p_customer_phone text, p_payment_method_code text, p_notes text, p_location_id uuid, p_sales_channel text, p_fulfillment_type text, p_create_customer_if_missing boolean, p_marketing_consent boolean, p_loyalty_opt_in boolean, p_metadata jsonb'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'create_admin_direct_sale_order_safe function not found';
  END IF;

  v_def := replace(
    v_def,
    'COALESCE(v_product.images, ''[]''::jsonb)',
    'COALESCE(to_jsonb(v_product.images), ''[]''::jsonb)'
  );

  EXECUTE v_def;
END $$;

REVOKE ALL ON FUNCTION public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) TO service_role;
