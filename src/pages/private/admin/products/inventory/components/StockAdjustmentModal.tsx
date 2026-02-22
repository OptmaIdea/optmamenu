import { useState, useEffect } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import SecurityConfirmModal from '@/components/common/SecurityConfirmModal';
import { useStockAdjustment } from '@/pages/private/admin/products/inventory/hooks/useStockAdjustment';
import { useStoreSecurityConfig } from '@/hooks/useStoreSecurityConfig';
import type { ProductStock, AdjustmentType } from '../types/inventory.types';

interface StockAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: ProductStock | null;
    type: AdjustmentType | null;
    onSuccess: () => void;
}

export default function StockAdjustmentModal({
    isOpen,
    onClose,
    product,
    type,
    onSuccess,
}: StockAdjustmentModalProps) {
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const { processing, performAdjustment } = useStockAdjustment();
    const { tokenExpirySeconds, maxTokenAttempts } = useStoreSecurityConfig();

    useEffect(() => {
        if (isOpen) {
            setQuantity('');
            setReason('');
        }
    }, [isOpen]);

    if (!isOpen || !product || !type) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error('Quantidade inválida');
            return;
        }
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        const qty = parseInt(quantity);
        const result = await performAdjustment(product.id, qty, reason, type);
        if (result.success) {
            // Se for saída e o estoque zerou, descontinuar o produto
            if (type === 'exit') {
                const newStock = product.physical_stock - qty;
                if (newStock <= 0) {
                    // Descontinuar produto
                    const { error } = await supabase
                        .from('products')
                        .update({ is_discontinued: true, active: false })
                        .eq('id', product.id);

                    if (!error) {
                        toast.success('Estoque zerado! Produto descontinuado automaticamente.');
                    }
                }
            }
            onSuccess();
            onClose();
        }
        setShowConfirm(false);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                    <div className={`p-4 flex justify-between items-center ${type === 'entry' ? 'bg-green-600' : 'bg-red-600'} text-white rounded-t-lg`}>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            {type === 'entry' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                            {type === 'entry' ? 'Entrada de Estoque' : 'Saída / Perda'}
                        </h3>
                        <button onClick={onClose} className="text-white/80 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                            <p className="text-sm text-gray-500">Produto</p>
                            <p className="font-bold text-gray-900 dark:text-white">{product.name}</p>
                            <p className="text-xs text-gray-400">Físico atual: {product.physical_stock}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Quantidade
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                                placeholder="0"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Motivo
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                                placeholder={type === 'entry' ? 'Ex: Compra NF 123' : 'Ex: Quebra, consumo'}
                                required
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={processing}
                                className={`w-full py-3 rounded-lg font-bold text-white transition-colors flex items-center justify-center gap-2 ${type === 'entry'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-red-600 hover:bg-red-700'
                                    }`}
                            >
                                {processing ? 'Processando...' : 'Continuar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Modal de confirmação com senha + token */}
            <SecurityConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirm}
                title="Confirmar ajuste de estoque"
                description={`Confirme o ajuste de ${quantity} unidade(s) com a senha de estoque.`}
                confirmText="Confirmar"
                cancelText="Cancelar"
                requireToken={true}
                tokenExpirySeconds={tokenExpirySeconds}
                maxTokenAttempts={maxTokenAttempts}
            />
        </>
    );
}