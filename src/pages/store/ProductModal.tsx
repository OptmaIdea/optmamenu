import { AlertTriangle, BadgePercent, ImageIcon, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PriceRule, Product } from '@/types';
import { useCartStore } from '@/store/useCartStore';
import { formatBRL, getPriceForQuantity } from '@/utils/pricing';

interface ProductModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    onAddToCart: (product: Product, quantity: number) => void;
}

type PricingScope = 'product' | 'category' | 'group' | null;

function normalizePromotionRules(rules: PriceRule[], basePrice: number) {
    return [...rules]
        .filter((rule) => Number(rule.min) > 1 && Number(rule.price) < basePrice)
        .sort((left, right) => Number(left.min) - Number(right.min));
}

export function ProductModal({ product, isOpen, onClose, onAddToCart }: ProductModalProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const categoryRules = useCartStore((state) => state.categoryRules);
    const cartItems = useCartStore((state) => state.items);

    const images = product
        ? (Array.isArray(product.images) && product.images.length > 0
            ? product.images.filter(Boolean)
            : product.image_url
                ? [product.image_url]
                : [])
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
                pricingQuantity: 1,
                scope: null as PricingScope,
                promotionRules: [] as PriceRule[],
                categoryName: null as string | null,
                groupName: null as string | null,
                participantCategories: [] as string[],
            };
        }

        const baseUnitPrice = Number(product.price || 0);
        const existingProductQuantity = cartItems
            .filter((item) => item.id === product.id)
            .reduce((sum, item) => sum + item.quantity, 0);

        let pricingQuantity = existingProductQuantity + quantity;
        let appliedUnitPrice = baseUnitPrice;
        let message: string | null = null;
        let scope: PricingScope = null;
        let rules: PriceRule[] = [];
        let categoryName: string | null = null;
        let groupName: string | null = null;
        let participantCategories: string[] = [];

        if (product.use_category_pricing && product.category_id) {
            const categoryRule = categoryRules[product.category_id];
            categoryName = categoryRule?.categoryName || null;

            if (categoryRule?.pricingGroup) {
                const pricingGroupId = categoryRule.pricingGroup.id;
                const currentGroupQuantity = cartItems.reduce((sum, item) => {
                    if (!item.category_id || !item.use_category_pricing) return sum;
                    const itemRule = categoryRules[item.category_id];
                    return itemRule?.pricingGroup?.id === pricingGroupId
                        ? sum + item.quantity
                        : sum;
                }, 0);

                pricingQuantity = currentGroupQuantity + quantity;
                rules = categoryRule.pricingGroup.rules;
                scope = 'group';
                groupName = categoryRule.pricingGroup.name;
                participantCategories = categoryRule.pricingGroup.categoryNames;
                appliedUnitPrice = getPriceForQuantity(rules, pricingQuantity) ?? baseUnitPrice;
                message = `Preço calculado com ${pricingQuantity} item(ns) das categorias participantes no carrinho.`;
            } else if (categoryRule?.type === 'category_volume') {
                const currentCategoryQuantity = cartItems.reduce((sum, item) => (
                    item.category_id === product.category_id && item.use_category_pricing
                        ? sum + item.quantity
                        : sum
                ), 0);

                pricingQuantity = categoryRule.volumeScope === 'per_product'
                    ? existingProductQuantity + quantity
                    : currentCategoryQuantity + quantity;
                rules = categoryRule.rules;
                scope = categoryRule.volumeScope === 'per_product' ? 'product' : 'category';
                participantCategories = categoryName ? [categoryName] : [];
                appliedUnitPrice = getPriceForQuantity(rules, pricingQuantity) ?? baseUnitPrice;
                message = scope === 'product'
                    ? `Preço calculado com ${pricingQuantity} unidade(s) deste produto.`
                    : `Preço calculado com ${pricingQuantity} item(ns) da categoria ${categoryName || 'participante'} no carrinho.`;
            } else if (categoryRule?.rules?.length) {
                rules = categoryRule.rules;
                appliedUnitPrice = getPriceForQuantity(rules, 1) ?? baseUnitPrice;
            }
        } else if (Array.isArray(product.price_rules) && product.price_rules.length > 0) {
            rules = product.price_rules;
            pricingQuantity = product.price_logic_type === 'category_volume'
                ? existingProductQuantity + quantity
                : 1;
            scope = product.price_logic_type === 'category_volume' ? 'product' : null;
            appliedUnitPrice = getPriceForQuantity(rules, pricingQuantity) ?? baseUnitPrice;

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
            pricingQuantity,
            scope,
            promotionRules: normalizePromotionRules(rules, baseUnitPrice),
            categoryName,
            groupName,
            participantCategories,
        };
    }, [cartItems, categoryRules, product, quantity]);

    const availabilityNotice = useMemo(() => {
        const availability = product?.public_availability;

        if (
            !availability
            || availability.status !== 'low_stock'
            || availability.displayMode === 'hidden'
        ) {
            return null;
        }

        if (
            availability.displayMode === 'exact'
            && typeof availability.availableOnline === 'number'
        ) {
            const units = Math.floor(availability.availableOnline);
            return availability.message || `Restam ${units} unidade${units === 1 ? '' : 's'} disponível${units === 1 ? '' : 'is'} para venda online.`;
        }

        return availability.message || 'Poucas unidades disponíveis para venda online.';
    }, [product]);

    if (!isVisible && !isOpen) return null;

    const hasDiscount = pricingPreview.discount > 0.009;
    const nextPromotionRule = pricingPreview.promotionRules.find(
        (rule) => Number(rule.min) > pricingPreview.pricingQuantity,
    );
    const unitsToNextPrice = nextPromotionRule
        ? Number(nextPromotionRule.min) - pricingPreview.pricingQuantity
        : 0;

    const promotionTitle = pricingPreview.scope === 'group'
        ? 'Promoção combinada entre categorias'
        : pricingPreview.scope === 'category'
            ? 'Promoção da categoria'
            : 'Compre mais, pague menos';

    const scopeLabel = pricingPreview.scope === 'group'
        ? 'A quantidade soma todos os produtos das categorias participantes desta promoção.'
        : pricingPreview.scope === 'category'
            ? `A quantidade soma os produtos participantes da categoria ${pricingPreview.categoryName || ''}.`
            : 'A quantidade considera somente este produto.';

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

            <section className={`fixed inset-x-0 top-0 flex max-h-[94dvh] flex-col overflow-hidden rounded-b-[2rem] bg-white shadow-2xl transition-all duration-300 ease-out dark:bg-slate-800 md:inset-4 md:m-auto md:h-fit md:max-h-[calc(100dvh-2rem)] md:max-w-2xl md:rounded-[2rem] ${isOpen ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-full opacity-0 md:translate-y-0 md:scale-95'}`}>
                <div className="relative flex h-56 shrink-0 items-center justify-center bg-gray-50 p-5 text-center dark:bg-slate-700 sm:h-64 md:h-72 md:p-7">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-gray-700 shadow-sm backdrop-blur hover:bg-gray-100 dark:bg-slate-900/90 dark:text-gray-200"
                        aria-label="Fechar detalhes do produto"
                    >
                        <X size={20} />
                    </button>

                    {product && images.length > 0 ? (
                        <div className="relative flex h-full w-full items-center justify-center">
                            {images.length > 1 && (
                                <button type="button" onClick={() => setCurrentImageIndex((previous) => previous === 0 ? images.length - 1 : previous - 1)} className="absolute left-0 rounded-full bg-white/80 px-3 py-2 text-xl text-gray-700 shadow-sm" aria-label="Imagem anterior">‹</button>
                            )}
                            <img src={images[currentImageIndex]} alt={product.name} className="h-full max-w-full object-contain drop-shadow-xl" />
                            {images.length > 1 && (
                                <button type="button" onClick={() => setCurrentImageIndex((previous) => (previous + 1) % images.length)} className="absolute right-0 rounded-full bg-white/80 px-3 py-2 text-xl text-gray-700 shadow-sm" aria-label="Próxima imagem">›</button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-300">
                            <ImageIcon className="h-10 w-10" aria-hidden="true" />
                            <span className="text-sm font-semibold">Imagem não cadastrada</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8">
                    <h2 className="text-2xl font-black leading-tight text-gray-800 dark:text-white">{product?.name}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-300 sm:text-base">
                        {product?.description || 'Produto disponível para personalização e inclusão no pedido.'}
                    </p>

                    {availabilityNotice && (
                        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                            <div><p className="text-sm font-bold">Disponibilidade limitada</p><p className="mt-1 text-sm leading-relaxed">{availabilityNotice}</p></div>
                        </div>
                    )}

                    <section className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:mt-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Preço com o carrinho atual</p>
                                <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">R$ {formatBRL(pricingPreview.appliedUnitPrice)} <span className="text-sm font-semibold">cada</span></p>
                            </div>
                            {hasDiscount && <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">Economia de R$ {formatBRL(pricingPreview.discount)}</span>}
                        </div>
                        {hasDiscount && <p className="mt-2 text-sm text-gray-500 line-through dark:text-gray-400">Preço original: R$ {formatBRL(pricingPreview.baseUnitPrice)} cada</p>}
                        {pricingPreview.message && <p className="mt-2 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">{pricingPreview.message}</p>}
                    </section>

                    {pricingPreview.promotionRules.length > 0 && (
                        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
                            <div className="flex items-start gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><BadgePercent className="h-5 w-5" /></span>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white">{promotionTitle}</h3>
                                    {pricingPreview.groupName && (
                                        <p className="mt-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">{pricingPreview.groupName}</p>
                                    )}
                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{scopeLabel}</p>
                                </div>
                            </div>

                            {pricingPreview.participantCategories.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {pricingPreview.scope === 'group' ? 'Categorias que somam juntas' : 'Categoria participante'}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {pricingPreview.participantCategories.map((categoryName) => (
                                            <span key={categoryName} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                {categoryName}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 space-y-2">
                                {pricingPreview.promotionRules.map((rule) => {
                                    const reached = pricingPreview.pricingQuantity >= Number(rule.min);
                                    return (
                                        <div key={`${rule.min}-${rule.price}`} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${reached ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>
                                            <span className="font-semibold">A partir de {rule.min} itens</span>
                                            <span className="font-black">R$ {formatBRL(rule.price)} cada</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {nextPromotionRule ? (
                                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                    Adicione mais {unitsToNextPrice} {unitsToNextPrice === 1 ? 'item' : 'itens'} das categorias participantes para chegar a R$ {formatBRL(nextPromotionRule.price)} cada.
                                </p>
                            ) : (
                                <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Você já alcançou a melhor faixa publicada para esta promoção.</p>
                            )}
                        </section>
                    )}
                </div>

                <div className="safe-area-bottom mt-auto flex flex-col gap-3 border-t border-gray-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:p-5 md:p-6">
                    <div className="flex items-center justify-between gap-3 sm:gap-4">
                        <div className="flex h-12 items-center rounded-xl bg-gray-100 p-1 dark:bg-slate-700">
                            <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="flex h-full w-9 items-center justify-center text-gray-500 transition active:scale-90 hover:text-green-600 sm:w-10" aria-label="Diminuir quantidade"><span className="text-2xl leading-none">−</span></button>
                            <input type="number" inputMode="numeric" pattern="[0-9]*" min={1} step={1} value={quantity} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} onChange={(event) => handleQuantityChange(event.target.value)} className="w-10 bg-transparent text-center text-lg font-bold text-gray-800 outline-none [appearance:textfield] dark:text-white sm:w-12 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" aria-label="Quantidade do produto" />
                            <button type="button" onClick={() => setQuantity(quantity + 1)} className="flex h-full w-9 items-center justify-center text-gray-500 transition active:scale-90 hover:text-green-600 sm:w-10" aria-label="Aumentar quantidade"><span className="text-2xl leading-none">+</span></button>
                        </div>
                        <button type="button" onClick={handleAddToCart} className="flex min-h-12 flex-1 items-center justify-between gap-2 rounded-xl bg-brand-green px-4 text-sm font-black text-white shadow-lg shadow-green-200 transition active:scale-95 hover:bg-green-600 dark:shadow-none sm:gap-3 sm:px-5 md:text-base"><span>Adicionar {quantity}</span><span>R$ {formatBRL(pricingPreview.lineTotal)}</span></button>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">O valor final será confirmado pelo sistema ao adicionar e novamente antes de concluir o pedido.</p>
                </div>
            </section>
        </div>
    );
}
