import type { StorePermissionMatrixRow } from '@/types/security';

export const VISUAL_SECURITY_MANAGE_PERMISSION_KEYS = new Set([
    'security.context.manage',
    'security.logs.manage',
]);

type PermissionCatalogVisibilityInput = Pick<
    StorePermissionMatrixRow,
    'permission_code' | 'show_in_permission_ui'
>;

export function shouldShowPermissionInPermissionUi(permission: PermissionCatalogVisibilityInput) {
    if (VISUAL_SECURITY_MANAGE_PERMISSION_KEYS.has(permission.permission_code)) {
        return false;
    }

    return permission.show_in_permission_ui !== false;
}

export function filterPermissionsVisibleInPermissionUi<T extends PermissionCatalogVisibilityInput>(
    permissions: T[]
) {
    return permissions.filter(shouldShowPermissionInPermissionUi);
}
