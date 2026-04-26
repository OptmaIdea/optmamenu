import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useInventoryByLocation } from './hooks/useInventoryByLocation';
import { downloadCsv } from '@/utils/export/csv';
import { formatNumberPtBr } from '@/utils/export/formatters';
import EmptyState from '@/components/common/empty-state/EmptyState';
import EmptyTableState from '@/components/common/empty-state/EmptyTableState';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';
import { PackageSearch, Package, Activity } from 'lucide-react';

const statusLabelMap: Record<string, string> = {
  out: 'Sem estoque',
  low: 'Baixo',
  ok: 'OK',
  over: 'Acima do máximo',
};

const statusClassMap: Record<string, string> = {
  out: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  low: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  over: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

export default function InventoryByLocationPage() {
  const { rows, loading } = useInventoryByLocation();

  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const locations = useMemo(() => {
    const unique = new Map<string, string>();
    rows.forEach((row) => {
      unique.set(row.location_id, row.location_name);
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        !search.trim() ||
        row.product_name.toLowerCase().includes(search.toLowerCase()) ||
        row.location_name.toLowerCase().includes(search.toLowerCase());

      const matchesLocation =
        selectedLocation === 'all' || row.location_id === selectedLocation;

      const matchesStatus =
        selectedStatus === 'all' || row.stock_status === selectedStatus;

      return matchesSearch && matchesLocation && matchesStatus;
    });
  }, [rows, search, selectedLocation, selectedStatus]);

  const filteredSummary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.onHand += Number(row.on_hand || 0);
        acc.reserved += Number(row.reserved || 0);
        acc.available += Number(row.available || 0);
        if (row.stock_status === 'low') acc.low += 1;
        if (row.stock_status === 'out') acc.out += 1;
        if (row.stock_status === 'over') acc.over += 1;
        return acc;
      },
      { onHand: 0, reserved: 0, available: 0, low: 0, out: 0, over: 0 }
    );
  }, [filteredRows]);

  const filteredLocationsCount = useMemo(() => {
    return new Set(filteredRows.map((row) => row.location_id)).size;
  }, [filteredRows]);

  const hasFilters =
    search.trim() !== '' ||
    selectedLocation !== 'all' ||
    selectedStatus !== 'all';

  const clearFilters = () => {
    setSearch('');
    setSelectedLocation('all');
    setSelectedStatus('all');
  };

  const handleExportCsv = () => {
    downloadCsv({
      filename: `estoque_por_local_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Local',
        'Produto',
        'Físico',
        'Reservado',
        'Disponível',
        'Mínimo',
        'Máximo',
        'Status',
      ],
      rows: filteredRows.map((row) => [
        row.location_name,
        row.product_name,
        formatNumberPtBr(row.on_hand),
        formatNumberPtBr(row.reserved),
        formatNumberPtBr(row.available),
        formatNumberPtBr(row.min_stock),
        formatNumberPtBr(row.max_stock),
        statusLabelMap[row.stock_status] ?? row.stock_status ?? '',
      ]),
    });
  };

  const hasAnyData = rows.length > 0;
  const hasFilteredData = filteredRows.length > 0;
  const isFilteredEmpty = hasAnyData && !hasFilteredData;

  if (loading) return <LoadingSpinner />;

  if (!loading && !hasAnyData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Estoque por local
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Visão multiestoque com saldo físico, reservado e disponível por local.
            </p>
          </div>
        </div>
        <EmptyState
          icon={<PackageSearch className="h-5 w-5" />}
          title="Ainda não há posições de estoque por local"
          description="Assim que houver saldos registrados nos locais de estoque, esta visão começará a exibir as posições."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Estoque por local
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Visão multiestoque com saldo físico, reservado e disponível por local.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/products"
            className="flex items-center justify-center h-10 w-10 text-gray-400 hover:text-[#21A896] transition bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
            title="Ir para Produtos"
          >
            <Package size={20} />
          </Link>
          <Link
            to="/admin/products/lifecycle"
            className="flex items-center justify-center h-10 w-10 text-gray-400 hover:text-[#21A896] transition bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
            title="Ir para Vida do Produto"
          >
            <Activity size={20} />
          </Link>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition whitespace-nowrap shrink-0"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500">Posições</div>
          <div className="text-2xl font-bold">{filteredRows.length}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500">Locais</div>
          <div className="text-2xl font-bold">{filteredLocationsCount}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            Físico
            <InfoTooltip text="Quantidade física atualmente existente no local." />
          </div>
          <div className="text-2xl font-bold">{filteredSummary.onHand}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            Reservado
            <InfoTooltip text="Quantidade separada para pedidos ou operações, indisponível para nova venda imediata." />
          </div>
          <div className="text-2xl font-bold">{filteredSummary.reserved}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            Disponível
            <InfoTooltip text="Quantidade utilizável agora. Normalmente é o físico menos o reservado." />
          </div>
          <div className="text-2xl font-bold">{filteredSummary.available}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500">Itens críticos</div>
          <div className="text-2xl font-bold">{filteredSummary.low + filteredSummary.out}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar por produto ou local"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm outline-none"
          />

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm outline-none"
          >
            <option value="all">Todos os locais</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm outline-none"
          >
            <option value="all">Todos os status</option>
            <option value="out">Sem estoque</option>
            <option value="low">Baixo</option>
            <option value="ok">OK</option>
            <option value="over">Acima do máximo</option>
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="w-full xl:w-auto rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
            >
              Limpar filtros
            </button>
          )}
        </div>
        {hasFilters && (
          <p className="text-xs text-gray-400">
            {filteredRows.length} de {rows.length} posição{rows.length !== 1 ? 'ões' : ''} exibida{filteredRows.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Posição por local
          </h2>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="text-left px-4 py-3">Local</th>
                <th className="text-left px-4 py-3">Produto</th>
                <th className="text-left px-4 py-3">Físico</th>
                <th className="text-left px-4 py-3">Reservado</th>
                <th className="text-left px-4 py-3">Disponível</th>
                <th className="text-left px-4 py-3">Mín.</th>
                <th className="text-left px-4 py-3">Máx.</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={`${row.location_id}-${row.product_id}-${row.variant_id ?? 'base'}`}
                  className="border-t border-gray-100 dark:border-gray-700"
                >
                  <td className="px-4 py-3">{row.location_name}</td>
                  <td className="px-4 py-3 font-medium">{row.product_name}</td>
                  <td className="px-4 py-3">{row.on_hand}</td>
                  <td className="px-4 py-3">{row.reserved}</td>
                  <td className="px-4 py-3">{row.available}</td>
                  <td className="px-4 py-3">{row.min_stock ?? '—'}</td>
                  <td className="px-4 py-3">{row.max_stock ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassMap[row.stock_status] ??
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                    >
                      {statusLabelMap[row.stock_status] ?? row.stock_status}
                    </span>
                  </td>
                </tr>
              ))}

              {!hasAnyData && (
                <EmptyTableState
                  colSpan={8}
                  title="Nenhum saldo por local encontrado"
                  description="Quando houver estoque distribuído entre locais, ele aparecerá aqui."
                />
              )}
              {isFilteredEmpty && (
                <EmptyTableState
                  colSpan={8}
                  title="Nenhum resultado para os filtros aplicados"
                  description="Tente limpar os filtros ou ampliar a busca para encontrar outras posições."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
