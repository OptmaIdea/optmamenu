import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Package, PackageSearch } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AdminProductViewModal from '@/pages/private/admin/products/products/components/AdminProductViewModal';
import ProductDeleteConfirmModal from '@/pages/private/admin/products/products/components/ProductDeleteConfirmModal';
import type { Product, ModalFilterType } from './products/types/product.types';
import AdminProductEditModal from '@/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal';

// Hooks
import { useProducts } from '@/pages/private/admin/products/products/hooks/useProducts';
import { useFilters } from '@/pages/private/admin/products/products/hooks/useFilters';
import { useProductCategories } from '@/pages/private/admin/products/products/hooks/useProductCategories';
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
import EmptyState from '@/components/common/empty-state/EmptyState';

export default function ProductsPage() {
    // Permissões
    const { storeId } = useCurrentStore();
    const { hasPermission } = usePermissions(storeId ?? null);
    const canManageProducts = hasPermission('products.manage');

    // Categorias centralizadas
    const { categories, fetchCategories } = useProductCategories();

    // Products data
    const { products, loading, deletingId, lastUpdated, handleRefresh: rawHandleRefresh } = useProducts();

    const handleRefresh = async () => {
        await Promise.all([rawHandleRefresh(), fetchCategories()]);
    };

    useRefreshFrame(handleRefresh);

    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setPortalContainer(document.getElementById('quick-access-actions-portal'));
    }, []);

    // Estados para modais de visualização e exclusão
    const [viewProduct, setViewProduct] = useState<Product | null>(null);
    const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

    // Navegação / callback central de detalhe
    const handleOpenProduct = (productId: string) => {
        const prod = products.find((p) => p.id === productId);
        if (prod) setViewProduct(prod);
    };

    // Abrir modal de visualização
    const handleViewProduct = (product: Product) => {
        setViewProduct(product);
    };

    // Abrir modal de exclusão
    const handleDeleteProduct = (product: Product) => {
        if (!canManageProducts) return;
        setDeleteProduct(product);
    };

    const [editModalProduct, setEditModalProduct] = useState<Product | null>(null);
    const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);

    // Funções para abrir os modais de escrita (protegidas)
    const handleEditProduct = (product: Product) => {
        if (!canManageProducts) return;
        setEditModalProduct(product);
    };

    const handleNewProduct = () => {
        if (!canManageProducts) return;
        setIsNewProductModalOpen(true);
    };

    // Callback após salvar/editar
    const handleProductSaved = () => {
        setEditModalProduct(null);
        setIsNewProductModalOpen(false);
        handleRefresh();
    };

    // Callback após exclusão bem-sucedida
    const handleDeleteSuccess = () => {
        setDeleteProduct(null);
        handleRefresh();
    };

    // Filters, sorting, grouping usando todos os produtos e categorias carregadas
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
    } = useFilters(products, categories);

    const [storeName, setStoreName] = useState('Minha Loja');
    const [userEmail, setUserEmail] = useState('Admin');

    useEffect(() => {
        const fetchStoreAndUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserEmail(user.email || 'Admin');

            const activeStoreId = getActiveStoreId();

            if (!activeStoreId) {
                return;
            }

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

    // Modals – usando todos os produtos
    const { stats, modalState, openStatsModal, openActionModal, closeModal, selectedProduct } =
        useModals(products);

    // Clique nos cards de estatística
    const handleStatsClick = (filterType: ModalFilterType) => {
        if (filterType === 'discontinued') {
            setFilterStatus('discontinued');
            return;
        }
        openStatsModal(filterType);
    };

    // Export
    const { exportData } = useExport();

    if (loading) {
        return <LoadingSpinner />;
    }

    const hasAnyProducts = products.length > 0;
    const hasFilteredProducts = filteredAndSortedProducts.length > 0;
    const isFilteredEmpty = hasAnyProducts && !hasFilteredProducts;

    return (
        <>
            {canManageProducts && portalContainer && createPortal(
                <button
                    onClick={handleNewProduct}
                    className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#19A999] hover:bg-[#14887B] text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
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
                icon={<Package size={28} className="text-[#19A999]" />}
                lastUpdated={lastUpdated}
                onRefresh={handleRefresh}
                flat
            >
                {/* Main Content */}
                {!hasAnyProducts ? (
                    <EmptyState
                        icon={<PackageSearch className="h-5 w-5" />}
                        title="Nenhum produto cadastrado"
                        description="Quando você cadastrar produtos, eles aparecerão aqui com estoque consolidado, preço e status."
                    />
                ) : (
                    <>
                        <StatsCards stats={stats} onStatsClick={handleStatsClick} />

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
                            totalCount={products.length}
                            filteredCount={filteredAndSortedProducts.length}
                            onClearFilters={clearFilters}
                            onExport={(format) => exportData(filteredAndSortedProducts, format)}
                        />

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
                onViewProduct={(prod) => handleOpenProduct(prod.id)}
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

            {/* Modal de edição de produto (apenas para quem gerencia) */}
            {canManageProducts && (
                <AdminProductEditModal
                    isOpen={editModalProduct !== null}
                    onClose={() => setEditModalProduct(null)}
                    product={editModalProduct}
                    onSuccess={handleProductSaved}
                />
            )}

            {/* Modal de novo produto (apenas para quem gerencia) */}
            {canManageProducts && (
                <AdminProductEditModal
                    isOpen={isNewProductModalOpen}
                    onClose={() => setIsNewProductModalOpen(false)}
                    product={null}
                    onSuccess={handleProductSaved}
                />
            )}

            {/* Render condicional do modal de visualização */}
            <AdminProductViewModal
                isOpen={viewProduct !== null}
                onClose={() => setViewProduct(null)}
                product={viewProduct}
                onEdit={canManageProducts ? handleEditProduct : undefined}
            />

            {/* Modal de confirmação de exclusão (apenas para quem gerencia) */}
            {canManageProducts && (
                <ProductDeleteConfirmModal
                    isOpen={deleteProduct !== null}
                    onClose={() => setDeleteProduct(null)}
                    product={deleteProduct}
                    onSuccess={handleDeleteSuccess}
                />
            )}
        </>
    );
}
