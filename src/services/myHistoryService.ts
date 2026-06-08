import { supabase } from '@/lib/supabase';

export interface MyVisibleActivityLog {
    id: string;
    created_at: string;
    action: string;
    display_action: string;
    outcome: 'success' | 'failure';
    details: Record<string, unknown> | null;
}

export interface GetMyVisibleActivityLogsParams {
    storeId: string;
    startDate?: string | null;
    endDate?: string | null;
    actionFilter?: string | null;
    outcomeFilter?: string | null;
}

export async function getMyVisibleActivityLogs(
    params: GetMyVisibleActivityLogsParams
): Promise<MyVisibleActivityLog[]> {
    const { data, error } = await supabase.rpc(
        'get_my_visible_activity_logs',
        {
            p_store_id: params.storeId,
            p_start_date: params.startDate || null,
            p_end_date: params.endDate || null,
            p_action: params.actionFilter || null,
            p_outcome: params.outcomeFilter === 'all' ? null : params.outcomeFilter || null,
        }
    );

    if (error) throw error;

    return Array.isArray(data) ? (data as MyVisibleActivityLog[]) : [];
}
