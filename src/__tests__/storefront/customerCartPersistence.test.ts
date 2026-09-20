import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockedCartServer = vi.hoisted(() => {
    const state: {
        revision: number;
        cart: Record<string, unknown>;
        updatedAt: string | null;
    } = {
        revision: 0,
        cart: {},
        updatedAt: null,
    };

    const rpc = vi.fn(async (name: string, args?: { p_cart?: Record<string, unknown> }) => {
        if (name === 'get_customer_self_cart_draft_safe') {
            return {
                data: {
                    ok: true,
                    cart: state.cart,
                    revision: state.revision,
                    updated_at: state.updatedAt,
                },
                error: null,
            };
        }

        if (name === 'save_customer_self_cart_draft_safe') {
            const incoming = { ...(args?.p_cart || {}) };
            const baseRevision = Number(incoming.syncBaseRevision || 0);

            if (state.revision > 0 && baseRevision !== state.revision) {
                return {
                    data: {
                        ok: true,
                        stale: true,
                        cart: state.cart,
                        revision: state.revision,
                        updated_at: state.updatedAt,
                    },
                    error: null,
                };
            }

            delete incoming.syncBaseRevision;
            state.revision += 1;
            state.updatedAt = new Date().toISOString();
            state.cart = Array.isArray(incoming.items) && incoming.items.length === 0
                ? { ...incoming, cleared: true, clearedAt: state.updatedAt }
                : incoming;

            return {
                data: {
                    ok: true,
                    stale: false,
                    revision: state.revision,
                    updated_at: state.updatedAt,
                },
                error: null,
            };
        }

        return { data: { ok: false, error: 'unexpected_rpc' }, error: null };
    });

    return { state, rpc };
});

vi.mock('@/lib/supabase', () => ({
    supabaseCustomer: {
        rpc: mockedCartServer.rpc,
    },
}));

import {
    activateCustomerCart,
    configureCustomerCartRetention,
    deactivateCustomerCart,
    flushCustomerCartServerSync,
    prepareCustomerCartForSessionRestore,
    refreshCustomerCartFromServer,
    syncCustomerCartCatalog,
} from '@/services/customerCartPersistence';
import { useCartStore } from '@/store/useCartStore';
import type { Product } from '@/types';

const context = {
    storeId: 'store-1',
    requestedSlug: 'gelinhares',
    canonicalSlug: 'gelinhares',
    type: 'remote' as const,
};

function product(id = 'prod-1', overrides: Partial<Product> = {}): Product {
    return {
        id,
        category_id: 'cat-1',
        name: 'Picolé',
        price: 5,
        images: [],
        featured: false,
        sales_count: 0,
        stock_quantity: 20,
        rating_avg: 0,
        review_count: 0,
        active: true,
        use_category_pricing: false,
        ...overrides,
    };
}

async function settleHydration() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('customerCartPersistence', () => {
    beforeEach(() => {
        deactivateCustomerCart();
        localStorage.clear();
        mockedCartServer.state.revision = 0;
        mockedCartServer.state.cart = {};
        mockedCartServer.state.updatedAt = null;
        mockedCartServer.rpc.mockClear();

        useCartStore.setState({
            context,
            fulfillmentType: 'pickup',
            deliveryMethodCode: 'pickup',
            items: [],
            categoryRules: {},
            isCartOpen: false,
        });
        configureCustomerCartRetention('store-1', 6);
    });

    afterEach(() => {
        deactivateCustomerCart();
    });

    it('oculta o carrinho no logout e restaura para o mesmo cliente no próximo login', () => {
        activateCustomerCart('customer-1', 'store-1');
        useCartStore.getState().addToCart(product(), 2);

        deactivateCustomerCart('customer-1', 'store-1');
        expect(useCartStore.getState().items).toEqual([]);

        activateCustomerCart('customer-1', 'store-1');
        expect(useCartStore.getState().items).toHaveLength(1);
        expect(useCartStore.getState().items[0].quantity).toBe(2);
    });

    it('não entrega o carrinho salvo de um cliente para outro', () => {
        activateCustomerCart('customer-1', 'store-1');
        useCartStore.getState().addToCart(product(), 3);
        deactivateCustomerCart('customer-1', 'store-1');

        activateCustomerCart('customer-2', 'store-1');
        expect(useCartStore.getState().items).toEqual([]);
    });

    it('não mostra carrinho de sessão autenticada anterior antes da revalidação', () => {
        activateCustomerCart('customer-1', 'store-1');
        useCartStore.getState().addToCart(product(), 1);

        prepareCustomerCartForSessionRestore();
        expect(useCartStore.getState().items).toEqual([]);

        activateCustomerCart('customer-1', 'store-1');
        expect(useCartStore.getState().items).toHaveLength(1);
    });

    it('descarta o carrinho anônimo no login e restaura o carrinho persistido do cliente', () => {
        activateCustomerCart('customer-1', 'store-1');
        useCartStore.getState().addToCart(product('saved-product'), 2);
        deactivateCustomerCart('customer-1', 'store-1');

        useCartStore.getState().addToCart(product('guest-product'), 4);
        expect(useCartStore.getState().items[0].id).toBe('guest-product');

        activateCustomerCart('customer-1', 'store-1');

        const items = useCartStore.getState().items;
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe('saved-product');
        expect(items[0].quantity).toBe(2);
    });

    it('não promove o carrinho anônimo quando o cliente ainda não possui carrinho salvo', () => {
        useCartStore.getState().addToCart(product('guest-product'), 3);

        activateCustomerCart('customer-new', 'store-1');

        expect(useCartStore.getState().items).toEqual([]);
    });

    it('expira o carrinho individual depois do prazo configurado', () => {
        activateCustomerCart('customer-1', 'store-1');
        useCartStore.getState().addToCart(product(), 1);
        deactivateCustomerCart('customer-1', 'store-1');

        const key = 'optma-customer-cart-v1:store-1:customer-1';
        const snapshot = JSON.parse(localStorage.getItem(key) || '{}');
        snapshot.updatedAt = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
        localStorage.setItem(key, JSON.stringify(snapshot));

        activateCustomerCart('customer-1', 'store-1');

        expect(useCartStore.getState().items).toEqual([]);
        expect(localStorage.getItem(key)).toBeNull();
    });

    it('aplica o prazo configurável também ao carrinho anônimo', () => {
        useCartStore.getState().addToCart(product(), 1);
        localStorage.setItem(
            'optma-anonymous-cart-activity-v1:store-1',
            new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        );

        configureCustomerCartRetention('store-1', 1);

        expect(useCartStore.getState().items).toEqual([]);
    });

    it('reconcilia o carrinho salvo com existência e estoque atual do catálogo', () => {
        activateCustomerCart('customer-1', 'store-1');
        useCartStore.getState().addToCart(product('available'), 5);
        useCartStore.getState().addToCart(product('removed'), 1);

        syncCustomerCartCatalog('store-1', [
            product('available', {
                stock_quantity: 2,
                public_availability: {
                    status: 'low_stock',
                    availableOnline: 2,
                    displayMode: 'exact',
                },
            }),
        ]);

        const items = useCartStore.getState().items;
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe('available');
        expect(items[0].quantity).toBe(2);
    });

    it('sincroniza quantidade e exclusão do carrinho entre dispositivos pelo servidor', async () => {
        activateCustomerCart('customer-1', 'store-1');
        await settleHydration();

        useCartStore.getState().addToCart(product(), 2);
        await flushCustomerCartServerSync();

        expect(mockedCartServer.state.revision).toBe(1);
        expect((mockedCartServer.state.cart.items as Array<{ quantity: number }>)[0].quantity).toBe(2);

        mockedCartServer.state.cart = {
            ...mockedCartServer.state.cart,
            items: [{
                ...(mockedCartServer.state.cart.items as Array<Record<string, unknown>>)[0],
                quantity: 5,
            }],
        };
        mockedCartServer.state.revision += 1;

        await refreshCustomerCartFromServer();
        expect(useCartStore.getState().items[0].quantity).toBe(5);

        mockedCartServer.state.cart = {
            schemaVersion: 2,
            context,
            fulfillmentType: 'pickup',
            deliveryMethodCode: 'pickup',
            items: [],
            cleared: true,
        };
        mockedCartServer.state.revision += 1;

        await refreshCustomerCartFromServer();
        expect(useCartStore.getState().items).toEqual([]);

        useCartStore.getState().addToCart(product(), 1);
        await flushCustomerCartServerSync();
        useCartStore.getState().removeFromCart('prod-1');
        await flushCustomerCartServerSync();

        expect(mockedCartServer.state.cart.cleared).toBe(true);
        expect(mockedCartServer.state.cart.items).toEqual([]);
    });
});
