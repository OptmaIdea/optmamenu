import { useCartStore } from '@/store/useCartStore';
import type { CartItem, Product } from '@/types';

const CUSTOMER_CART_PREFIX = 'optma-customer-cart-v1';
const CUSTOMER_CART_OWNER_KEY = 'optma-customer-cart-owner-v1';
const ANONYMOUS_CART_ACTIVITY_PREFIX = 'optma-anonymous-cart-activity-v1';
const CART_RETENTION_CONFIG_PREFIX = 'optma-cart-retention-hours-v1';

export const DEFAULT_CUSTOMER_CART_RETENTION_HOURS = 6;
const MIN_CART_RETENTION_HOURS = 1;
const MAX_CART_RETENTION_HOURS = 24;

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

let activeOwner: CustomerCartOwner | null = null;
let suppressPersistence = false;
const retentionHoursByStore = new Map<string, number>();
const catalogProductsByStore = new Map<string, Product[]>();

function storageAvailable() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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

function writeSnapshot(owner: CustomerCartOwner) {
    if (!storageAvailable()) return;

    const state = useCartStore.getState();
    if (state.context?.storeId && state.context.storeId !== owner.storeId) return;

    if (state.items.length === 0) {
        removeSnapshot(owner);
        return;
    }

    const snapshot: CustomerCartSnapshot = {
        version: 1,
        customerId: owner.customerId,
        storeId: owner.storeId,
        context: state.context,
        fulfillmentType: state.fulfillmentType,
        deliveryMethodCode: state.deliveryMethodCode,
        items: state.items,
        updatedAt: new Date().toISOString(),
    };

    try {
        window.localStorage.setItem(
            customerCartKey(owner.customerId, owner.storeId),
            JSON.stringify(snapshot),
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

        // Carrinhos criados antes desta política recebem o prazo a partir da primeira
        // visita após a atualização, evitando apagar silenciosamente um carrinho válido.
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

// Mantém a cópia individual atualizada durante toda a sessão autenticada e registra
// a última alteração do carrinho anônimo para aplicar a mesma política de validade.
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

    // Nunca exibe o carrinho de uma sessão autenticada anterior antes de revalidar
    // a identidade. O snapshot individual permanece preservado para a restauração.
    activeOwner = null;
    clearCartWithoutPersistence();
    writeOwnerMarker(null);
}

export function activateCustomerCart(customerId: string, storeId: string) {
    const owner = { customerId, storeId };

    if (
        activeOwner
        && (activeOwner.customerId !== customerId || activeOwner.storeId !== storeId)
    ) {
        writeSnapshot(activeOwner);
    }

    const snapshot = readSnapshot(owner);

    // Regra de identidade: itens montados como anônimo nunca substituem um carrinho
    // pertencente ao cliente. Ao autenticar, o carrinho anônimo é descartado.
    activeOwner = null;
    clearCartWithoutPersistence();
    writeAnonymousActivity(storeId, false);

    activeOwner = owner;
    writeOwnerMarker(owner);

    if (!snapshot) return;

    const catalogProducts = catalogProductsByStore.get(storeId);
    const restoredItems = catalogProducts
        ? sanitizeItemsAgainstCatalog(snapshot.items, catalogProducts)
        : snapshot.items;

    if (restoredItems.length === 0) {
        removeSnapshot(owner);
        return;
    }

    useCartStore.setState((current) => ({
        context: current.context?.storeId === storeId
            ? current.context
            : snapshot.context,
        fulfillmentType: snapshot.fulfillmentType,
        deliveryMethodCode: snapshot.deliveryMethodCode,
        items: restoredItems,
        isCartOpen: false,
    }));
}

export function deactivateCustomerCart(customerId?: string, storeId?: string) {
    if (
        activeOwner
        && (!customerId || activeOwner.customerId === customerId)
        && (!storeId || activeOwner.storeId === storeId)
    ) {
        writeSnapshot(activeOwner);
    }

    activeOwner = null;
    writeOwnerMarker(null);

    // O carrinho some da sessão pública, mas a cópia individual continua guardada
    // até o prazo configurado para o próximo login do mesmo cliente.
    clearCartWithoutPersistence();
}
