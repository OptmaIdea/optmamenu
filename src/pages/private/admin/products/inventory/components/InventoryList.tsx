import { Package } from 'lucide-react';
import type { ProductStock } from '../types/inventory.types';
import InventoryItem from '@/pages/private/admin/products/inventory/components/InventoryItem';

interface InventoryListProps {
    products: ProductStock[];
    onEntry?: (product: ProductStock) => void;
    onExit?: (product: ProductStock) => void;
    onViewMovements?: (product: ProductStock) => void;
}

export default function InventoryList({ products, onEntry, onExit, onViewMovements }: InventoryListProps) {
    if (products.length === 0) {
        return (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <Package size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    Nenhum produto encontrado
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                    Tente ajustar sua busca ou cadastre produtos primeiro.
                </p>
            </div>
        );
    }

    return (
        <>
            {/* Tabela Desktop */}
            <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm font-medium">
                        <tr>
                            <th className="p-4">Produto</th>
                            <th className="p-4 text-center">Físico</th>
                            <th className="p-4 text-center">Reservado</th>
                            <th className="p-4 text-center">Disponível</th>
                            <th className="p-4 text-center">Movimentações</th>
                            <th className="p-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {products.map(product => (
                            <InventoryItem
                                key={product.id}
                                product={product}
                                onEntry={onEntry}
                                onExit={onExit}
                                onViewMovements={onViewMovements}
                                viewMode="table"
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Cards Mobile */}
            <div className="lg:hidden space-y-4">
                {products.map(product => (
                    <InventoryItem
                        key={product.id}
                        product={product}
                        onEntry={onEntry}
                        onExit={onExit}
                        viewMode="card"
                    />
                ))}
            </div>
        </>
    );
}