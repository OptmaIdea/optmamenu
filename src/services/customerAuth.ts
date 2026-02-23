import { supabaseCustomer } from '@/lib/supabase';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { issueCustomerJwt, setCustomerToken, clearCustomerToken } from '@/lib/jwt';
import type { Customer } from '@/types';

type VerifyOtpRpcResponse = {
    isValid: boolean;
    isNewUser?: boolean;
    locked?: boolean;
    customer?: any; // vem do RPC como jsonb; tipamos abaixo
};

export const AuthService = {
    async checkStatus(phone: string, storeId: string) {
        const digits = phone.replace(/\D/g, '');

        const { data, error } = await supabaseCustomer
            .from('customers')
            .select('id, store_id, phone, full_name, nickname, email, birth_date, loyalty_points, loyalty_tier, is_whatsapp, marketing_consent, loyalty_opt_in, email_verified')
            .eq('phone', digits)
            .eq('store_id', storeId)
            .maybeSingle();

        if (error) throw error;

        return {
            exists: !!data,
            // se você quiser mesmo saber "tem senha", faça isso via RPC (não via select de hash)
            hasPassword: false,
            customer: data,
        };
    },

    async sendOtp(phone: string, storeId: string) {
        const digits = phone.replace(/\D/g, '');

        const { data, error } = await supabaseCustomer.rpc('send_customer_otp', {
            p_phone: digits,
            p_store_id: storeId,
        });

        if (error) throw error;
        return data;
    },

    async verifyOtp(phone: string, otp: string, storeId: string) {
        const digits = phone.replace(/\D/g, '');

        const { data, error } = await supabaseCustomer.rpc('verify_customer_otp', {
            p_phone: digits,
            p_otp: otp,
            p_store_id: storeId,
        });

        if (error) throw error;

        const res = data as VerifyOtpRpcResponse;

        if (!res?.isValid) {
            if (res?.locked) throw new Error('Muitas tentativas. Tente novamente mais tarde.');
            throw new Error('Código inválido ou expirado.');
        }

        // Se retornou customer, cria token e faz login local
        if (res.customer?.id && res.customer?.store_id) {
            const { token } = await issueCustomerJwt({
                customer_id: String(res.customer.id),
                store_id: String(res.customer.store_id),
            });

            setCustomerToken(token);

            // Tipagem: garante que bate com src/types Customer (campos podem ser null)
            const customer: Customer = {
                id: String(res.customer.id),
                store_id: String(res.customer.store_id),
                phone: String(res.customer.phone ?? digits),
                full_name: res.customer.full_name ?? null,
                nickname: res.customer.nickname ?? null,
                cpf: res.customer.cpf ?? undefined,
                email: res.customer.email ?? undefined,
                birth_date: res.customer.birth_date ?? undefined,
                loyalty_points: Number(res.customer.loyalty_points ?? 0),
                loyalty_tier: (res.customer.loyalty_tier ?? 'Bronze') as Customer['loyalty_tier'],
                is_whatsapp: Boolean(res.customer.is_whatsapp ?? true),
                marketing_consent: Boolean(res.customer.marketing_consent ?? false),
                loyalty_opt_in: Boolean(res.customer.loyalty_opt_in ?? false),
                email_verified: res.customer.email_verified ?? undefined,
            };

            useCustomerAuth.getState().login(customer);
        }

        return {
            valid: true,
            isNewUser: !!res.isNewUser,
            customer: res.customer ?? null,
        };
    },

    /**
     * Login com senha via RPC server-side.
     * O RPC `customer_login_with_password` valida a senha e retorna o customer.
     */
    async loginWithPassword(phone: string, password: string, storeId: string) {
        const cleanPhone = phone.replace(/\D/g, '');

        const { data, error } = await supabaseCustomer.rpc('customer_login_with_password', {
            p_phone: cleanPhone,
            p_password: password,
            p_store_id: storeId,
        });

        if (error) throw error;
        if (!data?.customer?.id) throw new Error('Credenciais inválidas');

        const { token } = await issueCustomerJwt({
            customer_id: String(data.customer.id),
            store_id: String(data.customer.store_id),
        });

        setCustomerToken(token);

        const customer: Customer = {
            id: String(data.customer.id),
            store_id: String(data.customer.store_id),
            phone: String(data.customer.phone ?? cleanPhone),
            full_name: data.customer.full_name ?? null,
            nickname: data.customer.nickname ?? null,
            cpf: data.customer.cpf ?? undefined,
            email: data.customer.email ?? undefined,
            birth_date: data.customer.birth_date ?? undefined,
            loyalty_points: Number(data.customer.loyalty_points ?? 0),
            loyalty_tier: (data.customer.loyalty_tier ?? 'Bronze') as Customer['loyalty_tier'],
            is_whatsapp: Boolean(data.customer.is_whatsapp ?? true),
            marketing_consent: Boolean(data.customer.marketing_consent ?? false),
            loyalty_opt_in: Boolean(data.customer.loyalty_opt_in ?? false),
            email_verified: data.customer.email_verified ?? undefined,
        };

        useCustomerAuth.getState().login(customer);
        return { customer, isNewUser: false };
    },

    /**
     * Mantido para o build (Catalog.tsx).
     * Você pode cadastrar sem senha e depois usar OTP para criar senha.
     */
    async registerUser(data: {
        phone: string;
        storeId: string;
        storeName: string;
        nickname: string;
        marketingConsent: boolean;
        email?: string;
        contactPreference?: 'whatsapp' | 'sms';
        birthDate?: string;
        loyaltyOptIn?: boolean;
    }) {
        const digits = data.phone.replace(/\D/g, '');

        const insertData = {
            phone: digits,
            store_id: data.storeId,
            nickname: data.nickname,
            email: data.email || null,
            birth_date: data.birthDate || null,
            marketing_consent: data.marketingConsent,
            loyalty_opt_in: data.loyaltyOptIn ?? false,
            status: 'active',
        };

        const { data: newCustomer, error } = await supabaseCustomer
            .from('customers')
            .insert(insertData)
            .select('id, store_id, phone, full_name, nickname, email, birth_date, loyalty_points, loyalty_tier, is_whatsapp, marketing_consent, loyalty_opt_in, email_verified')
            .maybeSingle();

        if (error) throw error;
        if (!newCustomer?.id) throw new Error('Falha ao criar cliente');

        // Emite token logo após criar (opcional, mas deixa o fluxo suave)
        const { token } = await issueCustomerJwt({
            customer_id: String(newCustomer.id),
            store_id: String(newCustomer.store_id),
        });
        setCustomerToken(token);

        useCustomerAuth.getState().login(newCustomer as unknown as Customer);
        return newCustomer;
    },

    logoutCustomer() {
        clearCustomerToken();
        useCustomerAuth.getState().logout?.();
    },
};