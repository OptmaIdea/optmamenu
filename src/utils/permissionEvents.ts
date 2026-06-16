export const PERMISSIONS_CHANGED_EVENT = 'optmamenu:permissions-changed';
export const PERMISSIONS_CHANGED_STORAGE_KEY = 'optmamenu.permissions.changed';

export type PermissionsChangedPayload = {
    storeId?: string | null;
    source?: string;
    timestamp: number;
};

export function notifyPermissionsChanged(
    storeId?: string | null,
    source = 'unknown'
) {
    const payload: PermissionsChangedPayload = {
        storeId,
        source,
        timestamp: Date.now(),
    };

    if (typeof window === 'undefined') return;

    window.dispatchEvent(
        new CustomEvent<PermissionsChangedPayload>(PERMISSIONS_CHANGED_EVENT, {
            detail: payload,
        })
    );

    try {
        localStorage.setItem(
            PERMISSIONS_CHANGED_STORAGE_KEY,
            JSON.stringify(payload)
        );
    } catch {
        // noop
    }
}
