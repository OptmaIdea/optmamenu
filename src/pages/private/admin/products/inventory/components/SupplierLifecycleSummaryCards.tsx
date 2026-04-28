import {
  AlertTriangle,

  Ban,
  CalendarClock,
  FileText,
  Package,
  Phone,
  ReceiptText,
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
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  not_evaluated: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

export function SupplierLifecycleSummaryCards({
  summary,
}: SupplierLifecycleSummaryCardsProps) {
  const homologationStatus = summary.blocked
    ? 'blocked'
    : summary.homologation_status ?? 'not_evaluated';

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
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
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  homologationClassMap[homologationStatus] ??
                  homologationClassMap.not_evaluated
                }`}
              >
                {homologationLabelMap[homologationStatus] ?? homologationStatus}
              </span>

              {!summary.active && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  <Ban size={12} />
                  Inativo
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-500 dark:text-gray-400 md:grid-cols-2">
              <p>Razão social: {summary.legal_name || '—'}</p>
              <p>Documento: {summary.document || '—'}</p>
              <p>E-mail: {summary.email || '—'}</p>
              <p>Telefone: {summary.phone || '—'}</p>
            </div>
          </div>

          {summary.blocked && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Fornecedor bloqueado
              </div>
              <p className="mt-1 text-xs">
                {summary.blocked_reason || 'Sem motivo informado.'}
              </p>
            </div>
          )}
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
            {summary.last_purchase_date
              ? new Date(summary.last_purchase_date).toLocaleDateString('pt-BR')
              : '—'}
          </p>
          <p className="text-xs text-gray-500">
            {summary.days_since_last_purchase != null
              ? `${summary.days_since_last_purchase} dia(s)`
              : 'sem histórico'}
          </p>
        </div>
      </div>
    </section>
  );
}
