import { useState, useMemo, useCallback } from 'react';
import type {
    Product,
    SortConfig,
    FilterStock,
    FilterStatus,
    FilterAction,
    Category
} from '../types/product.types';

export const useFilters = (products: Product[], categories: Category[] = []) => {
    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Filters
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterStock, setFilterStock] = useState<FilterStock>('all');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [filterAction, setFilterAction] = useState<FilterAction>('all');

    // Grouping
    const [groupByCategory, setGroupByCategory] = useState(false);
    const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);

    // Sorting
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: 'name',
        direction: 'asc',
    });

    // Clear search
    const clearSearch = useCallback(() => setSearchTerm(''), []);

    // Toggle category collapse
    const toggleCategory = useCallback((category: string) => {
        setCollapsedCategories((prev) =>
            prev.includes(category)
                ? prev.filter((c) => c !== category)
                : [...prev, category]
        );
    }, []);

    // Handle sort
    const handleSort = useCallback((key: SortConfig['key']) => {
        setSortConfig((current) => ({
            key,
            direction:
                current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    }, []);

    // Clear all filters
    const clearFilters = useCallback(() => {
        setSearchTerm('');
        setFilterCategory('all');
        setFilterStock('all');
        setFilterStatus('all');
        setFilterAction('all');
        setGroupByCategory(false);
    }, []);

    // Get stock status for a product (usado internamente para compatibilidade)
    const getInventoryStatus = useCallback((product: Product) => {
        if (product.is_discontinued) return 'inactive';
        if (!product.active) return 'inactive';
        if (product.global_status === 'global_stockout') return 'zero';
        if (product.global_status === 'global_critical') return 'low';
        if (product.global_status === 'global_attention') return 'attention';
        if (product.global_status === 'global_excess') return 'high';
        return 'normal';
    }, []);

    // Filtered and sorted products
    const filteredAndSortedProducts = useMemo(() => {
        let result = products;

        // Search filter
        if (searchTerm) {
            const lowerTerm = searchTerm.trim().toLocaleLowerCase('pt-BR');
            const normalizedCodeTerm = searchTerm
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]/g, '')
                .toUpperCase();
            result = result.filter(
                (p) =>
                    p.name.toLocaleLowerCase('pt-BR').includes(lowerTerm) ||
                    p.description?.toLocaleLowerCase('pt-BR').includes(lowerTerm) ||
                    (normalizedCodeTerm.length > 0 &&
                        p.codes?.some((code) =>
                            code.normalized_code.includes(normalizedCodeTerm) ||
                            code.code_value
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '')
                                .replace(/[^a-zA-Z0-9]/g, '')
                                .toUpperCase()
                                .includes(normalizedCodeTerm)
                        ))
            );
        }

        // Category filter
        if (filterCategory !== 'all') {
            result = result.filter((p) => p.category?.name === filterCategory);
        }

        // Status filter (Situação cadastral/comercial)
        if (filterStatus !== 'all') {
            if (filterStatus === 'active') {
                result = result.filter((p) => p.active === true && !p.is_discontinued);
            } else if (filterStatus === 'inactive') {
                result = result.filter((p) => p.active === false && !p.is_discontinued);
            } else if (filterStatus === 'discontinued') {
                result = result.filter((p) => Boolean(p.is_discontinued));
            }
        }

        // Stock filter (baseado em display_stock_status / global_status)
        if (filterStock !== 'all') {
            result = result.filter((product) => {
                if (filterStock === 'zero') {
                    return product.display_stock_status === 'out';
                }

                if (filterStock === 'low') {
                    return product.global_status === 'global_critical';
                }

                if (filterStock === 'attention') {
                    return product.global_status === 'global_attention';
                }

                if (filterStock === 'high') {
                    return product.global_status === 'global_excess';
                }

                if (filterStock === 'normal') {
                    return product.global_status === 'global_ok';
                }

                return true;
            });
        }

        // Action filter (ação gerencial recomendada)
        if (filterAction !== 'all') {
            result = result.filter((product) => {
                if (filterAction === 'transfer') {
                    return (
                        product.recommended_action === 'transfer' ||
                        product.recommended_action === 'transfer_or_redistribute'
                    );
                }
                return product.recommended_action === filterAction;
            });
        }

        // Sorting
        result = [...result].sort((a, b) => {
            const direction = sortConfig.direction === 'asc' ? 1 : -1;

            // Special case for 'active' (boolean)
            if (sortConfig.key === 'active') {
                if (a.active === b.active) return 0;
                if (sortConfig.direction === 'asc') {
                    return a.active ? -1 : 1;
                } else {
                    return a.active ? 1 : -1;
                }
            }

            // Ordenação por disponível consolidado
            if (sortConfig.key === 'display_available') {
                return (
                    (Number(a.display_available ?? 0) - Number(b.display_available ?? 0))
                    * direction
                );
            }

            let aValue: any = a[sortConfig.key as keyof Product];
            let bValue: any = b[sortConfig.key as keyof Product];

            // Group by category when sorting by name
            if (sortConfig.key === 'name' && groupByCategory) {
                const catA = a.category?.name || '';
                const catB = b.category?.name || '';
                if (catA !== catB) {
                    return sortConfig.direction === 'asc'
                        ? catA.localeCompare(catB)
                        : catB.localeCompare(catA);
                }
            }

            if (sortConfig.key === 'category') {
                aValue = a.category?.name || '';
                bValue = b.category?.name || '';
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [
        products,
        searchTerm,
        filterCategory,
        filterStock,
        filterStatus,
        filterAction,
        sortConfig,
        groupByCategory,
    ]);

    // Group products by category
    const groupedProducts = useMemo(() => {
        if (!groupByCategory) {
            return [{ category: 'all', products: filteredAndSortedProducts }];
        }

        const groups: Record<string, Product[]> = {};
        filteredAndSortedProducts.forEach((product) => {
            const catName = product.category?.name || 'Sem Categoria';
            if (!groups[catName]) groups[catName] = [];
            groups[catName].push(product);
        });

        return Object.entries(groups)
            .map(([category, products]) => ({ category, products }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [filteredAndSortedProducts, groupByCategory]);

    return {
        // Search
        searchTerm,
        setSearchTerm,
        clearSearch,

        // Filters
        filterCategory,
        setFilterCategory,
        filterStock,
        setFilterStock,
        filterStatus,
        setFilterStatus,
        filterAction,
        setFilterAction,

        // Grouping
        groupByCategory,
        setGroupByCategory,
        collapsedCategories,
        toggleCategory,

        // Sorting
        sortConfig,
        handleSort,

        // Categories
        categories,

        // Derived data
        filteredAndSortedProducts,
        groupedProducts,
        getInventoryStatus,

        // Clear all
        clearFilters,
    };
};
