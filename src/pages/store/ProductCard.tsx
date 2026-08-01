import { BadgePercent, ChevronRight, ImageIcon, PackageX, Plus } from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { Product, PriceRule } from '@/types';
import { useCartStore } from '@/store/useCartStore';
import { formatBRL, getPriceForQuantity } from '@/utils/pricing';

interface ProductCardProps {
    product: Product;
    onOpenDetails: (product: Product) => void;
    onNotifyAvailability?: (product: Product) => void;
    onAddToCart?: (product: Product) => void;
}

function getFirstPromotionRule(rules: PriceRule[], basePrice: number) {
    return [...rules]
        .filter((rule) => rule.min > 1 && rule.price < basePrice)
        .sort((left, right) => left.min - right.min)[0] || null;
}

export function ProductCard({
    product,
    onOpenDetails,
    onNotifyAvailability,
}: ProductCardProps) {
    const categoryRules = useCartStore((state) => state.categoryRules);
    const imageUrl = product.images?.[0] || product.image_url || null;

    const pricing = product.use_category_pricing && product.category_id
        ? categoryRules[product.category_id]
        : undefined;

    const pricingRules = pricing?.pricingGroup?.rules?.length
        ? pricing.pricingGroup.rules
        : pricing?.rules?.length
            ? pricing.rules
            : product.price_rules || [];

    const basePrice = Number(product.price || 0);
    const currentUnitPrice = pricingRules.length
        ? (getPriceForQuantity(pricingRules, 1) ?? basePrice)
        : basePrice;
    const promotionRule = getFirstPromotionRule(pricingRules, basePrice);

    const availability = product.public_availability;
    const isUnavailable = availability?.status === 'unavailable'
        || Number(product.stock_quantity ?? 0) <= 0;
    const showLowStock = availability?.status === 'low_stock'
        && availability.displayMode !== 'hidden';
    const showExactStock = availability?.displayMode === 'exact'
        && typeof availability.availableOnline === 'number'
        && !isUnavailable;

    const stockLabel = showExactStock
        ? `${Math.max(0, Math.floor(availability.availableOnline || 0))} disponíveis`
        : showLowStock
            ? 'Poucas unidades'
            : null;

    const stockLabelClassName = showLowStock
        ? 'bg-amber-100/95 text-amber-900 dark:bg-amber-950/90 dark:text-amber-200'
        : 'bg-emerald-100/95 text-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-200';

    const openConfigurator = () => {
        if (!isUnavailable) onOpenDetails(product);
    };

    const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (!isUnavailable && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            openConfigurator();
        }
    };

    const handleNotifyAvailability = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onNotifyAvailability?.(product);
    };

    return (
        <article
            className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-800 sm:rounded-3xl"
            onClick={openConfigurator}
            onKeyDown={handleCardKeyDown}
            role={isUnavailable ? undefined : 'button'}
            tabIndex={isUnavailable ? -1 : 0}
            aria-label={isUnavailable ? undefined : `Abrir detalhes de ${product.name}`}
        >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-50 dark:bg-slate-700/70">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={product.name}
                        className={`h-full w-full object-contain p-3 transition duration-300 sm:p-4 ${isUnavailable ? 'grayscale opacity-60' : 'group-hover:scale-[1.03]'}`}
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-stone-400 dark:text-slate-400">
                        <ImageIcon className="h-8 w-8" aria-hidden="true" />
                        <span className="text-[11px] font-semibold">Imagem não cadastrada</span>
                    </div>
                )}

                <div className="absolute left-2 top-2 flex max-w-[calc(100%-3.5rem)] flex-col items-start gap-1.5 sm:left-3 sm:top-3">
                    {promotionRule && !isUnavailable && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-emerald-300">
                            <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
                            Oferta por quantidade
                        </span>
                    )}

                    {stockLabel && !isUnavailable && (
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold shadow-sm backdrop-blur ${stockLabelClassName}`}>
                            {stockLabel}
                        </span>
                    )}
                </div>

                {isUnavailable ? (
                    <span className="absolute inset-x-3 bottom-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900/90 px-3 py-2 text-xs font-bold text-white">
                        <PackageX className="h-4 w-4" aria-hidden="true" />
                        Indisponível no momento
                    </span>
                ) : (
                    <span
                        className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-brand-green text-white shadow-md transition group-hover:scale-105 sm:right-3 sm:top-3"
                        aria-hidden="true"
                    >
                        <Plus className="h-5 w-5" />
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col p-3 sm:p-4">
                <h3 className="line-clamp-2 min-h-10 text-sm font-extrabold leading-5 text-gray-900 dark:text-gray-100 sm:text-base">
                    {product.name}
                </h3>

                {product.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        {product.description}
                    </p>
                )}

                <div className="mt-auto pt-3">
                    {isUnavailable ? (
                        <button
                            type="button"
                            onClick={handleNotifyAvailability}
                            disabled={!onNotifyAvailability}
                            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-emerald-600 px-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                        >
                            Avise-me
                        </button>
                    ) : (
                        <>
                            <p className="text-lg font-black leading-none text-emerald-700 dark:text-emerald-300">
                                R$ {formatBRL(currentUnitPrice)}
                            </p>

                            {promotionRule && (
                                <p className="mt-2 text-[11px] font-semibold leading-4 text-emerald-800 dark:text-emerald-200">
                                    A partir de {promotionRule.min} itens: R$ {formatBRL(promotionRule.price)} cada
                                </p>
                            )}

                            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-gray-300">
                                {promotionRule ? 'Saiba mais' : 'Ver detalhes'}
                                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                            </span>
                        </>
                    )}
                </div>
            </div>
        </article>
    );
}
