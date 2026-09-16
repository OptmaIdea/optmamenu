import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Activity, X, Package, Boxes, SearchX } from 'lucide-react';
import { useProducts } from '@/pages/private/admin/products/products/hooks/useProducts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageContainer from '@/components/common/PageContainer';
import EmptyState from '@/components/common/empty-state/EmptyState';
import { supabase } from '@/lib/supabase';
import { formatNumberPtBr } from '@/utils/export/formatters';
import { getActiveStoreId } from '@/utils/activeStore';

const actionLabelMap: Record<string, string> = {
  buy: 'Comprar',
  transfer: 'Transferir',
  transfer_or_redistribute: 'Transferir',
  monitor: 'Monitorar',
  review_excess: 'Revisar excesso',
  ok: 'OK',
};

const actionClassMap: Record<string, string> = {
  buy: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  transfer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  transfer_or_redistribute: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  monitor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  review_excess: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export default function ProductLifecycleSelectorPage() {
  const navigate = useNavigate();
  const { products, loading, lastUpdated, handleRefresh } = useProducts();
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'category-asc' | 'category-desc'>('name-asc');
  const [managementMap, setManagementMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const fetchManagementData = async () => {
      const activeStoreId = getActiveStoreId();

      if (!activeStoreId) {
        console.warn('Nenhuma loja ativa encontrada para Vida do Produto.');
        setManagementMap(new Map());
        return;
      }

      const { data: managementRows, error: managementError } = await supabase.rpc(
        'get_inventory_management_products',
        {
          p_store_id: activeStoreId,
          p_recommended_action: null,
          p_limit: 1000,
        },
      );

      if (managementError) {
        console.error('Erro ao carregar diagnóstico gerencial:', managementError);
        return;
      }

      const map = new Map<string, any>((managementRows || []).map((row: any) => [row.product_id, row]));
      setManagementMap(map);
    };

    if (products.length > 0) {
      void fetchManagementData();
    }
  }, [lastUpdated, products.length]);

  const activeProducts = useMemo(() => {
    return products
      .filter((p) => !p.is_discontinued)
      .map((product) => {
        const management = managementMap.get(product.id);
        return {
          ...product,
          global_available: Number(management?.global_available ?? 0),
          global_on_hand: Number(management?.global_on_hand ?? 0),
          global_reserved: Number(management?.global_reserved ?? 0),
          global_status: management?.global_status ?? 'global_ok',
          recommended_action: management?.recommended_action ?? 'ok',
          location_stockout_count: Number(management?.location_stockout_count ?? 0),
          location_critical_count: Number(management?.location_critical_count ?? 0),
          possible_source_locations: Number(management?.possible_source_locations ?? 0),
        } as any;
      });
  }, [products, managementMap]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();

    activeProducts.forEach((product) => {
      if (product.category?.id && product.category?.name) {
        map.set(product.category.id, product.category.name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [activeProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let base = activeProducts.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category?.name?.toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === 'all' || p.category?.id === categoryFilter;

      return matchesSearch && matchesCategory;
    });

    if (selectedAction !== 'all') {
      base = base.filter((product) => {
        if (selectedAction === 'transfer') {
          return (
            product.recommended_action === 'transfer' ||
            product.recommended_action === 'transfer_or_redistribute'
          );
        }

        return product.recommended_action === selectedAction;
      });
    }

    return [...base].sort((a, b) => {
      const aCategory = a.category?.name?.toLowerCase() ?? '';
      const bCategory = b.category?.name?.toLowerCase() ?? '';
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      switch (sortBy) {
        case 'name-asc':
          return aName.localeCompare(bName, 'pt-BR');
        case 'name-desc':
          return bName.localeCompare(aName, 'pt-BR');
        case 'category-desc':
          return (
            bCategory.localeCompare(aCategory, 'pt-BR') ||
            aName.localeCompare(bName, 'pt-BR')
          );
        case 'category-asc':
        default:
          return (
            aCategory.localeCompare(bCategory, 'pt-BR') ||
            aName.localeCompare(bName, 'pt-BR')
          );
      }
    });
  }, [activeProducts, search, categoryFilter, selectedAction, sortBy]);

  const hasFilters = search.trim() !== '' || selectedAction !== 'all' || categoryFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setSelectedAction('all');
    setCategoryFilter('all');
    setSortBy('category-asc');
  };

  const openSingle = (p: any) => navigate(`/admin/products/${p.id}/lifecycle`);

  const hasAnyProducts = activeProducts.length > 0;
  const hasFilteredProducts = filtered.length > 0;
  const isFilteredEmpty = hasAnyProducts && !hasFilteredProducts;

  if (loading) return <LoadingSpinner />;

  if (!loading && !hasAnyProducts) {
    return (
      <PageContainer
        title="Vida do produto"
        subtitle="Selecione um produto para abrir sua visão 360º de estoque, movimentações e auditoria."
        category="Produtos"
        icon={<Activity size={28} className="text-[#19A999]" />}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        flat
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
      category="Produtos"
      icon={<Activity size={28} className="text-[#19A999]" />}
      lastUpdated={lastUpdated}
      onRefresh={handleRefresh}
      flat
    >
      <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm font-semibold text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
        Abra um produto por vez para consultar sua vida operacional. A seleção múltipla foi removida porque esta tela é uma análise individual.
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou categoria"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
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
            className="w-full py-2.5 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
          >
            <option value="all">Todas as categorias</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-full py-2.5 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
          >
            <option value="category-asc">Categoria A → Z</option>
            <option value="category-desc">Categoria Z → A</option>
            <option value="name-asc">Nome A → Z</option>
            <option value="name-desc">Nome Z → A</option>
          </select>

          <div className="flex gap-3">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full py-2.5 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
            >
              <option value="all">Todas as ações</option>
              <option value="buy">Comprar</option>
              <option value="transfer">Transferir</option>
              <option value="monitor">Monitorar</option>
              <option value="review_excess">Revisar excesso</option>
              <option value="ok">OK</option>
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
          {filtered.map((p) => (
            <article
              key={p.id}
              onClick={() => openSingle(p)}
              className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-150 hover:border-[#19A999]/50 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 cursor-pointer flex flex-col gap-3 group"
            >
              <div className="h-28 sm:h-32 w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
                ) : (
                  <Package size={28} className="text-gray-300 dark:text-gray-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">{p.name}</p>
                {p.category && <p className="text-xs text-gray-400 truncate">{p.category.name}</p>}
              </div>

              <div className="flex flex-col gap-1.5 mt-auto mb-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      actionClassMap[p.recommended_action ?? 'ok']
                    }`}
                  >
                    {actionLabelMap[p.recommended_action ?? 'ok']}
                  </span>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {formatNumberPtBr(p.global_available ?? 0)} un.
                  </span>
                </div>

                {((p.location_stockout_count ?? 0) > 0 || ((p.possible_source_locations ?? 0) > 0 && (p.recommended_action === 'transfer' || p.recommended_action === 'transfer_or_redistribute'))) && (
                  <div className="flex flex-col gap-0.5">
                    {(p.location_stockout_count ?? 0) > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {p.location_stockout_count} local(is) sem estoque
                      </p>
                    )}
                    {(p.possible_source_locations ?? 0) > 0 &&
                      (p.recommended_action === 'transfer' || p.recommended_action === 'transfer_or_redistribute') && (
                        <p className="text-[11px] text-blue-600 dark:text-blue-300">há origem possível</p>
                      )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openSingle(p); }}
                className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-[#19A999] hover:text-white text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-xl transition-all duration-150"
              >
                <Activity size={13} />
                Ver vida do produto
              </button>
            </article>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
