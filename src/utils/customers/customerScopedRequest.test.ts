import { describe, expect, it } from 'vitest';
import { LatestCustomerRequest, resolveConsumedOrderFocus } from './customerScopedRequest';

const cris = { id: 'customer-cris', store_id: 'gelinhares-id' };
const another = { id: 'customer-another', store_id: 'gelinhares-id' };
const otherStore = { id: 'customer-cris', store_id: 'other-store-id' };

describe('customer account asynchronous response isolation', () => {
    it('applies the latest response for the currently authenticated customer', () => {
        const gate = new LatestCustomerRequest();
        const issued = gate.begin(cris);
        expect(gate.accepts(issued, cris)).toBe(true);
    });
    it('rejects a response after switching to another customer in the same store', () => {
        const gate = new LatestCustomerRequest();
        const issued = gate.begin(cris);
        expect(gate.accepts(issued, another)).toBe(false);
    });
    it('rejects stale responses for another store even when a customer ID repeats', () => {
        const gate = new LatestCustomerRequest();
        const issued = gate.begin(cris);
        expect(gate.accepts(issued, otherStore)).toBe(false);
    });
    it('rejects older responses arriving after a newer refresh', () => {
        const gate = new LatestCustomerRequest();
        const old = gate.begin(cris);
        const current = gate.begin(cris);
        expect(gate.accepts(old, cris)).toBe(false);
        expect(gate.accepts(current, cris)).toBe(true);
    });
    it('rejects responses after logout or explicit invalidation', () => {
        const gate = new LatestCustomerRequest();
        const old = gate.begin(cris);
        expect(gate.accepts(old, null)).toBe(false);
        gate.invalidate();
        expect(gate.accepts(old, cris)).toBe(false);
    });
    it('is independent across orders, addresses and notifications', () => {
        const orders = new LatestCustomerRequest();
        const messages = new LatestCustomerRequest();
        const oldOrder = orders.begin(cris);
        const message = messages.begin(cris);
        orders.begin(cris);
        expect(orders.accepts(oldOrder, cris)).toBe(false);
        expect(messages.accepts(message, cris)).toBe(true);
    });
});

describe('navigate from consumption to one existing own order', () => {
    it('only focuses an order that exists in the authenticated customer list', () => {
        expect(resolveConsumedOrderFocus('order-b', ['order-a', 'order-b'])).toBe('order-b');
    });
    it('does not open unknown order ids from a URL or different customer', () => {
        expect(resolveConsumedOrderFocus('other-customer-order', ['order-a'])).toBeNull();
        expect(resolveConsumedOrderFocus('', ['order-a'])).toBeNull();
    });
});
