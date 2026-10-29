/** Prevent an outdated private API response from overwriting a different account's data. */
export type ScopedCustomerIdentity = { id: string; store_id: string };
export type ScopedRequest = { customerId: string; storeId: string; generation: number };

export class LatestCustomerRequest {
    private generation = 0;

    begin(customer: ScopedCustomerIdentity): ScopedRequest {
        return {
            customerId: customer.id,
            storeId: customer.store_id,
            generation: ++this.generation,
        };
    }

    accepts(request: ScopedRequest, current: ScopedCustomerIdentity | null | undefined): boolean {
        return Boolean(current
            && request.generation === this.generation
            && request.customerId === current.id
            && request.storeId === current.store_id);
    }

    invalidate() {
        ++this.generation;
    }
}

/** The consumed order must come from the current customer-scoped orders list. */
export function resolveConsumedOrderFocus(
    orderId: string,
    knownOrderIds: readonly string[],
): string | null {
    return Boolean(orderId && knownOrderIds.includes(orderId)) ? orderId : null;
}
