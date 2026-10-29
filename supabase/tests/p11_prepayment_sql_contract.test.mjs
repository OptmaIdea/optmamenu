import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL(path, import.meta.url),'utf8');
const rpc=read('../migrations/20261029123000_store_checkout_prepayment_config_safe.sql');
const proof=read('../migrations/20261029125000_public_order_proof_pix_instructions.sql');
const acl=read('../migrations/20261029124000_public_table_structural_grants_hardening.sql');
test('P11: user and tenant authorization evaluated before financial mutations',()=>{
  assert.match(rpc,/auth\.uid\(\) IS NOT NULL/);
  assert.match(rpc,/app_is_store_owner\(p_store_id\)/);
  assert.match(rpc,/user_has_store_permission_v2\(p_store_id,/);
  assert.match(rpc,/store_id=p_store_id AND code=p_method_code/);
  assert.match(rpc,/WHERE a\.id=p_destination_account_id AND a\.store_id=p_store_id AND a\.active=true/);
  assert.match(rpc,/REVOKE ALL ON FUNCTION .* FROM PUBLIC,anon;/);
});
test('P11: prepayment only when integration capable or manual proof with payment instructions',()=>{
  assert.match(rpc,/p_method_code='pix_manual_qr'/);
  assert.match(rpc,/v_method\.requires_proof IS DISTINCT FROM true/);
  assert.match(rpc,/manual_pix_instructions_required/);
  assert.match(rpc,/p\.capabilities->>v_feature/);
  assert.match(rpc,/p\.enabled=true AND p\.credential_status='ready'/);
  assert.match(rpc,/payment_timing,payment_method_code/);
  assert.match(rpc,/ON CONFLICT\(store_id,scope,fulfillment_type,payment_timing,payment_method_code\)/);
});
test('P11: customer proof exposes only merchant-intended Pix instructions, not credentials',()=>{
  assert.match(proof,/v_eligible and v_method\.code='pix_manual_qr'/);
  assert.match(proof,/pix_key/);
  assert.match(proof,/pix_recipient/);
  assert.doesNotMatch(proof,/service_role|api_key|webhook_secret/);
});
test('P11: structural revokes do not remove regular CRUD required by app',()=>{
  assert.match(acl,/REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public/);
  assert.doesNotMatch(acl,/REVOKE (?:ALL|SELECT|INSERT|UPDATE|DELETE) ON ALL TABLES/i);
  assert.match(acl,/has_table_privilege\('authenticated',c\.oid,'TRUNCATE'\)/);
});
