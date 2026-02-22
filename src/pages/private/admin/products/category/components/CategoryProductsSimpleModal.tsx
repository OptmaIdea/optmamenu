import { X, Package } from 'lucide-react';

interface CategoryProductsSimpleModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryName: string;
    productNames: string[];
}

export default function CategoryProductsSimpleModal({
    isOpen,
    onClose,
    categoryName,
    productNames,
}: CategoryProductsSimpleModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
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

                <div className="flex-1 overflow-y-auto p-4">
                    {productNames.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">
                            Nenhum produto nesta categoria.
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {productNames.sort((a, b) => a.localeCompare(b)).map((name, idx) => (
                                <li
                                    key={idx}
                                    className="py-1.5 px-2 text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 last:border-0"
                                >
                                    {name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

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