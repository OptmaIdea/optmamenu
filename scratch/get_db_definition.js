import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const jwtMatch = env.match(/SUPABASE_JWT_SECRET=(.+)/);

if (!urlMatch || !keyMatch || !jwtMatch) {
  console.error('Failed to parse .env file');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = keyMatch[1].trim();
const jwtSecret = jwtMatch[1].trim();

// Sign a service_role token
const serviceRoleToken = jwt.sign({
  role: 'service_role',
  iss: 'supabase'
}, jwtSecret);

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    headers: {
      Authorization: `Bearer ${serviceRoleToken}`
    }
  }
});

async function main() {
  try {
    // Let's query public.stores using postgrest
    const { data: stores, error: storesError } = await supabase.from('stores').select('*').limit(1);
    console.log('Stores:', { stores, storesError });

    if (stores && stores.length > 0) {
      const storeId = stores[0].id;
      // Let's call get_admin_orders_safe
      const { data: ordersAll, error: errAll } = await supabase.rpc('get_admin_orders_safe', {
        p_store_id: storeId,
        p_status: 'all',
        p_limit: 10
      });
      console.log('p_status=all orders count:', ordersAll?.orders?.length, errAll);
      if (ordersAll?.orders) {
        console.log('Sample orders statuses:', ordersAll.orders.map(o => ({ id: o.id, status: o.status })));
      }
    }
  } catch (e) {
    console.error(e);
  }
}
main();
