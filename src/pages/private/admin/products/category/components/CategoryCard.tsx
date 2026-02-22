import { Eye, Edit, Trash2, ChevronRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { Category } from '../types/category.types';
import CategoryThumb from '@/pages/private/admin/products/category/components/CategoryThumb';

interface CategoryCardProps {
    category: Category;
    onView: (category: Category) => void;
    onEdit: (category: Category) => void;
    onDelete: (category: Category) => void;
    onViewProducts: (category: Category) => void;
    deletingId: string | null;
}

export default function CategoryCard({
    category,
    onView,
    onEdit,
    onDelete,
    onViewProducts,
    deletingId,
}: CategoryCardProps) {
    return (
        <div className="p-4 bg-white dark:bg-gray-800 first:rounded-t-xl last:rounded-b-xl border-b border-gray-100 dark:border-gray-700 last:border-0">
            <div className="flex gap-4">
                <CategoryThumb
                    imageUrl={category.image_url}
                    name={category.name}
                    size="lg"
                    className="w-16 h-16 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div className="font-bold text-gray-800 dark:text-gray-100 mb-1">
                            {category.name}
                        </div>
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${category.active
                                ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900'
                                : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900'
                                }`}
                        >
                            {category.active ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">
                        {category.description || 'Sem descrição'}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            Ord: {category.sort_order}
                        </span>
                        <button
                            onClick={() => onViewProducts(category)}
                            className="flex items-center gap-1 text-xs font-bold text-[#21A896] bg-[#21A896]/10 px-2 py-1 rounded hover:bg-[#21A896]/20 transition-colors"
                        >
                            <Package size={12} />
                            {category.products_count ?? 0} {category.products_count === 1 ? 'item' : 'itens'}
                            <ChevronRight size={12} />
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                <button
                    onClick={() => onView(category)}
                    className="flex-1 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                >
                    <Eye size={16} /> Ver
                </button>
                <button
                    onClick={() => onEdit(category)}
                    className="flex-1 py-2 px-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                >
                    <Edit size={16} /> Editar
                </button>
                <button
                    onClick={() => {
                        if (category.products_count && category.products_count > 0) {
                            toast.warning('Esta categoria possui produtos vinculados. Remova ou transfira os produtos antes de excluir a categoria.');
                            return;
                        }
                        onDelete(category);
                    }}
                    disabled={deletingId === category.id}
                    className="flex-1 py-2 px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {deletingId === category.id ? (
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <Trash2 size={16} /> Excluir
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}