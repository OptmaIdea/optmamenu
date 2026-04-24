import { useEffect, useState, useMemo } from 'react';
import { Plus, Archive, Layers, History, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { useProductInventorySnapshot } from '@/hooks/inventory/useProductInventorySnapshot';

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
    // Products data
    const { products, loading, deletingId, lastUpdated, handleRefresh } = useProducts();
    const { snapshotMap, loading: inventoryLoading } = useProductInventorySnapshot();

    // Enriquece cada produto com totais consolidados do multiestoque
    const productsWithInventory = useMemo(() => {
        return products.map((product) => {
            const inventory = snapshotMap.get(product.id);

            const displayOnHand = inventory?.onHand ?? product.stock_quantity ?? 0;
            const displayReserved = inventory?.reserved ?? 0;
            const displayAvailable = inventory?.available ?? product.stock_quantity ?? 0;

            let displayStockStatus: 'out' | 'low' | 'ok' | 'over' = 'ok';

            if (displayAvailable <= 0) {
                displayStockStatus = 'out';
            } else if (displayAvailable <= (product.min_stock ?? 0)) {
                displayStockStatus = 'low';
            } else if (displayOnHand > (product.max_stock ?? Number.MAX_SAFE_INTEGER)) {
                displayStockStatus = 'over';
            } else {
                displayStockStatus = 'ok';
            }

            return {
                ...product,
                display_on_hand: displayOnHand,
                display_reserved: displayReserved,
                display_available: displayAvailable,
                display_stock_status: displayStockStatus,
            };
        });
    }, [products, snapshotMap]);

    // ✅ Produtos NÃO descontinuados (para listagem principal e estatísticas)
    const nonDiscontinuedProducts = useMemo(() => {
        return productsWithInventory.filter(p => !p.is_discontinued);
    }, [productsWithInventory]);

    // ✅ Produtos descontinuados (para o modal específico)
    const discontinuedProducts = useMemo(() => {
        return productsWithInventory.filter(p => p.is_discontinued === true);
    }, [productsWithInventory]);

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
            const { data: storeData, error } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (error || !storeData) return;
            const store = Array.isArray(storeData) ? storeData[0] : storeData;
            if (store) {
                const { data } = await supabase
                    .from('categories')
                    .select('*')
                    .eq('store_id', store.id);
                if (data) setCategories(data);
            }
        };
        fetchCategories();
    }, [setCategories]);

    useEffect(() => {
        const fetchStoreAndUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserEmail(user.email || 'Admin');

            // Primeiro busca a loja do usuário via RPC
            const { data: storeData, error: storeError } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (storeError || !storeData) return;
            const store = Array.isArray(storeData) ? storeData[0] : storeData;

            // Agora usa o store.id correto para buscar a config
            const { data, error } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: store.id }
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

    if (loading || inventoryLoading) {
        return <LoadingSpinner />;
    }

    const hasAnyProducts = nonDiscontinuedProducts.length > 0;
    const hasFilteredProducts = filteredAndSortedProducts.length > 0;
    const isFilteredEmpty = hasAnyProducts && !hasFilteredProducts;

    return (
        <>
            <PageContainer
                title="Produtos"
                subtitle="Gerencie seu catálogo"
                lastUpdated={lastUpdated}
                onRefresh={handleRefresh}
                action={
                    <div className="flex gap-2">
                        <Link
                            to="/admin/inventory"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md transition-colors"
                            title="Ir para controle de estoque"
                        >
                            <FileText size={16} />
                        </Link>
                        <Link
                            to="/admin/stock-movements"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md transition-colors"
                            title="Ver histórico de movimentações"
                        >
                            <History size={16} />
                        </Link>
                        <Link
                            to="/admin/categories"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md transition-colors"
                            title="Gerenciar categorias"
                        >
                            <Layers size={16} />
                        </Link>
                        <button
                            onClick={handleNewProduct}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#21A896] hover:bg-[#1a867a] text-white text-sm font-medium rounded-md transition-colors"
                        >
                            <Plus size={16} />
                            <span className="hidden md:inline">Novo Produto</span>
                            <span className="md:hidden">Novo</span>
                        </button>
                    </div>
                }
            >
                {/* Botão de Produtos Descontinuados (posicionado após o FilterBar) */}
                {hasAnyProducts && (
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
                )}

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
                            ? 'Produtos com estoque baixo'
                            : modalState.filterType === 'high'
                                ? 'Produtos com excesso de estoque'
                                : 'Todos os produtos'
                }
                products={
                    modalState.filterType === 'zero'
                        ? stats.zeroStockProducts
                        : modalState.filterType === 'low'
                            ? stats.lowStockProducts
                            : modalState.filterType === 'high'
                                ? stats.highStockProducts
                                : stats.allProducts
                }
                type={modalState.filterType === 'zero' ? 'zero' : modalState.filterType === 'low' ? 'low' : 'all'}
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
            />

            {/* Modal de edição de produto */}
            <AdminProductEditModal
                isOpen={editModalProduct !== null}
                onClose={() => setEditModalProduct(null)}
                product={editModalProduct}
                onSuccess={handleProductSaved}
            />

            {/* Modal de novo produto */}
            <AdminProductEditModal
                isOpen={isNewProductModalOpen}
                onClose={() => setIsNewProductModalOpen(false)}
                product={null}
                onSuccess={handleProductSaved}
            />

            {/* Render condicional dos modais */}
            <AdminProductViewModal
                isOpen={viewProduct !== null}
                onClose={() => setViewProduct(null)}
                product={viewProduct}
                onEdit={handleEditProduct}
            />

            <ProductDeleteConfirmModal
                isOpen={deleteProduct !== null}
                onClose={() => setDeleteProduct(null)}
                product={deleteProduct}
                onSuccess={handleDeleteSuccess}
            />

            {/* Discontinued Products Modal */}
            <DiscontinuedProductsModal
                isOpen={showDiscontinuedModal}
                onClose={() => setShowDiscontinuedModal(false)}
                products={discontinuedProducts}
            />
        </>
    );
}