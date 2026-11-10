import { describe, expect, it } from 'vitest';
import { findNavigationContext, isNavigationContextActive } from '@/utils/adminNavigationContext';

const items = {
    financial: [
        { path: '/admin/accounts-payable', label: 'Contas a pagar' },
        { path: '/admin/financial-accounts', label: 'Contas financeiras' },
    ],
    security: [
        { path: '/admin/security', label: 'Central de segurança' },
        { path: '/admin/security', queryString: 'tab=roles', label: 'Permissões por papel' },
        { path: '/admin/security', queryString: 'tab=custom_roles', label: 'Funções personalizadas' },
        { path: '/admin/security', queryString: 'tab=user_permissions', label: 'Permissões por usuário' },
        { path: '/admin/security', queryString: 'tab=logs', label: 'Histórico de atividades' },
    ],
    settings: [{ path: '/admin/settings', label: 'Configurações' }],
};

describe('admin navigation contexts', () => {
    it('resolves direct links for custom roles and member permissions', () => {
        expect(findNavigationContext(items, '/admin/security', '?tab=custom_roles')?.item.label).toBe('Funções personalizadas');
        expect(findNavigationContext(items, '/admin/security', '?tab=user_permissions')?.item.label).toBe('Permissões por usuário');
    });

    it('retains the generic security context for other tabs', () => {
        expect(findNavigationContext(items, '/admin/security', '?tab=context')?.item.label).toBe('Central de segurança');
        expect(findNavigationContext(items, '/admin/security', '')?.item.label).toBe('Central de segurança');
    });

    it('never marks the generic security item active together with a specific tab', () => {
        const [generic, roles] = items.security;
        expect(isNavigationContextActive(items, generic, '/admin/security', '?tab=roles')).toBe(false);
        expect(isNavigationContextActive(items, roles, '/admin/security', '?tab=roles')).toBe(true);
        expect(isNavigationContextActive(items, roles, '/admin/security', '?tab=logs')).toBe(false);
    });

    it('does not interfere with settings tabs that have no dedicated menu links', () => {
        expect(isNavigationContextActive(items, items.settings[0], '/admin/settings', '?tab=orders')).toBe(true);
    });

    it('keeps regular non-query links and denies unrelated paths', () => {
        expect(findNavigationContext(items, '/admin/accounts-payable', '')?.item.label).toBe('Contas a pagar');
        expect(isNavigationContextActive(items, items.financial[0], '/admin/accounts-payable', '')).toBe(true);
        expect(isNavigationContextActive(items, items.financial[0], '/admin/dashboard', '')).toBe(false);
    });
});
