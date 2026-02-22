import { supabase } from '@/lib/supabase';

export const logAction = async (
    action: string,
    details: any = {},
    outcome: 'success' | 'failure' = 'success'
) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: store } = await supabase
            .from('stores')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (!store) return;
        await supabase.from('store_security_logs').insert({
            store_id: store.id,
            user_id: user.id,
            user_email: user.email,
            action,
            details,
            outcome,
        });
    } catch (e) {
        console.error('Erro ao registrar log:', e);
    }
};