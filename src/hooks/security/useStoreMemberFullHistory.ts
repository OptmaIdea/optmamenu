import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import type {
    StoreMemberFullHistoryFilters,
    StoreMemberFullHistoryRow,
} from '@/types/security';

export function useStoreMemberFullHistory(
    memberId: string | null,
    enabled = true
) {
    const [items, setItems] = useState<StoreMemberFullHistoryRow[]>([]);
    const [filters, setFilters] = useState<StoreMemberFullHistoryFilters>({
        limit: 100,
        offset: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = useCallback(
        async (nextFilters?: StoreMemberFullHistoryFilters) => {
            const storeId = getActiveStoreId();

            if (!enabled || !storeId || !memberId) {
                setItems([]);
                return;
            }

            const mergedFilters = {
                ...filters,
                ...(nextFilters ?? {}),
            };

            setLoading(true);
            setError(null);

            const { data, error: rpcError } = await supabase.rpc(
                'get_store_member_full_history',
                {
                    p_store_id: storeId,
                    p_member_id: memberId,
                    p_date_from: mergedFilters.dateFrom || null,
                    p_date_to: mergedFilters.dateTo || null,
                    p_module: mergedFilters.module || null,
                    p_action: mergedFilters.action || null,
                    p_outcome: mergedFilters.outcome || null,
                    p_search: mergedFilters.search || null,
                    p_limit: mergedFilters.limit ?? 100,
                    p_offset: mergedFilters.offset ?? 0,
                }
            );

            setLoading(false);

            if (rpcError) {
                setError(rpcError.message);
                setItems([]);
                return;
            }

            setFilters(mergedFilters);
            setItems((data ?? []) as StoreMemberFullHistoryRow[]);
        },
        [enabled, memberId, filters]
    );

    const updateFilters = useCallback(
        async (patch: StoreMemberFullHistoryFilters) => {
            await fetchHistory({
                ...filters,
                ...patch,
                offset: patch.offset ?? 0,
            });
        },
        [fetchHistory, filters]
    );

    const resetFilters = useCallback(async () => {
        await fetchHistory({
            limit: 100,
            offset: 0,
            dateFrom: null,
            dateTo: null,
            module: null,
            action: null,
            outcome: null,
            search: null,
        });
    }, [fetchHistory]);

    useEffect(() => {
        void fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, memberId]);

    return {
        items,
        filters,
        loading,
        error,
        fetchHistory,
        updateFilters,
        resetFilters,
    };
}