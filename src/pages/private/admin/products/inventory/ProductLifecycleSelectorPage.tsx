import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Activity, X, ExternalLink, Package, Boxes, SearchX } from 'lucide-react';
import { useProducts } from '@/pages/private/admin/products/products/hooks/useProducts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageContainer from '@/components/common/PageContainer';
import EmptyState from '@/components/common/empty-state/EmptyState';
import type { Product } from '@/pages/private/admin/products/products/types/product.types';

export default function ProductLifecycleSelectorPage() {
  const navigate = useNavigate();
  const { products, loading, lastUpdated, handleRefresh } = useProducts();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState<Product[]>([]);

  const activeProducts = useMemo(
    () => products.filter((p) => !p.is_discontinued),
    [products]
  );

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();

    activeProducts.forEach((product) => {
      if (product.category?.id && product.category?.name) {
        map.set(product.category.id, product.category.name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [activeProducts]);

  function getStockStatus(qty: number, min: number) {
    if (qty === 0) return 'out';
    if (qty <= min) return 'low';
    return 'ok';
  }

  const stockLabel = (qty: number, min: number) => {
    const status = getStockStatus(qty, min);

    if (status === 'out') {
      return {
        text: 'Sem estoque',
        cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };
    }

    if (status === 'low') {
      return {
        text: 'Estoque baixo',
        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      };
    }

    return {
      text: 'Em estoque',
      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return activeProducts.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category?.name?.toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === 'all' || p.category?.id === categoryFilter;

      const stockStatus = getStockStatus(p.stock_quantity ?? 0, p.min_stock ?? 0);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'ok' && stockStatus === 'ok') ||
        (statusFilter === 'low' && stockStatus === 'low') ||
        (statusFilter === 'out' && stockStatus === 'out');

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [activeProducts, search, categoryFilter, statusFilter]);

  const hasFilters =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  const isSelected = (p: Product) => selected.some((s) => s.id === p.id);
  const toggleSelect = (p: Product) => {
    setSelected((prev) =>
      prev.some((s) => s.id === p.id) ? prev.filter((s) => s.id !== p.id) : [...prev, p]
    );
  };
  const removeSelected = (id: string) => setSelected((prev) => prev.filter((s) => s.id !== id));
  const clearSelected = () => setSelected([]);
  const openSingle = (p: Product) => navigate(`/admin/products/${p.id}/lifecycle`);

  const hasAnyProducts = activeProducts.length > 0;
  const hasFilteredProducts = filtered.length > 0;
  const isFilteredEmpty = hasAnyProducts && !hasFilteredProducts;

  if (loading) return <LoadingSpinner />;

  if (!loading && !hasAnyProducts) {
    return (
      <PageContainer
        title="Vida do produto"
        subtitle="Selecione um produto para abrir sua visão 360º de estoque, movimentações e auditoria."
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
      >
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title="Ainda não há registros para esta operação"
          description="Assim que houver produtos ativos cadastrados, você poderá abrir a visão 360° de cada item."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Vida do produto"
      subtitle="Selecione um produto para abrir sua visão 360º de estoque, movimentações e auditoria."
      lastUpdated={lastUpdated}
      onRefresh={handleRefresh}
    >
      {selected.length > 0 && (
        <div className="rounded-2xl bg-[#21A896]/10 border border-[#21A896]/30 p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[#21A896]">
            {selected.length} produto{selected.length > 1 ? 's' : ''} selecionado{selected.length > 1 ? 's' : ''}:
          </span>
          <div className="flex flex-wrap gap-2 flex-1">
            {selected.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-[#21A896]/40 rounded-full px-3 py-1 text-sm">
                <span className="font-medium text-gray-800 dark:text-white">{p.name}</span>
                <button type="button" onClick={() => removeSelected(p.id)} className="text-gray-400 hover:text-red-500 transition" title="Remover">
                  <X size={13} />
                </button>
                <button type="button" onClick={() => openSingle(p)} className="text-[#21A896] hover:text-[#1a867a] transition" title="Abrir">
                  <ExternalLink size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button type="button" onClick={clearSelected} className="text-xs text-gray-500 hover:text-red-500 transition underline">
              Limpar seleção
            </button>
            <button
              type="button"
              onClick={() => openSingle(selected[0])}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#21A896] hover:bg-[#1a867a] text-white text-sm font-semibold rounded-xl transition"
            >
              <Activity size={15} />
              {selected.length === 1 ? 'Ver vida do produto' : 'Abrir produtos selecionados'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou categoria"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full py-2.5 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
          >
            <option value="all">Todas as categorias</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2.5 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
            >
              <option value="all">Todos os status</option>
              <option value="ok">Em estoque</option>
              <option value="low">Estoque baixo</option>
              <option value="out">Sem estoque</option>
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {hasFilters && (
          <p className="text-xs text-gray-400">
            {filtered.length} de {activeProducts.length} produto{activeProducts.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {isFilteredEmpty ? (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title="Nenhum resultado para os filtros aplicados"
          description="Os filtros atuais não retornaram resultados. Limpe os filtros ou busque por outro nome ou categoria."
          action={
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const sel = isSelected(p);
            const stock = stockLabel(p.stock_quantity, p.min_stock ?? 0);
            return (
              <div
                key={p.id}
                onClick={() => toggleSelect(p)}
                className={`relative rounded-2xl border-2 cursor-pointer transition-all duration-150 p-4 flex flex-col gap-3 group ${
                  sel
                    ? 'border-[#21A896] bg-[#21A896]/5 shadow-md shadow-[#21A896]/10'
                    : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#21A896]/40 hover:shadow-sm'
                }`}
              >
                <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                  sel ? 'border-[#21A896] bg-[#21A896]' : 'border-gray-300 dark:border-gray-600 group-hover:border-[#21A896]/60'
                }`}>
                  {sel && (
                    <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="h-28 sm:h-32 w-full object-cover rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={28} className="text-gray-300 dark:text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 pr-6">{p.name}</p>
                  {p.category && <p className="text-xs text-gray-400 truncate">{p.category.name}</p>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stock.cls}`}>{stock.text}</span>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{p.stock_quantity} un.</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openSingle(p); }}
                  className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-[#21A896] hover:text-white text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-xl transition-all duration-150"
                >
                  <Activity size={13} />
                  Ver vida do produto
                </button>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
