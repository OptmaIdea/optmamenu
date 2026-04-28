import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { InventoryTransitRow } from '../types/inventoryTransit.types';

export function useInventoryTransit(storeId: string | null | undefined) {
    const [rows, setRows] = useState<InventoryTransitRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!storeId) {
            setRows([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.rpc('get_inventory_transit_by_store', {
                p_store_id: storeId,
            });

            if (error) throw error;

            setRows((data ?? []) as InventoryTransitRow[]);
        } catch (err: any) {
            console.error('Erro ao carregar estoque em trânsito:', err);
            setError(err?.message ?? 'Erro ao carregar estoque em trânsito.');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

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