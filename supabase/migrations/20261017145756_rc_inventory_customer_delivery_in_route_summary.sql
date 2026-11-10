-- Contagem operacional de itens de pedidos de clientes em rota de entrega.
-- Os itens despachados não são somados/subtraídos do estoque disponível novamente.
CREATE OR REPLACE FUNCTION public.get_inventory_delivery_in_route_by_store(p_store_id uuid)
RETURNS TABLE(product_id uuid, in_delivery_qty numeric, orders_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_store_id IS NULL OR NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Acesso negado à loja informada.';
  END IF;
  RETURN QUERY
  SELECT oi.product_id, SUM(oi.quantity)::numeric, COUNT(DISTINCT o.id)::bigint
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id=o.id AND oi.store_id=o.store_id
  WHERE o.store_id=p_store_id AND o.status::text='out_for_delivery'
    AND o.fulfillment_type='delivery' AND oi.product_id IS NOT NULL
  GROUP BY oi.product_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_inventory_delivery_in_route_by_store(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_delivery_in_route_by_store(uuid) TO authenticated;
