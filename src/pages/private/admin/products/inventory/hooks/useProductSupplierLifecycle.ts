import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
    ProductPurchaseCostHistoryRow,
    ProductSupplierSummaryRow,
} from '../types/productSupplierLifecycle.types';

export function useProductSupplierLifecycle(productId: string | undefined) {
    const [suppliers, setSuppliers] = useState<ProductSupplierSummaryRow[]>([]);
    const [costHistory, setCostHistory] = useState<ProductPurchaseCostHistoryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!productId) {
            setSuppliers([]);
            setCostHistory([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [suppliersResult, historyResult] = await Promise.all([
                supabase.rpc('get_product_supplier_summary', {
                    p_product_id: productId,
                }),
                supabase.rpc('get_product_purchase_cost_history', {
                    p_product_id: productId,
                    p_limit: 200,
                }),
            ]);

            const firstError = suppliersResult.error || historyResult.error;
            if (firstError) throw firstError;

            setSuppliers((suppliersResult.data ?? []) as ProductSupplierSummaryRow[]);
            setCostHistory((historyResult.data ?? []) as ProductPurchaseCostHistoryRow[]);
        } catch (err: any) {
            console.error('Erro ao carregar fornecedores/custos do produto:', err);
            setError(err?.message ?? 'Erro ao carregar fornecedores/custos do produto.');
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const preferredSupplier = useMemo(() => {
        return (
            suppliers.find((supplier) => supplier.preferred_supplier && !supplier.blocked) ??
            suppliers.find((supplier) => !supplier.blocked) ??
            suppliers[0] ??
            null
        );
    }, [suppliers]);

    const lastCost = useMemo(() => {
        return costHistory[0] ?? null;
    }, [costHistory]);

    return {
        suppliers,
        costHistory,
        preferredSupplier,
        lastCost,
        loading,
        error,
        refresh,
    };
}