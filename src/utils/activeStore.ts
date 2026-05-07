export const ACTIVE_STORE_KEY = 'optmamenu_active_store_id';

export function getActiveStoreId(): string | null {
    return localStorage.getItem(ACTIVE_STORE_KEY);
}

export function setActiveStoreId(storeId: string): void {
    localStorage.setItem(ACTIVE_STORE_KEY, storeId);
    window.dispatchEvent(new Event('optmamenu:active-store-changed'));
}

export function clearActiveStoreId(): void {
    localStorage.removeItem(ACTIVE_STORE_KEY);
    window.dispatchEvent(new Event('optmamenu:active-store-changed'));
}

export type ActiveMembershipLike = {
    store_id: string;
    status?: string | null;
};

export function resolveActiveMembership<T extends ActiveMembershipLike>(
    memberships: T[] | null | undefined,
    fallbackMembership?: T | null
): T | null {
    const activeStoreId = getActiveStoreId();

    const activeMembership =
        memberships?.find(
            (membership) =>
                membership.store_id === activeStoreId &&
                (!membership.status || membership.status === 'active')
        ) ?? null;

    if (activeMembership) {
        return activeMembership;
    }

    if (
        fallbackMembership &&
        (!fallbackMembership.status || fallbackMembership.status === 'active')
    ) {
        return fallbackMembership;
    }

    return (
        memberships?.find(
            (membership) => !membership.status || membership.status === 'active'
        ) ?? null
    );
}