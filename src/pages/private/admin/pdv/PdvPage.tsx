import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingCart,
} from 'lucide-react';
import PdvLayout from '@/components/layouts/PdvLayout';
import { usePermissions } from '@/hooks/usePermissions';
import { useRealtimeListener } from '@/hooks/useRealtimeListener';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { getPosBootstrap } from '@/services/pdvService';
import type { PosBootstrap, PosProduct } from '@/types/pdv';
import { getActiveStoreId } from '@/utils/activeStore';
import { hasOnlyPdvOperationalAccess } from '@/utils/permissions';

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

export default function PdvPage() {
  const storeId = getActiveStoreId();
  const { permissions } = usePermissions(storeId);
  const [bootstrap, setBootstrap] = useState<PosBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [online, setOnline] = useState(() => navigator.onLine);

  const loadBootstrap = useCallback(
    async (requestedLocationId?: string | null, allowFallback = true) => {
      if (!storeId) return;

      setError(null);
      setRefreshing(Boolean(bootstrap));

      try {
        const data = await getPosBootstrap(storeId, requestedLocationId);
        setBootstrap(data);

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

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar o PDV.';
        setError(message);
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
    // A carga inicial deve ocorrer somente quando a loja muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

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

  const showAdminExit = !hasOnlyPdvOperationalAccess(permissions);

  return (
    <PdvLayout
      storeName={bootstrap?.store.name}
      operatorName={bootstrap?.operator.name}
      locationName={selectedLocation?.name}
      online={online}
      showAdminExit={showAdminExit}
    >
      <div className="mx-auto grid max-w-[1800px] gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
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
                onChange={(event) => void loadBootstrap(event.target.value)}
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
                  product.codes.find((code) => code.is_primary) ??
                  product.codes[0];
                const outOfStock = product.available_stock <= 0;

                return (
                  <article
                    key={product.id}
                    className="flex min-h-44 flex-col rounded-2xl border border-[#6B6258]/10 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          outOfStock
                            ? 'bg-[#DC2626]/10 text-[#DC2626]'
                            : 'bg-[#21A896]/10 text-[#1A867A]'
                        }`}
                      >
                        <Boxes size={21} aria-hidden="true" />
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                          outOfStock
                            ? 'bg-[#DC2626] text-white'
                            : product.available_stock <= 5
                              ? 'bg-[#FBA93C] text-[#2D2A26]'
                              : 'bg-[#21A896]/10 text-[#1A867A]'
                        }`}
                      >
                        {product.available_stock} disponível
                      </span>
                    </div>

                    <h3 className="line-clamp-2 text-sm font-bold leading-tight">
                      {product.name}
                    </h3>
                    {primaryCode && (
                      <p className="mt-1 truncate text-[11px] text-[#6B6258] dark:text-gray-400">
                        {primaryCode.type.toUpperCase()}: {primaryCode.value}
                      </p>
                    )}
                    <p className="mt-auto pt-3 text-lg font-black text-[#7B2D8E]">
                      {formatCurrency(product.price)}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-[84px] rounded-2xl border border-[#6B6258]/10 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7B2D8E]/10 text-[#7B2D8E]">
                <ShoppingCart size={23} aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-bold">Carrinho</h2>
                <p className="text-xs text-[#6B6258] dark:text-gray-400">
                  Fundação operacional pronta
                </p>
              </div>
            </div>
            <div className="my-5 rounded-xl border border-dashed border-[#6B6258]/20 p-5 text-center">
              <p className="text-sm font-semibold">Nenhum item adicionado</p>
              <p className="mt-1 text-xs text-[#6B6258] dark:text-gray-400">
                Inclusão, quantidade e pagamento entram na próxima etapa do PDV.
              </p>
            </div>
            <button
              type="button"
              disabled
              className="min-h-12 w-full cursor-not-allowed rounded-xl bg-[#6B6258]/15 text-sm font-bold text-[#6B6258]"
            >
              Finalizar venda
            </button>
          </div>
        </aside>
      </div>

      {refreshing && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#2D2A26] px-4 py-2 text-xs font-semibold text-white shadow-lg">
          <RefreshCw size={14} className="animate-spin" />
          Atualizando estoque
        </div>
      )}
    </PdvLayout>
  );
}
