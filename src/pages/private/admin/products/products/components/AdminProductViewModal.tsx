// components/AdminProductViewModal.tsx

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Package, Calendar, Edit, Layers, Archive, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, History, Maximize2 } from 'lucide-react';
import type { Product } from '../types/product.types';
import { getStockHealth } from '@/pages/private/admin/products/inventory/utils/inventorySpreadsheetModel';

interface AdminProductViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onEdit?: (product: Product) => void;
}

export default function AdminProductViewModal({ isOpen, onClose, product, onEdit }: AdminProductViewModalProps) {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageExpanded, setImageExpanded] = useState(false);

    useEffect(() => {
        setCurrentImageIndex(0);
        setImageExpanded(false);
    }, [product?.id]);

    useEffect(() => {
        if (!isOpen) return;
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            if (imageExpanded) setImageExpanded(false);
            else onClose();
        };
        document.addEventListener('keydown', onEscape);
        return () => document.removeEventListener('keydown', onEscape);
    }, [isOpen, imageExpanded, onClose]);

    if (!isOpen || !product) return null;

    const images = product.images && product.images.length > 0 ? product.images : [];
    const hasMultipleImages = images.length > 1;

    const onHand = product.display_on_hand ?? product.stock_quantity ?? 0;
    const reserved = product.display_reserved ?? 0;
    const available = product.display_available ?? product.stock_quantity ?? 0;

    const getInventoryStatus = () => {
        if (!product.active) return { label: 'inativo', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
        // Mesma classificação do /inventory: não interpretar limite 0 como máximo configurado.
        const minimum = Number(product.min_stock) > 0 ? Number(product.min_stock) : null;
        const maximum = Number(product.max_stock) > 0 ? Number(product.max_stock) : null;
        const status = getStockHealth(available, minimum, maximum);
        if (status === 'zero') return { label: 'zerado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
        if (status === 'below') return { label: 'abaixo do mínimo', color: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200' };
        if (status === 'excess') return { label: 'excedente', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' };
        if (status === 'unconfigured') return { label: 'limites não configurados', color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200' };
        return { label: 'normal', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
    };

    const status = getInventoryStatus();

    // Exibir apenas metadados realmente disponíveis no cadastro.
    const createdAt = product.created_at
        && Number.isFinite(Date.parse(product.created_at))
        ? new Date(product.created_at).toLocaleDateString('pt-BR')
        : null;

    // Navegação entre imagens
    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };
    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
            <section role="dialog" aria-modal="true" aria-labelledby="product-view-title"
                className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-xl dark:bg-gray-800 md:max-h-[90dvh] md:flex-row md:overflow-hidden">
                {/* Lado Esquerdo – Imagem e seletor (visível em md+) */}
                <div className="relative flex w-full shrink-0 flex-col items-center justify-start bg-gray-50 p-3 dark:bg-gray-900 sm:p-4 md:w-2/5 md:shrink md:overflow-y-auto md:p-6">
                    {/* Botão Fechar (posicionado no canto, apenas no mobile fica dentro do header) */}
                    <button
                        onClick={onClose}
                        aria-label="Fechar visualização do produto"
                        className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 shadow-md backdrop-blur hover:bg-gray-100 dark:bg-gray-800/90 dark:hover:bg-gray-700 md:hidden"
                    >
                        <X size={20} className="text-gray-700 dark:text-gray-300" />
                    </button>

                    {/* Imagem Principal */}
                    {images.length > 0 ? (
                        <div className="relative mb-3 flex min-h-44 w-full items-center justify-center sm:min-h-56 md:mb-4 md:flex-1">
                            <button type="button" onClick={() => setImageExpanded(true)}
                                aria-label={`Ampliar imagem de ${product.name}`}
                                className="group flex min-h-44 w-full items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-emerald-500">
                                <img
                                    src={images[currentImageIndex]}
                                    alt={product.name}
                                    className="max-h-44 max-w-full rounded-lg object-contain sm:max-h-56 md:max-h-80"
                                />
                                <Maximize2 size={18} className="absolute bottom-1 right-1 rounded-lg bg-white/90 p-0.5 text-emerald-800 opacity-80 dark:bg-gray-800 dark:text-emerald-200" aria-hidden="true" />
                            </button>
                            {/* Setas de navegação (apenas se houver múltiplas imagens) */}
                            {hasMultipleImages && (
                                <>
                                    <button
                                        type="button"
                                        onClick={prevImage}
                                        aria-label="Imagem anterior"
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <ChevronLeft size={20} className="text-gray-700 dark:text-gray-300" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={nextImage}
                                        aria-label="Próxima imagem"
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
                                    type="button"
                                    onClick={() => setCurrentImageIndex(idx)}
                                    aria-label={`Visualizar miniatura ${idx + 1} de ${images.length}`}
                                    aria-pressed={currentImageIndex === idx}
                                    className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${currentImageIndex === idx
                                        ? 'border-[#19A999] opacity-100 scale-105'
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
                <div className="flex w-full min-w-0 shrink-0 flex-col md:w-3/5 md:min-h-0 md:shrink">
                    {/* Header (apenas em desktop, no mobile fica dentro do conteúdo) */}
                    <div className="hidden md:flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#19A999]/10 rounded-lg">
                                <Package size={20} className="text-[#19A999]" />
                            </div>
                            <h2 id="product-view-title" className="text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
                                {product.name}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Fechar visualização do produto"
                            className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Conteúdo rolável */}
                    <div className="space-y-4 p-4 sm:p-5 md:min-h-0 md:flex-1 md:overflow-y-auto md:p-6">
                        <h2 id="product-view-title-mobile" className="text-lg font-black text-gray-900 dark:text-white md:hidden">{product.name}</h2>

                        {/* Grid de informações – 2 colunas em telas maiores */}
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
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
                                    <p className="text-2xl font-bold text-[#19A999]">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                                    </p>
                                </div>
                            </div>

                            {/* Coluna 2 */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estoque</label>
                                    <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
                                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Físico</p>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{onHand}</p>
                                        </div>
                                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Reservado</p>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{reserved}</p>
                                        </div>
                                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Disponível</p>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{available}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                            {status.label}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            Mín: {product.min_stock} • Máx: {product.max_stock}
                                        </span>
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
                                    {createdAt ? (
                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <Calendar size={14} aria-hidden="true" />
                                            <span>Criado em: {createdAt}</span>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Data de cadastro não informada.</p>
                                    )}
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
                                                <p className="font-bold text-[#19A999]">
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
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Produto marcado como descontinuado. Consulte a Vida do Produto para o histórico de ocorrências.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer com botões */}
                    <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 p-3 dark:border-gray-700 sm:p-4 md:p-6">
                        <Link
                            to={`/admin/products/${product.id}/lifecycle`}
                            onClick={onClose}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
                        >
                            <History size={16} aria-hidden="true"/> Vida do produto
                        </Link>
                        <button type="button" onClick={onClose}
                            className="min-h-10 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                            Fechar
                        </button>
                        {onEdit && <button type="button" onClick={() => {onEdit(product); onClose();}}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#19A999] px-4 py-2 text-sm font-bold text-white hover:bg-[#14887B]">
                            <Edit size={16} aria-hidden="true"/> Editar
                        </button>}
                    </div>
                </div>
            </section>
            {imageExpanded && images[currentImageIndex] && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
                    role="dialog" aria-modal="true" aria-label={`Imagem ampliada de ${product.name}`}
                    onClick={() => setImageExpanded(false)}>
                    <button type="button" aria-label="Fechar imagem ampliada"
                        className="absolute right-4 top-4 rounded-full bg-gray-800 p-3 text-white hover:bg-gray-700"
                        onClick={() => setImageExpanded(false)}><X size={20}/></button>
                    <img src={images[currentImageIndex]} alt={product.name} onClick={(e) => e.stopPropagation()}
                        className="max-h-[85dvh] max-w-full rounded-xl object-contain"/>
                </div>
            )}
        </div>
    );
}