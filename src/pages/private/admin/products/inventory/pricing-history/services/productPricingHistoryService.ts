import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import {
  normalizeOrderItemSnapshot,
  getDatesForPreset,
} from '../utils/pricingHistoryCalculations';
import type {
  ProductItemPricingSnapshot,
  ProductPurchaseHistoryItem,
} from '../../types/productPricingHistory.types';

export interface FetchPricingHistoryParams {
  productId: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  salesChannel?: string;
  pricingSource?: string;
}

export interface FetchPricingHistoryResult<T> {
  data: T[];
  hasTruncatedData: boolean;
  totalCandidateCount: number;
}

/**
 * Converte strings YYYY-MM-DD em limites de data no fuso horário operacional local (00:00:00.000 e 23:59:59.999).
 * Evita deslocamentos por conversão UTC (sufixo Z).
 */
export function parseLocalDateBounds(startDateStr?: string, endDateStr?: string) {
  let startBound: Date | null = null;
  let endBound: Date | null = null;

  if (startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    const [y, m, d] = startDateStr.split('-').map(Number);
    startBound = new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  if (endDateStr && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    const [y, m, d] = endDateStr.split('-').map(Number);
    endBound = new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  return { startBound, endBound };
}

const CANDIDATE_FETCH_LIMIT = 1000;

export const ProductPricingHistoryService = {
  /**
   * Busca vendas concluídas do produto consultando candidatos por período efetivo em 2 rotas:
   * Consulta A: completed_at no período
   * Consulta B: completed_at IS NULL e created_at no período
   * Resultados unidos e deduplicados por order_item.id.
   */
  async fetchSalesSnapshots(
    params: FetchPricingHistoryParams
  ): Promise<FetchPricingHistoryResult<ProductItemPricingSnapshot>> {
    const storeId = getActiveStoreId();
    if (!storeId || !params.productId) {
      return { data: [], hasTruncatedData: false, totalCandidateCount: 0 };
    }

    // Se o período estiver ausente, padronizar para últimos 30 dias
    let startDateStr = params.startDate;
    let endDateStr = params.endDate;

    if (!startDateStr || !endDateStr) {
      const defaultDates = getDatesForPreset('last_30_days');
      startDateStr = startDateStr || defaultDates.startDate;
      endDateStr = endDateStr || defaultDates.endDate;
    }

    const { startBound, endBound } = parseLocalDateBounds(startDateStr, endDateStr);
    const startIso = startBound ? startBound.toISOString() : undefined;
    const endIso = endBound ? endBound.toISOString() : undefined;

    // Status autoritativos de venda concluída no OptmaMenu
    const COMPLETED_ORDER_STATUSES = ['completed', 'delivered', 'paid', 'closed', 'finished'];

    // Consulta A: completed_at dentro do período
    let queryA = supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        quantity,
        unit_price,
        discount,
        commercial_metadata,
        orders!inner (
          id,
          order_code,
          sales_channel,
          status,
          created_at,
          completed_at,
          store_id
        )
      `)
      .eq('product_id', params.productId)
      .eq('orders.store_id', storeId)
      .in('orders.status', COMPLETED_ORDER_STATUSES)
      .order('completed_at', { referencedTable: 'orders', ascending: false })
      .limit(CANDIDATE_FETCH_LIMIT);

    if (startIso) queryA = queryA.gte('orders.completed_at', startIso);
    if (endIso) queryA = queryA.lte('orders.completed_at', endIso);

    // Consulta B: completed_at NULO e created_at dentro do período
    let queryB = supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        quantity,
        unit_price,
        discount,
        commercial_metadata,
        orders!inner (
          id,
          order_code,
          sales_channel,
          status,
          created_at,
          completed_at,
          store_id
        )
      `)
      .eq('product_id', params.productId)
      .eq('orders.store_id', storeId)
      .in('orders.status', COMPLETED_ORDER_STATUSES)
      .is('orders.completed_at', null)
      .order('created_at', { referencedTable: 'orders', ascending: false })
      .limit(CANDIDATE_FETCH_LIMIT);

    if (startIso) queryB = queryB.gte('orders.created_at', startIso);
    if (endIso) queryB = queryB.lte('orders.created_at', endIso);

    const [resA, resB] = await Promise.all([queryA, queryB]);

    if (resA.error) {
      console.error('Erro na Consulta A de vendas:', resA.error);
      throw resA.error;
    }
    if (resB.error) {
      console.error('Erro na Consulta B de vendas:', resB.error);
      throw resB.error;
    }

    const rawA = (resA.data ?? []) as any[];
    const rawB = (resB.data ?? []) as any[];

    const hasTruncatedData = rawA.length >= CANDIDATE_FETCH_LIMIT || rawB.length >= CANDIDATE_FETCH_LIMIT;

    // Deduplicação estrita por order_item.id
    const itemMap = new Map<string, any>();
    for (const item of [...rawA, ...rawB]) {
      if (!itemMap.has(item.id)) {
        itemMap.set(item.id, item);
      }
    }

    // Normalizar snapshots (sold_at = completed_at ?? created_at)
    let snapshots = Array.from(itemMap.values()).map((item) => normalizeOrderItemSnapshot(item));

    // Validação final em memória estritamente pela data efetiva (sold_at) em fuso operacional local
    if (startBound || endBound) {
      snapshots = snapshots.filter((s) => {
        const soldAtTime = new Date(s.sold_at).getTime();
        if (Number.isNaN(soldAtTime)) return false;
        if (startBound && soldAtTime < startBound.getTime()) return false;
        if (endBound && soldAtTime > endBound.getTime()) return false;
        return true;
      });
    }

    // Ordenação garantida por sold_at mais recente primeiro
    snapshots.sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime());

    // Filtros de memória para canal e origem
    if (params.salesChannel && params.salesChannel !== 'all') {
      snapshots = snapshots.filter((s) => s.sales_channel === params.salesChannel);
    }

    if (params.pricingSource && params.pricingSource !== 'all') {
      snapshots = snapshots.filter((s) => s.pricing_source === params.pricingSource);
    }

    return {
      data: snapshots,
      hasTruncatedData,
      totalCandidateCount: snapshots.length,
    };
  },

  /**
   * Busca compras confirmadas consultando documentos candidatos por período efetivo em 2 rotas:
   * Consulta A: entry_date no período
   * Consulta B: entry_date IS NULL e created_at no período
   * Deduplica os documentos e busca apenas os itens vinculados ao produto.
   */
  async fetchPurchaseHistory(
    params: FetchPricingHistoryParams
  ): Promise<FetchPricingHistoryResult<ProductPurchaseHistoryItem>> {
    const storeId = getActiveStoreId();
    if (!storeId || !params.productId) {
      return { data: [], hasTruncatedData: false, totalCandidateCount: 0 };
    }

    let startDateStr = params.startDate;
    let endDateStr = params.endDate;

    if (!startDateStr || !endDateStr) {
      const defaultDates = getDatesForPreset('last_30_days');
      startDateStr = startDateStr || defaultDates.startDate;
      endDateStr = endDateStr || defaultDates.endDate;
    }

    const { startBound, endBound } = parseLocalDateBounds(startDateStr, endDateStr);
    const startIso = startBound ? startBound.toISOString() : undefined;
    const endIso = endBound ? endBound.toISOString() : undefined;

    // Consulta A: entry_date no período
    let docQueryA = supabase
      .from('purchase_documents')
      .select('id, document_number, invoice_number, supplier_id, issue_date, entry_date, created_at, status, cancelled_at, suppliers(name)')
      .eq('store_id', storeId)
      .eq('status', 'confirmed')
      .is('cancelled_at', null)
      .order('entry_date', { ascending: false })
      .limit(CANDIDATE_FETCH_LIMIT);

    if (startIso) docQueryA = docQueryA.gte('entry_date', startIso);
    if (endIso) docQueryA = docQueryA.lte('entry_date', endIso);

    // Consulta B: entry_date IS NULL e created_at no período
    let docQueryB = supabase
      .from('purchase_documents')
      .select('id, document_number, invoice_number, supplier_id, issue_date, entry_date, created_at, status, cancelled_at, suppliers(name)')
      .eq('store_id', storeId)
      .eq('status', 'confirmed')
      .is('cancelled_at', null)
      .is('entry_date', null)
      .order('created_at', { ascending: false })
      .limit(CANDIDATE_FETCH_LIMIT);

    if (startIso) docQueryB = docQueryB.gte('created_at', startIso);
    if (endIso) docQueryB = docQueryB.lte('created_at', endIso);

    const [docResA, docResB] = await Promise.all([docQueryA, docQueryB]);

    if (docResA.error) {
      console.error('Erro na Consulta A de documentos de compra:', docResA.error);
      throw docResA.error;
    }
    if (docResB.error) {
      console.error('Erro na Consulta B de documentos de compra:', docResB.error);
      throw docResB.error;
    }

    const docsA = (docResA.data ?? []) as any[];
    const docsB = (docResB.data ?? []) as any[];
    const hasTruncatedDocs = docsA.length >= CANDIDATE_FETCH_LIMIT || docsB.length >= CANDIDATE_FETCH_LIMIT;

    // Deduplicar documentos de compra por id
    const docMap = new Map<string, any>();
    for (const doc of [...docsA, ...docsB]) {
      if (!docMap.has(doc.id)) {
        docMap.set(doc.id, doc);
      }
    }

    if (docMap.size === 0) {
      return { data: [], hasTruncatedData: false, totalCandidateCount: 0 };
    }

    const docIds = Array.from(docMap.keys());

    // Buscar itens APENAS para os documentos encontrados no período
    const { data: itemRows, error: itemErr } = await supabase
      .from('purchase_document_items')
      .select('id, purchase_document_id, product_id, quantity, unit_cost, total_cost')
      .eq('store_id', storeId)
      .eq('product_id', params.productId)
      .in('purchase_document_id', docIds)
      .limit(CANDIDATE_FETCH_LIMIT);

    if (itemErr) {
      console.error('Erro ao buscar itens de compra dos documentos:', itemErr);
      throw itemErr;
    }

    const rawItemRows = (itemRows ?? []) as any[];
    const hasTruncatedItems = rawItemRows.length >= CANDIDATE_FETCH_LIMIT;
    const hasTruncatedData = hasTruncatedDocs || hasTruncatedItems;

    let result: ProductPurchaseHistoryItem[] = [];

    for (const item of rawItemRows) {
      const doc = docMap.get(item.purchase_document_id);
      if (!doc) continue;

      const effectiveEntryDate = doc.entry_date || doc.created_at;
      const entryTime = new Date(effectiveEntryDate).getTime();

      if (!Number.isNaN(entryTime)) {
        if (startBound && entryTime < startBound.getTime()) continue;
        if (endBound && entryTime > endBound.getTime()) continue;
      }

      const qty = Math.max(0, Number(item.quantity || 0));
      const unitCost = Math.max(0, Number(item.unit_cost || 0));
      const totalCost = Number(item.total_cost || qty * unitCost);

      result.push({
        id: item.id,
        purchase_document_id: doc.id,
        document_number: doc.document_number ?? doc.invoice_number ?? null,
        invoice_number: doc.invoice_number ?? null,
        supplier_id: doc.supplier_id ?? null,
        supplier_name: doc.suppliers?.name ?? null,
        entry_date: effectiveEntryDate,
        received_quantity: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        status: 'confirmed',
      });
    }

    // Ordenar por data efetiva de entrada mais recente primeiro
    result.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

    return {
      data: result,
      hasTruncatedData,
      totalCandidateCount: result.length,
    };
  },
};
