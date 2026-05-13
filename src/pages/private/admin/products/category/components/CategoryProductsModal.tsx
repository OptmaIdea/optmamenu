import { X, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CategoryProduct {
    id: string;
    name: string;
    price: number;
}

interface CategoryProductsModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryName: string;
    products: CategoryProduct[];
    loading: boolean;
}

export default function CategoryProductsModal({
    isOpen,
    onClose,
    categoryName,
    products,
    loading,
}: CategoryProductsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <Package size={20} className="text-[#21A896]" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Produtos – {categoryName}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Lista de produtos */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Carregando...</div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Nenhum produto nesta categoria.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {products.map((prod) => (
                                <Link
                                    key={prod.id}
                                    to={`/admin/products/${prod.id}`}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={onClose}
                                >
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {prod.name}
                                    </span>
                                    <span className="font-bold text-[#21A896]">
                                        R$ {prod.price.toFixed(2)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Rodapé */}
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
    );
}