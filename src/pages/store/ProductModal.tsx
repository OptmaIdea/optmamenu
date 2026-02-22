import { X, Heart, Star, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
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

    // Normalize images hook
    const images = product
        ? (Array.isArray(product.images) && product.images.length > 0
            ? product.images
            : [product.image_url || 'https://via.placeholder.com/300'])
        : [];

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsVisible(true);
            setQuantity(1); // Reset quantity on open
            setCurrentImageIndex(0); // Reset image logic
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    const rating = product?.rating_avg || '5.0';

    const pricing = product?.use_category_pricing && product?.category_id
        ? categoryRules[product.category_id]
        : undefined;
    const unitPrice = pricing
        ? (getPriceForQuantity(pricing.rules, pricing.type === 'category_volume' ? quantity : 1) ?? Number(product?.price || 0))
        : Number(product?.price || 0);
    const showQtyNote = Boolean(pricing && pricing.type === 'category_volume');

    const handleAddToCart = () => {
        if (product) {
            onAddToCart(product, quantity);
            onClose();
        }
    };

    return (
        <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            {/* Modal Container */}
            <div className={`fixed bottom-0 left-0 right-0 md:inset-0 md:m-auto md:max-w-xl md:h-fit max-h-[90vh] md:max-h-[85vh] bg-white dark:bg-slate-800 rounded-t-[2.5rem] md:rounded-[2.5rem] flex flex-col overflow-hidden transition-all duration-300 ease-out shadow-2xl ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full md:translate-y-0 md:scale-95 md:opacity-0'}`}>

                {/* Header Image Area */}
                <div className="relative h-64 md:h-80 bg-gray-50 dark:bg-slate-700 flex flex-col justify-center p-6 shrink-0 text-center">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-2 rounded-full z-10 text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-100"
                    >
                        <X size={20} />
                    </button>

                    {product && images.length > 0 && (
                        <div className="h-full flex items-center justify-center relative group">
                            {/* Prev Arrow */}
                            {images.length > 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
                                    }}
                                    className="absolute left-0 p-2 bg-white/50 hover:bg-white rounded-full shadow-sm text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                </button>
                            )}

                            <img
                                src={images[currentImageIndex]}
                                alt={product.name}
                                className="h-full object-contain drop-shadow-xl transition-all duration-300"
                            />

                            {/* Next Arrow */}
                            {images.length > 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentImageIndex(prev => (prev + 1) % images.length);
                                    }}
                                    className="absolute right-0 p-2 bg-white/50 hover:bg-white rounded-full shadow-sm text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Thumbnails */}
                {images.length > 1 && (
                    <div className="px-6 py-2 flex gap-2 overflow-x-auto scrollbar-hide bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                        {images.map((img, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentImageIndex(idx)}
                                className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${currentImageIndex === idx ? 'border-brand-green opacity-100 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            >
                                <img src={img} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Scrollable Content */}
                <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase leading-tight mr-2">{product?.name}</h2>
                        <button className="text-gray-300 hover:text-red-500 transition shrink-0">
                            <Heart size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 mb-6">
                        <div className="flex text-yellow-400">
                            {[1, 2, 3, 4, 5].map((_, i) => (
                                <Star key={i} size={14} fill="currentColor" />
                            ))}
                        </div>
                        <span className="text-xs font-bold text-gray-400">{rating} (12 avaliações)</span>
                    </div>

                    <p className="text-gray-500 dark:text-gray-300 leading-relaxed mb-8 text-base">
                        {product?.description || 'Uma explosão de sabor refrescante feita com ingredientes selecionados.'}
                    </p>

                    {/* Reviews Snippet */}
                    <div className="space-y-3">
                        <h4 className="font-bold flex items-center gap-2 tracking-tight text-gray-700 dark:text-gray-300 text-xs uppercase">
                            <MessageSquare size={14} /> Quem provou, amou
                        </h4>
                        <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-2xl border-l-4 border-green-400 italic text-sm text-gray-600 dark:text-gray-300">
                            "Incrível! Super refrescante e o atendimento no Whats é 10."
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 md:p-6 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-4 mt-auto safe-area-bottom">

                    <div className="flex items-center justify-between gap-4">
                        {/* Quantity Selector */}
                        <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-xl p-1 h-12">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-green-600 active:scale-90 transition"
                            >
                                <span className="text-2xl leading-none">-</span>
                            </button>
                            <span className="w-8 text-center font-bold text-gray-800 dark:text-white text-lg">{quantity}</span>
                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-green-600 active:scale-90 transition"
                            >
                                <span className="text-2xl leading-none">+</span>
                            </button>
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={handleAddToCart}
                            className="flex-1 bg-brand-green hover:bg-green-600 text-white font-black h-12 rounded-xl shadow-lg shadow-green-200 dark:shadow-none active:scale-95 transition flex items-center justify-between px-6 uppercase tracking-tight text-sm md:text-base"
                        >
                            <span>Adicionar</span>
                            <span>R$ {formatBRL(Number(unitPrice) * quantity)}</span>
                        </button>

                        {showQtyNote ? (
                            <p className="mt-2 text-[11px] text-gray-500">
                                * Preço pode variar conforme o total de itens da mesma categoria no carrinho.
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
