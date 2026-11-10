import { describe, expect, it } from 'vitest';
import type { PublicCheckoutPayNowMethod } from '@/services/publicOrderService';
import { getVisiblePayNowMethods } from './sandboxCheckoutMethods';

const item = (code: string, sandbox_only: boolean, manual = false): PublicCheckoutPayNowMethod => ({
  code, base_code: code, name: code, description: null,
  requires_proof: manual, confirmation_mode: manual ? 'manual_proof' : 'api',
  integration_enabled: true, sandbox_only,
});
describe('pagamento antecipado da homologação', () => {
  const options = [item('pix', true), item('debit_card', true), item('pix_manual_qr', false, true), item('other_provider', false)];
  it('inclui exclusivamente opções Sandbox integradas', () => {
    expect(getVisiblePayNowMethods(options, true).map((i) => i.code)).toEqual(['pix', 'debit_card']);
  });
  it('mantém os pagamentos habituais nas lojas sem restrição de testes', () => {
    expect(getVisiblePayNowMethods(options, false)).toEqual(options);
  });
});
