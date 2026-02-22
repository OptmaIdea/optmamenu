// src/services/customerAuth.ts
import { supabase } from '@/lib/supabase';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { setCustomerToken, clearCustomerToken } from '@/lib/jwt';
import type { Customer } from '@/types';

type VerifyOtpRpcResponse = {
    isValid: boolean;
    isNewUser?: boolean;
    customer?: Partial<Customer> | null; // vem do RPC (pode vir parcial)
    locked?: boolean;
};

type IssueJwtResponse = {
    token: string;
    exp?: number;
};

export const AuthService = {
    async checkStatus(phone: string, storeId: string) {
        const digits = phone.replace(/\D/g, '');

        const { data, error } = await supabase
            .from('customers')
            .select('*')
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

        const { data, error } = await supabase.rpc('verify_customer_otp', {
            p_phone: digits,
            p_otp: otp,
            p_store_id: storeId,
        });

        if (error) throw error;

        const payload = data as VerifyOtpRpcResponse | null;

        if (!payload?.isValid) {
            throw new Error('Código inválido ou expirado.');
        }

        // Se já existe customer, vamos emitir JWT via Edge Function
        const c = payload.customer;

        if (c?.id && c?.store_id) {
            const { data: jwtData, error: jwtErr } = await supabase.functions.invoke<IssueJwtResponse>(
                'issue_customer_jwt',
                {
                    body: {
                        customer_id: c.id,
                        store_id: c.store_id,
                        // opcional:
                        // expires_in_seconds: 60 * 60 * 24 * 7,
                    },
                }
            );

            if (jwtErr) throw jwtErr;
            if (!jwtData?.token) throw new Error('Falha ao emitir token do cliente');

            setCustomerToken(jwtData.token);

            // ⚠️ Tipagem: seu Customer exige campos obrigatórios.
            // Garanta que o RPC esteja retornando tudo, OU faça um fetch completo aqui.
            // Eu recomendo fetch completo para evitar “Customer incompleto”.
            const { data: fullCustomer, error: custErr } = await supabase
                .from('customers')
                .select('*')
                .eq('id', c.id)
                .maybeSingle();

            if (custErr) throw custErr;
            if (fullCustomer) useCustomerAuth.getState().login(fullCustomer as Customer);
        }

        return {
            valid: true,
            isNewUser: payload.isNewUser ?? false,
            customer: payload.customer ?? null,
        };
    },

    logoutCustomer() {
        clearCustomerToken();
        useCustomerAuth.getState().logout?.();
    },
};