import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import { DirectSalesService } from '@/services/directSalesService';
import { Customers360Service, type CustomerListItem } from '@/services/customers360Service';

type PriceRule = {
  min?: number;
  price?: number;
};

type ProductOption = {
  id: string;
  name: string;
  price: number | null;
  category_id: string | null;
  use_category_pricing?: boolean | null;
  price_rules?: PriceRule[] | null;
  categories?: {
    name?: string | null;
    price_rules?: PriceRule[] | null;
  } | null;
};

type PaymentMethodOption = {
  code: string;
  name: string;
};

type CartLine = {
  productId: string;
  quantity: number;
  originalUnitPrice: number;
  unitPrice: number;
  manualDiscount: number;
  pricingSource: string;
  priceRule: PriceRule | null;
};

const COUNTER_CUSTOMER_NAME = 'Cliente de balcão';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const parseCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
};

const normalizeCustomerName = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

function normalizeRules(rules?: PriceRule[] | null): PriceRule[] {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule) => ({ min: Number(rule?.min ?? 0), price: Number(rule?.price ?? 0) }))
    .filter((rule) => Number.isFinite(rule.min) && Number.isFinite(rule.price) && rule.price >= 0)
    .sort((a, b) => Number(a.min || 0) - Number(b.min || 0));
}

function resolvePrice(product: ProductOption, quantity: number) {
  const basePrice = Number(product.price || 0);
  const productRules = normalizeRules(product.price_rules);
  const categoryRules = normalizeRules(product.categories?.price_rules);
  let appliedRule: PriceRule | null = null;
  let pricingSource = 'product_price';

  const sourceRules = productRules.length
    ? productRules
    : product.use_category_pricing && categoryRules.length
      ? categoryRules
      : [];

  if (sourceRules.length) {
    appliedRule = sourceRules.reduce<PriceRule | null>((best, rule) => {
      if (Number(rule.min || 0) <= quantity) return rule;
      return best;
    }, null);

    if (appliedRule?.price !== undefined) {
      pricingSource = productRules.length ? 'product_price_rules' : 'category_price_rules';
      return {
        originalUnitPrice: basePrice,
        unitPrice: Number(appliedRule.price),
        pricingSource,
        priceRule: appliedRule,
      };
    }
  }

  return {
    originalUnitPrice: basePrice,
    unitPrice: basePrice,
    pricingSource,
    priceRule: null,
  };
}

function getCustomerLabel(customer: CustomerListItem) {
  const name = customer.full_name || 'Cliente sem nome';
  const phone = customer.phone ? ` — ${customer.phone}` : '';
  return `${name}${phone}`;
}

export default function DirectSalesPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState(COUNTER_CUSTOMER_NAME);
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethodCode, setPaymentMethodCode] = useState('pending');
  const [lastOrderCode, setLastOrderCode] = useState<string | null>(null);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const selectedCustomer = selectedCustomerId ? customerMap.get(selectedCustomerId) || null : null;
  const counterCustomer = useMemo(
    () => customers.find((customer) => ['cliente de balcao', 'cliente balcao'].includes(normalizeCustomerName(customer.full_name))) || null,
    [customers]
  );

  const totals = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        const gross = item.quantity * item.originalUnitPrice;
        const applied = item.quantity * item.unitPrice;
        const quantityDiscount = Math.max(gross - applied, 0);
        const additionalDiscount = Math.max(item.manualDiscount || 0, 0);
        const lineTotal = Math.max(applied - additionalDiscount, 0);

        return {
          grossSubtotal: acc.grossSubtotal + gross,
          quantityDiscount: acc.quantityDiscount + quantityDiscount,
          additionalDiscount: acc.additionalDiscount + additionalDiscount,
          total: acc.total + lineTotal,
        };
      },
      { grossSubtotal: 0, quantityDiscount: 0, additionalDiscount: 0, total: 0 }
    );
  }, [cart]);

  const sortCartLines = (lines: CartLine[]) => {
    return [...lines].sort((a, b) => {
      const nameA = productMap.get(a.productId)?.name || '';
      const nameB = productMap.get(b.productId)?.name || '';
      return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
    });
  };

  const buildCartLine = (product: ProductOption, quantityValue: number, discountValue: number): CartLine => {
    const pricing = resolvePrice(product, quantityValue);

    return {
      productId: product.id,
      quantity: quantityValue,
      originalUnitPrice: pricing.originalUnitPrice,
      unitPrice: pricing.unitPrice,
      manualDiscount: Math.max(discountValue || 0, 0),
      pricingSource: pricing.pricingSource,
      priceRule: pricing.priceRule,
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const activeStoreId = getActiveStoreId();
        if (!activeStoreId) throw new Error('Nenhuma loja ativa selecionada.');
        setStoreId(activeStoreId);

        const [productsResult, paymentMethodsResult, customersResult] = await Promise.all([
          supabase
            .from('products')
            .select('id, name, price, category_id, use_category_pricing, price_rules, categories(name, price_rules)')
            .eq('store_id', activeStoreId)
            .eq('active', true)
            .order('name', { ascending: true }),
          supabase
            .from('store_payment_methods')
            .select('code, name')
            .eq('store_id', activeStoreId)
            .eq('active', true)
            .order('sort_order', { ascending: true }),
          Customers360Service.listCustomers(activeStoreId, 500),
        ]);

        if (productsResult.error) throw productsResult.error;
        if (paymentMethodsResult.error) throw paymentMethodsResult.error;

        setProducts((productsResult.data || []) as ProductOption[]);
        setPaymentMethods((paymentMethodsResult.data || []) as PaymentMethodOption[]);
        setCustomers(
          (customersResult || [])
            .filter((customer) => customer.status !== 'deleted_requested')
            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR', { sensitivity: 'base' }))
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar dados da venda direta.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);

    if (!customerId) {
      setCustomerName(COUNTER_CUSTOMER_NAME);
      setCustomerPhone('');
      return;
    }

    const customer = customerMap.get(customerId);
    if (!customer) return;

    setCustomerName(customer.full_name || COUNTER_CUSTOMER_NAME);
    setCustomerPhone(customer.phone || '');
  };

  const resetCounterCustomer = () => {
    setSelectedCustomerId('');
    setCustomerName(COUNTER_CUSTOMER_NAME);
    setCustomerPhone('');
  };

  const addItem = () => {
    const product = productMap.get(productId);
    if (!product) {
      toast.error('Selecione um produto.');
      return;
    }

    const normalizedQuantity = Number(quantity);
    const normalizedManualDiscount = Math.max(Number(manualDiscount || 0), 0);

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    if (!Number.isFinite(normalizedManualDiscount)) {
      toast.error('Informe um desconto adicional válido.');
      return;
    }

    setCart((current) => {
      const existingIndex = current.findIndex((item) => item.productId === product.id);

      if (existingIndex >= 0) {
        const next = [...current];
        const existing = next[existingIndex];
        next[existingIndex] = buildCartLine(
          product,
          existing.quantity + normalizedQuantity,
          existing.manualDiscount + normalizedManualDiscount
        );
        return sortCartLines(next);
      }

      return sortCartLines([...current, buildCartLine(product, normalizedQuantity, normalizedManualDiscount)]);
    });

    setProductId('');
    setQuantity(1);
    setManualDiscount(0);
  };

  const removeItem = (index: number) => {
    setCart((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const changeItemQuantity = (index: number, delta: number) => {
    setCart((current) => {
      const target = current[index];
      if (!target) return current;

      const product = productMap.get(target.productId);
      if (!product) return current;

      const nextQuantity = target.quantity + delta;
      if (nextQuantity <= 0) {
        return current.filter((_, itemIndex) => itemIndex !== index);
      }

      const next = [...current];
      next[index] = buildCartLine(product, nextQuantity, target.manualDiscount);
      return sortCartLines(next);
    });
  };

  const setItemAdditionalDiscount = (index: number, discountValue: number) => {
    setCart((current) => {
      const target = current[index];
      if (!target) return current;

      const product = productMap.get(target.productId);
      if (!product) return current;

      const next = [...current];
      next[index] = buildCartLine(product, target.quantity, Math.max(discountValue || 0, 0));
      return sortCartLines(next);
    });
  };

  const editItemAdditionalDiscount = (index: number) => {
    const target = cart[index];
    if (!target) return;

    const response = window.prompt('Informe o novo desconto adicional', formatCurrency(target.manualDiscount));
    if (response === null) return;

    const nextDiscount = parseCurrencyInput(response);
    if (!Number.isFinite(nextDiscount) || nextDiscount < 0) {
      toast.error('Informe um desconto adicional válido.');
      return;
    }

    setItemAdditionalDiscount(index, nextDiscount);
  };

  const submitSale = async () => {
    if (!storeId) return;
    if (!cart.length) {
      toast.error('Adicione ao menos um item.');
      return;
    }

    const effectiveCustomerId = selectedCustomerId || counterCustomer?.id || null;

    try {
      setSubmitting(true);
      const result = await DirectSalesService.createAdminDirectSale({
        storeId,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          originalUnitPrice: item.originalUnitPrice,
          discount: item.manualDiscount,
          discountReason: item.manualDiscount > 0 ? 'desconto_adicional_pdv' : null,
          pricingSource: item.pricingSource,
          priceRule: item.priceRule || null,
          metadata: {
            automatic_discount_total: Math.max(item.quantity * item.originalUnitPrice - item.quantity * item.unitPrice, 0),
            manual_discount_total: item.manualDiscount,
          },
        })),
        customerId: effectiveCustomerId,
        customerName,
        customerPhone,
        paymentMethodCode,
        salesChannel: 'direct',
        fulfillmentType: 'in_person',
        createCustomerIfMissing: !effectiveCustomerId,
        loyaltyOptIn: true,
        metadata: {
          source: 'direct_sales_minimal_ui',
          customer_selection_mode: selectedCustomerId ? 'existing_customer' : counterCustomer?.id ? 'counter_customer' : 'counter_customer_unlinked',
          effective_customer_id: effectiveCustomerId,
          display_customer_name: customerName,
          gross_subtotal: totals.grossSubtotal,
          automatic_discount_total: totals.quantityDiscount,
          manual_discount_total: totals.additionalDiscount,
          total_final: totals.total,
        },
      });

      setLastOrderCode(result.order?.order_code || result.order?.id || null);
      setCart([]);
      toast.success('Venda direta concluída.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao concluir venda direta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer
        title="Venda direta"
        subtitle="Carregando produtos para venda presencial."
        category="Comercial"
        flat
      >
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#21A896]" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Venda direta"
      subtitle="Registre venda presencial com baixa de estoque, cliente, caixa e fidelidade."
      category="Comercial"
      flat
    >
      <div className="space-y-6">
        <div>
          <Link to="/admin/orders" className="text-sm text-gray-500 hover:text-gray-700">
            ← Voltar para pedidos
          </Link>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Fluxo mínimo para registrar venda presencial com desconto adicional e desconto por quantidade.
          </p>
        </div>

        {lastOrderCode && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Venda concluída: <strong>{lastOrderCode}</strong>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Itens</h2>

            <div className="grid gap-3 md:grid-cols-[1fr_110px_160px_auto]">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Produto</span>
                <select
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  <option value="">Selecione um produto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} — {formatCurrency(Number(product.price || 0))}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Quantidade</span>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  placeholder="Qtd."
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Desc. adicional</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatCurrency(manualDiscount)}
                  onChange={(event) => setManualDiscount(parseCurrencyInput(event.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  placeholder="R$ 0,00"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full rounded-lg bg-[#21A896] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A867A]"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {cart.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                  Nenhum item adicionado.
                </p>
              ) : (
                cart.map((item, index) => {
                  const product = productMap.get(item.productId);
                  const quantityDiscount = Math.max(item.quantity * item.originalUnitPrice - item.quantity * item.unitPrice, 0);
                  const lineTotal = Math.max(item.quantity * item.unitPrice - item.manualDiscount, 0);
                  const hasUnitDiscount = item.unitPrice !== item.originalUnitPrice;

                  return (
                    <div key={item.productId} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{product?.name || item.productId}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              Unit.: {hasUnitDiscount ? `${formatCurrency(item.originalUnitPrice)} → ${formatCurrency(item.unitPrice)}` : formatCurrency(item.unitPrice)}
                            </span>
                            {quantityDiscount > 0 && <span>Desc. quantidade: -{formatCurrency(quantityDiscount)}</span>}
                            {item.manualDiscount > 0 && <span>Desc. adicional: -{formatCurrency(item.manualDiscount)}</span>}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                          <div className="inline-flex items-center overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                            <button
                              type="button"
                              onClick={() => changeItemQuantity(index, -1)}
                              className="px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                              aria-label="Diminuir quantidade"
                            >
                              −
                            </button>
                            <span className="min-w-[42px] border-x border-gray-200 px-3 py-1 text-center text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeItemQuantity(index, 1)}
                              className="px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                              aria-label="Aumentar quantidade"
                            >
                              +
                            </button>
                          </div>
                          <div className="min-w-[88px] text-right font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(lineTotal)}
                          </div>
                          <button
                            type="button"
                            onClick={() => editItemAdditionalDiscount(index)}
                            className="text-xs font-medium text-[#21A896] hover:text-[#1A867A]"
                          >
                            Alterar desc.
                          </button>
                          {item.manualDiscount > 0 && (
                            <button
                              type="button"
                              onClick={() => setItemAdditionalDiscount(index, 0)}
                              className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                            >
                              Zerar desc.
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Cliente e pagamento</h2>

            <div className="space-y-3">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Cliente</span>
                <select
                  value={selectedCustomerId}
                  onChange={(event) => handleCustomerSelect(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  <option value="">Cliente de balcão</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {getCustomerLabel(customer)}
                    </option>
                  ))}
                </select>
              </label>

              {!selectedCustomer && counterCustomer && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                  As vendas de balcão serão vinculadas ao cliente operacional <strong>Cliente de balcão</strong>, sem exigir telefone do comprador.
                </div>
              )}

              {!selectedCustomer && !counterCustomer && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  Cliente operacional de balcão não encontrado. A venda será salva sem vínculo na Vida do Cliente até esse cadastro existir.
                </div>
              )}

              {selectedCustomer && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  Cliente selecionado: <strong>{selectedCustomer.full_name || 'Cliente sem nome'}</strong>
                  {selectedCustomer.phone ? ` — ${selectedCustomer.phone}` : ''}
                  <button
                    type="button"
                    onClick={resetCounterCustomer}
                    className="ml-2 font-semibold underline decoration-dotted underline-offset-2"
                  >
                    voltar para balcão
                  </button>
                </div>
              )}

              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                readOnly={Boolean(selectedCustomerId)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm read-only:bg-gray-50 read-only:text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:read-only:bg-gray-900"
                placeholder="Nome exibido no pedido"
              />

              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                readOnly={Boolean(selectedCustomerId)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm read-only:bg-gray-50 read-only:text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:read-only:bg-gray-900"
                placeholder="Telefone/WhatsApp opcional"
              />

              <select
                value={paymentMethodCode}
                onChange={(event) => setPaymentMethodCode(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              >
                <option value="pending">Pagamento pendente / a combinar</option>
                {paymentMethods.map((method) => (
                  <option key={method.code} value={method.code}>
                    {method.name}
                  </option>
                ))}
              </select>

              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>Subtotal bruto</span>
                  <strong>{formatCurrency(totals.grossSubtotal)}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>Desc. quantidade</span>
                  <strong>-{formatCurrency(totals.quantityDiscount)}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>Desc. adicional</span>
                  <strong>-{formatCurrency(totals.additionalDiscount)}</strong>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={submitSale}
                disabled={submitting || cart.length === 0}
                className="w-full rounded-lg bg-[#21A896] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1A867A] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Concluindo...' : 'Concluir venda direta'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
