import { describe, expect, it } from 'vitest';
import {
    getCanonicalStorePath,
    isFulfillmentAllowed,
    resolvePublicStoreContext,
    withCanonicalSlug,
} from '@/storefront/publicStoreContext';

describe('publicStoreContext', () => {
    it('creates a remote context with pickup and delivery only', () => {
        const context = resolvePublicStoreContext({ storeSlug: 'gelinharessjn' });

        expect(context).toEqual({
            type: 'remote',
            requestedSlug: 'gelinharessjn',
            allowedFulfillmentTypes: ['pickup', 'delivery'],
        });
        expect(context && isFulfillmentAllowed(context, 'pickup')).toBe(true);
        expect(context && isFulfillmentAllowed(context, 'delivery')).toBe(true);
        expect(context && isFulfillmentAllowed(context, 'table')).toBe(false);
    });

    it('creates a table context that does not accept pickup or delivery', () => {
        const context = resolvePublicStoreContext({
            storeSlug: 'gelinharessjn',
            tableCode: 'MESA-01',
        });

        expect(context).toEqual({
            type: 'table',
            requestedSlug: 'gelinharessjn',
            tableCode: 'MESA-01',
            allowedFulfillmentTypes: ['table'],
        });
        expect(context && isFulfillmentAllowed(context, 'table')).toBe(true);
        expect(context && isFulfillmentAllowed(context, 'pickup')).toBe(false);
        expect(context && isFulfillmentAllowed(context, 'delivery')).toBe(false);
    });

    it('returns null when the route does not contain a store slug', () => {
        expect(resolvePublicStoreContext({ storeSlug: '   ' })).toBeNull();
        expect(resolvePublicStoreContext({})).toBeNull();
    });

    it('uses the canonical slug without losing the table context', () => {
        const context = resolvePublicStoreContext({
            storeSlug: 'slug-antiga',
            tableCode: 'A-2',
        });

        expect(context).not.toBeNull();
        if (!context) return;

        const canonicalContext = withCanonicalSlug(context, 'slug-atual');

        expect(getCanonicalStorePath(canonicalContext)).toBe('/mesa/slug-atual/A-2');
        expect(canonicalContext.requestedSlug).toBe('slug-antiga');
        expect(canonicalContext.canonicalSlug).toBe('slug-atual');
    });

    it('builds the short canonical path for remote storefronts', () => {
        const context = resolvePublicStoreContext({ storeSlug: 'loja teste' });

        expect(context).not.toBeNull();
        if (!context) return;

        expect(getCanonicalStorePath(context)).toBe('/s/loja%20teste');
    });
});
