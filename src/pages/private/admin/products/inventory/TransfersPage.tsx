import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import TransferListTable from './components/TransferListTable';
import { useStockTransfers } from './hooks/useStockTransfers';
import { downloadCsv } from '@/utils/export/csv';
import { formatDateTimePtBr, formatNumberPtBr } from '@/utils/export/formatters';
import EmptyState from '@/components/common/empty-state/EmptyState';
import { ArrowRightLeft } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'pending', label: 'Pendente' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'shipped', label: 'Enviada' },
  { value: 'received', label: 'Recebida' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'divergent', label: 'Divergente' },
];

const getTransferStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'approved':
      return 'Aprovada';
    case 'shipped':
      return 'Enviada';
    case 'received':
      return 'Recebida';
    case 'cancelled':
      return 'Cancelada';
    case 'divergent':
      return 'Divergente';
    default:
      return status ?? '';
  }
};

export default function TransfersPage() {
  const { rows, loading } = useStockTransfers();

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');

  const sourceOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: 'all', label: 'Todas as origens' }];
    for (const r of rows) {
      if (!seen.has(r.source_location_id)) {
        seen.add(r.source_location_id);
        opts.push({ value: r.source_location_id, label: r.source_location_name });
      }
    }
    return opts;
  }, [rows]);

  const destinationOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: 'all', label: 'Todos os destinos' }];
    for (const r of rows) {
      if (!seen.has(r.destination_location_id)) {
        seen.add(r.destination_location_id);
        opts.push({ value: r.destination_location_id, label: r.destination_location_name });
      }
    }
    return opts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    const q = search.trim().toLowerCase();

    if (q) {
      result = result.filter(
        (r) =>
          (r.transfer_code ?? '').toLowerCase().includes(q) ||
          (r.notes ?? '').toLowerCase().includes(q) ||
          r.source_location_name.toLowerCase().includes(q) ||
          r.destination_location_name.toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      result = result.filter((r) => new Date(r.requested_at) >= new Date(`${dateFrom}T00:00:00`));
    }

    if (dateTo) {
      result = result.filter((r) => new Date(r.requested_at) <= new Date(`${dateTo}T23:59:59`));
    }

    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (sourceFilter !== 'all') {
      result = result.filter((r) => r.source_location_id === sourceFilter);
    }

    if (destinationFilter !== 'all') {
      result = result.filter((r) => r.destination_location_id === destinationFilter);
    }

    return result;
  }, [rows, search, dateFrom, dateTo, statusFilter, sourceFilter, destinationFilter]);

  const hasFilters =
    search.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    destinationFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setSourceFilter('all');
    setDestinationFilter('all');
  };

  const handleExportCsv = () => {
    downloadCsv({
      filename: `transferencias_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Código',
        'Origem',
        'Destino',
        'Status',
        'Solicitada em',
        'Enviada em',
        'Recebida em',
        'Itens',
        'Quantidade solicitada',
        'Quantidade enviada',
        'Quantidade recebida',
        'Observações',
      ],
      rows: filteredRows.map((row) => [
        row.transfer_code ?? '',
        row.source_location_name ?? '',
        row.destination_location_name ?? '',
        getTransferStatusLabel(row.status),
        formatDateTimePtBr(row.requested_at),
        formatDateTimePtBr(row.shipped_at),
        formatDateTimePtBr(row.received_at),
        formatNumberPtBr(row.items_count ?? 0),
        formatNumberPtBr(row.total_requested_qty ?? 0),
        formatNumberPtBr(row.total_shipped_qty ?? 0),
        formatNumberPtBr(row.total_received_qty ?? 0),
        row.notes ?? '',
      ]),
    });
  };

  if (loading) return <LoadingSpinner />;

  const total = rows.length;
  const divergent = rows.filter((r) => r.status === 'divergent').length;
  const shipped = rows.filter((r) => r.status === 'shipped').length;
  const received = rows.filter((r) => r.status === 'received').length;

  const hasAnyData = rows.length > 0;

  if (!loading && !hasAnyData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transferências</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestão de transferências entre locais de estoque.
            </p>
          </div>
        </div>
        <EmptyState
          icon={<ArrowRightLeft className="h-5 w-5" />}
          title="Nenhuma transferência cadastrada ainda"
          description="Quando você criar transferências entre locais, elas aparecerão aqui com status, datas e quantidades."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transferências</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gestão de transferências entre locais de estoque.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition whitespace-nowrap shrink-0"
        >
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total },
          { label: 'Enviadas', value: shipped },
          { label: 'Recebidas', value: received },
          { label: 'Divergentes', value: divergent, alert: divergent > 0 },
        ].map(({ label, value, alert }) => (
          <div key={label} className={`rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border ${alert ? 'border-amber-300 dark:border-amber-700' : 'border-gray-100 dark:border-gray-700'}`}>
            <div className="text-sm text-gray-500">{label}</div>
            <div className={`text-2xl font-bold ${alert ? 'text-amber-600 dark:text-amber-400' : ''}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por código, origem, destino ou observação"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
            aria-label="Data inicial"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
            aria-label="Data final"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
          >
            {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
          >
            {destinationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {hasFilters && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition">
              <X size={14} />
              Limpar filtros
            </button>
          )}
        </div>

        {hasFilters && (
          <p className="text-xs text-gray-400">
            {filteredRows.length} de {rows.length} transferência{rows.length !== 1 ? 's' : ''} exibida{filteredRows.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <TransferListTable rows={filteredRows} onClearFilters={hasFilters ? clearFilters : undefined} />
    </div>
  );
}
