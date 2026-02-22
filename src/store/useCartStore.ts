import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, PriceRule, Category } from '@/types';
import { getPriceForQuantity } from '@/utils/pricing';

interface CartState {
    items: CartItem[];
    isCartOpen: boolean;
    categoryRules: Record<string, { type: string, rules: PriceRule[] }>;
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
                            rules: cat.price_rules
                        };
                    }
                    return acc;
                }, {} as Record<string, { type: string, rules: PriceRule[] }>)
            }),

            addToCart: (product, quantity) => set((state) => {
                let newItems = [...state.items];
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
                const newItems = state.items.map(item =>
                    item.id === productId ? { ...item, quantity } : item
                );
                return { items: recalculatePrices(newItems, state.categoryRules) };
            }),

            clearCart: () => set({ items: [] }),
            total: () => {
                return get().items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            },
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

// Helper to recalculate prices based on category rules
function recalculatePrices(items: CartItem[], categoryRules: Record<string, { type: string, rules: PriceRule[] }>): CartItem[] {
    // 1. Calculate totals per category
    const categoryTotals: Record<string, number> = {};
    items.forEach(item => {
        if (item.category_id) {
            categoryTotals[item.category_id] = (categoryTotals[item.category_id] || 0) + item.quantity;
        }
    });

    // 2. Apply rules
    return items.map(item => {
        // Only apply category pricing when this product is configured to inherit it.
        if (!item.use_category_pricing) {
            return { ...item, price: item.originalPrice || item.price };
        }

        if (!item.category_id || !categoryRules[item.category_id]) {
            return { ...item, price: item.originalPrice || item.price };
        }

        const logic = categoryRules[item.category_id];

        if (logic.type === 'category_volume') {
            const totalQty = categoryTotals[item.category_id];
            const newPrice = getPriceForQuantity(logic.rules, totalQty);
            if (typeof newPrice === 'number') return { ...item, price: newPrice };
        }

        // Preço único (standard): usa a regra min=0 (ou a menor min) como valor fixo
        if (logic.type === 'standard' && Array.isArray(logic.rules) && logic.rules.length > 0) {
            const newPrice = getPriceForQuantity(logic.rules, 1);
            if (typeof newPrice === 'number') return { ...item, price: newPrice };
        }

        // Fallback to original price if no rule met or not category pricing
// Fallback to original price if no rule met or not volume logic
        return { ...item, price: item.originalPrice || item.price };
    });
}
