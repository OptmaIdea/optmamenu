import { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import SecurityConfirmModal from '@/components/common/SecurityConfirmModal';
import { useStockMovement } from '@/pages/private/admin/products/inventory/hooks/useStockMovement';
import { useStoreSecurityConfig } from '@/hooks/useStoreSecurityConfig';
import { logAction } from '@/pages/private/admin/products/products/utils/securityLog';
import type { Product } from '../../types/product.types';

interface DeactivateProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSuccess: () => void;
}

export default function DeactivateProductModal({
    isOpen,
    onClose,
    product,
    onSuccess,
}: DeactivateProductModalProps) {
    const [reason, setReason] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const { registerMovement } = useStockMovement();
    const { tokenExpirySeconds, maxTokenAttempts } = useStoreSecurityConfig();

    if (!isOpen) return null;

    const hasStock = (product.stock_quantity || 0) > 0;

    const buildDeactivationReason = (productName: string, stockQty: number) => {
        const base = `Produto ${productName} inativado`;
        return stockQty > 0 ? `${base} com baixa de ${stockQty} itens no estoque` : base;
    };

    useEffect(() => {
        if (!isOpen) return;
        const stockQty = Number(product.stock_quantity) || 0;
        setReason(buildDeactivationReason(product.name, stockQty));
    }, [isOpen, product.name, product.stock_quantity]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            toast.error('Informe o motivo da inativação');
            return;
        }
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        try {
            // Se tiver estoque, registra movimento de saída (clearance)
            if (hasStock) {
                const success = await registerMovement({
                    productId: product.id,
                    quantity: product.stock_quantity,
                    type: 'clearance',
                    reason: `Inativação: ${reason}`,
                });

                if (!success) {
                    toast.error('Erro ao zerar estoque');
                    setShowConfirm(false);
                    return;
                }
            }

            // Inativa o produto
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
            onSuccess();
            onClose();
        } catch (error: any) {
            await logAction(
                'Inativar Produto',
                { product_id: product.id, name: product.name, error: error.message },
                'failure'
            );
            toast.error('Erro ao inativar: ' + error.message);
        } finally {
            setShowConfirm(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                    <div className="p-4 flex justify-between items-center bg-orange-600 text-white rounded-t-lg">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <AlertTriangle size={20} />
                            Inativar Produto
                        </h3>
                        <button onClick={onClose} className="text-white/80 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                            <p className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-2">
                                Atenção!
                            </p>
                            <p className="text-sm text-orange-700 dark:text-orange-400">
                                O produto <strong className="text-orange-900 dark:text-orange-200">{product.name}</strong> será inativado.
                                {hasStock && ` O estoque de ${product.stock_quantity} unidades será zerado.`}
                            </p>
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                                • Produto continuará visível em Produtos (filtro inativos)<br />
                                • Não aparecerá em Controle de Estoque<br />
                                • Imagens serão preservadas<br />
                                • Histórico de movimentações mantido
                            </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                            <p className="text-sm text-gray-500">Produto</p>
                            <p className="font-bold text-gray-900 dark:text-white">{product.name}</p>
                            <p className="text-xs text-gray-400">
                                Estoque atual: <strong className="text-orange-600">{product.stock_quantity} unidade(s)</strong>
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Motivo da inativação *
                            </label>
                            <textarea
                                value={reason}
                                readOnly
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                                rows={3}
                                required
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                className="w-full py-3 rounded-lg font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                            >
                                Confirmar Inativação
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <SecurityConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirm}
                title="Confirmar inativação"
                description={`Confirme a inativação de "${product.name}"${hasStock ? ` e zeramento de ${product.stock_quantity} unidades` : ''}.`}
                confirmText="Confirmar"
                cancelText="Cancelar"
                requireToken={true}
                tokenExpirySeconds={tokenExpirySeconds}
                maxTokenAttempts={maxTokenAttempts}
            />
        </>
    );
}
