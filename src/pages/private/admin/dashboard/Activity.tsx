import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Info,
  Package,
  Search,
  ShoppingBag,
  Truck,
  X,
  XCircle,
  BarChart2,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageContainer from '@/components/common/PageContainer';
import EmptyState from '@/components/common/empty-state/EmptyState';
import { supabase } from '@/lib/supabase';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { downloadCsv } from '@/utils/export/csv';
import { formatDateTimePtBr, getLocalDateInputValue, toAppDate } from '@/utils/dateTime';
import type { OperationalTimelineEvent } from '@/pages/private/admin/products/inventory/types/operationalTimeline.types';

type EntityFilter =
  | 'all'
  | 'purchase_quotation'
  | 'purchase_document'
  | 'stock_transfer'
  | 'stock_movement'
  | 'supplier'
  | 'product';

type SeverityFilter = 'all' | 'info' | 'success' | 'warning' | 'danger' | 'critical';
type StatusFilter = 'all' | 'open' | 'done' | 'cancelled' | 'archived';
type PeriodFilter = 'today' | '7d' | '30d' | 'all' | 'custom';

const ENTITY_OPTIONS: Array<{ value: EntityFilter; label: string }> = [
  { value: 'all', label: 'Todas as entidades' },
  { value: 'purchase_quotation', label: 'Cotações' },
  { value: 'purchase_document', label: 'Compras' },
  { value: 'stock_transfer', label: 'Transferências' },
  { value: 'stock_movement', label: 'Movimentações' },
  { value: 'supplier', label: 'Fornecedores' },
  { value: 'product', label: 'Produtos' },
];

const SEVERITY_OPTIONS: Array<{ value: SeverityFilter; label: string }> = [
  { value: 'all', label: 'Todas as severidades' },
  { value: 'info', label: 'Informação' },
  { value: 'success', label: 'Sucesso' },
  { value: 'warning', label: 'Atenção' },
  { value: 'danger', label: 'Crítico' },
  { value: 'critical', label: 'Crítico severo' },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos os status' },
  { value: 'done', label: 'Concluído' },
  { value: 'open', label: 'Aberto' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'archived', label: 'Arquivado' },
];

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'all', label: 'Tudo carregado' },
  { value: 'custom', label: 'Período personalizado' },
];

function getEventIcon(event: OperationalTimelineEvent) {
  const isCancelled = event.status === 'cancelled';

  if (isCancelled && event.entity_type === 'purchase_document') {
    return (
      <div className="relative">
        <ShoppingBag className="h-4 w-4" />
        <X className="absolute -right-1 -top-1 h-2.5 w-2.5 stroke-[3] text-red-600 dark:text-red-400" />
      </div>
    );
  }

  if (isCancelled) {
    return <XCircle className="h-4 w-4" />;
  }

  switch (event.entity_type) {
    case 'purchase_quotation':
      return <FileText className="h-4 w-4" />;
    case 'purchase_document':
      return <ShoppingBag className="h-4 w-4" />;
    case 'stock_transfer':
      return <ArrowRightLeft className="h-4 w-4" />;
    case 'stock_movement':
      return <Package className="h-4 w-4" />;
    case 'supplier':
      return <Truck className="h-4 w-4" />;
    default:
      if (event.severity === 'warning') return <AlertTriangle className="h-4 w-4" />;
      if (event.severity === 'danger' || event.severity === 'critical') return <XCircle className="h-4 w-4" />;
      if (event.severity === 'success') return <CheckCircle2 className="h-4 w-4" />;
      return <Info className="h-4 w-4" />;
  }
}

function getEventToneClass(event: OperationalTimelineEvent) {
  if (event.status === 'cancelled' || event.severity === 'danger' || event.severity === 'critical') {
    return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200';
  }

  if (event.severity === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200';
  }

  if (event.severity === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200';
  }

  return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200';
}

function getEntityTypeBadgeClass(type: string) {
  switch (type) {
    case 'purchase_quotation':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'purchase_document':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'stock_transfer':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    case 'stock_movement':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
    case 'supplier':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
    case 'product':
      return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'done':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'open':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'archived':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
  }
}

function getSeverityBadgeClass(severity: string) {
  switch (severity) {
    case 'success':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'warning':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'danger':
    case 'critical':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'info':
      return 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
  }
}

function getEventLink(event: OperationalTimelineEvent) {
  if (event.related_stock_transfer_id) {
    return `/admin/transfers/${event.related_stock_transfer_id}`;
  }

  if (event.related_purchase_document_id) {
    return `/admin/stock/purchase-documents?open=${event.related_purchase_document_id}`;
  }

  if (event.related_purchase_quotation_id) {
    return `/admin/stock/quotations?open=${event.related_purchase_quotation_id}`;
  }

  if (event.related_product_id) {
    return `/admin/products/${event.related_product_id}/lifecycle`;
  }

  if (event.related_supplier_id) {
    return `/admin/suppliers/${event.related_supplier_id}/lifecycle`;
  }

  if (event.entity_type === 'stock_movement') {
    return '/admin/stock-movements';
  }

  return null;
}

function getPeriodStart(period: PeriodFilter, customFrom: string) {
  if (period === 'all') return null;

  if (period === 'custom') {
    return customFrom ? new Date(`${customFrom}T00:00:00`) : null;
  }

  const now = new Date();

  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const days = period === '7d' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function getPeriodEnd(period: PeriodFilter, customTo: string) {
  if (period !== 'custom' || !customTo) return null;
  return new Date(`${customTo}T23:59:59`);
}

function getMetadataValue(event: OperationalTimelineEvent, key: string) {
  const metadataValue = event.metadata?.[key];
  const newDataValue = event.new_data?.[key];
  const oldDataValue = event.old_data?.[key];

  const value = metadataValue ?? newDataValue ?? oldDataValue;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function buildEventSubtitle(event: OperationalTimelineEvent) {
  return [
    event.reference_label ? `Ref.: ${event.reference_label}` : null,
    event.supplier_name ? `Fornecedor: ${event.supplier_name}` : null,
    event.product_name ? `Produto: ${event.product_name}` : null,
    event.channel_label ? `Canal: ${event.channel_label}` : null,
    event.responsible_name ? `Resp.: ${event.responsible_name}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export default function Activity() {
  const { storeId, loading: loadingStore } = useCurrentStore();

  const [events, setEvents] = useState<OperationalTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('7d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!storeId) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('v_operational_timeline_events')
        .select('*')
        .eq('store_id', storeId)
        .order('occurred_at', { ascending: false })
        .limit(250);

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const start = getPeriodStart(periodFilter, dateFrom);
      const end = getPeriodEnd(periodFilter, dateTo);

      if (start) {
        query = query.gte('occurred_at', start.toISOString());
      }

      if (end) {
        query = query.lte('occurred_at', end.toISOString());
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      setEvents((data ?? []) as OperationalTimelineEvent[]);
    } catch (caughtError) {
      console.error('Erro ao carregar atividades recentes:', caughtError);
      setEvents([]);
      setError('Não foi possível carregar as atividades recentes.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, entityFilter, periodFilter, severityFilter, statusFilter, storeId]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return events;

    return events.filter((event) => {
      const haystack = [
        event.entity_type_label,
        event.event_type_label,
        event.title,
        event.description,
        event.reference_label,
        event.supplier_name,
        event.product_name,
        event.quotation_code,
        event.purchase_invoice_number,
        event.transfer_code,
        event.status_label,
        event.severity_label,
        event.channel_label,
        getMetadataValue(event, 'document_code'),
        getMetadataValue(event, 'supplier_name'),
        getMetadataValue(event, 'product_name'),
        getMetadataValue(event, 'transfer_code'),
        getMetadataValue(event, 'quotation_code'),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [events, search]);

  const stats = useMemo(() => {
    return {
      total: filteredEvents.length,
      purchases: filteredEvents.filter((event) => event.entity_type === 'purchase_document').length,
      transfers: filteredEvents.filter((event) => event.entity_type === 'stock_transfer').length,
      warnings: filteredEvents.filter((event) => ['warning', 'danger', 'critical'].includes(event.severity)).length,
    };
  }, [filteredEvents]);

  const hasFilters =
    search.trim().length > 0 ||
    entityFilter !== 'all' ||
    severityFilter !== 'all' ||
    statusFilter !== 'all' ||
    periodFilter !== '7d' ||
    dateFrom !== '' ||
    dateTo !== '';

  const clearFilters = () => {
    setSearch('');
    setEntityFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setPeriodFilter('7d');
    setDateFrom('');
    setDateTo('');
  };

  const handleExportCsv = () => {
    downloadCsv({
      filename: `atividades_operacionais_${getLocalDateInputValue()}.csv`,
      headers: [
        'Data/Hora',
        'Entidade',
        'Evento',
        'Referência',
        'Descrição',
        'Fornecedor',
        'Produto',
        'Severidade',
        'Status',
        'Canal',
        'Responsável',
      ],
      rows: filteredEvents.map((event) => [
        formatDateTimePtBr(event.occurred_at, ''),
        event.entity_type_label ?? event.entity_type,
        event.event_type_label ?? event.title,
        event.reference_label ?? '',
        event.description ?? '',
        event.supplier_name ?? '',
        event.product_name ?? '',
        event.severity_label ?? event.severity,
        event.status_label ?? event.status,
        event.channel_label ?? event.channel ?? '',
        event.responsible_name ?? event.actor_email ?? '',
      ]),
    });
  };

  if (loadingStore) return <LoadingSpinner />;

  return (
    <PageContainer
      title="Atividades recentes"
      subtitle="Acompanhe cotações, compras, transferências, movimentações e eventos de fornecedores em uma visão única."
      category="Dashboard"
      icon={<BarChart2 size={28} className="text-[#19A999]" />}
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Filter size={15} />
            {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredEvents.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#19A999] px-3 text-sm font-semibold text-white transition hover:bg-[#1b8f80] disabled:opacity-60"
          >
            <Download size={15} />
            Exportar CSV
          </button>
        </div>
      }
      flat
    >

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm text-gray-500">Eventos exibidos</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm text-gray-500">Compras</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats.purchases}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm text-gray-500">Transferências</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats.transfers}</div>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${stats.warnings > 0 ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
          <div className="text-sm text-gray-500">Alertas/Atenções</div>
          <div className={`mt-1 text-2xl font-bold ${stats.warnings > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-white'}`}>
            {stats.warnings}
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por ref., fornecedor, produto..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <select
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value as EntityFilter)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              {ENTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {periodFilter === 'custom' && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                aria-label="Data inicial"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                aria-label="Data final"
              />
            </div>
          )}

          {hasFilters && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <X size={14} />
                Limpar filtros
              </button>

              <p className="text-xs text-gray-400">
                {filteredEvents.length} de {events.length} evento(s) exibido(s)
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          <LoadingSpinner />
        </div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<Info className="h-5 w-5" />}
          title="Nenhuma atividade encontrada"
          description="Ajuste os filtros ou aguarde novos eventos operacionais de cotações, compras e transferências."
        />
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const link = getEventLink(event);
            const subtitle = buildEventSubtitle(event);
            const date = toAppDate(event.occurred_at);

            const content = (
              <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-[#19A999]/30 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${getEventToneClass(event)}`}>
                      {getEventIcon(event)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {event.event_type_label || event.title}
                        </h2>

                        {event.reference_label && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                            {event.reference_label}
                          </span>
                        )}
                      </div>

                      {event.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {event.description}
                        </p>
                      )}

                      {subtitle && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-left text-xs text-gray-500 dark:text-gray-400 md:text-right">
                    <div className="font-medium text-gray-700 dark:text-gray-200">
                      {formatDateTimePtBr(date)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 md:justify-end">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${getEntityTypeBadgeClass(event.entity_type)}`}>
                        {event.entity_type_label || event.entity_type}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${getStatusBadgeClass(event.status)}`}>
                        {event.status_label || event.status}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${getSeverityBadgeClass(event.severity)}`}>
                        {event.severity_label || event.severity}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );

            return link ? (
              <Link key={event.id} to={link} className="block">
                {content}
              </Link>
            ) : (
              <div key={event.id}>{content}</div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
