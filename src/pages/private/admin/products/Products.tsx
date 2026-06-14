import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Archive, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AdminProductViewModal from '@/pages/private/admin/products/products/components/AdminProductViewModal';
import ProductDeleteConfirmModal from '@/pages/private/admin/products/products/components/ProductDeleteConfirmModal';
import type { Product } from './products/types/product.types';
import AdminProductEditModal from '@/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal';

// Hooks
import { useProducts } from '@/pages/private/admin/products/products/hooks/useProducts';
import { useFilters } from '@/pages/private/admin/products/products/hooks/useFilters';
import { useModals } from '@/pages/private/admin/products/products/hooks/useModals';
import { useExport } from '@/pages/private/admin/products/products/hooks/useExport';
import { getActiveStoreId } from '@/utils/activeStore';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';


// Components
import PageContainer from '@/components/common/PageContainer';
import StatsCards from '@/pages/private/admin/products/products/components/StatsCards';
import FilterBar from '@/pages/private/admin/products/products/components/FilterBar';
import ProductTable from '@/pages/private/admin/products/products/components/ProductTable';
import FilteredProductsModal from '@/pages/private/admin/products/products/components/FilteredProductsModal';
import ProductActionModal from '@/pages/private/admin/products/products/components/ProductActionModal';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import DiscontinuedProductsModal from '@/pages/private/admin/products/products/components/DiscontinuedProductsModal';
import EmptyState from '@/components/common/empty-state/EmptyState';
import { PackageSearch } from 'lucide-react';

export default function ProductsPage() {
    // Permissões
    const { storeId } = useCurrentStore();
    const { hasPermission } = usePermissions(storeId ?? null);
    const canViewProducts = hasPermission('products.view');
    const canManageProducts = hasPermission('products.manage');

    // Products data
    const { products, loading, deletingId, lastUpdated, handleRefresh } = useProducts();

    useRefreshFrame(handleRefresh);

    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setPortalContainer(document.getElementById('quick-access-actions-portal'));
    }, []);

    // ✅ Produtos NÃO descontinuados (para listagem principal e estatísticas)
    const nonDiscontinuedProducts = useMemo(() => {
        return products.filter(p => !p.is_discontinued);
    }, [products]);

    // ✅ Produtos descontinuados (para o modal específico)
    const discontinuedProducts = useMemo(() => {
        return products.filter(p => p.is_discontinued === true);
    }, [products]);

    // Estados para modais de visualização e exclusão
    const [viewProduct, setViewProduct] = useState<Product | null>(null);
    const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

    // Abrir modal de visualização
    const handleViewProduct = (product: Product) => {
        setViewProduct(product);
    };

    // Abrir modal de exclusão
    const handleDeleteProduct = (product: Product) => {
        setDeleteProduct(product);
    };

    const [editModalProduct, setEditModalProduct] = useState<Product | null>(null);
    const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);

    // Funções para abrir os modais
    const handleEditProduct = (product: Product) => {
        setEditModalProduct(product);
    };

    const handleNewProduct = () => {
        setIsNewProductModalOpen(true);
    };

    // Callback após salvar/editar
    const handleProductSaved = () => {
        setEditModalProduct(null);
        setIsNewProductModalOpen(false);
        handleRefresh(); // recarrega a lista
    };

    // Callback após exclusão bem-sucedida
    const handleDeleteSuccess = () => {
        setDeleteProduct(null);
        handleRefresh(); // recarrega a lista
    };

    // Filters, sorting, grouping – agora usando produtos não descontinuados
    const {
        searchTerm,
        setSearchTerm,
        filterCategory,
        setFilterCategory,
        filterStock,
        setFilterStock,
        filterStatus,
        setFilterStatus,
        filterAction,
        setFilterAction,
        groupByCategory,
        setGroupByCategory,
        collapsedCategories,
        toggleCategory,
        sortConfig,
        handleSort,
        filteredAndSortedProducts,
        groupedProducts,
        clearFilters,
        clearSearch,
        categories,
        setCategories,
    } = useFilters(nonDiscontinuedProducts);

    const [storeName, setStoreName] = useState('Minha Loja');
    const [userEmail, setUserEmail] = useState('Admin');

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const activeStoreId = getActiveStoreId();

            if (!activeStoreId) {
                throw new Error('Nenhuma loja ativa selecionada.');
            }

            const { data } = await supabase
                .from('categories')
                .select('*')
                .eq('store_id', activeStoreId);

            if (data) setCategories(data);
        };
        fetchCategories();
    }, [setCategories]);

    useEffect(() => {
        const fetchStoreAndUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserEmail(user.email || 'Admin');

            // Primeiro busca a loja do usuário via RPC
            const activeStoreId = getActiveStoreId();

            if (!activeStoreId) {
                throw new Error('Nenhuma loja ativa selecionada.');
            }

            // Agora usa o store.id correto para buscar a config
            const { data, error } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: activeStoreId }
            );
            if (error) return;
            const storeConfig = Array.isArray(data) ? data[0] : data;
            if (storeConfig) setStoreName(storeConfig.name);
        };
        fetchStoreAndUser();
    }, []);

    // Modals – usando produtos não descontinuados para estatísticas e ações
    const { stats, modalState, openStatsModal, openActionModal, closeModal, selectedProduct } =
        useModals(nonDiscontinuedProducts);

    // Export
    const { exportData } = useExport();

    // Discontinued products – já calculado acima

    const [showDiscontinuedModal, setShowDiscontinuedModal] = useState(false);

    if (loading) {
        return <LoadingSpinner />;
    }

    const hasAnyProducts = nonDiscontinuedProducts.length > 0;
    const hasFilteredProducts = filteredAndSortedProducts.length > 0;
    const isFilteredEmpty = hasAnyProducts && !hasFilteredProducts;

    return (
        <>
            {canManageProducts && portalContainer && createPortal(
                <button
                    onClick={handleNewProduct}
                    className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#21A896] hover:bg-[#1a867a] text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
                >
                    <Plus size={13} />
                    <span>Novo Produto</span>
                </button>,
                portalContainer
            )}

            <PageContainer
                title="Produtos"
                subtitle="Gerencie seu catálogo"
                category="Produtos"
                icon={<Package size={28} className="text-[#21A896]" />}
                lastUpdated={lastUpdated}
                onRefresh={handleRefresh}
                flat
            >
                {/* Main Content */}
                {!hasAnyProducts ? (
                    <EmptyState
                        icon={<PackageSearch className="h-5 w-5" />}
                        title="Nenhum produto cadastrado"
                        description="Quando você cadastrar produtos ativos, eles aparecerão aqui com estoque consolidado, preço e status."
                    />
                ) : (
                    <>
                        <StatsCards stats={stats} onStatsClick={openStatsModal} />

                        <FilterBar
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            onClearSearch={clearSearch}
                            filterCategory={filterCategory}
                            onFilterCategoryChange={setFilterCategory}
                            categories={categories}
                            filterStock={filterStock}
                            onFilterStockChange={setFilterStock}
                            filterAction={filterAction}
                            onFilterActionChange={setFilterAction}
                            filterStatus={filterStatus}
                            onFilterStatusChange={setFilterStatus}
                            groupByCategory={groupByCategory}
                            onGroupByCategoryChange={setGroupByCategory}
                            onClearFilters={clearFilters}
                            onExport={(format) => exportData(filteredAndSortedProducts, format)}
                        />

                        {/* Botão de Produtos Descontinuados reposicionado para o bloco principal */}
                        <div className="flex justify-end mt-2 mb-4">
                            <button
                                onClick={() => setShowDiscontinuedModal(true)}
                                className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-1.5"
                            >
                                <Archive size={16} />
                                <span className="hidden sm:inline">Descontinuados</span>
                                {discontinuedProducts.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-xs">
                                        {discontinuedProducts.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        <ProductTable
                            groupedProducts={groupedProducts}
                            groupByCategory={groupByCategory}
                            collapsedCategories={collapsedCategories}
                            onToggleCategory={toggleCategory}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            onActionClick={openActionModal}
                            deletingId={deletingId}
                            isFilteredEmpty={isFilteredEmpty}
                        />
                    </>
                )}
            </PageContainer>

            {/* Filtered Products Modal */}
            <FilteredProductsModal
                isOpen={modalState.type === 'stats' && modalState.filterType !== undefined}
                onClose={closeModal}
                title={
                    modalState.filterType === 'zero'
                        ? 'Produtos sem estoque'
                        : modalState.filterType === 'low'
                            ? 'Produtos com estoque crítico'
                            : modalState.filterType === 'attention'
                                ? 'Produtos em atenção'
                                : modalState.filterType === 'high'
                                    ? 'Produtos com excesso de estoque'
                                    : modalState.filterType === 'buy'
                                        ? 'Produtos para comprar'
                                        : modalState.filterType === 'transfer'
                                            ? 'Produtos para transferir'
                                            : 'Todos os produtos'
                }
                products={
                    modalState.filterType === 'zero'
                        ? stats.zeroStockProducts
                        : modalState.filterType === 'low'
                            ? stats.lowStockProducts
                            : modalState.filterType === 'attention'
                                ? stats.attentionStockProducts
                                : modalState.filterType === 'high'
                                    ? stats.highStockProducts
                                    : modalState.filterType === 'buy'
                                        ? stats.recommendedBuyProducts
                                        : modalState.filterType === 'transfer'
                                            ? stats.recommendedTransferProducts
                                            : stats.allProducts
                }
                type={modalState.filterType ?? 'all'}
                storeName={storeName}
                userEmail={userEmail}
                onViewProduct={handleViewProduct}
            />

            {/* Product Action Modal */}
            <ProductActionModal
                isOpen={modalState.type === 'actions'}
                onClose={closeModal}
                product={selectedProduct}
                onEdit={() => handleEditProduct(selectedProduct!)}
                onView={handleViewProduct}
                onDelete={handleDeleteProduct}
                canManageProducts={canManageProducts}
            />

            {/* Modal de edição de produto */}
            {canManageProducts && (
                <AdminProductEditModal
                    isOpen={editModalProduct !== null}
                    onClose={() => setEditModalProduct(null)}
                    product={editModalProduct}
                    onSuccess={handleProductSaved}
                />
            )}

            {/* Modal de novo produto */}
            {canManageProducts && (
                <AdminProductEditModal
                    isOpen={isNewProductModalOpen}
                    onClose={() => setIsNewProductModalOpen(false)}
                    product={null}
                    onSuccess={handleProductSaved}
                />
            )}

            {/* Render condicional dos modais */}
            <AdminProductViewModal
                isOpen={viewProduct !== null}
                onClose={() => setViewProduct(null)}
                product={viewProduct}
                onEdit={handleEditProduct}
            />

            {canManageProducts && (
                <ProductDeleteConfirmModal
                    isOpen={deleteProduct !== null}
                    onClose={() => setDeleteProduct(null)}
                    product={deleteProduct}
                    onSuccess={handleDeleteSuccess}
                />
            )}

            {/* Discontinued Products Modal */}
            <DiscontinuedProductsModal
                isOpen={showDiscontinuedModal}
                onClose={() => setShowDiscontinuedModal(false)}
                products={discontinuedProducts}
            />
        </>
    );
}
