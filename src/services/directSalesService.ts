import { supabase } from '@/lib/supabase';

export type DirectSaleSalesChannel = 'direct' | 'in_person' | 'phone' | 'whatsapp' | 'other';

export type DirectSaleFulfillmentType =
  | 'in_person'
  | 'pickup'
  | 'takeout'
  | 'dine_in'
  | 'delivery'
  | 'other';

export interface DirectSaleItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number | null;
  discount?: number | null;
}

export interface CreateAdminDirectSaleInput {
  storeId: string;
  items: DirectSaleItemInput[];
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethodCode?: string | null;
  notes?: string | null;
  locationId?: string | null;
  salesChannel?: DirectSaleSalesChannel;
  fulfillmentType?: DirectSaleFulfillmentType;
  createCustomerIfMissing?: boolean;
  marketingConsent?: boolean;
  loyaltyOptIn?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AdminDirectSaleOrderResult {
  id: string;
  order_code: string | null;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  sales_channel: string;
  fulfillment_type: string;
  payment_method: string | null;
  payment_method_code: string | null;
  payment_method_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  location_id: string | null;
  items_count: number;
}

export interface AdminDirectSaleResult {
  ok: boolean;
  order?: AdminDirectSaleOrderResult;
  cashbook?: unknown;
  loyalty?: unknown;
  error?: string;
  message?: string;
}

function normalizeDirectSaleItems(items: DirectSaleItemInput[]) {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice ?? null,
    discount: item.discount ?? 0,
  }));
}

export const DirectSalesService = {
  async createAdminDirectSale(input: CreateAdminDirectSaleInput): Promise<AdminDirectSaleResult> {
    if (!input.storeId) {
      throw new Error('Loja não informada.');
    }

    if (!input.items?.length) {
      throw new Error('Informe ao menos um item para a venda.');
    }

    const invalidItem = input.items.find(
      (item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0
    );

    if (invalidItem) {
      throw new Error('Há itens inválidos na venda direta.');
    }

    const { data, error } = await supabase.rpc('create_admin_direct_sale_order_safe', {
      p_store_id: input.storeId,
      p_items: normalizeDirectSaleItems(input.items),
      p_customer_id: input.customerId || null,
      p_customer_name: input.customerName || null,
      p_customer_phone: input.customerPhone || null,
      p_payment_method_code: input.paymentMethodCode || 'pending',
      p_notes: input.notes || null,
      p_location_id: input.locationId || null,
      p_sales_channel: input.salesChannel || 'direct',
      p_fulfillment_type: input.fulfillmentType || 'in_person',
      p_create_customer_if_missing: input.createCustomerIfMissing ?? true,
      p_marketing_consent: input.marketingConsent ?? false,
      p_loyalty_opt_in: input.loyaltyOptIn ?? true,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;

    const result = data as AdminDirectSaleResult;

    if (!result?.ok) {
      throw new Error(result?.message || result?.error || 'Erro ao criar venda direta.');
    }

    return result;
  },
};
