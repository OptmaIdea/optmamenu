import { describe, expect, it } from 'vitest';
import { parsePdvCashAmount } from './pdvCash';

describe('parsePdvCashAmount', () => {
  it.each([
    ['50', 50],
    ['50,00', 50],
    ['50.00', 50],
    ['1.000,00', 1000],
    ['1.234,56', 1234.56],
    ['R$ 1.234,56', 1234.56],
    ['1250,5', 1250.5],
    ['0,01', 0.01],
  ])('converte %s para %d', (input, value) => {
    expect(parsePdvCashAmount(input)).toBe(value);
  });

  it.each(['', '   ', '10,', '1.00,50', 'abc', '-10', '1,234', '1.234.56', 'Infinity', 'R$ -1,00'])(
    'rejeita valores inválidos: %s',
    (input) => {
      expect(parsePdvCashAmount(input)).toBeNull();
    },
  );
});
