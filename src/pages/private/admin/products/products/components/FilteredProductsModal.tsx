import { useState, useMemo, useRef } from 'react';
import { X, ArrowUpDown, Layers, Printer, ChevronDown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../types/product.types';
import ProductThumb from '@/pages/private/admin/products/products/components/ProductThumb';
import PrintableReport from '@/pages/private/admin/products/products/components/PrintableReport';
import { useReactToPrint } from 'react-to-print'; // ou podemos usar window.print()

interface FilteredProductsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    products: Product[];
    type: 'zero' | 'low' | 'high' | 'all';
    storeName: string;
    userEmail: string;
    onViewProduct?: (product: Product) => void;
}

type SortOrder = 'asc' | 'desc';
type GroupBy = 'none' | 'category' | 'stockStatus';

export default function FilteredProductsModal({
    isOpen,
    onClose,
    title,
    products,
    type,
    storeName,
    userEmail,
    onViewProduct,
}: FilteredProductsModalProps) {
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [groupBy, setGroupBy] = useState<GroupBy>('none');
    const [showGroupMenu, setShowGroupMenu] = useState(false);

    const handlePrint = useReactToPrint ?
        useReactToPrint({ contentRef: printRef }) :
        () => window.print(); // fallback

    const getProductInventory = (product: Product) => {
        const onHand = product.display_on_hand ?? product.stock_quantity ?? 0;
        const reserved = product.display_reserved ?? 0;
        const available = product.display_available ?? product.stock_quantity ?? 0;
        return { onHand, reserved, available };
    };

    const getStockStatusLabel = (product: Product) => {
        const { onHand, available } = getProductInventory(product);
        if (!product.active) return 'inativo';
        if (available <= 0) return 'zerado';
        if (available <= product.min_stock) return 'baixo';
        if (onHand > product.max_stock) return 'excesso';
        return 'normal';
    };

    const sortedAndGroupedProducts = useMemo(() => {
        // Ordenação alfabética
        const sorted = [...products].sort((a, b) => {
            if (sortOrder === 'asc') return a.name.localeCompare(b.name);
            else return b.name.localeCompare(a.name);
        });

        if (groupBy === 'none') return [{ group: 'all', items: sorted }];

        const groups: Record<string, Product[]> = {};
        sorted.forEach((product) => {
            let key = '';
            if (groupBy === 'category') key = product.category?.name || 'Sem Categoria';
            if (groupBy === 'stockStatus') key = getStockStatusLabel(product);
            if (!groups[key]) groups[key] = [];
            groups[key].push(product);
        });

        return Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([group, items]) => ({ group, items }));
    }, [products, sortOrder, groupBy]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {title}
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            {products.length}
                        </span>
                    </h2>
                    <div className="flex items-center gap-2">
                        {/* Botões de ordenação e agrupamento (apenas desktop) */}
                        <div className="hidden md:flex items-center gap-2 mr-2">
                            {/* Ordenar A-Z / Z-A */}
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1"
                                title={`Ordenar ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`}
                            >
                                <ArrowUpDown size={16} />
                                <span className="text-xs font-medium">{sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
                            </button>

                            {/* Agrupar por */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowGroupMenu(!showGroupMenu)}
                                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Layers size={16} />
                                    <span className="text-xs font-medium">
                                        {groupBy === 'none' && 'Não agrupar'}
                                        {groupBy === 'category' && 'Por categoria'}
                                        {groupBy === 'stockStatus' && 'Por status'}
                                    </span>
                                    <ChevronDown size={14} />
                                </button>
                                {showGroupMenu && (
                                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                                        <button
                                            onClick={() => { setGroupBy('none'); setShowGroupMenu(false); }}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                                        >
                                            Não agrupar
                                            {groupBy === 'none' && <Check size={14} className="text-[#21A896]" />}
                                        </button>
                                        <button
                                            onClick={() => { setGroupBy('category'); setShowGroupMenu(false); }}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                                        >
                                            Por categoria
                                            {groupBy === 'category' && <Check size={14} className="text-[#21A896]" />}
                                        </button>
                                        {type === 'all' && ( // agrupar por status só disponível no modal "Todos os produtos"
                                            <button
                                                onClick={() => { setGroupBy('stockStatus'); setShowGroupMenu(false); }}
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                                            >
                                                Por status de estoque
                                                {groupBy === 'stockStatus' && <Check size={14} className="text-[#21A896]" />}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Botão de impressão (apenas desktop) */}
                        <button
                            onClick={handlePrint}
                            className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Imprimir relatório"
                        >
                            <Printer size={16} />
                            <span>Imprimir</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Conteúdo – lista de produtos */}
                <div className="flex-1 overflow-y-auto p-4">
                    {sortedAndGroupedProducts.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                            Nenhum produto encontrado.
                        </p>
                    ) : (
                        <div className="space-y-6">
                            {sortedAndGroupedProducts.map(({ group, items }) => (
                                <div key={group}>
                                    {groupBy !== 'none' && (
                                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">
                                            {group}
                                            <span className="ml-2 text-xs font-normal text-gray-500">
                                                ({items.length})
                                            </span>
                                        </h3>
                                    )}
                                    <div className="space-y-2">
                                        {items.map((product) => (
                                            <div
                                                key={product.id}
                                                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                                                onClick={() => {
                                                    if (onViewProduct) {
                                                        onViewProduct(product);
                                                    } else {
                                                        navigate(`/admin/products/${product.id}`);
                                                    }
                                                    onClose();
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <ProductThumb product={product} size="md" />
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-gray-900 dark:text-white truncate max-w-[300px]">
                                                            {product.name}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                            {(() => {
                                                                const { onHand, reserved, available } = getProductInventory(product);
                                                                return (
                                                                    <span>
                                                                        Disponível: {available} • Físico: {onHand} • Reservado: {reserved}
                                                                    </span>
                                                                );
                                                            })()}
                                                            <span>
                                                                Preço: {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                            {!product.active && (
                                                                <span className="text-gray-400">(Inativo)</span>
                                                            )}
                                                        </div>
                                                        {groupBy === 'none' && product.category?.name && (
                                                            <div className="text-xs text-gray-400 italic mt-0.5">
                                                                {product.category.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Badge de status quando agrupamento desligado */}
                                                {groupBy === 'none' && type !== 'all' && (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${type === 'zero' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                        type === 'low' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                            type === 'high' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                                                                ''
                                                        }`}>
                                                        {type === 'zero' && 'Zerado'}
                                                        {type === 'low' && 'Baixo'}
                                                        {type === 'high' && 'Excesso'}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Rodapé (apenas no modal, não no print) */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                        {products.length} {products.length === 1 ? 'produto' : 'produtos'}
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>

            {/* Componente oculto para impressão */}
            <div className="hidden">
                <PrintableReport
                    ref={printRef}
                    products={sortedAndGroupedProducts.flatMap(group => group.items)}
                    title={title}
                    storeName={storeName}
                    printedBy={userEmail}
                    grouped={groupBy !== 'none'}
                    groupBy={groupBy === 'stockStatus' ? 'stockStatus' : 'category'}
                />
            </div>
        </div>
    );
}