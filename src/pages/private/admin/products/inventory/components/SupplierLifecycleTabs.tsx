import { Link } from 'react-router-dom';
import {
  CalendarClock,
  Mail,
  Package,
  Phone,
  ReceiptText,
  Tags,
  Clock,
  TrendingUp,
} from 'lucide-react';

import {
  formatCurrencyPtBr,
  formatNumberPtBr,
} from '@/utils/export/formatters';

import type {
  SupplierContactRow,
  SupplierPriceEvolutionRow,
  SupplierPurchaseHistoryRow,
  SupplierRelationshipTimelineRow,
  SupplierSuppliedProductRow,
} from '../types/supplierLifecycle.types';

type SupplierLifecycleTabsProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  purchases: SupplierPurchaseHistoryRow[];
  products: SupplierSuppliedProductRow[];
  prices: SupplierPriceEvolutionRow[];
  timeline: SupplierRelationshipTimelineRow[];
  contacts: SupplierContactRow[];
};

const tabs = [
  { id: 'purchases', label: 'Compras', icon: ReceiptText },
  { id: 'products', label: 'Produtos', icon: Package },
  { id: 'prices', label: 'Preços', icon: TrendingUp },
  { id: 'contacts', label: 'Contatos', icon: Phone },
  { id: 'relationship', label: 'Relacionamento', icon: Clock },
];

const statusLabelMap: Record<string, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
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

const severityLabelMap: Record<string, string> = {
  high: 'Alta', medium: 'Média', low: 'Baixa',
  critical: 'Crítico', info: 'Informativo',
};

const eventStatusLabelMap: Record<string, string> = {
  open: 'Aberto', done: 'Concluído', closed: 'Concluído',
  pending: 'Pendente', archived: 'Arquivado', cancelled: 'Cancelado',
};

const departmentLabelMap: Record<string, string> = {
  commercial: 'Comercial',
  financial: 'Financeiro',
  fiscal: 'Fiscal',
  logistics: 'Logística',
  support: 'Suporte',
  other: 'Outro',
};

export function SupplierLifecycleTabs({
  activeTab,
  setActiveTab,
  purchases,
  products,
  prices,
  timeline,
  contacts,
}: SupplierLifecycleTabsProps) {
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
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-b-2 border-[#21A896] text-[#21A896]'
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
                        className="font-medium text-[#21A896] hover:underline"
                      >
                        {row.invoice_number || row.purchase_document_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {row.issue_date
                        ? new Date(row.issue_date).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {statusLabelMap[row.status] ?? row.status}
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

        {activeTab === 'products' && (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Produto</th>
                  <th className="py-2 pr-3">Compras</th>
                  <th className="py-2 pr-3">Quantidade</th>
                  <th className="py-2 pr-3">Custo médio</th>
                  <th className="py-2 pr-3">Menor/Maior</th>
                  <th className="py-2 pr-3">Último custo</th>
                  <th className="py-2 pr-3">Última compra</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => (
                  <tr
                    key={row.product_id}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-2 pr-3">
                      <Link
                        to={`/admin/products/${row.product_id}/lifecycle`}
                        className="font-medium text-[#21A896] hover:underline"
                      >
                        {row.product_name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {formatNumberPtBr(row.purchase_count ?? 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatNumberPtBr(row.total_quantity ?? 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatCurrencyPtBr(row.average_unit_cost ?? 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatCurrencyPtBr(row.min_unit_cost ?? 0)}
                      {' / '}
                      {formatCurrencyPtBr(row.max_unit_cost ?? 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatCurrencyPtBr(row.last_unit_cost ?? 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {row.last_purchase_date
                        ? new Date(row.last_purchase_date).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                  </tr>
                ))}

                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      Nenhum produto fornecido encontrado. Os produtos aparecerão após compras confirmadas ou histórico de preço registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'prices' && (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Produto</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Custo unitário</th>
                  <th className="py-2 pr-3">Quantidade</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Origem</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-2 pr-3">{row.product_name}</td>
                    <td className="py-2 pr-3">
                      {row.issue_date
                        ? new Date(row.issue_date).toLocaleDateString('pt-BR')
                        : new Date(row.effective_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2 pr-3">
                      {formatCurrencyPtBr(row.unit_cost ?? 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatNumberPtBr(row.quantity ?? 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatCurrencyPtBr(row.total_cost ?? 0)}
                    </td>
                    <td className="py-2 pr-3">{row.source || '—'}</td>
                  </tr>
                ))}

                {prices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      Nenhuma evolução de preço encontrada. O histórico será alimentado pelos documentos de compra confirmados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {contact.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {departmentLabelMap[contact.department] ?? contact.department}
                      {contact.role ? ` · ${contact.role}` : ''}
                    </p>
                  </div>

                  {contact.is_primary && (
                    <span className="rounded-full bg-[#21A896]/10 px-2 py-1 text-[11px] font-semibold text-[#21A896]">
                      Principal
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <p className="flex items-center gap-2">
                    <Phone size={14} />
                    {contact.phone || contact.whatsapp || '—'}
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail size={14} />
                    {contact.email || '—'}
                  </p>
                  {contact.notes && (
                    <p className="mt-2 text-xs text-gray-500">{contact.notes}</p>
                  )}
                </div>
              </div>
            ))}

            {contacts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-gray-500 dark:border-gray-700">
                Nenhum contato cadastrado. Use “Novo contato” para registrar responsáveis comerciais, financeiros ou fiscais.
              </div>
            )}
          </div>
        )}

        {activeTab === 'relationship' && (
          <div className="space-y-3">
            {timeline.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {event.title}
                      </h3>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {eventTypeLabelMap[event.event_type] ?? event.event_type}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {severityLabelMap[event.severity] ?? event.severity}
                      </span>
                    </div>

                    {event.description && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {event.description}
                      </p>
                    )}

                    {event.related_product_name && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <Tags size={13} />
                        Produto relacionado: {event.related_product_name}
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 md:text-right">
                    <div className="flex items-center gap-1 md:justify-end">
                      <CalendarClock size={13} />
                      {new Date(event.event_at).toLocaleString('pt-BR')}
                    </div>
                    <p>{eventStatusLabelMap[event.status] ?? event.status}</p>
                  </div>
                </div>
              </div>
            ))}

            {timeline.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-gray-500 dark:border-gray-700">
                Nenhum evento registrado. Use “Registrar evento” para criar anotações, negociações, incidentes ou follow-ups.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
