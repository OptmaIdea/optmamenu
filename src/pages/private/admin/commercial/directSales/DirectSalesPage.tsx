import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import { DirectSalesService } from '@/services/directSalesService';
import { Customers360Service, type CustomerListItem } from '@/services/customers360Service';
import { getPosPricingQuote } from '@/services/pdvService';
import type { PosPricingQuote } from '@/types/pdv';
import { createClientUuid } from '@/utils/clientUuid';

export type ProductOption = {
  id: string;
  name: string;
  price: number | null;
  category_id: string | null;
  images?: string[] | null;
  categories?: { name?: string | null } | null;
};

type PaymentMethodOption = { code: string; name: string };
type CartLine = { productId: string; quantity: number; manualDiscount: number };
type ProductSortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'category_asc';

const COUNTER_CUSTOMER_NAME = 'Cliente de balcão';
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const parseCurrencyInput = (value: string) => Number(value.replace(/\D/g, '') || 0) / 100;
const normalize = (value?: string | null) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const categoryName = (product: ProductOption) => product.categories?.name || 'Sem categoria';

export default function DirectSalesPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingQuote, setPricingQuote] = useState<PosPricingQuote | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState(COUNTER_CUSTOMER_NAME);
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethodCode, setPaymentMethodCode] = useState('pending');
  const [lastOrderCode, setLastOrderCode] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productSort, setProductSort] = useState<ProductSortOption>('name_asc');
  const saleAttemptIdRef = useRef(createClientUuid());

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const counterCustomer = useMemo(() => customers.find((customer) => ['cliente de balcao', 'cliente balcao'].includes(normalize(customer.full_name))) || null, [customers]);
  const selectedCustomer = selectedCustomerId ? customerMap.get(selectedCustomerId) || null : null;
  const categories = useMemo(() => Array.from(new Set(products.map(categoryName))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [products]);
  const filteredProducts = useMemo(() => {
    const term = normalize(productSearch);
    return products.filter((product) => (!term || normalize(`${product.name} ${categoryName(product)}`).includes(term)) && (productCategoryFilter === 'all' || categoryName(product) === productCategoryFilter)).sort((a, b) => {
      if (productSort === 'name_desc') return b.name.localeCompare(a.name, 'pt-BR');
      if (productSort === 'price_asc') return Number(a.price || 0) - Number(b.price || 0);
      if (productSort === 'price_desc') return Number(b.price || 0) - Number(a.price || 0);
      if (productSort === 'category_asc') return categoryName(a).localeCompare(categoryName(b), 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR');
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [products, productSearch, productCategoryFilter, productSort]);

  useEffect(() => {
    const load = async () => {
      try {
        const activeStoreId = getActiveStoreId();
        if (!activeStoreId) throw new Error('Nenhuma loja ativa selecionada.');
        setStoreId(activeStoreId);
        const [productsResult, paymentResult, customersResult] = await Promise.all([
          supabase.from('products').select('id, name, price, category_id, images, categories(name)').eq('store_id', activeStoreId).eq('active', true).order('name'),
          supabase.from('store_payment_methods').select('code, name').eq('store_id', activeStoreId).eq('active', true).order('sort_order'),
          Customers360Service.listCustomers(activeStoreId, 500),
        ]);
        if (productsResult.error) throw productsResult.error;
        if (paymentResult.error) throw paymentResult.error;
        setProducts((productsResult.data || []) as ProductOption[]);
        setPaymentMethods((paymentResult.data || []) as PaymentMethodOption[]);
        setCustomers((customersResult || []).filter((customer) => customer.status !== 'deleted_requested').sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR')));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar dados da venda direta.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    saleAttemptIdRef.current = createClientUuid();
  }, [cart, selectedCustomerId, customerName, customerPhone, paymentMethodCode]);

  useEffect(() => {
    if (!storeId || !cart.length) {
      setPricingQuote(null);
      setPricingError(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setPricingLoading(true);
      setPricingError(null);
      void getPosPricingQuote(storeId, cart.map((item) => ({ productId: item.productId, quantity: item.quantity })))
        .then((quote) => { if (active) setPricingQuote(quote); })
        .catch(() => { if (active) { setPricingQuote(null); setPricingError('Não foi possível confirmar os preços do carrinho.'); } })
        .finally(() => { if (active) setPricingLoading(false); });
    }, 150);
    return () => { active = false; window.clearTimeout(timer); };
  }, [storeId, cart]);

  const quoteMap = useMemo(() => new Map((pricingQuote?.items || []).map((item) => [item.product_id, item])), [pricingQuote]);
  const manualDiscountTotal = cart.reduce((sum, item) => sum + Math.max(item.manualDiscount, 0), 0);
  const totals = {
    grossSubtotal: pricingQuote?.base_subtotal ?? cart.reduce((sum, item) => sum + Number(productMap.get(item.productId)?.price || 0) * item.quantity, 0),
    quantityDiscount: pricingQuote?.total_discount ?? 0,
    additionalDiscount: manualDiscountTotal,
    total: Math.max((pricingQuote?.subtotal ?? 0) - manualDiscountTotal, 0),
  };

  const addItem = () => {
    if (!productMap.has(productId)) return toast.error('Selecione um produto.');
    if (!Number.isFinite(quantity) || quantity <= 0) return toast.error('Informe uma quantidade válida.');
    setCart((current) => {
      const existing = current.find((item) => item.productId === productId);
      return existing
        ? current.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + quantity, manualDiscount: item.manualDiscount + manualDiscount } : item)
        : [...current, { productId, quantity, manualDiscount }];
    });
    setProductId(''); setQuantity(1); setManualDiscount(0);
  };

  const changeQuantity = (productIdValue: string, delta: number) => setCart((current) => current.flatMap((item) => {
    if (item.productId !== productIdValue) return [item];
    const next = item.quantity + delta;
    return next > 0 ? [{ ...item, quantity: next }] : [];
  }));

  const handleCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customerMap.get(customerId);
    setCustomerName(customer?.full_name || COUNTER_CUSTOMER_NAME);
    setCustomerPhone(customer?.phone || '');
  };

  const submitSale = async () => {
    if (!storeId || !cart.length || !pricingQuote || pricingLoading) return;
    const effectiveCustomerId = selectedCustomerId || counterCustomer?.id || null;
    try {
      setSubmitting(true);
      const result = await DirectSalesService.createAdminDirectSale({
        storeId,
        items: cart.map((item) => {
          const quote = quoteMap.get(item.productId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: quote?.unit_price,
            originalUnitPrice: quote?.base_price,
            discount: item.manualDiscount,
            discountReason: item.manualDiscount > 0 ? 'desconto_adicional_venda_direta' : null,
            pricingSource: quote?.pricing_source,
            priceRule: quote?.applied_tier || null,
            metadata: { pricing_quantity: quote?.pricing_quantity, pricing_group_name: quote?.pricing_group_name },
          };
        }),
        customerId: effectiveCustomerId,
        customerName,
        customerPhone,
        paymentMethodCode,
        salesChannel: 'direct',
        fulfillmentType: 'in_person',
        createCustomerIfMissing: !effectiveCustomerId,
        loyaltyOptIn: Boolean(selectedCustomerId),
        idempotencyKey: saleAttemptIdRef.current,
        metadata: {
          source: 'direct_sales_central_pricing',
          customer_selection_mode: selectedCustomerId ? 'existing_customer' : 'counter_customer',
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

  if (loading) return <PageContainer title="Venda direta" subtitle="Carregando produtos para venda presencial." category="Comercial" flat><div className="flex min-h-[320px] items-center justify-center"><RefreshCw className="animate-spin text-[#19A999]" /></div></PageContainer>;

  return <PageContainer title="Venda direta" subtitle="Registre venda presencial com baixa de estoque, cliente, caixa e fidelidade." category="Comercial" flat>
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><Link to="/admin/sales" className="text-sm text-gray-500 hover:text-gray-700">← Voltar para vendas</Link><p className="mt-2 text-sm text-gray-500">A precificação usa o mesmo motor da loja pública e do PDV.</p></div>
        <Link to="/admin/pdv" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#19A999] to-[#14887B] px-5 py-3 text-sm font-bold text-white shadow-md">⚡ Abrir PDV</Link>
      </div>
      {lastOrderCode && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">Venda concluída: <strong>{lastOrderCode}</strong></div>}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4"><h2 className="text-lg font-semibold">Itens</h2><p className="text-xs text-gray-500">O desconto combinado é recalculado automaticamente pelo backend.</p></div>
          <div className="mb-4 grid gap-3 md:grid-cols-3"><input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Nome ou categoria" className="rounded-lg border px-3 py-2" /><select value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)} className="rounded-lg border px-3 py-2"><option value="all">Todas as categorias</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={productSort} onChange={(e) => setProductSort(e.target.value as ProductSortOption)} className="rounded-lg border px-3 py-2"><option value="name_asc">Nome A-Z</option><option value="name_desc">Nome Z-A</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option><option value="category_asc">Categoria</option></select></div>
          <div className="grid gap-3 md:grid-cols-[1fr_110px_160px_auto]"><select value={productId} onChange={(e) => setProductId(e.target.value)} className="rounded-lg border px-3 py-2"><option value="">Selecione um produto</option>{filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.name} — {formatCurrency(Number(product.price || 0))}</option>)}</select><input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="rounded-lg border px-3 py-2" /><input value={formatCurrency(manualDiscount)} onChange={(e) => setManualDiscount(parseCurrencyInput(e.target.value))} className="rounded-lg border px-3 py-2" /><button type="button" onClick={addItem} className="rounded-lg bg-[#19A999] px-4 py-2 font-semibold text-white">Adicionar</button></div>
          {pricingError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{pricingError}</p>}
          <div className="mt-5 space-y-2">{cart.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">Nenhum item adicionado.</p> : cart.map((item) => {
            const product = productMap.get(item.productId); const quote = quoteMap.get(item.productId); const lineTotal = Math.max(Number(quote?.line_total || 0) - item.manualDiscount, 0);
            return <div key={item.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{product?.name}</p><p className="text-xs text-gray-500">{quote ? `${formatCurrency(quote.base_price)} → ${formatCurrency(quote.unit_price)} · ${quote.pricing_group_name || quote.pricing_source}` : 'Calculando preço...'}</p></div><div className="flex items-center gap-3"><button onClick={() => changeQuantity(item.productId, -1)} className="rounded border px-3 py-1">−</button><strong>{item.quantity}</strong><button onClick={() => changeQuantity(item.productId, 1)} className="rounded border px-3 py-1">+</button><strong className="min-w-24 text-right">{formatCurrency(lineTotal)}</strong><button onClick={() => setCart((current) => current.filter((line) => line.productId !== item.productId))} className="text-sm text-red-600">Remover</button></div></div>;
          })}</div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Cliente e pagamento</h2><div className="space-y-3">
          <select value={selectedCustomerId} onChange={(e) => handleCustomer(e.target.value)} className="w-full rounded-lg border px-3 py-2"><option value="">Cliente de balcão</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name || customer.phone || 'Cliente'}</option>)}</select>
          {selectedCustomer && <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">Cliente identificado: <strong>{selectedCustomer.full_name}</strong>. Fidelidade habilitada.</div>}
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} readOnly={Boolean(selectedCustomerId)} className="w-full rounded-lg border px-3 py-2 read-only:bg-gray-50" /><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} readOnly={Boolean(selectedCustomerId)} placeholder="Telefone opcional" className="w-full rounded-lg border px-3 py-2 read-only:bg-gray-50" />
          <select value={paymentMethodCode} onChange={(e) => setPaymentMethodCode(e.target.value)} className="w-full rounded-lg border px-3 py-2"><option value="pending">Pagamento pendente / a combinar</option>{paymentMethods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</select>
          <div className="rounded-xl bg-gray-50 p-4 text-sm"><div className="flex justify-between"><span>Subtotal bruto</span><strong>{formatCurrency(totals.grossSubtotal)}</strong></div><div className="mt-2 flex justify-between"><span>Desc. quantidade</span><strong>-{formatCurrency(totals.quantityDiscount)}</strong></div><div className="mt-2 flex justify-between"><span>Desc. adicional</span><strong>-{formatCurrency(totals.additionalDiscount)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{formatCurrency(totals.total)}</span></div></div>
          <button type="button" onClick={() => void submitSale()} disabled={submitting || !cart.length || pricingLoading || !pricingQuote} className="w-full rounded-lg bg-[#19A999] px-4 py-3 font-semibold text-white disabled:opacity-50">{submitting ? 'Concluindo...' : pricingLoading ? 'Calculando...' : 'Concluir venda direta'}</button>
        </div></section>
      </div>
    </div>
  </PageContainer>;
}
