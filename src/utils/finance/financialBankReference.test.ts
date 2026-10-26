import { describe, expect, it } from 'vitest';
import { bankReferenceLabel, normalizeBankReference } from './financialBankReference';
describe('Banco real no OptmaMenu — identificação sem credencial bancária', () => {
  it('permite cadastrar um banco real sem exigir OptmaPay', () => {
    expect(normalizeBankReference(' Banco do Brasil ', '1234')).toEqual({
      institution:'Banco do Brasil',account_last4:'1234',connection_mode:'manual',
    });
  });
  it('distingue conta manual de conexão online', () => {
    expect(bankReferenceLabel({ institution:'Itaú',account_last4:'9021',connection_mode:'manual' }))
      .toContain('sem sincronização bancária');
  });
  it('não armazena o número integral nem credenciais', () => {
    expect(() => normalizeBankReference('Itaú','123456789')).toThrow(/quatro últimos/);
    expect(() => normalizeBankReference('', '1234')).toThrow(/instituição/);
  });
  it('permite instituição com identificador final opcional', () => {
    expect(normalizeBankReference('Nubank','')?.account_last4).toBe('');
    expect(normalizeBankReference('','')).toBeNull();
  });
});
