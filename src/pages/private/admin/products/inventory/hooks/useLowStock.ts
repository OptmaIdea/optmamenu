import { useMemo } from 'react';
import { useStockAlerts } from '@/hooks/stock/useStockAlerts';

type UseLowStockResult = {
  loading: boolean;
  error: string | null;

  // Contagens (sempre excluindo descontinuados)
  activeCount: number;
  zeroCount: number;
  lowCount: number;
  excessCount: number;
  criticalCount: number;

  refreshedAt: Date | null;
  refresh: () => Promise<void>;
};

/**
 * Mantido por compatibilidade com o que já existe na UI.
 * Internamente delega para useStockAlerts (padrão do projeto).
 */
export function useLowStock(storeId?: string, opts?: { autoRefreshMs?: number }): UseLowStockResult {
  const { loading, error, refreshedAt, refresh, summary } = useStockAlerts(storeId, {
    autoRefreshMs: opts?.autoRefreshMs,
  });

  return useMemo(
    () => ({
      loading,
      error,
      refreshedAt,
      refresh,
      activeCount: summary.activeCount,
      zeroCount: summary.zeroCount,
      lowCount: summary.lowCount,
      excessCount: summary.excessCount,
      criticalCount: summary.criticalCount,
    }),
    [loading, error, refreshedAt, refresh, summary]
  );
}
