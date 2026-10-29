import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, PriceRule, Category } from '@/types';
import { getPriceForQuantity } from '@/utils/pricing';

export type PublicCartContextType = 'remote' | 'table';
export type PublicCartFulfillmentType = 'pickup' | 'delivery' | 'table';

export interface PublicCartContext {
    storeId: string;
    requestedSlug: string;
    canonicalSlug: string;
    type: PublicCartContextType;
    tableCode?: string;
}

type CategoryPricingRule = {
    type: string;
    rules: PriceRule[];
    volumeScope: 'combined' | 'per_product';
    categoryName: string;
    pricingGroup?: {
        id: string;
        name: string;
        type: string;
        rules: PriceRule[];
        categoryNames: string[];
    };
};

function getProductOnlineLimit(product: Product) {
    const rawLimit = product.public_availability?.availableOnline ?? product.stock_quantity;
    const limit = Math.floor(Number(rawLimit));
    return Number.isFinite(limit) ? Math.max(0, limit) : null;
}

function clampCartQuantity(product: Product, quantity: number) {
    const normalizedQuantity = Math.max(0, Math.trunc(Number(quantity) || 0));
    const limit = getProductOnlineLimit(product);
    return limit === null ? normalizedQuantity : Math.min(normalizedQuantity, limit);
}

interface CartState {
    schemaVersion: 2;
    context: PublicCartContext | null;
    fulfillmentType: PublicCartFulfillmentType | null;
    deliveryMethodCode: string | null;
    items: CartItem[];
    isCartOpen: boolean;
    categoryRules: Record<string, CategoryPricingRule>;
    bindContext: (context: PublicCartContext) => { changedStore: boolean; changedContext: boolean };
    setFulfillment: (type: PublicCartFulfillmentType, deliveryMethodCode?: string | null) => void;
    setCategoryRules: (categories: Category[]) => void;
    syncCatalogPricing: (categories: Category[], products: Product[]) => void;
    addToCart: (product: Product, quantity: number) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    resetCartContext: () => void;
    total: () => number;
    openCart: () => void;
    closeCart: () => void;
    toggleCart: () => void;
}

function buildCategoryRules(categories: Category[]) {
    const pricingGroupCategoryNames = categories.reduce((acc, category) => {
        if (
            category.use_pricing_group_rules
            && category.pricing_group?.active
            && category.pricing_group.price_rules?.length
        ) {
            const names = acc.get(category.pricing_group.id) || [];
            if (!names.includes(category.name)) names.push(category.name);
            acc.set(category.pricing_group.id, names);
        }
        return acc;
    }, new Map<string, string[]>());

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
                categoryName: cat.name,
                pricingGroup:
                    cat.use_pricing_group_rules &&
                    cat.pricing_group?.active &&
                    cat.pricing_group.price_rules?.length
                        ? {
                            id: cat.pricing_group.id,
                            name: cat.pricing_group.name,
                            type: cat.pricing_group.price_logic_type,
                            rules: cat.pricing_group.price_rules,
                            categoryNames: pricingGroupCategoryNames.get(cat.pricing_group.id) || [cat.name],
                        }
                        : undefined,
            };
        }
        return acc;
    }, {} as Record<string, CategoryPricingRule>);
}

function sameCartContext(current: PublicCartContext | null, next: PublicCartContext) {
    if (!current) return false;

    return current.storeId === next.storeId
        && current.type === next.type
        && (current.tableCode || null) === (next.tableCode || null);
}

function defaultFulfillmentForContext(context: PublicCartContext): PublicCartFulfillmentType {
    return context.type === 'table' ? 'table' : 'pickup';
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            schemaVersion: 2,
            context: null,
            fulfillmentType: null,
            deliveryMethodCode: null,
            items: [],
            isCartOpen: false,
            categoryRules: {},

            bindContext: (context) => {
                const current = get().context;
                const changedStore = Boolean(current && current.storeId !== context.storeId);
                const changedContext = Boolean(current && !sameCartContext(current, context));

                set((state) => {
                    if (!current || sameCartContext(current, context)) {
                        return {
                            context,
                            fulfillmentType: state.fulfillmentType || defaultFulfillmentForContext(context),
                        };
                    }

                    return {
                        context,
                        fulfillmentType: defaultFulfillmentForContext(context),
                        deliveryMethodCode: null,
                        items: [],
                        categoryRules: {},
                        isCartOpen: false,
                    };
                });

                return { changedStore, changedContext };
            },

            setFulfillment: (type, deliveryMethodCode = null) => set((state) => {
                if (state.context?.type === 'table' && type !== 'table') return state;
                if (state.context?.type === 'remote' && type === 'table') return state;

                return {
                    fulfillmentType: type,
                    deliveryMethodCode,
                };
            }),

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
                const hydratedItems = state.items
                    .map((item) => {
                        const currentProduct = productMap.get(item.id);
                        if (!currentProduct) return item;

                        return {
                            ...item,
                            ...currentProduct,
                            quantity: clampCartQuantity(currentProduct, item.quantity),
                            originalPrice: Number(currentProduct.price || 0),
                        } as CartItem;
                    })
                    .filter((item) => item.quantity > 0);

                return {
                    categoryRules,
                    items: recalculatePrices(hydratedItems, categoryRules),
                };
            }),

            addToCart: (product, quantity) => set((state) => {
                const safeQuantity = Math.max(1, Math.trunc(Number(quantity) || 1));
                const newItems = [...state.items];
                const existingItemIndex = newItems.findIndex(item => item.id === product.id);

                if (existingItemIndex > -1) {
                    const nextQuantity = clampCartQuantity(product, newItems[existingItemIndex].quantity + safeQuantity);
                    if (nextQuantity <= 0) {
                        newItems.splice(existingItemIndex, 1);
                    } else {
                        newItems[existingItemIndex] = {
                            ...newItems[existingItemIndex],
                            ...product,
                            quantity: nextQuantity,
                            originalPrice: Number(product.price || 0),
                        };
                    }
                } else {
                    const nextQuantity = clampCartQuantity(product, safeQuantity);
                    if (nextQuantity > 0) {
                        newItems.push({
                            ...product,
                            quantity: nextQuantity,
                            originalPrice: Number(product.price || 0),
                        });
                    }
                }

                return { items: recalculatePrices(newItems, state.categoryRules) };
            }),

            removeFromCart: (productId) => set((state) => {
                const newItems = state.items.filter(item => item.id !== productId);
                return { items: recalculatePrices(newItems, state.categoryRules) };
            }),

            updateQuantity: (productId, quantity) => set((state) => {
                const newItems = state.items
                    .map(item => item.id === productId ? { ...item, quantity: clampCartQuantity(item, quantity) } : item)
                    .filter(item => item.quantity > 0);
                return { items: recalculatePrices(newItems, state.categoryRules) };
            }),

            clearCart: () => set({ items: [], isCartOpen: false }),
            resetCartContext: () => set({
                context: null,
                fulfillmentType: null,
                deliveryMethodCode: null,
                items: [],
                categoryRules: {},
                isCartOpen: false,
            }),
            total: () => get().items.reduce((acc, item) => acc + (item.price * item.quantity), 0),
            openCart: () => set({ isCartOpen: true }),
            closeCart: () => set({ isCartOpen: false }),
            toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
        }),
        {
            name: 'optma-cart',
            version: 2,
            partialize: (state) => ({
                schemaVersion: state.schemaVersion,
                context: state.context,
                fulfillmentType: state.fulfillmentType,
                deliveryMethodCode: state.deliveryMethodCode,
                items: state.items,
                categoryRules: state.categoryRules,
            }),
            migrate: (persistedState) => {
                const persisted = persistedState as Partial<CartState> | undefined;
                return {
                    schemaVersion: 2 as const,
                    context: persisted?.context || null,
                    fulfillmentType: persisted?.fulfillmentType || null,
                    deliveryMethodCode: persisted?.deliveryMethodCode || null,
                    items: persisted?.items || [],
                    categoryRules: persisted?.categoryRules || {},
                };
            },
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
