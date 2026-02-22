import { Eye, Edit, Trash2, ChevronRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { Category } from '../types/category.types';
import CategoryThumb from '@/pages/private/admin/products/category/components/CategoryThumb';

interface CategoryTableProps {
    categories: Category[];
    onView: (category: Category) => void;
    onEdit: (category: Category) => void;
    onDelete: (category: Category) => void;
    onViewProducts: (category: Category) => void;
    deletingId: string | null;
}

export default function CategoryTable({
    categories,
    onView,
    onEdit,
    onDelete,
    onViewProducts,
    deletingId,
}: CategoryTableProps) {
    // ✅ Garantia de que categories é um array
    const safeCategories = Array.isArray(categories) ? categories : [];

    return (
        <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium text-sm">
                    <tr>
                        <th className="p-4 w-16 text-center">Ord</th>
                        <th className="p-4">Nome</th>
                        <th className="p-4">Produtos</th>
                        <th className="p-4">Tipo Preço</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {safeCategories.map((category) => (
                        <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                            <td className="p-4 text-center font-bold text-gray-500">
                                {category.sort_order}
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <CategoryThumb
                                        imageUrl={category.image_url}
                                        name={category.name}
                                        size="md"
                                    />
                                    <div>
                                        <div className="font-bold text-gray-800 dark:text-gray-200">
                                            {category.name}
                                        </div>
                                        <div className="text-xs text-gray-500 max-w-[200px] truncate">
                                            {category.description}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4">
                                <button
                                    onClick={() => onViewProducts(category)}
                                    className="flex items-center gap-1 text-xs font-bold text-[#21A896] bg-[#21A896]/10 px-2 py-1 rounded hover:bg-[#21A896]/20 transition-colors"
                                >
                                    <Package size={12} />
                                    {category.products_count ?? 0} itens
                                    <ChevronRight size={12} />
                                </button>
                            </td>
                            <td className="p-4">
                                {category.price_logic_type === 'category_volume' ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded border border-amber-100 dark:border-amber-900/30">
                                        Atacado
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-500">Padrão</span>
                                )}
                            </td>
                            <td className="p-4 text-center">
                                <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${category.active
                                        ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900'
                                        : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900'
                                        }`}
                                >
                                    {category.active ? 'Ativo' : 'Inativo'}
                                </span>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onView(category)}
                                        className="p-2 text-gray-500 hover:text-[#21A896] hover:bg-[#21A896]/10 rounded-lg transition"
                                        title="Visualizar"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        onClick={() => onEdit(category)}
                                        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                        title="Editar"
                                    >
                                        <Edit size={18} />
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
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50"
                                        title="Excluir"
                                    >
                                        {deletingId === category.id ? (
                                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Trash2 size={18} />
                                        )}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}