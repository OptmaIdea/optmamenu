import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path, import.meta.url),'utf8');
const edge=read('../functions/send-customer-otp-sms/index.ts');
const ui=read('../../src/pages/private/admin/settings/messages/MessageSettings.tsx');
test('OTP transport accesses only private service credential getter',()=>{
  assert.match(edge,/get_store_sms_gateway_token_service_safe/);
  assert.match(edge,/sms_gateway_not_configured/);
  assert.doesNotMatch(edge,/\.select\(["']name,\s*slug,\s*config,\s*sms_gateway_token["']\)/);
  assert.doesNotMatch(edge,/storeData\.sms_gateway_token/);
  assert.match(edge,/issue_customer_otp_for_sms_safe/);
  assert.match(edge,/mark_customer_otp_sms_delivery_safe/);
  assert.match(edge,/Idempotency-Key/);
});
test('SMS settings UI is write-only and avoids plaintext returns',()=>{
  assert.match(ui,/get_store_sms_gateway_configured_safe/);
  assert.match(ui,/set_store_sms_gateway_credential_safe/);
  assert.match(ui,/type="password"/);
  assert.doesNotMatch(ui,/\.select\(['"]id,\s*name,\s*sms_gateway_token/);
  assert.doesNotMatch(ui,/sms_gateway_token:\s*store\?\.sms_gateway_token/);
  assert.doesNotMatch(ui,/sms_gateway_token:\s*form\.use_sms_gateway/);
  assert.match(ui,/\.update\(\{\s*config: nextConfig\s*\}\)/);
});
