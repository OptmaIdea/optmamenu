import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import { DirectSalesService } from '@/services/directSalesService';

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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

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

export default function DirectSalesPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('Cliente balcão');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethodCode, setPaymentMethodCode] = useState('pending');
  const [lastOrderCode, setLastOrderCode] = useState<string | null>(null);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const totals = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        const gross = item.quantity * item.originalUnitPrice;
        const applied = item.quantity * item.unitPrice;
        const automaticDiscount = Math.max(gross - applied, 0);
        const manual = Math.max(item.manualDiscount || 0, 0);
        const lineTotal = Math.max(applied - manual, 0);

        return {
          grossSubtotal: acc.grossSubtotal + gross,
          automaticDiscount: acc.automaticDiscount + automaticDiscount,
          manualDiscount: acc.manualDiscount + manual,
          total: acc.total + lineTotal,
        };
      },
      { grossSubtotal: 0, automaticDiscount: 0, manualDiscount: 0, total: 0 }
    );
  }, [cart]);

  useEffect(() => {
    const load = async () => {
      try {
        const activeStoreId = getActiveStoreId();
        if (!activeStoreId) throw new Error('Nenhuma loja ativa selecionada.');
        setStoreId(activeStoreId);

        const [productsResult, paymentMethodsResult] = await Promise.all([
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
        ]);

        if (productsResult.error) throw productsResult.error;
        if (paymentMethodsResult.error) throw paymentMethodsResult.error;

        setProducts((productsResult.data || []) as ProductOption[]);
        setPaymentMethods((paymentMethodsResult.data || []) as PaymentMethodOption[]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar dados da venda direta.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

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
      toast.error('Informe um desconto válido.');
      return;
    }

    const pricing = resolvePrice(product, normalizedQuantity);

    setCart((current) => [
      ...current,
      {
        productId: product.id,
        quantity: normalizedQuantity,
        originalUnitPrice: pricing.originalUnitPrice,
        unitPrice: pricing.unitPrice,
        manualDiscount: normalizedManualDiscount,
        pricingSource: pricing.pricingSource,
        priceRule: pricing.priceRule,
      },
    ]);
    setProductId('');
    setQuantity(1);
    setManualDiscount(0);
  };

  const submitSale = async () => {
    if (!storeId) return;
    if (!cart.length) {
      toast.error('Adicione ao menos um item.');
      return;
    }

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
          discountReason: item.manualDiscount > 0 ? 'desconto_manual_pdv' : null,
          pricingSource: item.pricingSource,
          priceRule: item.priceRule || null,
          metadata: {
            automatic_discount_total: Math.max(item.quantity * item.originalUnitPrice - item.quantity * item.unitPrice, 0),
            manual_discount_total: item.manualDiscount,
          },
        })),
        customerName,
        customerPhone,
        paymentMethodCode,
        salesChannel: 'direct',
        fulfillmentType: 'in_person',
        createCustomerIfMissing: true,
        loyaltyOptIn: true,
        metadata: {
          source: 'direct_sales_minimal_ui',
          gross_subtotal: totals.grossSubtotal,
          automatic_discount_total: totals.automaticDiscount,
          manual_discount_total: totals.manualDiscount,
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
            Fluxo mínimo para registrar venda presencial com desconto manual e regra por quantidade.
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

            <div className="grid gap-3 md:grid-cols-[1fr_110px_140px_auto]">
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              >
                <option value="">Selecione um produto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {formatCurrency(Number(product.price || 0))}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                placeholder="Qtd."
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={manualDiscount}
                onChange={(event) => setManualDiscount(Number(event.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                placeholder="Desconto"
              />

              <button
                type="button"
                onClick={addItem}
                className="rounded-lg bg-[#21A896] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A867A]"
              >
                Adicionar
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {cart.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                  Nenhum item adicionado.
                </p>
              ) : (
                cart.map((item, index) => {
                  const product = productMap.get(item.productId);
                  const automaticDiscount = Math.max(item.quantity * item.originalUnitPrice - item.quantity * item.unitPrice, 0);
                  const lineTotal = Math.max(item.quantity * item.unitPrice - item.manualDiscount, 0);
                  return (
                    <div key={`${item.productId}-${index}`} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900 dark:text-white">{product?.name || item.productId}</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(lineTotal)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                        {automaticDiscount > 0 && <span>Regra: -{formatCurrency(automaticDiscount)}</span>}
                        {item.manualDiscount > 0 && <span>Manual: -{formatCurrency(item.manualDiscount)}</span>}
                        {item.pricingSource !== 'product_price' && <span>{item.pricingSource === 'category_price_rules' ? 'Categoria' : 'Produto'}</span>}
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
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                placeholder="Nome do cliente"
              />

              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                placeholder="Telefone/WhatsApp"
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
                  <span>Desconto por regra</span>
                  <strong>-{formatCurrency(totals.automaticDiscount)}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>Desconto manual</span>
                  <strong>-{formatCurrency(totals.manualDiscount)}</strong>
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
