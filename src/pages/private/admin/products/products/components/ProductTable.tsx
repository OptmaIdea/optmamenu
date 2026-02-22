import { Fragment } from 'react';
import { Package, Plus, Minus } from 'lucide-react';
import type { Product, SortConfig } from '../types/product.types';
import ProductRow from '@/pages/private/admin/products/products/components/ProductRow';

interface GroupedProduct {
    category: string;
    products: Product[];
}

interface ProductTableProps {
    groupedProducts: GroupedProduct[];
    groupByCategory: boolean;
    collapsedCategories: string[];
    onToggleCategory: (category: string) => void;
    sortConfig: SortConfig;
    onSort: (key: SortConfig['key']) => void;
    onActionClick: (productId: string) => void;
    deletingId: string | null;
}

export default function ProductTable({
    groupedProducts,
    groupByCategory,
    collapsedCategories,
    onToggleCategory,
    sortConfig,
    onSort,
    onActionClick,
    deletingId,
}: ProductTableProps) {
    const getSortIndicator = (key: SortConfig['key']) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm relative">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            {/* Coluna Produto - sticky no mobile */}
                            <th
                                className="px-4 py-2.5 sticky left-0 z-40 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-[#21A896] sticky left-0 z-20 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700 md:static md:border-r-0"
                                onClick={() => onSort('name')}
                            >
                                Produto {getSortIndicator('name')}
                            </th>
                            <th
                                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-[#21A896]"
                                onClick={() => onSort('stock_quantity')}
                            >
                                Estoque {getSortIndicator('stock_quantity')}
                            </th>
                            <th
                                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-[#21A896]"
                                onClick={() => onSort('price')}
                            >
                                Preço {getSortIndicator('price')}
                            </th>
                            <th
                                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-[#21A896]"
                                onClick={() => onSort('active')}
                            >
                                Status {getSortIndicator('active')}
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {groupedProducts.map((group) => {
                            const isCollapsed = collapsedCategories.includes(group.category);
                            return (
                                <Fragment key={group.category}>
                                    {/* Cabeçalho de grupo (se agrupado) */}
                                    {groupByCategory && (
                                        <tr
                                            className="bg-gray-50/50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                            onClick={() => onToggleCategory(group.category)}
                                        >
                                            <td colSpan={5} className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <button className="p-1 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-600 text-[#21A896]">
                                                        {isCollapsed ? (
                                                            <Plus size={14} />
                                                        ) : (
                                                            <Minus size={14} />
                                                        )}
                                                    </button>
                                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                                                        {group.category}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        ({group.products.length})
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {/* Linhas de produtos */}
                                    {(!groupByCategory || !isCollapsed) &&
                                        group.products.map((product) => (
                                            <ProductRow
                                                key={product.id}
                                                product={product}
                                                onActionClick={onActionClick}
                                                deletingId={deletingId}
                                            />
                                        ))}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {groupedProducts.length === 1 &&
                groupedProducts[0].products.length === 0 && (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <Package size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                        <p>Nenhum produto encontrado</p>
                    </div>
                )}
        </div>
    );
}