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
        // Separação entre produtos operacionais (não descontinuados) e descontinuados
        const operationalProducts = products.filter((p) => !p.is_discontinued);
        const discontinuedProducts = products.filter((p) => Boolean(p.is_discontinued));

        const total = operationalProducts.length;
        const activeProducts = operationalProducts.filter((p) => p.active);

        const totalActive = activeProducts.length;
        const totalInactive = operationalProducts.filter((p) => !p.active).length;
        const totalDiscontinued = discontinuedProducts.length;

        const totalValue = activeProducts.reduce(
            (acc, p) => acc + (p.price * Number(p.display_on_hand ?? 0)),
            0
        );

        const zeroStockProducts = activeProducts.filter(
            (p) => Number(p.display_available ?? 0) <= 0
        );

        const lowStockProducts = activeProducts.filter(
            (p) => p.global_status === 'global_critical'
        );

        const attentionStockProducts = activeProducts.filter(
            (p) => p.global_status === 'global_attention'
        );

        const highStockProducts = activeProducts.filter(
            (p) => p.global_status === 'global_excess'
        );

        const recommendedBuyProducts = activeProducts.filter(
            (p) => p.recommended_action === 'buy'
        );

        const recommendedTransferProducts = activeProducts.filter(
            (p) =>
                p.recommended_action === 'transfer' ||
                p.recommended_action === 'transfer_or_redistribute'
        );

        const recommendedMonitorProducts = activeProducts.filter(
            (p) => p.recommended_action === 'monitor'
        );

        const recommendedReviewExcessProducts = activeProducts.filter(
            (p) => p.recommended_action === 'review_excess'
        );

        const recommendedOkProducts = activeProducts.filter(
            (p) => p.recommended_action === 'ok'
        );

        return {
            total,
            totalActive,
            totalInactive,
            totalDiscontinued,
            totalValue,

            zeroStock: zeroStockProducts.length,
            lowStock: lowStockProducts.length,
            attentionStock: attentionStockProducts.length,
            highStock: highStockProducts.length,

            recommendedBuy: recommendedBuyProducts.length,
            recommendedTransfer: recommendedTransferProducts.length,
            recommendedMonitor: recommendedMonitorProducts.length,
            recommendedReviewExcess: recommendedReviewExcessProducts.length,
            recommendedOk: recommendedOkProducts.length,

            zeroStockProducts,
            lowStockProducts,
            attentionStockProducts,
            highStockProducts,
            recommendedBuyProducts,
            recommendedTransferProducts,
            discontinuedProducts,
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