// src/hooks/useStoreSecurityConfig.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type StoreByUserRow = {
    id: string;
    slug?: string;
    config?: any;
};

type StoreConfigAdminRow = {
    config?: any;
    sms_gateway_token?: string | null;
};

export const useStoreSecurityConfig = () => {
    const [tokenExpirySeconds, setTokenExpirySeconds] = useState(45);
    const [maxTokenAttempts, setMaxTokenAttempts] = useState(3);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const {
                    data: { user },
                    error: userError,
                } = await supabase.auth.getUser();

                if (userError) throw userError;
                if (!user) return;

                // ✅ 1) pega a store do user via RPC (evita .fro m('stores'))
                const { data: storeRows, error: storeRpcError } = await supabase.rpc(
                    'get_user_store_by_id',
                    { p_user_id: user.id }
                );

                if (storeRpcError) throw storeRpcError;

                const store = (Array.isArray(storeRows) ? storeRows[0] : storeRows) as
                    | StoreByUserRow
                    | undefined;

                const storeId = store?.id;
                if (!storeId) return;

                // ✅ 2) pega config admin via RPC
                const { data: cfgRows, error: cfgError } = await supabase.rpc(
                    'get_store_config_admin',
                    { p_store_id: storeId }
                );

                if (cfgError) throw cfgError;

                const cfg = (Array.isArray(cfgRows) ? cfgRows[0] : cfgRows) as
                    | StoreConfigAdminRow
                    | undefined;

                // ✅ prioridade: config do get_store_config_admin; fallback: config do get_user_store_by_id
                const config = cfg?.config ?? store?.config ?? {};

                setTokenExpirySeconds(Number(config.token_expiry_seconds ?? 45));
                setMaxTokenAttempts(Number(config.max_token_attempts ?? 3));
            } catch (err) {
                console.error('Erro ao buscar configurações de segurança:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, []);

    return { tokenExpirySeconds, maxTokenAttempts, loading };
};