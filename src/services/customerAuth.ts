import { supabaseCustomer, supabaseCustomerAuth, supabasePublic } from '@/lib/supabase';
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
    password?: string;
};

export type PasswordLoginResult = {
    authenticated: boolean;
    otpRequired: boolean;
    reason?: 'new_device' | 'verification_expired' | 'inactive' | string | null;
    customer?: Customer;
};

const CUSTOMER_REFRESH_TOKEN_KEY = 'customer_refresh_token';
const CUSTOMER_EXPIRES_AT_KEY = 'customer_expires_at';
const CUSTOMER_DEVICE_SECRET_KEY = 'customer_device_secret_v1';

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

function bytesToHex(bytes: Uint8Array) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getOrCreateDeviceSecret() {
    const existing = localStorage.getItem(CUSTOMER_DEVICE_SECRET_KEY);
    if (existing && /^[0-9a-f]{64}$/i.test(existing)) return existing.toLowerCase();

    if (!globalThis.crypto?.getRandomValues) {
        throw new Error('Este navegador não oferece os recursos de segurança necessários para proteger a sessão.');
    }

    const random = new Uint8Array(32);
    globalThis.crypto.getRandomValues(random);
    const secret = bytesToHex(random);
    localStorage.setItem(CUSTOMER_DEVICE_SECRET_KEY, secret);
    return secret;
}

async function getDeviceTokenHash() {
    const secret = getOrCreateDeviceSecret();
    if (!globalThis.crypto?.subtle) {
        throw new Error('Este navegador não oferece os recursos de segurança necessários para proteger a sessão.');
    }

    const digest = await globalThis.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(secret),
    );
    return bytesToHex(new Uint8Array(digest));
}

async function readFunctionErrorPayload(error: unknown) {
    const context = (error as { context?: Response } | null)?.context;
    if (!context || typeof context.clone !== 'function') return null;
    try {
        return await context.clone().json() as {
            error?: string;
            message?: string;
            smsSent?: boolean;
            retryAfterSeconds?: number;
        };
    } catch {
        return null;
    }
}

async function refreshCustomerSessionIfNeeded() {
    const token = getCustomerToken();
    const refreshToken = localStorage.getItem(CUSTOMER_REFRESH_TOKEN_KEY);
    const expiresAt = Number(localStorage.getItem(CUSTOMER_EXPIRES_AT_KEY) || 0);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (token && (!expiresAt || expiresAt > nowSeconds + 60)) return token;
    if (!refreshToken) return token;

    const { data, error } = await supabaseCustomerAuth.auth.setSession({
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

async function completeSession(data: any) {
    if (!data?.tokenHash || !data?.customer) {
        throw new Error('Não foi possível iniciar a sessão. Tente novamente.');
    }

    const { data: authData, error: authError } = await supabaseCustomerAuth.auth.verifyOtp({
        token_hash: String(data.tokenHash),
        type: 'magiclink',
    });

    if (authError || !authData.session) {
        throw new Error('A identidade foi confirmada, mas não foi possível iniciar a sessão. Tente novamente.');
    }

    persistCustomerSession(authData.session);
    const customer = toCustomer(data.customer);
    useCustomerAuth.getState().login(customer);

    return {
        customer,
        passwordConfigured: Boolean(data.passwordConfigured),
    };
}

export const AuthService = {
    // Mantido sem enumeração pública de telefone. O servidor decide o fluxo de login.
    async checkStatus(_phone: string, _storeId: string) {
        return {
            exists: false,
            hasPassword: false,
            customer: null,
        };
    },

    async sendOtp(phone: string, storeId: string, purpose: CustomerOtpPurpose = 'login') {
        const { data, error } = await supabasePublic.functions.invoke('send-customer-otp-sms', {
            body: { phone, storeId, purpose },
        });

        const errorPayload = error ? await readFunctionErrorPayload(error) : null;
        const payload = (data && typeof data === 'object' ? data : errorPayload) as {
            ok?: boolean;
            error?: string;
            message?: string;
            smsSent?: boolean;
            retryAfterSeconds?: number;
        } | null;

        if (payload?.ok) return payload;
        if (payload?.error === 'rate_limited' || payload?.error === 'daily_limit_reached' || payload?.error === 'sms_rate_limited') {
            throw new Error('Muitas solicitações de código. Aguarde alguns minutos e tente novamente.');
        }
        if (payload?.error === 'sms_gateway_not_configured') {
            throw new Error('O serviço de SMS ainda não está configurado.');
        }
        if (payload?.error === 'phone_already_registered') {
            throw new Error(payload.message || 'Este telefone já possui uma conta nesta loja. Use a opção Entrar; nenhum SMS foi enviado.');
        }
        if (payload?.error === 'customer_not_found') {
            throw new Error(payload.message || 'Não encontramos uma conta com este telefone nesta loja. Use Criar conta; nenhum SMS foi enviado.');
        }
        if (payload?.error === 'invalid_phone') {
            throw new Error('Informe um telefone válido. Para números do Brasil, o +55 é opcional.');
        }
        if (error) throw new Error('Não foi possível enviar o código por SMS.');
        throw new Error(payload?.message || 'Não foi possível enviar o código por SMS.');
    },

    async verifyOtp(
        phone: string,
        otp: string,
        storeId: string,
        purpose: CustomerOtpPurpose = 'login',
        registration?: RegistrationPayload,
    ) {
        const deviceTokenHash = await getDeviceTokenHash();
        const { data, error } = await supabasePublic.functions.invoke('customer-auth-session', {
            body: {
                action: 'otp',
                phone,
                otp,
                storeId,
                purpose,
                registration,
                deviceTokenHash,
            },
        });

        if (error || !data?.ok || !data?.tokenHash || !data?.customer) {
            if (data?.error === 'otp_locked') throw new Error('Muitas tentativas. Solicite um novo código.');
            if (data?.error === 'terms_required') throw new Error('É necessário aceitar os Termos de Uso e a Política de Privacidade.');
            if (data?.error === 'password_required') throw new Error('Crie uma senha para concluir o cadastro.');
            if (data?.error === 'weak_password') throw new Error('A senha deve ter de 8 a 72 caracteres, com letras e números.');
            if (data?.error === 'customer_already_exists') throw new Error('Já existe uma conta com este telefone. Use a opção Entrar.');
            if (data?.error === 'customer_not_found') throw new Error('Cliente não encontrado para este número.');
            throw new Error('Código inválido, expirado ou não foi possível iniciar a sessão.');
        }

        const session = await completeSession(data);

        return {
            valid: true,
            isNewUser: purpose === 'registration',
            purpose,
            customer: session.customer,
            passwordConfigured: session.passwordConfigured,
        };
    },

    async loginWithPassword(phone: string, password: string, storeId: string): Promise<PasswordLoginResult> {
        const deviceTokenHash = await getDeviceTokenHash();
        const { data, error } = await supabasePublic.functions.invoke('customer-auth-session', {
            body: {
                action: 'password_login',
                phone,
                password,
                storeId,
                deviceTokenHash,
            },
        });

        if (data?.error === 'locked') {
            const seconds = Math.max(60, Number(data.retryAfterSeconds || 900));
            const minutes = Math.ceil(seconds / 60);
            throw new Error(`Muitas tentativas de senha. Aguarde cerca de ${minutes} minuto(s) e tente novamente.`);
        }
        if (data?.error === 'invalid_credentials') {
            throw new Error('Telefone ou senha incorretos.');
        }
        if (error || !data?.ok) {
            throw new Error('Não foi possível entrar agora. Tente novamente em alguns instantes.');
        }

        if (data.otpRequired) {
            return {
                authenticated: false,
                otpRequired: true,
                reason: data.reason || 'new_device',
            };
        }

        const session = await completeSession(data);
        return {
            authenticated: true,
            otpRequired: false,
            customer: session.customer,
        };
    },

    async setPassword(password: string) {
        const token = await refreshCustomerSessionIfNeeded();
        if (!token) throw new Error('Sua sessão expirou. Confirme seu telefone novamente.');

        const deviceTokenHash = await getDeviceTokenHash();
        const { data, error } = await supabaseCustomer.functions.invoke('customer-auth-session', {
            body: { action: 'set_password', password, deviceTokenHash },
        });

        if (data?.error === 'weak_password') {
            throw new Error('A senha deve ter de 8 a 72 caracteres, com letras e números.');
        }
        if (data?.error === 'reauth_required') {
            throw new Error('Por segurança, confirme seu telefone novamente antes de definir a senha.');
        }
        if (error || !data?.ok) throw new Error('Não foi possível salvar a senha agora.');
        return true;
    },

    async restoreSession() {
        const token = await refreshCustomerSessionIfNeeded();
        if (!token) {
            useCustomerAuth.getState().logout?.();
            return null;
        }

        const deviceTokenHash = await getDeviceTokenHash();
        const { data, error } = await supabaseCustomer.functions.invoke('customer-auth-session', {
            body: { action: 'me', deviceTokenHash },
        });

        if (error || !data?.ok || !data?.customer) {
            clearPersistedCustomerSession();
            await supabaseCustomerAuth.auth.signOut({ scope: 'local' }).catch(() => undefined);
            useCustomerAuth.getState().logout?.();
            return null;
        }

        const customer = toCustomer(data.customer);
        useCustomerAuth.getState().login(customer);
        return {
            customer,
            passwordConfigured: Boolean(data.passwordConfigured),
        };
    },

    async registerUser(_data: {
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
        throw new Error('Cadastro seguro deve ser concluído pelo código SMS.');
    },

    async logoutCustomer() {
        clearPersistedCustomerSession();
        await supabaseCustomerAuth.auth.signOut().catch(() => undefined);
        useCustomerAuth.getState().logout?.();
    },
};
