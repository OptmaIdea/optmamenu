import { useEffect, useMemo, useState } from 'react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { stockService } from '@/services/stockService';

type ProductInventorySnapshot = {
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
  status: 'out' | 'low' | 'ok' | 'over';
};

export function useProductInventorySnapshot() {
  const { storeId } = useCurrentStore();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!storeId) {
        setRows([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await stockService.getInventoryPositionByStore(storeId);
        if (active) setRows(data);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [storeId]);

  const snapshotMap = useMemo(() => {
    const grouped = new Map<string, ProductInventorySnapshot>();

    for (const row of rows) {
      const current = grouped.get(row.product_id) ?? {
        productId: row.product_id,
        onHand: 0,
        reserved: 0,
        available: 0,
        status: 'ok' as const,
      };

      current.onHand += Number(row.on_hand || 0);
      current.reserved += Number(row.reserved || 0);
      current.available += Number(row.available || 0);

      grouped.set(row.product_id, current);
    }

    for (const value of grouped.values()) {
      if (value.available <= 0) value.status = 'out';
      else if (value.available <= 5) value.status = 'low';
      else value.status = 'ok';
    }

    return grouped;
  }, [rows]);

  return {
    loading,
    snapshotMap,
  };
}
