import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { stockService, type ProductStockMovementRow } from '@/services/stockService';

export function useProductStockMovements(productId?: string) {
  const { storeId } = useCurrentStore();
  const [rows, setRows] = useState<ProductStockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!storeId || !productId) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await stockService.getProductStockMovements(storeId, productId);
      setRows(data);
    } catch (error) {
      console.error('Erro ao carregar movimentações do produto:', error);
      toast.error('Erro ao carregar movimentações do produto');
    } finally {
      setLoading(false);
    }
  }, [storeId, productId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return {
    rows,
    loading,
    refresh: fetchRows,
  };
}
