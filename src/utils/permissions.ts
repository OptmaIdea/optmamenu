import type { EffectiveStorePermission } from '@/types/permissions';

export function hasEffectivePermission(
    permissions: EffectiveStorePermission[],
    permissionCode: string
): boolean {
    return permissions.some(
        (permission) =>
            permission.permission_code === permissionCode &&
            permission.allowed
    );
}

export function hasAnyEffectivePermission(
    permissions: EffectiveStorePermission[],
    permissionCodes: string[]
): boolean {
    return permissionCodes.some((permissionCode) =>
        hasEffectivePermission(permissions, permissionCode)
    );
}

export function hasAllEffectivePermissions(
    permissions: EffectiveStorePermission[],
    permissionCodes: string[]
): boolean {
    return permissionCodes.every((permissionCode) =>
        hasEffectivePermission(permissions, permissionCode)
    );
}

const NON_PDV_OPERATIONAL_PERMISSIONS = [
    'dashboard.view',
    'dashboard.activity.view',
    'dashboard.alerts.view',
    'reports.view',
    'orders.view',
    'orders.manage',
    'commercial.dashboard.view',
    'commercial.sales_channels.view',
    'customers.view',
    'loyalty.view',
    'messages.view',
    'marketing.view',
    'cashbook.view',
    'financial.account_plan.view',
    'financial.accounts.view',
    'products.view',
    'products.manage',
    'categories.view',
    'stock.view',
    'transfers.view',
    'suppliers.view',
    'purchases.view',
    'quotes.view',
    'users.view',
    'settings.view',
    'security.view',
    'support.view',
] as const;

/**
 * Identifica o colaborador cujo único módulo operacional é o PDV.
 * Permissões-raiz implícitas (como commercial.view) não contam como outro módulo.
 */
export function hasOnlyPdvOperationalAccess(
    permissions: EffectiveStorePermission[]
): boolean {
    return (
        hasEffectivePermission(permissions, 'pdv.view') &&
        !hasAnyEffectivePermission(permissions, [...NON_PDV_OPERATIONAL_PERMISSIONS])
    );
}
