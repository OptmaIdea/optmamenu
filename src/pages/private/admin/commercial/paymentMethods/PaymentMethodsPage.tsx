import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
    Banknote,
    CreditCard,
    Landmark,
    MoreHorizontal,
    QrCode,
    RefreshCw,
    Ticket,
    ToggleLeft,
    ToggleRight,
    Clock,
    ReceiptText,
    WalletCards,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import {
    PaymentMethodsService,
    type PaymentMethodCode,
    type StorePaymentMethod,
} from '@/services/paymentMethodsService';

const METHOD_ICONS: Record<PaymentMethodCode, React.ElementType> = {
    pending: Clock,
    cash: Banknote,
    pix: QrCode,
    debit_card: CreditCard,
    credit_card: CreditCard,
    bank_transfer: Landmark,
    voucher: Ticket,
    other: MoreHorizontal,
};

const METHOD_HINTS: Record<PaymentMethodCode, string> = {
    pending: 'Permite que o cliente combine o pagamento pelo WhatsApp.',
    cash: 'Útil para retirada, entrega e troco.',
    pix: 'Ideal como forma principal de pagamento digital.',
    debit_card: 'Mapeado internamente como cartão.',
    credit_card: 'Mapeado internamente como cartão.',
    bank_transfer: 'Pode ser usado futuramente para transferências manuais.',
    voucher: 'Preparação para benefícios, vales ou vouchers.',
    other: 'Forma genérica para exceções.',
};

function statusBadge(active: boolean) {
    return active
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
}

export default function PaymentMethodsPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();
    const [methods, setMethods] = useState<StorePaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const publicMethodsCount = useMemo(
        () => methods.filter((method) => method.active && method.public_enabled).length,
        [methods]
    );

    /*     const activeMethodsCount = useMemo(
            () => methods.filter((method) => method.active).length,
            [methods]
        ); */

    const cashbookMethodsCount = useMemo(
        () => methods.filter((method) => method.active && method.affects_cashbook).length,
        [methods]
    );

    async function loadMethods() {
        if (!storeId) return;

        try {
            setLoading(true);
            setError(null);
            const data = await PaymentMethodsService.listByStore(storeId);
            setMethods(data);
        } catch (err: any) {
            console.error('Erro ao carregar formas de pagamento:', err);
            setError(err?.message || 'Erro ao carregar formas de pagamento.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadMethods();
        }
    }, [loadingStore, storeId]);

    async function toggleMethod(
        method: StorePaymentMethod,
        field: 'active' | 'public_enabled' | 'requires_proof' | 'requires_change_for' | 'affects_cashbook'
    ) {
        try {
            setSavingId(method.id);

            const updated = await PaymentMethodsService.update({
                id: method.id,
                [field]: !method[field],
            });

            setMethods((prev) =>
                prev.map((item) => (item.id === updated.id ? updated : item))
            );
        } catch (err: any) {
            console.error('Erro ao atualizar forma de pagamento:', err);
            alert(err?.message || 'Erro ao atualizar forma de pagamento.');
        } finally {
            setSavingId(null);
        }
    }

    if (loadingStore || loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-800">
                    <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="mt-4 h-4 w-96 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Comercial
                        </div>

                        <h1 className="mt-3 text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                            Formas de pagamento
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                            Configure quais formas de pagamento a loja aceita. Esta base será usada
                            no pedido público, vendas diretas e livro diário de caixa.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadMethods}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <RefreshCw size={16} />
                        Atualizar
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
                        <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            Cadastradas
                        </p>
                        <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                            {methods.length}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
                        <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                            Públicas
                        </p>
                        <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">
                            {publicMethodsCount}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-900/20">
                        <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                            Entram no caixa
                        </p>
                        <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">
                            {cashbookMethodsCount}
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {methods.map((method) => {
                    const Icon = METHOD_ICONS[method.code] || WalletCards;
                    const disabled = savingId === method.id;

                    return (
                        <div
                            key={method.id}
                            className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                                    <Icon size={24} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                                {method.name}
                                            </h2>
                                            <p className="mt-1 text-xs font-mono text-gray-400">
                                                {method.code}
                                            </p>
                                        </div>

                                        <span
                                            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${statusBadge(
                                                method.active
                                            )}`}
                                        >
                                            {method.active ? 'Ativa' : 'Inativa'}
                                        </span>
                                    </div>

                                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                                        {method.description || METHOD_HINTS[method.code]}
                                    </p>

                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                                        {METHOD_HINTS[method.code]}
                                    </p>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => toggleMethod(method, 'active')}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                            {method.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                            {method.active ? 'Desativar' : 'Ativar'}
                                        </button>

                                        <button
                                            type="button"
                                            disabled={disabled || !method.active}
                                            onClick={() => toggleMethod(method, 'public_enabled')}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                            {method.public_enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                            {method.public_enabled ? 'Ocultar no público' : 'Exibir no público'}
                                        </button>

                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => toggleMethod(method, 'requires_proof')}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                            <ReceiptText size={18} />
                                            {method.requires_proof ? 'Com comprovante' : 'Sem comprovante'}
                                        </button>

                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => toggleMethod(method, 'affects_cashbook')}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                            <WalletCards size={18} />
                                            {method.affects_cashbook ? 'Entra no caixa' : 'Não entra no caixa'}
                                        </button>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {method.public_enabled && (
                                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                público
                                            </span>
                                        )}

                                        {method.requires_proof && (
                                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                exige comprovante
                                            </span>
                                        )}

                                        {method.requires_change_for && (
                                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                pergunta troco
                                            </span>
                                        )}

                                        {method.affects_cashbook && (
                                            <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                caixa
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                <strong>Nota da Fase 8:</strong> esta tela configura as formas aceitas.
                O lançamento financeiro no livro diário de caixa será tratado na Sprint 8.6.
            </div>
        </div>
    );
}