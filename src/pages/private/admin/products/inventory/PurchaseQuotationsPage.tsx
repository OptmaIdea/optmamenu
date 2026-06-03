import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    Copy,
    Download,
    Eye,
    ExternalLink,
    FileText,
    Mail,
    MessageCircle,
    Plus,
    Printer,
    Save,
    Search,
    X,
    XCircle,
} from 'lucide-react';
import {
    formatDateTimeForExportPtBr,
    formatDateTimePtBr,
    getLocalDateInputValue,
    toAppDate,
} from '@/utils/dateTime';
import OperationalTimeline from './components/OperationalTimeline';
import { useOperationalTimeline } from './hooks/useOperationalTimeline';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/empty-state/EmptyState';
import { supabase } from '@/lib/supabase';
import { stockService } from '@/services/stockService';
import type { PurchaseQuotationDetail, PurchaseQuotationSummary } from '@/services/stockService';
import type { Supplier } from '@/pages/private/admin/products/suppliers/types/supplier.types';
import { useInventory } from '@/pages/private/admin/products/inventory/hooks/useInventory';
import { buildCsv, downloadCsv, formatCsvNumberBR } from '@/utils/csv';
import { isSupplierPurchaseEligible } from './utils/supplierStatusUtils';
import { getActiveStoreId } from '@/utils/activeStore';

/* type StoreLike = { id: string }; */

type SupplierContact = {
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

type QuotationEditableStatus =
    | 'draft'
    | 'sent'
    | 'answered'
    | 'approved'
    | 'rejected'
    | 'cancelled';

type QuotationChannel = 'whatsapp' | 'email' | 'pdf' | 'manual' | 'other' | '';

type InventoryProductLike = {
    id: string;
    name: string;
    active?: boolean | null;
    discontinued?: boolean | null;
    is_discontinued?: boolean | null;
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
    return formatDateTimePtBr(value, '—');
}

function formatCurrency(value?: number | null) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number(value ?? 0));
}

function shortId(value?: string | null) {
    if (!value) return '—';
    return value.slice(0, 8);
}

function formatDateTimeCsv(value?: string | null) {
    return formatDateTimeForExportPtBr(value, '');
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

function asMetadataText(metadata: Record<string, unknown> | null | undefined, key: string) {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getSupplierPhone(contact: SupplierContact | null) {
    if (!contact) return null;

    return (
        contact.commercial_whatsapp ||
        contact.commercial_phone ||
        contact.phone ||
        contact.secondary_phone ||
        contact.financial_phone ||
        contact.fiscal_phone ||
        asMetadataText(contact.metadata, 'commercial_whatsapp') ||
        asMetadataText(contact.metadata, 'commercial_phone') ||
        asMetadataText(contact.metadata, 'whatsapp') ||
        asMetadataText(contact.metadata, 'phone') ||
        null
    );
}

function getSupplierEmail(contact: SupplierContact | null) {
    if (!contact) return null;

    return (
        contact.commercial_email ||
        contact.email ||
        contact.financial_email ||
        contact.fiscal_email ||
        asMetadataText(contact.metadata, 'commercial_email') ||
        asMetadataText(contact.metadata, 'email') ||
        asMetadataText(contact.metadata, 'financial_email') ||
        asMetadataText(contact.metadata, 'fiscal_email') ||
        null
    );
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

function buildQuotationText(detail: PurchaseQuotationDetail) {
    if (detail.message_body?.trim()) {
        return detail.message_body;
    }

    const today = getLocalDateInputValue().split('-').reverse().join('/');
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
    contact: SupplierContact | null,
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
          <div class="box"><div class="label">Status</div>${escapeHtml(getStatusLabel(detail.status))}</div>
          <div class="box"><div class="label">Responsável</div>${escapeHtml(detail.responsible_name || 'Responsável pela cotação')}</div>
          <div class="box"><div class="label">Canal</div>${escapeHtml(getChannelLabel(detail.sent_channel))}</div>
          <div class="box"><div class="label">WhatsApp / telefone</div>${escapeHtml(getSupplierPhone(contact) || 'Não informado')}</div>
          <div class="box"><div class="label">E-mail</div>${escapeHtml(getSupplierEmail(contact) || 'Não informado')}</div>
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

export default function PurchaseQuotationsPage() {
    const navigate = useNavigate();

    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setPortalContainer(document.getElementById('quick-access-actions-portal'));
    }, []);

    const { products: inventoryProducts } = useInventory();
    const [storeId, setStoreId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [quotations, setQuotations] = useState<PurchaseQuotationSummary[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [quotationProductIds, setQuotationProductIds] = useState<Record<string, string[]>>({});
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        status: '',
        supplierId: '',
        productId: '',
        document: '',
    });
    const [detail, setDetail] = useState<PurchaseQuotationDetail | null>(null);
    const [detailDraft, setDetailDraft] = useState<PurchaseQuotationDetail | null>(null);
    const [supplierContact, setSupplierContact] = useState<SupplierContact | null>(null);
    const [detailMessage, setDetailMessage] = useState('');
    const [openingDetail, setOpeningDetail] = useState(false);
    const [savingResponse, setSavingResponse] = useState(false);
    const [, setConvertingToDraft] = useState(false);
    const [responseStatus, setResponseStatus] = useState<QuotationEditableStatus>('answered');
    const [sentChannel, setSentChannel] = useState<QuotationChannel>('');
    const [responsibleName, setResponsibleName] = useState('');
    const [quotationNotes, setQuotationNotes] = useState('');
    const [manualQuotationOpen, setManualQuotationOpen] = useState(false);
    const [savingManualQuotation, setSavingManualQuotation] = useState(false);
    const [manualSupplierId, setManualSupplierId] = useState('');
    const [manualResponsibleName, setManualResponsibleName] = useState('Responsável pela cotação');
    const [manualSentChannel, setManualSentChannel] = useState<QuotationChannel>('manual');
    const [manualNotes, setManualNotes] = useState('');
    const [manualItems, setManualItems] = useState<Array<{ productId: string; quantity: number; unitCost: number | null }>>([
        { productId: '', quantity: 1, unitCost: null },
    ]);

    const {
        events: quotationTimelineEvents,
        loading: loadingQuotationTimeline,
        refetch: refetchQuotationTimeline,
    } = useOperationalTimeline({
        enabled: Boolean(detail?.id),
        storeId,
        entityType: 'purchase_quotation',
        relatedPurchaseQuotationId: detail?.id ?? null,
        limit: 30,
    });

    const products = useMemo(() => {
        return ((inventoryProducts ?? []) as InventoryProductLike[])
            .filter((product) => (
                product.active !== false &&
                product.discontinued !== true &&
                product.is_discontinued !== true
            ))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [inventoryProducts]);


    const eligibleSuppliers = useMemo(
        () => suppliers.filter(isSupplierPurchaseEligible),
        [suppliers],
    );

    async function loadQuotations(nextStoreId = storeId, options?: { silent?: boolean }) {
        if (!nextStoreId) return;

        try {
            if (!options?.silent) setLoading(true);

            const data = await stockService.getPurchaseQuotationsByStore(nextStoreId, null);
            setQuotations(data);
        } catch (error) {
            console.error('Erro ao carregar cotações:', error);
            toast.error('Não foi possível carregar as cotações.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const run = async () => {
            const activeStoreId = getActiveStoreId();
            setStoreId(activeStoreId);

            if (activeStoreId) {
                await loadQuotations(activeStoreId);
            } else {
                setLoading(false);
            }
        };

        void run();
    }, []);

    useEffect(() => {
        if (!storeId) return;
        void loadQuotations(storeId);
    }, [storeId]);

    useEffect(() => {
        if (!storeId) return;

        const run = async () => {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('store_id', storeId)
                .order('name', { ascending: true });

            if (error) {
                console.error('Erro ao carregar fornecedores:', error);
                return;
            }

            setSuppliers((data as Supplier[]) ?? []);
        };

        void run();
    }, [storeId]);

    useEffect(() => {
        if (!filters.productId || quotations.length === 0) return;

        const missing = quotations.filter((quotation) => !quotationProductIds[quotation.id]);
        if (missing.length === 0) return;

        const run = async () => {
            const entries = await Promise.all(
                missing.map(async (quotation) => {
                    try {
                        const detail = await stockService.getPurchaseQuotationDetail(quotation.id);
                        return [quotation.id, detail.items.map((item) => item.product_id)] as const;
                    } catch (error) {
                        console.error('Erro ao carregar itens da cotação:', error);
                        return [quotation.id, []] as const;
                    }
                }),
            );

            setQuotationProductIds((current) => ({ ...current, ...Object.fromEntries(entries) }));
        };

        void run();
    }, [filters.productId, quotationProductIds, quotations]);

    const filteredQuotations = useMemo(() => {
        return quotations.filter((quotation) => {
            const requestedAt = toAppDate(quotation.requested_at);

            if (filters.dateFrom) {
                const from = new Date(`${filters.dateFrom}T00:00:00`);
                if (!requestedAt || requestedAt < from) return false;
            }

            if (filters.dateTo) {
                const to = new Date(`${filters.dateTo}T23:59:59`);
                if (!requestedAt || requestedAt > to) return false;
            }

            if (filters.status && quotation.status !== filters.status) return false;
            if (filters.supplierId && quotation.supplier_id !== filters.supplierId) return false;

            if (filters.productId) {
                const ids = quotationProductIds[quotation.id] ?? [];
                if (!ids.includes(filters.productId)) return false;
            }

            if (!filters.document.trim()) return true;

            const term = filters.document.trim().toLowerCase();
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
    }, [filters, quotationProductIds, quotations]);

    const totals = useMemo(() => {
        return {
            count: filteredQuotations.length,
            totalReference: filteredQuotations.reduce((sum, row) => sum + Number(row.total_reference ?? 0), 0),
            sent: filteredQuotations.filter((row) => row.status === 'sent').length,
        };
    }, [filteredQuotations]);

    const clearFilters = useCallback(() => {
        setFilters({
            dateFrom: '',
            dateTo: '',
            status: '',
            supplierId: '',
            productId: '',
            document: '',
        });
    }, []);

    const productName = useCallback(
        (id: string) => products.find((product) => product.id === id)?.name ?? id,
        [products],
    );

    const exportFilteredQuotationsCsv = useCallback(() => {
        if (!filteredQuotations.length) return;

        const rows = filteredQuotations.map((quotation) => ({
            'Nº interno': shortId(quotation.id),
            'Cotação': quotation.quotation_code,
            'Status': getStatusLabel(quotation.status),
            'Fornecedor': quotation.supplier_name || '—',
            'Itens': quotation.items_count,
            'Total referência (R$)': formatCsvNumberBR(quotation.total_reference ?? 0),
            'Total cotado (R$)': formatCsvNumberBR(quotation.total_quoted ?? 0),
            'Criada em': quotation.requested_at_display ?? formatDateTimeCsv(quotation.requested_at),
            'Respondida em': quotation.responded_at_display ?? formatDateTimeCsv(quotation.responded_at),
            'Canal': getChannelLabel(quotation.sent_channel),
            'Responsável': quotation.responsible_name || '—',
            'Produto filtrado': filters.productId ? productName(filters.productId) : '',
            'Compra gerada': shortId(quotation.converted_purchase_document_id),
            'Observações': quotation.notes ?? '',
        }));

        const csv = buildCsv(rows, [
            'Nº interno',
            'Cotação',
            'Status',
            'Fornecedor',
            'Itens',
            'Total referência (R$)',
            'Total cotado (R$)',
            'Criada em',
            'Respondida em',
            'Canal',
            'Responsável',
            'Produto filtrado',
            'Compra gerada',
            'Observações',
        ]);

        const dateSuffix = getLocalDateInputValue();
        downloadCsv(`cotacoes_compra_${dateSuffix}.csv`, csv);
    }, [filteredQuotations, filters.productId, productName]);

    async function openDetail(quotationId: string) {
        try {
            setOpeningDetail(true);
            const data = await stockService.getPurchaseQuotationDetail(quotationId);
            setDetail(data);
            setDetailDraft(data);
            setDetailMessage(data.message_body || buildQuotationText(data));
            setResponseStatus(
                ['draft', 'sent', 'answered', 'approved', 'rejected', 'cancelled'].includes(data.status)
                    ? (data.status as QuotationEditableStatus)
                    : 'answered',
            );
            setSentChannel((data.sent_channel as QuotationChannel) || '');
            setResponsibleName(data.responsible_name || 'Responsável pela cotação');
            setQuotationNotes(data.notes || '');

            const { data: supplierData, error } = await supabase
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
        if (!detailDraft) return;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            toast.error('Não foi possível abrir a janela de impressão.');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(buildQuotationPrintHtml(detailDraft, supplierContact, getDetailTotalQuoted()));
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
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

    function closeDetail() {
        setDetail(null);
        setDetailDraft(null);
        setSupplierContact(null);
        setDetailMessage('');
    }

    async function saveQuotationResponse() {
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
            setDetailMessage(refreshed.message_body || buildQuotationText(refreshed));
            await refetchQuotationTimeline();
            await loadQuotations(storeId, { silent: true });

            const wasApprovedNow =
                detail?.status !== 'approved' &&
                refreshed.status === 'approved';

            if (wasApprovedNow) {
                const shouldConvert = window.confirm(
                    'Cotação aprovada com sucesso.\n\nDeseja converter esta cotação em rascunho de compra agora?',
                );

                if (shouldConvert) {
                    await convertQuotationToPurchase(detailDraft.id);
                    return;
                }

                // Se aprovou mas não quis converter agora, fecha o modal para liberar a lista
                closeDetail();
            }
        } catch (error) {
            console.error('Erro ao salvar resposta da cotação:', error);
            toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a resposta da cotação.');
        } finally {
            setSavingResponse(false);
        }
    }

    async function convertQuotationToPurchase(quotationId: string) {
        try {
            setConvertingToDraft(true);
            const result = await stockService.convertPurchaseQuotationToDraft({
                quotationId,
                notes: 'Rascunho criado a partir de cotação.',
            });

            toast.success('Rascunho de compra criado a partir da cotação.');

            if (detail && detail.id === quotationId) {
                closeDetail();
            }

            await loadQuotations(storeId, { silent: true });
            navigate(`/admin/stock/purchase-documents?open=${result.purchase_document_id}`);
        } catch (error) {
            console.error('Erro ao converter cotação em rascunho:', error);
            toast.error(error instanceof Error ? error.message : 'Não foi possível converter a cotação em rascunho.');
        } finally {
            setConvertingToDraft(false);
        }
    }

    function closeManualQuotationModal() {
        setManualQuotationOpen(false);
        setManualSupplierId('');
        setManualResponsibleName('Responsável pela cotação');
        setManualSentChannel('manual');
        setManualNotes('');
        setManualItems([{ productId: '', quantity: 1, unitCost: null }]);
    }

    function updateManualItem(
        index: number,
        patch: Partial<{ productId: string; quantity: number; unitCost: number | null }>,
    ) {
        setManualItems((current) =>
            current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
        );
    }

    function removeManualItem(index: number) {
        setManualItems((current) =>
            current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index),
        );
    }

    function getManualQuotationText() {
        const supplier = eligibleSuppliers.find((item) => item.id === manualSupplierId);
        const selectedItems = manualItems
            .filter((item) => item.productId && Number(item.quantity) > 0)
            .map((item, index) => {
                const product = products.find((productItem) => productItem.id === item.productId);
                const costText =
                    item.unitCost != null && Number(item.unitCost) > 0
                        ? ` | referência: ${formatCurrency(Number(item.unitCost))}`
                        : '';

                return `${index + 1}. ${product?.name ?? item.productId} — ${Number(item.quantity)} un.${costText}`;
            });

        return [
            'Olá, tudo bem?',
            '',
            'Solicito cotação para os itens abaixo.',
            '',
            `Fornecedor: ${supplier?.name ?? 'Fornecedor selecionado'}`,
            `Data: ${getLocalDateInputValue().split('-').reverse().join('/')}`,
            '',
            'Produtos:',
            ...selectedItems,
            '',
            'Por gentileza, informar preço unitário, disponibilidade, prazo de entrega, condição de pagamento e validade da proposta.',
            '',
            'Obrigado.',
        ].join('\n');
    }

    const canSaveManualQuotation =
        Boolean(manualSupplierId) &&
        manualItems.some((item) => item.productId && Number(item.quantity) > 0);

    async function saveManualQuotation() {
        if (!canSaveManualQuotation) {
            toast.error('Selecione um fornecedor e ao menos um produto com quantidade.');
            return;
        }

        try {
            setSavingManualQuotation(true);

            const supplier = eligibleSuppliers.find((item) => item.id === manualSupplierId);
            const result = await stockService.createPurchaseQuotation({
                supplierId: manualSupplierId,
                items: manualItems
                    .filter((item) => item.productId && Number(item.quantity) > 0)
                    .map((item) => ({
                        product_id: item.productId,
                        quantity: Number(item.quantity),
                        unit_cost: item.unitCost == null ? null : Number(item.unitCost),
                    })),
                messageSubject: `Solicitação de cotação - ${supplier?.name ?? 'Fornecedor'}`,
                messageBody: getManualQuotationText(),
                sentChannel: manualSentChannel || null,
                responsibleName: manualResponsibleName || 'Responsável pela cotação',
                notes: manualNotes || 'Cotação criada manualmente pela central de cotações.',
            });

            toast.success(`Cotação ${result.quotation_code} criada.`);
            closeManualQuotationModal();
            await loadQuotations(storeId, { silent: true });
            await openDetail(result.quotation_id);
        } catch (error) {
            console.error('Erro ao criar cotação manual:', error);
            toast.error(error instanceof Error ? error.message : 'Não foi possível criar a cotação.');
        } finally {
            setSavingManualQuotation(false);
        }
    }

    const email = getSupplierEmail(supplierContact);
    const whatsapp = normalizePhone(getSupplierPhone(supplierContact));

    if (loading) return <LoadingSpinner />;

    return (
        <>
            {portalContainer && createPortal(
                <button
                    type="button"
                    onClick={() => setManualQuotationOpen(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#21A896] hover:bg-[#1a867a] text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
                >
                    <Plus size={13} />
                    <span>Nova Cotação</span>
                </button>,
                portalContainer
            )}

            <PageContainer
                title="Cotações"
                subtitle="Acesso rápido às cotações salvas para fornecedores."
                category="Produtos"
                icon={<FileText size={28} className="text-[#21A896]" />}
                onRefresh={() => loadQuotations(storeId, { silent: true })}
                flat
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

            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                    Consulte cotações salvas, registre retornos e converta em rascunhos de compra.
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setManualQuotationOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                        <Plus className="h-4 w-4" />
                        Nova cotação
                    </button>

                    <button
                        type="button"
                        onClick={exportFilteredQuotationsCsv}
                        disabled={!filteredQuotations.length}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <Download className="h-4 w-4" />
                        Exportar CSV
                    </button>
                    <div className="hidden">
                        <label className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                value={filters.document}
                                onChange={(event) => setFilters((current) => ({ ...current, document: event.target.value }))}
                                placeholder="Buscar por código, fornecedor, responsável ou observação"
                                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            />
                        </label>

                        <select
                            value={filters.status}
                            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
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
            </div>

            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Filtros</div>
                        <div className="text-xs text-gray-500">Combine data, status, fornecedor, produto e cotação.</div>
                    </div>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    >
                        <XCircle className="h-4 w-4" />
                        Limpar filtros
                    </button>
                </div>

                <div className="grid gap-3 md:grid-cols-6">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">Data inicial</span>
                        <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">Data final</span>
                        <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">Status</span>
                        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.value ? option.label : 'Todos'}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">Fornecedor</span>
                        <select value={filters.supplierId} onChange={(event) => setFilters((current) => ({ ...current, supplierId: event.target.value }))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                            <option value="">Todos</option>
                            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">Produto</span>
                        <select value={filters.productId} onChange={(event) => setFilters((current) => ({ ...current, productId: event.target.value }))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                            <option value="">Todos</option>
                            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">Documento / Cotação</span>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input value={filters.document} onChange={(event) => setFilters((current) => ({ ...current, document: event.target.value }))} placeholder="Ex: COT-123" className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                        </div>
                    </label>
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
                                            {quotation.requested_at_display ?? formatDateTime(quotation.requested_at)}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    disabled={openingDetail}
                                                    onClick={() => void openDetail(quotation.id)}
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                                    title="Abrir cotação"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>

                                                {quotation.status === 'approved' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void convertQuotationToPurchase(quotation.id)}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                                                        title="Converter em rascunho de compra"
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </button>
                                                )}

                                                {quotation.status === 'converted' && quotation.converted_purchase_document_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            navigate(
                                                                `/admin/stock/purchase-documents?open=${quotation.converted_purchase_document_id}`,
                                                            )
                                                        }
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                                                        title="Abrir compra"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {manualQuotationOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
                    <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-950">
                        <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nova cotação</h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                                    Crie uma cotação manual sem depender das sugestões de compra.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeManualQuotationModal}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                                aria-label="Fechar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="max-h-[75vh] overflow-y-auto p-5">
                            <div className="grid gap-3 md:grid-cols-4">
                                <label className="md:col-span-2">
                                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Fornecedor aprovado</span>
                                    <select
                                        value={manualSupplierId}
                                        onChange={(event) => setManualSupplierId(event.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    >
                                        <option value="">Selecione</option>
                                        {eligibleSuppliers.map((supplier) => (
                                            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Canal</span>
                                    <select
                                        value={manualSentChannel}
                                        onChange={(event) => setManualSentChannel(event.target.value as QuotationChannel)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    >
                                        <option value="manual">Manual</option>
                                        <option value="whatsapp">WhatsApp</option>
                                        <option value="email">E-mail</option>
                                        <option value="pdf">PDF</option>
                                        <option value="other">Outro</option>
                                    </select>
                                </label>

                                <label>
                                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Responsável</span>
                                    <input
                                        value={manualResponsibleName}
                                        onChange={(event) => setManualResponsibleName(event.target.value)}
                                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                        placeholder="Responsável pela cotação"
                                    />
                                </label>
                            </div>

                            <div className="mt-5 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-900/60">
                                    <div className="col-span-5">Produto</div>
                                    <div className="col-span-2 text-right">Quantidade</div>
                                    <div className="col-span-3 text-right">Custo referência</div>
                                    <div className="col-span-2 text-right">Ações</div>
                                </div>

                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {manualItems.map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                                            <div className="col-span-5">
                                                <select
                                                    value={item.productId}
                                                    onChange={(event) => updateManualItem(index, { productId: event.target.value })}
                                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                                >
                                                    <option value="">Selecione</option>
                                                    {products.map((product) => (
                                                        <option key={product.id} value={product.id}>{product.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={item.quantity}
                                                    onChange={(event) => updateManualItem(index, { quantity: Number(event.target.value) })}
                                                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-right text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                                />
                                            </div>

                                            <div className="col-span-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.unitCost ?? ''}
                                                    onChange={(event) =>
                                                        updateManualItem(index, {
                                                            unitCost: event.target.value === '' ? null : Number(event.target.value),
                                                        })
                                                    }
                                                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-right text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                                    placeholder="0,00"
                                                />
                                            </div>

                                            <div className="col-span-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => removeManualItem(index)}
                                                    disabled={manualItems.length <= 1}
                                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setManualItems((current) => [...current, { productId: '', quantity: 1, unitCost: null }])}
                                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                <Plus className="h-4 w-4" />
                                Adicionar item
                            </button>

                            <label className="mt-4 block">
                                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Observações internas</span>
                                <textarea
                                    value={manualNotes}
                                    onChange={(event) => setManualNotes(event.target.value)}
                                    className="min-h-[90px] w-full rounded-2xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                                    placeholder="Ex.: cotação criada por pedido do gerente, reposição especial..."
                                />
                            </label>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 p-5 dark:border-gray-800">
                            <button
                                type="button"
                                onClick={closeManualQuotationModal}
                                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => void saveManualQuotation()}
                                disabled={!canSaveManualQuotation || savingManualQuotation}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                <Save className="h-4 w-4" />
                                {savingManualQuotation ? 'Salvando...' : 'Salvar cotação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {detail && detailDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
                    <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-950">
                        <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{detail.quotation_code}</h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                                    {detail.supplier_name} · {getStatusLabel(detail.status)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                                    Total cotado estimado: {formatCurrency(getDetailTotalQuoted())}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeDetail}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                                aria-label="Fechar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="max-h-[75vh] overflow-y-auto p-5">
                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="rounded-xl border bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Criada em</div>
                                    <div className="mt-1 font-semibold dark:text-white">{detail.requested_at_display ?? formatDateTime(detail.requested_at)}</div>
                                </div>

                                <label className="rounded-xl border bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Status</div>
                                    <select
                                        value={responseStatus}
                                        onChange={(event) => setResponseStatus(event.target.value as QuotationEditableStatus)}
                                        disabled={detail.status === 'converted'}
                                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    >
                                        <option value="draft">Rascunho</option>
                                        <option value="sent">Enviada</option>
                                        <option value="answered">Respondida</option>
                                        <option value="approved">Aprovada</option>
                                        <option value="rejected">Rejeitada</option>
                                        <option value="cancelled">Cancelada</option>
                                    </select>
                                </label>

                                <label className="rounded-xl border bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Canal</div>
                                    <select
                                        value={sentChannel}
                                        onChange={(event) => setSentChannel(event.target.value as QuotationChannel)}
                                        disabled={detail.status === 'converted'}
                                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    >
                                        <option value="">Não informado</option>
                                        <option value="whatsapp">WhatsApp</option>
                                        <option value="email">E-mail</option>
                                        <option value="pdf">PDF</option>
                                        <option value="manual">Manual</option>
                                        <option value="other">Outro</option>
                                    </select>
                                </label>

                                <label className="rounded-xl border bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Responsável</div>
                                    <input
                                        value={responsibleName}
                                        onChange={(event) => setResponsibleName(event.target.value)}
                                        disabled={detail.status === 'converted'}
                                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                        placeholder="Responsável pela cotação"
                                    />
                                </label>
                            </div>

                            <div className="mt-4 rounded-2xl border bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Contatos do fornecedor</div>
                                        <div className="mt-1 text-sm text-slate-700 dark:text-gray-300">
                                            WhatsApp/telefone: {getSupplierPhone(supplierContact) || 'não informado'} · E-mail:{' '}
                                            {getSupplierEmail(supplierContact) || 'não informado'}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void copyDetailMessage()}
                                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                                        >
                                            <Copy className="h-4 w-4" />
                                            Copiar
                                        </button>

                                        <button
                                            type="button"
                                            onClick={printDetail}
                                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                                        >
                                            <Printer className="h-4 w-4" />
                                            Imprimir/PDF
                                        </button>

                                        {email ? (
                                            <a
                                                href={`mailto:${email}?subject=${encodeURIComponent(
                                                    detail.message_subject || `Cotação ${detail.quotation_code}`,
                                                )}&body=${encodeURIComponent(detailMessage)}`}
                                                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                                            >
                                                <Mail className="h-4 w-4" />
                                                E-mail
                                            </a>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                title="Fornecedor sem e-mail cadastrado"
                                                className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-400 opacity-70 dark:border-gray-700 dark:bg-gray-950"
                                            >
                                                <Mail className="h-4 w-4" />
                                                E-mail indisponível
                                            </button>
                                        )}

                                        {whatsapp ? (
                                            <a
                                                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(detailMessage)}`}
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
                                                className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 opacity-70 dark:bg-gray-800 dark:text-gray-400"
                                            >
                                                <MessageCircle className="h-4 w-4" />
                                                WhatsApp indisponível
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <OperationalTimeline
                                compact
                                className="mt-4"
                                title="Andamento da cotação"
                                description="Histórico operacional desta cotação, incluindo criação, envio, resposta, aprovação e conversão."
                                emptyTitle="Nenhum andamento registrado"
                                emptyDescription="Os eventos desta cotação aparecerão aqui conforme o fluxo for executado."
                                events={quotationTimelineEvents}
                                loading={loadingQuotationTimeline}
                                onRefresh={() => void refetchQuotationTimeline()}
                            />

                            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[980px] text-sm">
                                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-gray-900">
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

                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                            {detailDraft.items.map((item) => {
                                                const approvedQty = Number(item.approved_qty ?? item.requested_qty ?? 0);
                                                const quotedCost = Number(item.quoted_unit_cost ?? item.reference_unit_cost ?? 0);
                                                const total = approvedQty * quotedCost;

                                                return (
                                                    <tr key={item.id} className="dark:text-gray-300">
                                                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{item.product_name}</td>
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
                                                                className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-950"
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
                                                                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-950"
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
                                                                className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
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
                                <div className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Observações internas</div>
                                <textarea
                                    value={quotationNotes}
                                    onChange={(event) => setQuotationNotes(event.target.value)}
                                    disabled={detail.status === 'converted'}
                                    className="min-h-[90px] w-full rounded-2xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                                    placeholder="Ex.: fornecedor confirmou entrega para sexta-feira..."
                                />
                            </label>

                            {detail.message_body && (
                                <div className="mt-4">
                                    <div className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">Mensagem salva</div>
                                    <textarea
                                        readOnly
                                        value={detail.message_body}
                                        className="min-h-[180px] w-full rounded-2xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 p-5 dark:border-gray-800">
                            <button
                                type="button"
                                onClick={closeDetail}
                                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                            >
                                Fechar
                            </button>

                            {detail.status !== 'converted' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => void saveQuotationResponse()}
                                        disabled={savingResponse}
                                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        <Save className="h-4 w-4" />
                                        {savingResponse ? 'Salvando...' : 'Salvar resposta'}
                                    </button>
                                </>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
        </>
    );
}
