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
    const productBuySet = new Set<string>();
    const productTransferSet = new Set<string>();
    const productMonitorSet = new Set<string>();
    const productExcessSet = new Set<string>();

    const totals = rows.reduce(
      (acc, row) => {
        acc.onHand += Number(row.on_hand || 0);
        acc.reserved += Number(row.reserved || 0);
        acc.available += Number(row.available || 0);

        if (row.location_status === 'location_stockout') acc.locationStockout += 1;
        if (row.location_status === 'location_critical') acc.locationCritical += 1;
        if (row.location_status === 'location_excess') acc.locationExcess += 1;

        if (row.recommended_action === 'buy') productBuySet.add(row.product_id);
        if (row.recommended_action === 'transfer') productTransferSet.add(row.product_id);
        if (row.recommended_action === 'monitor') productMonitorSet.add(row.product_id);
        if (row.recommended_action === 'review_excess') productExcessSet.add(row.product_id);

        return acc;
      },
      {
        onHand: 0,
        reserved: 0,
        available: 0,
        locationStockout: 0,
        locationCritical: 0,
        locationExcess: 0,
      }
    );

    return {
      ...totals,
      positions: rows.length,
      locations: new Set(rows.map((r) => r.location_id)).size,
      products: new Set(rows.map((r) => r.product_id)).size,
      recommendedBuy: productBuySet.size,
      recommendedTransfer: productTransferSet.size,
      recommendedMonitor: productMonitorSet.size,
      recommendedReviewExcess: productExcessSet.size,
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
