import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    'https://lgkkfmqzaorrutuoqeax.supabase.co';

const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    'SEU_ANON_KEY_AQUI';

const CUSTOMER_TOKEN_KEY = 'auth_token';

function getCustomerToken(): string | null {
    try {
        return localStorage.getItem(CUSTOMER_TOKEN_KEY);
    } catch {
        return null;
    }
}

/**
 * Client do ADMIN/Backoffice:
 * - NÃO injeta JWT custom
 * - mantém supabase.auth funcionando (getUser, signIn, etc.)
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Client do CUSTOMER:
 * - injeta Authorization Bearer <jwt_customer>
 * - MAS só para rotas de dados/functions (não quebra /auth/v1)
 */
export const supabaseCustomer = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: async (url, options: RequestInit = {}) => {
            const token = getCustomerToken();
            const u = typeof url === 'string' ? url : url.toString();

            // Só injeta token em endpoints que fazem sentido para o JWT de customer
            const shouldAttachCustomerJwt =
                u.includes('/rest/v1/') ||
                u.includes('/rpc/') ||
                u.includes('/storage/v1/') ||
                u.includes('/functions/v1/');

            const headers = new Headers(options.headers || {});
            headers.set('apikey', supabaseAnonKey);

            // Importante: não mexe na rota /auth/v1
            if (shouldAttachCustomerJwt) {
                if (token) headers.set('Authorization', `Bearer ${token}`);
                else headers.delete('Authorization');
            }

            return fetch(url, { ...options, headers });
        },
    },
});

/**
 * Mantém compatibilidade com imports antigos:
 * - Quem usa `supabase.auth.*` deve usar `supabaseAdmin`.
 * - Quem usa customer+RLS deve usar `supabaseCustomer`.
 */
export const supabase = supabaseAdmin;