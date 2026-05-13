import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '@/store/useCartStore'
import type { Product, Category } from '@/types'

// Helper: create a mock product
function mockProduct(overrides: Partial<Product> = {}): Product {
    return {
        id: 'prod-1',
        category_id: 'cat-1',
        name: 'Picolé de Açaí',
        price: 5.0,
        images: [],
        featured: false,
        sales_count: 0,
        stock_quantity: 100,
        rating_avg: 0,
        review_count: 0,
        active: true,
        ...overrides,
    }
}

// Helper: create a mock category with volume pricing
function mockVolumeCategory(overrides: Partial<Category> = {}): Category {
    return {
        id: 'cat-1',
        name: 'Picolés',
        sort_order: 0,
        price_logic_type: 'category_volume',
        price_rules: [
            { min: 1, price: 5.0 },
            { min: 5, price: 4.5 },
            { min: 10, price: 4.0 },
        ],
        ...overrides,
    }
}

describe('useCartStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        useCartStore.setState({ items: [], categoryRules: {}, isCartOpen: false })
    })

    // ─── Basic Cart Operations ───────────────────────────────────────

    describe('basic operations', () => {
        it('should start with an empty cart', () => {
            const { items } = useCartStore.getState()
            expect(items).toEqual([])
        })

        it('should add an item to the cart', () => {
            const product = mockProduct()
            useCartStore.getState().addToCart(product, 2)

            const { items } = useCartStore.getState()
            expect(items).toHaveLength(1)
            expect(items[0].id).toBe('prod-1')
            expect(items[0].quantity).toBe(2)
        })

        it('should increment quantity when adding the same product', () => {
            const product = mockProduct()
            useCartStore.getState().addToCart(product, 2)
            useCartStore.getState().addToCart(product, 3)

            const { items } = useCartStore.getState()
            expect(items).toHaveLength(1)
            expect(items[0].quantity).toBe(5)
        })

        it('should remove an item from the cart', () => {
            const product = mockProduct()
            useCartStore.getState().addToCart(product, 1)
            useCartStore.getState().removeFromCart('prod-1')

            const { items } = useCartStore.getState()
            expect(items).toHaveLength(0)
        })

        it('should update quantity of an item', () => {
            const product = mockProduct()
            useCartStore.getState().addToCart(product, 1)
            useCartStore.getState().updateQuantity('prod-1', 7)

            const { items } = useCartStore.getState()
            expect(items[0].quantity).toBe(7)
        })

        it('should clear all items', () => {
            useCartStore.getState().addToCart(mockProduct({ id: 'p1' }), 2)
            useCartStore.getState().addToCart(mockProduct({ id: 'p2', name: 'Sorvete' }), 1)
            useCartStore.getState().clearCart()

            const { items } = useCartStore.getState()
            expect(items).toHaveLength(0)
        })
    })

    // ─── Total Calculation ───────────────────────────────────────────

    describe('total()', () => {
        it('should calculate total correctly for a single item', () => {
            useCartStore.getState().addToCart(mockProduct({ price: 10.0 }), 3)

            const total = useCartStore.getState().total()
            expect(total).toBeCloseTo(30.0)
        })

        it('should calculate total correctly for multiple items', () => {
            useCartStore.getState().addToCart(mockProduct({ id: 'p1', price: 5.0 }), 2)
            useCartStore.getState().addToCart(mockProduct({ id: 'p2', price: 8.5 }), 1)

            const total = useCartStore.getState().total()
            // 5.0 * 2 + 8.5 * 1 = 18.5
            expect(total).toBeCloseTo(18.5)
        })

        it('should return 0 for empty cart', () => {
            const total = useCartStore.getState().total()
            expect(total).toBe(0)
        })
    })

    // ─── Volume Pricing (category_volume) ────────────────────────────

    describe('volume pricing rules', () => {
        beforeEach(() => {
            // Set up category volume rules: 1+ = R$5, 5+ = R$4.50, 10+ = R$4
            useCartStore.getState().setCategoryRules([mockVolumeCategory()])
        })

        it('should apply base price for quantity < 5', () => {
            useCartStore.getState().addToCart(mockProduct({ price: 5.0 }), 3)

            const { items } = useCartStore.getState()
            expect(items[0].price).toBeCloseTo(5.0)
        })

        it('should apply discount price for quantity >= 5', () => {
            useCartStore.getState().addToCart(mockProduct({ price: 5.0 }), 5)

            const { items } = useCartStore.getState()
            expect(items[0].price).toBeCloseTo(4.5)
        })

        it('should apply best discount for quantity >= 10', () => {
            useCartStore.getState().addToCart(mockProduct({ price: 5.0 }), 10)

            const { items } = useCartStore.getState()
            expect(items[0].price).toBeCloseTo(4.0)
        })

        it('should aggregate quantities across products in the same category', () => {
            // Two different products, same category cat-1
            // Combined quantity: 3 + 3 = 6 → should trigger 5+ rule (R$4.50)
            useCartStore.getState().addToCart(mockProduct({ id: 'p1', price: 5.0 }), 3)
            useCartStore.getState().addToCart(mockProduct({ id: 'p2', name: 'Picolé de Manga', price: 5.0 }), 3)

            const { items } = useCartStore.getState()
            expect(items[0].price).toBeCloseTo(4.5)
            expect(items[1].price).toBeCloseTo(4.5)
        })

        it('should recalculate prices when removing items drops below threshold', () => {
            // Add 6 items (triggers R$4.50 rule), then remove 2 → 4 items (back to R$5.00)
            useCartStore.getState().addToCart(mockProduct({ id: 'p1', price: 5.0 }), 4)
            useCartStore.getState().addToCart(mockProduct({ id: 'p2', name: 'Picolé de Manga', price: 5.0 }), 2)

            // At this point, total qty = 6, price should be R$4.50
            expect(useCartStore.getState().items[0].price).toBeCloseTo(4.5)

            // Remove p2 → total qty = 4 → should revert to R$5.00
            useCartStore.getState().removeFromCart('p2')
            expect(useCartStore.getState().items[0].price).toBeCloseTo(5.0)
        })

        it('should not apply volume pricing to products without category rules', () => {
            const noCategoryProduct = mockProduct({ id: 'p-no-cat', category_id: 'cat-99', price: 7.0 })
            useCartStore.getState().addToCart(noCategoryProduct, 10)

            const { items } = useCartStore.getState()
            // No rules for cat-99, price should stay at original
            expect(items[0].price).toBeCloseTo(7.0)
        })

        it('should correctly calculate total with volume pricing applied', () => {
            // 10 items × R$4.00 (10+ rule) = R$40.00
            useCartStore.getState().addToCart(mockProduct({ price: 5.0 }), 10)

            const total = useCartStore.getState().total()
            expect(total).toBeCloseTo(40.0)
        })
    })

    // ─── Cart UI State ───────────────────────────────────────────────

    describe('cart UI state', () => {
        it('should open and close the cart', () => {
            useCartStore.getState().openCart()
            expect(useCartStore.getState().isCartOpen).toBe(true)

            useCartStore.getState().closeCart()
            expect(useCartStore.getState().isCartOpen).toBe(false)
        })

        it('should toggle the cart', () => {
            useCartStore.getState().toggleCart()
            expect(useCartStore.getState().isCartOpen).toBe(true)

            useCartStore.getState().toggleCart()
            expect(useCartStore.getState().isCartOpen).toBe(false)
        })
    })
})
