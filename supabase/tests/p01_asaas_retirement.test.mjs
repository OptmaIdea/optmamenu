import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function legacyEndpoint(name) {
  const code = fs.readFileSync(path.join(root, 'supabase/functions', name, 'index.ts'), 'utf8');
  assert.doesNotMatch(code, /\b(fetch|createClient)\s*\(|Deno\.env|ASAAS_SANDBOX_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  let handler;
  vm.runInNewContext(code, { Deno: { serve(fn) { handler = fn; } }, Response });
  assert.equal(typeof handler, 'function');
  return handler;
}

test('retired Asaas adapter refuses all business calls without touching credentials', async () => {
  const handler = legacyEndpoint('asaas-sandbox-adapter');
  for (const method of ['POST','GET']) {
    const response = await handler({ method });
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { ok:false, error:'legacy_provider_retired', provider:'asaas' });
  }
  assert.equal((await handler({method:'OPTIONS'})).status,204);
});

test('retired Asaas webhook safely acknowledges late deliveries without processing payload', async () => {
  const handler = legacyEndpoint('asaas-sandbox-webhook');
  const response = await handler({ method:'POST', json() { throw Error('payload must not be parsed'); } });
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(), { ok:true, ignored:true, reason:'legacy_provider_retired' });
  assert.equal((await handler({method:'GET'})).status,405);
  assert.equal((await handler({method:'OPTIONS'})).status,204);
});
