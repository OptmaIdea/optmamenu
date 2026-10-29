-- Conteúdo aplicado na migração rc_inventory_customer_delivery_by_source_location.
-- Apenas consulta por loja, sem alterar o estoque físico, reservas ou movimentos.
CREATE OR REPLACE FUNCTION public.get_inventory_delivery_in_route_by_location(p_store_id uuid)
RETURNS TABLE(product_id uuid, location_id uuid, in_delivery_qty numeric, orders_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_store_id IS NULL OR NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Acesso negado à loja informada.';
  END IF;
  RETURN QUERY
    SELECT sr.product_id, sr.location_id, SUM(sr.quantity)::numeric, COUNT(DISTINCT sr.order_id)::bigint
    FROM public.stock_reservations sr
    JOIN public.orders o ON o.id=sr.order_id AND o.store_id=sr.store_id
    WHERE o.store_id=p_store_id AND o.status::text='out_for_delivery'
      AND o.fulfillment_type='delivery' AND sr.status='consumed' AND sr.location_id IS NOT NULL
    GROUP BY sr.product_id,sr.location_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_inventory_delivery_in_route_by_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_delivery_in_route_by_location(uuid) TO authenticated;