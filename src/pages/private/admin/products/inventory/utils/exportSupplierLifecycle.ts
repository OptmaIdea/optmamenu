import {
    formatCurrencyPtBr,
    formatNumberPtBr,
} from '@/utils/export/formatters';

import { formatDateTimePtBr, formatDateOnlyPtBr } from '@/utils/dateTime';
import { downloadCsv } from '@/utils/export/csv';

import type {
    Supplier360Summary,
    SupplierContactRow,
    SupplierPriceEvolutionRow,
    SupplierPurchaseHistoryRow,
    SupplierQuotationHistoryRow,
    SupplierRelationshipTimelineRow,
    SupplierSuppliedProductRow,
    SupplierUnifiedTimelineRow,
} from '../types/supplierLifecycle.types';

const homologationLabelMap: Record<string, string> = {
    not_evaluated: 'Não avaliado',
    approved: 'Aprovado',
    pending: 'Pendente',
    rejected: 'Rejeitado',
    blocked: 'Bloqueado',
};

const purchaseStatusLabelMap: Record<string, string> = {
    draft: 'Rascunho',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
};

const departmentLabelMap: Record<string, string> = {
    commercial: 'Comercial',
    financial: 'Financeiro',
    fiscal: 'Fiscal',
    logistics: 'Logística',
    support: 'Suporte',
    other: 'Outro',
};

const eventTypeLabelMap: Record<string, string> = {
    note: 'Observação',
    call: 'Ligação',
    email: 'E-mail',
    meeting: 'Reunião',
    negotiation: 'Negociação',
    incident: 'Incidente',
    complaint: 'Reclamação',
    follow_up: 'Follow-up',
    homologation: 'Homologação',
    block: 'Bloqueio',
    unblock: 'Desbloqueio',
    document: 'Documento',
    other: 'Outro',
};

const severityLabelMap: Record<string, string> = {
    info: 'Informativo',
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
    critical: 'Crítico',
};

const relationshipStatusLabelMap: Record<string, string> = {
    open: 'Aberto',
    done: 'Concluído',
    archived: 'Arquivado',
    cancelled: 'Cancelado',
};

function safeFilePart(value: string | null | undefined) {
    return (value || 'fornecedor')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();
}

type ExportSupplierLifecycleInput = {
    summary: Supplier360Summary;
    purchases: SupplierPurchaseHistoryRow[];
    products: SupplierSuppliedProductRow[];
    prices: SupplierPriceEvolutionRow[];
    quotations: SupplierQuotationHistoryRow[];
    contacts: SupplierContactRow[];
    timeline: SupplierRelationshipTimelineRow[];
    unifiedTimeline: SupplierUnifiedTimelineRow[];
};

export function exportSupplierLifecycleCsv({
    summary,
    purchases,
    products,
    prices,
    quotations,
    contacts,
    timeline,
    unifiedTimeline,
}: ExportSupplierLifecycleInput) {
    const filenameBase = `vida_fornecedor_${safeFilePart(
        summary.trade_name || summary.name
    )}_${new Date().toISOString().slice(0, 10)}`;

    const rows: Record<string, string | number>[] = [];

    rows.push({
        Seção: 'Resumo',
        Campo: 'Fornecedor',
        Valor: summary.trade_name || summary.name,
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Razão social',
        Valor: summary.legal_name || '',
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Documento',
        Valor: summary.document || '',
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Status de homologação',
        Valor:
            homologationLabelMap[
            summary.blocked ? 'blocked' : summary.homologation_status
            ] ?? summary.homologation_status,
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Fornecedor preferencial',
        Valor: summary.preferred_supplier ? 'Sim' : 'Não',
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Bloqueado',
        Valor: summary.blocked ? 'Sim' : 'Não',
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Total de compras',
        Valor: formatNumberPtBr(summary.total_purchase_documents ?? 0),
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Compras confirmadas',
        Valor: formatNumberPtBr(summary.confirmed_purchase_documents ?? 0),
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Total comprado confirmado',
        Valor: formatCurrencyPtBr(summary.confirmed_purchased_amount ?? 0),
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Ticket médio',
        Valor: formatCurrencyPtBr(summary.average_ticket ?? 0),
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Produtos distintos',
        Valor: formatNumberPtBr(summary.distinct_products ?? 0),
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Quantidade total comprada',
        Valor: formatNumberPtBr(summary.total_items_quantity ?? 0),
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Última compra',
        Valor: summary.last_purchase_date
            ? formatDateOnlyPtBr(summary.last_purchase_date)
            : '',
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Contatos ativos',
        Valor: formatNumberPtBr(summary.contacts_count ?? 0),
    });

    rows.push({
        Seção: 'Resumo',
        Campo: 'Eventos de relacionamento',
        Valor: formatNumberPtBr(summary.relationship_events_count ?? 0),
    });

    purchases.forEach((purchase) => {
        rows.push({
            Seção: 'Compras',
            Campo:
                purchase.document_code ||
                purchase.invoice_number ||
                purchase.purchase_document_id,
            Valor: [
                `Emissão: ${purchase.issue_date ? formatDateOnlyPtBr(purchase.issue_date) : ''
                }`,
                `Status: ${purchaseStatusLabelMap[purchase.status] ?? purchase.status}`,
                `Itens: ${formatNumberPtBr(purchase.items_count ?? 0)}`,
                `Quantidade: ${formatNumberPtBr(purchase.total_quantity ?? 0)}`,
                `Total: ${formatCurrencyPtBr(purchase.total_amount ?? 0)}`,
            ].join(' | '),
        });
    });

    rows.push({
        Seção: 'Cotações',
        Campo: '',
        Valor: '',
        Observação: '',
    });

    quotations.forEach((quotation) => {
        rows.push({
            Seção: 'Cotações',
            Campo: quotation.quotation_code,
            Valor: quotation.status,
            Observação: [
                `Canal: ${quotation.sent_channel || '—'}`,
                `Responsável: ${quotation.responsible_name || '—'}`,
                `Itens: ${quotation.items_count ?? 0}`,
                `Qtd. solicitada: ${quotation.requested_qty ?? 0}`,
                `Qtd. aprovada: ${quotation.approved_qty ?? 0}`,
                `Total cotado: ${formatCurrencyPtBr(quotation.quoted_total ?? 0)}`,
                `Total aprovado: ${formatCurrencyPtBr(quotation.approved_total ?? 0)}`,
                quotation.converted_document_code
                    ? `Compra gerada: ${quotation.converted_document_code}`
                    : '',
            ]
                .filter(Boolean)
                .join(' | '),
        });
    });

    products.forEach((product) => {
        rows.push({
            Seção: 'Produtos fornecidos',
            Campo: product.product_name,
            Valor: [
                `Compras: ${formatNumberPtBr(product.purchase_count ?? 0)}`,
                `Quantidade: ${formatNumberPtBr(product.total_quantity ?? 0)}`,
                `Custo médio: ${formatCurrencyPtBr(product.average_unit_cost ?? 0)}`,
                `Menor custo: ${formatCurrencyPtBr(product.min_unit_cost ?? 0)}`,
                `Maior custo: ${formatCurrencyPtBr(product.max_unit_cost ?? 0)}`,
                `Último custo: ${formatCurrencyPtBr(product.last_unit_cost ?? 0)}`,
                `Última compra: ${product.last_purchase_date
                    ? formatDateOnlyPtBr(product.last_purchase_date)
                    : ''
                }`,
            ].join(' | '),
        });
    });

    prices.forEach((price) => {
        rows.push({
            Seção: 'Evolução de preços',
            Campo: price.product_name,
            Valor: [
                `Data: ${price.issue_date
                    ? formatDateOnlyPtBr(price.issue_date)
                    : formatDateTimePtBr(price.effective_at)
                }`,
                `Custo unitário: ${formatCurrencyPtBr(price.unit_cost ?? 0)}`,
                `Quantidade: ${formatNumberPtBr(price.quantity ?? 0)}`,
                `Total: ${formatCurrencyPtBr(price.total_cost ?? 0)}`,
                `Origem: ${price.source || ''}`,
            ].join(' | '),
        });
    });

    contacts.forEach((contact) => {
        rows.push({
            Seção: 'Contatos',
            Campo: contact.name,
            Valor: [
                `Departamento: ${departmentLabelMap[contact.department] ?? contact.department
                }`,
                `Função: ${contact.role || ''}`,
                `Telefone: ${contact.phone || ''}`,
                `WhatsApp: ${contact.whatsapp || ''}`,
                `E-mail: ${contact.email || ''}`,
                `Principal: ${contact.is_primary ? 'Sim' : 'Não'}`,
                `Ativo: ${contact.active ? 'Sim' : 'Não'}`,
                `Observações: ${contact.notes || ''}`,
            ].join(' | '),
        });
    });

    timeline.forEach((event) => {
        rows.push({
            Seção: 'Relacionamento',
            Campo: event.title,
            Valor: [
                `Data: ${formatDateTimePtBr(event.event_at)}`,
                `Tipo: ${eventTypeLabelMap[event.event_type] ?? event.event_type}`,
                `Severidade: ${severityLabelMap[event.severity] ?? event.severity}`,
                `Status: ${relationshipStatusLabelMap[event.status] ?? event.status
                }`,
                `Descrição: ${event.description || ''}`,
                `Produto relacionado: ${event.related_product_name || ''}`,
                `Criado por: ${event.created_by_email || ''}`,
            ].join(' | '),
        });
    });

    rows.push({
        Seção: 'Linha do tempo',
        Campo: '',
        Valor: '',
        Observação: '',
    });

    unifiedTimeline.forEach((event) => {
        rows.push({
            Seção: 'Linha do tempo',
            Campo: event.title,
            Valor: event.reference_label || event.event_type,
            Observação: [
                `Origem: ${event.source_kind}`,
                `Severidade: ${event.severity}`,
                `Status: ${event.status}`,
                `Data: ${event.event_at}`,
                event.description ? `Descrição: ${event.description}` : '',
                event.related_purchase_document_id
                    ? `Compra ID: ${event.related_purchase_document_id}`
                    : '',
                event.related_purchase_quotation_id
                    ? `Cotação ID: ${event.related_purchase_quotation_id}`
                    : '',
            ]
                .filter(Boolean)
                .join(' | '),
        });
    });

    const headers = ['Seção', 'Campo', 'Valor', 'Observação'];
    downloadCsv({
        filename: `${filenameBase}.csv`,
        headers,
        rows: rows.map((r) => headers.map((h) => r[h] ?? '')),
    });
}