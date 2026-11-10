import { describe, expect, it } from 'vitest';
import { getTableOrderLabel, isTableOrder } from './tableOrderPresentation';

describe('apresentação de pedidos de mesa', () => {
  it.each([
    ['qr_table', 'public_store'],
    ['dine_in', 'direct'],
    ['table', null],
    ['pickup', 'qr_table'],
  ])('identifica mesa pelo canal de atendimento (%s / %s)', (fulfillment, channel) => {
    expect(isTableOrder(fulfillment, channel)).toBe(true);
  });

  it.each(['pickup', 'delivery', 'in_person'])('não transforma %s em mesa', (fulfillment) => {
    expect(isTableOrder(fulfillment, 'public_store')).toBe(false);
  });

  it('mostra a identificação registrada e não inventa mesa sem código', () => {
    expect(getTableOrderLabel('M04')).toBe('Mesa M04');
    expect(getTableOrderLabel(' ')).toBe('Mesa não identificada');
  });
});
