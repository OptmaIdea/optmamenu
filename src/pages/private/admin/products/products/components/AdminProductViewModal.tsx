// components/AdminProductViewModal.tsx

import { useState } from 'react';
import { X, Package, Calendar, User, Edit, Layers, Archive, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '../types/product.types';

interface AdminProductViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onEdit?: (product: Product) => void;
}

export default function AdminProductViewModal({ isOpen, onClose, product, onEdit }: AdminProductViewModalProps) {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    if (!isOpen || !product) return null;

    const images = product.images && product.images.length > 0 ? product.images : [];
    const hasMultipleImages = images.length > 1;

    const stockStatus = () => {
        if (!product.active) return { label: 'inativo', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
        if (product.stock_quantity === 0) return { label: 'zerado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
        if (product.stock_quantity <= product.min_stock) return { label: 'baixo', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
        if (product.stock_quantity > product.max_stock) return { label: 'excesso', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' };
        return { label: 'normal', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
    };

    const status = stockStatus();

    // Metadados (mock – futuramente poderão vir do produto)
    const createdAt = product.created_at || new Date().toISOString();
    const createdBy = 'Admin';

    // Navegação entre imagens
    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };
    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden">
                {/* Lado Esquerdo – Imagem e seletor (visível em md+) */}
                <div className="w-full md:w-2/5 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col items-center justify-start relative">
                    {/* Botão Fechar (posicionado no canto, apenas no mobile fica dentro do header) */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10 md:hidden"
                    >
                        <X size={20} className="text-gray-700 dark:text-gray-300" />
                    </button>

                    {/* Imagem Principal */}
                    {images.length > 0 ? (
                        <div className="relative w-full flex-1 flex items-center justify-center mb-4">
                            <img
                                src={images[currentImageIndex]}
                                alt={product.name}
                                className="max-h-64 md:max-h-80 object-contain rounded-lg"
                            />
                            {/* Setas de navegação (apenas se houver múltiplas imagens) */}
                            {hasMultipleImages && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <ChevronLeft size={20} className="text-gray-700 dark:text-gray-300" />
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <ChevronRight size={20} className="text-gray-700 dark:text-gray-300" />
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="w-full flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-8 mb-4">
                            <Package size={48} className="text-gray-400" />
                        </div>
                    )}

                    {/* Miniaturas (seletor de imagens) */}
                    {hasMultipleImages && (
                        <div className="flex gap-2 overflow-x-auto pb-2 w-full justify-center">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${currentImageIndex === idx
                                        ? 'border-[#21A896] opacity-100 scale-105'
                                        : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <img src={img} alt={`${product.name} - miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lado Direito – Informações do Produto (em telas grandes) */}
                <div className="w-full md:w-3/5 flex flex-col max-h-full">
                    {/* Header (apenas em desktop, no mobile fica dentro do conteúdo) */}
                    <div className="hidden md:flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#21A896]/10 rounded-lg">
                                <Package size={20} className="text-[#21A896]" />
                            </div>
                            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                                {product.name}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Conteúdo rolável */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-6 space-y-6">
                        {/* No mobile, mostramos o nome e o botão fechar inline */}
                        <div className="flex items-center justify-between md:hidden">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{product.name}</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Grid de informações – 2 colunas em telas maiores */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Coluna 1 */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</label>
                                    <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm whitespace-pre-wrap">
                                        {product.description || '—'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categoria</label>
                                    <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm font-medium">
                                        {product.category?.name || '—'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Preço</label>
                                    <p className="text-2xl font-bold text-[#21A896]">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                                    </p>
                                </div>
                            </div>

                            {/* Coluna 2 */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estoque</label>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {product.stock_quantity}
                                        </span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                            {status.label}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Mín: {product.min_stock} • Máx: {product.max_stock}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        {product.active ? (
                                            <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                                        ) : (
                                            <AlertCircle size={16} className="text-gray-400 dark:text-gray-500" />
                                        )}
                                        <span className="text-gray-700 dark:text-gray-300 text-sm">
                                            {product.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                </div>

                                {/* Metadados */}
                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <Calendar size={14} />
                                        <span>Criado em: {new Date(createdAt).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        <User size={14} />
                                        <span>Por: {createdBy}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Regras de atacado */}
                        {product.price_logic_type === 'category_volume' &&
                            Array.isArray(product.price_rules) &&
                            product.price_rules.length > 0 && (
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <Layers size={16} /> Regras de Atacado
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {product.price_rules.map((rule, idx) => (
                                            <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                <span className="text-xs text-gray-500">A partir de {rule.min} un.</span>
                                                <p className="font-bold text-[#21A896]">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rule.price)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {/* Descontinuado */}
                        {product.is_discontinued && (
                            <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <Archive size={16} />
                                    <span className="text-sm font-medium">Produto descontinuado</span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    Descontinuado em: {new Date().toLocaleDateString('pt-BR')} (mock)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer com botões */}
                    <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Fechar
                        </button>
                        <button
                            onClick={() => {
                                if (onEdit && product) {
                                    onEdit(product);
                                }
                                onClose();
                            }}
                            className="px-4 py-2 bg-[#21A896] hover:bg-[#1a867a] text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Edit size={16} />
                            Editar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}