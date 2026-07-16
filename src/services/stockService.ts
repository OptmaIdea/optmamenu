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
  requested_at_display?: string | null;
  approved_at: string | null;
  approved_at_display?: string | null;
  shipped_at: string | null;
  shipped_at_display?: string | null;
  received_at: string | null;
  received_at_display?: string | null;
  cancelled_at: string | null;
  cancelled_at_display?: string | null;
  notes: string | null;
  created_at: string;
  created_at_display?: string | null;
  updated_at: string;
  updated_at_display?: string | null;
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
  created_at_display?: string | null;
  affects_physical: boolean;
  source: string | null;
  source_id: string | null;
  reason_code: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  purchase_document_number: string | null;
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
  transfer_code?: string | null;
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

type PurchaseDocumentMovementInfo = {
  purchase_document_number: string | null;
  document_code: string | null;
  invoice_number: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
};

const getNestedSupplier = (supplier: unknown): { id?: string | null; name?: string | null } | null => {
  if (!supplier) return null;
  return Array.isArray(supplier)
    ? (supplier[0] as { id?: string | null; name?: string | null } | undefined) ?? null
    : (supplier as { id?: string | null; name?: string | null });
};

const getPurchaseDocumentMovementMap = async (sourceIds: Array<string | null | undefined>) => {
  const purchaseDocumentIds = Array.from(
    new Set(sourceIds.filter((id): id is string => Boolean(id)))
  );

  if (purchaseDocumentIds.length === 0) {
    return new Map<string, PurchaseDocumentMovementInfo>();
  }

  const { data, error } = await supabase
    .from('purchase_documents')
    .select(`
      id,
      document_code,
      invoice_number,
      supplier_id,
      supplier:suppliers (
        id,
        name
      )
    `)
    .in('id', purchaseDocumentIds);

  if (error) throw error;

  return new Map(
    (data ?? []).map((doc: any) => {
      const supplier = getNestedSupplier(doc.supplier);

      return [
        doc.id,
        {
          purchase_document_number: doc.document_code ?? doc.invoice_number ?? null,
          document_code: doc.document_code ?? null,
          invoice_number: doc.invoice_number ?? null,
          supplier_id: doc.supplier_id ?? supplier?.id ?? null,
          supplier_name: supplier?.name ?? null,
        },
      ] as const;
    })
  );
};

const getTransferMovementMap = async (transferIds: Array<string | null | undefined>) => {
  const ids = Array.from(
    new Set(transferIds.filter((id): id is string => Boolean(id)))
  );

  if (ids.length === 0) {
    return new Map<string, { transfer_code: string | null }>();
  }

  const { data, error } = await supabase
    .from('stock_transfers')
    .select('id, transfer_code')
    .in('id', ids);

  if (error) throw error;

  return new Map(
    (data ?? []).map((t: any) => [t.id, { transfer_code: t.transfer_code }] as const)
  );
};

const enrichProductStockMovementsWithPurchaseDocuments = async (
  movements: ProductStockMovementRow[]
) => {
  const [purchaseDocMap, transferMap] = await Promise.all([
    getPurchaseDocumentMovementMap(
      movements
        .filter((movement) => movement.source === 'purchase_document')
        .map((movement) => movement.source_id)
    ),
    getTransferMovementMap(
      movements
        .map((movement) => movement.transfer_id || (movement.source === 'stock_transfer' ? movement.source_id : null))
    )
  ]);

  return movements.map((movement) => {
    const purchaseInfo =
      movement.source === 'purchase_document' && movement.source_id
        ? purchaseDocMap.get(movement.source_id)
        : null;

    const transferId = movement.transfer_id || (movement.source === 'stock_transfer' ? movement.source_id : null);
    const transferInfo = transferId ? transferMap.get(transferId) : null;

    return {
      ...movement,
      supplier_id: movement.supplier_id ?? purchaseInfo?.supplier_id ?? null,
      supplier_name: movement.supplier_name ?? purchaseInfo?.supplier_name ?? null,
      purchase_document_number:
        movement.purchase_document_number ??
        purchaseInfo?.purchase_document_number ??
        null,
      metadata: {
        ...(movement.metadata ?? {}),
        document_code:
          (movement.metadata ?? {}).document_code ??
          purchaseInfo?.document_code ??
          null,
        invoice_number:
          (movement.metadata ?? {}).invoice_number ??
          purchaseInfo?.invoice_number ??
          null,
      },
      transfer_code: movement.transfer_code ?? transferInfo?.transfer_code ?? null,
    };
  });
};

export type ManualStockAdjustmentKind =
  | 'manual_entry'
  | 'manual_exit'
  | 'damage'
  | 'expired'
  | 'breakage'
  | 'loss'
  | 'physical_count';

export type CreateManualStockAdjustmentInput = {
  productId: string;
  locationId: string;
  adjustmentKind: ManualStockAdjustmentKind;
  quantity: number;
  reason?: string;
  notes?: string;
};

export type CreateManualStockAdjustmentResult = {
  movement_id: string;
  product_id: string;
  location_id: string;
  movement_type: string;
  quantity: number;
  message: string;
};

export async function createManualStockAdjustment(
  input: CreateManualStockAdjustmentInput,
): Promise<CreateManualStockAdjustmentResult> {
  const { data, error } = await supabase.rpc('create_manual_stock_adjustment', {
    p_product_id: input.productId,
    p_location_id: input.locationId,
    p_adjustment_kind: input.adjustmentKind,
    p_quantity: input.quantity,
    p_reason: input.reason ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;

  return Array.isArray(data)
    ? (data[0] as CreateManualStockAdjustmentResult)
    : (data as CreateManualStockAdjustmentResult);
}

export type AdjustStockToPhysicalCountInput = {
  productId: string;
  locationId: string;
  countedQuantity: number;
  reason?: string | null;
  notes?: string | null;
};

export type AdjustStockToPhysicalCountResult = {
  movement_id: string | null;
  product_id: string;
  location_id: string;
  previous_quantity: number;
  counted_quantity: number;
  adjustment_quantity: number;
  movement_type: string | null;
  message: string;
};

export async function adjustStockToPhysicalCount(
  input: AdjustStockToPhysicalCountInput,
): Promise<AdjustStockToPhysicalCountResult[]> {
  const { data, error } = await supabase.rpc('adjust_stock_to_physical_count', {
    p_product_id: input.productId,
    p_location_id: input.locationId,
    p_counted_quantity: input.countedQuantity,
    p_reason: input.reason ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;

  return normalizeRows<AdjustStockToPhysicalCountResult>(data);
}

export async function reverseReceivedStockTransfer(input: {
  transferId: string;
  reason: string;
}): Promise<ReverseReceivedStockTransferResult> {
  const { data, error } = await supabase.rpc('reverse_received_stock_transfer', {
    p_transfer_id: input.transferId,
    p_reason: input.reason,
  });
  if (error) throw error;
  const rows = normalizeRows<ReverseReceivedStockTransferResult>(data);
  if (!rows[0]) throw new Error('A transferência recebida não foi estornada.');
  return rows[0];
}

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
    return enrichProductStockMovementsWithPurchaseDocuments(
      normalizeRows<ProductStockMovementRow>(data)
    );
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

  async reverseReceivedStockTransfer(input: {
    transferId: string;
    reason: string;
  }): Promise<ReverseReceivedStockTransferResult> {
    const { data, error } = await supabase.rpc('reverse_received_stock_transfer', {
      p_transfer_id: input.transferId,
      p_reason: input.reason,
    });
    if (error) throw error;
    const rows = normalizeRows<ReverseReceivedStockTransferResult>(data);
    if (!rows[0]) throw new Error('A transferência não foi estornada.');
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

  createManualStockAdjustment,
  adjustStockToPhysicalCount,
  createPurchaseQuotation,
  getPurchaseQuotationsByStore,
  getPurchaseQuotationDetail,
  updatePurchaseQuotationResponse,
  convertPurchaseQuotationToDraft,
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

export type ReverseReceivedStockTransferResult = {
  transfer_id: string;
  transfer_code: string | null;
  status: string;
  reversed_at: string;
  total_reversed: number;
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

export type CreatePurchaseQuotationItemInput = {
  product_id: string;
  quantity: number;
  unit_cost?: number | null;
  notes?: string | null;
};

export type CreatePurchaseQuotationInput = {
  supplierId: string;
  items: CreatePurchaseQuotationItemInput[];
  messageSubject?: string | null;
  messageBody?: string | null;
  sentChannel?: 'whatsapp' | 'email' | 'pdf' | 'manual' | 'other' | null;
  responsibleName?: string | null;
  notes?: string | null;
};

export type CreatePurchaseQuotationResult = {
  quotation_id: string;
  quotation_code: string;
  status: string;
  items_count: number;
};

export type PurchaseQuotationSummary = {
  id: string;
  quotation_code: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  sent_channel: string | null;
  requested_at: string;
  requested_at_display?: string | null;
  responded_at: string | null;
  responded_at_display?: string | null;
  expires_at: string | null;
  expires_at_display?: string | null;
  items_count: number;
  total_reference: number;
  total_quoted: number;
  converted_purchase_document_id: string | null;
  responsible_name: string | null;
  notes: string | null;
};

export type PurchaseQuotationDetailItem = {
  id: string;
  product_id: string;
  product_name: string;
  requested_qty: number;
  reference_unit_cost: number | null;
  quoted_unit_cost: number | null;
  approved_qty: number | null;
  notes: string | null;
  supplier_notes: string | null;
};

export type PurchaseQuotationDetail = {
  id: string;
  store_id: string;
  supplier_id: string;
  supplier_name: string;
  quotation_code: string;
  status: string;
  sent_channel: string | null;
  requested_at: string;
  requested_at_display?: string | null;
  responded_at: string | null;
  responded_at_display?: string | null;
  expires_at: string | null;
  expires_at_display?: string | null;
  responsible_name: string | null;
  message_subject: string | null;
  message_body: string | null;
  notes: string | null;
  converted_purchase_document_id: string | null;
  items: PurchaseQuotationDetailItem[];
};
export type UpdatePurchaseQuotationResponseItemInput = {
  id: string;
  quoted_unit_cost?: number | null;
  approved_qty?: number | null;
  supplier_notes?: string | null;
};

export type UpdatePurchaseQuotationResponseInput = {
  quotationId: string;
  items: UpdatePurchaseQuotationResponseItemInput[];
  status?: 'draft' | 'sent' | 'answered' | 'approved' | 'rejected' | 'cancelled';
  sentChannel?: 'whatsapp' | 'email' | 'pdf' | 'manual' | 'other' | null;
  responsibleName?: string | null;
  notes?: string | null;
};

export type UpdatePurchaseQuotationResponseResult = {
  quotation_id: string;
  status: string;
  items_count: number;
  total_quoted: number;
};

export type ConvertPurchaseQuotationToDraftInput = {
  quotationId: string;
  notes?: string | null;
};

export type ConvertPurchaseQuotationToDraftResult = {
  purchase_document_id: string;
  quotation_id: string;
  quotation_code: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  items_count: number;
  total_amount: number;
};

export async function updatePurchaseQuotationResponse(
  input: UpdatePurchaseQuotationResponseInput,
): Promise<UpdatePurchaseQuotationResponseResult> {
  const { data, error } = await supabase.rpc('update_purchase_quotation_response', {
    p_quotation_id: input.quotationId,
    p_items: input.items,
    p_status: input.status ?? 'answered',
    p_sent_channel: input.sentChannel ?? null,
    p_responsible_name: input.responsibleName ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;

  return Array.isArray(data)
    ? (data[0] as UpdatePurchaseQuotationResponseResult)
    : (data as UpdatePurchaseQuotationResponseResult);
}



export async function convertPurchaseQuotationToDraft(
  input: ConvertPurchaseQuotationToDraftInput,
): Promise<ConvertPurchaseQuotationToDraftResult> {
  const { data, error } = await supabase.rpc('convert_purchase_quotation_to_draft', {
    p_quotation_id: input.quotationId,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;

  return Array.isArray(data)
    ? (data[0] as ConvertPurchaseQuotationToDraftResult)
    : (data as ConvertPurchaseQuotationToDraftResult);
}

export async function createPurchaseQuotation(
  input: CreatePurchaseQuotationInput,
): Promise<CreatePurchaseQuotationResult> {
  const { data, error } = await supabase.rpc('create_purchase_quotation', {
    p_supplier_id: input.supplierId,
    p_items: input.items,
    p_message_subject: input.messageSubject ?? null,
    p_message_body: input.messageBody ?? null,
    p_sent_channel: input.sentChannel ?? null,
    p_responsible_name: input.responsibleName ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;

  return Array.isArray(data)
    ? (data[0] as CreatePurchaseQuotationResult)
    : (data as CreatePurchaseQuotationResult);
}

export async function getPurchaseQuotationsByStore(
  storeId: string,
  status?: string | null,
): Promise<PurchaseQuotationSummary[]> {
  const { data, error } = await supabase.rpc('get_purchase_quotations_by_store', {
    p_store_id: storeId,
    p_status: status ?? null,
    p_limit: 100,
  });

  if (error) throw error;

  return (data ?? []) as PurchaseQuotationSummary[];
}

export async function getPurchaseQuotationDetail(
  quotationId: string,
): Promise<PurchaseQuotationDetail> {
  const { data, error } = await supabase.rpc('get_purchase_quotation_detail', {
    p_quotation_id: quotationId,
  });

  if (error) throw error;

  return data as PurchaseQuotationDetail;
}