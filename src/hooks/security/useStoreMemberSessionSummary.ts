import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import type { StoreMemberSessionSummaryRow } from '@/types/security';

export function useStoreMemberSessionSummary() {
    const [items, setItems] = useState<StoreMemberSessionSummaryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSessionSummary = useCallback(async () => {
        const storeId = getActiveStoreId();

        if (!storeId) {
            setItems([]);
            return;
        }

        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc('get_store_member_session_summary', {
            p_store_id: storeId,
        });

        setLoading(false);

        if (rpcError) {
            setError(rpcError.message);
            setItems([]);
            return;
        }

        setItems((data ?? []) as StoreMemberSessionSummaryRow[]);
    }, []);

    useEffect(() => {
        void fetchSessionSummary();
    }, [fetchSessionSummary]);

    return {
        items,
        loading,
        error,
        refresh: fetchSessionSummary,
    };
}