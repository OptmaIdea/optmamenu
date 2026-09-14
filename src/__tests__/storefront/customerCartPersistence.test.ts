import { beforeEach, describe, expect, it } from 'vitest';
import {
    activateCustomerCart,
    deactivateCustomerCart,
    prepareCustomerCartForSessionRestore,
} from '@/services/customerCartPersistence';
import { useCartStore } from '@/store/useCartStore';
import type { Product } from '@/types';

const context = {
    storeId: 'store-1',
    requestedSlug: 'gelinhares',
    canonicalSlug: 'gelinhares',
    type: 'remote' as const,
};

function product(id = 'prod-1'): Product {
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
});
