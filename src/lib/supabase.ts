import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    'https://lgkkfmqzaorrutuoqeax.supabase.co';

const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_8Rmb1cfmYZmHLp8uTBdnBw_0ZzemBzt';

const CUSTOMER_TOKEN_KEY = 'auth_token';

function getCustomerToken(): string | null {
    try {
        return localStorage.getItem(CUSTOMER_TOKEN_KEY);
    } catch {
        return null;
    }
}

/**
 * ADMIN/Backoffice:
 * - Auth habilitado (getUser, signIn, etc.)
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // mantém padrão (storageKey default do Supabase)
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
    global: {
        fetch: async (url, options) => {
            const response = await fetch(url, options);

            // Intercepta erros de autenticação (401) ou falhas de renovação de refresh token (400 no endpoint de token)
            if (
                response.status === 401 ||
                (response.status === 400 && typeof url === 'string' && url.includes('/auth/v1/token'))
            ) {
                const clone = response.clone();
                try {
                    const data = await clone.json();
                    const isAuthError =
                        data?.error === 'invalid_grant' ||
                        data?.error === 'invalid_token' ||
                        data?.message?.includes('JWT') ||
                        data?.message?.includes('invalid signature') ||
                        data?.error_description?.includes('refresh_token') ||
                        data?.error_description?.includes('refresh token');

                    if (isAuthError) {
                        console.warn('[Supabase Auth] Erro de autenticação detectado. Deslogando...');
                        setTimeout(() => {
                            supabaseAdmin.auth.signOut().catch(() => {});
                        }, 0);
                    }
                } catch {
                    // Ignora erros de parsing de JSON
                }
            }

            return response;
        },
    },
});

/**
 * PUBLIC:
 * - cliente anônimo e isolado;
 * - não reutiliza sessão administrativa;
 * - não injeta o JWT próprio do portal do cliente;
 * - indicado para RPCs cuja credencial é um token público específico.
 */
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-public-anon-disabled-auth',
    },
});

/**
 * CUSTOMER:
 * - NÃO usa supabase.auth
 * - Injeta Authorization Bearer <jwt_customer> em REST/RPC/Storage/Functions
 * - DESLIGA o GoTrueClient pra não conflitar com o admin
 */
export const supabaseCustomer = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        // importante: evita colisão com o storageKey do admin
        storageKey: 'sb-customer-jwt-disabled-auth',
    },
    global: {
        fetch: async (url, options: RequestInit = {}) => {
            const token = getCustomerToken();
            const u = typeof url === 'string' ? url : url.toString();

            const shouldAttachCustomerJwt =
                u.includes('/rest/v1/') ||
                u.includes('/rpc/') ||
                u.includes('/storage/v1/') ||
                u.includes('/functions/v1/');

            const headers = new Headers(options.headers || {});
            headers.set('apikey', supabaseAnonKey);

            // Nunca mexe no /auth/v1 (e no customer a gente nem usa auth)
            if (shouldAttachCustomerJwt) {
                if (token) headers.set('Authorization', `Bearer ${token}`);
                else headers.delete('Authorization');
            }

            return fetch(url, { ...options, headers });
        },
    },
});

/**
 * Compatibilidade com imports antigos:
 * - private/admin deve usar supabase (alias do admin)
 */
export const supabase = supabaseAdmin;
