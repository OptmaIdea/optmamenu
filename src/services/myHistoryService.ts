import { supabase } from '@/lib/supabase';

export interface MyVisibleHistoryItem {
    event_id: string;
    event_at: string;
    event_type: string | null;
    event_label: string | null;
    title: string;
    description: string | null;
    severity: 'info' | 'warning' | 'low' | 'medium' | 'high' | 'critical';
    visible_to_member: boolean;
    metadata?: Record<string, unknown> | null;
}

export async function getMyVisibleStoreMemberHistory(
    storeId: string,
    limit = 100
): Promise<MyVisibleHistoryItem[]> {
    const { data, error } = await supabase.rpc(
        'get_my_visible_store_member_history',
        {
            p_store_id: storeId,
            p_limit: limit,
        }
    );

    if (error) throw error;

    return Array.isArray(data) ? (data as MyVisibleHistoryItem[]) : [];
}
