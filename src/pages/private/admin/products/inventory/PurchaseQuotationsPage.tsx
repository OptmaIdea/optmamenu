import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/empty-state/EmptyState';
import { supabase } from '@/lib/supabase';
import { stockService } from '@/services/stockService';
import type { PurchaseQuotationDetail, PurchaseQuotationSummary } from '@/services/stockService';
import { InventoryQuickNav } from './components/InventoryQuickNav';

type StoreLike = { id: string };

type SupplierContact = {
  phone?: string | null;
  email?: string | null;
  commercial_phone?: string | null;
  commercial_whatsapp?: string | null;
  commercial_email?: string | null;
};

const statusOptions = [
  { value: '', label: 'Todos os status' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent', label: 'Enviada' },
  { value: 'answered', label: 'Respondida' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'rejected', label: 'Rejeitada' },
  { value: 'converted', label: 'Convertida' },
  { value: 'cancelled', label: 'Cancelada' },
];

const getCurrentStore = async (): Promise<StoreLike | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase.rpc('get_user_store_by_id', {
    p_user_id: user.id,
  });

  if (error || !data) return null;

  const store = Array.isArray(data) ? data[0] : data;
  return store?.id ? { id: store.id } : null;
};

function getStatusLabel(status?: string | null) {
  return statusOptions.find((option) => option.value === status)?.label ?? status ?? 'Não informado';
}

function getStatusClassName(status?: string | null) {
  switch (status) {
    case 'approved':
    case 'converted':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'sent':
    case 'answered':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'rejected':
    case 'cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0));
}

function normalizePhone(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildFallbackMessage(detail: PurchaseQuotationDetail) {
  const lines = detail.items.map((item, index) => {
    const unitCost = item.reference_unit_cost ? ` | referência: ${formatCurrency(item.reference_unit_cost)}` : '';
    return `${index + 1}. ${item.product_name} — ${item.requested_qty} un.${unitCost}`;
  });

  return [
    'Olá, tudo bem?',
    '',
    'Solicito cotação para os itens abaixo.',
    '',
    `Fornecedor: ${detail.supplier_name}`,
    `Cotação: ${detail.quotation_code}`,
    `Data da solicitação: ${formatDateTime(detail.requested_at)}`,
    '',
    'Produtos:',
    ...lines,
    '',
    'Por gentileza, informar preço unitário, disponibilidade, prazo de entrega, condição de pagamento e validade da proposta.',
    '',
    'Obrigado.',
  ].join('\n');
}

function buildPrintHtml(detail: PurchaseQuotationDetail, message: string, contact: SupplierContact | null) {
  const rows = detail.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.product_name)}</td>
          <td class="right">${item.requested_qty} un.</td>
          <td class="right">${formatCurrency(item.reference_unit_cost)}</td>
          <td class="right">${item.quoted_unit_cost == null ? '' : formatCurrency(item.quoted_unit_cost)}</td>
          <td>${escapeHtml(item.supplier_notes)}</td>
        </tr>
      `,
    )
    .join('');

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(detail.quotation_code)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; font-size: 13px; }
          h1 { margin: 0; font-size: 22px; }
          .header { border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
          .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
          .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
          .right { text-align: right; }
          pre { white-space: pre-wrap; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; color: #334155; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Solicitação de cotação</h1>
          <div>${escapeHtml(detail.quotation_code)}</div>
        </div>
        <div class="grid">
          <div class="box"><div class="label">Fornecedor</div><strong>${escapeHtml(detail.supplier_name)}</strong></div>
          <div class="box"><div class="label">Status</div>${getStatusLabel(detail.status)}</div>
          <div class="box"><div class="label">WhatsApp / telefone</div>${escapeHtml(contact?.commercial_whatsapp || contact?.commercial_phone || contact?.phone || 'Não informado')}</div>
          <div class="box"><div class="label">E-mail</div>${escapeHtml(contact?.commercial_email || contact?.email || 'Não informado')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Produto</th><th class="right">Quantidade</th><th class="right">Referência</th><th class="right">Cotado</th><th>Obs.</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <h2>Mensagem</h2>
        <pre>${escapeHtml(message)}</pre>
      </body>
    </html>`;
}

export default function PurchaseQuotationsPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quotations, setQuotations] = useState<PurchaseQuotationSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<PurchaseQuotationDetail | null>(null);
  const [supplierContact, setSupplierContact] = useState<SupplierContact | null>(null);
  const [detailMessage, setDetailMessage] = useState('');
  const [openingDetail, setOpeningDetail] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);

  async function loadQuotations(nextStoreId = storeId, options?: { silent?: boolean }) {
    if (!nextStoreId) return;

    try {
      if (options?.silent) setRefreshing(true);
      else setLoading(true);

      const data = await stockService.getPurchaseQuotationsByStore(nextStoreId, statusFilter || null);
      setQuotations(data);
    } catch (error) {
      console.error('Erro ao carregar cotações:', error);
      toast.error('Não foi possível carregar as cotações.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const run = async () => {
      const store = await getCurrentStore();
      setStoreId(store?.id ?? null);

      if (store?.id) {
        await loadQuotations(store.id);
      } else {
        setLoading(false);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    if (!storeId) return;
    void loadQuotations(storeId);
  }, [statusFilter, storeId]);

  const filteredQuotations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quotations;

    return quotations.filter((quotation) => {
      return [
        quotation.quotation_code,
        quotation.supplier_name,
        quotation.status,
        quotation.responsible_name,
        quotation.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [quotations, search]);

  const totals = useMemo(() => {
    return {
      count: filteredQuotations.length,
      totalReference: filteredQuotations.reduce((sum, row) => sum + Number(row.total_reference ?? 0), 0),
      sent: filteredQuotations.filter((row) => row.status === 'sent').length,
    };
  }, [filteredQuotations]);

  async function openDetail(quotationId: string) {
    try {
      setOpeningDetail(true);
      const data = await stockService.getPurchaseQuotationDetail(quotationId);
      setDetail(data);
      setDetailMessage(data.message_body || buildFallbackMessage(data));

      const { data: supplierData, error } = await supabase
        .from('suppliers')
        .select('phone, email, commercial_phone, commercial_whatsapp, commercial_email')
        .eq('id', data.supplier_id)
        .maybeSingle();

      if (error) throw error;
      setSupplierContact((supplierData as SupplierContact | null) ?? null);
    } catch (error) {
      console.error('Erro ao abrir cotação:', error);
      toast.error('Não foi possível abrir a cotação.');
    } finally {
      setOpeningDetail(false);
    }
  }

  async function copyDetailMessage() {
    try {
      await navigator.clipboard.writeText(detailMessage);
      toast.success('Texto da cotação copiado.');
    } catch (error) {
      console.error('Erro ao copiar cotação:', error);
      toast.error('Não foi possível copiar o texto automaticamente.');
    }
  }

  function printDetail() {
    if (!detail) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(detail, detailMessage, supplierContact));
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  async function createPurchaseDraftFromDetail() {
    if (!detail) return;

    try {
      setCreatingDraft(true);
      const result = await stockService.createPurchaseDocumentDraftBatch({
        supplierId: detail.supplier_id,
        items: detail.items.map((item) => ({
          productId: item.product_id,
          quantity: Number(item.approved_qty ?? item.requested_qty),
          unitCost: Number(item.quoted_unit_cost ?? item.reference_unit_cost ?? 0),
        })),
        notes: `Criado a partir da cotação ${detail.quotation_code}`,
      });

      toast.success(`Rascunho de compra criado com ${result.items_count} item(ns).`);
    } catch (error) {
      console.error('Erro ao criar rascunho a partir da cotação:', error);
      toast.error('Não foi possível criar o rascunho de compra.');
    } finally {
      setCreatingDraft(false);
    }
  }

  const email = supplierContact?.commercial_email || supplierContact?.email || null;
  const whatsapp = normalizePhone(
    supplierContact?.commercial_whatsapp ||
      supplierContact?.commercial_phone ||
      supplierContact?.phone,
  );

  if (loading) return <LoadingSpinner />;

  return (
    <PageContainer
      title="Cotações"
      subtitle="Acesso rápido às cotações salvas para fornecedores."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <InventoryQuickNav />
          <button
            type="button"
            onClick={() => void loadQuotations(storeId, { silent: true })}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500">Cotações exibidas</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totals.count}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500">Referência total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totals.totalReference)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500">Enviadas</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totals.sent}</p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código, fornecedor, responsável ou observação"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredQuotations.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Nenhuma cotação encontrada"
          description="As cotações salvas pelas sugestões de compra aparecerão aqui para consulta e reenvio."
        />
      ) : (
        <div className="rounded-lg bg-white dark:bg-gray-800">
          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
            <table className="min-w-[980px] w-full text-left">
              <thead className="bg-gray-50 text-sm font-medium text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-4">Cotação</th>
                  <th className="px-4 py-4">Fornecedor</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Itens</th>
                  <th className="px-4 py-4 text-right">Referência</th>
                  <th className="px-4 py-4">Criada em</th>
                  <th className="px-4 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredQuotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-4 font-semibold text-gray-900 dark:text-white">
                      {quotation.quotation_code}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-200">
                      {quotation.supplier_name}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClassName(quotation.status)}`}>
                        {getStatusLabel(quotation.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-700 dark:text-gray-200">
                      {quotation.items_count}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(quotation.total_reference)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDateTime(quotation.requested_at)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        disabled={openingDetail}
                        onClick={() => void openDetail(quotation.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <Eye className="h-4 w-4" />
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-950">
            <div className="flex items-start gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{detail.quotation_code}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {detail.supplier_name} · {getStatusLabel(detail.status)}
                </p>
              </div>

              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => void copyDetailMessage()} className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium">
                  <Copy className="h-4 w-4" />
                  Copiar
                </button>
                <button type="button" onClick={printDetail} className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium">
                  <Printer className="h-4 w-4" />
                  Imprimir
                </button>
                {email && (
                  <a
                    href={`mailto:${email}?subject=${encodeURIComponent(detail.message_subject || `Cotação ${detail.quotation_code}`)}&body=${encodeURIComponent(detailMessage)}`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium"
                  >
                    <Mail className="h-4 w-4" />
                    E-mail
                  </a>
                )}
                {whatsapp && (
                  <a
                    href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(detailMessage)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void createPurchaseDraftFromDetail()}
                  disabled={creatingDraft}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {creatingDraft ? 'Criando...' : 'Criar compra'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setSupplierContact(null);
                  setDetailMessage('');
                }}
                className="shrink-0 rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="text-xs font-semibold uppercase text-gray-500">Criada em</div>
                  <div className="mt-1 font-semibold">{formatDateTime(detail.requested_at)}</div>
                </div>
                <div className="rounded-xl border bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="text-xs font-semibold uppercase text-gray-500">Canal</div>
                  <div className="mt-1 font-semibold">{detail.sent_channel || 'Não informado'}</div>
                </div>
                <div className="rounded-xl border bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="text-xs font-semibold uppercase text-gray-500">Itens</div>
                  <div className="mt-1 font-semibold">{detail.items.length}</div>
                </div>
                <div className="rounded-xl border bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="text-xs font-semibold uppercase text-gray-500">Responsável</div>
                  <div className="mt-1 font-semibold">{detail.responsible_name || '—'}</div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
                <table className="min-w-[760px] w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3 text-right">Solicitado</th>
                      <th className="px-4 py-3 text-right">Referência</th>
                      <th className="px-4 py-3 text-right">Cotado</th>
                      <th className="px-4 py-3 text-right">Aprovado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium">{item.product_name}</td>
                        <td className="px-4 py-3 text-right">{item.requested_qty}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(item.reference_unit_cost)}</td>
                        <td className="px-4 py-3 text-right">{item.quoted_unit_cost == null ? '—' : formatCurrency(item.quoted_unit_cost)}</td>
                        <td className="px-4 py-3 text-right">{item.approved_qty ?? item.requested_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase text-gray-500">
                  Mensagem para envio
                </span>
                <textarea
                  value={detailMessage}
                  onChange={(event) => setDetailMessage(event.target.value)}
                  className="min-h-[240px] w-full resize-y rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
