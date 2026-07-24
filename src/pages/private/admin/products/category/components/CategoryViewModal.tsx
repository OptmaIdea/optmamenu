import { X, Package, Calendar, User, Edit, Layers, AlertCircle, CheckCircle } from 'lucide-react';
import type { Category } from '../types/category.types';
import CategoryThumb from '@/pages/private/admin/products/category/components/CategoryThumb';
import { getStandardPrice, getMaxRulePrice } from '../utils/categoryPricing';

interface CategoryViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    category: Category | null;
    onEdit?: (category: Category) => void;
}

export default function CategoryViewModal({
    isOpen,
    onClose,
    category,
    onEdit,
}: CategoryViewModalProps) {
    if (!isOpen || !category) return null;

    const createdAt = category.created_at || new Date().toISOString();
    const createdBy = 'Admin'; // mock – futuramente virá do log

    const hasVolumePricing = category.price_logic_type === 'category_volume' &&
        Array.isArray(category.price_rules) &&
        category.price_rules.length > 0;

    const standardPrice = category.price_logic_type === 'standard'
        ? getStandardPrice(category.price_rules)
        : null;

    const maxRulePrice = category.price_logic_type === 'category_volume'
        ? getMaxRulePrice(category.price_rules)
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#19A999]/10 rounded-lg">
                            <Package size={20} className="text-[#19A999]" />
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                            Visualizar Categoria | {category.name}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Conteúdo rolável */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Coluna 1: Imagem */}
                        <div className="flex flex-col items-center">
                            <CategoryThumb
                                imageUrl={category.image_url}
                                name={category.name}
                                size="lg"
                                className="w-32 h-32 md:w-40 md:h-40 border-2 border-gray-200 dark:border-gray-700"
                            />
                            <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                Ordem: <span className="font-bold text-gray-700 dark:text-gray-300">{category.sort_order}</span>
                            </div>
                        </div>

                        {/* Coluna 2: Informações básicas */}
                        <div className="md:col-span-2 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Descrição
                                </label>
                                <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm">
                                    {category.description || '—'}
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Status
                                </label>
                                <div className="flex items-center gap-2 mt-1">
                                    {category.active ? (
                                        <>
                                            <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                                            <span className="text-gray-700 dark:text-gray-300 text-sm">Ativo</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle size={16} className="text-gray-400 dark:text-gray-500" />
                                            <span className="text-gray-700 dark:text-gray-300 text-sm">Inativo</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Tipo de Preço
                                </label>
                                <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm">
                                    {category.price_logic_type === 'category_volume'
                                        ? 'Atacado (Volume)'
                                        : 'Preço Padrão'}
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Preço Base
                                </label>
                                <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm">
                                    {(() => {
                                        const value = category.price_logic_type === 'standard'
                                            ? standardPrice
                                            : maxRulePrice;
                                        if (value == null || Number.isNaN(value) || value <= 0) return '—';
                                        return new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL'
                                        }).format(value);
                                    })()}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {category.price_logic_type === 'category_volume'
                                        ? 'Exibição (maior preço unitário nas regras)'
                                        : 'Preço único da categoria'}
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Produtos Vinculados
                                </label>
                                <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm">
                                    {category.products_count ?? 0} {category.products_count === 1 ? 'produto' : 'produtos'}
                                </p>
                            </div>

                            {/* Metadados */}
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Calendar size={14} />
                                    <span>Criado em: {new Date(createdAt).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    <User size={14} />
                                    <span>Por: {createdBy}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Regras de atacado (se houver) */}
                    {hasVolumePricing && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <Layers size={16} /> Regras de Atacado
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {category.price_rules.map((rule, idx) => (
                                    <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500">A partir de {rule.min} un.</span>
                                        <p className="font-bold text-[#19A999]">
                                            {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL'
                                            }).format(rule.price)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer com botões */}
                <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Fechar
                    </button>
                    {onEdit && (
                        <button
                            onClick={() => {
                                onEdit(category);
                                onClose();
                            }}
                            className="px-4 py-2 bg-[#19A999] hover:bg-[#14887B] text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Edit size={16} />
                            Editar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}