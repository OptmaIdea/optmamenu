import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import { DirectSalesService } from '@/services/directSalesService';

type ProductOption = {
  id: string;
  name: string;
  price: number | null;
};

type CartLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function DirectSalesPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('Cliente balcão');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethodCode, setPaymentMethodCode] = useState('pending');
  const [lastOrderCode, setLastOrderCode] = useState<string | null>(null);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [cart]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const activeStoreId = getActiveStoreId();
        if (!activeStoreId) throw new Error('Nenhuma loja ativa selecionada.');
        setStoreId(activeStoreId);

        const { data, error } = await supabase
          .from('products')
          .select('id, name, price')
          .eq('store_id', activeStoreId)
          .eq('active', true)
          .order('name', { ascending: true });

        if (error) throw error;
        setProducts((data || []) as ProductOption[]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar produtos.');
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
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    setCart((current) => [
      ...current,
      {
        productId: product.id,
        quantity: normalizedQuantity,
        unitPrice: Number(product.price || 0),
      },
    ]);
    setProductId('');
    setQuantity(1);
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
          discount: 0,
        })),
        customerName,
        customerPhone,
        paymentMethodCode,
        salesChannel: 'direct',
        fulfillmentType: 'in_person',
        createCustomerIfMissing: true,
        loyaltyOptIn: true,
        metadata: { source: 'direct_sales_minimal_ui' },
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
      <PageContainer>
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#21A896]" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <Link to="/admin/orders" className="text-sm text-gray-500 hover:text-gray-700">
            ← Voltar para pedidos
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Venda direta</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Fluxo mínimo para registrar venda presencial com baixa de estoque, cliente, caixa e fidelidade.
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

            <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
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
                  return (
                    <div key={`${item.productId}-${index}`} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
                      <span className="text-gray-900 dark:text-white">{product?.name || item.productId}</span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </span>
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

              <input
                value={paymentMethodCode}
                onChange={(event) => setPaymentMethodCode(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                placeholder="Código do pagamento. Ex.: cash, pix"
              />

              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>Itens</span>
                  <strong>{cart.length}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between text-lg font-bold text-gray-900 dark:text-white">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
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
