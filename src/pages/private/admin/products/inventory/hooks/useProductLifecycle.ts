import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { stockService, type ProductLifecycleRow } from '@/services/stockService';

export function useProductLifecycle(productId?: string) {
  const { storeId } = useCurrentStore();
  const [rows, setRows] = useState<ProductLifecycleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!storeId || !productId) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await stockService.getProductInventoryLifecycle(storeId, productId);
      setRows(data);
    } catch (error) {
      console.error('Erro ao carregar vida do produto:', error);
      toast.error('Erro ao carregar vida do produto');
    } finally {
      setLoading(false);
    }
  }, [storeId, productId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return {
    row: rows[0] ?? null,
    loading,
    refresh: fetchRows,
  };
}
