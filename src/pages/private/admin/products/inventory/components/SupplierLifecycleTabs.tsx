import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  Handshake,
  Mail,
  Package,
  Phone,
  ReceiptText,
  Send,
  ShieldAlert,
  ShoppingCart,
  Tags,
  TrendingUp,
  Ban,
  FileText,
  MessageCircle,
  MessageSquare,
  Star,
  UserRound,
  XCircle,
  Archive,
  Activity,
  CircleDot,
  FileCheck2,
  RefreshCcw,
  Search,
} from 'lucide-react';

import {
  formatCurrencyPtBr,
  formatNumberPtBr,
} from '@/utils/export/formatters';

import { formatDatePtBr as formatDateValuePtBr } from '@/utils/dateTime';

import type {
  SupplierContactRow,
  SupplierPriceEvolutionRow,
  SupplierQuotationHistoryRow,
  SupplierPurchaseHistoryRow,
  SupplierRelationshipTimelineRow,
  SupplierSuppliedProductRow,
  SupplierUnifiedTimelineRow,
} from '../types/supplierLifecycle.types';

type SupplierLifecycleTabsProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  purchases: SupplierPurchaseHistoryRow[];
  products: SupplierSuppliedProductRow[];
  prices: SupplierPriceEvolutionRow[];
  quotations: SupplierQuotationHistoryRow[];
  timeline: SupplierRelationshipTimelineRow[];
  contacts: SupplierContactRow[];
  unifiedTimeline: SupplierUnifiedTimelineRow[];
};

const tabs = [
  { id: 'purchases', label: 'Compras', icon: ReceiptText },
  { id: 'quotations', label: 'Cotações', icon: ClipboardList },
  { id: 'products', label: 'Produtos', icon: Package },
  { id: 'prices', label: 'Preços', icon: TrendingUp },
  { id: 'contacts', label: 'Contatos', icon: Phone },
  { id: 'relationship', label: 'Relacionamento', icon: Clock },
  { id: 'timeline', label: 'Linha do tempo', icon: Activity },
];

const statusLabelMap: Record<string, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

const statusClassMap: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const eventTypeLabelMap: Record<string, string> = {
  block: 'Bloqueio', unblock: 'Desbloqueio',
  approval: 'Aprovação', approve: 'Aprovação',
  rejection: 'Rejeição', reject: 'Rejeição',
  contact: 'Contato', purchase: 'Compra',
  incident: 'Ocorrência', note: 'Nota',
  call: 'Ligação', email: 'E-mail',
  meeting: 'Reunião', negotiation: 'Negociação',
  complaint: 'Reclamação', follow_up: 'Follow-up',
  homologation: 'Homologação', document: 'Documento',
  other: 'Outro',
};

const unifiedEventTypeLabelMap: Record<string, string> = {
  quotation_created: 'Cotação criada',
  quotation_channel_defined: 'Canal da cotação definido',
  quotation_channel_changed: 'Canal da cotação alterado',
  quotation_responsible_changed: 'Responsável pela cotação alterado',
  quotation_approved: 'Cotação aprovada',
  quotation_converted_to_purchase_document: 'Cotação convertida em compra',
  quotation_rejected: 'Cotação rejeitada',
  quotation_linked_purchase_cancelled: 'Compra vinculada cancelada',
  purchase_document_created: 'Compra criada',
  purchase_document_confirmed: 'Compra confirmada',
  purchase_document_applied_to_inventory: 'Compra aplicada ao estoque',
  purchase_document_cancelled: 'Compra cancelada',
  purchase_document_draft_deleted: 'Rascunho de compra excluído',
  stock_transfer_created: 'Transferência criada',
  stock_transfer_shipped: 'Transferência enviada',
  stock_transfer_received: 'Transferência recebida',
};

const severityLabelMap: Record<string, string> = {
  info: 'Informativo',
  success: 'Sucesso',
  warning: 'Alerta',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
  error: 'Erro',
  danger: 'Erro',
};

const eventStatusLabelMap: Record<string, string> = {
  open: 'Aberto', done: 'Concluído', closed: 'Concluído',
  pending: 'Pendente', archived: 'Arquivado', cancelled: 'Cancelado',
};

const quotationStatusLabelMap: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  answered: 'Respondida',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  converted: 'Convertida',
  cancelled: 'Cancelada',
};

const quotationChannelLabelMap: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  pdf: 'PDF',
  manual: 'Manual',
  other: 'Outro',
};

function getQuotationStatusClass(status?: string | null) {
  switch (status) {
    case 'converted':
    case 'approved':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'sent':
    case 'answered':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'draft':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    case 'rejected':
    case 'cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getConvertedPurchaseLabel(row: SupplierQuotationHistoryRow) {
  return (
    row.converted_document_code ||
    row.converted_invoice_number ||
    row.converted_purchase_document_id?.slice(0, 8) ||
    '—'
  );
}



function formatDateDisplayPtBr(date?: string | null) {
  if (!date) return '—';

  const value = String(date).trim();
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}/${month}/${year}`;
  }

  return formatDateValuePtBr(value);
}

function getDateForDiff(date?: string | null) {
  if (!date) return null;

  const value = String(date).trim();
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDaysSince(date?: string | null) {
  const parsed = getDateForDiff(date);

  if (!parsed) return null;

  const now = new Date();
  const diff = now.getTime() - parsed.getTime();

  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}


function getProductPurchaseRecencyLabel(date?: string | null) {
  const days = getDaysSince(date);

  if (days == null) return 'sem histórico';

  if (days === 0) return 'comprado hoje';

  if (days === 1) return 'há 1 dia';

  return `há ${days} dias`;
}

function getCostVariationPercentage(minCost?: number | null, maxCost?: number | null) {
  const min = Number(minCost ?? 0);
  const max = Number(maxCost ?? 0);

  if (!min || !max || min <= 0 || max <= min) {
    return null;
  }

  return ((max - min) / min) * 100;
}

function getPriceStatusLabel(row: SupplierPriceEvolutionRow) {
  if (row.is_active === false) {
    return 'Inativo';
  }

  if (row.cancelled_at) {
    return 'Cancelado';
  }

  return 'Ativo';
}

function getPriceStatusClass(row: SupplierPriceEvolutionRow) {
  if (row.is_active === false || row.cancelled_at) {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  }

  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
}

function getPriceSourceLabel(source?: string | null) {
  switch (source) {
    case 'purchase_document':
      return 'Documento de compra';
    case 'manual':
      return 'Manual';
    case 'quotation':
      return 'Cotação';
    case 'import':
      return 'Importação';
    default:
      return source || 'Não informado';
  }
}

function getContactDepartmentLabel(department?: string | null) {
  switch (department) {
    case 'commercial':
      return 'Comercial';
    case 'financial':
      return 'Financeiro';
    case 'fiscal':
      return 'Fiscal';
    case 'logistics':
      return 'Logística';
    case 'support':
      return 'Suporte';
    case 'other':
      return 'Outro';
    default:
      return 'Não informado';
  }
}

function getContactDepartmentClass(department?: string | null) {
  switch (department) {
    case 'commercial':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'financial':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'fiscal':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'logistics':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'support':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function onlyDigits(value?: string | null) {
  return String(value ?? '').replace(/\D/g, '');
}

function buildWhatsAppUrl(value?: string | null) {
  const digits = onlyDigits(value);

  if (!digits) return null;

  const normalized = digits.startsWith('55') ? digits : `55${digits}`;

  return `https://wa.me/${normalized}`;
}

function buildPhoneUrl(value?: string | null) {
  const digits = onlyDigits(value);

  if (!digits) return null;

  return `tel:${digits}`;
}

function buildMailUrl(value?: string | null) {
  if (!value) return null;

  return `mailto:${value}`;
}

function formatDateTimeDisplayPtBr(value?: string | null) {
  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function getRelationshipEventTypeLabel(eventType?: string | null) {
  if (!eventType) return 'Evento';

  return eventTypeLabelMap[eventType] ?? eventType;
}

function getRelationshipEventIcon(eventType?: string | null) {
  switch (eventType) {
    case 'call':
      return Phone;
    case 'email':
      return Mail;
    case 'meeting':
      return Handshake;
    case 'incident':
      return AlertTriangle;
    case 'purchase':
      return ShoppingCart;
    case 'approval':
    case 'approve':
      return ClipboardCheck;
    case 'rejection':
    case 'reject':
      return XCircle;
    case 'block':
      return Ban;
    case 'unblock':
      return CheckCircle2;
    case 'status_change':
    case 'homologation':
      return ShieldAlert;
    case 'note':
    default:
      return MessageSquare;
  }
}

function getRelationshipSeverityClass(severity?: string | null) {
  switch (severity) {
    case 'success':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';

    case 'warning':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';

    case 'error':
    case 'danger':
    case 'critical':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';

    case 'high':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';

    case 'medium':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';

    case 'low':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

    case 'info':
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getRelationshipStatusClass(status?: string | null) {
  switch (status) {
    case 'open':
    case 'pending':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'done':
    case 'closed':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'archived':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getRelationshipStatusIcon(status?: string | null) {
  switch (status) {
    case 'open':
    case 'pending':
      return Clock;
    case 'done':
    case 'closed':
      return CheckCircle2;
    case 'cancelled':
      return XCircle;
    case 'archived':
      return Archive;
    default:
      return Clock;
  }
}

function getRelationshipEventIconClass(eventType?: string | null) {
  switch (eventType) {
    case 'call':
    case 'email':
    case 'meeting':
    case 'contact':
    case 'follow_up':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300';
    case 'approval':
    case 'approve':
    case 'unblock':
    case 'homologation':
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'rejection':
    case 'reject':
    case 'block':
    case 'incident':
    case 'complaint':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300';
    case 'purchase':
    case 'negotiation':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function getUnifiedTimelineIcon(eventType?: string | null, sourceKind?: string | null) {
  if (sourceKind === 'relationship') {
    return MessageSquare;
  }

  switch (eventType) {
    case 'quotation_created':
    case 'quotation_channel_defined':
    case 'quotation_channel_changed':
    case 'quotation_responsible_changed':
      return ClipboardList;

    case 'quotation_approved':
    case 'quotation_converted_to_purchase_document':
      return ClipboardCheck;

    case 'quotation_rejected':
    case 'quotation_linked_purchase_cancelled':
      return XCircle;

    case 'purchase_document_created':
      return FileText;

    case 'purchase_document_confirmed':
    case 'purchase_document_applied_to_inventory':
      return FileCheck2;

    case 'purchase_document_cancelled':
    case 'purchase_document_draft_deleted':
      return Ban;

    case 'stock_transfer_created':
    case 'stock_transfer_shipped':
    case 'stock_transfer_received':
      return RefreshCcw;

    default:
      return CircleDot;
  }
}

function getUnifiedTimelineIconClass(eventType?: string | null, sourceKind?: string | null) {
  if (sourceKind === 'relationship') {
    return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300';
  }

  switch (eventType) {
    case 'quotation_created':
    case 'quotation_channel_defined':
    case 'quotation_channel_changed':
    case 'quotation_responsible_changed':
    case 'purchase_document_created':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';

    case 'quotation_approved':
    case 'quotation_converted_to_purchase_document':
    case 'purchase_document_confirmed':
    case 'purchase_document_applied_to_inventory':
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300';

    case 'quotation_rejected':
    case 'quotation_linked_purchase_cancelled':
    case 'purchase_document_cancelled':
    case 'purchase_document_draft_deleted':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300';

    case 'stock_transfer_created':
    case 'stock_transfer_shipped':
    case 'stock_transfer_received':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300';

    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  }
}

function getUnifiedTimelineProcessStatusLabel(event: SupplierUnifiedTimelineRow) {
  switch (event.event_type) {
    case 'purchase_document_created':
      return 'Criada';

    case 'purchase_document_confirmed':
      return 'Confirmada';

    case 'purchase_document_applied_to_inventory':
      return 'Aplicada ao estoque';

    case 'purchase_document_cancelled':
      return 'Cancelada';

    case 'purchase_document_draft_deleted':
      return 'Rascunho excluído';

    case 'purchase_document_created_from_quotation':
      return 'Criada pela cotação';

    case 'quotation_created':
      return 'Criada';

    case 'quotation_channel_defined':
      return 'Canal definido';

    case 'quotation_channel_changed':
      return 'Canal alterado';

    case 'quotation_responsible_changed':
      return 'Responsável alterado';

    case 'quotation_approved':
      return 'Aprovada';

    case 'quotation_rejected':
      return 'Rejeitada';

    case 'quotation_converted_to_purchase_document':
      return 'Convertida em compra';

    case 'quotation_linked_purchase_cancelled':
      return 'Compra vinculada cancelada';

    case 'stock_transfer_created':
      return 'Criada';

    case 'stock_transfer_shipped':
      return 'Enviada';

    case 'stock_transfer_received':
      return 'Recebida';

    case 'stock_transfer_cancelled':
      return 'Cancelada';

    default:
      return eventStatusLabelMap[event.status] ?? event.status ?? 'Registrado';
  }
}

function getUnifiedTimelineProcessStatusClass(event: SupplierUnifiedTimelineRow) {
  switch (event.event_type) {
    case 'purchase_document_created':
    case 'purchase_document_created_from_quotation':
    case 'quotation_created':
    case 'quotation_channel_defined':
    case 'quotation_channel_changed':
    case 'quotation_responsible_changed':
    case 'stock_transfer_created':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

    case 'purchase_document_confirmed':
    case 'quotation_approved':
    case 'quotation_converted_to_purchase_document':
    case 'stock_transfer_shipped':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';

    case 'purchase_document_applied_to_inventory':
    case 'stock_transfer_received':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';

    case 'purchase_document_cancelled':
    case 'purchase_document_draft_deleted':
    case 'quotation_rejected':
    case 'quotation_linked_purchase_cancelled':
    case 'stock_transfer_cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';

    default:
      return getRelationshipStatusClass(event.status);
  }
}

function getUnifiedTimelineSourceLabel(sourceKind?: string | null) {
  switch (sourceKind) {
    case 'relationship':
      return 'Relacionamento';
    case 'operational':
      return 'Operacional';
    default:
      return sourceKind || 'Evento';
  }
}

function getUnifiedTimelineSourceClass(sourceKind?: string | null) {
  switch (sourceKind) {
    case 'relationship':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'operational':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getUnifiedTimelineReferenceLabel(event: SupplierUnifiedTimelineRow) {
  return event.reference_label || '—';
}


export function SupplierLifecycleTabs({
  activeTab,
  setActiveTab,
  purchases,
  products,
  prices,
  quotations,
  timeline,
  contacts,
  unifiedTimeline,
}: SupplierLifecycleTabsProps) {
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineSourceFilter, setTimelineSourceFilter] = useState<'all' | 'relationship' | 'operational'>('all');
  const [timelineSort, setTimelineSort] = useState<'newest' | 'oldest'>('newest');

  const filteredUnifiedTimeline = useMemo(() => {
    const normalizedSearch = timelineSearch.trim().toLowerCase();

    return [...unifiedTimeline]
      .filter((event) => {
        const matchesSource = timelineSourceFilter === 'all' || event.source_kind === timelineSourceFilter;
        if (!matchesSource) return false;

        if (!normalizedSearch) return true;

        const haystack = [
          event.title,
          event.description,
          event.event_type,
          unifiedEventTypeLabelMap[event.event_type],
          event.actor_email,
          event.created_by_email,
          event.reference_label,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const dateA = new Date(a.event_at).getTime();
        const dateB = new Date(b.event_at).getTime();
        return timelineSort === 'newest' ? dateB - dateA : dateA - dateB;
      });
  }, [unifiedTimeline, timelineSearch, timelineSourceFilter, timelineSort]);

  const hasTimelineFilters = timelineSearch.trim().length > 0 || timelineSourceFilter !== 'all' || timelineSort !== 'newest';

  const clearTimelineFilters = () => {
    setTimelineSearch('');
    setTimelineSourceFilter('all');
    setTimelineSort('newest');
  };

  const getPurchaseDocumentLabel = (row: SupplierPurchaseHistoryRow) => {
    return (
      row.document_code ||
      row.invoice_number ||
      row.purchase_document_id.slice(0, 8)
    );
  };
  const getPriceDocumentLabel = (row: SupplierPriceEvolutionRow) => {
    const purchaseFromHistory = row.purchase_document_id
      ? purchases.find(
        (purchase) => purchase.purchase_document_id === row.purchase_document_id,
      )
      : null;

    return (
      row.document_code ||
      row.invoice_number ||
      purchaseFromHistory?.document_code ||
      purchaseFromHistory?.invoice_number ||
      row.purchase_document_id?.slice(0, 8) ||
      '—'
    );
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex overflow-x-auto border-b border-gray-100 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${active
                ? 'border-b-2 border-[#19A999] text-[#19A999]'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {activeTab === 'purchases' && (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Documento</th>
                  <th className="py-2 pr-3">Emissão</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Itens</th>
                  <th className="py-2 pr-3">Quantidade</th>
                  <th className="py-2 pr-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((row) => (
                  <tr
                    key={row.purchase_document_id}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-2 pr-3">
                      <Link
                        to={`/admin/stock/purchase-documents?open=${row.purchase_document_id}`}
                        className="font-medium text-[#19A999] hover:underline"
                      >
                        {getPurchaseDocumentLabel(row)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {row.issue_date
                        ? formatDateDisplayPtBr(row.issue_date)
                        : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusClassMap[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {statusLabelMap[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {formatNumberPtBr(row.items_count ?? 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatNumberPtBr(row.total_quantity ?? 0)}
                    </td>
                    <td className="py-2 pr-3 font-semibold">
                      {formatCurrencyPtBr(row.total_amount ?? 0)}
                    </td>
                  </tr>
                ))}

                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      Nenhuma compra registrada para este fornecedor. Assim que houver documentos de compra, eles aparecerão aqui.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'quotations' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
              <div className="flex items-start gap-2">
                <ClipboardList size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Cotações do fornecedor</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Acompanhe cotações solicitadas, respondidas, aprovadas ou convertidas
                    em compra. Esta aba ajuda a avaliar velocidade de resposta, volume
                    cotado e aproveitamento comercial do fornecedor.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Cotação</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Canal</th>
                    <th className="py-2 pr-3">Responsável</th>
                    <th className="py-2 pr-3">Itens</th>
                    <th className="py-2 pr-3">Solicitado</th>
                    <th className="py-2 pr-3">Aprovado</th>
                    <th className="py-2 pr-3">Total cotado</th>
                    <th className="py-2 pr-3">Total aprovado</th>
                    <th className="py-2 pr-3">Solicitada em</th>
                    <th className="py-2 pr-3">Compra gerada</th>
                  </tr>
                </thead>

                <tbody>
                  {quotations.map((row: SupplierQuotationHistoryRow) => (
                    <tr
                      key={row.quotation_id}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="py-3 pr-3">
                        <Link
                          to={`/admin/stock/purchase-quotations?open=${row.quotation_id}`}
                          className="inline-flex items-center gap-1 font-semibold text-[#19A999] hover:underline"
                        >
                          {row.quotation_code}
                          <ExternalLink size={13} />
                        </Link>
                      </td>

                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getQuotationStatusClass(
                            row.status,
                          )}`}
                        >
                          {quotationStatusLabelMap[row.status] ?? row.status}
                        </span>
                      </td>

                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          <Send size={12} />
                          {quotationChannelLabelMap[row.sent_channel ?? ''] ??
                            row.sent_channel ??
                            '—'}
                        </span>
                      </td>

                      <td className="py-3 pr-3">{row.responsible_name || '—'}</td>
                      <td className="py-3 pr-3">{formatNumberPtBr(row.items_count ?? 0)}</td>
                      <td className="py-3 pr-3">{formatNumberPtBr(row.requested_qty ?? 0)}</td>
                      <td className="py-3 pr-3">{formatNumberPtBr(row.approved_qty ?? 0)}</td>
                      <td className="py-3 pr-3 font-semibold">{formatCurrencyPtBr(row.quoted_total ?? 0)}</td>
                      <td className="py-3 pr-3 font-semibold">{formatCurrencyPtBr(row.approved_total ?? 0)}</td>
                      <td className="py-3 pr-3">{formatDateTimeDisplayPtBr(row.requested_at)}</td>

                      <td className="py-3 pr-3">
                        {row.converted_purchase_document_id ? (
                          <Link
                            to={`/admin/stock/purchase-documents?open=${row.converted_purchase_document_id}`}
                            className="font-medium text-[#19A999] hover:underline"
                          >
                            {getConvertedPurchaseLabel(row)}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {quotations.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-gray-500">
                        Nenhuma cotação encontrada para este fornecedor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
              <div className="flex items-start gap-2">
                <Package size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Produtos fornecidos</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Esta visão mostra os produtos que aparecem no histórico de compras
                    ou no histórico de custos deste fornecedor. Use os custos mínimo,
                    médio, máximo e último custo para negociação e revisão de preço.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1040px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Produto</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Compras</th>
                    <th className="py-2 pr-3">Quantidade</th>
                    <th className="py-2 pr-3">Custo médio</th>
                    <th className="py-2 pr-3">Menor custo</th>
                    <th className="py-2 pr-3">Maior custo</th>
                    <th className="py-2 pr-3">Último custo</th>
                    <th className="py-2 pr-3">Variação</th>
                    <th className="py-2 pr-3">Última compra</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((row) => {
                    const variation = getCostVariationPercentage(
                      row.min_unit_cost,
                      row.max_unit_cost,
                    );

                    const daysSinceLastPurchase = getDaysSince(row.last_purchase_date);
                    const isStale =
                      daysSinceLastPurchase != null && daysSinceLastPurchase >= 90;

                    return (
                      <tr
                        key={row.product_id}
                        className="border-t border-gray-100 dark:border-gray-700"
                      >
                        <td className="py-3 pr-3">
                          <div className="flex flex-col">
                            <Link
                              to={`/admin/products/${row.product_id}/lifecycle`}
                              className="inline-flex items-center gap-1 font-semibold text-[#19A999] hover:underline"
                            >
                              {row.product_name}
                              <ArrowRight size={13} />
                            </Link>
                            <span className="text-xs text-gray-500">
                              Abrir Vida do Produto
                            </span>
                          </div>
                        </td>

                        <td className="py-3 pr-3">
                          {row.product_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <CheckCircle2 size={12} />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              <AlertTriangle size={12} />
                              Inativo
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-3 font-medium">
                          {formatNumberPtBr(row.purchase_count ?? 0)}
                        </td>

                        <td className="py-3 pr-3">
                          {formatNumberPtBr(row.total_quantity ?? 0)}
                        </td>

                        <td className="py-3 pr-3 font-semibold">
                          {formatCurrencyPtBr(row.average_unit_cost ?? 0)}
                        </td>

                        <td className="py-3 pr-3 text-emerald-700 dark:text-emerald-300">
                          {formatCurrencyPtBr(row.min_unit_cost ?? 0)}
                        </td>

                        <td className="py-3 pr-3 text-amber-700 dark:text-amber-300">
                          {formatCurrencyPtBr(row.max_unit_cost ?? 0)}
                        </td>

                        <td className="py-3 pr-3">
                          {row.last_unit_cost != null
                            ? formatCurrencyPtBr(row.last_unit_cost)
                            : '—'}
                        </td>

                        <td className="py-3 pr-3">
                          {variation != null ? (
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${variation >= 30
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : variation >= 15
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                            >
                              {variation.toLocaleString('pt-BR', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })}
                              %
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        <td className="py-3 pr-3">
                          <div className="flex flex-col">
                            <span>{formatDateDisplayPtBr(row.last_purchase_date)}</span>
                            <span
                              className={`text-xs ${isStale
                                ? 'font-medium text-amber-700 dark:text-amber-300'
                                : 'text-gray-500'
                                }`}
                            >
                              {getProductPurchaseRecencyLabel(row.last_purchase_date)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {products.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-gray-500">
                        Nenhum produto fornecido encontrado. Os produtos aparecerão
                        após compras confirmadas ou histórico de preço registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'prices' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <TrendingUp size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Evolução de custos do fornecedor</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Esta visão lista os custos registrados por produto e por documento.
                    Registros cancelados ou inativos não devem ser usados como referência
                    principal para negociação, mas continuam úteis para rastreabilidade.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Produto</th>
                    <th className="py-2 pr-3">Custo</th>
                    <th className="py-2 pr-3">Quantidade</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Origem</th>
                    <th className="py-2 pr-3">Documento</th>
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Observação</th>
                  </tr>
                </thead>

                <tbody>
                  {prices.map((row) => {
                    const inactive = row.is_active === false || !!row.cancelled_at;

                    return (
                      <tr
                        key={row.id}
                        className={`border-t border-gray-100 dark:border-gray-700 ${inactive ? 'opacity-70' : ''
                          }`}
                      >
                        <td className="py-3 pr-3">
                          <div className="flex flex-col">
                            <Link
                              to={`/admin/products/${row.product_id}/lifecycle`}
                              className="inline-flex items-center gap-1 font-semibold text-[#19A999] hover:underline"
                            >
                              {row.product_name}
                              <ArrowRight size={13} />
                            </Link>
                            <span className="text-xs text-gray-500">
                              Abrir Vida do Produto
                            </span>
                          </div>
                        </td>

                        <td className="py-3 pr-3 font-semibold">
                          {formatCurrencyPtBr(row.unit_cost ?? 0)}
                        </td>

                        <td className="py-3 pr-3">
                          {formatNumberPtBr(row.quantity ?? 0)}
                        </td>

                        <td className="py-3 pr-3">
                          {formatCurrencyPtBr(row.total_cost ?? 0)}
                        </td>

                        <td className="py-3 pr-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            <FileText size={12} />
                            {getPriceSourceLabel(row.source)}
                          </span>
                        </td>

                        <td className="py-3 pr-3">
                          {row.purchase_document_id ? (
                            <Link
                              to={`/admin/stock/purchase-documents?open=${row.purchase_document_id}`}
                              className="font-medium text-[#19A999] hover:underline"
                            >
                              {getPriceDocumentLabel(row)}
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        <td className="py-3 pr-3">
                          <div className="flex flex-col">
                            <span>{formatDateDisplayPtBr(row.effective_at || row.issue_date)}</span>
                            {row.issue_date && (
                              <span className="text-xs text-gray-500">
                                Emissão: {formatDateDisplayPtBr(row.issue_date)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${getPriceStatusClass(
                              row,
                            )}`}
                          >
                            {inactive ? <Ban size={12} /> : <CheckCircle2 size={12} />}
                            {getPriceStatusLabel(row)}
                          </span>
                        </td>

                        <td className="py-3 pr-3">
                          {row.cancelled_at ? (
                            <div className="max-w-[260px] text-xs text-red-600 dark:text-red-300">
                              Cancelado em {formatDateDisplayPtBr(row.cancelled_at)}
                              {row.cancelled_reason ? ` — ${row.cancelled_reason}` : ''}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">
                              Custo ativo para histórico e análise.
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {prices.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        Nenhum histórico de preço encontrado para este fornecedor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300">
              <div className="flex items-start gap-2">
                <Phone size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Contatos operacionais</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Cadastre contatos por área para agilizar compras, cobranças,
                    suporte fiscal, logística e tratativas comerciais. Marque o contato
                    principal quando houver uma pessoa de referência.
                  </p>
                </div>
              </div>
            </div>

            {contacts.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {contacts.map((contact) => {
                  const whatsappUrl = buildWhatsAppUrl(contact.whatsapp || contact.phone);
                  const phoneUrl = buildPhoneUrl(contact.phone);
                  const mailUrl = buildMailUrl(contact.email);

                  return (
                    <article
                      key={contact.id}
                      className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-gray-800 ${contact.active
                        ? 'border-gray-100 dark:border-gray-700'
                        : 'border-gray-200 opacity-70 dark:border-gray-700'
                        }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              <UserRound size={17} />
                            </div>

                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {contact.name}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {contact.role || 'Função não informada'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getContactDepartmentClass(
                                contact.department,
                              )}`}
                            >
                              {getContactDepartmentLabel(contact.department)}
                            </span>

                            {contact.is_primary && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                                <Star size={12} />
                                Principal
                              </span>
                            )}

                            {contact.active ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                <CheckCircle2 size={12} />
                                Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                <Ban size={12} />
                                Inativo
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                            >
                              <MessageCircle size={14} />
                              WhatsApp
                            </a>
                          )}

                          {phoneUrl && (
                            <a
                              href={phoneUrl}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              <Phone size={14} />
                              Ligar
                            </a>
                          )}

                          {mailUrl && (
                            <a
                              href={mailUrl}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              <Mail size={14} />
                              E-mail
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                        <p>
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            Telefone:
                          </span>{' '}
                          {contact.phone || '—'}
                        </p>
                        <p>
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            WhatsApp:
                          </span>{' '}
                          {contact.whatsapp || '—'}
                        </p>
                        <p className="sm:col-span-2">
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            E-mail:
                          </span>{' '}
                          {contact.email || '—'}
                        </p>
                      </div>

                      {contact.notes && (
                        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
                          {contact.notes}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/20 dark:text-cyan-300">
                  <Phone size={22} />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">
                  Nenhum contato cadastrado
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                  Adicione contatos comerciais, financeiros, fiscais ou logísticos para
                  facilitar a rotina de compras e relacionamento com este fornecedor.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'relationship' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4 text-sm text-purple-800 dark:border-purple-900/40 dark:bg-purple-950/20 dark:text-purple-300">
              <div className="flex items-start gap-2">
                <MessageSquare size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Relacionamento com o fornecedor</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Registre anotações, ligações, reuniões, incidentes, bloqueios,
                    aprovações e follow-ups. Esta aba representa o histórico manual da
                    relação com o fornecedor e será unificada com eventos operacionais
                    no próximo sprint.
                  </p>
                </div>
              </div>
            </div>

            {timeline.length > 0 ? (
              <div className="relative space-y-4">
                <div className="absolute left-4 top-2 h-[calc(100%-1rem)] w-px bg-gray-200 dark:bg-gray-800" />

                {timeline.map((event) => {
                  const EventIcon = getRelationshipEventIcon(event.event_type);
                  const StatusIcon = getRelationshipStatusIcon(event.status);

                  return (
                    <article
                      key={event.id}
                      className="relative flex gap-4"
                    >
                      <div className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-4 ring-white dark:ring-gray-900 ${getRelationshipEventIconClass(event.event_type)}`}>
                        <EventIcon size={17} />
                      </div>

                      <div className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {event.title}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {getRelationshipEventTypeLabel(event.event_type)}
                              </p>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getRelationshipSeverityClass(
                                event.severity,
                              )}`}
                            >
                              {severityLabelMap[event.severity] ?? event.severity}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${getRelationshipStatusClass(
                                event.status,
                              )}`}
                            >
                              <StatusIcon size={12} />
                              {eventStatusLabelMap[event.status] ?? event.status}
                            </span>
                          </div>

                          {event.description && (
                            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                              {event.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                            {event.related_product_id && (
                              <Link
                                to={`/admin/products/${event.related_product_id}/lifecycle`}
                                className="inline-flex items-center gap-1 text-[#19A999] hover:underline"
                              >
                                <Tags size={13} />
                                {event.related_product_name || 'Produto relacionado'}
                              </Link>
                            )}

                            {event.related_purchase_document_id && (
                              <Link
                                to={`/admin/stock/purchase-documents?open=${event.related_purchase_document_id}`}
                                className="inline-flex items-center gap-1 text-[#19A999] hover:underline"
                              >
                                <FileText size={13} />
                                Compra relacionada
                              </Link>
                            )}

                            {event.created_by_email && (
                              <span className="inline-flex items-center gap-1">
                                <UserRound size={13} />
                                {event.created_by_email}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400 lg:text-right">
                          <div className="flex items-center gap-1 lg:justify-end">
                            <CalendarClock size={13} />
                            {formatDateTimeDisplayPtBr(event.event_at)}
                          </div>
                          <p className="mt-1">
                            Criado em {formatDateTimeDisplayPtBr(event.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-300">
                  <MessageSquare size={22} />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">
                  Nenhum evento de relacionamento registrado
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                  Use “Registrar evento” para criar anotações, negociações, incidentes,
                  bloqueios, reuniões ou follow-ups deste fornecedor.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <Activity size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Linha do tempo unificada</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Reúne eventos manuais de relacionamento e eventos operacionais de
                    compras, cotações, cancelamentos e demais processos vinculados ao
                    fornecedor.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Linha do tempo unificada</h3>
                  <p className="text-xs text-gray-500">
                    {filteredUnifiedTimeline.length} de {unifiedTimeline.length} eventos encontrados
                  </p>
                </div>

                {hasTimelineFilters && (
                  <button
                    type="button"
                    onClick={clearTimelineFilters}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={timelineSearch}
                    onChange={(e) => setTimelineSearch(e.target.value)}
                    placeholder="Buscar eventos..."
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <select
                  value={timelineSourceFilter}
                  onChange={(e) => setTimelineSourceFilter(e.target.value as any)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="all">Todas as origens</option>
                  <option value="operational">Operacional</option>
                  <option value="relationship">Relacionamento</option>
                </select>

                <select
                  value={timelineSort}
                  onChange={(e) => setTimelineSort(e.target.value as any)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="newest">Mais recentes primeiro</option>
                  <option value="oldest">Mais antigos primeiro</option>
                </select>
              </div>
            </div>

            {filteredUnifiedTimeline.length > 0 ? (
              <div className="relative space-y-4">
                <div className="absolute left-4 top-2 h-[calc(100%-1rem)] w-px bg-gray-200 dark:bg-gray-800" />

                {filteredUnifiedTimeline.map((event: SupplierUnifiedTimelineRow) => {
                  const EventIcon = getUnifiedTimelineIcon(
                    event.event_type,
                    event.source_kind,
                  );

                  return (
                    <article
                      key={event.id}
                      className="relative flex gap-4"
                    >
                      <div className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-4 ring-white dark:ring-gray-900 ${getUnifiedTimelineIconClass(
                        event.event_type,
                        event.source_kind,
                      )}`}>
                        <EventIcon size={17} />
                      </div>

                      <div className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {event.title}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {unifiedEventTypeLabelMap[event.event_type] ?? event.event_type}
                              </p>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getUnifiedTimelineSourceClass(
                                event.source_kind,
                              )}`}
                            >
                              {getUnifiedTimelineSourceLabel(event.source_kind)}
                            </span>

                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getRelationshipSeverityClass(
                                event.severity,
                              )}`}
                            >
                              {severityLabelMap[event.severity] ?? event.severity}
                            </span>

                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getUnifiedTimelineProcessStatusClass(
                                event,
                              )}`}
                            >
                              {getUnifiedTimelineProcessStatusLabel(event)}
                            </span>

                            {event.reference_label && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                {getUnifiedTimelineReferenceLabel(event)}
                              </span>
                            )}
                          </div>

                          {event.description && (
                            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                              {event.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                            {event.related_purchase_quotation_id && (
                              <Link
                                to={`/admin/stock/purchase-quotations?open=${event.related_purchase_quotation_id}`}
                                className="inline-flex items-center gap-1 text-[#19A999] hover:underline"
                              >
                                <ClipboardList size={13} />
                                Abrir cotação
                              </Link>
                            )}

                            {event.related_purchase_document_id && (
                              <Link
                                to={`/admin/stock/purchase-documents?open=${event.related_purchase_document_id}`}
                                className="inline-flex items-center gap-1 text-[#19A999] hover:underline"
                              >
                                <FileText size={13} />
                                Abrir compra
                              </Link>
                            )}

                            {event.related_product_id && (
                              <Link
                                to={`/admin/products/${event.related_product_id}/lifecycle`}
                                className="inline-flex items-center gap-1 text-[#19A999] hover:underline"
                              >
                                <Tags size={13} />
                                Abrir produto
                              </Link>
                            )}

                            {(event.actor_email || event.created_by_email) && (
                              <span className="inline-flex items-center gap-1">
                                <UserRound size={13} />
                                {event.actor_email || event.created_by_email}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400 lg:text-right">
                          <div className="flex items-center gap-1 lg:justify-end">
                            <CalendarClock size={13} />
                            {formatDateTimeDisplayPtBr(event.event_at)}
                          </div>
                          <p className="mt-1">
                            Criado em {formatDateTimeDisplayPtBr(event.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                  <Activity size={22} />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">
                  Nenhum evento encontrado na linha do tempo
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                  Eventos de compras, cotações, cancelamentos e relacionamento aparecerão
                  aqui conforme a operação do fornecedor evoluir.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
