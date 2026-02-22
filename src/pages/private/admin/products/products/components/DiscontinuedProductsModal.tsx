import { useState } from 'react';
import { X, Package, Calendar, User, Eye } from 'lucide-react';
import type { Product } from '../types/product.types';
import AdminProductViewModal from '@/pages/private/admin/products/products/components/AdminProductViewModal';

interface DiscontinuedProductsModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[]; // filtrados com discontinued: true
}

export default function DiscontinuedProductsModal({
    isOpen,
    onClose,
    products,
}: DiscontinuedProductsModalProps) {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showViewModal, setShowViewModal] = useState(false);

    if (!isOpen) return null;

    const handleView = (product: Product) => {
        setSelectedProduct(product);
        setShowViewModal(true);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Package size={20} className="text-[#21A896]" />
                            Produtos Descontinuados
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Lista */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {products.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                Nenhum produto descontinuado.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {products.map((product) => (
                                    <div
                                        key={product.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900 dark:text-white">
                                                {product.name}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    Criado: {new Date(product.created_at || '').toLocaleDateString('pt-BR') || '—'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <User size={12} />
                                                    Descontinuado por: Admin
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    Data: {new Date().toLocaleDateString('pt-BR')} (mock)
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleView(product)}
                                            className="p-2 text-[#21A896] hover:bg-[#21A896]/10 rounded-lg transition-colors"
                                            title="Visualizar"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de visualização */}
            <AdminProductViewModal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                product={selectedProduct}
            />
        </>
    );
}