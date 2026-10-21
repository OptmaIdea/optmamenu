import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const targetRpc = 'mark_online_payment_provider_credential_status_internal';
const allowedCallers = [
  'supabase/functions/asaas-sandbox-adapter/index.ts',
  'supabase/functions/optmapay-sandbox-adapter/index.ts',
];

function collectSourceFiles(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      return entry.name.startsWith('.') || entry.name === 'node_modules'
        ? []
        : collectSourceFiles(full);
    }
    return entry.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)
      ? [full]
      : [];
  });
}

const files = [
  ...collectSourceFiles(path.join(root, 'src')),
  ...collectSourceFiles(path.join(root, 'supabase', 'functions')),
];

test('internal payment-status RPC is not invoked by the browser or new Edge Functions', () => {
  const calls = files.filter((file) => fs.readFileSync(file, 'utf8').includes(targetRpc))
    .map((file) => path.relative(root, file).replaceAll(path.sep, '/')).sort();

  assert.deepEqual(
    calls,
    allowedCallers,
    'Unexpected direct caller of internal payment RPC; new callers require security review.',
  );
});

test('all known server callers use service_role after store authorization', () => {
  for (const allowedCaller of allowedCallers) {
    const code = fs.readFileSync(path.join(root, allowedCaller), 'utf8');
  assert.match(code, /const serviceKey\s*=\s*Deno\.env\.get\(["']SUPABASE_SERVICE_ROLE_KEY["']\)/);
  assert.match(code, /const service\s*=\s*createClient\(\s*supabaseUrl,\s*serviceKey\s*\)/);

  const gate = code.indexOf('userClient.rpc(');
  const workspace = code.indexOf('"get_online_payments_workspace_safe"');
  const gateReject = code.indexOf('if (workspaceError || !workspace?.ok)');
  const call = code.indexOf('await service.rpc("' + targetRpc + '"');

  assert.ok(gate >= 0 && workspace > gate && gateReject > workspace && call > gateReject,
    'Store-specific user authorization must precede privileged credential-status update');
  assert.ok(
    code.slice(call, call + 650).includes('p_store_id: storeId'),
    'Internal status update must scope the target store',
    );
  }
});
