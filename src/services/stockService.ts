import { supabase } from '@/lib/supabase';

export type InventoryLocationStatus =
  | 'product_inactive'
  | 'location_inactive'
  | 'location_stockout'
  | 'location_critical'
  | 'location_excess'
  | 'location_ok'
  | 'monitor_only'
  | 'not_configured'
  | string;

export type InventoryGlobalStatus =
  | 'product_inactive'
  | 'global_stockout'
  | 'global_critical'
  | 'global_attention'
  | 'global_excess'
  | 'global_ok'
  | string;

export type InventoryRecommendedAction =
  | 'buy'
  | 'transfer'
  | 'monitor'
  | 'review_excess'
  | 'ok'
  | string;

export type InventorySourceLocation = {
  location_id: string;
  location_code: string;
  location_name: string;
  available: number;
  on_hand: number;
  reserved: number;
  location_status: string;
};

export type InventoryPositionRow = {
  store_id: string;
  location_id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  location_active: boolean;
  product_id: string;
  product_name: string;
  category_id: string | null;
  price: number | null;
  product_active: boolean;
  min_stock: number | null;
  max_stock: number | null;
  last_entry_unit_cost: number | null;
  variant_id: string | null;
  on_hand: number;
  reserved: number;
  available: number;
  stock_status: 'out' | 'low' | 'ok' | 'over' | 'inactive' | string;
  updated_at: string;

  global_on_hand: number;
  global_reserved: number;
  global_available: number;
  global_min_stock: number;
  global_max_stock: number;
  global_status: InventoryGlobalStatus;

  provisional_location_min_stock: number;
  provisional_location_max_stock: number;
  location_status: InventoryLocationStatus;

  possible_source_locations: number;
  source_locations: InventorySourceLocation[];
  recommended_action: InventoryRecommendedAction;
};


export type StockTransferSummaryRow = {
  id: string;
  store_id: string;
  transfer_code: string | null;
  status: 'draft' | 'pending' | 'approved' | 'shipped' | 'received' | 'cancelled' | 'divergent';
  source_store_id: string;
  destination_store_id: string;
  source_location_id: string;
  source_location_code: string;
  source_location_name: string;
  destination_location_id: string;
  destination_location_code: string;
  destination_location_name: string;
  requested_at: string;
  approved_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items_count: number;
  total_requested_qty: number;
  total_shipped_qty: number;
  total_received_qty: number;
  total_divergence_qty: number;
};

export type StockTransferDetail = {
  header: StockTransferSummaryRow | null;
  items: Array<{
    id: string;
    transfer_id: string;
    store_id: string;
    product_id: string;
    product_name: string;
    category_id: string | null;
    price: number | null;
    variant_id: string | null;
    requested_qty: number;
    shipped_qty: number;
    received_qty: number;
    divergence_qty: number;
    unit_cost: number | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>;
};

export type CreateStockTransferDraftResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
};

export type CreateStockTransferDraftBatchResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  items_count: number;
};

export type ProductLifecycleRow = {
  store_id: string;
  product_id: string;
  product_name: string;
  category_id: string | null;
  price: number | null;
  active: boolean;
  min_stock: number | null;
  max_stock: number | null;
  last_entry_unit_cost: number | null;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  last_entry_at: string | null;
  last_exit_at: string | null;
  last_movement_at: string | null;
  transfer_count: number | null;
  last_transfer_at: string | null;
  last_location_balance_update: string | null;
};

export type ProductStockMovementRow = {
  id: string;
  store_id: string;
  product_id: string;
  product_name: string;
  order_id: string | null;
  quantity: number;
  type: string;
  reason: string | null;
  user_id: string | null;
  previous_stock: number;
  new_stock: number;
  created_at: string;
  affects_physical: boolean;
  source: string | null;
  source_id: string | null;
  reason_code: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  supplier_id: string | null;
  location_id: string | null;
  location_code: string | null;
  location_name: string | null;
  from_location_id: string | null;
  from_location_code: string | null;
  from_location_name: string | null;
  to_location_id: string | null;
  to_location_code: string | null;
  to_location_name: string | null;
  transfer_id: string | null;
};

export type ProductInventoryAuditRow = {
  id: string;
  store_id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

const normalizeRows = <T>(data: unknown): T[] => {
  if (!data) return [];
  return Array.isArray(data) ? (data as T[]) : [data as T];
};

export const stockService = {
  async getInventoryPositionByStore(storeId: string): Promise<InventoryPositionRow[]> {
    const { data, error } = await supabase.rpc('get_inventory_position_by_store', {
      p_store_id: storeId,
    });
    if (error) throw error;
    return normalizeRows<InventoryPositionRow>(data);
  },

  async getStockTransfersByStore(storeId: string): Promise<StockTransferSummaryRow[]> {
    const { data, error } = await supabase.rpc('get_stock_transfers_by_store', {
      p_store_id: storeId,
    });
    if (error) throw error;
    return normalizeRows<StockTransferSummaryRow>(data);
  },

  async getStockTransferDetail(transferId: string): Promise<StockTransferDetail> {
    const { data, error } = await supabase.rpc('get_stock_transfer_detail', {
      p_transfer_id: transferId,
    });
    if (error) throw error;
    return (data ?? { header: null, items: [] }) as StockTransferDetail;
  },

  async getProductInventoryLifecycle(storeId: string, productId?: string): Promise<ProductLifecycleRow[]> {
    const { data, error } = await supabase.rpc('get_product_inventory_lifecycle', {
      p_store_id: storeId,
      p_product_id: productId ?? null,
    });
    if (error) throw error;
    return normalizeRows<ProductLifecycleRow>(data);
  },

  async getProductStockMovements(storeId: string, productId: string): Promise<ProductStockMovementRow[]> {
    const { data, error } = await supabase.rpc('get_product_stock_movements', {
      p_store_id: storeId,
      p_product_id: productId,
    });
    if (error) throw error;
    return normalizeRows<ProductStockMovementRow>(data);
  },

  async getProductInventoryAuditEvents(storeId: string, productId: string): Promise<ProductInventoryAuditRow[]> {
    const { data, error } = await supabase.rpc('get_product_inventory_audit_events', {
      p_store_id: storeId,
      p_product_id: productId,
    });
    if (error) throw error;
    return normalizeRows<ProductInventoryAuditRow>(data);
  },

  async createStockTransferDraftFromSuggestion(input: {
    productId: string;
    sourceLocationId: string;
    destinationLocationId: string;
    quantity: number;
    notes?: string | null;
  }): Promise<CreateStockTransferDraftResult> {
    const { data, error } = await supabase.rpc(
      'create_stock_transfer_draft_from_suggestion',
      {
        p_product_id: input.productId,
        p_source_location_id: input.sourceLocationId,
        p_destination_location_id: input.destinationLocationId,
        p_quantity: input.quantity,
        p_notes: input.notes ?? null,
      }
    );

    if (error) throw error;

    const rows = normalizeRows<CreateStockTransferDraftResult>(data);
    if (!rows[0]) {
      throw new Error('A transferência não foi criada.');
    }

    return rows[0];
  },

  async createStockTransferDraftBatch(input: {
    sourceLocationId: string;
    destinationLocationId: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
    notes?: string | null;
  }): Promise<CreateStockTransferDraftBatchResult> {
    const { data, error } = await supabase.rpc(
      'create_stock_transfer_draft_batch',
      {
        p_source_location_id: input.sourceLocationId,
        p_destination_location_id: input.destinationLocationId,
        p_items: input.items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        p_notes: input.notes ?? null,
      }
    );

    if (error) throw error;

    const rows = normalizeRows<CreateStockTransferDraftBatchResult>(data);
    if (!rows[0]) {
      throw new Error('O rascunho em lote não foi criado.');
    }

    return rows[0];
  },

  async shipStockTransfer(input: {
    transferId: string;
    notes?: string | null;
  }): Promise<ShipStockTransferResult> {
    const { data, error } = await supabase.rpc('ship_stock_transfer', {
      p_transfer_id: input.transferId,
      p_notes: input.notes ?? null,
      p_use_transit: false,
    });
    if (error) throw error;
    const rows = normalizeRows<ShipStockTransferResult>(data);
    if (!rows[0]) throw new Error('A transferência não foi enviada.');
    return rows[0];
  },

  async receiveStockTransfer(input: {
    transferId: string;
    items: ReceiveStockTransferItemInput[];
    notes?: string | null;
  }): Promise<ReceiveStockTransferResult> {
    const { data, error } = await supabase.rpc('receive_stock_transfer', {
      p_transfer_id: input.transferId,
      p_items: input.items.map((item) => ({
        item_id: item.itemId,
        received_qty: item.receivedQty,
        divergence_resolution: item.divergenceResolution ?? null,
        divergence_reason: item.divergenceReason ?? null,
        divergence_notes: item.divergenceNotes ?? null,
      })),
      p_notes: input.notes ?? null,
    });
    if (error) throw error;
    const rows = normalizeRows<ReceiveStockTransferResult>(data);
    if (!rows[0]) throw new Error('A transferência não foi recebida.');
    return rows[0];
  },

  async cancelStockTransfer(input: {
    transferId: string;
    reason: string;
  }): Promise<CancelStockTransferResult> {
    const { data, error } = await supabase.rpc('cancel_stock_transfer', {
      p_transfer_id: input.transferId,
      p_cancel_reason: input.reason,
    });
    if (error) throw error;
    const rows = normalizeRows<CancelStockTransferResult>(data);
    if (!rows[0]) throw new Error('A transferência não foi cancelada.');
    return rows[0];
  },

  async getPurchaseSuggestionsByStore(
    storeId: string
  ): Promise<PurchaseSuggestionRow[]> {
    const { data, error } = await supabase.rpc('get_purchase_suggestions_by_store', {
      p_store_id: storeId,
    });
    if (error) throw error;
    return normalizeRows<PurchaseSuggestionRow>(data);
  },

  async createPurchaseDocumentDraftBatch(input: {
    supplierId: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitCost: number;
    }>;
    notes?: string | null;
  }): Promise<CreatePurchaseDocumentDraftBatchResult> {
    const { data, error } = await supabase.rpc('create_purchase_document_draft_batch', {
      p_supplier_id: input.supplierId,
      p_items: input.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
      })),
      p_notes: input.notes ?? null,
    });
    if (error) throw error;
    const rows = normalizeRows<CreatePurchaseDocumentDraftBatchResult>(data);
    if (!rows[0]) throw new Error('O rascunho de compra não foi criado.');
    return rows[0];
  },
};


export type ShipStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  shipped_at: string;
};

export type ReceiveStockTransferItemInput = {
  itemId: string;
  receivedQty: number;
  divergenceResolution?: 'loss' | 'return_to_origin' | 'accepted_shortage' | null;
  divergenceReason?: string | null;
  divergenceNotes?: string | null;
};

export type ReceiveStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  received_at: string;
  total_shipped: number;
  total_received: number;
  total_divergence: number;
};

export type CancelStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  cancelled_at: string;
};

export type PurchaseSuggestionRow = {
  store_id: string;

  product_id: string;
  product_name: string;
  category_id: string | null;

  min_stock: number;
  max_stock: number;

  physical_on_hand: number;
  reserved: number;
  available: number;
  in_transit_in: number;
  projected_available: number;

  shortage_qty: number;
  suggested_purchase_qty: number;

  suggested_supplier_id: string | null;
  suggested_supplier_name: string | null;
  suggested_supplier_trade_name: string | null;
  suggested_supplier_blocked: boolean;
  suggested_supplier_preferred: boolean;
  suggested_supplier_homologation_status: string | null;

  suggested_unit_cost: number;
  estimated_total_cost: number;

  last_purchase_date: string | null;
  last_purchase_document_id: string | null;

  recommendation_reason: string;
};

export type CreatePurchaseDocumentDraftBatchResult = {
  purchase_document_id: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  items_count: number;
  total_amount: number;
};
