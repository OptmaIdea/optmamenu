import { supabase } from '@/lib/supabase';

export type SaleJson = Record<string, unknown>;

export interface SaleDetailOrder {
  id: string;
  order_code: string | null;
  status: string;
  created_at: string;
  confirmed_at?: string | null;
  ready_at?: string | null;
  completed_at?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_snapshot?: SaleJson | null;
  sales_channel?: string | null;
  fulfillment_type?: string | null;
  delivery_method_code?: string | null;
  delivery_address?: string | null;
  delivery_address_snapshot?: SaleJson | null;
  delivery_fee: number;
  table_code?: string | null;
  notes?: string | null;
  subtotal: number;
  total: number;
  payment_method?: string | null;
  payment_method_code?: string | null;
  payment_method_name?: string | null;
  payment_method_base_code?: string | null;
  payment_status?: string | null;
  proof_url?: string | null;
  payment_metadata?: SaleJson | null;
  commercial_metadata?: SaleJson | null;
  metadata?: SaleJson | null;
}

export interface SaleDetailItem {
  id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
  product_snapshot?: SaleJson | null;
  commercial_metadata?: SaleJson | null;
}

export interface SaleStockMovement {
  id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  type: string;
  reason?: string | null;
  reason_code?: string | null;
  source?: string | null;
  affects_physical: boolean;
  previous_stock?: number | null;
  new_stock?: number | null;
  location_id?: string | null;
  location_name?: string | null;
  from_location_name?: string | null;
  to_location_name?: string | null;
  created_at: string;
  metadata?: SaleJson | null;
}

export interface SaleStockReservation {
  id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  status: string;
  sales_channel?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  created_at: string;
  expires_at?: string | null;
  consumed_at?: string | null;
  cancelled_at?: string | null;
  metadata?: SaleJson | null;
}

export interface SaleStockDiscrepancy {
  id: string;
  occurrence_type?: string | null;
  status: string;
  location_id?: string | null;
  location_name?: string | null;
  items?: unknown;
  opening_notes?: string | null;
  resolution_type?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  metadata?: SaleJson | null;
}

export interface SaleFinancialEntry {
  id: string;
  entry_code?: string | null;
  entry_date?: string | null;
  occurred_at: string;
  type: string;
  direction: string;
  amount: number;
  description: string;
  notes?: string | null;
  payment_method?: string | null;
  payment_method_code?: string | null;
  payment_method_name?: string | null;
  status: string;
  affects_balance: boolean;
  affects_financial_result?: boolean | null;
  is_transfer: boolean;
  source?: string | null;
  source_financial_account_id?: string | null;
  source_financial_account_name?: string | null;
  destination_financial_account_id?: string | null;
  destination_financial_account_name?: string | null;
  metadata?: SaleJson | null;
}

export interface SalePaymentRouteAudit {
  id: string;
  cashbook_entry_id: string;
  old_payment_method_code?: string | null;
  new_payment_method_code?: string | null;
  old_source_financial_account_name?: string | null;
  old_destination_financial_account_name?: string | null;
  new_source_financial_account_name?: string | null;
  new_destination_financial_account_name?: string | null;
  reason?: string | null;
  created_at: string;
  metadata?: SaleJson | null;
}

export interface SaleDetailResult {
  order: SaleDetailOrder;
  items: SaleDetailItem[];
  canViewStock: boolean;
  stock: {
    movements: SaleStockMovement[];
    reservations: SaleStockReservation[];
    discrepancies: SaleStockDiscrepancy[];
  };
  canViewFinance: boolean;
  finance: {
    entries: SaleFinancialEntry[];
    routeAudit: SalePaymentRouteAudit[];
  };
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const SaleDetailService = {
  async get(storeId: string, orderId: string): Promise<SaleDetailResult> {
    const { data, error } = await supabase.rpc('get_sale_detail_safe', {
      p_store_id: storeId,
      p_order_id: orderId,
    });

    if (error) throw error;
    if (!data?.ok) {
      const messages: Record<string, string> = {
        access_denied: 'Você não tem permissão para visualizar esta venda.',
        order_not_found: 'Venda não encontrada nesta loja.',
        missing_parameters: 'Não foi possível identificar a venda.',
      };
      throw new Error(messages[String(data?.error || '')] || data?.message || 'Erro ao carregar a venda.');
    }

    const order = data.order as Record<string, unknown>;
    const items = ((data.items || []) as Array<Record<string, unknown>>).map((item) => ({
      ...item,
      quantity: num(item.quantity),
      unit_price: num(item.unit_price),
      discount: num(item.discount),
      line_total: num(item.line_total),
    })) as SaleDetailItem[];
    const movements = ((data.stock?.movements || []) as Array<Record<string, unknown>>).map((movement) => ({
      ...movement,
      quantity: num(movement.quantity),
      previous_stock: movement.previous_stock == null ? null : num(movement.previous_stock),
      new_stock: movement.new_stock == null ? null : num(movement.new_stock),
      affects_physical: Boolean(movement.affects_physical),
    })) as SaleStockMovement[];
    const reservations = ((data.stock?.reservations || []) as Array<Record<string, unknown>>).map((reservation) => ({
      ...reservation,
      quantity: num(reservation.quantity),
    })) as SaleStockReservation[];
    const entries = ((data.finance?.entries || []) as Array<Record<string, unknown>>).map((entry) => ({
      ...entry,
      amount: num(entry.amount),
      affects_balance: Boolean(entry.affects_balance),
      is_transfer: Boolean(entry.is_transfer),
    })) as SaleFinancialEntry[];

    return {
      order: {
        ...order,
        subtotal: num(order.subtotal),
        delivery_fee: num(order.delivery_fee),
        total: num(order.total),
      } as SaleDetailOrder,
      items,
      canViewStock: Boolean(data.can_view_stock),
      stock: {
        movements,
        reservations,
        discrepancies: (data.stock?.discrepancies || []) as SaleStockDiscrepancy[],
      },
      canViewFinance: Boolean(data.can_view_finance),
      finance: {
        entries,
        routeAudit: (data.finance?.route_audit || []) as SalePaymentRouteAudit[],
      },
    };
  },
};
