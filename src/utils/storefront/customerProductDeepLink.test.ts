import { describe, expect, it } from 'vitest';
import { resolveCustomerProductDeepLink } from './customerProductDeepLink';

describe('consumption product deep-link recovery', () => {
    it('opens an existing product in the current public catalog', () => {
        const route = resolveCustomerProductDeepLink('?product=sku-1&returnTo=consumption', ['sku-1'], true);
        expect(route.productId).toBe('sku-1');
        expect(route.existsInCatalog).toBe(true);
        expect(route.shouldReturnToConsumption).toBe(false);
    });

    it('recovers the customer area when a consumed product was removed from the catalog', () => {
        const route = resolveCustomerProductDeepLink('?product=retired&returnTo=consumption', ['other'], true);
        expect(route.shouldReturnToConsumption).toBe(true);
        expect(route.cleanSearch).toBe('');
    });

    it('returns to consumption even if the active catalog has no products', () => {
        expect(resolveCustomerProductDeepLink('?product=archived&returnTo=consumption', [], true)
            .shouldReturnToConsumption).toBe(true);
    });

    it('does not redirect before the asynchronous catalog has finished loading', () => {
        expect(resolveCustomerProductDeepLink('?product=archived&returnTo=consumption', [], false)
            .shouldReturnToConsumption).toBe(false);
    });

    it('preserves unrelated filters and tracking parameters without exposing a stale product ID', () => {
        const route = resolveCustomerProductDeepLink(
            '?category=sorvetes&product=missing&returnTo=consumption&campaign=oct',
            [],
            true,
        );
        expect(route.shouldReturnToConsumption).toBe(true);
        expect(route.cleanSearch).toBe('category=sorvetes&campaign=oct');
    });

    it('does not force a return to the customer area from ordinary product links', () => {
        expect(resolveCustomerProductDeepLink('?product=missing', [], true)
            .shouldReturnToConsumption).toBe(false);
    });

    it('ignores returnTo when there is no product ID', () => {
        expect(resolveCustomerProductDeepLink('?returnTo=consumption', [], true)
            .shouldReturnToConsumption).toBe(false);
    });
});
