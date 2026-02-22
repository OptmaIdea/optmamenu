import { useState } from 'react';
import { Search, History, Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PageContainer from '@/components/common/PageContainer';
import { useInventory } from '@/pages/private/admin/products/inventory/hooks/useInventory';
import { useInventoryFilters } from '@/pages/private/admin/products/inventory/hooks/useInventoryFilters';
import InventoryList from '@/pages/private/admin/products/inventory/components/InventoryList';
import StockAdjustmentModal from '@/pages/private/admin/products/inventory/components/StockAdjustmentModal';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { ProductStock, AdjustmentType } from './inventory/types/inventory.types';

export default function InventoryPage() {
    const navigate = useNavigate();
    const { products, loading, lastUpdated, refresh } = useInventory();
    const { searchTerm, setSearchTerm, filteredProducts, clearSearch } = useInventoryFilters(products);

    const [adjustmentModal, setAdjustmentModal] = useState<{
        isOpen: boolean;
        product: ProductStock | null;
        type: AdjustmentType | null;
    }>({ isOpen: false, product: null, type: null });

    const openModal = (product: ProductStock, type: AdjustmentType) => {
        setAdjustmentModal({ isOpen: true, product, type });
    };

    const closeModal = () => {
        setAdjustmentModal({ isOpen: false, product: null, type: null });
    };

    const handleViewMovements = (product: ProductStock) => {
        navigate(`/admin/stock-movements?from=inventory&productId=${product.id}&productName=${encodeURIComponent(product.name)}`);
    };

    if (loading) return <LoadingSpinner />;

    return (
        <>
            <PageContainer
                title="Controle de Estoque"
                subtitle="Gerencie entradas, saídas e reservas em tempo real"
                lastUpdated={lastUpdated}
                onRefresh={refresh}
                action={
                    <div className="flex gap-2">
                        <Link
                            to="/admin/products"
                            className="p-2 text-gray-400 hover:text-[#21A896] transition bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                            title="Ir para Produtos"
                        >
                            <Package size={20} />
                        </Link>
                        <Link
                            to="/admin/stock-movements"
                            className="p-2 text-gray-400 hover:text-[#21A896] transition bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                            title="Ver histórico de movimentações"
                        >
                            <History size={20} />
                        </Link>
                    </div>
                }
            >
                {/* Barra de busca */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md mb-6">
                    <div className="p-3 flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar produto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#21A896]"
                            />
                        </div>
                        {searchTerm && (
                            <button
                                onClick={clearSearch}
                                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                            >
                                Limpar
                            </button>
                        )}
                    </div>
                </div>

                {/* Lista de produtos */}
                <InventoryList
                    products={filteredProducts}
                    onEntry={(product) => openModal(product, 'entry')}
                    onExit={(product) => openModal(product, 'exit')}
                    onViewMovements={handleViewMovements}
                />
            </PageContainer>

            {/* Modal de ajuste */}
            <StockAdjustmentModal
                isOpen={adjustmentModal.isOpen}
                onClose={closeModal}
                product={adjustmentModal.product}
                type={adjustmentModal.type}
                onSuccess={refresh}
            />
        </>
    );
}