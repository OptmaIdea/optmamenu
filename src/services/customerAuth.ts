// src/services/customerAuth.ts
import { supabase } from '@/lib/supabase';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { setCustomerToken, clearCustomerToken } from '@/lib/jwt';
import type { Customer } from '@/types';

// Tipagem mínima do RPC (evita o erro do generic constraint)
type VerifyOtpRpcResponse = {
    isValid: boolean;
    isNewUser?: boolean;
    locked?: boolean;
    customer?: {
        id: string;
        store_id: string;
        phone?: string;
        nickname?: string;
    } | null;
};

type IssueJwtResponse = {
    token: string;
    exp?: number;
};

export const AuthService = {
    async checkStatus(phone: string, storeId: string) {
        const digits = phone.replace(/\D/g, '');

        // Evite select('*') se você não precisa de tudo
        const { data, error } = await supabase
            .from('customers')
            .select('id, store_id, phone, nickname, password_hash')
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

        const { data: raw, error } = await supabase.rpc('verify_customer_otp', {
            p_phone: digits,
            p_otp: otp,
            p_store_id: storeId,
        });

        if (error) throw error;

        const data = raw as VerifyOtpRpcResponse | null;

        if (!data?.isValid) {
            if (data?.locked) throw new Error('Muitas tentativas. Tente novamente mais tarde.');
            throw new Error('Código inválido ou expirado.');
        }

        // Se não veio customer, você pode tratar como "novo usuário"
        if (!data.customer?.id || !data.customer?.store_id) {
            return {
                valid: true,
                isNewUser: true,
                customer: null,
            };
        }

        // 1) Pede JWT para a Edge Function (Supabase Functions)
        const { data: jwtData, error: jwtError } = await supabase.functions.invoke('issue_customer_jwt', {
            body: {
                customer_id: data.customer.id,
                store_id: data.customer.store_id,
                // expires_in_seconds: 60 * 60 * 24 * 7, // opcional
            },
        });

        if (jwtError) throw jwtError;

        const issued = jwtData as IssueJwtResponse;
        if (!issued?.token) throw new Error('Falha ao emitir token do cliente.');

        // 2) Salva token local
        setCustomerToken(issued.token);

        // 3) Busca o Customer COMPLETO (agora com RLS usando o token)
        // Ajuste os campos conforme seu type Customer em '@/types'
        const { data: fullCustomer, error: custErr } = await supabase
            .from('customers')
            .select('*')
            .eq('id', data.customer.id)
            .maybeSingle();

        if (custErr) throw custErr;
        if (!fullCustomer) throw new Error('Cliente não encontrado após autenticação.');

        // 4) Login com tipo correto
        useCustomerAuth.getState().login(fullCustomer as Customer);

        return {
            valid: true,
            isNewUser: !!data.isNewUser,
            customer: fullCustomer as Customer,
        };
    },

    logoutCustomer() {
        clearCustomerToken();
        useCustomerAuth.getState().logout?.();
    },
};