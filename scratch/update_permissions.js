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
    console.log('Inspecting store_permission_catalog table schema...');
    const { data: sample, error: sampleErr } = await supabase
      .from('store_permission_catalog')
      .select('*')
      .limit(1);

    if (sampleErr) {
      console.error('Error inspecting table:', sampleErr);
      process.exit(1);
    }

    const columns = Object.keys(sample[0] || {});
    console.log('Columns in store_permission_catalog:', columns);
    const hasSortOrder = columns.includes('sort_order');

    console.log(`Updating store_permission_catalog. sort_order exists: ${hasSortOrder}`);

    // Update 1
    const { data: d1, error: e1 } = await supabase
      .from('store_permission_catalog')
      .update({
        group_key: 'settings',
        group_label: 'Configurações',
        item_key: 'messages',
        item_label: 'Mensagens',
        show_in_permission_ui: true,
        updated_at: new Date().toISOString()
      })
      .in('permission_key', ['messages.view', 'messages.manage'])
      .select();
    console.log('Update 1 result:', d1, e1);

    // Update 2
    const update2Payload = {
      action_label: 'Acessar',
      updated_at: new Date().toISOString()
    };
    if (hasSortOrder) {
      update2Payload.sort_order = 80;
    }
    const { data: d2, error: e2 } = await supabase
      .from('store_permission_catalog')
      .update(update2Payload)
      .eq('permission_key', 'messages.view')
      .select();
    console.log('Update 2 result:', d2, e2);

    // Update 3
    const update3Payload = {
      action_label: 'Gerenciar',
      depends_on: 'messages.view',
      updated_at: new Date().toISOString()
    };
    if (hasSortOrder) {
      update3Payload.sort_order = 81;
    }
    const { data: d3, error: e3 } = await supabase
      .from('store_permission_catalog')
      .update(update3Payload)
      .eq('permission_key', 'messages.manage')
      .select();
    console.log('Update 3 result:', d3, e3);

    console.log('Validating final state...');
    const { data: selectData, error: selectError } = await supabase
      .from('store_permission_catalog')
      .select('permission_key, group_key, group_label, item_key, item_label, action_label, depends_on, show_in_permission_ui')
      .in('permission_key', ['messages.view', 'messages.manage'])
      .order('permission_key');

    console.log('Validation results:', JSON.stringify(selectData, null, 2), selectError);
  } catch (e) {
    console.error(e);
  }
}

main();
