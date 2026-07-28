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

export const ProductPricingHistoryService = {
  /**
   * Busca todas as vendas faturadas/concluídas do produto no período e normaliza em snapshots.
   */
  async fetchSalesSnapshots(
    params: FetchPricingHistoryParams
  ): Promise<ProductItemPricingSnapshot[]> {
    const storeId = getActiveStoreId();
    if (!storeId || !params.productId) return [];

    // Definir período inclusivo em ISO (00:00:00 a 23:59:59)
    let startIso: string | undefined;
    let endIso: string | undefined;

    if (params.startDate) {
      startIso = `${params.startDate}T00:00:00.000Z`;
    }
    if (params.endDate) {
      endIso = `${params.endDate}T23:59:59.999Z`;
    }

    // Status autoritativos de venda concluída
    const COMPLETED_ORDER_STATUSES = ['completed', 'delivered', 'paid', 'closed', 'finished'];

    let query = supabase
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
      .order('created_at', { referencedTable: 'orders', ascending: false });

    if (startIso) {
      query = query.gte('orders.created_at', startIso);
    }
    if (endIso) {
      query = query.lte('orders.created_at', endIso);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar histórico de vendas do produto:', error);
      throw error;
    }

    const rawItems = (data ?? []) as any[];

    let snapshots = rawItems.map((item) => normalizeOrderItemSnapshot(item));

    // Filtros de memória para canal e origem
    if (params.salesChannel && params.salesChannel !== 'all') {
      snapshots = snapshots.filter((s) => s.sales_channel === params.salesChannel);
    }

    if (params.pricingSource && params.pricingSource !== 'all') {
      snapshots = snapshots.filter((s) => s.pricing_source === params.pricingSource);
    }

    return snapshots;
  },

  /**
   * Busca todas as compras confirmadas/recebidas do produto no período.
   */
  async fetchPurchaseHistory(
    params: FetchPricingHistoryParams
  ): Promise<ProductPurchaseHistoryItem[]> {
    const storeId = getActiveStoreId();
    if (!storeId || !params.productId) return [];

    let startIso: string | undefined;
    let endIso: string | undefined;

    if (params.startDate) {
      startIso = `${params.startDate}T00:00:00.000Z`;
    }
    if (params.endDate) {
      endIso = `${params.endDate}T23:59:59.999Z`;
    }

    // 1. Buscar itens de documentos de compra
    let itemsQuery = supabase
      .from('purchase_document_items')
      .select('id, purchase_document_id, product_id, quantity, unit_cost, total_cost')
      .eq('store_id', storeId)
      .eq('product_id', params.productId);

    const { data: itemRows, error: itemErr } = await itemsQuery;
    if (itemErr) {
      console.error('Erro ao buscar itens de compra do produto:', itemErr);
      throw itemErr;
    }

    if (!itemRows || itemRows.length === 0) return [];

    const docIds = Array.from(new Set(itemRows.map((r: any) => r.purchase_document_id)));

    // 2. Buscar documentos de compra confirmados
    let docQuery = supabase
      .from('purchase_documents')
      .select('id, document_number, invoice_number, supplier_id, issue_date, entry_date, created_at, status, cancelled_at, suppliers(name)')
      .eq('store_id', storeId)
      .in('id', docIds)
      .eq('status', 'confirmed')
      .is('cancelled_at', null);

    if (startIso) {
      docQuery = docQuery.gte('created_at', startIso);
    }
    if (endIso) {
      docQuery = docQuery.lte('created_at', endIso);
    }

    const { data: docRows, error: docErr } = await docQuery;
    if (docErr) {
      console.error('Erro ao buscar documentos de compra:', docErr);
      throw docErr;
    }

    const docMap = new Map((docRows ?? []).map((d: any) => [d.id, d]));

    const result: ProductPurchaseHistoryItem[] = [];

    for (const item of itemRows) {
      const doc = docMap.get(item.purchase_document_id);
      if (!doc) continue; // Ignora se documento não for confirmado ou fora do período

      const qty = Number(item.quantity || 0);
      const unitCost = Number(item.unit_cost || 0);
      const totalCost = Number(item.total_cost || qty * unitCost);

      result.push({
        id: item.id,
        purchase_document_id: doc.id,
        document_number: doc.document_number ?? doc.invoice_number ?? null,
        invoice_number: doc.invoice_number ?? null,
        supplier_id: doc.supplier_id ?? null,
        supplier_name: doc.suppliers?.name ?? null,
        entry_date: doc.entry_date || doc.issue_date || doc.created_at,
        received_quantity: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        status: 'confirmed',
      });
    }

    // Ordenar entradas por data mais recente
    result.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

    return result;
  },
};
