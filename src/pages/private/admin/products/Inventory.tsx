import { Search, History, Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PageContainer from '@/components/common/PageContainer';
import { useInventory } from '@/pages/private/admin/products/inventory/hooks/useInventory';
import { useInventoryFilters } from '@/pages/private/admin/products/inventory/hooks/useInventoryFilters';
import InventoryList from '@/pages/private/admin/products/inventory/components/InventoryList';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { ProductStock } from './inventory/types/inventory.types';

export default function InventoryPage() {
  const navigate = useNavigate();
  const { products, loading, lastUpdated, refresh } = useInventory();
  const { searchTerm, setSearchTerm, filteredProducts, clearSearch } = useInventoryFilters(products);

  const handleViewMovements = (product: ProductStock) => {
    navigate(`/admin/stock-movements?from=inventory&productId=${product.id}&productName=${encodeURIComponent(product.name)}`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <PageContainer
      title="Controle de Estoque"
      subtitle="Acompanhe o saldo dos produtos e acesse as movimentações a partir de cada item"
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      action={
        <div className="flex gap-2">
          <Link
            to="/admin/products"
            className="p-2 text-gray-400 hover:text-[#19A999] transition bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            title="Ir para Produtos"
          >
            <Package size={20} />
          </Link>
          <Link
            to="/admin/stock-movements"
            className="p-2 text-gray-400 hover:text-[#19A999] transition bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            title="Ir para Movimentações"
          >
            <History size={20} />
          </Link>
        </div>
      }
    >
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md mb-6">
        <div className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#19A999]"
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

      <InventoryList products={filteredProducts} onViewMovements={handleViewMovements} />
    </PageContainer>
  );
}
