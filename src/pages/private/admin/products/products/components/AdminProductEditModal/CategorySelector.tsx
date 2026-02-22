import { X, Edit } from 'lucide-react';
import type { Category } from '../../types/product.types';

interface CategorySelectorProps {
    categories: Category[];
    categoryId: string;
    onCategoryChange: (id: string) => void;
    isCreatingCategory: boolean;
    onCreateCategory: () => void;
    onCancelCreate: () => void;
    newCategoryName: string;
    onNewCategoryNameChange: (name: string) => void;
    onCreateCategorySubmit: () => Promise<void>;
}

export const CategorySelector = ({
    categories,
    categoryId,
    onCategoryChange,
    isCreatingCategory,
    onCreateCategory,
    onCancelCreate,
    newCategoryName,
    onNewCategoryNameChange,
    onCreateCategorySubmit,
}: CategorySelectorProps) => {
    if (isCreatingCategory) {
        return (
            <div className="flex gap-2 animate-fadeIn">
                <input
                    type="text"
                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={newCategoryName}
                    onChange={(e) => onNewCategoryNameChange(e.target.value)}
                    placeholder="Nome da nova categoria"
                    autoFocus
                />
                <button
                    type="button"
                    onClick={onCreateCategorySubmit}
                    className="px-4 py-2 bg-[#21A896] text-white rounded-lg hover:bg-[#1a867a] transition font-bold"
                >
                    OK
                </button>
                <button
                    type="button"
                    onClick={onCancelCreate}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                    <X size={18} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            <select
                className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896]/20 focus:border-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white appearance-none cursor-pointer"
                value={categoryId}
                onChange={(e) => onCategoryChange(e.target.value)}
                required
            >
                <option value="">Selecione uma categoria</option>
                {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </select>
            <button
                type="button"
                onClick={onCreateCategory}
                className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                title="Nova Categoria"
            >
                <Edit size={18} />
            </button>
        </div>
    );
};