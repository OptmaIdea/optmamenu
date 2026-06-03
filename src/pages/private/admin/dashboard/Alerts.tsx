// src/pages/private/admin/dashboard/Alerts.tsx
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, TrendingUp, AlertCircle } from 'lucide-react';

import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { useStockAlerts } from '@/hooks/stock/useStockAlerts';

function StockList({
  title,
  items,
  tone = 'neutral',
}: {
  title: string;
  items: { id: string; name: string; stock_quantity: number; min_stock: number; max_stock: number }[];
  tone?: 'critical' | 'warning' | 'info' | 'neutral';
}) {
  const toneClass =
    tone === 'critical'
      ? 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-900/10'
      : tone === 'warning'
        ? 'border-yellow-200 bg-yellow-50/40 dark:border-yellow-900/40 dark:bg-yellow-900/10'
        : tone === 'info'
          ? 'border-purple-200 bg-purple-50/40 dark:border-purple-900/40 dark:bg-purple-900/10'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-candara text-base font-black">{title}</h3>
        <span className="text-xs opacity-70">{items.length} itens</span>
      </div>

      {items.length === 0 ? (
        <div className="text-sm opacity-70">Nada por aqui 🎉</div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span className="text-sm font-candara truncate pr-2">{p.name}</span>
              <span className="text-xs font-black opacity-80 shrink-0">
                {p.stock_quantity} <span className="opacity-60">/ min {p.min_stock} / max {p.max_stock}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Alerts() {
  const { store, storeId, loading: storeLoading } = useCurrentStore();
  const { loading, error, refreshedAt, refresh, summary, lists } = useStockAlerts(storeId || undefined, {
    autoRefreshMs: 5 * 60 * 1000,
    limitPerList: 12,
  });

  const title = useMemo(() => {
    if (store?.name) return `Alertas — ${store.name}`;
    return 'Alertas';
  }, [store?.name]);

  const isLoading = storeLoading || loading;

  return (
    <PageContainer
      title={title}
      subtitle={store?.name ? `Alertas de estoque para a loja ${store.name}` : "Acompanhe alertas de estoque crítico, baixo e excessos"}
      category="Dashboard"
      icon={<AlertCircle size={28} className="text-[#21A896]" />}
      lastUpdated={refreshedAt ?? undefined}
      onRefresh={refresh}
      action={
        <Link
          to="/admin/inventory"
          className="inline-flex items-center gap-2 rounded-xl bg-[#21A896] px-3.5 py-2 text-sm font-black text-white hover:opacity-90 transition shadow-sm"
        >
          <Package size={16} />
          Ver estoque
        </Link>
      }
      flat
    >

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Cards (sem badges) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Crítico"
          value={isLoading ? '—' : summary.criticalCount}
          icon={<AlertTriangle size={20} />}
        />
        <StatsCard
          title="Sem estoque"
          value={isLoading ? '—' : summary.zeroCount}
          icon={<Package size={20} />}
        />
        <StatsCard
          title="Estoque baixo"
          value={isLoading ? '—' : summary.lowCount}
          icon={<AlertTriangle size={20} />}
        />
        <StatsCard
          title="Excesso"
          value={isLoading ? '—' : summary.excessCount}
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StockList title="Sem estoque (zerado)" items={lists.zero} tone="critical" />
        <StockList title="Estoque baixo" items={lists.low} tone="warning" />
        <StockList title="Excesso de estoque" items={lists.excess} tone="info" />
      </div>

      {/* Ajuda rápida */}
      <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="text-sm opacity-80">
          <span className="font-black">Crítico</span> = sem estoque + abaixo do mínimo. Excesso é alerta de otimização (capital parado),
          então não entra em crítico.
        </div>
      </div>
    </PageContainer>
  );
}
