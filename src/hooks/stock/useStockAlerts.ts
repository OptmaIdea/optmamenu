import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type StockAlertProduct = {
  id: string;
  name: string;
  stock_quantity: number;
  min_stock: number;
  max_stock: number;
};

export type StockAlertsSummary = {
  activeCount: number;
  zeroCount: number;     // stock_quantity === 0
  lowCount: number;      // 0 < stock_quantity <= min_stock
  excessCount: number;   // stock_quantity > max_stock
  criticalCount: number; // zero + low
};

export type StockAlertsLists = {
  zero: StockAlertProduct[];
  low: StockAlertProduct[];
  excess: StockAlertProduct[];
};

type UseStockAlertsOptions = {
  autoRefreshMs?: number;
  limitPerList?: number;
  defaultMinStock?: number;
  defaultMaxStock?: number;
};

type UseStockAlertsResult = {
  loading: boolean;
  error: string | null;
  refreshedAt: Date | null;
  refresh: () => Promise<void>;
  summary: StockAlertsSummary;
  lists: StockAlertsLists;
};

/**
 * Lê produtos ativos (exclui descontinuados) e calcula alertas de estoque.
 * - Crítico = zerado + abaixo do mínimo
 * - Excesso não entra em crítico
 */
export function useStockAlerts(storeId?: string, opts?: UseStockAlertsOptions): UseStockAlertsResult {
  const autoRefreshMs = opts?.autoRefreshMs ?? 5 * 60 * 1000;
  const limitPerList = opts?.limitPerList ?? 12;
  const defaultMinStock = opts?.defaultMinStock ?? 5;
  const defaultMaxStock = opts?.defaultMaxStock ?? 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const [products, setProducts] = useState<StockAlertProduct[]>([]);

  const refresh = useCallback(async () => {
    if (!storeId) {
      setProducts([]);
      setLoading(false);
      setError(null);
      setRefreshedAt(new Date());
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: qErr } = await supabase
        .from('products')
        .select('id, name, stock_quantity, min_stock, max_stock, active, discontinued, is_discontinued')
        .eq('store_id', storeId);

      if (qErr) throw qErr;

      const normalizedAll: (StockAlertProduct & { active?: boolean | null; discontinued?: boolean | null; is_discontinued?: boolean | null })[] = (data || []).map((p: any) => ({
        id: String(p.id),
        name: String(p.name ?? ''),
        stock_quantity: Number(p.stock_quantity ?? 0),
        min_stock: Number(p.min_stock ?? defaultMinStock),
        max_stock: Number(p.max_stock ?? defaultMaxStock),
        active: (p.active as boolean | null) ?? null,
        discontinued: (p.discontinued as boolean | null) ?? null,
        is_discontinued: (p.is_discontinued as boolean | null) ?? null,
      }));

      // Importante: colunas novas podem estar NULL em registros antigos.
      // Então filtramos aqui no app (em vez de `.eq(discontinued,false)`), usando coalesce.
      const normalized: StockAlertProduct[] = normalizedAll
        .filter((p) => (p.active ?? true) === true)
        .filter((p) => (p.discontinued ?? false) === false && (p.is_discontinued ?? false) === false)
        .map(({ active, discontinued, is_discontinued, ...rest }) => rest);

      setProducts(normalized);
      setRefreshedAt(new Date());
    } catch (e: any) {
      console.error('useStockAlerts error:', e);
      setError(e?.message || 'Erro ao carregar alertas de estoque.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, defaultMinStock, defaultMaxStock]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!storeId) return;
    const interval = setInterval(() => refresh(), autoRefreshMs);
    return () => clearInterval(interval);
  }, [storeId, autoRefreshMs, refresh]);

  const summary = useMemo<StockAlertsSummary>(() => {
    const activeCount = products.length;
    const zeroCount = products.filter((p) => p.stock_quantity === 0).length;
    const lowCount = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock).length;
    const excessCount = products.filter((p) => p.stock_quantity > p.max_stock).length;
    const criticalCount = zeroCount + lowCount;

    return { activeCount, zeroCount, lowCount, excessCount, criticalCount };
  }, [products]);

  const lists = useMemo<StockAlertsLists>(() => {
    const zero = products
      .filter((p) => p.stock_quantity === 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limitPerList);

    const low = products
      .filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock)
      .sort((a, b) => (a.stock_quantity - b.stock_quantity) || a.name.localeCompare(b.name))
      .slice(0, limitPerList);

    const excess = products
      .filter((p) => p.stock_quantity > p.max_stock)
      .sort((a, b) => (b.stock_quantity - a.stock_quantity) || a.name.localeCompare(b.name))
      .slice(0, limitPerList);

    return { zero, low, excess };
  }, [products, limitPerList]);

  return { loading, error, refreshedAt, refresh, summary, lists };
}
