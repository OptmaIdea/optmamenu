// src/pages/private/admin/dashboard/Alerts.tsx
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, TrendingUp, AlertCircle } from 'lucide-react';

import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { useStockAlerts } from '@/hooks/stock/useStockAlerts';
import { useAccountsPayableDueAlerts } from '@/hooks/financial/useAccountsPayableDueAlerts';

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
  const financialAlerts = useAccountsPayableDueAlerts(storeId || undefined);
  const { loading, error, summary, lists } = useStockAlerts(storeId || undefined, {
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
      subtitle={store?.name ? `Avisos financeiros e de estoque — ${store.name}` : "Acompanhe vencimentos e alertas de estoque"}
      category="Dashboard"
      icon={<AlertCircle size={28} className="text-[#19A999]" />}
      action={
        <Link
          to="/admin/inventory"
          className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-3.5 py-2 text-sm font-black text-white hover:opacity-90 transition shadow-sm"
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

      <section className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900/50 dark:bg-gray-900" aria-label="Vencimentos de contas a pagar">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-black text-gray-900 dark:text-white">Contas a pagar · vencidas e próximos 5 dias</h2>
          <p className="text-xs text-gray-500">Dias corridos até o vencimento contratual. Feriados e prorrogações dependem da configuração do calendário da unidade.</p></div>
          <Link to="/admin/accounts-payable" className="text-sm font-bold text-teal-700 hover:underline dark:text-teal-300">Ver todas as contas</Link>
        </div>
        {financialAlerts.error && <p className="mb-2 text-xs text-amber-700">Avisos indisponíveis: {financialAlerts.error}</p>}
        {financialAlerts.loading ? <p className="text-sm text-gray-500">Consultando vencimentos...</p> : financialAlerts.items.length === 0 ? <p className="text-sm text-gray-500">Nenhuma parcela vencida ou com vencimento nos próximos cinco dias.</p> : (
          <div className="space-y-2">{financialAlerts.items.map((item) => (
            <Link key={item.installment_id} to={`/admin/accounts-payable?payable=${encodeURIComponent(item.payable_id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 hover:border-teal-400 dark:border-gray-700">
              <div className="min-w-0"><p className="font-bold text-gray-900 dark:text-white">{item.description || item.payable_code} · parcela {item.installment_number}</p>
                <p className="text-xs text-gray-500">{item.payable_code} · vencimento {item.due_date.split('-').reverse().join('/')}</p></div>
              <div className="text-right"><p className={`text-sm font-black ${item.days_until_due < 0 ? 'text-red-600' : item.days_until_due === 0 ? 'text-orange-600' : 'text-amber-600'}`}>{item.days_until_due < 0 ? `${Math.abs(item.days_until_due)} dia(s) em atraso` : item.days_until_due === 0 ? 'Vence hoje' : `Vence em ${item.days_until_due} dia(s)`}</p>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{Number(item.open_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
            </Link>
          ))}</div>
        )}
      </section>

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
