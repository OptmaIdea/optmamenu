// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { getCustomerToken } from '@/lib/jwt';

const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || 'https://lgkkfmqzaorrutuoqeax.supabase.co';

const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY || 'SEU_ANON_KEY_AQUI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: async (url, options = {}) => {
            const token = getCustomerToken();

            const headers = new Headers(options.headers || {});
            headers.set('apikey', supabaseAnonKey);

            if (token) headers.set('Authorization', `Bearer ${token}`);
            else headers.delete('Authorization');

            return fetch(url, { ...options, headers });
        },
    },
});