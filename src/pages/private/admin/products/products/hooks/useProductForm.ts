import { useState } from 'react';
import type { Product } from '../types/product.types';

export const useProductForm = (initialProduct?: Product | null) => {
    const [name, setName] = useState(initialProduct?.name || '');
    const [description, setDescription] = useState(initialProduct?.description || '');
    const [price, setPrice] = useState(initialProduct?.price?.toString() || '');
    const [active, setActive] = useState(initialProduct?.active ?? true);
    const [stockQuantity, setStockQuantity] = useState(initialProduct?.stock_quantity || 0);
    const [minStock, setMinStock] = useState(initialProduct?.min_stock || 0);
    const [maxStock, setMaxStock] = useState(initialProduct?.max_stock || 0);

    return {
        name, setName,
        description, setDescription,
        price, setPrice,
        active, setActive,
        stockQuantity, setStockQuantity,
        minStock, setMinStock,
        maxStock, setMaxStock,
    };
};