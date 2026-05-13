import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ProductTransitSummaryRow = {
    store_id: string;
    product_id: string;
    product_name: string;
    location_id: string;
    location_code: string | null;
    location_name: string;

    in_transit_in: number;
    in_transit_out: number;
    net_in_transit: number;

    incoming_transfers_count: number;
    outgoing_transfers_count: number;

    incoming_transfers: any[];
    outgoing_transfers: any[];
};

export function useProductTransitSummary(productId: string | undefined) {
    const [rows, setRows] = useState<ProductTransitSummaryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!productId) {
            setRows([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.rpc('get_product_transit_summary', {
                p_product_id: productId,
            });

            if (error) throw error;

            setRows((data ?? []) as ProductTransitSummaryRow[]);
        } catch (err: any) {
            console.error('Erro ao carregar trânsito do produto:', err);
            setError(err?.message ?? 'Erro ao carregar trânsito do produto.');
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        rows,
        loading,
        error,
        refresh,
    };
}