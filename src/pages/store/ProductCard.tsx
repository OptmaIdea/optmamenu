import { Plus, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Product } from '@/types';
import { useCartStore } from '@/store/useCartStore';
import { formatBRL, getPriceForQuantity } from '@/utils/pricing';

interface ProductCardProps {
    product: Product;
    onOpenDetails: (product: Product) => void;
    /**
     * Mantido temporariamente para compatibilidade com o Catalog legado.
     * Na experiência V2, nenhuma ação do card adiciona o item diretamente.
     */
    onAddToCart?: (product: Product) => void;
}

export function ProductCard({ product, onOpenDetails }: ProductCardProps) {
    const categoryRules = useCartStore((state) => state.categoryRules);
    const images = Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : [product.image_url || 'https://via.placeholder.com/300'];

    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    const rating = product.rating_avg || 5.0;

    const pricing = product.use_category_pricing && product.category_id
        ? categoryRules[product.category_id]
        : undefined;
    const effectivePrice = pricing
        ? (getPriceForQuantity(pricing.rules, 1) ?? product.price)
        : product.price;
    const showFromLabel = Boolean(pricing && pricing.type === 'category_volume');

    useEffect(() => {
        if (!isHovered || images.length <= 1) {
            setCurrentImageIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setCurrentImageIndex((previous) => (previous + 1) % images.length);
        }, 800);

        return () => clearInterval(interval);
    }, [isHovered, images.length]);

    const openConfigurator = () => onOpenDetails(product);

    const handleConfiguratorButton = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        openConfigurator();
    };

    return (
        <article className="bg-white dark:bg-slate-800 rounded-[2rem] p-3 shadow-sm relative group active:scale-95 transition-all h-full flex flex-col">
            <button
                type="button"
                onClick={handleConfiguratorButton}
                className="absolute top-3 right-3 z-10 bg-[#98FF98] p-2 rounded-full shadow-lg text-green-900 border-2 border-white hover:scale-110 transition-transform"
                aria-label={`Ver opções de ${product.name}`}
                title={`Ver opções de ${product.name}`}
            >
                <Plus className="w-5 h-5" />
            </button>

            <button
                type="button"
                onClick={openConfigurator}
                className="flex-1 flex flex-col cursor-pointer text-left"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                aria-label={`Abrir detalhes de ${product.name}`}
            >
                <div className="bg-gray-50 rounded-2xl mb-2 flex justify-center p-4 h-36 items-center overflow-hidden relative w-full">
                    <img
                        src={images[currentImageIndex]}
                        alt={product.name}
                        className="max-h-28 object-contain drop-shadow-md transition-all duration-300"
                        loading="lazy"
                    />

                    {images.length > 1 && (
                        <div className="absolute bottom-2 flex gap-1" aria-hidden="true">
                            {images.map((_, index) => (
                                <span
                                    key={index}
                                    className={`w-1.5 h-1.5 rounded-full transition-colors ${currentImageIndex === index ? 'bg-green-500' : 'bg-gray-300'}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 mb-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-[10px] font-bold text-gray-500">{rating}</span>
                </div>

                <h3 className="font-bold text-sm leading-tight mb-1 text-gray-900 dark:text-gray-100">
                    {product.name}
                </h3>

                <p className="text-green-600 font-extrabold text-base mt-auto">
                    {showFromLabel ? 'A partir de ' : ''}R$ {formatBRL(Number(effectivePrice))}
                </p>
            </button>
        </article>
    );
}
