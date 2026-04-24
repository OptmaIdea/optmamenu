import { useEffect, useState } from 'react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { stockService } from '@/services/stockService';

export function useInventoryAttentionCount() {
  const { storeId } = useCurrentStore();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!storeId) {
        setCount(0);
        return;
      }

      try {
        const rows = await stockService.getInventoryPositionByStore(storeId);
        const total = rows.filter(
          (row) => row.stock_status === 'low' || row.stock_status === 'out'
        ).length;

        if (active) setCount(total);
      } catch {
        if (active) setCount(0);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [storeId]);

  return count;
}
