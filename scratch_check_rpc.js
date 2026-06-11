import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'henrique@optmamenu.com', // wait, we don't have password. But we can query pg_proc directly using a service role or check public RPC info?
    });
}
