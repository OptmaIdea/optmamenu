import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type DeliveryInRouteSummary = Record<string, { quantity: number; orders: number }>;
export type DeliveryInRouteByLocation = Record<string, number>;

export function useInventoryDeliveryInRoute(storeId: string | null | undefined) {
  const [byProduct, setByProduct] = useState<DeliveryInRouteSummary>({});
  const [byLocation, setByLocation] = useState<DeliveryInRouteByLocation>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId) { setByProduct({}); setByLocation({}); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase.rpc('get_inventory_delivery_in_route_by_store', { p_store_id: storeId });
      if (queryError) throw queryError;
      const mapped: DeliveryInRouteSummary = {};
      for (const row of (data || []) as Array<{product_id:string; in_delivery_qty:number; orders_count:number}>) {
        mapped[row.product_id] = { quantity: Number(row.in_delivery_qty || 0), orders: Number(row.orders_count || 0) };
      }
      setByProduct(mapped);
      // A atribuição por local só é exibida quando existe reserva efetivamente consumida naquele local.
      // Valores ainda não atribuídos são preservados no consolidado, nunca inventados nos locais.
      const { data: locations, error: locationError } = await supabase.rpc('get_inventory_delivery_in_route_by_location', { p_store_id: storeId });
      if (locationError) throw locationError;
      const mappedLocations: DeliveryInRouteByLocation = {};
      for (const row of (locations || []) as Array<{product_id:string;location_id:string;in_delivery_qty:number}>) {
        mappedLocations[`${row.product_id}:${row.location_id}`] = Number(row.in_delivery_qty || 0);
      }
      setByLocation(mappedLocations);
    } catch (cause) {
      setByLocation({});
      console.error('Erro ao carregar pedidos em rota de entrega:', cause);
      setError('Não foi possível consultar os pedidos em rota. O indicador pode estar incompleto.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { byProduct, byLocation, loading, error, refresh };
}
