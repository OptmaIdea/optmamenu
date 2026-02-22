import { useEffect, useState } from 'react';
import { X, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import SecurityConfirmModal from '@/components/common/SecurityConfirmModal';
import { useStockMovement } from '@/pages/private/admin/products/inventory/hooks/useStockMovement';
import { useStoreSecurityConfig } from '@/hooks/useStoreSecurityConfig';
import { logAction } from '@/pages/private/admin/products/products/utils/securityLog';
import type { Product } from '../../types/product.types';

interface ReactivateProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSuccess: () => void;
}

export default function ReactivateProductModal({
    isOpen,
    onClose,
    product,
    onSuccess,
}: ReactivateProductModalProps) {
    const [quantity, setQuantity] = useState(product.stock_quantity || 0);
    const [reason, setReason] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const { registerMovement } = useStockMovement();
    const { tokenExpirySeconds, maxTokenAttempts } = useStoreSecurityConfig();

    if (!isOpen) return null;

    const buildReactivationReason = (productName: string, qty: number) => {
        const base = `Produto ${productName} reativado`;
        return qty > 0 ? `${base} com inclusão de ${qty} itens no estoque` : base;
    };

    useEffect(() => {
        if (!isOpen) return;
        const qty = Number(quantity) || 0;
        setReason(buildReactivationReason(product.name, qty));
    }, [isOpen, product.name, quantity]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseInt(quantity.toString());
        if (isNaN(qty) || qty < 0) {
            toast.error('Quantidade inválida');
            return;
        }
        if (!reason.trim()) {
            toast.error('Informe o motivo da reativação');
            return;
        }
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        try {
            const qty = parseInt(quantity.toString());

            // Se tiver quantidade, registra movimento de entrada
            if (qty > 0) {
                const success = await registerMovement({
                    productId: product.id,
                    quantity: qty,
                    type: 'entry',
                    reason: `Entrada de estoque por reativação: ${reason}`,
                });

                if (!success) {
                    toast.error('Erro ao registrar entrada de estoque');
                    setShowConfirm(false);
                    return;
                }
            }

            // Reativa o produto
            const { error } = await supabase
                .from('products')
                .update({ active: true })
                .eq('id', product.id);

            if (error) throw error;

            await logAction(
                'Reativar Produto',
                {
                    product_id: product.id,
                    name: product.name,
                    stock_entry: qty,
                    reason
                },
                'success'
            );

            const stockMsg = qty > 0 ? ` com entrada de ${qty} itens` : '';
            toast.success(`Produto reativado${stockMsg}.`);
            onSuccess();
            onClose();
        } catch (error: any) {
            await logAction(
                'Reativar Produto',
                { product_id: product.id, name: product.name, error: error.message },
                'failure'
            );
            toast.error('Erro ao reativar: ' + error.message);
        } finally {
            setShowConfirm(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                    <div className="p-4 flex justify-between items-center bg-green-600 text-white rounded-t-lg">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Package size={20} />
                            Reativar Produto
                        </h3>
                        <button onClick={onClose} className="text-white/80 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="text-sm font-bold text-green-800 dark:text-green-300 mb-2">
                                Reativação de Produto
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-400">
                                O produto <strong className="text-green-900 dark:text-green-200">{product.name}</strong> será reativado.
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                • Produto voltará a aparecer em Produtos e Controle de Estoque<br />
                                • Imagens já estão preservadas<br />
                                • Histórico de movimentações mantido
                            </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                            <p className="text-sm text-gray-500">Produto</p>
                            <p className="font-bold text-gray-900 dark:text-white">{product.name}</p>
                            <p className="text-xs text-gray-400">
                                Estoque atual: <strong className="text-gray-600">{product.stock_quantity} unidade(s)</strong>
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Quantidade de entrada *
                            </label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                min="0"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                                placeholder="0"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Deixe 0 se não houver entrada de estoque, ou informe a quantidade desejada.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Motivo da reativação *
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
                                className="w-full py-3 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                            >
                                Confirmar Reativação
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <SecurityConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirm}
                title="Confirmar reativação"
                description={`Confirme a reativação de "${product.name}"${quantity > 0 ? ` e entrada de ${quantity} unidades` : ''}.`}
                confirmText="Confirmar"
                cancelText="Cancelar"
                requireToken={true}
                tokenExpirySeconds={tokenExpirySeconds}
                maxTokenAttempts={maxTokenAttempts}
            />
        </>
    );
}
