import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useProductLifecycle } from './hooks/useProductLifecycle';
import { useProductStockMovements } from './hooks/useProductStockMovements';
import { useProductInventoryAudit } from './hooks/useProductInventoryAudit';
import { useProductLocationInventory } from './hooks/useProductLocationInventory';
import { downloadCsv } from '@/utils/export/csv';
import { formatCurrencyPtBr, formatDateTimePtBr, formatNumberPtBr } from '@/utils/export/formatters';
import EmptyState from '@/components/common/empty-state/EmptyState';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';
import { History, MapPinned, X } from 'lucide-react';

type LifecycleTab = 'summary' | 'locations' | 'movements' | 'audit';

const movementTypeLabel: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Saída',
  confirmation: 'Baixa (Pedido)',
  reservation: 'Reserva',
  cancellation: 'Cancelamento',
  clearance: 'Baixa',
};

const auditActionLabelMap: Record<string, string> = {
  reservation: 'Reserva',
  cancellation: 'Cancelamento',
};

const stockStatusLabelMap: Record<string, string> = {
  out: 'Sem estoque',
  low: 'Baixo',
  ok: 'OK',
  over: 'Acima do máximo',
};

const stockStatusClassMap: Record<string, string> = {
  out: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  low: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  over: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

export default function ProductLifecyclePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LifecycleTab>('summary');

  const { row, loading: loadingLifecycle } = useProductLifecycle(id);
  const { rows: movementRows, loading: loadingMovements } = useProductStockMovements(id);
  const { rows: auditRows, loading: loadingAudit } = useProductInventoryAudit(id);
  const { rows: locationRows, loading: loadingLocations } = useProductLocationInventory(id);

  const loading = loadingLifecycle || loadingMovements || loadingAudit || loadingLocations;

  const tabs = useMemo(
    () => [
      { key: 'summary' as const, label: 'Resumo' },
      { key: 'locations' as const, label: 'Estoque por local' },
      { key: 'movements' as const, label: 'Movimentações' },
      { key: 'audit' as const, label: 'Auditoria' },
    ],
    []
  );

  const handleExportSummaryCsv = () => {
    if (!row) return;

    downloadCsv({
      filename: `vida_produto_resumo_${row.product_name}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Produto',
        'Preço atual',
        'Estoque total',
        'Reservado',
        'Disponível',
        'Transferências',
        'Mínimo',
        'Máximo',
        'Última entrada',
        'Última saída',
        'Última movimentação',
        'Última transferência',
      ],
      rows: [[
        row.product_name,
        formatCurrencyPtBr(row.price ?? 0),
        formatNumberPtBr(row.total_on_hand ?? 0),
        formatNumberPtBr(row.total_reserved ?? 0),
        formatNumberPtBr(row.total_available ?? 0),
        formatNumberPtBr(row.transfer_count ?? 0),
        formatNumberPtBr(row.min_stock ?? 0),
        formatNumberPtBr(row.max_stock ?? 0),
        formatDateTimePtBr(row.last_entry_at),
        formatDateTimePtBr(row.last_exit_at),
        formatDateTimePtBr(row.last_movement_at),
        formatDateTimePtBr(row.last_transfer_at),
      ]],
    });
  };

  const handleExportLocationsCsv = () => {
    if (!row) return;

    downloadCsv({
      filename: `vida_produto_locais_${row.product_name}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Produto',
        'Local',
        'Físico',
        'Reservado',
        'Disponível',
        'Status',
      ],
      rows: locationRows.map((item) => [
        row.product_name ?? '',
        item.location_name ?? '',
        formatNumberPtBr(item.on_hand),
        formatNumberPtBr(item.reserved),
        formatNumberPtBr(item.available),
        stockStatusLabelMap[item.stock_status] ?? item.stock_status ?? '',
      ]),
    });
  };

  const handleExportMovementsCsv = () => {
    if (!row) return;

    downloadCsv({
      filename: `vida_produto_movimentacoes_${row.product_name}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Data/Hora',
        'Produto',
        'Tipo',
        'Quantidade',
        'Estoque antes',
        'Estoque depois',
        'Motivo',
      ],
      rows: movementRows.map((movement) => [
        formatDateTimePtBr(movement.created_at),
        row.product_name ?? '',
        movementTypeLabel[movement.type] ?? movement.type,
        formatNumberPtBr(movement.quantity),
        formatNumberPtBr(movement.previous_stock),
        formatNumberPtBr(movement.new_stock),
        movement.reason ?? '',
      ]),
    });
  };

  if (loading) return <LoadingSpinner />;

  if (!row) {
    return (
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Produto não encontrado</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Vida do produto
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Visão 360º do item no estoque, movimentações e auditoria.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {row.product_name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Preço atual: {row.price ? `R$ ${Number(row.price).toFixed(2)}` : '—'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/admin/products/lifecycle')}
                className="h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm transition inline-flex items-center gap-1.5"
              >
                <X size={16} className="text-gray-400" />
                <span>Fechar Visão</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/admin/stock-movements?product=${row.product_id}`)}
                className="h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm transition inline-flex items-center"
              >
                Ver movimentações
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/transfers')}
                className="h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm transition inline-flex items-center"
              >
                Ver transferências
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 p-4">
            <div className="text-sm text-gray-500 flex items-center gap-1">
              Estoque total
              <InfoTooltip text="Quantidade física total do produto somando todos os locais." />
            </div>
            <div className="text-2xl font-bold">{row.total_on_hand}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 p-4">
            <div className="text-sm text-gray-500 flex items-center gap-1">
              Reservado
              <InfoTooltip text="Quantidade comprometida com pedidos ou operações em andamento." />
            </div>
            <div className="text-2xl font-bold">{row.total_reserved}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 p-4">
            <div className="text-sm text-gray-500 flex items-center gap-1">
              Disponível
              <InfoTooltip text="Quantidade utilizável no momento, considerando o saldo físico menos reservas." />
            </div>
            <div className="text-2xl font-bold">{row.total_available}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 p-4">
            <div className="text-sm text-gray-500">Transferências</div>
            <div className="text-2xl font-bold">{row.transfer_count ?? 0}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 p-4">
            <div className="text-sm text-gray-500">Mínimo</div>
            <div className="text-2xl font-bold">{row.min_stock ?? '—'}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 p-4">
            <div className="text-sm text-gray-500">Máximo</div>
            <div className="text-2xl font-bold">{row.max_stock ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 p-2 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="w-full lg:w-auto overflow-x-auto">
          <div className="flex min-w-max gap-2 pb-1 lg:pb-0">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-[#21A896] text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pr-2">
          {activeTab === 'summary' && (
            <button
              type="button"
              onClick={handleExportSummaryCsv}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Exportar resumo
            </button>
          )}
          {activeTab === 'locations' && (
            <button
              type="button"
              onClick={handleExportLocationsCsv}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Exportar locais
            </button>
          )}
          {activeTab === 'movements' && (
            <button
              type="button"
              onClick={handleExportMovementsCsv}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Exportar movimentações
            </button>
          )}
        </div>
      </div>

      {activeTab === 'summary' && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resumo operacional</h2>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Última entrada</div>
              <div className="font-semibold">
                {row.last_entry_at ? (
                  new Date(row.last_entry_at).toLocaleString('pt-BR')
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    — <span className="text-xs font-normal">Ainda sem histórico</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Última saída</div>
              <div className="font-semibold">
                {row.last_exit_at ? (
                  new Date(row.last_exit_at).toLocaleString('pt-BR')
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    — <span className="text-xs font-normal">Ainda sem histórico</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Última movimentação</div>
              <div className="font-semibold">
                {row.last_movement_at ? (
                  new Date(row.last_movement_at).toLocaleString('pt-BR')
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    — <span className="text-xs font-normal">Ainda sem histórico</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Última transferência</div>
              <div className="font-semibold">
                {row.last_transfer_at ? (
                  new Date(row.last_transfer_at).toLocaleString('pt-BR')
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    — <span className="text-xs font-normal">Ainda sem histórico</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'locations' && locationRows.length === 0 && (
        <EmptyState
          icon={<MapPinned className="h-5 w-5" />}
          title="Sem saldo por local para este produto"
          description="Quando este item tiver posição registrada em locais de estoque, os saldos aparecerão aqui."
        />
      )}

      {activeTab === 'locations' && locationRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center">
            <h2 className="font-semibold text-gray-900 dark:text-white">Estoque por local</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="text-left px-4 py-3">Local</th>
                  <th className="text-left px-4 py-3">Físico</th>
                  <th className="text-left px-4 py-3">Reservado</th>
                  <th className="text-left px-4 py-3">Disponível</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {locationRows.map((item) => (
                  <tr key={`${item.location_id}-${item.product_id}`} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3">{item.location_name}</td>
                    <td className="px-4 py-3">{item.on_hand}</td>
                    <td className="px-4 py-3">{item.reserved}</td>
                    <td className="px-4 py-3">{item.available}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          stockStatusClassMap[item.stock_status] ??
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {stockStatusLabelMap[item.stock_status] ?? item.stock_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'movements' && movementRows.length === 0 && (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="Nenhuma movimentação encontrada para este produto"
          description="Entradas, saídas, reservas, ajustes e transferências do item aparecerão aqui."
        />
      )}

      {activeTab === 'movements' && movementRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center">
            <h2 className="font-semibold text-gray-900 dark:text-white">Movimentações físicas</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="text-left px-4 py-3">Data/Hora</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Qtd.</th>
                  <th className="text-left px-4 py-3">Antes</th>
                  <th className="text-left px-4 py-3">Depois</th>
                  <th className="text-left px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movementRows.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3">{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3">{movementTypeLabel[item.type] ?? item.type}</td>
                    <td className="px-4 py-3 font-semibold">{item.quantity}</td>
                    <td className="px-4 py-3">{item.previous_stock}</td>
                    <td className="px-4 py-3">{item.new_stock}</td>
                    <td className="px-4 py-3">{item.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center">
            <h2 className="font-semibold text-gray-900 dark:text-white">Auditoria não física</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="text-left px-4 py-3">Data/Hora</th>
                  <th className="text-left px-4 py-3">Ação</th>
                  <th className="text-left px-4 py-3">Quantidade</th>
                  <th className="text-left px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3">{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3">{auditActionLabelMap[item.action] ?? item.action}</td>
                    <td className="px-4 py-3">
                      {String((item.new_data?.quantity as number | string | undefined) ?? '—')}
                    </td>
                    <td className="px-4 py-3">
                      {String((item.new_data?.reason as string | undefined) ?? '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
