import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
    Product,
    SortConfig,
    FilterStock,
    FilterStatus,
    Category
} from '../types/product.types';

export const useFilters = (products: Product[]) => {
    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Filters
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterStock, setFilterStock] = useState<FilterStock>('all');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

    // Grouping
    const [groupByCategory, setGroupByCategory] = useState(false);
    const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);

    // Sorting
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: 'name',
        direction: 'asc',
    });

    // Categories (for filter dropdown)
    const [categories, setCategories] = useState<Category[]>([]);

    // Fetch categories from Supabase
    const fetchCategories = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: store } = await supabase
                .from('stores')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();
            if (store) {
                const { data } = await supabase
                    .from('categories')
                    .select('*')
                    .eq('store_id', store.id);
                if (data) setCategories(data);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }, []);

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
        setGroupByCategory(false);
    }, []);

    // Get stock status for a product
    const getInventoryStatus = useCallback((product: Product) => {
        if (!product.active) return 'inactive';
        if (product.stock_quantity === 0) return 'zero';
        if (product.stock_quantity <= product.min_stock) return 'low';
        if (product.stock_quantity > product.max_stock) return 'high';
        return 'normal';
    }, []);

    // Filtered and sorted products
    const filteredAndSortedProducts = useMemo(() => {
        let result = products;

        // Search filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(lowerTerm) ||
                    p.description?.toLowerCase().includes(lowerTerm)
            );
        }

        // Category filter
        if (filterCategory !== 'all') {
            result = result.filter((p) => p.category?.name === filterCategory);
        }

        // Stock filter (only active products)
        if (filterStock !== 'all') {
            result = result.filter((p) => {
                if (!p.active) return false; // inativos não entram nos filtros de estoque
                return getInventoryStatus(p) === filterStock;
            });
        }

        // Status filter
        if (filterStatus !== 'all') {
            const isActive = filterStatus === 'active';
            result = result.filter((p) => p.active === isActive);
        }

        // Sorting
        result = [...result].sort((a, b) => {
            // Special case for 'active' (boolean)
            if (sortConfig.key === 'active') {
                if (a.active === b.active) return 0;
                if (sortConfig.direction === 'asc') {
                    return a.active ? -1 : 1; // ativo vem antes
                } else {
                    return a.active ? 1 : -1; // inativo vem antes
                }
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
        sortConfig,
        groupByCategory,
        getInventoryStatus,
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
        setCategories,
        fetchCategories,

        // Derived data
        filteredAndSortedProducts,
        groupedProducts,
        getInventoryStatus,

        // Clear all
        clearFilters,
    };
};