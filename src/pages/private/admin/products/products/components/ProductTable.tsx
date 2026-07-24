import { Fragment } from 'react';
import { Plus, Minus } from 'lucide-react';
import type { Product, SortConfig } from '../types/product.types';
import ProductRow from '@/pages/private/admin/products/products/components/ProductRow';
import EmptyTableState from '@/components/common/empty-state/EmptyTableState';

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
    isFilteredEmpty?: boolean;
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
    isFilteredEmpty,
}: ProductTableProps) {
    const getSortIndicator = (key: SortConfig['key']) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    return (
        <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain touch-pan-x rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm custom-scrollbar" role="region" aria-label="Tabela de produtos com rolagem horizontal" tabIndex={0}>
            <table className="min-w-[860px] w-full text-sm relative">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            {/* Coluna Produto - sticky no mobile */}
                            <th
                                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-[#19A999] lg:sticky lg:left-0 lg:z-20 bg-gray-50 dark:bg-gray-900/50 lg:border-r border-gray-200 dark:border-gray-700"
                                onClick={() => onSort('name')}
                            >
                                Produto {getSortIndicator('name')}
                            </th>
                            <th
                                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-[#19A999]"
                                onClick={() => onSort('display_available')}
                            >
                                Estoque {getSortIndicator('display_available')}
                            </th>
                            <th
                                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-[#19A999]"
                                onClick={() => onSort('price')}
                            >
                                Preço {getSortIndicator('price')}
                            </th>
                            <th
                                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-[#19A999]"
                                onClick={() => onSort('recommended_action')}
                            >
                                Ação {getSortIndicator('recommended_action')}
                            </th>
                            <th
                                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-[#19A999]"
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
                                            <td colSpan={6} className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <button className="p-1 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-600 text-[#19A999]">
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

                        {isFilteredEmpty && (
                            <EmptyTableState
                                colSpan={6}
                                title="Nenhum resultado para os filtros aplicados"
                                description="Os filtros atuais não retornaram resultados. Limpe os filtros ou busque por outro nome, categoria ou status."
                            />
                        )}
                    </tbody>
                </table>
        </div>
    );
}