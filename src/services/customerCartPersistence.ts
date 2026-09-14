import { useCartStore } from '@/store/useCartStore';
import type { CartItem } from '@/types';

const CUSTOMER_CART_PREFIX = 'optma-customer-cart-v1';
const CUSTOMER_CART_OWNER_KEY = 'optma-customer-cart-owner-v1';

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

function storageAvailable() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function customerCartKey(customerId: string, storeId: string) {
    return `${CUSTOMER_CART_PREFIX}:${storeId}:${customerId}`;
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

function readSnapshot(owner: CustomerCartOwner): CustomerCartSnapshot | null {
    if (!storageAvailable()) return null;

    try {
        const raw = window.localStorage.getItem(customerCartKey(owner.customerId, owner.storeId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CustomerCartSnapshot>;

        if (
            parsed.version !== 1
            || parsed.customerId !== owner.customerId
            || parsed.storeId !== owner.storeId
            || !Array.isArray(parsed.items)
        ) {
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

// Mantém a cópia individual atualizada durante toda a sessão autenticada.
useCartStore.subscribe((state, previousState) => {
    if (!activeOwner) return;
    if (state.context?.storeId && state.context.storeId !== activeOwner.storeId) return;

    if (
        state.items !== previousState.items
        || state.context !== previousState.context
        || state.fulfillmentType !== previousState.fulfillmentType
        || state.deliveryMethodCode !== previousState.deliveryMethodCode
    ) {
        writeSnapshot(activeOwner);
    }
});

export function prepareCustomerCartForSessionRestore() {
    const marker = readOwnerMarker();
    if (!marker) return;

    // Nunca exibe o carrinho de uma sessão anterior antes de revalidar a identidade.
    useCartStore.getState().clearCart();
}

export function activateCustomerCart(customerId: string, storeId: string) {
    const owner = { customerId, storeId };
    const state = useCartStore.getState();
    const snapshot = readSnapshot(owner);
    const hasGuestCartForStore = state.items.length > 0
        && (!state.context?.storeId || state.context.storeId === storeId);

    activeOwner = owner;
    writeOwnerMarker(owner);

    if (hasGuestCartForStore) {
        // Itens escolhidos antes do login passam a pertencer ao cliente que acabou de se autenticar.
        writeSnapshot(owner);
        return;
    }

    if (!snapshot) return;

    useCartStore.setState((current) => ({
        context: current.context?.storeId === storeId
            ? current.context
            : snapshot.context,
        fulfillmentType: snapshot.fulfillmentType,
        deliveryMethodCode: snapshot.deliveryMethodCode,
        items: snapshot.items,
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

    // O carrinho some da sessão pública, mas a cópia individual continua guardada para o próximo login.
    useCartStore.getState().clearCart();
}
