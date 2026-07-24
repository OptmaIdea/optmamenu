import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, PriceRule, Category } from '@/types';
import { getPriceForQuantity } from '@/utils/pricing';

type CategoryPricingRule = {
    type: string;
    rules: PriceRule[];
    volumeScope: 'combined' | 'per_product';
    pricingGroup?: {
        id: string;
        type: string;
        rules: PriceRule[];
    };
};

interface CartState {
    items: CartItem[];
    isCartOpen: boolean;
    categoryRules: Record<string, CategoryPricingRule>;
    setCategoryRules: (categories: Category[]) => void;
    syncCatalogPricing: (categories: Category[], products: Product[]) => void;
    addToCart: (product: Product, quantity: number) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    total: () => number;
    openCart: () => void;
    closeCart: () => void;
    toggleCart: () => void;
}

function buildCategoryRules(categories: Category[]) {
    return categories.reduce((acc, cat) => {
        const hasCategoryRules = Boolean(cat.price_rules?.length);
        const hasPricingGroupRules = Boolean(
            cat.use_pricing_group_rules &&
            cat.pricing_group?.active &&
            cat.pricing_group.price_rules?.length
        );

        if (hasCategoryRules || hasPricingGroupRules) {
            acc[cat.id] = {
                type: cat.price_logic_type || 'standard',
                rules: cat.price_rules || [],
                volumeScope: cat.pricing_strategy?.volume_scope || 'combined',
                pricingGroup:
                    cat.use_pricing_group_rules &&
                    cat.pricing_group?.active &&
                    cat.pricing_group.price_rules?.length
                        ? {
                            id: cat.pricing_group.id,
                            type: cat.pricing_group.price_logic_type,
                            rules: cat.pricing_group.price_rules,
                        }
                        : undefined,
            };
        }
        return acc;
    }, {} as Record<string, CategoryPricingRule>);
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            isCartOpen: false,
            categoryRules: {},

            setCategoryRules: (categories) => set((state) => {
                const categoryRules = buildCategoryRules(categories);
                return {
                    categoryRules,
                    items: recalculatePrices(state.items, categoryRules),
                };
            }),

            syncCatalogPricing: (categories, products) => set((state) => {
                const categoryRules = buildCategoryRules(categories);
                const productMap = new Map(products.map((product) => [product.id, product]));
                const hydratedItems = state.items.map((item) => {
                    const currentProduct = productMap.get(item.id);
                    if (!currentProduct) return item;

                    return {
                        ...item,
                        ...currentProduct,
                        quantity: item.quantity,
                        originalPrice: Number(currentProduct.price || 0),
                    } as CartItem;
                });

                return {
                    categoryRules,
                    items: recalculatePrices(hydratedItems, categoryRules),
                };
            }),

            addToCart: (product, quantity) => set((state) => {
                const newItems = [...state.items];
                const existingItemIndex = newItems.findIndex(item => item.id === product.id);

                if (existingItemIndex > -1) {
                    newItems[existingItemIndex] = {
                        ...newItems[existingItemIndex],
                        ...product,
                        quantity: newItems[existingItemIndex].quantity + quantity,
                        originalPrice: Number(product.price || 0),
                    };
                } else {
                    newItems.push({
                        ...product,
                        quantity,
                        originalPrice: Number(product.price || 0),
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
    const pricingGroupTotals: Record<string, number> = {};

    items.forEach(item => {
        if (item.category_id && item.use_category_pricing) {
            categoryTotals[item.category_id] = (categoryTotals[item.category_id] || 0) + item.quantity;
            const pricingGroup = categoryRules[item.category_id]?.pricingGroup;
            if (pricingGroup) {
                pricingGroupTotals[pricingGroup.id] =
                    (pricingGroupTotals[pricingGroup.id] || 0) + item.quantity;
            }
        }
    });

    return items.map(item => {
        const originalPrice = Number(item.originalPrice || item.price || 0);

        if (!item.use_category_pricing) {
            if (item.price_logic_type === 'category_volume' && Array.isArray(item.price_rules)) {
                const productPrice = getPriceForQuantity(item.price_rules, item.quantity);
                if (typeof productPrice === 'number') {
                    return { ...item, price: productPrice, originalPrice };
                }
            }

            if (item.price_logic_type === 'standard' && Array.isArray(item.price_rules) && item.price_rules.length > 0) {
                const productPrice = getPriceForQuantity(item.price_rules, 1);
                if (typeof productPrice === 'number') {
                    return { ...item, price: productPrice, originalPrice };
                }
            }

            return { ...item, price: originalPrice, originalPrice };
        }

        if (!item.category_id) {
            return { ...item, price: originalPrice, originalPrice };
        }

        const logic = categoryRules[item.category_id];
        if (!logic) {
            return { ...item, price: originalPrice, originalPrice };
        }

        if (logic.pricingGroup?.type === 'category_volume') {
            const pricingQuantity = pricingGroupTotals[logic.pricingGroup.id] || item.quantity;
            const newPrice = getPriceForQuantity(logic.pricingGroup.rules, pricingQuantity);
            if (typeof newPrice === 'number') {
                return { ...item, price: newPrice, originalPrice };
            }
        }

        if (logic.type === 'category_volume') {
            const pricingQuantity = logic.volumeScope === 'per_product'
                ? item.quantity
                : categoryTotals[item.category_id];
            const newPrice = getPriceForQuantity(logic.rules, pricingQuantity);
            if (typeof newPrice === 'number') {
                return { ...item, price: newPrice, originalPrice };
            }
        }

        if (logic.type === 'standard' && Array.isArray(logic.rules) && logic.rules.length > 0) {
            const newPrice = getPriceForQuantity(logic.rules, 1);
            if (typeof newPrice === 'number') {
                return { ...item, price: newPrice, originalPrice };
            }
        }

        return { ...item, price: originalPrice, originalPrice };
    });
}
