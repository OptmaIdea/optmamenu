import { describe, expect, it } from 'vitest';
import { buildStoreReturnPath } from './tableReturnPath';

describe('buildStoreReturnPath', () => {
  it('preserva a mesa quando o cliente volta ao cardápio', () => {
    expect(buildStoreReturnPath('gelinharessjn', 'table', 'MESA-04'))
      .toBe('/mesa/gelinharessjn/MESA-04');
  });

  it('codifica slug e identificação da mesa sem confundir rotas', () => {
    expect(buildStoreReturnPath('loja teste', 'table', 'Mesa A/7'))
      .toBe('/mesa/loja%20teste/Mesa%20A%2F7');
  });

  it('usa a loja comum quando não existe mesa válida', () => {
    expect(buildStoreReturnPath('gelinharessjn', 'remote', 'MESA-04'))
      .toBe('/s/gelinharessjn');
    expect(buildStoreReturnPath('gelinharessjn', 'table', ' '))
      .toBe('/s/gelinharessjn');
  });
});
