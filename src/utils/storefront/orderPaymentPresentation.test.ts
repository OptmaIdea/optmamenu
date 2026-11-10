import { describe, expect, it } from 'vitest';
import { getOrderPaymentPresentation } from './orderPaymentPresentation';

describe('apresentação do pagamento público', () => {
  it('nunca considera a escolha da forma como pagamento', () => {
    expect(getOrderPaymentPresentation('pending').confirmed).toBe(false);
    expect(getOrderPaymentPresentation(null).confirmed).toBe(false);
    expect(getOrderPaymentPresentation('authorized').confirmed).toBe(false);
    expect(getOrderPaymentPresentation('failed').confirmed).toBe(false);
  });
  it('confirma exclusivamente quando o servidor retornou paid', () => {
    expect(getOrderPaymentPresentation('paid').confirmed).toBe(true);
    expect(getOrderPaymentPresentation('paid').shortLabel).toBe('Pago');
  });
  it('distingue estorno e pagamento pendente', () => {
    expect(getOrderPaymentPresentation('refund_pending').shortLabel).toBe('Estorno pendente');
    expect(getOrderPaymentPresentation('refunded').shortLabel).toBe('Estornado');
    expect(getOrderPaymentPresentation('partially_refunded').shortLabel).toBe('Estorno parcial');
  });
});
