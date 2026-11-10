import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));

import { OrderCommunicationService } from './orderCommunicationService';

const shared = {
  orderId: 'order-test',
  orderCode: 'PED-20261110-0001',
  customerName: 'Cliente teste',
  customerPhone: '+5531999999999',
  trackingUrl: 'https://example.com/p/teste',
  catalogUrl: 'https://example.com/mesa/teste/04',
  fulfillmentType: 'qr_table',
};

describe('comunicação do pedido em mesa', () => {
  it('não orienta retirada no balcão em aviso de pedido pronto', () => {
    const ready = OrderCommunicationService.prepare('order_ready', {
      ...shared,
      paymentStatus: 'pending',
      expiresAt: '2026-11-10T18:00:00-03:00',
    });
    expect(ready.message).toContain('encaminhado para sua mesa');
    expect(ready.message).toContain('Prazo da reserva');
    expect(ready.message).not.toContain('Retire até');
  });

  it('não promete retirada quando a mesa já pagou', () => {
    const accepted = OrderCommunicationService.prepare('order_accepted', {
      ...shared,
      paymentStatus: 'paid',
    });
    expect(accepted.message).toContain('atendimento do pedido na mesa');
    expect(accepted.message).not.toContain('reservado para retirada');
  });
});
