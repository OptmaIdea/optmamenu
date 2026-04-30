import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Package,
  Phone,
  ReceiptText,
  ShieldAlert,
  Star,
  TrendingUp,
} from 'lucide-react';

import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import type { Supplier360Summary } from '../types/supplierLifecycle.types';

type SupplierLifecycleSummaryCardsProps = {
  summary: Supplier360Summary;
};

const homologationLabelMap: Record<string, string> = {
  not_evaluated: 'Não avaliado',
  approved: 'Aprovado',
  pending: 'Pendente',
  rejected: 'Rejeitado',
  blocked: 'Bloqueado',
};

const homologationClassMap: Record<string, string> = {
  approved:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  rejected:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  blocked:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  not_evaluated:
    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

function formatDatePtBr(date?: string | null) {
  if (!date) return '—';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleDateString('pt-BR');
}

function getRelationshipStatus(summary: Supplier360Summary) {
  if (summary.blocked) {
    return {
      label: 'Bloqueado para compras',
      description: summary.blocked_reason || 'Fornecedor bloqueado sem motivo detalhado.',
      icon: Ban,
      className:
        'border-red-100 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
    };
  }

  if (!summary.active) {
    return {
      label: 'Fornecedor inativo',
      description: 'Cadastro inativo. Revise antes de usar em compras ou cotações.',
      icon: ShieldAlert,
      className:
        'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    };
  }

  if (summary.homologation_status === 'rejected') {
    return {
      label: 'Homologação rejeitada',
      description: 'Fornecedor não recomendado para novas compras até nova análise.',
      icon: AlertTriangle,
      className:
        'border-red-100 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
    };
  }

  if (summary.homologation_status === 'pending') {
    return {
      label: 'Homologação pendente',
      description: 'Fornecedor ainda precisa de validação operacional/fiscal.',
      icon: Clock,
      className:
        'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
    };
  }

  if ((summary.total_purchase_documents ?? 0) === 0) {
    return {
      label: 'Fornecedor sem compras',
      description: 'Cadastro pronto, mas ainda sem histórico de documentos de compra.',
      icon: AlertTriangle,
      className:
        'border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300',
    };
  }

  if (
    summary.days_since_last_purchase != null &&
    summary.days_since_last_purchase >= 90
  ) {
    return {
      label: 'Sem compra recente',
      description: `Última compra há ${summary.days_since_last_purchase} dia(s). Pode valer revisar relacionamento ou condições.`,
      icon: CalendarClock,
      className:
        'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
    };
  }

  return {
    label: 'Fornecedor operacional',
    description: 'Fornecedor com cadastro e histórico aptos para acompanhamento.',
    icon: CheckCircle2,
    className:
      'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300',
  };
}

function getPurchaseRecencyLabel(summary: Supplier360Summary) {
  if (!summary.last_purchase_date) return 'sem histórico';

  if (summary.days_since_last_purchase == null) return 'com histórico';

  if (summary.days_since_last_purchase === 0) return 'hoje';

  if (summary.days_since_last_purchase === 1) return 'há 1 dia';

  return `há ${summary.days_since_last_purchase} dias`;
}

export function SupplierLifecycleSummaryCards({
  summary,
}: SupplierLifecycleSummaryCardsProps) {
  const homologationStatus = summary.blocked
    ? 'blocked'
    : summary.homologation_status ?? 'not_evaluated';

  const relationshipStatus = getRelationshipStatus(summary);
  const RelationshipIcon = relationshipStatus.icon;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {summary.trade_name || summary.name}
              </h1>

              {summary.preferred_supplier && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                  <Star size={12} />
                  Preferencial
                </span>
              )}

              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${homologationClassMap[homologationStatus] ??
                  homologationClassMap.not_evaluated
                  }`}
              >
                {homologationLabelMap[homologationStatus] ?? homologationStatus}
              </span>

              {summary.active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <CheckCircle2 size={12} />
                  Ativo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  <Ban size={12} />
                  Inativo
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-gray-500 dark:text-gray-400 md:grid-cols-2">
              <p>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  Razão social:
                </span>{' '}
                {summary.legal_name || '—'}
              </p>
              <p>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  Documento:
                </span>{' '}
                {summary.document || '—'}
              </p>
              <p>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  E-mail:
                </span>{' '}
                {summary.email || '—'}
              </p>
              <p>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  Telefone:
                </span>{' '}
                {summary.phone || '—'}
              </p>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 text-sm lg:max-w-sm ${relationshipStatus.className}`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <RelationshipIcon size={16} />
              {relationshipStatus.label}
            </div>
            <p className="mt-1 text-xs leading-relaxed">
              {relationshipStatus.description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ReceiptText size={16} />
            Compras
          </div>
          <p className="mt-2 text-2xl font-bold">
            {formatNumberPtBr(summary.total_purchase_documents ?? 0)}
          </p>
          <p className="text-xs text-gray-500">
            {formatNumberPtBr(summary.confirmed_purchase_documents ?? 0)} confirmadas
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp size={16} />
            Total comprado
          </div>
          <p className="mt-2 text-xl font-bold">
            {formatCurrencyPtBr(summary.confirmed_purchased_amount ?? 0)}
          </p>
          <p className="text-xs text-gray-500">
            Ticket médio: {formatCurrencyPtBr(summary.average_ticket ?? 0)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Package size={16} />
            Produtos
          </div>
          <p className="mt-2 text-2xl font-bold">
            {formatNumberPtBr(summary.distinct_products ?? 0)}
          </p>
          <p className="text-xs text-gray-500">
            {formatNumberPtBr(summary.total_items_quantity ?? 0)} un. compradas
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Phone size={16} />
            Contatos
          </div>
          <p className="mt-2 text-2xl font-bold">
            {formatNumberPtBr(summary.contacts_count ?? 0)}
          </p>
          <p className="text-xs text-gray-500">ativos cadastrados</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FileText size={16} />
            Eventos
          </div>
          <p className="mt-2 text-2xl font-bold">
            {formatNumberPtBr(summary.relationship_events_count ?? 0)}
          </p>
          <p className="text-xs text-gray-500">
            {formatNumberPtBr(summary.open_relationship_events_count ?? 0)} abertos
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CalendarClock size={16} />
            Última compra
          </div>
          <p className="mt-2 text-lg font-bold">
            {formatDatePtBr(summary.last_purchase_date)}
          </p>
          <p className="text-xs text-gray-500">
            {getPurchaseRecencyLabel(summary)}
          </p>
        </div>
      </div>
    </section>
  );
}