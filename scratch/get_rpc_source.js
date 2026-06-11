import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Failed to parse .env file');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  try {
    const { data, error } = await supabase.rpc('get_admin_orders_safe', {
      p_store_id: '00000000-0000-0000-0000-000000000000', // dummy
      p_status: 'all',
      p_limit: 1
    });
    console.log('Test call to get_admin_orders_safe result:', { data, error });

    // Let's see if we can query pg_proc or information_schema.routines
    const { data: procData, error: procError } = await supabase
      .from('pg_proc')
      .select('*')
      .limit(1);
    console.log('Query pg_proc:', { procData, procError });
  } catch (e) {
    console.error(e);
  }
}
main();
