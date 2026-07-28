import { supabase } from '@/lib/supabase';
import { createClientUuid } from '@/utils/clientUuid';

export type DirectSaleSalesChannel = 'direct' | 'in_person' | 'phone' | 'whatsapp' | 'other';
export type DirectSaleFulfillmentType = 'in_person' | 'pickup' | 'takeout' | 'dine_in' | 'delivery' | 'other';

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

type StoredPosCustomer = { id: string; name: string; phone?: string | null };

const DIRECT_SALE_ERROR_MESSAGES: Record<string, string> = {
  missing_store_id: 'Não foi possível identificar a loja desta venda.',
  empty_cart: 'Adicione ao menos um item antes de concluir a venda.',
  invalid_quantity: 'Revise a quantidade dos itens antes de concluir a venda.',
  product_not_found: 'Um dos produtos não foi encontrado nesta loja.',
  product_unavailable: 'Um dos produtos não está disponível para venda.',
  insufficient_stock: 'Há item sem saldo suficiente. Confirme a divergência de estoque para continuar.',
  reserved_stock_conflict: 'Há unidades comprometidas com pedidos ativos. Remova o item ou trate as reservas antes de concluir.',
  stock_balance_not_found: 'O saldo deste produto ainda não foi preparado para o local selecionado. Atualize o PDV e tente novamente.',
  stock_balance_prepare_failed: 'O saldo local mudou durante a finalização. Atualize o PDV e tente novamente.',
  payment_method_disabled: 'A forma de pagamento selecionada não está disponível nesta loja.',
  access_denied: 'Você não tem permissão para concluir esta venda.',
  discount_permission_required: 'Você não tem permissão para aplicar desconto no PDV.',
  idempotency_conflict: 'Esta tentativa de venda já foi usada com dados diferentes. Atualize o PDV e tente novamente.',
  invalid_request_format: 'Há dados inválidos na venda. Revise os itens e tente novamente.',
  unexpected_error: 'Ocorreu uma falha inesperada ao concluir a venda. Atualize o PDV e tente novamente.',
};

function getDirectSaleErrorMessage(result: AdminDirectSaleResult | null | undefined): string {
  const backendMessage = result?.message?.trim();
  if (backendMessage) return backendMessage;
  if (result?.error && DIRECT_SALE_ERROR_MESSAGES[result.error]) return DIRECT_SALE_ERROR_MESSAGES[result.error];
  return 'Não foi possível concluir a venda. Atualize o PDV e tente novamente.';
}

function getPricingOriginLabel(source?: string | null): string {
  if (!source) return 'Origem não registrada';
  switch (source) {
    case 'pricing_group_combined_volume':
      return 'Grupo de precificação por quantidade';
    case 'category_combined_volume':
      return 'Categoria por quantidade combinada';
    case 'category_per_product_volume':
      return 'Categoria por quantidade do produto';
    case 'category_standard':
      return 'Preço herdado da categoria';
    case 'product_volume':
      return 'Faixa de atacado do produto';
    case 'product_standard':
    case 'product_base_price':
      return 'Preço próprio do produto';
    case 'custom_manual':
      return 'Preço ajustado manualmente';
    case 'unregistered_legacy':
      return 'Origem não registrada';
    default:
      return 'Origem não registrada';
  }
}

function normalizeDirectSaleItems(items: DirectSaleItemInput[]) {
  return items.map((item) => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    const basePrice = Number(item.originalUnitPrice ?? item.unitPrice ?? 0);
    const rawUnitPrice = Number(item.unitPrice ?? basePrice);
    const itemDiscountInput = Math.max(0, Number(item.discount || 0));

    // Se o desconto informado for por item ou manual, calcula o unitDiscount adicional
    // Se a cotação já deu o unitPrice efetivo após atacado/categoria, effectiveUnitPrice = rawUnitPrice
    const manualDiscountPerUnit = quantity > 0 && itemDiscountInput > 0 && itemDiscountInput < rawUnitPrice ? itemDiscountInput : 0;
    const effectiveUnitPrice = Math.max(0, rawUnitPrice - manualDiscountPerUnit);

    const grossSubtotal = quantity * basePrice;
    const netSubtotal = quantity * effectiveUnitPrice;
    const discountTotal = Math.max(0, grossSubtotal - netSubtotal);
    const unitDiscount = quantity > 0 ? discountTotal / quantity : 0;

    const meta = item.metadata ?? {};
    const pricingSource = item.pricingSource ?? (meta.pricing_source ? String(meta.pricing_source) : 'product_base_price');

    const categoryNameSnapshot = meta.category_name_snapshot ?? meta.category_name ?? null;
    const pricingGroupNameSnapshot = meta.pricing_group_name_snapshot ?? meta.pricing_group_name ?? null;
    const ruleNameSnapshot = meta.rule_name_snapshot ?? meta.rule_name ?? null;

    return {
      product_id: item.productId,
      quantity,
      unit_price: effectiveUnitPrice,
      discount: 0, // Envia 0 para a RPC pois unit_price já é o valor unitário efetivo faturado
      original_unit_price: basePrice,
      discount_reason: item.discountReason ?? null,
      pricing_source: pricingSource,
      price_rule: item.priceRule ?? null,
      metadata: {
        ...meta,
        base_price: basePrice,
        effective_unit_price: effectiveUnitPrice,
        unit_price: effectiveUnitPrice,
        quantity,
        gross_subtotal: grossSubtotal,
        unit_discount: unitDiscount,
        discount_total: discountTotal,
        discount: discountTotal, // Mantido por compatibilidade como desconto total da linha
        net_subtotal: netSubtotal,
        pricing_source: pricingSource,
        pricing_origin_label: getPricingOriginLabel(pricingSource),
        category_id: meta.category_id ?? null,
        category_name_snapshot: categoryNameSnapshot,
        pricing_group_id: meta.pricing_group_id ?? null,
        pricing_group_name_snapshot: pricingGroupNameSnapshot,
        rule_id: meta.rule_id ?? null,
        rule_name_snapshot: ruleNameSnapshot,
        applied_tier: item.priceRule ?? meta.applied_tier ?? null,
        applied_tier_min_quantity: meta.applied_tier_min_quantity ?? (item.priceRule as any)?.min ?? null,
        applied_tier_price: meta.applied_tier_price ?? (item.priceRule as any)?.price ?? null,
        snapshot_version: '1.0',
      },
    };
  });
}

function getPosCustomerStorageKey(storeId: string) {
  return `optmamenu.pdv.customer.${storeId}`;
}

function readSelectedPosCustomer(storeId: string): StoredPosCustomer | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(getPosCustomerStorageKey(storeId));
    if (!value) return null;
    const parsed = JSON.parse(value) as StoredPosCustomer;
    return parsed?.id && parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

function clearSelectedPosCustomer(storeId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getPosCustomerStorageKey(storeId));
  window.dispatchEvent(new CustomEvent('optmamenu:pdv-customer-cleared'));
}

export const DirectSalesService = {
  async createAdminDirectSale(input: CreateAdminDirectSaleInput): Promise<AdminDirectSaleResult> {
    if (!input.storeId) throw new Error('Loja não informada.');
    if (!input.items?.length) throw new Error('Informe ao menos um item para a venda.');

    const invalidItem = input.items.find((item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0);
    if (invalidItem) throw new Error('Há itens inválidos na venda direta.');

    const idempotencyKey = input.idempotencyKey || createClientUuid();
    const isDedicatedPos = input.metadata?.source === 'dedicated_pos';
    const selectedPosCustomer = isDedicatedPos ? readSelectedPosCustomer(input.storeId) : null;
    const customerId = input.customerId || selectedPosCustomer?.id || null;
    const customerName = input.customerName || selectedPosCustomer?.name || null;
    const customerPhone = input.customerPhone || selectedPosCustomer?.phone || null;
    const loyaltyOptIn = selectedPosCustomer ? true : (input.loyaltyOptIn ?? true);
    const rpcName = isDedicatedPos ? 'create_pos_sale_safe' : 'create_admin_direct_sale_order_safe';

    const { data, error } = await supabase.rpc(rpcName, {
      p_store_id: input.storeId,
      p_items: normalizeDirectSaleItems(input.items),
      p_customer_id: customerId,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_payment_method_code: input.paymentMethodCode || 'pending',
      p_notes: input.notes || null,
      p_location_id: input.locationId || null,
      p_sales_channel: input.salesChannel || 'direct',
      p_fulfillment_type: input.fulfillmentType || 'in_person',
      p_create_customer_if_missing: selectedPosCustomer ? false : (input.createCustomerIfMissing ?? true),
      p_marketing_consent: input.marketingConsent ?? false,
      p_loyalty_opt_in: loyaltyOptIn,
      p_metadata: {
        ...(input.metadata || {}),
        idempotency_key: idempotencyKey,
        customer_selection_mode: selectedPosCustomer ? 'existing_customer_pdv' : input.metadata?.customer_selection_mode,
        selected_customer_id: selectedPosCustomer?.id || null,
      },
    });

    if (error) throw error;
    const result = data as AdminDirectSaleResult;
    if (!result?.ok) throw new Error(getDirectSaleErrorMessage(result));
    if (isDedicatedPos) clearSelectedPosCustomer(input.storeId);
    return result;
  },
};
