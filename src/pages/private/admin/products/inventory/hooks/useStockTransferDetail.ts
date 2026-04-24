import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { stockService, type StockTransferDetail } from '@/services/stockService';

const EMPTY_DETAIL: StockTransferDetail = {
  header: null,
  items: [],
};

export function useStockTransferDetail(transferId?: string) {
  const [data, setData] = useState<StockTransferDetail>(EMPTY_DETAIL);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!transferId) {
      setData(EMPTY_DETAIL);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await stockService.getStockTransferDetail(transferId);
      setData(result ?? EMPTY_DETAIL);
    } catch (error) {
      console.error('Erro ao carregar detalhe da transferência:', error);
      toast.error('Erro ao carregar detalhe da transferência');
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    data,
    loading,
    refresh: fetchDetail,
  };
}
