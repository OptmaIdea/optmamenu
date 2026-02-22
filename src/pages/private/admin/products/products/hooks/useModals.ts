import { useState, useMemo, useCallback } from 'react';
import type { Product, ProductStats, ModalState, ModalFilterType } from '../types/product.types';

export const useModals = (products: Product[]) => {
    const [modalState, setModalState] = useState<ModalState>({ type: null });

    const openStatsModal = useCallback((filterType: ModalFilterType) => {
        setModalState({ type: 'stats', filterType });
    }, []);

    const openActionModal = useCallback((productId: string) => {
        setModalState({ type: 'actions', productId });
    }, []);

    const closeModal = useCallback(() => {
        setModalState({ type: null });
    }, []);

    const selectedProduct = useMemo(() => {
        if (modalState.type === 'actions' && modalState.productId) {
            return products.find((p) => p.id === modalState.productId) || null;
        }
        return null;
    }, [modalState, products]);

    const stats = useMemo<ProductStats>(() => {
        const total = products.length;
        const activeProducts = products.filter((p) => p.active);
        const inactiveProducts = products.filter((p) => !p.active);

        const totalActive = activeProducts.length;
        const totalInactive = inactiveProducts.length;

        const totalValue = activeProducts.reduce(
            (acc, p) => acc + (p.price * (p.stock_quantity || 0)),
            0
        );

        const zeroStockProducts = activeProducts.filter((p) => p.stock_quantity === 0);
        const lowStockProducts = activeProducts.filter(
            (p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock
        );
        const highStockProducts = activeProducts.filter(
            (p) => p.stock_quantity > p.max_stock
        );

        return {
            total,
            totalActive,
            totalInactive,
            totalValue,
            zeroStock: zeroStockProducts.length,
            lowStock: lowStockProducts.length,
            highStock: highStockProducts.length,
            zeroStockProducts,
            lowStockProducts,
            highStockProducts,
            allProducts: products,
        };
    }, [products]);

    return {
        stats,
        modalState,
        openStatsModal,
        openActionModal,
        closeModal,
        selectedProduct,
    };
};