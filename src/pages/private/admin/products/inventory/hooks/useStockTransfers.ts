import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { stockService, type StockTransferSummaryRow } from '@/services/stockService';

export function useStockTransfers() {
  const { storeId, loading: loadingStore } = useCurrentStore();
  const [rows, setRows] = useState<StockTransferSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!storeId) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await stockService.getStockTransfersByStore(storeId);
      setRows(data);
    } catch (error) {
      console.error('Erro ao carregar transferências:', error);
      toast.error('Erro ao carregar transferências');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!loadingStore) {
      fetchRows();
    }
  }, [fetchRows, loadingStore]);

  return {
    storeId,
    rows,
    loading,
    refresh: fetchRows,
  };
}
