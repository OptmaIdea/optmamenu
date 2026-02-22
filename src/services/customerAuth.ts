// src/services/customerAuth.ts
import { supabase } from '@/lib/supabase';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { setCustomerToken, clearCustomerToken } from '@/lib/jwt';

type IssueJwtResponse = {
    token: string;
    customer?: any;
};

export const AuthService = {
    // 0) Check status (recomendo NÃO usar select('*') em produção)
    async checkStatus(phone: string, storeId: string) {
        const digits = phone.replace(/\D/g, '');

        const { data, error } = await supabase
            .from('customers')
            .select('id, phone, store_id, nickname, status, password_hash') // ajuste se quiser
            .eq('phone', digits)
            .eq('store_id', storeId)
            .maybeSingle();

        if (error) throw error;

        return {
            exists: !!data,
            hasPassword: !!(data as any)?.password_hash,
            customer: data,
        };
    },

    async sendOtp(phone: string, storeId: string) {
        const digits = phone.replace(/\D/g, '');

        const { data, error } = await supabase.rpc('send_customer_otp', {
            p_phone: digits,
            p_store_id: storeId,
        });

        if (error) throw error;
        return data;
    },

    async verifyOtp(phone: string, otp: string, storeId: string) {
        const digits = phone.replace(/\D/g, '');

        // 1) Valida OTP na sua função SQL
        const { data, error } = await supabase.rpc('verify_customer_otp', {
            p_phone: digits,
            p_otp: otp,
            p_store_id: storeId,
        });

        if (error) throw error;

        if (!data?.isValid) {
            throw new Error('Código inválido ou expirado.');
        }

        // 2) Emite JWT no backend (Edge Function)
        const { data: jwtData, error: jwtErr } = await supabase.functions.invoke<IssueJwtResponse>(
            'issue_customer_jwt',
            {
                body: {
                    phone: digits,
                    store_id: storeId,
                },
            }
        );

        if (jwtErr) throw jwtErr;
        if (!jwtData?.token) throw new Error('Falha ao emitir token.');

        // 3) Salva token e cria sessão local
        setCustomerToken(jwtData.token);

        // Se sua Edge Function devolver customer também, perfeito:
        if (jwtData.customer) {
            useCustomerAuth.getState().login(jwtData.customer);
        } else if (data.customer) {
            // fallback: usa o customer vindo do verify_customer_otp
            useCustomerAuth.getState().login(data.customer);
        }

        return {
            valid: true,
            isNewUser: data.isNewUser,
            customer: jwtData.customer ?? data.customer ?? null,
        };
    },

    logoutCustomer() {
        clearCustomerToken();
        useCustomerAuth.getState().logout?.();
    },
};