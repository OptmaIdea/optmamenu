import { describe, expect, it } from 'vitest';
import { customerMessageAction, filterCustomerInbox } from './notificationInbox';

const rows = [
    { id: 'pedido', title: 'Pedido aceito', message: 'Seu pedido PED-123 está em preparo', category: 'orders', read: false },
    { id: 'loyalty', title: 'Pontuação', message: 'Você recebeu pontos', category: 'loyalty', read: true },
    { id: 'security', title: 'Senha alterada', message: 'Sua conta está protegida', category: 'security', read: false },
    { id: 'system', title: 'Atualização', message: 'Nova mensagem', category: null, read: true },
];

describe('Customer inbox filtering', () => {
    it('shows everything with default filters', () => {
        expect(filterCustomerInbox(rows, 'all', false, '')).toHaveLength(4);
    });
    it('filters unread only, without mutating source notifications', () => {
        expect(filterCustomerInbox(rows, 'all', true, '').map(item => item.id)).toEqual(['pedido', 'security']);
        expect(rows).toHaveLength(4);
    });
    it('combines category + unread + free text', () => {
        expect(filterCustomerInbox(rows, 'orders', true, 'PED-123').map(item => item.id)).toEqual(['pedido']);
        expect(filterCustomerInbox(rows, 'orders', true, 'pontos')).toHaveLength(0);
    });
    it('searches message text case and accent independently', () => {
        expect(filterCustomerInbox(rows, 'all', false, 'pontuacao').map(item => item.id)).toEqual(['loyalty']);
        expect(filterCustomerInbox(rows, 'all', false, 'SENHA').map(item => item.id)).toEqual(['security']);
    });
    it('maps missing category into system', () => {
        expect(filterCustomerInbox(rows, 'system', false, '').map(item => item.id)).toEqual(['system']);
    });
    it('ignores whitespace-only searches', () => {
        expect(filterCustomerInbox(rows, 'all', false, '   ')).toHaveLength(4);
    });
});

describe('Inbox actions are category-scoped, not parsed from untrusted text', () => {
    it('can open own orders without trusting codes from notification body', () => {
        expect(customerMessageAction('orders')).toEqual({ tab: 'orders', label: 'Ver meus pedidos' });
    });
    it('routes loyalty to existing loyalty tab', () => {
        expect(customerMessageAction('loyalty')?.tab).toBe('loyalty');
    });
    it('routes privacy-related categories to existing account panels', () => {
        expect(customerMessageAction('security')?.tab).toBe('security');
        expect(customerMessageAction('profile')?.tab).toBe('profile');
        expect(customerMessageAction('marketing')?.tab).toBe('communications');
    });
    it('never treats external data or generic text as a navigation command', () => {
        expect(customerMessageAction('javascript:alert(1)')).toBeNull();
        expect(customerMessageAction('system')).toBeNull();
        expect(customerMessageAction('orders?orderId=other-user')).toBeNull();
    });
});
