import { CreditCard, Banknote, QrCode, X } from 'lucide-react';
import { useState } from 'react';
import type { Order } from '@/types';

export type FinalPaymentMethodCode = 'pix' | 'cash' | 'debit_card' | 'credit_card';

interface OrderPaymentModalProps {
    order: Order | null;
    loading?: boolean;
    onClose: () => void;
    onConfirm: (method: FinalPaymentMethodCode) => Promise<void> | void;
}

const METHODS: Array<{
    code: FinalPaymentMethodCode;
    label: string;
    description: string;
    icon: typeof QrCode;
}> = [
    { code: 'pix', label: 'PIX', description: 'Pagamento recebido por PIX', icon: QrCode },
    { code: 'cash', label: 'Dinheiro', description: 'Pagamento recebido em espécie', icon: Banknote },
    { code: 'debit_card', label: 'Cartão de débito', description: 'Pagamento no débito', icon: CreditCard },
    { code: 'credit_card', label: 'Cartão de crédito', description: 'Pagamento no crédito', icon: CreditCard },
];

function compactCode(value?: string | null) {
    const suffix = String(value || '').split('-').pop();
    return suffix ? `#${suffix}` : '#PEDIDO';
}

export default function OrderPaymentModal({ order, loading = false, onClose, onConfirm }: OrderPaymentModalProps) {
    const [selected, setSelected] = useState<FinalPaymentMethodCode>('pix');

    if (!order) return null;
    const orderCode = (order as Order & { order_code?: string }).order_code || order.id;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-850">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-brand-green">Finalizar pedido</p>
                        <h2 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">Confirme o pagamento</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {compactCode(orderCode)} · {order.customer_name || 'Cliente'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} disabled={loading} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <X size={20} />
                    </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {METHODS.map((method) => {
                        const Icon = method.icon;
                        const active = selected === method.code;
                        return (
                            <button
                                key={method.code}
                                type="button"
                                onClick={() => setSelected(method.code)}
                                disabled={loading}
                                className={`rounded-2xl border-2 p-4 text-left transition ${active
                                    ? 'border-brand-green bg-brand-green/5'
                                    : 'border-gray-200 hover:border-brand-green/40 dark:border-gray-700'
                                }`}
                            >
                                <Icon size={22} className={active ? 'text-brand-green' : 'text-gray-400'} />
                                <span className="mt-3 block font-black text-gray-900 dark:text-white">{method.label}</span>
                                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{method.description}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm dark:bg-gray-800">
                    <div className="flex justify-between gap-4">
                        <span className="text-gray-500">Total a registrar</span>
                        <strong className="text-lg text-gray-900 dark:text-white">
                            {Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                    </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} disabled={loading} className="rounded-xl border border-gray-200 px-5 py-3 font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                        Voltar
                    </button>
                    <button type="button" onClick={() => onConfirm(selected)} disabled={loading} className="rounded-xl bg-green-600 px-6 py-3 font-black text-white hover:bg-green-700 disabled:opacity-60">
                        {loading ? 'Finalizando...' : 'Confirmar pagamento e finalizar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
