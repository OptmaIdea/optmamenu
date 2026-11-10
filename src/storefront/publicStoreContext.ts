export type PublicStoreContextType = 'remote' | 'table';
export type RemoteFulfillmentType = 'pickup' | 'delivery';
export type TableFulfillmentType = 'table';
export type PublicFulfillmentType = RemoteFulfillmentType | TableFulfillmentType;

export interface PublicStoreRouteContext {
    type: PublicStoreContextType;
    requestedSlug: string;
    canonicalSlug?: string;
    tableCode?: string;
    allowedFulfillmentTypes: readonly PublicFulfillmentType[];
}

export interface ResolvePublicStoreContextInput {
    storeSlug?: string | null;
    tableCode?: string | null;
}

const REMOTE_FULFILLMENT_TYPES = ['pickup', 'delivery'] as const;
const TABLE_FULFILLMENT_TYPES = ['table'] as const;

/**
 * Derives the public storefront context strictly from the route parameters.
 *
 * Remote slugs support pickup and delivery. QR/table routes support only the
 * table flow, preventing delivery and pickup state from leaking into a table
 * order before the dedicated V2 checkout is mounted.
 */
export function resolvePublicStoreContext(
    input: ResolvePublicStoreContextInput,
): PublicStoreRouteContext | null {
    const requestedSlug = input.storeSlug?.trim();
    if (!requestedSlug) return null;

    const tableCode = input.tableCode?.trim();

    if (tableCode) {
        return {
            type: 'table',
            requestedSlug,
            tableCode,
            allowedFulfillmentTypes: TABLE_FULFILLMENT_TYPES,
        };
    }

    return {
        type: 'remote',
        requestedSlug,
        allowedFulfillmentTypes: REMOTE_FULFILLMENT_TYPES,
    };
}

export function isFulfillmentAllowed(
    context: PublicStoreRouteContext,
    fulfillmentType: PublicFulfillmentType,
): boolean {
    return context.allowedFulfillmentTypes.includes(fulfillmentType);
}

export function withCanonicalSlug(
    context: PublicStoreRouteContext,
    canonicalSlug?: string | null,
): PublicStoreRouteContext {
    const normalizedCanonicalSlug = canonicalSlug?.trim();

    if (!normalizedCanonicalSlug) return context;

    return {
        ...context,
        canonicalSlug: normalizedCanonicalSlug,
    };
}

export function getCanonicalStorePath(context: PublicStoreRouteContext): string {
    const slug = encodeURIComponent(context.canonicalSlug || context.requestedSlug);

    if (context.type === 'table' && context.tableCode) {
        return `/mesa/${slug}/${encodeURIComponent(context.tableCode)}`;
    }

    return `/s/${slug}`;
}
