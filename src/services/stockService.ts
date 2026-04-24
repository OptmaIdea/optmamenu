import { supabase } from '@/lib/supabase';

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
  stock_status: 'out' | 'low' | 'ok' | 'over' | string;
  updated_at: string;
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
};
