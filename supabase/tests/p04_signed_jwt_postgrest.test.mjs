import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const base = process.env.P04_POSTGREST_URL || 'http://127.0.0.1:3030';
const secret = process.env.P04_JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('Synthetic signing key missing');

const now = Math.floor(Date.now() / 1000);
const u = {
  a: 'c0000000-0000-0000-0000-000000000001',
  a2: 'c0000000-0000-0000-0000-000000000002',
  b: 'd0000000-0000-0000-0000-000000000001',
  ownerA: 'e0000000-0000-0000-0000-000000000001',
  sa: 'f0000000-0000-0000-0000-000000000001',
  sa2: 'f0000000-0000-0000-0000-000000000002',
  sb: 'f0000000-0000-0000-0000-000000000003',
};
const order = n => '11000000-0000-0000-0000-' + String(n).padStart(12,'0');
const loyalty = n => '22000000-0000-0000-0000-' + String(n).padStart(12,'0');

function jwt(claims, key = secret) {
  const header = Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ role:'authenticated',iat:now,exp:now+1200, ...claims })).toString('base64url');
  const message = header + '.' + body;
  const signature = createHmac('sha256',key).update(message).digest('base64url');
  return message + '.' + signature;
}
async function fetchIds(resource, token) {
  const headers = token ? { Authorization:'Bearer ' + token } : {};
  const response = await fetch(base + '/' + resource + '?select=id&order=id.asc', { headers });
  const body = await response.json();
  return { status:response.status, body, ids:Array.isArray(body)?body.map(row=>row.id):null };
}
function customer(user,session,phone = '+5511999000001',extra={}) {
  return jwt({ sub:user,session_id:session,phone,...extra });
}
function equalIds(result, expected) {
  assert.equal(result.status,200, JSON.stringify(result.body));
  assert.deepEqual(result.ids,expected.sort());
}

test('unauthenticated request sees zero orders and zero loyalty entries', async () => {
  equalIds(await fetchIds('orders'), []);
  equalIds(await fetchIds('loyalty_transactions'), []);
});
test('signed customer A sees own and legacy unlinked orders, not another linked account', async () => {
  const token=customer(u.a,u.sa);
  equalIds(await fetchIds('orders',token),[order(1),order(5)]);
  equalIds(await fetchIds('loyalty_transactions',token),[loyalty(1)]);
});
test('signed customer B with same phone cannot read store A', async () => {
  const token=customer(u.b,u.sb);
  equalIds(await fetchIds('orders',token),[order(3)]);
  equalIds(await fetchIds('loyalty_transactions',token),[loyalty(3)]);
});
test('signed customer A2 cannot see A orders even in same store', async () => {
  const token=customer(u.a2,u.sa2,'+5511999000002');
  equalIds(await fetchIds('orders',token),[order(2),order(4)]);
  equalIds(await fetchIds('loyalty_transactions',token),[loyalty(2)]);
});
test('spoofed store ID claim cannot change verified customer session authority', async () => {
  const token=customer(u.a,u.sa,'+5511999000001',{ store_id:'20000000-0000-0000-0000-000000000002' });
  equalIds(await fetchIds('orders',token),[order(1),order(5)]);
});
test('signed JWT with nonexistent trusted session cannot read customer records', async () => {
  const token=customer(u.a,'f0000000-0000-0000-0000-000000000099');
  equalIds(await fetchIds('orders',token),[]);
  equalIds(await fetchIds('loyalty_transactions',token),[]);
});
test('signed JWT for store owner sees only that store orders', async () => {
  const token=jwt({sub:u.ownerA});
  equalIds(await fetchIds('orders',token),[order(1),order(2),order(4),order(5)]);
});
test('invalid JWT signature is rejected by real HTTP gateway', async () => {
  const token=jwt({sub:u.a,session_id:u.sa},'synthetic-wrong-key-abcdefghijklmnopqrstuvwxyz0123456789');
  assert.equal((await fetchIds('orders',token)).status,401);
});
test('expired properly signed JWT is rejected by real HTTP gateway', async () => {
  const token=jwt({sub:u.a,session_id:u.sa,exp:now-3600});
  assert.equal((await fetchIds('orders',token)).status,401);
});
