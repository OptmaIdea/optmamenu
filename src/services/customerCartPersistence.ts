import { supabaseCustomer } from '@/lib/supabase';
import { useCartStore } from '@/store/useCartStore';
import type { CartItem, Product } from '@/types';

const CUSTOMER_CART_PREFIX = 'optma-customer-cart-v1';
const CUSTOMER_CART_OWNER_KEY = 'optma-customer-cart-owner-v1';
const ANONYMOUS_CART_ACTIVITY_PREFIX = 'optma-anonymous-cart-activity-v1';
const CART_RETENTION_CONFIG_PREFIX = 'optma-cart-retention-hours-v1';

export const DEFAULT_CUSTOMER_CART_RETENTION_HOURS = 6;
const MIN_CART_RETENTION_HOURS = 1;
const MAX_CART_RETENTION_HOURS = 24;
const SERVER_SYNC_DEBOUNCE_MS = 220;
const SERVER_SYNC_POLL_MS = 5000;

type CustomerCartOwner = {
    customerId: string;
    storeId: string;
};

type CustomerCartSnapshot = {
    version: 1;
    customerId: string;
    storeId: string;
    context: ReturnType<typeof useCartStore.getState>['context'];
    fulfillmentType: ReturnType<typeof useCartStore.getState>['fulfillmentType'];
    deliveryMethodCode: ReturnType<typeof useCartStore.getState>['deliveryMethodCode'];
    items: CartItem[];
    updatedAt: string;
};

type ServerCartResult = {
    ok?: boolean;
    error?: string;
    stale?: boolean;
    cart?: Record<string, unknown>;
    updated_at?: string | null;
    revision?: number | string | null;
};

let activeOwner: CustomerCartOwner | null = null;
let suppressPersistence = false;
let activeServerRevision = 0;
let activeGeneration = 0;
let localMutationVersion = 0;
let syncedMutationVersion = 0;
let serverSaveTimer: number | null = null;
let serverPollTimer: number | null = null;
let serverSyncChain: Promise<void> = Promise.resolve();
const retentionHoursByStore = new Map<string, number>();
const catalogProductsByStore = new Map<string, Product[]>();

function storageAvailable() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isSameOwner(left: CustomerCartOwner | null, right: CustomerCartOwner) {
    return Boolean(left && left.customerId === right.customerId && left.storeId === right.storeId);
}

function customerCartKey(customerId: string, storeId: string) {
    return `${CUSTOMER_CART_PREFIX}:${storeId}:${customerId}`;
}

function anonymousCartActivityKey(storeId: string) {
    return `${ANONYMOUS_CART_ACTIVITY_PREFIX}:${storeId}`;
}

function retentionConfigKey(storeId: string) {
    return `${CART_RETENTION_CONFIG_PREFIX}:${storeId}`;
}

function normalizeRetentionHours(value: unknown) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_CUSTOMER_CART_RETENTION_HOURS;
    return Math.min(MAX_CART_RETENTION_HOURS, Math.max(MIN_CART_RETENTION_HOURS, Math.round(numeric)));
}

function getRetentionHours(storeId: string) {
    const inMemory = retentionHoursByStore.get(storeId);
    if (inMemory) return inMemory;

    if (storageAvailable()) {
        try {
            const stored = window.localStorage.getItem(retentionConfigKey(storeId));
            if (stored) return normalizeRetentionHours(stored);
        } catch {
            // O valor padrão continua seguro se o storage estiver indisponível.
        }
    }

    return DEFAULT_CUSTOMER_CART_RETENTION_HOURS;
}

function isExpired(updatedAt: string | null | undefined, storeId: string) {
    const timestamp = Date.parse(updatedAt || '');
    if (!Number.isFinite(timestamp)) return true;
    const retentionMs = getRetentionHours(storeId) * 60 * 60 * 1000;
    return Date.now() - timestamp > retentionMs;
}

function readOwnerMarker(): CustomerCartOwner | null {
    if (!storageAvailable()) return null;

    try {
        const raw = window.localStorage.getItem(CUSTOMER_CART_OWNER_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CustomerCartOwner>;
        if (!parsed.customerId || !parsed.storeId) return null;
        return { customerId: parsed.customerId, storeId: parsed.storeId };
    } catch {
        return null;
    }
}

function writeOwnerMarker(owner: CustomerCartOwner | null) {
    if (!storageAvailable()) return;

    try {
        if (!owner) {
            window.localStorage.removeItem(CUSTOMER_CART_OWNER_KEY);
            return;
        }
        window.localStorage.setItem(CUSTOMER_CART_OWNER_KEY, JSON.stringify(owner));
    } catch {
        // Persistência local é uma conveniência; a compra não pode quebrar se ela falhar.
    }
}

function removeSnapshot(owner: CustomerCartOwner) {
    if (!storageAvailable()) return;
    try {
        window.localStorage.removeItem(customerCartKey(owner.customerId, owner.storeId));
    } catch {
        // Sem efeito funcional se o navegador bloquear o storage.
    }
}

function readSnapshot(owner: CustomerCartOwner): CustomerCartSnapshot | null {
    if (!storageAvailable()) return null;

    try {
        const key = customerCartKey(owner.customerId, owner.storeId);
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CustomerCartSnapshot>;

        if (
            parsed.version !== 1
            || parsed.customerId !== owner.customerId
            || parsed.storeId !== owner.storeId
            || !Array.isArray(parsed.items)
            || isExpired(parsed.updatedAt, owner.storeId)
        ) {
            window.localStorage.removeItem(key);
            return null;
        }

        return parsed as CustomerCartSnapshot;
    } catch {
        return null;
    }
}

function snapshotFromState(owner: CustomerCartOwner): CustomerCartSnapshot {
    const state = useCartStore.getState();
    return {
        version: 1,
        customerId: owner.customerId,
        storeId: owner.storeId,
        context: state.context,
        fulfillmentType: state.fulfillmentType,
        deliveryMethodCode: state.deliveryMethodCode,
        items: state.items,
        updatedAt: new Date().toISOString(),
    };
}

function writeSnapshot(owner: CustomerCartOwner) {
    if (!storageAvailable()) return;

    const state = useCartStore.getState();
    if (state.context?.storeId && state.context.storeId !== owner.storeId) return;

    if (state.items.length === 0) {
        removeSnapshot(owner);
        return;
    }

    try {
        window.localStorage.setItem(
            customerCartKey(owner.customerId, owner.storeId),
            JSON.stringify(snapshotFromState(owner)),
        );
    } catch {
        // Sem erro de UI: o carrinho segue funcional em memória.
    }
}

function writeAnonymousActivity(storeId: string, hasItems: boolean) {
    if (!storageAvailable()) return;

    try {
        const key = anonymousCartActivityKey(storeId);
        if (!hasItems) {
            window.localStorage.removeItem(key);
            return;
        }
        window.localStorage.setItem(key, new Date().toISOString());
    } catch {
        // O carrinho continua utilizável em memória.
    }
}

function clearCartWithoutPersistence() {
    suppressPersistence = true;
    try {
        useCartStore.getState().clearCart();
    } finally {
        suppressPersistence = false;
    }
}

function enforceAnonymousCartRetention(storeId: string) {
    if (!storageAvailable()) return;

    const state = useCartStore.getState();
    if (state.context?.storeId !== storeId || state.items.length === 0) return;

    try {
        const key = anonymousCartActivityKey(storeId);
        const updatedAt = window.localStorage.getItem(key);

        if (!updatedAt) {
            writeAnonymousActivity(storeId, true);
            return;
        }

        if (isExpired(updatedAt, storeId)) {
            window.localStorage.removeItem(key);
            clearCartWithoutPersistence();
        }
    } catch {
        // Falha de storage não bloqueia a loja pública.
    }
}

function sanitizeItemsAgainstCatalog(items: CartItem[], products: Product[]) {
    const productMap = new Map(products.map((product) => [product.id, product]));

    return items.flatMap((item) => {
        const product = productMap.get(item.id);
        if (!product || product.active === false || product.public_availability?.status === 'unavailable') {
            return [];
        }

        const rawLimit = product.public_availability?.availableOnline ?? product.stock_quantity;
        const numericLimit = Math.floor(Number(rawLimit));
        const quantity = Number.isFinite(numericLimit)
            ? Math.min(item.quantity, Math.max(0, numericLimit))
            : item.quantity;

        if (quantity <= 0) return [];

        return [{
            ...item,
            ...product,
            quantity,
            originalPrice: Number(product.price || 0),
        } as CartItem];
    });
}

function serverCartPayload() {
    const state = useCartStore.getState();
    return {
        schemaVersion: 2,
        context: state.context,
        fulfillmentType: state.fulfillmentType,
        deliveryMethodCode: state.deliveryMethodCode,
        items: state.items,
        clientUpdatedAt: new Date().toISOString(),
        syncBaseRevision: activeServerRevision,
    };
}

function normalizeRevision(value: unknown) {
    const revision = Number(value || 0);
    return Number.isFinite(revision) && revision >= 0 ? Math.floor(revision) : 0;
}

function applyServerCart(
    owner: CustomerCartOwner,
    generation: number,
    cart: Record<string, unknown> | null | undefined,
    revision: number,
) {
    if (generation !== activeGeneration || !isSameOwner(activeOwner, owner)) return;

    activeServerRevision = revision;
    const rawItems = Array.isArray(cart?.items) ? cart.items as CartItem[] : [];
    const catalog = catalogProductsByStore.get(owner.storeId);
    const items = catalog ? sanitizeItemsAgainstCatalog(rawItems, catalog) : rawItems;
    const cleared = cart?.cleared === true || items.length === 0;

    suppressPersistence = true;
    try {
        if (cleared) {
            useCartStore.getState().clearCart();
            removeSnapshot(owner);
            return;
        }

        const current = useCartStore.getState();
        const serverContext = cart?.context && typeof cart.context === 'object'
            ? cart.context as ReturnType<typeof useCartStore.getState>['context']
            : current.context;

        useCartStore.setState({
            context: serverContext?.storeId === owner.storeId ? serverContext : current.context,
            fulfillmentType: (cart?.fulfillmentType as ReturnType<typeof useCartStore.getState>['fulfillmentType']) || current.fulfillmentType,
            deliveryMethodCode: (cart?.deliveryMethodCode as string | null | undefined) ?? current.deliveryMethodCode,
            items,
            isCartOpen: false,
        });
        writeSnapshot(owner);
    } finally {
        suppressPersistence = false;
    }
}

async function fetchServerCart(owner: CustomerCartOwner, generation: number) {
    const { data, error } = await supabaseCustomer.rpc('get_customer_self_cart_draft_safe');
    if (error) throw error;

    const result = data as ServerCartResult | null;
    if (!result?.ok) throw new Error(result?.error || 'cart_sync_failed');
    if (generation !== activeGeneration || !isSameOwner(activeOwner, owner)) return result;

    const revision = normalizeRevision(result.revision);
    if (revision > activeServerRevision) {
        applyServerCart(owner, generation, result.cart, revision);
        syncedMutationVersion = localMutationVersion;
    }

    return result;
}

async function persistServerCart(
    owner: CustomerCartOwner,
    generation: number,
    mutationVersion: number,
) {
    if (generation !== activeGeneration || !isSameOwner(activeOwner, owner)) return;

    const { data, error } = await supabaseCustomer.rpc('save_customer_self_cart_draft_safe', {
        p_cart: serverCartPayload(),
    });
    if (error) throw error;

    const result = data as ServerCartResult | null;
    if (!result?.ok) throw new Error(result?.error || 'cart_sync_failed');

    if (generation !== activeGeneration || !isSameOwner(activeOwner, owner)) return;

    const revision = normalizeRevision(result.revision);
    if (result.stale) {
        applyServerCart(owner, generation, result.cart, revision);
        syncedMutationVersion = localMutationVersion;
        return;
    }

    activeServerRevision = revision;
    syncedMutationVersion = Math.max(syncedMutationVersion, mutationVersion);

    if (syncedMutationVersion < localMutationVersion) {
        queueServerSave(owner, generation, 0);
    }
}

function enqueueServerSave(owner: CustomerCartOwner, generation: number, mutationVersion: number) {
    serverSyncChain = serverSyncChain
        .catch(() => undefined)
        .then(async () => {
            try {
                await persistServerCart(owner, generation, mutationVersion);
            } catch (error) {
                console.warn('[CUSTOMER_CART] Falha ao sincronizar carrinho no servidor:', error);
            }
        });
    return serverSyncChain;
}

function queueServerSave(
    owner: CustomerCartOwner,
    generation: number,
    delay = SERVER_SYNC_DEBOUNCE_MS,
) {
    if (typeof window === 'undefined') return;
    if (serverSaveTimer !== null) window.clearTimeout(serverSaveTimer);

    const mutationVersion = localMutationVersion;
    serverSaveTimer = window.setTimeout(() => {
        serverSaveTimer = null;
        void enqueueServerSave(owner, generation, mutationVersion);
    }, delay);
}

async function hydrateCustomerCart(
    owner: CustomerCartOwner,
    generation: number,
    localSnapshot: CustomerCartSnapshot | null,
) {
    try {
        const result = await fetchServerCart(owner, generation);
        if (generation !== activeGeneration || !isSameOwner(activeOwner, owner)) return;

        if (normalizeRevision(result?.revision) > 0) return;

        if (localSnapshot?.items.length) {
            localMutationVersion += 1;
            await enqueueServerSave(owner, generation, localMutationVersion);
        }
    } catch (error) {
        console.warn('[CUSTOMER_CART] Não foi possível restaurar o carrinho do servidor:', error);
    }
}

function startServerPoll(owner: CustomerCartOwner, generation: number) {
    if (typeof window === 'undefined') return;
    if (serverPollTimer !== null) window.clearInterval(serverPollTimer);

    serverPollTimer = window.setInterval(() => {
        if (generation !== activeGeneration || !isSameOwner(activeOwner, owner)) return;
        if (serverSaveTimer !== null || syncedMutationVersion < localMutationVersion) return;

        void fetchServerCart(owner, generation).catch((error) => {
            console.warn('[CUSTOMER_CART] Falha ao atualizar carrinho entre dispositivos:', error);
        });
    }, SERVER_SYNC_POLL_MS);
}

function stopServerSyncTimers() {
    if (typeof window === 'undefined') return;
    if (serverSaveTimer !== null) window.clearTimeout(serverSaveTimer);
    if (serverPollTimer !== null) window.clearInterval(serverPollTimer);
    serverSaveTimer = null;
    serverPollTimer = null;
}

useCartStore.subscribe((state, previousState) => {
    if (suppressPersistence) return;

    if (activeOwner) {
        if (state.context?.storeId && state.context.storeId !== activeOwner.storeId) return;

        if (
            state.items !== previousState.items
            || state.context !== previousState.context
            || state.fulfillmentType !== previousState.fulfillmentType
            || state.deliveryMethodCode !== previousState.deliveryMethodCode
        ) {
            writeSnapshot(activeOwner);
            localMutationVersion += 1;
            queueServerSave(activeOwner, activeGeneration);
        }
        return;
    }

    if (state.items !== previousState.items) {
        const storeId = state.context?.storeId || previousState.context?.storeId;
        if (storeId) writeAnonymousActivity(storeId, state.items.length > 0);
    }
});

export function configureCustomerCartRetention(storeId: string, hours?: number | null) {
    const retentionHours = normalizeRetentionHours(hours);
    retentionHoursByStore.set(storeId, retentionHours);

    if (storageAvailable()) {
        try {
            window.localStorage.setItem(retentionConfigKey(storeId), String(retentionHours));
        } catch {
            // A configuração em memória continua valendo nesta sessão.
        }
    }

    enforceAnonymousCartRetention(storeId);
    return retentionHours;
}

export function syncCustomerCartCatalog(storeId: string, products: Product[]) {
    catalogProductsByStore.set(storeId, products);

    const state = useCartStore.getState();
    if (state.context?.storeId !== storeId || state.items.length === 0) return;

    const sanitized = sanitizeItemsAgainstCatalog(state.items, products);
    useCartStore.setState({ items: sanitized });
}

export function prepareCustomerCartForSessionRestore() {
    const marker = readOwnerMarker();
    const currentStoreId = useCartStore.getState().context?.storeId;

    if (!marker) {
        if (currentStoreId) enforceAnonymousCartRetention(currentStoreId);
        return;
    }

    activeOwner = null;
    stopServerSyncTimers();
    clearCartWithoutPersistence();
    writeOwnerMarker(null);
}

export function activateCustomerCart(customerId: string, storeId: string) {
    const owner = { customerId, storeId };
    if (isSameOwner(activeOwner, owner)) return;

    if (activeOwner) writeSnapshot(activeOwner);

    stopServerSyncTimers();
    activeGeneration += 1;
    const generation = activeGeneration;
    activeServerRevision = 0;
    localMutationVersion = 0;
    syncedMutationVersion = 0;

    const snapshot = readSnapshot(owner);

    activeOwner = null;
    clearCartWithoutPersistence();
    writeAnonymousActivity(storeId, false);

    activeOwner = owner;
    writeOwnerMarker(owner);

    if (snapshot) {
        const catalogProducts = catalogProductsByStore.get(storeId);
        const restoredItems = catalogProducts
            ? sanitizeItemsAgainstCatalog(snapshot.items, catalogProducts)
            : snapshot.items;

        suppressPersistence = true;
        try {
            if (restoredItems.length === 0) {
                removeSnapshot(owner);
            } else {
                useCartStore.setState((current) => ({
                    context: current.context?.storeId === storeId ? current.context : snapshot.context,
                    fulfillmentType: snapshot.fulfillmentType,
                    deliveryMethodCode: snapshot.deliveryMethodCode,
                    items: restoredItems,
                    isCartOpen: false,
                }));
            }
        } finally {
            suppressPersistence = false;
        }
    }

    void hydrateCustomerCart(owner, generation, snapshot);
    startServerPoll(owner, generation);
}

export async function refreshCustomerCartFromServer() {
    if (!activeOwner) return;
    await fetchServerCart(activeOwner, activeGeneration);
}

export async function flushCustomerCartServerSync() {
    if (!activeOwner) return;
    const owner = activeOwner;
    const generation = activeGeneration;

    if (serverSaveTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(serverSaveTimer);
        serverSaveTimer = null;
    }

    if (syncedMutationVersion < localMutationVersion) {
        await enqueueServerSave(owner, generation, localMutationVersion);
    } else {
        await serverSyncChain.catch(() => undefined);
    }
}

export function deactivateCustomerCart(customerId?: string, storeId?: string) {
    const ownerToDeactivate = activeOwner
        && (!customerId || activeOwner.customerId === customerId)
        && (!storeId || activeOwner.storeId === storeId)
        ? activeOwner
        : null;

    if (ownerToDeactivate) {
        writeSnapshot(ownerToDeactivate);

        if (serverSaveTimer !== null && typeof window !== 'undefined') {
            window.clearTimeout(serverSaveTimer);
            serverSaveTimer = null;
            const payload = serverCartPayload();
            void (async () => {
                try {
                    await supabaseCustomer.rpc('save_customer_self_cart_draft_safe', { p_cart: payload });
                } catch {
                    // O logout não deve falhar por uma última tentativa de sincronização.
                }
            })();
        }
    }

    activeOwner = null;
    activeGeneration += 1;
    stopServerSyncTimers();
    writeOwnerMarker(null);

    if (ownerToDeactivate) clearCartWithoutPersistence();
}
