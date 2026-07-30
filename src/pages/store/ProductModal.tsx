import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@/types';
import { useCartStore } from '@/store/useCartStore';
import { formatBRL, getPriceForQuantity } from '@/utils/pricing';

interface ProductModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    onAddToCart: (product: Product, quantity: number) => void;
}

export function ProductModal({ product, isOpen, onClose, onAddToCart }: ProductModalProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const categoryRules = useCartStore((state) => state.categoryRules);
    const cartItems = useCartStore((state) => state.items);

    const images = product
        ? (Array.isArray(product.images) && product.images.length > 0
            ? product.images
            : [product.image_url || 'https://via.placeholder.com/300'])
        : [];

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setQuantity(1);
            setCurrentImageIndex(0);
            return;
        }

        const timer = window.setTimeout(() => setIsVisible(false), 300);
        return () => window.clearTimeout(timer);
    }, [isOpen]);

    const pricingPreview = useMemo(() => {
        if (!product) {
            return {
                baseUnitPrice: 0,
                appliedUnitPrice: 0,
                lineTotal: 0,
                discount: 0,
                message: null as string | null,
            };
        }

        const baseUnitPrice = Number(product.price || 0);
        const existingProductQuantity = cartItems
            .filter((item) => item.id === product.id)
            .reduce((sum, item) => sum + item.quantity, 0);

        let projectedPricingQuantity = existingProductQuantity + quantity;
        let appliedUnitPrice = baseUnitPrice;
        let message: string | null = null;

        if (product.use_category_pricing && product.category_id) {
            const categoryRule = categoryRules[product.category_id];

            if (categoryRule?.pricingGroup) {
                const pricingGroupId = categoryRule.pricingGroup.id;
                const currentGroupQuantity = cartItems.reduce((sum, item) => {
                    if (!item.category_id || !item.use_category_pricing) return sum;
                    const itemRule = categoryRules[item.category_id];
                    return itemRule?.pricingGroup?.id === pricingGroupId
                        ? sum + item.quantity
                        : sum;
                }, 0);

                projectedPricingQuantity = currentGroupQuantity + quantity;
                appliedUnitPrice = getPriceForQuantity(
                    categoryRule.pricingGroup.rules,
                    projectedPricingQuantity,
                ) ?? baseUnitPrice;
                message = `Preço calculado com ${projectedPricingQuantity} item(ns) do mesmo grupo no carrinho.`;
            } else if (categoryRule?.type === 'category_volume') {
                const currentCategoryQuantity = cartItems.reduce((sum, item) => (
                    item.category_id === product.category_id && item.use_category_pricing
                        ? sum + item.quantity
                        : sum
                ), 0);

                projectedPricingQuantity = categoryRule.volumeScope === 'per_product'
                    ? existingProductQuantity + quantity
                    : currentCategoryQuantity + quantity;
                appliedUnitPrice = getPriceForQuantity(
                    categoryRule.rules,
                    projectedPricingQuantity,
                ) ?? baseUnitPrice;
                message = categoryRule.volumeScope === 'per_product'
                    ? `Preço calculado com ${projectedPricingQuantity} unidade(s) deste produto.`
                    : `Preço calculado com ${projectedPricingQuantity} item(ns) da mesma categoria no carrinho.`;
            } else if (categoryRule?.rules?.length) {
                appliedUnitPrice = getPriceForQuantity(categoryRule.rules, 1) ?? baseUnitPrice;
            }
        } else if (Array.isArray(product.price_rules) && product.price_rules.length > 0) {
            const pricingQuantity = product.price_logic_type === 'category_volume'
                ? existingProductQuantity + quantity
                : 1;
            appliedUnitPrice = getPriceForQuantity(product.price_rules, pricingQuantity) ?? baseUnitPrice;

            if (pricingQuantity > 1) {
                message = `Preço calculado com ${pricingQuantity} unidade(s) deste produto.`;
            }
        }

        const lineBaseTotal = baseUnitPrice * quantity;
        const lineTotal = appliedUnitPrice * quantity;

        return {
            baseUnitPrice,
            appliedUnitPrice,
            lineTotal,
            discount: Math.max(0, lineBaseTotal - lineTotal),
            message,
        };
    }, [cartItems, categoryRules, product, quantity]);

    if (!isVisible && !isOpen) return null;

    const hasDiscount = pricingPreview.discount > 0.009;

    const handleQuantityChange = (rawValue: string) => {
        const parsed = Number.parseInt(rawValue, 10);
        setQuantity(Number.isFinite(parsed) ? Math.max(1, parsed) : 1);
    };

    const handleAddToCart = () => {
        if (!product) return;
        onAddToCart(product, quantity);
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            <button
                type="button"
                className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Fechar detalhes do produto"
            />

            <section className={`fixed bottom-0 left-0 right-0 flex max-h-[90vh] flex-col overflow-hidden rounded-t-[2.5rem] bg-white shadow-2xl transition-all duration-300 ease-out dark:bg-slate-800 md:inset-0 md:m-auto md:h-fit md:max-h-[85vh] md:max-w-xl md:rounded-[2.5rem] ${isOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-full opacity-0 md:translate-y-0 md:scale-95'}`}>
                <div className="relative flex h-64 shrink-0 items-center justify-center bg-gray-50 p-6 text-center dark:bg-slate-700 md:h-80">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-2 text-gray-700 shadow-sm backdrop-blur hover:bg-gray-100 dark:bg-slate-900/80 dark:text-gray-200"
                        aria-label="Fechar detalhes do produto"
                    >
                        <X size={20} />
                    </button>

                    {product && images.length > 0 && (
                        <div className="relative flex h-full w-full items-center justify-center">
                            {images.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setCurrentImageIndex((previous) => previous === 0 ? images.length - 1 : previous - 1)}
                                    className="absolute left-0 rounded-full bg-white/70 px-3 py-2 text-xl text-gray-700 shadow-sm"
                                    aria-label="Imagem anterior"
                                >
                                    ‹
                                </button>
                            )}

                            <img
                                src={images[currentImageIndex]}
                                alt={product.name}
                                className="h-full object-contain drop-shadow-xl"
                            />

                            {images.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setCurrentImageIndex((previous) => (previous + 1) % images.length)}
                                    className="absolute right-0 rounded-full bg-white/70 px-3 py-2 text-xl text-gray-700 shadow-sm"
                                    aria-label="Próxima imagem"
                                >
                                    ›
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <h2 className="text-2xl font-black uppercase leading-tight text-gray-800 dark:text-white">
                        {product?.name}
                    </h2>

                    <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-300">
                        {product?.description || 'Produto disponível para personalização e inclusão no pedido.'}
                    </p>

                    <section className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                    Preço com o carrinho atual
                                </p>
                                <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">
                                    R$ {formatBRL(pricingPreview.appliedUnitPrice)} <span className="text-sm font-semibold">cada</span>
                                </p>
                            </div>

                            {hasDiscount && (
                                <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                                    Economize R$ {formatBRL(pricingPreview.discount)}
                                </span>
                            )}
                        </div>

                        {hasDiscount && (
                            <p className="mt-2 text-sm text-gray-500 line-through dark:text-gray-400">
                                Preço original: R$ {formatBRL(pricingPreview.baseUnitPrice)} cada
                            </p>
                        )}

                        {pricingPreview.message && (
                            <p className="mt-2 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
                                {pricingPreview.message}
                            </p>
                        )}
                    </section>
                </div>

                <div className="safe-area-bottom mt-auto flex flex-col gap-3 border-t border-gray-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 md:p-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex h-12 items-center rounded-xl bg-gray-100 p-1 dark:bg-slate-700">
                            <button
                                type="button"
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="flex h-full w-10 items-center justify-center text-gray-500 transition active:scale-90 hover:text-green-600"
                                aria-label="Diminuir quantidade"
                            >
                                <span className="text-2xl leading-none">−</span>
                            </button>

                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min={1}
                                step={1}
                                value={quantity}
                                onFocus={(event) => event.currentTarget.select()}
                                onClick={(event) => event.currentTarget.select()}
                                onChange={(event) => handleQuantityChange(event.target.value)}
                                className="w-12 bg-transparent text-center text-lg font-bold text-gray-800 outline-none [appearance:textfield] dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                aria-label="Quantidade do produto"
                            />

                            <button
                                type="button"
                                onClick={() => setQuantity(quantity + 1)}
                                className="flex h-full w-10 items-center justify-center text-gray-500 transition active:scale-90 hover:text-green-600"
                                aria-label="Aumentar quantidade"
                            >
                                <span className="text-2xl leading-none">+</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleAddToCart}
                            className="flex min-h-12 flex-1 items-center justify-between gap-3 rounded-xl bg-brand-green px-5 text-sm font-black uppercase tracking-tight text-white shadow-lg shadow-green-200 transition active:scale-95 hover:bg-green-600 dark:shadow-none md:text-base"
                        >
                            <span>Adicionar {quantity}</span>
                            <span>R$ {formatBRL(pricingPreview.lineTotal)}</span>
                        </button>
                    </div>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        O valor final será confirmado pelo sistema ao adicionar e novamente antes de concluir o pedido.
                    </p>
                </div>
            </section>
        </div>
    );
}
