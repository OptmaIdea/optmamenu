import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type DeliveryInRouteSummary = Record<string, { quantity: number; orders: number }>;

export function useInventoryDeliveryInRoute(storeId: string | null | undefined) {
  const [byProduct, setByProduct] = useState<DeliveryInRouteSummary>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId) { setByProduct({}); setError(null); return; }
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
    } catch (cause) {
      console.error('Erro ao carregar pedidos em rota de entrega:', cause);
      setError('Não foi possível consultar os pedidos em rota. O indicador pode estar incompleto.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { byProduct, loading, error, refresh };
}
