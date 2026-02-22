import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import SecurityConfirmModal from '@/components/common/SecurityConfirmModal';
import { useStockMovement } from '@/pages/private/admin/products/inventory/hooks/useStockMovement';
import { useStoreSecurityConfig } from '@/hooks/useStoreSecurityConfig';
import type { ProductStock } from '../types/inventory.types';

interface StockClearanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: ProductStock | null;
    onSuccess: (cleared: boolean) => void;
    clearanceType?: 'discontinue' | 'deactivate';
    reason?: string;
}

export default function StockClearanceModal({
    isOpen,
    onClose,
    product,
    onSuccess,
    clearanceType = 'discontinue',
    reason = '',
}: StockClearanceModalProps) {
    const [internalReason, setInternalReason] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const { loading: processing, registerMovement } = useStockMovement();
    const { tokenExpirySeconds, maxTokenAttempts } = useStoreSecurityConfig();

    useEffect(() => {
        if (isOpen) {
            setInternalReason(reason || '');
        }
    }, [isOpen, reason]);

    if (!isOpen || !product) return null;

    const isDiscontinue = clearanceType === 'discontinue';
    const actionLabel = isDiscontinue ? 'Descontinuação' : 'Inativação';
    const actionVerb = isDiscontinue ? 'descontinuado' : 'inativado';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!internalReason.trim()) {
            toast.error('Informe o motivo');
            return;
        }
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        if (!product) return;

        const quantityToClear = product.physical_stock;
        if (quantityToClear <= 0) {
            // Se já está zerado, apenas retorna sucesso
            onSuccess(true);
            onClose();
            return;
        }

        // Registra movimento de zeramento (clearance)
        const success = await registerMovement({
            productId: product.id,
            quantity: quantityToClear,
            type: 'clearance',
            reason: `${actionLabel}: ${internalReason}`,
        });

        if (success) {
            toast.success(`Estoque zerado para ${actionVerb.toLowerCase()}`);
            onSuccess(true);
            onClose();
        }
        setShowConfirm(false);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                    <div className="p-4 flex justify-between items-center bg-orange-600 text-white rounded-t-lg">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <AlertTriangle size={20} />
                            Zeramento de Estoque
                        </h3>
                        <button onClick={onClose} className="text-white/80 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                            <p className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-2">
                                Atenção: Esta ação é irreversível!
                            </p>
                            <p className="text-sm text-orange-700 dark:text-orange-400">
                                O produto <strong className="text-orange-900 dark:text-orange-200">{product.name}</strong> será {actionVerb} e todo o estoque restante será zerado.
                            </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                            <p className="text-sm text-gray-500">Produto</p>
                            <p className="font-bold text-gray-900 dark:text-white">{product.name}</p>
                            <p className="text-xs text-gray-400">
                                Estoque atual: <strong className="text-orange-600">{product.physical_stock} unidade(s)</strong>
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Motivo da {actionLabel.toLowerCase()} *
                            </label>
                            <textarea
                                value={internalReason}
                                onChange={(e) => setInternalReason(e.target.value)}
                                readOnly={!!reason}
                                className={`w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none ${
                                    reason 
                                        ? 'bg-gray-100 dark:bg-gray-900/50 text-gray-900 dark:text-white cursor-not-allowed' 
                                        : 'bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white'
                                }`}
                                placeholder={`Ex: Produto ${isDiscontinue ? 'fora de linha, substituído' : 'temporariamente indisponível'}, etc.`}
                                rows={3}
                                required
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full py-3 rounded-lg font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {processing ? 'Processando...' : `Zerar Estoque e ${isDiscontinue ? 'Descontinuar' : 'Inativar'}`}
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
                title="Confirmar zeramento de estoque"
                description={`Confirme o zeramento de ${product?.physical_stock} unidade(s) com a senha de estoque.`}
                confirmText="Confirmar"
                cancelText="Cancelar"
                requireToken={true}
                tokenExpirySeconds={tokenExpirySeconds}
                maxTokenAttempts={maxTokenAttempts}
            />
        </>
    );
}
