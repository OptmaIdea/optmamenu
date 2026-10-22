import { describe, expect, it } from 'vitest';
import {
    customerDeletionErrorMessage, customerDeletionStatusLabel,
    formatCustomerOrderTimelineStatus, isCustomerDeletionPending,
} from './customerDeletionState';

describe('customer account deletion recovery', () => {
    it('explains non-2xx 409 for active orders', () => {
        expect(customerDeletionErrorMessage({ error: 'active_orders_exist', activeOrderCount: 2 }, 409)).toContain('2 pedido(s)');
    });
    it('ignores invalid counts', () => {
        for (const activeOrderCount of [-1, 2.5, NaN]) {
            expect(customerDeletionErrorMessage({ error: 'active_orders_exist', activeOrderCount }, 409))
                .toContain('Há pedidos em andamento');
        }
    });
    it('recognizes expired sessions, missing requests and processing errors', () => {
        expect(customerDeletionErrorMessage(null, 401)).toContain('Entre novamente');
        expect(customerDeletionErrorMessage({ error: 'access_denied' }, 403)).toContain('Entre novamente');
        expect(customerDeletionErrorMessage({ error: 'deletion_request_not_found' }, 409)).toContain('Não encontramos');
        expect(customerDeletionErrorMessage({ error: 'deletion_failed' }, 500)).toContain('permanece registrada');
    });
    it('does not display untrusted internal errors', () => {
        expect(customerDeletionErrorMessage({ error: 'internal_database_dump' })).not.toContain('internal_database_dump');
    });
    it('distinguishes pending states from deleted accounts', () => {
        expect(isCustomerDeletionPending('pending')).toBe(true);
        expect(isCustomerDeletionPending('processing')).toBe(true);
        expect(isCustomerDeletionPending('executed')).toBe(false);
        expect(customerDeletionStatusLabel('processing')).toBe('Em processamento');
        expect(customerDeletionStatusLabel('executed')).toBe('Conta excluída');
    });
});

describe('customer timeline presentation without changing financial status', () => {
    it('translates known order states', () => {
        expect(formatCustomerOrderTimelineStatus('out_for_delivery')).toBe('Saiu para entrega');
        expect(formatCustomerOrderTimelineStatus('completed')).toBe('Concluído');
        expect(formatCustomerOrderTimelineStatus('reserved')).toBe('Reservado');
    });
    it('keeps unknown statuses intact', () => {
        expect(formatCustomerOrderTimelineStatus('waiting_for_refund')).toBe('waiting_for_refund');
        expect(formatCustomerOrderTimelineStatus(null)).toBeNull();
    });
});
