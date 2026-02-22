import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const useStoreSecurityConfig = () => {
    const [tokenExpirySeconds, setTokenExpirySeconds] = useState(45);
    const [maxTokenAttempts, setMaxTokenAttempts] = useState(3);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: store } = await supabase
                    .from('stores')
                    .select('token_expiry_seconds, max_token_attempts')
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (store) {
                    setTokenExpirySeconds(store.token_expiry_seconds ?? 45);
                    setMaxTokenAttempts(store.max_token_attempts ?? 3);
                }
            } catch (error) {
                console.error('Erro ao buscar configurações de segurança:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    return { tokenExpirySeconds, maxTokenAttempts, loading };
};