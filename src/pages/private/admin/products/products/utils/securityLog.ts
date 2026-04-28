import { supabase } from '@/lib/supabase';

export const logAction = async (
    action: string,
    details: any = {},
    outcome: 'success' | 'failure' = 'success'
) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: storeData, error } = await supabase.rpc(
            'get_user_store_by_id',
            { p_user_id: user.id }
        );
        if (error || !storeData) return;
        const store = Array.isArray(storeData) ? storeData[0] : storeData;
        if (!store) return;
        const storeId = store.id;
        await supabase.rpc('insert_security_log', {
            p_store_id: storeId,
            p_user_id: user?.id ?? null,
            p_user_email: user?.email ?? null,
            p_action: action,
            p_details: details ?? {},
            p_outcome: outcome ?? 'success',
        });
    } catch (e) {
        console.error('Erro ao registrar log:', e);
    }
};