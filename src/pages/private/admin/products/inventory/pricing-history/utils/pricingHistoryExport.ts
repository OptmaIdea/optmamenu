import { downloadCsv } from '@/utils/export/csv';
import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import { formatDateOnlyPtBr } from '@/utils/dateTime';
import type {
  ProductItemPricingSnapshot,
  ProductPurchaseHistoryItem,
  PricingSourceSalesSummary,
  SalesPricingSummary,
  PurchaseCostSummary,
  EstimatedMarginSummary,
} from '../../types/productPricingHistory.types';

function sanitizeFilename(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Exporta o histórico detalhado de vendas em CSV.
 */
export function exportSalesHistoryCsv(
  productName: string,
  startDate: string,
  endDate: string,
  snapshots: ProductItemPricingSnapshot[]
) {
  const safeName = sanitizeFilename(productName);
  const filename = `historico-vendas-produto-${safeName}-${startDate}-a-${endDate}.csv`;

  const rows = snapshots.map((s) => [
    formatDateOnlyPtBr(s.sold_at),
    s.order_code || s.order_id,
    s.sales_channel,
    s.product_name_snapshot || productName,
    formatNumberPtBr(s.quantity),
    formatCurrencyPtBr(s.base_price),
    formatCurrencyPtBr(s.effective_unit_price),
    formatCurrencyPtBr(s.unit_discount),
    formatCurrencyPtBr(s.discount_total),
    formatCurrencyPtBr(s.gross_subtotal),
    formatCurrencyPtBr(s.net_subtotal),
    s.pricing_origin_label,
    s.category_name_snapshot || '—',
    s.pricing_group_name_snapshot || '—',
    s.applied_tier_min_quantity ? `${s.applied_tier_min_quantity} un.` : '—',
    s.applied_tier_price ? formatCurrencyPtBr(s.applied_tier_price) : '—',
    s.snapshot_version || '1.0',
  ]);

  downloadCsv({
    filename,
    headers: [
      'Data',
      'Pedido',
      'Canal',
      'Produto',
      'Quantidade',
      'Preço Base',
      'Preço Efetivo',
      'Desconto Unitário',
      'Desconto Total',
      'Subtotal Bruto',
      'Subtotal Líquido',
      'Origem da Precificação',
      'Categoria',
      'Grupo de Precificação',
      'Faixa Mínima',
      'Preço da Faixa',
      'Versão Snapshot',
    ],
    rows,
  });
}

/**
 * Exporta o histórico detalhado de compras em CSV.
 */
export function exportPurchaseHistoryCsv(
  productName: string,
  startDate: string,
  endDate: string,
  purchases: ProductPurchaseHistoryItem[]
) {
  const safeName = sanitizeFilename(productName);
  const filename = `historico-compras-produto-${safeName}-${startDate}-a-${endDate}.csv`;

  const rows = purchases.map((p) => [
    formatDateOnlyPtBr(p.entry_date),
    p.document_number || p.invoice_number || p.id,
    p.supplier_name || '—',
    formatNumberPtBr(p.received_quantity),
    formatCurrencyPtBr(p.unit_cost),
    formatCurrencyPtBr(p.total_cost),
    p.location_name || '—',
    'Confirmado',
  ]);

  downloadCsv({
    filename,
    headers: [
      'Data',
      'Documento',
      'Fornecedor',
      'Quantidade Recebida',
      'Custo Unitário',
      'Custo Total',
      'Local de Estoque',
      'Status',
    ],
    rows,
  });
}

/**
 * Exporta o resumo consolidado de preços e margens por origem em CSV.
 */
export function exportConsolidatedSummaryCsv(
  productName: string,
  startDate: string,
  endDate: string,
  salesSummary: SalesPricingSummary,
  bySource: PricingSourceSalesSummary[],
  purchaseSummary: PurchaseCostSummary,
  marginSummary: EstimatedMarginSummary
) {
  const safeName = sanitizeFilename(productName);
  const filename = `resumo-precos-margens-${safeName}-${startDate}-a-${endDate}.csv`;

  const rows: (string | number)[][] = [
    ['RESUMO DE VENDAS E PREÇOS'],
    ['Produto', productName],
    ['Período', `${startDate} a ${endDate}`],
    ['Quantidade Total Vendida', formatNumberPtBr(salesSummary.total_quantity_sold)],
    ['Número de Vendas', formatNumberPtBr(salesSummary.sales_count)],
    ['Receita Bruta Total', formatCurrencyPtBr(salesSummary.total_gross_revenue)],
    ['Desconto Total Concedido', formatCurrencyPtBr(salesSummary.total_discount)],
    ['Receita Líquida Total', formatCurrencyPtBr(salesSummary.total_net_revenue)],
    ['Preço Base Médio Ponderado', formatCurrencyPtBr(salesSummary.overall_weighted_average_base_price)],
    ['Preço Efetivo Médio Ponderado', formatCurrencyPtBr(salesSummary.overall_weighted_average_effective_price)],
    [],
    ['DESEMPENHO POR ORIGEM DE PRECIFICAÇÃO'],
    [
      'Origem / Regra',
      'Quantidade Vendida',
      'Número de Vendas',
      'Preço Base Médio',
      'Preço Efetivo Médio',
      'Receita Bruta',
      'Desconto Total',
      'Receita Líquida',
      'Participação na Receita (%)',
    ],
    ...bySource.map((g) => [
      g.origin_label,
      formatNumberPtBr(g.total_quantity_sold),
      formatNumberPtBr(g.sales_count),
      formatCurrencyPtBr(g.average_base_price),
      formatCurrencyPtBr(g.weighted_average_price),
      formatCurrencyPtBr(g.gross_revenue),
      formatCurrencyPtBr(g.total_discount),
      formatCurrencyPtBr(g.net_revenue),
      `${formatNumberPtBr(g.revenue_share_percentage)}%`,
    ]),
    [],
    ['RESUMO DE COMPRAS E CUSTOS'],
    ['Quantidade Total Recebida', formatNumberPtBr(purchaseSummary.total_quantity_purchased)],
    ['Entradas Recebidas', formatNumberPtBr(purchaseSummary.purchases_count)],
    ['Valor Total Comprado', formatCurrencyPtBr(purchaseSummary.total_purchased_value)],
    ['Custo Médio Ponderado', formatCurrencyPtBr(purchaseSummary.weighted_average_purchase_cost)],
    ['Menor Custo Unitário', purchaseSummary.min_unit_cost !== null ? formatCurrencyPtBr(purchaseSummary.min_unit_cost) : '—'],
    ['Maior Custo Unitário', purchaseSummary.max_unit_cost !== null ? formatCurrencyPtBr(purchaseSummary.max_unit_cost) : '—'],
    [],
    ['ESTIMATIVA DE MARGEM GERENCIAL'],
    ['Preço Médio Efetivo de Venda', formatCurrencyPtBr(marginSummary.overall_weighted_sale_price)],
    ['Custo Médio Ponderado de Compra', formatCurrencyPtBr(marginSummary.weighted_average_purchase_cost)],
    ['Margem Unitária Estimada', formatCurrencyPtBr(marginSummary.unit_margin)],
    ['Margem % Sobre Venda', `${formatNumberPtBr(marginSummary.margin_percentage_on_sale)}%`],
    ['Markup % Sobre Custo', `${formatNumberPtBr(marginSummary.markup_percentage_on_cost)}%`],
    [],
    ['Aviso Gerencial', 'Estimativa calculada com base no preço médio de venda e no custo médio de compra do período selecionado. Não substitui apuração contábil ou fiscal.'],
  ];

  downloadCsv({
    filename,
    headers: ['Relatório de Preços e Margens'],
    rows,
  });
}
