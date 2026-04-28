import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Printer,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { stockService } from '@/services/stockService';
import type {
  PurchaseQuotationDetail,
  PurchaseQuotationSummary,
} from '@/services/stockService';

type PurchaseQuotationsPanelProps = {
  storeId: string;
};

type QuotationEditableStatus =
  | 'draft'
  | 'sent'
  | 'answered'
  | 'approved'
  | 'rejected'
  | 'cancelled';

type QuotationChannel = 'whatsapp' | 'email' | 'pdf' | 'manual' | 'other' | '';

type SupplierQuotationContact = {
  phone: string | null;
  email: string | null;
};

type SupplierContactRow = {
  phone?: string | null;
  email?: string | null;
  secondary_phone?: string | null;
  commercial_phone?: string | null;
  commercial_whatsapp?: string | null;
  commercial_email?: string | null;
  financial_phone?: string | null;
  financial_email?: string | null;
  fiscal_phone?: string | null;
  fiscal_email?: string | null;
  metadata?: Record<string, unknown> | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0));
}

function getQuotationStatusLabel(status: string) {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'sent':
      return 'Enviada';
    case 'answered':
      return 'Respondida';
    case 'approved':
      return 'Aprovada';
    case 'rejected':
      return 'Rejeitada';
    case 'converted':
      return 'Convertida';
    case 'cancelled':
      return 'Cancelada';
    default:
      return status;
  }
}

function getChannelLabel(channel?: string | null) {
  switch (channel) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'email':
      return 'E-mail';
    case 'pdf':
      return 'PDF';
    case 'manual':
      return 'Manual';
    case 'other':
      return 'Outro';
    default:
      return 'Não informado';
  }
}

function normalizeBrazilianWhatsApp(phone?: string | null) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  return digits.startsWith('55') ? digits : `55${digits}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function asMetadataText(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getSupplierQuotationContact(row?: SupplierContactRow | null): SupplierQuotationContact {
  if (!row) {
    return { phone: null, email: null };
  }

  const phone =
    row.commercial_whatsapp ||
    row.commercial_phone ||
    row.phone ||
    row.secondary_phone ||
    row.financial_phone ||
    row.fiscal_phone ||
    asMetadataText(row.metadata, 'commercial_whatsapp') ||
    asMetadataText(row.metadata, 'commercial_phone') ||
    asMetadataText(row.metadata, 'whatsapp') ||
    asMetadataText(row.metadata, 'phone') ||
    null;

  const email =
    row.commercial_email ||
    row.email ||
    row.financial_email ||
    row.fiscal_email ||
    asMetadataText(row.metadata, 'commercial_email') ||
    asMetadataText(row.metadata, 'email') ||
    asMetadataText(row.metadata, 'financial_email') ||
    asMetadataText(row.metadata, 'fiscal_email') ||
    null;

  return { phone, email };
}

function buildQuotationText(detail: PurchaseQuotationDetail) {
  if (detail.message_body?.trim()) {
    return detail.message_body;
  }

  const today = new Intl.DateTimeFormat('pt-BR').format(new Date());
  const lines = detail.items.map((item, index) => {
    const qty = Number(item.approved_qty ?? item.requested_qty ?? 0);
    const cost = item.quoted_unit_cost ?? item.reference_unit_cost;
    const costText = cost != null ? ` | referência/cotado: ${formatCurrency(cost)}` : '';

    return `${index + 1}. ${item.product_name} — ${qty} un.${costText}`;
  });

  return [
    'Olá, tudo bem?',
    '',
    'Solicito cotação/retorno para os itens abaixo.',
    '',
    `Fornecedor: ${detail.supplier_name}`,
    `Cotação: ${detail.quotation_code}`,
    `Data: ${today}`,
    '',
    'Produtos:',
    ...lines,
    '',
    'Por gentileza, confirmar preço unitário, disponibilidade, prazo de entrega, condição de pagamento e validade da proposta.',
    '',
    'Obrigado.',
  ].join('\n');
}

function buildQuotationPrintHtml(
  detail: PurchaseQuotationDetail,
  contact: SupplierQuotationContact,
  totalQuoted: number,
) {
  const rows = detail.items
    .map((item, index) => {
      const approvedQty = Number(item.approved_qty ?? item.requested_qty ?? 0);
      const quotedCost = item.quoted_unit_cost ?? item.reference_unit_cost ?? null;
      const total = approvedQty * Number(quotedCost ?? 0);

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.product_name)}</td>
          <td class="right">${item.requested_qty}</td>
          <td class="right">${approvedQty}</td>
          <td class="right">${formatCurrency(item.reference_unit_cost)}</td>
          <td class="right">${quotedCost == null ? '—' : formatCurrency(quotedCost)}</td>
          <td class="right">${formatCurrency(total)}</td>
          <td>${escapeHtml(item.supplier_notes || '')}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(detail.quotation_code)} - ${escapeHtml(detail.supplier_name)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; font-size: 13px; }
          .header { border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
          h1 { margin: 0; font-size: 22px; }
          .subtitle { margin-top: 6px; color: #475569; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
          .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
          .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
          .right { text-align: right; }
          .notes { margin-top: 20px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; color: #475569; }
          .footer { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
          .signature { border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center; color: #475569; }
          @media print { body { margin: 20mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Retorno de cotação</h1>
          <div class="subtitle">${escapeHtml(detail.quotation_code)} · ${escapeHtml(detail.supplier_name)}</div>
        </div>
        <div class="grid">
          <div class="box"><div class="label">Fornecedor</div><strong>${escapeHtml(detail.supplier_name)}</strong></div>
          <div class="box"><div class="label">Status</div>${escapeHtml(getQuotationStatusLabel(detail.status))}</div>
          <div class="box"><div class="label">Responsável</div>${escapeHtml(detail.responsible_name || 'Responsável pela cotação')}</div>
          <div class="box"><div class="label">Canal</div>${escapeHtml(getChannelLabel(detail.sent_channel))}</div>
          <div class="box"><div class="label">WhatsApp / telefone</div>${escapeHtml(contact.phone || 'Não informado')}</div>
          <div class="box"><div class="label">E-mail</div>${escapeHtml(contact.email || 'Não informado')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produto</th>
              <th class="right">Solicitado</th>
              <th class="right">Aprovado</th>
              <th class="right">Referência</th>
              <th class="right">Cotado</th>
              <th class="right">Total</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="notes">
          <strong>Total cotado estimado:</strong> ${formatCurrency(totalQuoted)}<br /><br />
          ${escapeHtml(detail.notes || 'Sem observações internas.')}
        </div>
        <div class="footer">
          <div class="signature">Responsável pela cotação</div>
          <div class="signature">Fornecedor</div>
        </div>
      </body>
    </html>
  `;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('Não foi possível copiar o texto.');
  }
}

export function PurchaseQuotationsPanel({ storeId }: PurchaseQuotationsPanelProps) {
  const [quotations, setQuotations] = useState<PurchaseQuotationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<PurchaseQuotationDetail | null>(null);
  const [detailDraft, setDetailDraft] = useState<PurchaseQuotationDetail | null>(null);
  const [supplierContact, setSupplierContact] = useState<SupplierQuotationContact>({
    phone: null,
    email: null,
  });
  const [openingDetail, setOpeningDetail] = useState(false);
  const [savingResponse, setSavingResponse] = useState(false);
  const [convertingToDraft, setConvertingToDraft] = useState(false);
  const [responseStatus, setResponseStatus] = useState<QuotationEditableStatus>('answered');
  const [sentChannel, setSentChannel] = useState<QuotationChannel>('');
  const [responsibleName, setResponsibleName] = useState('');
  const [quotationNotes, setQuotationNotes] = useState('');

  const navigate = useNavigate();

  const quotationText = useMemo(() => {
    if (!detailDraft) return '';
    return buildQuotationText(detailDraft);
  }, [detailDraft]);

  const whatsappNumber = normalizeBrazilianWhatsApp(supplierContact.phone);
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(quotationText)}`
    : null;
  const mailtoUrl = supplierContact.email
    ? `mailto:${supplierContact.email}?subject=${encodeURIComponent(
        `Solicitação de cotação - ${detailDraft?.supplier_name ?? ''}`,
      )}&body=${encodeURIComponent(quotationText)}`
    : null;

  async function loadQuotations() {
    if (!storeId) return;

    try {
      setLoading(true);
      const data = await stockService.getPurchaseQuotationsByStore(storeId, null);
      setQuotations(data);
    } catch (error) {
      console.error('Erro ao carregar cotações:', error);
      toast.error('Não foi possível carregar as cotações.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSupplierContact(supplierId: string) {
    const { data, error } = await supabase
      .from('suppliers')
      .select(`
        phone,
        email,
        secondary_phone,
        commercial_phone,
        commercial_whatsapp,
        commercial_email,
        financial_phone,
        financial_email,
        fiscal_phone,
        fiscal_email,
        metadata
      `)
      .eq('id', supplierId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar contato do fornecedor:', error);
      setSupplierContact({ phone: null, email: null });
      return;
    }

    setSupplierContact(getSupplierQuotationContact(data as SupplierContactRow | null));
  }

  async function handleOpenDetail(quotationId: string) {
    try {
      setOpeningDetail(true);
      const data = await stockService.getPurchaseQuotationDetail(quotationId);
      setDetail(data);
      setDetailDraft(data);
      setResponseStatus(
        ['draft', 'sent', 'answered', 'approved', 'rejected', 'cancelled'].includes(data.status)
          ? (data.status as QuotationEditableStatus)
          : 'answered',
      );
      setSentChannel((data.sent_channel as QuotationChannel) || '');
      setResponsibleName(data.responsible_name || 'Responsável pela cotação');
      setQuotationNotes(data.notes || '');
      await loadSupplierContact(data.supplier_id);
    } catch (error) {
      console.error('Erro ao abrir cotação:', error);
      toast.error('Não foi possível abrir a cotação.');
    } finally {
      setOpeningDetail(false);
    }
  }

  useEffect(() => {
    void loadQuotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  function closeDetail() {
    setDetail(null);
    setDetailDraft(null);
    setSupplierContact({ phone: null, email: null });
  }

  function updateDetailItem(
    itemId: string,
    patch: Partial<PurchaseQuotationDetail['items'][number]>,
  ) {
    setDetailDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      };
    });
  }

  function getDetailTotalQuoted() {
    if (!detailDraft) return 0;

    return detailDraft.items.reduce((total, item) => {
      const qty = Number(item.approved_qty ?? item.requested_qty ?? 0);
      const cost = Number(item.quoted_unit_cost ?? item.reference_unit_cost ?? 0);
      return total + qty * cost;
    }, 0);
  }

  async function handleCopyQuotationText() {
    if (!quotationText) return;

    try {
      await copyTextToClipboard(quotationText);
      toast.success('Texto da cotação copiado.');
    } catch (error) {
      console.error('Erro ao copiar texto:', error);
      toast.error('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.');
    }
  }

  function handlePrintQuotation() {
    if (!detailDraft) return;

    const html = buildQuotationPrintHtml(detailDraft, supplierContact, getDetailTotalQuoted());
    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  async function handleSaveResponse() {
    if (!detailDraft) return;

    try {
      setSavingResponse(true);

      await stockService.updatePurchaseQuotationResponse({
        quotationId: detailDraft.id,
        status: responseStatus,
        sentChannel: sentChannel || null,
        responsibleName,
        notes: quotationNotes,
        items: detailDraft.items.map((item) => ({
          id: item.id,
          quoted_unit_cost: item.quoted_unit_cost == null ? null : Number(item.quoted_unit_cost),
          approved_qty:
            item.approved_qty == null ? Number(item.requested_qty) : Number(item.approved_qty),
          supplier_notes: item.supplier_notes ?? null,
        })),
      });

      toast.success('Resposta da cotação salva.');

      const refreshed = await stockService.getPurchaseQuotationDetail(detailDraft.id);
      setDetail(refreshed);
      setDetailDraft(refreshed);
      setResponseStatus(
        ['draft', 'sent', 'answered', 'approved', 'rejected', 'cancelled'].includes(refreshed.status)
          ? (refreshed.status as QuotationEditableStatus)
          : 'answered',
      );
      setSentChannel((refreshed.sent_channel as QuotationChannel) || '');
      setResponsibleName(refreshed.responsible_name || 'Responsável pela cotação');
      setQuotationNotes(refreshed.notes || '');

      await loadQuotations();
    } catch (error) {
      console.error('Erro ao salvar resposta da cotação:', error);
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível salvar a resposta da cotação.',
      );
    } finally {
      setSavingResponse(false);
    }
  }

  async function handleConvertToDraft() {
    if (!detailDraft) return;

    try {
      setConvertingToDraft(true);

      await stockService.updatePurchaseQuotationResponse({
        quotationId: detailDraft.id,
        status: responseStatus === 'draft' || responseStatus === 'sent' ? 'approved' : responseStatus,
        sentChannel: sentChannel || null,
        responsibleName,
        notes: quotationNotes,
        items: detailDraft.items.map((item) => ({
          id: item.id,
          quoted_unit_cost: item.quoted_unit_cost == null ? null : Number(item.quoted_unit_cost),
          approved_qty:
            item.approved_qty == null ? Number(item.requested_qty) : Number(item.approved_qty),
          supplier_notes: item.supplier_notes ?? null,
        })),
      });

      const result = await stockService.convertPurchaseQuotationToDraft({
        quotationId: detailDraft.id,
        notes: `Rascunho criado a partir da cotação ${detailDraft.quotation_code}.`,
      });

      toast.success('Rascunho de compra criado a partir da cotação.');
      closeDetail();
      await loadQuotations();
      navigate(`/admin/stock/purchase-documents?open=${result.purchase_document_id}`);
    } catch (error) {
      console.error('Erro ao converter cotação em rascunho:', error);
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível converter a cotação em rascunho.',
      );
    } finally {
      setConvertingToDraft(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Cotações recentes</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Cotações salvas para consulta, retorno do fornecedor e futura conversão em compra.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadQuotations()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border">
        {quotations.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhuma cotação salva ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cotação</th>
                  <th className="px-4 py-3">Fornecedor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Itens</th>
                  <th className="px-4 py-3 text-right">Referência</th>
                  <th className="px-4 py-3">Criada em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {quotation.quotation_code}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{quotation.supplier_name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {getQuotationStatusLabel(quotation.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{quotation.items_count}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(quotation.total_reference)}</td>
                    <td className="px-4 py-3">{formatDateTime(quotation.requested_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={openingDetail}
                        onClick={() => void handleOpenDetail(quotation.id)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && detailDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{detail.quotation_code}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {detail.supplier_name} · {getQuotationStatusLabel(detail.status)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Total cotado estimado: {formatCurrency(getDetailTotalQuoted())}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDetail}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Criada em</div>
                  <div className="mt-1 font-semibold">{formatDateTime(detail.requested_at)}</div>
                </div>

                <label className="rounded-xl border bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Status</div>
                  <select
                    value={responseStatus}
                    onChange={(event) => setResponseStatus(event.target.value as QuotationEditableStatus)}
                    disabled={detail.status === 'converted'}
                    className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="sent">Enviada</option>
                    <option value="answered">Respondida</option>
                    <option value="approved">Aprovada</option>
                    <option value="rejected">Rejeitada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </label>

                <label className="rounded-xl border bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Canal</div>
                  <select
                    value={sentChannel}
                    onChange={(event) => setSentChannel(event.target.value as QuotationChannel)}
                    disabled={detail.status === 'converted'}
                    className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
                  >
                    <option value="">Não informado</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="pdf">PDF</option>
                    <option value="manual">Manual</option>
                    <option value="other">Outro</option>
                  </select>
                </label>

                <label className="rounded-xl border bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Responsável</div>
                  <input
                    value={responsibleName}
                    onChange={(event) => setResponsibleName(event.target.value)}
                    disabled={detail.status === 'converted'}
                    className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
                    placeholder="Responsável pela cotação"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-500">Contatos do fornecedor</div>
                    <div className="mt-1 text-sm text-slate-700">
                      WhatsApp/telefone: {supplierContact.phone || 'não informado'} · E-mail:{' '}
                      {supplierContact.email || 'não informado'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyQuotationText()}
                      className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintQuotation}
                      className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir/PDF
                    </button>

                    {mailtoUrl ? (
                      <a
                        href={mailtoUrl}
                        className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Mail className="h-4 w-4" />
                        E-mail
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Fornecedor sem e-mail cadastrado"
                        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-400 opacity-70"
                      >
                        <Mail className="h-4 w-4" />
                        E-mail indisponível
                      </button>
                    )}

                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Fornecedor sem WhatsApp/telefone cadastrado"
                        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 opacity-70"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp indisponível
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Produto</th>
                        <th className="px-4 py-3 text-right">Solicitado</th>
                        <th className="px-4 py-3 text-right">Referência</th>
                        <th className="px-4 py-3 text-right">Preço cotado</th>
                        <th className="px-4 py-3 text-right">Qtd. aprovada</th>
                        <th className="px-4 py-3">Obs. fornecedor</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {detailDraft.items.map((item) => {
                        const approvedQty = Number(item.approved_qty ?? item.requested_qty ?? 0);
                        const quotedCost = Number(item.quoted_unit_cost ?? item.reference_unit_cost ?? 0);
                        const total = approvedQty * quotedCost;

                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-medium text-slate-800">{item.product_name}</td>
                            <td className="px-4 py-3 text-right">{item.requested_qty}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(item.reference_unit_cost)}</td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.quoted_unit_cost ?? ''}
                                onChange={(event) =>
                                  updateDetailItem(item.id, {
                                    quoted_unit_cost:
                                      event.target.value === '' ? null : Number(event.target.value),
                                  })
                                }
                                disabled={detail.status === 'converted'}
                                className="w-28 rounded-lg border px-2 py-1 text-right text-sm"
                                placeholder="0,00"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.approved_qty ?? item.requested_qty}
                                onChange={(event) =>
                                  updateDetailItem(item.id, {
                                    approved_qty: event.target.value === '' ? 0 : Number(event.target.value),
                                  })
                                }
                                disabled={detail.status === 'converted'}
                                className="w-24 rounded-lg border px-2 py-1 text-right text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={item.supplier_notes ?? ''}
                                onChange={(event) =>
                                  updateDetailItem(item.id, {
                                    supplier_notes: event.target.value,
                                  })
                                }
                                disabled={detail.status === 'converted'}
                                className="w-full rounded-lg border px-2 py-1 text-sm"
                                placeholder="Ex.: sem estoque, entrega parcial..."
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <label className="mt-4 block">
                <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Observações internas</div>
                <textarea
                  value={quotationNotes}
                  onChange={(event) => setQuotationNotes(event.target.value)}
                  disabled={detail.status === 'converted'}
                  className="min-h-[90px] w-full rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700"
                  placeholder="Ex.: fornecedor confirmou entrega para sexta-feira..."
                />
              </label>

              {detail.message_body && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Mensagem salva</div>
                  <textarea
                    readOnly
                    value={detail.message_body}
                    className="min-h-[180px] w-full rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t p-5">
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>

              {detail.status !== 'converted' && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSaveResponse()}
                    disabled={savingResponse}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {savingResponse ? 'Salvando...' : 'Salvar resposta'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleConvertToDraft()}
                    disabled={convertingToDraft}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {convertingToDraft ? 'Convertendo...' : 'Converter em rascunho'}
                  </button>
                </>
              )}

              {detail.converted_purchase_document_id && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/admin/stock/purchase-documents?open=${detail.converted_purchase_document_id}`)
                  }
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir compra
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
