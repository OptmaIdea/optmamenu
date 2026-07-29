import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Minus,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import PdvLayout from '@/components/layouts/PdvLayout';
import { usePermissions } from '@/hooks/usePermissions';
import { useRealtimeListener } from '@/hooks/useRealtimeListener';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { DirectSalesService } from '@/services/directSalesService';
import {
  getPosBootstrap,
  getPosPaymentMethods,
  getPosPricingQuote,
} from '@/services/pdvService';
import type {
  PosBootstrap,
  PosPaymentMethod,
  PosPricingItem,
  PosPricingQuote,
  PosProduct,
} from '@/types/pdv';
import { getActiveStoreId } from '@/utils/activeStore';
import { hasOnlyPdvOperationalAccess } from '@/utils/permissions';

type CartLine = {
  product: PosProduct;
  quantity: number;
};

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getLocationStorageKey(storeId: string): string {
  return `optmamenu_pos_location_${storeId}`;
}

function getCartStorageKey(storeId: string, locationId: string | null): string {
  return `optmamenu_pos_cart_${storeId}_${locationId ?? 'default'}`;
}

function getPricingSourceLabel(item: PosPricingItem): string {
  switch (item.pricing_source) {
    case 'category_combined_volume':
      return `Atacado da categoria • ${item.pricing_quantity} un. combinadas`;
    case 'category_per_product_volume':
      return `Atacado da categoria • ${item.pricing_quantity} un. do produto`;
    case 'category_standard':
      return 'Preço da categoria';
    case 'product_volume':
      return `Atacado do produto • ${item.pricing_quantity} un.`;
    default:
      return 'Preço do produto';
  }
}

function matchesSearch(product: PosProduct, rawSearch: string): boolean {
  const normalized = normalizeSearch(rawSearch);
  if (!normalized) return true;

  return (
    normalizeSearch(product.name).includes(normalized) ||
    product.codes.some(
      (code) =>
        code.normalized.includes(normalized) ||
        normalizeSearch(code.value).includes(normalized)
    )
  );
}

type CartPanelProps = {
  cart: CartLine[];
  pricingQuote: PosPricingQuote | null;
  pricingLoading: boolean;
  pricingError: string | null;
  paymentMethods: PosPaymentMethod[];
  paymentMethodCode: string;
  setPaymentMethodCode: (value: string) => void;
  cashReceived: string;
  setCashReceived: (value: string) => void;
  shortageConfirmed: boolean;
  setShortageConfirmed: (value: boolean) => void;
  processing: boolean;
  onChangeQuantity: (product: PosProduct, quantity: number) => void;
  onClear: () => void;
  onFinalize: () => void;
};

function CartPanel({
  cart,
  pricingQuote,
  pricingLoading,
  pricingError,
  paymentMethods,
  paymentMethodCode,
  setPaymentMethodCode,
  cashReceived,
  setCashReceived,
  shortageConfirmed,
  setShortageConfirmed,
  processing,
  onChangeQuantity,
  onClear,
  onFinalize,
}: CartPanelProps) {
  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);
  const baseSubtotal = cart.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0
  );
  const subtotal = pricingQuote?.subtotal ?? baseSubtotal;
  const shortageLines = cart.filter(
    (line) => line.quantity > line.product.available_stock
  );
  const received = Number(cashReceived.replace(',', '.')) || 0;
  const change = paymentMethodCode === 'cash' ? Math.max(0, received - subtotal) : 0;
  const canFinalize =
    cart.length > 0 &&
    !pricingLoading &&
    !pricingError &&
    Boolean(pricingQuote) &&
    Boolean(paymentMethodCode) &&
    (!shortageLines.length || shortageConfirmed) &&
    (paymentMethodCode !== 'cash' || received >= subtotal);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-[#6B6258]/10 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7B2D8E]/10 text-[#7B2D8E] dark:text-purple-300">
            <ShoppingCart size={21} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-bold">Carrinho</h2>
            <p className="text-xs text-[#6B6258] dark:text-gray-400">
              {totalItems} {totalItems === 1 ? 'item' : 'itens'}
            </p>
          </div>
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-[#DC2626] hover:bg-[#DC2626]/10"
          >
            <Trash2 size={16} />
            Limpar
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="my-5 rounded-xl border border-dashed border-[#6B6258]/20 p-5 text-center">
          <p className="text-sm font-semibold">Nenhum item adicionado</p>
          <p className="mt-1 text-xs text-[#6B6258] dark:text-gray-400">
            Toque em um produto para iniciar a venda.
          </p>
        </div>
      ) : (
        <div className="my-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {cart.map(({ product, quantity }) => {
            const hasShortage = quantity > product.available_stock;
            const pricedLine = pricingQuote?.items.find(
              (item) => item.product_id === product.id
            );
            const hasAutomaticDiscount =
              Boolean(pricedLine) &&
              Number(pricedLine?.unit_price) < Number(pricedLine?.base_price);
            return (
              <div
                key={product.id}
                className={`rounded-xl border p-2.5 ${
                  hasShortage
                    ? 'border-[#FBA93C]/60 bg-[#FBA93C]/10'
                    : 'border-[#6B6258]/10 bg-[#F8F6F2] dark:border-gray-800 dark:bg-gray-950'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white dark:bg-gray-800">
                    {product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#21A896]">
                        <Boxes size={20} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{product.name}</p>
                    <p className="text-xs font-semibold text-[#7B2D8E] dark:text-purple-300">
                      {formatCurrency(
                        pricedLine?.line_total ?? product.price * quantity
                      )}
                    </p>
                    {pricedLine && (
                      <p
                        className={`mt-0.5 text-[10px] font-semibold ${
                          hasAutomaticDiscount
                            ? 'text-[#1A867A] dark:text-teal-300'
                            : 'text-[#6B6258] dark:text-gray-400'
                        }`}
                      >
                        {formatCurrency(pricedLine.unit_price)}/un. •{' '}
                        {getPricingSourceLabel(pricedLine)}
                      </p>
                    )}
                    {hasAutomaticDiscount && pricedLine && (
                      <p className="mt-0.5 text-[10px] text-[#6B6258] line-through dark:text-gray-500">
                        Preço-base: {formatCurrency(pricedLine.base_price)}/un.
                      </p>
                    )}
                    {hasShortage && (
                      <p className="mt-0.5 text-[10px] font-bold text-[#8A5A00] dark:text-amber-300">
                        Divergência: {quantity - product.available_stock} sem saldo
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onChangeQuantity(product, 0)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#DC2626] hover:bg-[#DC2626]/10"
                    aria-label={`Remover ${product.name}`}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeQuantity(product, quantity - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#6B6258]/15 bg-white dark:border-gray-700 dark:bg-gray-900"
                    aria-label={`Diminuir ${product.name}`}
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={quantity}
                    onChange={(event) =>
                      onChangeQuantity(product, Math.max(1, Number(event.target.value) || 1))
                    }
                    className="h-9 w-14 rounded-lg border border-[#6B6258]/15 bg-white text-center text-sm font-black dark:border-gray-700 dark:bg-gray-900"
                    aria-label={`Quantidade de ${product.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => onChangeQuantity(product, quantity + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#21A896] text-white"
                    aria-label={`Aumentar ${product.name}`}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cart.length > 0 && (
        <div className="space-y-3 border-t border-[#6B6258]/10 pt-3 dark:border-gray-800">
          {pricingLoading && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1A867A] dark:text-teal-300">
              <RefreshCw size={13} className="animate-spin" />
              Calculando o melhor preço...
            </p>
          )}
          {pricingError && (
            <p className="rounded-lg bg-[#DC2626]/10 px-2.5 py-2 text-xs font-semibold text-[#DC2626]">
              {pricingError}
            </p>
          )}
          {pricingQuote && pricingQuote.total_discount > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-[#21A896]/10 px-3 py-2 text-xs font-bold text-[#1A867A] dark:text-teal-300">
              <span>Desconto automático</span>
              <span>- {formatCurrency(pricingQuote.total_discount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-xl font-black text-[#7B2D8E] dark:text-purple-300">
              {formatCurrency(subtotal)}
            </span>
          </div>
          {pricingQuote && pricingQuote.total_discount > 0 && (
            <p className="text-right text-[10px] text-[#6B6258] dark:text-gray-400">
              Valor sem desconto: {formatCurrency(pricingQuote.base_subtotal)}
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-bold">Forma de pagamento</span>
            <select
              value={paymentMethodCode}
              onChange={(event) => setPaymentMethodCode(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#6B6258]/15 bg-white px-3 text-sm font-semibold dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="">Selecione</option>
              {paymentMethods
                .filter((method) => method.code !== 'pending')
                .map((method) => (
                  <option key={method.code} value={method.code}>
                    {method.name}
                  </option>
                ))}
            </select>
          </label>

          {paymentMethodCode === 'cash' && (
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="mb-1 block text-xs font-bold">Dinheiro recebido</span>
                <input
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="h-11 w-full rounded-xl border border-[#6B6258]/15 bg-white px-3 text-sm font-semibold dark:border-gray-700 dark:bg-gray-950"
                />
              </label>
              <div>
                <span className="mb-1 block text-xs font-bold">Troco</span>
                <div className="flex h-11 items-center rounded-xl bg-[#21A896]/10 px-3 text-sm font-black text-[#1A867A]">
                  {formatCurrency(change)}
                </div>
              </div>
            </div>
          )}

          {shortageLines.length > 0 && (
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#FBA93C]/50 bg-[#FBA93C]/10 p-3">
              <input
                type="checkbox"
                checked={shortageConfirmed}
                onChange={(event) => setShortageConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#F26541]"
              />
              <span className="text-xs font-semibold text-[#684600] dark:text-amber-200">
                Continuar a venda e registrar a divergência de estoque para reconciliação.
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={onFinalize}
            disabled={!canFinalize || processing}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#F26541] text-sm font-black text-white transition hover:bg-[#D94F2E] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {processing ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {processing ? 'Concluindo...' : 'Concluir venda'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PdvPage() {
  const storeId = getActiveStoreId();
  const { permissions } = usePermissions(storeId);
  const [bootstrap, setBootstrap] = useState<PosBootstrap | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PosPaymentMethod[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pricingQuote, setPricingQuote] = useState<PosPricingQuote | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [paymentMethodCode, setPaymentMethodCode] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [shortageConfirmed, setShortageConfirmed] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [online, setOnline] = useState(() => navigator.onLine);
  const saleAttemptIdRef = useRef(uuidv4());

  const loadBootstrap = useCallback(
    async (requestedLocationId?: string | null, allowFallback = true) => {
      if (!storeId) return;

      setError(null);
      setRefreshing(Boolean(bootstrap));

      try {
        const [data, methods] = await Promise.all([
          getPosBootstrap(storeId, requestedLocationId),
          getPosPaymentMethods(storeId),
        ]);
        setBootstrap(data);
        setPaymentMethods(methods);

        if (data.selected_location_id) {
          localStorage.setItem(
            getLocationStorageKey(storeId),
            data.selected_location_id
          );
        }
      } catch (loadError) {
        if (requestedLocationId && allowFallback) {
          localStorage.removeItem(getLocationStorageKey(storeId));
          await loadBootstrap(null, false);
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar o PDV.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId, bootstrap]
  );

  useEffect(() => {
    if (!storeId) return;
    const savedLocationId = localStorage.getItem(getLocationStorageKey(storeId));
    void loadBootstrap(savedLocationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !bootstrap) return;
    const storageKey = getCartStorageKey(storeId, bootstrap.selected_location_id);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as Array<{
        productId: string;
        quantity: number;
      }>;
      setCart(
        saved.flatMap((line) => {
          const product = bootstrap.products.find((item) => item.id === line.productId);
          return product && line.quantity > 0
            ? [{ product, quantity: line.quantity }]
            : [];
        })
      );
    } catch {
      setCart([]);
    }
  }, [storeId, bootstrap?.selected_location_id]);

  useEffect(() => {
    if (!storeId || !bootstrap) return;
    localStorage.setItem(
      getCartStorageKey(storeId, bootstrap.selected_location_id),
      JSON.stringify(
        cart.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        }))
      )
    );
  }, [cart, storeId, bootstrap]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const currentManifest = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]'
    );
    const manifest = currentManifest ?? document.createElement('link');
    const previousHref = currentManifest?.getAttribute('href') ?? null;
    const createdManifest = !currentManifest;

    manifest.rel = 'manifest';
    manifest.href = '/pdv.webmanifest?v=3';
    manifest.dataset.pdvManifest = 'true';

    if (createdManifest) {
      document.head.appendChild(manifest);
    }

    document.title = 'PDV | OptmaMenu';

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/pdv-sw.js', { scope: '/pdv' });
    }

    return () => {
      delete manifest.dataset.pdvManifest;
      if (createdManifest) {
        manifest.remove();
      } else if (previousHref) {
        manifest.href = previousHref;
      }
      document.title = 'OptmaMenu';
    };
  }, []);

  useEffect(() => {
    if (!storeId || cart.length === 0) {
      setPricingQuote(null);
      setPricingError(null);
      setPricingLoading(false);
      return;
    }

    let active = true;
    setPricingQuote(null);
    setPricingLoading(true);
    setPricingError(null);

    const timeoutId = window.setTimeout(() => {
      void getPosPricingQuote(
        storeId,
        cart.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        }))
      )
        .then((quote) => {
          if (!active) return;
          setPricingQuote(quote);
        })
        .catch(() => {
          if (!active) return;
          setPricingQuote(null);
          setPricingError(
            'Não foi possível confirmar os preços. Tente atualizar o carrinho.'
          );
        })
        .finally(() => {
          if (active) setPricingLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [cart, storeId]);

  const refresh = useCallback(async () => {
    await loadBootstrap(bootstrap?.selected_location_id ?? null);
  }, [bootstrap?.selected_location_id, loadBootstrap]);

  useRefreshFrame(refresh);
  useRealtimeListener({
    channelName: `pdv_inventory_${storeId ?? 'waiting'}`,
    tables: storeId
      ? [
          {
            table: 'inventory_location_balances',
            filter: `store_id=eq.${storeId}`,
          },
        ]
      : [],
    onChanged: refresh,
    enabled: Boolean(storeId && bootstrap),
  });

  const selectedLocation = bootstrap?.locations.find(
    (location) => location.id === bootstrap.selected_location_id
  );

  const filteredProducts = useMemo(() => {
    if (!bootstrap) return [];
    return bootstrap.products.filter(
      (product) =>
        (categoryId === 'all' || product.category_id === categoryId) &&
        matchesSearch(product, search)
    );
  }, [bootstrap, categoryId, search]);

  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal =
    pricingQuote?.subtotal ??
    cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const showAdminExit = !hasOnlyPdvOperationalAccess(permissions);

  const changeQuantity = useCallback((product: PosProduct, quantity: number) => {
    saleAttemptIdRef.current = uuidv4();
    setShortageConfirmed(false);
    setCart((current) => {
      if (quantity <= 0) return current.filter((line) => line.product.id !== product.id);
      const exists = current.some((line) => line.product.id === product.id);
      return exists
        ? current.map((line) =>
            line.product.id === product.id ? { product, quantity } : line
          )
        : [...current, { product, quantity }];
    });
  }, []);

  const clearCart = useCallback(() => {
    saleAttemptIdRef.current = uuidv4();
    setCart([]);
    setPaymentMethodCode('');
    setCashReceived('');
    setShortageConfirmed(false);
  }, []);

  const finalizeSale = async () => {
    if (
      !storeId ||
      !bootstrap?.selected_location_id ||
      cart.length === 0 ||
      !pricingQuote ||
      pricingLoading
    ) {
      return;
    }

    setProcessing(true);
    try {
      const shortageItems = cart
        .filter((line) => line.quantity > line.product.available_stock)
        .map((line) => ({
          product_id: line.product.id,
          product_name: line.product.name,
          requested: line.quantity,
          available: line.product.available_stock,
          shortage: line.quantity - line.product.available_stock,
        }));

      const quoteMap = new Map((pricingQuote?.items || []).map((item) => [item.product_id, item]));

      const result = await DirectSalesService.createAdminDirectSale({
        storeId,
        locationId: bootstrap.selected_location_id,
        items: cart.map((line) => {
          const quote = quoteMap.get(line.product.id);
          return {
            productId: line.product.id,
            quantity: line.quantity,
            unitPrice: quote?.unit_price ?? line.product.price,
            originalUnitPrice: quote?.base_price ?? line.product.price,
            pricingSource: quote?.pricing_source ?? (line.product.use_category_pricing ? 'category_standard' : 'product_base_price'),
            priceRule: quote?.applied_tier ?? null,
            metadata: {
              category_id: quote?.category_id ?? line.product.category_id,
              category_name: quote?.category_name ?? null,
              pricing_group_id: quote?.pricing_group_id ?? null,
              pricing_group_name: quote?.pricing_group_name ?? null,
              pricing_quantity: quote?.pricing_quantity ?? line.quantity,
              applied_tier_min_quantity: quote?.applied_tier?.min ?? null,
              applied_tier_price: quote?.applied_tier?.price ?? null,
            },
          };
        }),
        paymentMethodCode,
        salesChannel: 'in_person',
        fulfillmentType: 'in_person',
        createCustomerIfMissing: false,
        loyaltyOptIn: false,
        idempotencyKey: saleAttemptIdRef.current,
        metadata: {
          source: 'dedicated_pos',
          allow_stock_exception: shortageItems.length > 0,
          stock_exception_items: shortageItems,
        },
      });

      toast.success(
        `Venda ${result.order?.order_code ?? ''} concluída com sucesso.`
      );
      clearCart();
      setMobileCartOpen(false);
      await refresh();
    } catch (saleError) {
      const message =
        saleError instanceof Error ? saleError.message : 'Não foi possível concluir a venda.';
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const cartPanel = (
    <CartPanel
      cart={cart}
      pricingQuote={pricingQuote}
      pricingLoading={pricingLoading}
      pricingError={pricingError}
      paymentMethods={paymentMethods}
      paymentMethodCode={paymentMethodCode}
      setPaymentMethodCode={(value) => {
        saleAttemptIdRef.current = uuidv4();
        setPaymentMethodCode(value);
        setCashReceived('');
      }}
      cashReceived={cashReceived}
      setCashReceived={setCashReceived}
      shortageConfirmed={shortageConfirmed}
      setShortageConfirmed={setShortageConfirmed}
      processing={processing}
      onChangeQuantity={changeQuantity}
      onClear={clearCart}
      onFinalize={() => void finalizeSale()}
    />
  );

  return (
    <PdvLayout
      storeName={bootstrap?.store.name}
      operatorName={bootstrap?.operator.name}
      operatorAvatarUrl={bootstrap?.operator.avatar_url}
      locationName={selectedLocation?.name}
      online={online}
      showAdminExit={showAdminExit}
    >
      <div className="mx-auto grid max-w-[1800px] gap-4 p-3 pb-24 sm:p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-4">
        <section className="min-w-0">
          <div className="mb-3 grid gap-3 rounded-2xl border border-[#6B6258]/10 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_240px] dark:border-gray-800 dark:bg-gray-900">
            <label className="relative block">
              <span className="sr-only">Buscar produto</span>
              <Search
                size={21}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6258]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, código interno, SKU ou EAN"
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-[#6B6258]/15 bg-[#F8F6F2] pl-11 pr-3 text-base font-medium outline-none transition focus:border-[#21A896] focus:ring-2 focus:ring-[#21A896]/15 dark:border-gray-700 dark:bg-gray-950"
              />
            </label>

            <label className="block">
              <span className="sr-only">Local de estoque</span>
              <select
                value={bootstrap?.selected_location_id ?? ''}
                onChange={(event) => {
                  if (cart.length > 0) {
                    toast.warning('Limpe o carrinho antes de trocar o local.');
                    return;
                  }
                  void loadBootstrap(event.target.value);
                }}
                className="h-12 w-full rounded-xl border border-[#6B6258]/15 bg-white px-3 text-sm font-semibold outline-none focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-950"
                disabled={!bootstrap || bootstrap.locations.length <= 1}
              >
                {bootstrap?.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryId('all')}
              className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition ${
                categoryId === 'all'
                  ? 'bg-[#21A896] text-white'
                  : 'border border-[#6B6258]/10 bg-white text-[#2D2A26] hover:bg-[#21A896]/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
              }`}
            >
              Todos
            </button>
            {bootstrap?.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition ${
                  categoryId === category.id
                    ? 'bg-[#21A896] text-white'
                    : 'border border-[#6B6258]/10 bg-white text-[#2D2A26] hover:bg-[#21A896]/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex min-h-80 items-center justify-center rounded-2xl border border-[#6B6258]/10 bg-white dark:border-gray-800 dark:bg-gray-900">
              <RefreshCw className="animate-spin text-[#21A896]" size={34} />
            </div>
          ) : error ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-[#DC2626]/20 bg-white p-6 text-center dark:bg-gray-900">
              <AlertTriangle size={38} className="mb-3 text-[#DC2626]" />
              <h2 className="text-lg font-bold">Não foi possível abrir o PDV</h2>
              <p className="mt-1 max-w-lg text-sm text-[#6B6258] dark:text-gray-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-5 min-h-11 rounded-xl bg-[#F26541] px-5 text-sm font-bold text-white"
              >
                Tentar novamente
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-[#6B6258]/10 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
              <PackageSearch size={42} className="mb-3 text-[#7B2D8E]" />
              <h2 className="text-lg font-bold">Nenhum produto encontrado</h2>
              <p className="mt-1 text-sm text-[#6B6258] dark:text-gray-400">
                Revise a busca ou escolha outra categoria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredProducts.map((product) => {
                const primaryCode =
                  product.codes.find((code) => code.is_primary) ?? product.codes[0];
                const quantity =
                  cart.find((line) => line.product.id === product.id)?.quantity ?? 0;
                const outOfStock = product.available_stock <= 0;

                return (
                  <article
                    key={product.id}
                    className="group flex min-h-56 flex-col overflow-hidden rounded-2xl border border-[#6B6258]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                  >
                    <button
                      type="button"
                      onClick={() => changeQuantity(product, quantity + 1)}
                      className="relative block aspect-[4/3] w-full overflow-hidden bg-[#F8F6F2] text-left dark:bg-gray-950"
                      aria-label={`Adicionar ${product.name}`}
                    >
                      {product.images[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#21A896]">
                          <Boxes size={34} aria-hidden="true" />
                        </div>
                      )}
                      <span
                        className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm ${
                          outOfStock
                            ? 'bg-[#DC2626] text-white'
                            : product.available_stock <= 5
                              ? 'bg-[#FBA93C] text-[#2D2A26]'
                              : 'bg-white/95 text-[#1A867A] dark:bg-gray-900/95'
                        }`}
                      >
                        {product.available_stock} disp.
                      </span>
                    </button>

                    <div className="flex flex-1 flex-col p-3">
                      <h3 className="line-clamp-2 text-sm font-bold leading-tight">
                        {product.name}
                      </h3>
                      {primaryCode && (
                        <p className="mt-1 truncate text-[10px] text-[#6B6258] dark:text-gray-400">
                          {primaryCode.type.toUpperCase()}: {primaryCode.value}
                        </p>
                      )}
                      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                        <p className="text-base font-black text-[#7B2D8E] dark:text-purple-300">
                          {formatCurrency(product.price)}
                        </p>
                        <button
                          type="button"
                          onClick={() => changeQuantity(product, quantity + 1)}
                          className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-[#21A896] px-2 text-sm font-black text-white"
                          aria-label={`Adicionar ${product.name}`}
                        >
                          {quantity > 0 ? quantity : <Plus size={18} />}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 lg:block">
          <div className="sticky top-[84px] max-h-[calc(100vh-100px)] rounded-2xl border border-[#6B6258]/10 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {cartPanel}
          </div>
        </aside>
      </div>

      <button
        type="button"
        onClick={() => setMobileCartOpen(true)}
        className="fixed bottom-3 left-3 right-3 z-30 flex min-h-14 items-center justify-between rounded-2xl bg-[#7B2D8E] px-4 text-white shadow-2xl lg:hidden"
      >
        <span className="flex items-center gap-2 font-bold">
          <ShoppingCart size={20} />
          Carrinho ({totalItems})
        </span>
        <span className="font-black">{formatCurrency(cartTotal)}</span>
      </button>

      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setMobileCartOpen(false)}
            aria-label="Fechar carrinho"
          />
          <div className="relative z-10 max-h-[92vh] w-full rounded-t-3xl bg-white p-4 shadow-2xl dark:bg-gray-900">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Fechar carrinho"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[calc(92vh-64px)] overflow-y-auto">{cartPanel}</div>
          </div>
        </div>
      )}

      {refreshing && (
        <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#2D2A26] px-4 py-2 text-xs font-semibold text-white shadow-lg lg:bottom-4">
          <RefreshCw size={14} className="animate-spin" />
          Atualizando estoque
        </div>
      )}
    </PdvLayout>
  );
}
