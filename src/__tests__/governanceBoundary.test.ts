import { describe, expect, it } from 'vitest';

/** Mesmo contrato adotado pela Central de Segurança e pelas RPCs. */
function canManageSection(permissions: string[], section: string) {
    return ['security.view', 'security.manage',
        `security.${section}.view`, `security.${section}.manage`]
        .every((permission) => permissions.includes(permission));
}

describe('governance security boundary', () => {
    it('users.manage alone never allows permission administration', () => {
        expect(canManageSection(['users.view', 'users.manage'], 'user_permissions')).toBe(false);
    });
    it('security.view=false denies even if manage flags are granted', () => {
        expect(canManageSection(['security.manage', 'security.user_permissions.view', 'security.user_permissions.manage'], 'user_permissions')).toBe(false);
    });
    it('an explicit section.manage=false prevents writes', () => {
        expect(canManageSection(['security.view', 'security.manage', 'security.user_permissions.view'], 'user_permissions')).toBe(false);
    });
    it('all four security gates permit delegated management', () => {
        expect(canManageSection(['security.view', 'security.manage', 'security.user_permissions.view', 'security.user_permissions.manage'], 'user_permissions')).toBe(true);
    });
});
