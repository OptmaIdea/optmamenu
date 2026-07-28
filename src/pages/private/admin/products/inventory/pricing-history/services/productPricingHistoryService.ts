import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import {
  normalizeOrderItemSnapshot,
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
 * Converte strings YYYY-MM-DD em limites de data no fuso horario operacional local (00:00:00.000 e 23:59:59.999).
 * Evita deslocamentos por conversao UTC (sufixo Z).
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
   * Busca vendas concluídas do produto e filtra estritamente pela data efetiva (completed_at ?? created_at).
   */
  async fetchSalesSnapshots(
    params: FetchPricingHistoryParams
  ): Promise<FetchPricingHistoryResult<ProductItemPricingSnapshot>> {
    const storeId = getActiveStoreId();
    if (!storeId || !params.productId) {
      return { data: [], hasTruncatedData: false, totalCandidateCount: 0 };
    }

    // Status autoritativos de venda concluída no OptmaMenu
    // Excluídos: reserved, confirmed (em preparo), ready (pronto), cancelled, expired_auto, draft
    const COMPLETED_ORDER_STATUSES = ['completed', 'delivered', 'paid', 'closed', 'finished'];

    const { data, error } = await supabase
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
      .order('created_at', { referencedTable: 'orders', ascending: false })
      .limit(CANDIDATE_FETCH_LIMIT);

    if (error) {
      console.error('Erro ao buscar histórico de vendas do produto:', error);
      throw error;
    }

    const rawItems = (data ?? []) as any[];
    const hasTruncatedData = rawItems.length >= CANDIDATE_FETCH_LIMIT;

    // Normaliza os snapshots (sold_at = completed_at ?? created_at)
    let snapshots = rawItems.map((item) => normalizeOrderItemSnapshot(item));

    // Filtra em memória estritamente pela data efetiva de venda (sold_at) no fuso operacional local
    const { startBound, endBound } = parseLocalDateBounds(params.startDate, params.endDate);

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
      totalCandidateCount: rawItems.length,
    };
  },

  /**
   * Busca compras confirmadas do produto e filtra estritamente pela data efetiva de entrada (entry_date ?? created_at).
   */
  async fetchPurchaseHistory(
    params: FetchPricingHistoryParams
  ): Promise<FetchPricingHistoryResult<ProductPurchaseHistoryItem>> {
    const storeId = getActiveStoreId();
    if (!storeId || !params.productId) {
      return { data: [], hasTruncatedData: false, totalCandidateCount: 0 };
    }

    // 1. Buscar itens de documentos de compra
    const { data: itemRows, error: itemErr } = await supabase
      .from('purchase_document_items')
      .select('id, purchase_document_id, product_id, quantity, unit_cost, total_cost')
      .eq('store_id', storeId)
      .eq('product_id', params.productId)
      .limit(CANDIDATE_FETCH_LIMIT);

    if (itemErr) {
      console.error('Erro ao buscar itens de compra do produto:', itemErr);
      throw itemErr;
    }

    if (!itemRows || itemRows.length === 0) {
      return { data: [], hasTruncatedData: false, totalCandidateCount: 0 };
    }

    const hasTruncatedData = itemRows.length >= CANDIDATE_FETCH_LIMIT;
    const docIds = Array.from(new Set(itemRows.map((r: any) => r.purchase_document_id)));

    // 2. Buscar documentos de compra autoritativamente confirmados e não cancelados
    const { data: docRows, error: docErr } = await supabase
      .from('purchase_documents')
      .select('id, document_number, invoice_number, supplier_id, issue_date, entry_date, created_at, status, cancelled_at, suppliers(name)')
      .eq('store_id', storeId)
      .in('id', docIds)
      .eq('status', 'confirmed')
      .is('cancelled_at', null);

    if (docErr) {
      console.error('Erro ao buscar documentos de compra:', docErr);
      throw docErr;
    }

    const docMap = new Map((docRows ?? []).map((d: any) => [d.id, d]));
    const { startBound, endBound } = parseLocalDateBounds(params.startDate, params.endDate);

    let result: ProductPurchaseHistoryItem[] = [];

    for (const item of itemRows) {
      const doc = docMap.get(item.purchase_document_id);
      if (!doc) continue; // Ignora documentos não confirmados ou cancelados

      // Data efetiva autoritativa de entrada: entry_date ?? created_at
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
      totalCandidateCount: itemRows.length,
    };
  },
};
