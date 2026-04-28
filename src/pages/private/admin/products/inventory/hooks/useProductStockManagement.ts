import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProductStockManagementRow } from '../types/productLifecycle.types';

type UseProductStockManagementResult = {
  rows: ProductStockManagementRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  globalSummary: ProductStockManagementRow | null;
  locationRows: ProductStockManagementRow[];
};

export function useProductStockManagement(
  productId: string | undefined
): UseProductStockManagementResult {
  const [rows, setRows] = useState<ProductStockManagementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStockManagement = useCallback(async () => {
    if (!productId) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc(
      'get_product_stock_management',
      { p_product_id: productId }
    );

    if (rpcError) {
      console.error('Erro ao carregar diagnóstico gerencial do produto:', rpcError);
      setError(rpcError.message ?? 'Erro ao carregar diagnóstico gerencial do produto');
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as ProductStockManagementRow[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchStockManagement();
  }, [fetchStockManagement]);

  const globalSummary = useMemo(() => rows[0] ?? null, [rows]);
  const locationRows = useMemo(() => rows, [rows]);

  return {
    rows,
    loading,
    error,
    refresh: fetchStockManagement,
    globalSummary,
    locationRows,
  };
}
