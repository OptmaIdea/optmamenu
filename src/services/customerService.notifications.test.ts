import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: {}, supabaseCustomer: { rpc } }));
vi.mock('@/lib/jwt', () => ({ getCustomerToken: vi.fn() }));
import { CustomerService } from './customerService';

beforeEach(() => rpc.mockReset());

describe('CustomerService.getNotifications: do not hide failed private reads as an empty inbox', () => {
    it('returns only customer-scoped RPC data', async () => {
        rpc.mockResolvedValue({ data: { ok: true, notifications: [{ id: 'own-1', title: 'Meu pedido' }] }, error: null });
        await expect(CustomerService.getNotifications('untrusted-customer-id')).resolves.toEqual([{ id: 'own-1', title: 'Meu pedido' }]);
        expect(rpc).toHaveBeenCalledWith('get_customer_self_notifications_safe', { p_limit: 50 });
    });
    it('throws on failed network/PostgREST request instead of erasing existing messages', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'private error should not leak' } });
        await expect(CustomerService.getNotifications()).rejects.toThrow('Não foi possível carregar suas mensagens');
    });
    it('throws on access_denied returned from revoked customer session', async () => {
        rpc.mockResolvedValue({ data: { ok: false, error: 'access_denied' }, error: null });
        await expect(CustomerService.getNotifications()).rejects.toThrow();
    });
    it('accepts truly empty inbox after a successful RPC', async () => {
        rpc.mockResolvedValue({ data: { ok: true, notifications: [] }, error: null });
        await expect(CustomerService.getNotifications()).resolves.toEqual([]);
    });
});
