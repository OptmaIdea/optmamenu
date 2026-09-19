import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    'https://lgkkfmqzaorrutuoqeax.supabase.co';

const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_8Rmb1cfmYZmHLp8uTBdnBw_0ZzemBzt';

const CUSTOMER_TOKEN_KEY = 'auth_token';
const CUSTOMER_REFRESH_TOKEN_KEY = 'customer_refresh_token';
const CUSTOMER_EXPIRES_AT_KEY = 'customer_expires_at';
let customerRefreshPromise: Promise<string | null> | null = null;

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
 * CUSTOMER AUTH SESSION:
 * - cliente GoTrue separado do storefront público;
 * - usado somente para verificar/renovar a sessão do portal do cliente;
 * - impede que o login do cliente transforme supabasePublic em authenticated,
 *   preservando as RPCs públicas da loja sempre como anon.
 */
export const supabaseCustomerAuth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-customer-auth-isolated',
    },
});

async function ensureCustomerAccessToken(forceRefresh = false): Promise<string | null> {
    const token = getCustomerToken();
    let refreshToken: string | null = null;
    let expiresAt = 0;

    try {
        refreshToken = localStorage.getItem(CUSTOMER_REFRESH_TOKEN_KEY);
        expiresAt = Number(localStorage.getItem(CUSTOMER_EXPIRES_AT_KEY) || 0);
    } catch {
        return token;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!forceRefresh && token && (!expiresAt || expiresAt > nowSeconds + 60)) {
        return token;
    }
    if (!refreshToken) return token;

    if (!customerRefreshPromise) {
        customerRefreshPromise = (async () => {
            const { data, error } = await supabaseCustomerAuth.auth.setSession({
                access_token: token || '',
                refresh_token: refreshToken || '',
            });

            if (error || !data.session) {
                try {
                    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
                    localStorage.removeItem(CUSTOMER_REFRESH_TOKEN_KEY);
                    localStorage.removeItem(CUSTOMER_EXPIRES_AT_KEY);
                } catch {
                    // Sem storage, a requisição original seguirá e o chamador tratará a sessão expirada.
                }
                return null;
            }

            try {
                localStorage.setItem(CUSTOMER_TOKEN_KEY, data.session.access_token);
                localStorage.setItem(CUSTOMER_REFRESH_TOKEN_KEY, data.session.refresh_token);
                if (data.session.expires_at) {
                    localStorage.setItem(CUSTOMER_EXPIRES_AT_KEY, String(data.session.expires_at));
                }
            } catch {
                // A sessão ainda pode ser usada nesta requisição mesmo sem persistência local.
            }

            return data.session.access_token;
        })().finally(() => {
            customerRefreshPromise = null;
        });
    }

    return customerRefreshPromise;
}

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
            const u = typeof url === 'string' ? url : url.toString();

            const shouldAttachCustomerJwt =
                u.includes('/rest/v1/') ||
                u.includes('/rpc/') ||
                u.includes('/storage/v1/') ||
                u.includes('/functions/v1/');

            let token = shouldAttachCustomerJwt
                ? await ensureCustomerAccessToken(false)
                : getCustomerToken();

            const buildHeaders = (accessToken: string | null) => {
                const headers = new Headers(options.headers || {});
                headers.set('apikey', supabaseAnonKey);

                // Nunca injeta o JWT do cliente em /auth/v1.
                if (shouldAttachCustomerJwt) {
                    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
                    else headers.delete('Authorization');
                }

                return headers;
            };

            let response = await fetch(url, { ...options, headers: buildHeaders(token) });

            // Uma sessão pode vencer entre a renderização e uma consulta REST/RPC.
            // Tenta renovar uma única vez antes de devolver 401 para a interface.
            if (response.status === 401 && shouldAttachCustomerJwt) {
                const refreshedToken = await ensureCustomerAccessToken(true);
                if (refreshedToken) {
                    token = refreshedToken;
                    response = await fetch(url, { ...options, headers: buildHeaders(token) });
                }
            }

            return response;
        },
    },
});

/**
 * Compatibilidade com imports antigos:
 * - private/admin deve usar supabase (alias do admin)
 */
export const supabase = supabaseAdmin;
