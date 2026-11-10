import type { ProductStockMovementRow } from '@/services/stockService';

export type ReservationReleaseEvent = {
  id: string;
  date: string;
  quantity: number;
  location: string | null;
  orderCode: string;
  createdAt: string;
  reason: string;
  source: 'reservation_status';
};

const validText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function getReservationReleaseReason(code: string | null | undefined): string {
  if (code === 'reservation_expired') return 'Prazo da reserva encerrado';
  if (!code) return 'Reserva cancelada';
  if (/^cancelado pelo painel/i.test(code)) return 'Pedido cancelado pelo painel administrativo';
  return code.startsWith('cancel') || code.startsWith('order_')
    ? 'Pedido cancelado' : 'Reserva cancelada';
}

/**
 * Evento de leitura derivado do estado da reserva. Não é movimento físico nem
 * crédito novo de estoque: a reserva já foi liberada pela operação original.
 */
export function getReservationReleaseEvent(movement: ProductStockMovementRow): ReservationReleaseEvent | null {
  if (movement.type !== 'reservation') return null;
  const meta = (movement.metadata || {}) as Record<string, unknown>;
  if (meta.reservation_status !== 'cancelled') return null;
  const rawDate = validText(meta.reservation_cancelled_at) || validText(meta.cancelled_at);
  if (!rawDate || !Number.isFinite(Date.parse(rawDate))) return null;
  const quantity = Math.abs(Number(movement.quantity || 0));
  if (!(quantity > 0)) return null;
  return {
    id: movement.id,
    date: rawDate,
    createdAt: movement.created_at,
    quantity,
    orderCode: validText(meta.order_code) || 'Pedido não identificado',
    location: movement.location_name || null,
    reason: getReservationReleaseReason(validText(meta.cancel_reason)),
    source: 'reservation_status',
  };
}
