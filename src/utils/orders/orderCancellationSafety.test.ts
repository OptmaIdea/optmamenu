import { describe, expect, it } from 'vitest';
import { getUnsafeCancelReason } from './orderCancellationSafety';

describe('bloqueio preventivo do cancelamento inseguro', () => {
    it('bloqueia pedido que saiu para entrega mesmo se ainda não foi pago', () => {
        expect(getUnsafeCancelReason('out_for_delivery', 'pending')).toBe('delivery_return_reversal_required');
        expect(getUnsafeCancelReason('out_for_delivery', 'paid')).toBe('delivery_return_reversal_required');
    });

    it('bloqueia pagamento confirmado, estorno pendente ou parcial', () => {
        expect(getUnsafeCancelReason('ready', 'paid')).toBe('refund_workflow_required');
        expect(getUnsafeCancelReason('confirmed', 'refund_pending')).toBe('refund_workflow_required');
        expect(getUnsafeCancelReason('confirmed', 'partially_refunded')).toBe('refund_workflow_required');
    });

    it('permite fluxo simples pré-despacho somente sem cobrança concluída', () => {
        expect(getUnsafeCancelReason('reserved', 'pending')).toBeNull();
        expect(getUnsafeCancelReason('confirmed', 'failed')).toBeNull();
        expect(getUnsafeCancelReason('ready', null)).toBeNull();
    });
});
