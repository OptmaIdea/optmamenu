import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveOtpGatewayCredential, isStoreSmsGatewayEnabled } from '../functions/_shared/otpGatewayRouting.mjs';

const global = 'osg_live_' + 'G'.repeat(32);
const loja = 'osg_live_' + 'L'.repeat(32);
const enabled = { message_settings: { sms: { use_sms_gateway: true } } };
const disabled = { message_settings: { sms: { use_sms_gateway: false } } };

test('LogLunch: uses own per-store account token, never global', () => {
  const selected = resolveOtpGatewayCredential({ config: enabled, sms_gateway_token: loja }, global);
  assert.deepEqual(selected, { ok: true, key: loja, source: 'store' });
  assert.notEqual(selected.key, global);
});

test('LogLunch: enabled without token cannot fail over to other tenant', () => {
  for (const bad of ['', null, 'invalid-key', 'osg_live_short', 'osg_live_' + ' '.repeat(32)]) {
    assert.deepEqual(resolveOtpGatewayCredential({ config: enabled, sms_gateway_token: bad }, global),
      {ok: false,error:'sms_gateway_not_configured'});
  }
});

test('Gelinhares: gateway toggle disabled preserves legacy global credential', () => {
  assert.deepEqual(resolveOtpGatewayCredential({config:disabled,sms_gateway_token:null}, global),
    {ok:true,key:global,source:'global'});
});

test('Explicit modern sms=false takes precedence over old root use_sms_gateway=true', () => {
  assert.equal(isStoreSmsGatewayEnabled({
    use_sms_gateway:true,
    message_settings:{sms:{use_sms_gateway:false}},
  }),false);
  assert.equal(resolveOtpGatewayCredential({config:{
    use_sms_gateway:true,message_settings:{sms:{use_sms_gateway:false}},
  }, sms_gateway_token:loja},global).source,'global');
});

test('Backward-compatible legacy root use_sms_gateway=true still requires own token', () => {
  assert.equal(isStoreSmsGatewayEnabled({use_sms_gateway:true}),true);
  assert.equal(resolveOtpGatewayCredential({config:{use_sms_gateway:true},sms_gateway_token:loja},global).source,'store');
  assert.deepEqual(resolveOtpGatewayCredential({config:{use_sms_gateway:true}},global),
    {ok:false,error:'sms_gateway_not_configured'});
});

test('Global missing and store disabled returns controlled configuration error', () => {
  assert.deepEqual(resolveOtpGatewayCredential({config:disabled},''),
    {ok:false,error:'sms_gateway_not_configured'});
});

test('Invalid store config defaults to legacy global without crashing', () => {
  for (const config of [null,{},[], 'invalid', {message_settings:'invalid'}]) {
    assert.equal(resolveOtpGatewayCredential({config},global).source,'global');
  }
});

test('Production Edge Function uses actual pure routing helper and preserves OTP audit and tenant lookup', () => {
  const path = new URL('../functions/send-customer-otp-sms/index.ts',import.meta.url);
  const code = readFileSync(path,'utf8');
  assert.match(code,/import\s+\{\s*resolveOtpGatewayCredential\s*\}\s+from\s+["']\.\.\/\_shared\/otpGatewayRouting\.mjs["']/);
  assert.match(code,/\.eq\("id",\s*storeId\)/);
  assert.match(code,/const route = resolveOtpGatewayCredential\(storeData, gatewayApiKey\)/);
  assert.match(code,/gatewayApiKey = route\.key/);
  assert.match(code,/"x-api-key": gatewayApiKey/);
  assert.match(code,/Idempotency-Key": idempotencyKey/);
  assert.match(code,/issue_customer_otp_for_sms_safe/);
  assert.match(code,/mark_customer_otp_sms_delivery_safe/);
  assert.doesNotMatch(code,/console\.(?:log|warn|error)\(.*(?:gatewayApiKey|sms_gateway_token|route\.key)/);
});
