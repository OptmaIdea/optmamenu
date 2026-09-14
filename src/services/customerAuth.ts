import { supabaseCustomer, supabasePublic } from '@/lib/supabase';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { clearCustomerToken, getCustomerToken, setCustomerToken } from '@/lib/jwt';
import type { Customer } from '@/types';

type CustomerOtpPurpose =
    | 'login'
    | 'registration'
    | 'password_reset'
    | 'profile_change'
    | 'phone_change'
    | 'sensitive_action'
    | 'account_delete';

type RegistrationPayload = {
    fullName?: string;
    nickname?: string;
    email?: string;
    birthDate?: string;
    termsAccepted: boolean;
    loyaltyOptIn?: boolean;
    marketingConsent?: boolean;
};

const CUSTOMER_REFRESH_TOKEN_KEY = 'customer_refresh_token';
const CUSTOMER_EXPIRES_AT_KEY = 'customer_expires_at';

function toCustomer(payload: any): Customer {
    return {
        id: String(payload.id),
        store_id: String(payload.store_id),
        phone: String(payload.phone ?? ''),
        full_name: payload.full_name ?? null,
        nickname: payload.nickname ?? null,
        cpf: payload.cpf ?? undefined,
        email: payload.email ?? undefined,
        birth_date: payload.birth_date ?? undefined,
        loyalty_points: Number(payload.loyalty_points ?? 0),
        loyalty_tier: (payload.loyalty_tier ?? 'Bronze') as Customer['loyalty_tier'],
        is_whatsapp: Boolean(payload.is_whatsapp ?? true),
        marketing_consent: Boolean(payload.marketing_consent ?? false),
        loyalty_opt_in: Boolean(payload.loyalty_opt_in ?? false),
        email_verified: payload.email_verified ?? undefined,
    };
}

function persistCustomerSession(session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
}) {
    setCustomerToken(session.access_token);
    localStorage.setItem(CUSTOMER_REFRESH_TOKEN_KEY, session.refresh_token);
    if (session.expires_at) {
        localStorage.setItem(CUSTOMER_EXPIRES_AT_KEY, String(session.expires_at));
    }
}

function clearPersistedCustomerSession() {
    clearCustomerToken();
    localStorage.removeItem(CUSTOMER_REFRESH_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_EXPIRES_AT_KEY);
}

async function refreshCustomerSessionIfNeeded() {
    const token = getCustomerToken();
    const refreshToken = localStorage.getItem(CUSTOMER_REFRESH_TOKEN_KEY);
    const expiresAt = Number(localStorage.getItem(CUSTOMER_EXPIRES_AT_KEY) || 0);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (token && (!expiresAt || expiresAt > nowSeconds + 60)) return token;
    if (!refreshToken) return token;

    const { data, error } = await supabasePublic.auth.setSession({
        access_token: token || '',
        refresh_token: refreshToken,
    });

    if (error || !data.session) {
        clearPersistedCustomerSession();
        return null;
    }

    persistCustomerSession(data.session);
    return data.session.access_token;
}

export const AuthService = {
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
        registration?: RegistrationPayload,
    ) {
        const { data, error } = await supabasePublic.functions.invoke('customer-auth-session', {
            body: {
                action: 'otp',
                phone,
                otp,
                storeId,
                purpose,
                registration,
            },
        });

        if (error || !data?.ok || !data?.tokenHash || !data?.customer) {
            if (data?.error === 'otp_locked') throw new Error('Muitas tentativas. Solicite um novo código.');
            if (data?.error === 'terms_required') throw new Error('É necessário aceitar os Termos de Uso e a Política de Privacidade.');
            if (data?.error === 'customer_not_found') throw new Error('Cliente não encontrado para este número.');
            throw new Error('Código inválido, expirado ou não foi possível iniciar a sessão.');
        }

        const { data: authData, error: authError } = await supabasePublic.auth.verifyOtp({
            token_hash: String(data.tokenHash),
            type: 'magiclink',
        });

        if (authError || !authData.session) {
            throw new Error('Código confirmado, mas não foi possível iniciar a sessão. Tente novamente.');
        }

        persistCustomerSession(authData.session);
        const customer = toCustomer(data.customer);
        useCustomerAuth.getState().login(customer);

        return {
            valid: true,
            purpose,
            customer,
        };
    },

    async restoreSession() {
        const token = await refreshCustomerSessionIfNeeded();
        if (!token) {
            useCustomerAuth.getState().logout?.();
            return null;
        }

        const { data, error } = await supabaseCustomer.functions.invoke('customer-auth-session', {
            body: { action: 'me' },
        });

        if (error || !data?.ok || !data?.customer) {
            clearPersistedCustomerSession();
            useCustomerAuth.getState().logout?.();
            return null;
        }

        const customer = toCustomer(data.customer);
        useCustomerAuth.getState().login(customer);
        return customer;
    },

    async loginWithPassword(_phone: string, _password: string, _storeId: string) {
        throw new Error('Para entrar com segurança, use o código enviado por SMS.');
    },

    async logoutCustomer() {
        clearPersistedCustomerSession();
        await supabasePublic.auth.signOut().catch(() => undefined);
        useCustomerAuth.getState().logout?.();
    },
};
