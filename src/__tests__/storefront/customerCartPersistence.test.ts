import { beforeEach, describe, expect, it } from 'vitest';
import {
    activateCustomerCart,
    configureCustomerCartRetention,
    deactivateCustomerCart,
    prepareCustomerCartForSessionRestore,
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

describe('customerCartPersistence', () => {
    beforeEach(() => {
        localStorage.clear();
        deactivateCustomerCart();
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
});
