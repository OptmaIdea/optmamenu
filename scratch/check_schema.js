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
  const { data, error } = await supabase
    .from('store_permission_catalog')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching catalog:', error);
  } else {
    console.log('Sample row:', data[0]);
    console.log('Columns:', Object.keys(data[0] || {}));
  }
}

main();
