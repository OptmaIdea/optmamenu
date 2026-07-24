import { supabase } from '@/lib/supabase';
import { createClientUuid } from '@/utils/clientUuid';

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
  originalUnitPrice?: number | null;
  discountReason?: string | null;
  pricingSource?: string | null;
  priceRule?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
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
  idempotencyKey?: string;
}

export interface AdminDirectSaleOrderResult {
  id: string;
  order_code: string | null;
  status: string;
  subtotal: number;
  gross_subtotal?: number;
  discount_total?: number;
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
  pricing?: unknown;
  idempotent_replay?: boolean;
  error?: string;
  message?: string;
  product_id?: string;
  product_name?: string;
  available?: number;
  requested?: number;
  reserved?: number;
  on_hand?: number;
}

const DIRECT_SALE_ERROR_MESSAGES: Record<string, string> = {
  missing_store_id: 'Não foi possível identificar a loja desta venda.',
  empty_cart: 'Adicione ao menos um item antes de concluir a venda.',
  invalid_quantity: 'Revise a quantidade dos itens antes de concluir a venda.',
  product_not_found: 'Um dos produtos não foi encontrado nesta loja.',
  product_unavailable: 'Um dos produtos não está disponível para venda.',
  insufficient_stock:
    'Há item sem saldo suficiente. Confirme a divergência de estoque para continuar.',
  reserved_stock_conflict:
    'Há unidades comprometidas com pedidos ativos. Remova o item ou trate as reservas antes de concluir.',
  stock_balance_not_found:
    'O saldo deste produto ainda não foi preparado para o local selecionado. Atualize o PDV e tente novamente.',
  stock_balance_prepare_failed:
    'O saldo local mudou durante a finalização. Atualize o PDV e tente novamente.',
  payment_method_disabled:
    'A forma de pagamento selecionada não está disponível nesta loja.',
  access_denied: 'Você não tem permissão para concluir esta venda.',
  discount_permission_required: 'Você não tem permissão para aplicar desconto no PDV.',
  idempotency_conflict:
    'Esta tentativa de venda já foi usada com dados diferentes. Atualize o PDV e tente novamente.',
  invalid_request_format: 'Há dados inválidos na venda. Revise os itens e tente novamente.',
  unexpected_error:
    'Ocorreu uma falha inesperada ao concluir a venda. Atualize o PDV e tente novamente.',
};

function getDirectSaleErrorMessage(result: AdminDirectSaleResult | null | undefined): string {
  const backendMessage = result?.message?.trim();
  if (backendMessage) return backendMessage;

  if (result?.error && DIRECT_SALE_ERROR_MESSAGES[result.error]) {
    return DIRECT_SALE_ERROR_MESSAGES[result.error];
  }

  return 'Não foi possível concluir a venda. Atualize o PDV e tente novamente.';
}

function normalizeDirectSaleItems(items: DirectSaleItemInput[]) {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    // Valores de preço continuam no payload apenas para compatibilidade e auditoria
    // do cliente. A RPC recalcula obrigatoriamente os preços no motor central.
    unit_price: item.unitPrice ?? null,
    discount: item.discount ?? 0,
    original_unit_price: item.originalUnitPrice ?? item.unitPrice ?? null,
    discount_reason: item.discountReason ?? null,
    pricing_source: item.pricingSource ?? null,
    price_rule: item.priceRule ?? null,
    metadata: item.metadata ?? {},
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

    const idempotencyKey = input.idempotencyKey || createClientUuid();
    const isDedicatedPos = input.metadata?.source === 'dedicated_pos';
    const rpcName = isDedicatedPos
      ? 'create_pos_sale_safe'
      : 'create_admin_direct_sale_order_safe';

    const { data, error } = await supabase.rpc(rpcName, {
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
      p_metadata: {
        ...(input.metadata || {}),
        idempotency_key: idempotencyKey,
      },
    });

    if (error) throw error;

    const result = data as AdminDirectSaleResult;

    if (!result?.ok) {
      throw new Error(getDirectSaleErrorMessage(result));
    }

    return result;
  },
};
