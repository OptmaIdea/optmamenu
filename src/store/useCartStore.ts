import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, PriceRule, Category } from '@/types';
import { getPriceForQuantity } from '@/utils/pricing';

type CategoryPricingRule = {
    type: string;
    rules: PriceRule[];
    volumeScope: 'combined' | 'per_product';
};

interface CartState {
    items: CartItem[];
    isCartOpen: boolean;
    categoryRules: Record<string, CategoryPricingRule>;
    setCategoryRules: (categories: Category[]) => void;
    addToCart: (product: Product, quantity: number) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    total: () => number;
    openCart: () => void;
    closeCart: () => void;
    toggleCart: () => void;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            isCartOpen: false,
            categoryRules: {},

            setCategoryRules: (categories) => set({
                categoryRules: categories.reduce((acc, cat) => {
                    if (cat.price_rules && cat.price_rules.length > 0) {
                        acc[cat.id] = {
                            type: cat.price_logic_type || 'standard',
                            rules: cat.price_rules,
                            volumeScope: cat.pricing_strategy?.volume_scope || 'combined',
                        };
                    }
                    return acc;
                }, {} as Record<string, CategoryPricingRule>)
            }),

            addToCart: (product, quantity) => set((state) => {
                const newItems = [...state.items];
                const existingItemIndex = newItems.findIndex(item => item.id === product.id);

                if (existingItemIndex > -1) {
                    newItems[existingItemIndex] = {
                        ...newItems[existingItemIndex],
                        quantity: newItems[existingItemIndex].quantity + quantity
                    };
                } else {
                    newItems.push({
                        ...product,
                        quantity,
                        originalPrice: product.price
                    });
                }

                return { items: recalculatePrices(newItems, state.categoryRules) };
            }),

            removeFromCart: (productId) => set((state) => {
                const newItems = state.items.filter(item => item.id !== productId);
                return { items: recalculatePrices(newItems, state.categoryRules) };
            }),

            updateQuantity: (productId, quantity) => set((state) => {
                const newItems = state.items
                    .map(item => item.id === productId ? { ...item, quantity } : item)
                    .filter(item => item.quantity > 0);
                return { items: recalculatePrices(newItems, state.categoryRules) };
            }),

            clearCart: () => set({ items: [] }),
            total: () => get().items.reduce((acc, item) => acc + (item.price * item.quantity), 0),
            openCart: () => set({ isCartOpen: true }),
            closeCart: () => set({ isCartOpen: false }),
            toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
        }),
        {
            name: 'optma-cart',
            partialize: (state) => ({
                items: state.items,
                categoryRules: state.categoryRules,
            }),
        }
    )
);

function recalculatePrices(
    items: CartItem[],
    categoryRules: Record<string, CategoryPricingRule>,
): CartItem[] {
    const categoryTotals: Record<string, number> = {};

    items.forEach(item => {
        if (item.category_id && item.use_category_pricing) {
            categoryTotals[item.category_id] = (categoryTotals[item.category_id] || 0) + item.quantity;
        }
    });

    return items.map(item => {
        const originalPrice = item.originalPrice || item.price;

        if (!item.use_category_pricing || !item.category_id) {
            return { ...item, price: originalPrice };
        }

        const logic = categoryRules[item.category_id];
        if (!logic) {
            return { ...item, price: originalPrice };
        }

        if (logic.type === 'category_volume') {
            const pricingQuantity = logic.volumeScope === 'per_product'
                ? item.quantity
                : categoryTotals[item.category_id];
            const newPrice = getPriceForQuantity(logic.rules, pricingQuantity);
            if (typeof newPrice === 'number') return { ...item, price: newPrice };
        }

        if (logic.type === 'standard' && Array.isArray(logic.rules) && logic.rules.length > 0) {
            const newPrice = getPriceForQuantity(logic.rules, 1);
            if (typeof newPrice === 'number') return { ...item, price: newPrice };
        }

        return { ...item, price: originalPrice };
    });
}
