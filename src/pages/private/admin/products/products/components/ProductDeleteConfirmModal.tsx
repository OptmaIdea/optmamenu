import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import SecurityConfirmModal from '@/components/common/SecurityConfirmModal';
import StockClearanceModal from '@/pages/private/admin/products/inventory/components/StockClearanceModal';
import type { Product } from '../types/product.types';
import type { ProductStock } from '../../inventory/types/inventory.types';
import { useStoreSecurityConfig } from '@/hooks/useStoreSecurityConfig';
import { toast } from 'sonner';
import { logAction } from '@/pages/private/admin/products/products/utils/securityLog';

interface ProductDeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onSuccess: () => void;
}

type DeleteAction = 'discontinue' | 'deactivate' | 'delete' | null;

export default function ProductDeleteConfirmModal({
    isOpen,
    onClose,
    product,
    onSuccess,
}: ProductDeleteConfirmModalProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [showClearance, setShowClearance] = useState(false);
    const [selectedAction, setSelectedAction] = useState<DeleteAction>(null);
    const [hasMovements, setHasMovements] = useState(false);
    const [hasStock, setHasStock] = useState(false);
    const [clearanceType, setClearanceType] = useState<'discontinue' | 'deactivate'>('discontinue');
    const [reason, setReason] = useState('');
    const [isAlreadyInactive, setIsAlreadyInactive] = useState(false);
    const { tokenExpirySeconds, maxTokenAttempts } = useStoreSecurityConfig();

    useEffect(() => {
        if (isOpen && product) {
            checkProductStatus();
            setIsAlreadyInactive(product.active === false);
        }
    }, [isOpen, product]);

    const buildReason = (action: DeleteAction, productName: string, stockQty: number) => {
        if (action === 'discontinue') {
            const base = `Produto ${productName} descontinuado`;
            return stockQty > 0 ? `${base} com baixa de ${stockQty} itens no estoque` : base;
        } else if (action === 'deactivate') {
            const base = `Produto ${productName} inativado`;
            return stockQty > 0 ? `${base} com baixa de ${stockQty} itens no estoque` : base;
        }
        return '';
    };

    const checkProductStatus = async () => {
        try {
            // Verificar movimentações na tabela stock_movements
            const { data: movementData } = await supabase.rpc('product_has_movements', {
                p_product_id: product!.id,
            });
            setHasMovements(movementData || false);

            // Verificar estoque
            setHasStock((product!.stock_quantity || 0) > 0);
        } catch (error) {
            console.error('Erro ao verificar status do produto:', error);
        }
    };

    const handleActionSelect = (action: DeleteAction) => {
        setSelectedAction(action);

        // Atualizar motivo automaticamente
        const stockQty = Number(product?.stock_quantity) || 0;
        setReason(buildReason(action, product?.name || '', stockQty));

        // Se tem estoque e é descontinuar ou inativar, abre modal de zeramento primeiro
        if (hasStock && (action === 'discontinue' || action === 'deactivate')) {
            setClearanceType(action);
            setShowClearance(true);
        } else if (action === 'delete') {
            // Exclusão direta se não tem movimentações
            setShowConfirm(true);
        } else if (action === 'deactivate' && !hasStock) {
            // Inativar sem estoque - confirmação direta
            setShowConfirm(true);
        } else if (action === 'discontinue' && !hasStock) {
            // Descontinuar sem estoque - confirmação direta
            setShowConfirm(true);
        }
    };

    const handleConfirm = async () => {
        if (!product || !selectedAction) return;

        try {
            if (selectedAction === 'delete') {
                // Deletar imagens do bucket antes de excluir o produto
                if (product.images && product.images.length > 0) {
                    const pathsToDelete = product.images
                        .map((url: string) => {
                            try {
                                const urlObj = new URL(url);
                                const parts = urlObj.pathname.split('/products/');
                                return parts.length > 1 ? parts[1] : null;
                            } catch { return null; }
                        })
                        .filter((p: string | null): p is string => p !== null);

                    if (pathsToDelete.length > 0) {
                        await supabase.storage.from('products').remove(pathsToDelete);
                    }
                }

                // Exclusão permanente (apenas se não tiver movimentações)
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', product.id);
                if (error) throw error;

                await logAction('Excluir Produto', { product_id: product.id, name: product.name }, 'success');
                toast.success('Produto excluído permanentemente.');

            } else if (selectedAction === 'discontinue') {
                // Descontinuar (remove imagens também, mas mantém movimentações)
                const { error } = await supabase
                    .from('products')
                    .update({
                        is_discontinued: true,
                        active: false,
                        images: [] // Limpa array de imagens
                    })
                    .eq('id', product.id);
                if (error) throw error;

                // Deletar imagens do bucket
                if (product.images && product.images.length > 0) {
                    const pathsToDelete = product.images
                        .map((url: string) => {
                            try {
                                const urlObj = new URL(url);
                                const parts = urlObj.pathname.split('/products/');
                                return parts.length > 1 ? parts[1] : null;
                            } catch { return null; }
                        })
                        .filter((p: string | null): p is string => p !== null);

                    if (pathsToDelete.length > 0) {
                        await supabase.storage.from('products').remove(pathsToDelete);
                    }
                }

                const movementMsg = hasStock ? `, com baixa de ${product.stock_quantity} itens no estoque` : '';
                await logAction(
                    'Descontinuar Produto',
                    { product_id: product.id, name: product.name, stock_cleared: hasStock ? product.stock_quantity : 0 },
                    'success'
                );
                toast.success(`Produto descontinuado${movementMsg}.`);

            } else if (selectedAction === 'deactivate') {
                // Apenas inativar (mantém imagens e produto na lista)
                const { error } = await supabase
                    .from('products')
                    .update({ active: false })
                    .eq('id', product.id);
                if (error) throw error;

                const movementMsg = hasStock ? `, com baixa de ${product.stock_quantity} itens no estoque` : '';
                await logAction(
                    'Inativar Produto',
                    { product_id: product.id, name: product.name, stock_cleared: hasStock ? product.stock_quantity : 0 },
                    'success'
                );
                toast.success(`Produto inativado${movementMsg}.`);
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            await logAction(
                selectedAction === 'discontinue' ? 'Descontinuar Produto' :
                    selectedAction === 'deactivate' ? 'Inativar Produto' : 'Excluir Produto',
                { product_id: product?.id, name: product?.name, error: error.message },
                'failure'
            );
            toast.error('Erro ao processar: ' + error.message);
        } finally {
            setShowConfirm(false);
        }
    };

    const handleClearanceComplete = async (cleared: boolean) => {
        if (!cleared || !product) return;

        // Após zeramento, aplica a ação selecionada
        try {
            if (clearanceType === 'discontinue') {
                await supabase
                    .from('products')
                    .update({
                        is_discontinued: true,
                        active: false,
                        images: []
                    })
                    .eq('id', product.id);

                // Deletar imagens do bucket
                if (product.images && product.images.length > 0) {
                    const pathsToDelete = product.images
                        .map(url => {
                            try {
                                const urlObj = new URL(url);
                                const parts = urlObj.pathname.split('/products/');
                                return parts.length > 1 ? parts[1] : null;
                            } catch { return null; }
                        })
                        .filter((p): p is string => p !== null);

                    if (pathsToDelete.length > 0) {
                        await supabase.storage.from('products').remove(pathsToDelete);
                    }
                }

                await logAction(
                    'Descontinuar Produto',
                    { product_id: product.id, name: product.name, stock_cleared: product.stock_quantity },
                    'success'
                );
                toast.success(`Produto descontinuado, com baixa de ${product.stock_quantity} itens no estoque.`);

            } else if (clearanceType === 'deactivate') {
                await supabase
                    .from('products')
                    .update({ active: false })
                    .eq('id', product.id);

                await logAction(
                    'Inativar Produto',
                    { product_id: product.id, name: product.name, stock_cleared: product.stock_quantity },
                    'success'
                );
                toast.success(`Produto inativado, com baixa de ${product.stock_quantity} itens no estoque.`);
            }

            onSuccess();
            onClose();
            setShowClearance(false);
        } catch (error: any) {
            await logAction(
                clearanceType === 'discontinue' ? 'Descontinuar Produto' : 'Inativar Produto',
                { product_id: product.id, name: product.name, error: error.message },
                'failure'
            );
            toast.error('Erro ao processar: ' + error.message);
        }
    };

    if (!isOpen || !product) return null;

    // Determinar quais opções mostrar
    const canDelete = !hasMovements;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            Gerenciar Produto
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Produto: <strong>{product.name}</strong>
                        </p>
                    </div>

                    <div className="p-6 space-y-3">
                        {isAlreadyInactive && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
                                <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">
                                    ⚠️ Este produto já está INATIVO.
                                </p>
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                    A opção de inativar não está disponível. Você pode apenas descontinuar ou excluir.
                                </p>
                            </div>
                        )}

                        {hasMovements && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
                                <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">
                                    ⚠️ Este produto possui histórico de movimentações.
                                </p>
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                    A exclusão permanente não está disponível.
                                </p>
                            </div>
                        )}

                        {hasStock && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                                <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                                    📦 Estoque atual: <strong>{product.stock_quantity} unidades</strong>
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Será necessário zerar o estoque antes de prosseguir.
                                </p>
                            </div>
                        )}

                        {/* Opção: Descontinuar */}
                        <button
                            onClick={() => handleActionSelect('discontinue')}
                            className="w-full p-4 text-left border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                    ⚠️
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white">Descontinuar Produto</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Remove da lista de produtos e controle de estoque, apaga imagens.
                                        {hasStock ? ' Requer zeramento do estoque.' : ' Mantém histórico de movimentações.'}
                                    </p>
                                </div>
                            </div>
                        </button>

                        {/* Opção: Inativar (apenas se já não estiver inativo) */}
                        {!isAlreadyInactive && (
                            <button
                                onClick={() => handleActionSelect('deactivate')}
                                className="w-full p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400">
                                        ⏸️
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">Inativar Produto</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Mantém na lista de produtos (filtro inativos), remove do controle de estoque.
                                            {hasStock ? ' Requer zeramento do estoque.' : ' Imagens preservadas.'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        )}

                        {/* Opção: Excluir (apenas se não tiver movimentações) */}
                        {canDelete && (
                            <button
                                onClick={() => handleActionSelect('delete')}
                                className="w-full p-4 text-left border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                                        🗑️
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">Excluir Permanentemente</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Remove completamente do sistema e apaga imagens.
                                        </p>
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de confirmação com senha */}
            <SecurityConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirm}
                title={`Confirmar ${selectedAction === 'discontinue' ? 'descontinuação' :
                        selectedAction === 'deactivate' ? 'inativação' :
                            'exclusão'
                    }`}
                description={`Deseja ${selectedAction === 'discontinue' ? 'descontinuar' :
                        selectedAction === 'deactivate' ? 'inativar' :
                            'excluir permanentemente'
                    } o produto "${product.name}"?${hasStock && selectedAction !== 'delete'
                        ? ` O estoque de ${product.stock_quantity} unidades será zerado.`
                        : ''
                    }${(selectedAction === 'discontinue' || selectedAction === 'deactivate') && reason
                        ? ` Motivo: ${reason}`
                        : ''
                    }`}
                confirmText="Confirmar"
                cancelText="Cancelar"
                requireToken={true}
                tokenExpirySeconds={tokenExpirySeconds}
                maxTokenAttempts={maxTokenAttempts}
            />

            {/* Modal de zeramento (apenas para descontinuar/inativar com estoque) */}
            {showClearance && product && (
                <StockClearanceModal
                    isOpen={showClearance}
                    onClose={() => setShowClearance(false)}
                    product={{
                        ...product,
                        category_id: product.category?.id || null,
                        physical_stock: product.stock_quantity,
                        discontinued: false,
                        is_discontinued: false,
                        reserved_stock: 0,
                        available_stock: 0,
                    } as ProductStock}
                    onSuccess={handleClearanceComplete}
                    clearanceType={clearanceType}
                    reason={reason}
                />
            )}
        </>
    );
}
