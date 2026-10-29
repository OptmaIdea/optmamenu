import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
    supabase: {},
    supabaseCustomer: { functions: { invoke } },
}));
vi.mock('@/lib/jwt', () => ({ getCustomerToken: vi.fn() }));

import { CustomerService } from './customerService';

function edgeFailure(status: number, payload: unknown) {
    return {
        data: null,
        error: {
            context: new Response(JSON.stringify(payload), {
                status,
                headers: { 'content-type': 'application/json' },
            }),
        },
    };
}

beforeEach(() => invoke.mockReset());

describe('CustomerService.processSelfAccountDeletion Edge HTTP boundary', () => {
    it('preserves active-order error details delivered via non-2xx HTTP 409', async () => {
        invoke.mockResolvedValue(edgeFailure(409, { ok: false, error: 'active_orders_exist', activeOrderCount: 3 }));
        await expect(CustomerService.processSelfAccountDeletion()).rejects.toThrow('3 pedido(s)');
        expect(invoke).toHaveBeenCalledOnce();
        expect(invoke).toHaveBeenCalledWith('process-customer-account-deletion', { body: {} });
    });

    it('does not retry or bypass invalid customer session', async () => {
        invoke.mockResolvedValue(edgeFailure(401, { ok: false, error: 'access_denied' }));
        await expect(CustomerService.processSelfAccountDeletion()).rejects.toThrow('Entre novamente');
        expect(invoke).toHaveBeenCalledOnce();
    });

    it('does not interpret missing pending request as a successful deletion', async () => {
        invoke.mockResolvedValue(edgeFailure(409, { ok: false, error: 'deletion_request_not_found' }));
        await expect(CustomerService.processSelfAccountDeletion()).rejects.toThrow('Não encontramos uma solicitação pendente');
    });

    it('does not log out or claim deletion on unconfirmed HTTP 200', async () => {
        invoke.mockResolvedValue({ data: { ok: true, status: 'pending' }, error: null });
        await expect(CustomerService.processSelfAccountDeletion()).rejects.toThrow('ainda não foi concluída');
    });

    it('returns confirmed execution receipt only on executed=true state', async () => {
        invoke.mockResolvedValue({
            data: { ok: true, status: 'executed', auditId: 'synthetic-audit', requiresLogout: true },
            error: null,
        });
        await expect(CustomerService.processSelfAccountDeletion()).resolves.toEqual({
            status: 'executed',
            auditId: 'synthetic-audit',
            executedAt: null,
            requiresLogout: true,
        });
    });

    it('sanitizes broken Edge JSON / network errors', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: { context: new Response('<internal stack>', { status: 500 }) },
        });
        await expect(CustomerService.processSelfAccountDeletion()).rejects.toThrow('Não foi possível concluir');
    });
});
