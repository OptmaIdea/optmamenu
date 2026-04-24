import { useMemo } from 'react';
import { useInventoryByLocation } from './useInventoryByLocation';

export function useProductLocationInventory(productId?: string) {
  const { rows, loading, refresh } = useInventoryByLocation();

  const filteredRows = useMemo(() => {
    if (!productId) return [];
    return rows.filter((row) => row.product_id === productId);
  }, [rows, productId]);

  return {
    rows: filteredRows,
    loading,
    refresh,
  };
}
