import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '@/store/useCartStore'
import type { Product, Category } from '@/types'

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
        use_category_pricing: true,
        ...overrides,
    }
}

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
        useCartStore.setState({ items: [], categoryRules: {}, isCartOpen: false })
    })

    describe('basic operations', () => {
        it('should start with an empty cart', () => {
            expect(useCartStore.getState().items).toEqual([])
        })

        it('should add an item to the cart', () => {
            useCartStore.getState().addToCart(mockProduct(), 2)
            const { items } = useCartStore.getState()
            expect(items).toHaveLength(1)
            expect(items[0].id).toBe('prod-1')
            expect(items[0].quantity).toBe(2)
        })

        it('should increment quantity when adding the same product', () => {
            const product = mockProduct()
            useCartStore.getState().addToCart(product, 2)
            useCartStore.getState().addToCart(product, 3)
            expect(useCartStore.getState().items[0].quantity).toBe(5)
        })

        it('should remove an item from the cart', () => {
            useCartStore.getState().addToCart(mockProduct(), 1)
            useCartStore.getState().removeFromCart('prod-1')
            expect(useCartStore.getState().items).toHaveLength(0)
        })

        it('should update quantity of an item', () => {
            useCartStore.getState().addToCart(mockProduct(), 1)
            useCartStore.getState().updateQuantity('prod-1', 7)
            expect(useCartStore.getState().items[0].quantity).toBe(7)
        })

        it('should clear all items', () => {
            useCartStore.getState().addToCart(mockProduct({ id: 'p1' }), 2)
            useCartStore.getState().addToCart(mockProduct({ id: 'p2', name: 'Sorvete' }), 1)
            useCartStore.getState().clearCart()
            expect(useCartStore.getState().items).toHaveLength(0)
        })
    })

    describe('total()', () => {
        it('should calculate total correctly for a single item', () => {
            useCartStore.getState().addToCart(mockProduct({ price: 10.0, use_category_pricing: false }), 3)
            expect(useCartStore.getState().total()).toBeCloseTo(30.0)
        })

        it('should calculate total correctly for multiple items', () => {
            useCartStore.getState().addToCart(mockProduct({ id: 'p1', price: 5.0, use_category_pricing: false }), 2)
            useCartStore.getState().addToCart(mockProduct({ id: 'p2', price: 8.5, use_category_pricing: false }), 1)
            expect(useCartStore.getState().total()).toBeCloseTo(18.5)
        })

        it('should return 0 for empty cart', () => {
            expect(useCartStore.getState().total()).toBe(0)
        })
    })

    describe('volume pricing rules', () => {
        beforeEach(() => {
            useCartStore.getState().setCategoryRules([mockVolumeCategory()])
        })

        it('should apply base price for quantity below the next tier', () => {
            useCartStore.getState().addToCart(mockProduct({ price: 5.0 }), 3)
            expect(useCartStore.getState().items[0].price).toBeCloseTo(5.0)
        })

        it('should apply discount price for quantity >= 5', () => {
            useCartStore.getState().addToCart(mockProduct({ price: 5.0 }), 5)
            expect(useCartStore.getState().items[0].price).toBeCloseTo(4.5)
        })

        it('should apply best discount for quantity >= 10', () => {
            useCartStore.getState().addToCart(mockProduct({ price: 5.0 }), 10)
            expect(useCartStore.getState().items[0].price).toBeCloseTo(4.0)
        })

        it('should aggregate quantities across products in the same category', () => {
            useCartStore.getState().addToCart(mockProduct({ id: 'p1', price: 5.0 }), 3)
            useCartStore.getState().addToCart(mockProduct({ id: 'p2', name: 'Picolé de Manga', price: 5.0 }), 3)

            const { items } = useCartStore.getState()
            expect(items[0].price).toBeCloseTo(4.5)
            expect(items[1].price).toBeCloseTo(4.5)
        })

        it('should apply the same category tier to 7 units of one product plus 1 of another', () => {
            useCartStore.getState().setCategoryRules([
                mockVolumeCategory({
                    price_rules: [
                        { min: 1, price: 3.75 },
                        { min: 8, price: 3.25 },
                        { min: 15, price: 2.8 },
                        { min: 25, price: 2.6 },
                    ],
                }),
            ])

            useCartStore.getState().addToCart(mockProduct({ id: 'chiclete', name: 'Chiclete', price: 3.75 }), 7)
            useCartStore.getState().addToCart(mockProduct({ id: 'chocolate', name: 'Chocolate', price: 3.75 }), 1)

            const { items } = useCartStore.getState()
            expect(items[0].price).toBeCloseTo(3.25)
            expect(items[1].price).toBeCloseTo(3.25)
            expect(useCartStore.getState().total()).toBeCloseTo(26)
        })

        it('should recalculate prices when removing items drops below threshold', () => {
            useCartStore.getState().addToCart(mockProduct({ id: 'p1', price: 5.0 }), 4)
            useCartStore.getState().addToCart(mockProduct({ id: 'p2', name: 'Picolé de Manga', price: 5.0 }), 2)
            expect(useCartStore.getState().items[0].price).toBeCloseTo(4.5)

            useCartStore.getState().removeFromCart('p2')
            expect(useCartStore.getState().items[0].price).toBeCloseTo(5.0)
        })

        it('should not apply category pricing when the product opts out', () => {
            useCartStore.getState().addToCart(mockProduct({
                id: 'own-price',
                price: 7.0,
                use_category_pricing: false,
            }), 10)

            expect(useCartStore.getState().items[0].price).toBeCloseTo(7.0)
        })

        it('should not apply volume pricing to products without category rules', () => {
            useCartStore.getState().addToCart(mockProduct({
                id: 'p-no-cat',
                category_id: 'cat-99',
                price: 7.0,
            }), 10)

            expect(useCartStore.getState().items[0].price).toBeCloseTo(7.0)
        })
    })

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
