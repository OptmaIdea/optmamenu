import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  CheckCircle,
  Package,
  ShoppingCart,
  Store,
  Warehouse,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type {
  ProductLifecycleSourceLocation,
  ProductStockManagementRow,
} from '../types/productLifecycle.types';
import { formatNumberPtBr } from '@/utils/export/formatters';

type ProductStockManagementCardsProps = {
  globalSummary: ProductStockManagementRow | null;
  locationRows: ProductStockManagementRow[];
  loading?: boolean;
  error?: string | null;
};

// ─── Mapas de rótulos e estilos ───────────────────────────────────────────────

const globalStatusLabelMap: Record<string, string> = {
  product_inactive: 'Produto inativo',
  global_stockout: 'Ruptura global',
  global_critical: 'Crítico global',
  global_attention: 'Atenção global',
  global_excess: 'Excesso global',
  global_ok: 'Global OK',
};

const locationStatusLabelMap: Record<string, string> = {
  product_inactive: 'Produto inativo',
  location_inactive: 'Local inativo',
  location_stockout: 'Sem estoque no local',
  location_critical: 'Crítico no local',
  location_excess: 'Excesso no local',
  location_ok: 'OK no local',
  monitor_only: 'Monitorar',
  not_configured: 'Sem regra',
};

const actionLabelMap: Record<string, string> = {
  buy: 'Comprar',
  transfer: 'Transferir',
  monitor: 'Monitorar',
  review_excess: 'Revisar excesso',
  ok: 'OK',
};

const actionClassMap: Record<string, string> = {
  buy: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  transfer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  monitor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  review_excess: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const locationStatusClassMap: Record<string, string> = {
  location_stockout: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  location_critical: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  location_excess: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  location_ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  product_inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  location_inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGlobalIcon(status?: string) {
  if (status === 'global_stockout' || status === 'global_critical') {
    return <ShoppingCart size={18} className="text-red-500" />;
  }
  if (status === 'global_attention') {
    return <AlertTriangle size={18} className="text-amber-500" />;
  }
  if (status === 'global_excess') {
    return <Archive size={18} className="text-purple-500" />;
  }
  return <CheckCircle size={18} className="text-emerald-500" />;
}

function getLocationIcon(row: ProductStockManagementRow) {
  if (row.location_status === 'location_stockout' || row.location_status === 'location_critical') {
    return <AlertTriangle size={18} className="text-red-500" />;
  }
  if (row.is_default || row.location_code === 'MAIN') {
    return <Warehouse size={18} className="text-slate-500" />;
  }
  if (row.allow_sales) {
    return <Store size={18} className="text-blue-500" />;
  }
  return <Package size={18} className="text-slate-500" />;
}

function getBestSource(
  row: ProductStockManagementRow
): ProductLifecycleSourceLocation | undefined {
  if (!Array.isArray(row.source_locations)) return undefined;
  return row.source_locations.find((src) => src.location_id !== row.location_id);
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ProductStockManagementCards({
  globalSummary,
  locationRows,
  loading,
  error,
}: ProductStockManagementCardsProps) {
  const navigate = useNavigate();

  const handleCreateTransfer = (
    row: ProductStockManagementRow,
    source: ProductLifecycleSourceLocation
  ) => {
    const destinationNeed = Math.max(
      1,
      Number(row.provisional_location_min_stock ?? 0) - Number(row.available ?? 0)
    );

    const sourceSafeExcess = Math.max(
      0,
      Number(source.available ?? 0) - Number(row.provisional_location_min_stock ?? 0)
    );

    const suggestedQty = Math.max(
      1,
      Math.min(destinationNeed, sourceSafeExcess || destinationNeed)
    );

    const params = new URLSearchParams({
      product_id: row.product_id,
      source_location_id: source.location_id,
      destination_location_id: row.location_id,
      suggested_qty: String(suggestedQty),
    });

    navigate(`/admin/transfers?${params.toString()}`);
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div className="h-5 w-56 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-50 dark:bg-gray-700/60 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium">
          <AlertTriangle size={18} />
          Não foi possível carregar o diagnóstico gerencial de estoque.
        </div>
        <p className="mt-1 text-sm text-red-600 dark:text-red-300/80">{error}</p>
      </section>
    );
  }

  if (!globalSummary) {
    return (
      <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <Package size={18} />
          Nenhum diagnóstico de estoque encontrado para este produto.
        </div>
      </section>
    );
  }

  const globalAction = globalSummary.recommended_action ?? 'ok';

  return (
    <section className="space-y-4">
      {/* ── Card consolidado global ── */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {getGlobalIcon(globalSummary.global_status)}
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Diagnóstico gerencial do estoque
              </h2>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Visão consolidada do produto e distribuição entre os locais.
            </p>
          </div>

          <span
            className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
              actionClassMap[globalAction] ??
              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {actionLabelMap[globalAction] ?? globalAction}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {[
            { label: 'Físico global', value: formatNumberPtBr(globalSummary.global_on_hand ?? 0) },
            { label: 'Reservado', value: formatNumberPtBr(globalSummary.global_reserved ?? 0) },
            { label: 'Disponível', value: formatNumberPtBr(globalSummary.global_available ?? 0) },
            {
              label: 'Mín./Máx.',
              value: `${formatNumberPtBr(globalSummary.global_min_stock ?? 0)} / ${formatNumberPtBr(globalSummary.global_max_stock ?? 0)}`,
            },
            {
              label: 'Status global',
              value: globalStatusLabelMap[globalSummary.global_status] ?? globalSummary.global_status,
              small: true,
            },
            { label: 'Origens possíveis', value: String(globalSummary.possible_source_locations ?? 0) },
          ].map(({ label, value, small }) => (
            <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`mt-1 font-bold ${small ? 'text-sm' : 'text-lg'}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cards por local ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {locationRows.map((row) => {
          const bestSource = getBestSource(row);
          const action = row.recommended_action ?? 'ok';

          return (
            <article
              key={`${row.location_id}-${row.product_id}`}
              className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
            >
              {/* Cabeçalho do card de local */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-2">
                    {getLocationIcon(row)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {row.location_name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {row.location_code}
                      {row.is_default ? ' · principal' : ''}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    locationStatusClassMap[row.location_status] ??
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {locationStatusLabelMap[row.location_status] ?? row.location_status}
                </span>
              </div>

              {/* Mini grid de saldos */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'Físico', value: row.on_hand ?? 0 },
                  { label: 'Reservado', value: row.reserved ?? 0 },
                  { label: 'Disponível', value: row.available ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-2">
                    <p className="text-[11px] text-gray-500">{label}</p>
                    <p className="mt-1 text-sm font-bold">{formatNumberPtBr(value)}</p>
                  </div>
                ))}
              </div>

              {/* Badge de ação + mínimo local */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    actionClassMap[action] ??
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {actionLabelMap[action] ?? action}
                </span>
                <span className="text-[11px] text-gray-500">
                  Mín. local: {formatNumberPtBr(row.provisional_location_min_stock ?? 0)}
                </span>
              </div>

              {/* Origem sugerida para transferência */}
              {action === 'transfer' && bestSource && (
                <div className="mt-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <ArrowRightLeft size={14} />
                    Origem sugerida
                  </div>
                  <p className="mt-1 text-sm font-medium text-blue-800 dark:text-blue-200">
                    {bestSource.location_name}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300/80">
                    Disponível: {formatNumberPtBr(bestSource.available ?? 0)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCreateTransfer(row, bestSource)}
                    className="mt-2 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Criar transferência
                  </button>
                </div>
              )}

              {/* Alerta de compra */}
              {action === 'buy' && (
                <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
                    <ShoppingCart size={14} />
                    Reposição recomendada
                  </div>
                  <p className="mt-1 text-xs text-red-600 dark:text-red-300/80">
                    O estoque global está zerado ou abaixo do mínimo.
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
