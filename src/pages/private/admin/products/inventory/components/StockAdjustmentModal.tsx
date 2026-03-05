import { useState, useEffect } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import SecurityConfirmModal from '@/components/common/SecurityConfirmModal';
import { useStockAdjustment } from '@/pages/private/admin/products/inventory/hooks/useStockAdjustment';
import { useStoreSecurityConfig } from '@/hooks/useStoreSecurityConfig';
import { useSuppliers } from '@/pages/private/admin/products/suppliers/hooks/useSuppliers';
import type { ProductStock, AdjustmentType } from '../types/inventory.types';

type InlineSupplierInput = {
    name: string;
    document?: string;
    phone?: string;
};

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
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [unitCost, setUnitCost] = useState('');

    const [supplierId, setSupplierId] = useState<string>('');
    const [showSupplierCreate, setShowSupplierCreate] = useState(false);
    const [newSupplier, setNewSupplier] = useState<InlineSupplierInput>({ name: '' });
    const [showConfirm, setShowConfirm] = useState(false);
    const { processing, performAdjustment } = useStockAdjustment();
    const { tokenExpirySeconds, maxTokenAttempts } = useStoreSecurityConfig();
    const { activeSuppliers, upsertSupplier, saving } = useSuppliers();

    useEffect(() => {
        if (isOpen) {
            setQuantity('');
            setReason('');
            setInvoiceNumber('');
            setUnitCost('');
            setSupplierId('');
            setShowSupplierCreate(false);
            setNewSupplier({ name: '' });
        }
    }, [isOpen]);

    if (!isOpen || !product || !type) return null;

    const handleCreateSupplier = async () => {
        const name = (newSupplier.name ?? '').trim();
        if (!name) {
            toast.error('Informe o nome do fornecedor');
            return;
        }

        const created = await upsertSupplier({
            name,
            document: newSupplier.document?.trim() || undefined,
            phone: newSupplier.phone?.trim() || undefined,
            email: undefined,
            notes: undefined,
            active: true,
        });

        if (created?.id) {
            setSupplierId(created.id);
            setShowSupplierCreate(false);
            setNewSupplier({ name: '' });
        }
    };

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

        const meta =
    type === 'entry'
        ? {
              invoice_number: invoiceNumber.trim() || undefined,
              unit_cost: unitCost !== '' ? Number(unitCost) : undefined,
              total_cost:
                  unitCost !== '' ? Number(unitCost) * qty : undefined,
          }
        : undefined;

const result = await performAdjustment(
    product.id,
    qty,
    reason,
    type,
    type === 'entry' ? (supplierId || undefined) : undefined,
    meta
);
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

                        {type === 'entry' && activeSuppliers.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                        Fornecedor (opcional)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowSupplierCreate(true)}
                                        className="text-sm font-bold text-[#7C3AED] hover:underline"
                                    >
                                        + Novo
                                    </button>
                                </div>
                                <select
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                                >
                                    <option value="">Selecione...</option>
                                    {activeSuppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {type === 'entry' && activeSuppliers.length === 0 && (
                            <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Fornecedor</p>
                                        <p className="text-xs text-gray-500">Você ainda não cadastrou fornecedores.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowSupplierCreate(true)}
                                        className="px-3 py-2 rounded-lg font-bold text-white bg-[#7C3AED] hover:opacity-90"
                                    >
                                        Cadastrar
                                    </button>
                                </div>
                            </div>
                        )}

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

{type === 'entry' && (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                Nº NF / Referência (opcional)
            </label>
            <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                placeholder="Ex: NF 1234"
            />
        </div>

        <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                Custo unitário (opcional)
            </label>
            <input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                placeholder="0,00"
            />
            {unitCost !== '' && quantity !== '' && (
                <p className="mt-1 text-xs text-gray-500">
                    Total estimado: R$ {(Number(unitCost) * Number(quantity || 0)).toFixed(2)}
                </p>
            )}
        </div>
    </div>
)}

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

            {/* Modal rápido: criar fornecedor */}
            {showSupplierCreate && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-4 flex justify-between items-center bg-[#7C3AED] text-white rounded-t-lg">
                            <h3 className="font-bold text-lg">Novo fornecedor</h3>
                            <button
                                type="button"
                                onClick={() => setShowSupplierCreate(false)}
                                className="text-white/80 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Nome
                                </label>
                                <input
                                    value={newSupplier.name}
                                    onChange={(e) => setNewSupplier((p) => ({ ...p, name: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                                    placeholder="Ex: Distribuidora X"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Documento
                                    </label>
                                    <input
                                        value={newSupplier.document ?? ''}
                                        onChange={(e) => setNewSupplier((p) => ({ ...p, document: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                                        placeholder="CNPJ/CPF"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Telefone
                                    </label>
                                    <input
                                        value={newSupplier.phone ?? ''}
                                        onChange={(e) => setNewSupplier((p) => ({ ...p, phone: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSupplierCreate(false)}
                                    className="flex-1 py-3 rounded-lg font-bold border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateSupplier}
                                    disabled={saving}
                                    className="flex-1 py-3 rounded-lg font-bold text-white bg-[#7C3AED] hover:opacity-90 disabled:opacity-60"
                                >
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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