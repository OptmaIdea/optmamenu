import { useState, useMemo } from 'react';
import type { Category } from '../types/category.types';

export const useCategoryFilters = (initialCategories: Category[]) => {
    const categories = Array.isArray(initialCategories) ? initialCategories : [];

    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [sortBy, setSortBy] = useState<'name' | 'sort_order'>('sort_order');

    const filteredAndSortedCategories = useMemo(() => {
        let result = [...categories];

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(cat =>
                cat.name.toLowerCase().includes(lowerTerm) ||
                cat.description?.toLowerCase().includes(lowerTerm)
            );
        }

        result.sort((a, b) => {
            if (sortBy === 'name') {
                return sortOrder === 'asc'
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name);
            } else {
                const orderA = a.sort_order ?? 0;
                const orderB = b.sort_order ?? 0;
                return sortOrder === 'asc' ? orderA - orderB : orderB - orderA;
            }
        });

        return result;
    }, [categories, searchTerm, sortBy, sortOrder]);

    const toggleSort = () => {
        setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSortBy('sort_order');
        setSortOrder('asc');
    };

    return {
        searchTerm,
        setSearchTerm,
        sortBy,
        setSortBy,
        sortOrder,
        toggleSort,
        filteredAndSortedCategories,
        clearFilters,
    };
};