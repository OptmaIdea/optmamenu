import { supabaseCustomer } from '@/lib/supabase';

const CUSTOMER_TOKEN_KEY = 'auth_token';

export function setCustomerToken(token: string) {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
}

export function clearCustomerToken() {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

export function getCustomerToken(): string | null {
    try {
        return localStorage.getItem(CUSTOMER_TOKEN_KEY);
    } catch {
        return null;
    }
}

/**
 * Emite JWT chamando a Edge Function:
 * supabase/functions/issue_customer_jwt
 */
export async function issueCustomerJwt(params: {
    customer_id: string;
    store_id: string;
    expires_in_seconds?: number;
}): Promise<{ token: string; exp: number }> {
    const { data, error } = await supabaseCustomer.functions.invoke(
        'issue_customer_jwt',
        {
            body: params,
        }
    );

    if (error) throw error;
    if (!data?.token) throw new Error('Edge Function não retornou token');

    return data as { token: string; exp: number };
}