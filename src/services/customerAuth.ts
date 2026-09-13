import { supabaseCustomer, supabasePublic } from '@/lib/supabase';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { issueCustomerJwt, setCustomerToken, clearCustomerToken } from '@/lib/jwt';
import type { Customer } from '@/types';

type CustomerOtpPurpose =
    | 'login'
    | 'registration'
    | 'password_reset'
    | 'profile_change'
    | 'phone_change'
    | 'sensitive_action'
    | 'account_delete';

type VerifyOtpRpcResponse = {
    isValid: boolean;
    isNewUser?: boolean;
    locked?: boolean;
    purpose?: CustomerOtpPurpose;
    customer?: any;
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
            hasPassword: false,
            customer: data,
        };
    },

    async sendOtp(phone: string, storeId: string, purpose: CustomerOtpPurpose = 'login') {
        const { data, error } = await supabasePublic.functions.invoke('send-customer-otp-sms', {
            body: { phone, storeId, purpose },
        });

        if (error) throw new Error('Não foi possível enviar o código por SMS.');
        if (!data?.ok) {
            if (data?.error === 'rate_limited' || data?.error === 'daily_limit_reached' || data?.error === 'sms_rate_limited') {
                throw new Error('Muitas solicitações de código. Aguarde alguns minutos e tente novamente.');
            }
            if (data?.error === 'sms_gateway_not_configured') {
                throw new Error('O serviço de SMS ainda não está configurado.');
            }
            throw new Error('Não foi possível enviar o código por SMS.');
        }

        return data;
    },

    async verifyOtp(
        phone: string,
        otp: string,
        storeId: string,
        purpose: CustomerOtpPurpose = 'login',
    ) {
        const digits = phone.replace(/\D/g, '');

        const { data, error } = await supabasePublic.rpc('verify_customer_otp_sms_safe', {
            p_phone: digits,
            p_otp: otp,
            p_store_id: storeId,
            p_purpose: purpose,
        });

        if (error) throw error;

        const res = data as VerifyOtpRpcResponse;

        if (!res?.isValid) {
            if (res?.locked) throw new Error('Muitas tentativas. Tente novamente mais tarde.');
            throw new Error('Código inválido ou expirado.');
        }

        if (res.customer?.id && res.customer?.store_id) {
            const { token } = await issueCustomerJwt({
                customer_id: String(res.customer.id),
                store_id: String(res.customer.store_id),
            });

            setCustomerToken(token);

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
            purpose: res.purpose ?? purpose,
            customer: res.customer ?? null,
        };
    },

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
