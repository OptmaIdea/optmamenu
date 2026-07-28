import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Eye, Edit, Trash2, Activity } from 'lucide-react';
import type { Product } from '../types/product.types';
import ProductThumb from '@/pages/private/admin/products/products/components/ProductThumb';

interface ProductActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onEdit: () => void;
    onView: (product: Product) => void;
    onDelete: (product: Product) => void;
    canManageProducts: boolean;
}

export default function ProductActionModal({
    isOpen,
    onClose,
    product,
    onEdit,
    onView,
    onDelete,
    canManageProducts,
}: ProductActionModalProps) {
    const navigate = useNavigate();
    const [actionLoading, setActionLoading] = useState<'view' | 'delete' | null>(null);

    const handleView = () => {
        if (!product) return;
        setActionLoading('view');
        setTimeout(() => {
            onView(product);
            onClose();
            setActionLoading(null);
        }, 100);
    };

    const handleDelete = () => {
        if (!product) return;
        setActionLoading('delete');
        setTimeout(() => {
            onDelete(product);
            onClose();
            setActionLoading(null);
        }, 100);
    };

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-80">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                    <ProductThumb product={product} />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                            {product.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {product.category?.name || 'Sem categoria'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        <X size={18} />
                    </button>
                </div>

                {/* Ações */}
                <div className="p-2">
                    {/* Visualizar */}
                    <button
                        onClick={handleView}
                        disabled={actionLoading !== null}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg text-left disabled:opacity-50 cursor-pointer"
                    >
                        {actionLoading === 'view' ? (
                            <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Eye size={18} className="text-gray-500" />
                        )}
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">Visualizar</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                Ver página de detalhe do produto
                            </div>
                        </div>
                    </button>

                    {/* Editar */}
                    {canManageProducts && (
                        <button
                            onClick={() => {
                                onEdit();
                                navigate(`/admin/products/${product.id}/edit`);
                                onClose();
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg text-left cursor-pointer"
                        >
                            <Edit size={18} className="text-blue-500" />
                            <div>
                                <div className="font-medium text-gray-900 dark:text-white">Editar</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Alterar informações
                                </div>
                            </div>
                        </button>
                    )}

                    {/* Vida do produto */}
                    <button
                        onClick={() => {
                            navigate(`/admin/products/${product.id}/lifecycle`);
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg text-left cursor-pointer"
                    >
                        <Activity size={18} className="text-[#19A999]" />
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">Vida do produto</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                Estoque, movimentações e auditoria
                            </div>
                        </div>
                    </button>

                    {/* Excluir / Descontinuar */}
                    {canManageProducts && (
                        <button
                            onClick={handleDelete}
                            disabled={actionLoading !== null}
                            className="w-full flex items-center gap-3 p-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-left disabled:opacity-50 cursor-pointer"
                        >
                            {actionLoading === 'delete' ? (
                                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Trash2 size={18} className="text-red-500" />
                            )}
                            <div>
                                <div className="font-medium text-red-600 dark:text-red-400">
                                    Excluir / Descontinuar
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Requer senha de estoque
                                </div>
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}