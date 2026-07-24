import { useState, useEffect } from 'react';
import { Plus, Search, ArrowUpDown, Package, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import type { Category } from './category/types/category.types';
import { usePermissions } from '@/hooks/usePermissions';
import { getActiveStoreId } from '@/utils/activeStore';

// Hooks
import { useCategories } from '@/pages/private/admin/products/category/hooks/useCategories';
import { useCategoryFilters } from '@/pages/private/admin/products/category/hooks/useCategoryFilters';
import { useCategoryModals } from '@/pages/private/admin/products/category/hooks/useCategoryModals';

// Components
import CategoryTable from '@/pages/private/admin/products/category/components/CategoryTable';
import CategoryCard from '@/pages/private/admin/products/category/components/CategoryCard';
import CategoryViewModal from '@/pages/private/admin/products/category/components/CategoryViewModal';
import CategoryEditModal from '@/pages/private/admin/products/category/components/CategoryEditModal';
import CategoryDeleteConfirmModal from '@/pages/private/admin/products/category/components/CategoryDeleteConfirmModal';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import CategoryProductsSimpleModal from '@/pages/private/admin/products/category/components/CategoryProductsSimpleModal';

export default function CategoriesPage() {
    const [storeId, setStoreId] = useState<string | null>(null);
    const activeStoreId = getActiveStoreId();
    const { hasPermission } = usePermissions(activeStoreId);
    const canManageCategories = hasPermission('categories.manage');

    // Dados e operações principais
    const { categories, loading, deletingId, lastUpdated, deleteCategory, refresh } = useCategories();

    // Filtros e busca
    const {
        searchTerm,
        setSearchTerm,
        sortBy,
        setSortBy,
        sortOrder,
        toggleSort,
        filteredAndSortedCategories,
        clearFilters,
    } = useCategoryFilters(categories);

    // Gerenciamento de modais
    const {
        viewCategory,
        editCategory,
        deleteCategory: categoryToDelete,
        isNewModalOpen,
        openViewModal,
        closeViewModal,
        openEditModal,
        closeEditModal,
        openDeleteModal,
        closeDeleteModal,
        openNewModal,
        closeNewModal,
    } = useCategoryModals();

    // Estado para produtos da categoria (Modal de Produtos)
    const [productsModalCategory, setProductsModalCategory] = useState<Category | null>(null);
    const [categoryProductsNames, setCategoryProductsNames] = useState<string[]>([]);


    // Resolver storeId ao montar (síncrono via loja ativa)
    useEffect(() => {
        const activeStoreId = getActiveStoreId();
        if (activeStoreId) {
            setStoreId(activeStoreId);
        }
    }, []);

    // Buscar produtos de uma categoria para o modal
    const fetchCategoryProducts = async (categoryId: string) => {
        try {
            if (!storeId) {
                throw new Error('Nenhuma loja ativa selecionada.');
            }

            const { data, error } = await supabase
                .from('products')
                .select('name')
                .eq('category_id', categoryId)
                .eq('store_id', storeId)
                .order('name');

            if (error) throw error;

            const names = data?.map((p: { name: string }) => p.name) || [];
            setCategoryProductsNames(names);
        } catch (error) {
            console.error('Erro ao carregar produtos da categoria:', error);
            toast.error('Erro ao carregar produtos vinculados');
            setCategoryProductsNames([]);
        }
    };

    const handleViewProducts = (category: Category) => {
        setProductsModalCategory(category);
        fetchCategoryProducts(category.id);
    };

    const handleCloseProductsModal = () => {
        setProductsModalCategory(null);
        setCategoryProductsNames([]);
    };

    // Handlers de sucesso
    const handleSaveSuccess = () => {
        refresh();
        closeEditModal();
        closeNewModal();
    };

    const handleDeleteSuccess = () => {
        refresh();
        closeDeleteModal();
    };

    if (loading) return <LoadingSpinner />;

    return (
        <>
            <PageContainer
                title="Categorias"
                subtitle="Gerencie as categorias do seu cardápio"
                category="Produtos"
                icon={<Layers size={28} className="text-[#19A999]" />}
                lastUpdated={lastUpdated}
                onRefresh={refresh}
                flat
                action={
                    <div className="flex gap-2">
                        <Link
                            to="/admin/products"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md transition-colors"
                            title="Ir para Produtos"
                        >
                            <Package size={16} />
                        </Link>
                        {canManageCategories && (
                            <button
                                onClick={openNewModal}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#19A999] hover:bg-[#14887B] text-white text-sm font-medium rounded-md transition-colors"
                            >
                                <Plus size={16} />
                                <span className="hidden md:inline">Nova Categoria</span>
                                <span className="md:hidden">Nova</span>
                            </button>
                        )}
                    </div>
                }
            >
                {/* Barra de busca e ordenação */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md mb-6">
                    <div className="p-3 flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar categorias..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#19A999]"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'name' | 'sort_order')}
                                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:ring-1 focus:ring-[#19A999]"
                            >
                                <option value="sort_order">Ordenar por posição</option>
                                <option value="name">Ordenar por nome</option>
                            </select>
                            <button
                                onClick={toggleSort}
                                className="p-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600"
                                title={`Ordenar ${sortOrder === 'asc' ? 'crescente' : 'decrescente'}`}
                            >
                                <ArrowUpDown size={16} />
                            </button>
                        </div>

                        {(searchTerm || sortBy !== 'sort_order' || sortOrder !== 'asc') && (
                            <button
                                onClick={clearFilters}
                                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabela Desktop */}
                <CategoryTable
                    categories={filteredAndSortedCategories}
                    onView={openViewModal}
                    onEdit={openEditModal}
                    onDelete={openDeleteModal}
                    onViewProducts={handleViewProducts}
                    deletingId={deletingId}
                    canManage={canManageCategories}
                />

                {/* Cards Mobile */}
                <div className="hidden">
                    {filteredAndSortedCategories.map(category => (
                        <CategoryCard
                            key={category.id}
                            category={category}
                            onView={openViewModal}
                            onEdit={openEditModal}
                            onDelete={openDeleteModal}
                            onViewProducts={handleViewProducts}
                            deletingId={deletingId}
                            canManage={canManageCategories}
                        />
                    ))}
                </div>

                {/* Mensagem quando não há categorias */}
                {filteredAndSortedCategories.length === 0 && (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700/50 rounded-full flex items-center justify-center mb-4 text-gray-400">
                            <Search size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                            Nenhuma categoria encontrada
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            {searchTerm
                                ? 'Tente buscar com outros termos.'
                                : 'Crie sua primeira categoria para começar.'}
                        </p>
                    </div>
                )}
            </PageContainer>

            {/* Modais */}
            <CategoryViewModal
                isOpen={viewCategory !== null}
                onClose={closeViewModal}
                category={viewCategory}
                onEdit={openEditModal}
            />

            {storeId && (
                <>
                    <CategoryEditModal
                        isOpen={editCategory !== null}
                        onClose={closeEditModal}
                        category={editCategory}
                        storeId={storeId}
                        onSuccess={handleSaveSuccess}
                        canManage={canManageCategories}
                    />

                    <CategoryEditModal
                        isOpen={isNewModalOpen}
                        onClose={closeNewModal}
                        category={null}
                        storeId={storeId}
                        onSuccess={handleSaveSuccess}
                        canManage={canManageCategories}
                    />
                </>
            )}

            <CategoryDeleteConfirmModal
                isOpen={categoryToDelete !== null}
                onClose={closeDeleteModal}
                category={categoryToDelete}
                onDelete={deleteCategory}
                onSuccess={handleDeleteSuccess}
            />

            <CategoryProductsSimpleModal
                isOpen={productsModalCategory !== null}
                onClose={handleCloseProductsModal}
                categoryName={productsModalCategory?.name || ''}
                productNames={categoryProductsNames}
            />
        </>
    );
}
