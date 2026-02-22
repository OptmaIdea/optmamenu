// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { getCustomerToken } from '@/lib/jwt';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL não configurado');
if (!supabaseAnonKey) throw new Error('VITE_SUPABASE_ANON_KEY não configurado');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: async (url, options: RequestInit = {}) => {
            const token = getCustomerToken();

            const headers = new Headers(options.headers || {});
            headers.set('apikey', supabaseAnonKey);

            if (token) headers.set('Authorization', `Bearer ${token}`);
            else headers.delete('Authorization');

            return fetch(url, { ...options, headers });
        },
    },
});