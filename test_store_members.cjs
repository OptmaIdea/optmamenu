const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name')
      .limit(1);

    if (storesError) {
      throw storesError;
    }

    if (!stores || stores.length === 0) {
      console.log('No stores found.');
      return;
    }

    const store = stores[0];
    console.log(`Store: ${store.name} (${store.id})`);

    const { data: members, error: membersError } = await supabase.rpc('get_store_members_v2', {
      p_store_id: store.id
    });

    if (membersError) {
      throw membersError;
    }

    console.log(`Members count: ${members.length}`);
    if (members.length > 0) {
      console.log('Fields in member:', Object.keys(members[0]));
      // Find a member that is not the owner/logged-in user if possible, or just the first one
      console.log('Member 0 user_email:', members[0].user_email);
      console.log('Member 0 member_email:', members[0].member_email);
      console.log('Member 0 profile_address:', members[0].profile_address);
      console.log('Member 0 member_address:', members[0].member_address);
      console.log('Member 0 profile_name:', members[0].profile_name);
      console.log('Member 0 profile_zip_code:', members[0].profile_zip_code);
      console.log('Member 0 member_zip_code:', members[0].member_zip_code);
      
      console.log('Full first member row keys/values:');
      for (const k of Object.keys(members[0])) {
        console.log(`  ${k}: ${JSON.stringify(members[0][k])}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
