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