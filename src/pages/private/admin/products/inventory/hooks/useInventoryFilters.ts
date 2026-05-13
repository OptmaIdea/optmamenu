import { useState, useMemo } from 'react';
import type { ProductStock } from '../types/inventory.types';

export const useInventoryFilters = (products: ProductStock[]) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        const lower = searchTerm.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            p.description?.toLowerCase().includes(lower)
        );
    }, [products, searchTerm]);

    const clearSearch = () => setSearchTerm('');

    return {
        searchTerm,
        setSearchTerm,
        filteredProducts,
        clearSearch,
    };
};