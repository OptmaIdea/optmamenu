import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { stockService, type ProductLifecycleRow } from '@/services/stockService';
import {
  getProductTransferDivergences,
  type ProductTransferDivergence,
} from '../services/productLifecycleService';

export function useProductLifecycle(productId?: string) {
  const { storeId } = useCurrentStore();
  const [rows, setRows] = useState<ProductLifecycleRow[]>([]);
  const [transferDivergences, setTransferDivergences] = useState<ProductTransferDivergence[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!storeId || !productId) {
      setRows([]);
      setTransferDivergences([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [data, divergences] = await Promise.all([
        stockService.getProductInventoryLifecycle(storeId, productId),
        getProductTransferDivergences(productId),
      ]);
      setRows(data);
      setTransferDivergences(divergences);
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
    transferDivergences,
    loading,
    refresh: fetchRows,
  };
}
