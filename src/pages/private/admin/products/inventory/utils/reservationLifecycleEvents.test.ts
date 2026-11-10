import { describe, expect, it } from 'vitest';
import type { ProductStockMovementRow } from '@/services/stockService';
import { getReservationReleaseEvent, getReservationReleaseReason } from './reservationLifecycleEvents';

const movement = (metadata: Record<string, unknown>, type = 'reservation') => ({
  id: 'cb0a59a4-7890-4b4c-9531-1ef4095b27d7',
  quantity: 30, type, location_name: 'Loja SJN',
  created_at: '2026-10-17T23:21:15-03:00',
  metadata,
} as ProductStockMovementRow);

describe('liberação de reserva na Vida do Produto', () => {
  it('mostra contrapartida somente após cancelamento efetivo e datado', () => {
    const event = getReservationReleaseEvent(movement({
      reservation_status: 'cancelled', order_code: 'PED-20261017-232115-498E',
      reservation_cancelled_at: '2026-10-18T00:13:00-03:00',
      cancel_reason: 'reservation_expired',
    }));
    expect(event).toMatchObject({
      quantity:30, orderCode:'PED-20261017-232115-498E',
      date:'2026-10-18T00:13:00-03:00', reason:'Prazo da reserva encerrado',
      source:'reservation_status',
    });
  });
  it('não inventa liberação para reserva ativa, consumida ou sem data', () => {
    expect(getReservationReleaseEvent(movement({reservation_status:'active'}))).toBeNull();
    expect(getReservationReleaseEvent(movement({reservation_status:'consumed',reservation_consumed_at:'2026-10-18T00:13:00-03:00'}))).toBeNull();
    expect(getReservationReleaseEvent(movement({reservation_status:'cancelled'}))).toBeNull();
    expect(getReservationReleaseEvent(movement({reservation_status:'cancelled',reservation_cancelled_at:'infinity'}))).toBeNull();
    expect(getReservationReleaseEvent(movement({reservation_status:'cancelled',reservation_cancelled_at:'2026-10-18T00:13:00-03:00'},'exit'))).toBeNull();
  });
  it('traduz encerramento automático sem classificar como entrada física', () => {
    expect(getReservationReleaseReason('reservation_expired')).toBe('Prazo da reserva encerrado');
  });
});
