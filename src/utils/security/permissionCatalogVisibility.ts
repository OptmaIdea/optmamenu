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
): T[];
export function filterPermissionsVisibleInPermissionUi<T>(
    permissions: T[],
    getPermissionCode: (permission: T) => string,
    getShowInPermissionUi?: (permission: T) => boolean | null | undefined
): T[];
export function filterPermissionsVisibleInPermissionUi<T>(
    permissions: T[],
    getPermissionCode?: (permission: T) => string,
    getShowInPermissionUi?: (permission: T) => boolean | null | undefined
) {
    return permissions.filter((permission) => {
        const permissionCode = getPermissionCode
            ? getPermissionCode(permission)
            : (permission as PermissionCatalogVisibilityInput).permission_code;

        if (VISUAL_SECURITY_MANAGE_PERMISSION_KEYS.has(permissionCode)) {
            return false;
        }

        const showInPermissionUi = getShowInPermissionUi
            ? getShowInPermissionUi(permission)
            : (permission as Partial<PermissionCatalogVisibilityInput>).show_in_permission_ui;

        return showInPermissionUi !== false;
    });
}
