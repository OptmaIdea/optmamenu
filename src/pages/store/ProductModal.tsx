import { Heart, MessageSquare, Star, X } from 'lucide-react';
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
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const pricingPreview = useMemo(() => {
        if (!product) {
            return {
                baseUnitPrice: 0,
                appliedUnitPrice: 0,
                projectedPricingQuantity: quantity,
                lineBaseTotal: 0,
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
            projectedPricingQuantity = pricingQuantity;
            appliedUnitPrice = getPriceForQuantity(product.price_rules, pricingQuantity) ?? baseUnitPrice;

            if (pricingQuantity > 1) {
                message = `Preço calculado com ${pricingQuantity} unidade(s) deste produto.`;
            }
        }

        const lineBaseTotal = baseUnitPrice * quantity;
        const lineTotal = appliedUnitPrice * quantity;
        const discount = Math.max(0, lineBaseTotal - lineTotal);

        return {
            baseUnitPrice,
            appliedUnitPrice,
            projectedPricingQuantity,
            lineBaseTotal,
            lineTotal,
            discount,
            message,
        };
    }, [cartItems, categoryRules, product, quantity]);

    if (!isVisible && !isOpen) return null;

    const rating = product?.rating_avg || '5.0';
    const hasDiscount = pricingPreview.discount > 0.009;

    const handleAddToCart = () => {
        if (!product) return;
        onAddToCart(product, quantity);
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className={`fixed bottom-0 left-0 right-0 md:inset-0 md:m-auto md:max-w-xl md:h-fit max-h-[90vh] md:max-h-[85vh] bg-white dark:bg-slate-800 rounded-t-[2.5rem] md:rounded-[2.5rem] flex flex-col overflow-hidden transition-all duration-300 ease-out shadow-2xl ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full md:translate-y-0 md:scale-95 md:opacity-0'}`}>
                <div className="relative h-64 md:h-80 bg-gray-50 dark:bg-slate-700 flex flex-col justify-center p-6 shrink-0 text-center">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-2 rounded-full z-10 text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-100"
                        aria-label="Fechar detalhes do produto"
                    >
                        <X size={20} />
                    </button>

                    {product && images.length > 0 && (
                        <div className="h-full flex items-center justify-center relative group">
                            {images.length > 1 && (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setCurrentImageIndex((previous) => previous === 0 ? images.length - 1 : previous - 1);
                                    }}
                                    className="absolute left-0 p-2 bg-white/50 hover:bg-white rounded-full shadow-sm text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Imagem anterior"
                                >
                                    <span aria-hidden="true">‹</span>
                                </button>
                            )}

                            <img
                                src={images[currentImageIndex]}
                                alt={product.name}
                                className="h-full object-contain drop-shadow-xl transition-all duration-300"
                            />

                            {images.length > 1 && (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setCurrentImageIndex((previous) => (previous + 1) % images.length);
                                    }}
                                    className="absolute right-0 p-2 bg-white/50 hover:bg-white rounded-full shadow-sm text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Próxima imagem"
                                >
                                    <span aria-hidden="true">›</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {images.length > 1 && (
                    <div className="px-6 py-2 flex gap-2 overflow-x-auto scrollbar-hide bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                        {images.map((image, index) => (
                            <button
                                type="button"
                                key={`${image}-${index}`}
                                onClick={() => setCurrentImageIndex(index)}
                                className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${currentImageIndex === index ? 'border-brand-green opacity-100 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                aria-label={`Ver imagem ${index + 1}`}
                            >
                                <img src={image} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}

                <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase leading-tight mr-2">
                            {product?.name}
                        </h2>
                        <button type="button" className="text-gray-300 hover:text-red-500 transition shrink-0" aria-label="Favoritar produto">
                            <Heart size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 mb-6">
                        <div className="flex text-yellow-400" aria-hidden="true">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} size={14} fill="currentColor" />
                            ))}
                        </div>
                        <span className="text-xs font-bold text-gray-400">{rating} (12 avaliações)</span>
                    </div>

                    <p className="text-gray-500 dark:text-gray-300 leading-relaxed mb-6 text-base">
                        {product?.description || 'Uma explosão de sabor refrescante feita com ingredientes selecionados.'}
                    </p>

                    <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
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
                                Preço original do item: R$ {formatBRL(pricingPreview.baseUnitPrice)}
                            </p>
                        )}

                        {pricingPreview.message && (
                            <p className="mt-2 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
                                {pricingPreview.message}
                            </p>
                        )}
                    </section>

                    <div className="mt-5 space-y-3">
                        <h4 className="font-bold flex items-center gap-2 tracking-tight text-gray-700 dark:text-gray-300 text-xs uppercase">
                            <MessageSquare size={14} /> Quem provou, amou
                        </h4>
                        <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-2xl border-l-4 border-green-400 italic text-sm text-gray-600 dark:text-gray-300">
                            “Incrível! Super refrescante e o atendimento no Whats é 10.”
                        </div>
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-3 mt-auto safe-area-bottom">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-xl p-1 h-12">
                            <button
                                type="button"
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-green-600 active:scale-90 transition"
                                aria-label="Diminuir quantidade"
                            >
                                <span className="text-2xl leading-none">−</span>
                            </button>
                            <span className="w-8 text-center font-bold text-gray-800 dark:text-white text-lg">{quantity}</span>
                            <button
                                type="button"
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-green-600 active:scale-90 transition"
                                aria-label="Aumentar quantidade"
                            >
                                <span className="text-2xl leading-none">+</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleAddToCart}
                            className="flex-1 bg-brand-green hover:bg-green-600 text-white font-black min-h-12 rounded-xl shadow-lg shadow-green-200 dark:shadow-none active:scale-95 transition flex items-center justify-between gap-3 px-5 uppercase tracking-tight text-sm md:text-base"
                        >
                            <span>Adicionar {quantity}</span>
                            <span>R$ {formatBRL(pricingPreview.lineTotal)}</span>
                        </button>
                    </div>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        O valor final será confirmado pelo sistema ao adicionar e novamente antes de concluir o pedido.
                    </p>
                </div>
            </div>
        </div>
    );
}
