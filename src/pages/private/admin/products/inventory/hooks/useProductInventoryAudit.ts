import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { stockService, type ProductInventoryAuditRow } from '@/services/stockService';

export function useProductInventoryAudit(productId?: string) {
  const { storeId } = useCurrentStore();
  const [rows, setRows] = useState<ProductInventoryAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!storeId || !productId) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await stockService.getProductInventoryAuditEvents(storeId, productId);
      setRows(data);
    } catch (error) {
      console.error('Erro ao carregar auditoria do produto:', error);
      toast.error('Erro ao carregar auditoria do produto');
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
