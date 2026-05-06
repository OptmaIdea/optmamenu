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