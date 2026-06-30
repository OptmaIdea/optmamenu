import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Package, List } from 'lucide-react';
import type { ProductStock } from '../types/inventory.types';

interface InventoryItemProps {
    product: ProductStock;
    onEntry?: (product: ProductStock) => void;
    onExit?: (product: ProductStock) => void;
    onViewMovements?: (product: ProductStock) => void;
    viewMode: 'table' | 'card';
}

export default function InventoryItem({ product, onEntry, onExit, onViewMovements, viewMode }: InventoryItemProps) {
    const [hasError, setHasError] = useState(false);
    const imgSrc = product.images && product.images.length > 0 ? product.images[0] : null;

    if (viewMode === 'table') {
        return (
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                        {!imgSrc || hasError ? (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                <Package size={14} />
                            </div>
                        ) : (
                            <img
                                src={imgSrc}
                                alt={product.name}
                                className="w-10 h-10 object-cover rounded-lg"
                                onError={() => setHasError(true)}
                                loading="lazy"
                            />
                        )}
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                            <div className="text-xs text-gray-500">R$ {product.price.toFixed(2).replace('.', ',')}</div>
                        </div>
                    </div>
                </td>
                <td className="p-4 text-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{product.physical_stock}</span>
                </td>
                <td className="p-4 text-center">
                    <span className="text-lg font-bold text-orange-600">{product.reserved_stock}</span>
                </td>
                <td className="p-4 text-center">
                    <span className="text-lg font-bold text-[#19A999]">{product.available_stock}</span>
                </td>
                <td className="p-4 text-center">
                    {onViewMovements && (
                        <button
                            onClick={() => onViewMovements(product)}
                            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                            title="Ver movimentações deste produto"
                        >
                            <List size={18} />
                        </button>
                    )}
                </td>
                <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                        {onEntry && (
                        <button
                            onClick={() => onEntry(product)}
                            className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                            title="Entrada"
                        >
                            <ArrowUpCircle size={18} />
                        </button>
                        )}
                        {onExit && (
                        <button
                            onClick={() => onExit(product)}
                            className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                            title="Saída / Perda"
                        >
                            <ArrowDownCircle size={18} />
                        </button>
                        )}
                    </div>
                </td>
            </tr>
        );
    }

    // Visualização em card (mobile)
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
                {!imgSrc || hasError ? (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                        <Package size={24} />
                    </div>
                ) : (
                    <img
                        src={imgSrc}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        onError={() => setHasError(true)}
                        loading="lazy"
                    />
                )}
                <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white">{product.name}</h3>
                    <p className="text-sm text-gray-500">R$ {product.price.toFixed(2).replace('.', ',')}</p>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div>
                    <p className="text-xs text-gray-500 uppercase">Físico</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{product.physical_stock}</p>
                </div>
                <div>
                    <p className="text-xs text-orange-500 uppercase">Reservado</p>
                    <p className="text-xl font-bold text-orange-600">{product.reserved_stock}</p>
                </div>
                <div>
                    <p className="text-xs text-[#19A999] uppercase">Disponível</p>
                    <p className="text-xl font-bold text-[#19A999]">{product.available_stock}</p>
                </div>
            </div>
            <div className="flex gap-2 mt-4">
                {onViewMovements && (
                    <button
                        onClick={() => onViewMovements(product)}
                        className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <List size={16} /> Movimentações
                    </button>
                )}
                {onEntry && (
                <button
                    onClick={() => onEntry(product)}
                    className="flex-1 py-2 bg-green-100 text-green-700 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                >
                    <ArrowUpCircle size={16} /> Entrada
                </button>
                )}
                {onExit && (
                <button
                    onClick={() => onExit(product)}
                    className="flex-1 py-2 bg-red-100 text-red-700 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                >
                    <ArrowDownCircle size={16} /> Saída
                </button>
                )}
            </div>
        </div>
    );
}
