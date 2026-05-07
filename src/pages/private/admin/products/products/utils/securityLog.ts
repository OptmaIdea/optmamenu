import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';

export const logAction = async (
    action: string,
    details: any = {},
    outcome: 'success' | 'failure' = 'success'
) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const activeStoreId = getActiveStoreId();
        if (!activeStoreId) {
            console.warn('Log ignorado: nenhuma loja ativa selecionada.');
            return;
        }

        await supabase.rpc('insert_security_log', {
            p_store_id: activeStoreId,
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