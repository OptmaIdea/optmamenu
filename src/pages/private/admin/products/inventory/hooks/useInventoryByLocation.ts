import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { stockService, type InventoryPositionRow } from '@/services/stockService';

export function useInventoryByLocation() {
  const { storeId, loading: loadingStore } = useCurrentStore();
  const [rows, setRows] = useState<InventoryPositionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!storeId) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await stockService.getInventoryPositionByStore(storeId);
      setRows(data);
    } catch (error) {
      console.error('Erro ao carregar estoque por local:', error);
      toast.error('Erro ao carregar estoque por local');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!loadingStore) {
      fetchRows();
    }
  }, [fetchRows, loadingStore]);

  const summary = useMemo(() => {
    const totals = rows.reduce(
      (acc, row) => {
        acc.onHand += Number(row.on_hand || 0);
        acc.reserved += Number(row.reserved || 0);
        acc.available += Number(row.available || 0);
        if (row.stock_status === 'low') acc.low += 1;
        if (row.stock_status === 'out') acc.out += 1;
        return acc;
      },
      { onHand: 0, reserved: 0, available: 0, low: 0, out: 0 }
    );

    return {
      ...totals,
      positions: rows.length,
      locations: new Set(rows.map((r) => r.location_id)).size,
    };
  }, [rows]);

  return {
    storeId,
    rows,
    loading,
    summary,
    refresh: fetchRows,
  };
}
