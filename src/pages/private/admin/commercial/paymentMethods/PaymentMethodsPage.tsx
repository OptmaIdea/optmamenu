import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Banknote,
    CreditCard,
    Landmark,
    MoreHorizontal,
    QrCode,
    Ticket,
    ToggleLeft,
    ToggleRight,
    Clock,
    ReceiptText,
    WalletCards,
    ArrowRight,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import PageContainer from '@/components/common/PageContainer';
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
    pending: 'Pagamento ainda não definido no momento do pedido.',
    cash: 'Pagamento em dinheiro, com suporte a troco quando necessário.',
    pix: 'Pagamento instantâneo por Pix.',
    debit_card: 'Pagamento com cartão de débito.',
    credit_card: 'Pagamento com cartão de crédito.',
    bank_transfer: 'Pagamento por transferência bancária.',
    voucher: 'Vale, benefício ou voucher aceito pela loja.',
    other: 'Forma adicional para situações específicas da operação.',
};

function statusBadge(active: boolean) {
    return active
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
}

export default function PaymentMethodsPage({ withoutHeader = false, disabled = false }: { withoutHeader?: boolean; disabled?: boolean } = {}) {
    const { storeId, loading: loadingStore } = useCurrentStore();
    const [methods, setMethods] = useState<StorePaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const publicMethodsCount = useMemo(
        () => methods.filter((method) => method.active && method.public_enabled).length,
        [methods]
    );

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
        if (!loadingStore && storeId) void loadMethods();
    }, [loadingStore, storeId]);

    async function toggleMethod(
        method: StorePaymentMethod,
        field: 'active' | 'public_enabled' | 'requires_proof' | 'requires_change_for' | 'affects_cashbook'
    ) {
        if (disabled) {
            toast.error('Você não tem permissão para executar esta alteração.');
            return;
        }
        try {
            setSavingId(method.id);
            const updated = await PaymentMethodsService.update({
                id: method.id,
                [field]: !method[field],
            });
            setMethods((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        } catch (err: any) {
            console.error('Erro ao atualizar forma de pagamento:', err);
            toast.error(err?.message || 'Erro ao atualizar forma de pagamento.');
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
        <PageContainer
            title="Formas de pagamento"
            subtitle="Configure as formas que a loja aceita no pedido público, vendas diretas e Livro Diário."
            category="Comercial"
            icon={<WalletCards size={28} className="text-[#19A999]" />}
            onRefresh={loadMethods}
            withoutHeader={withoutHeader}
            flat
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-150 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Cadastradas</p>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{methods.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                    <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">Públicas</p>
                    <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">{publicMethodsCount}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-900/20">
                    <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Entram no caixa</p>
                    <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">{cashbookMethodsCount}</p>
                </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-100 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="font-black">Conta compatível e pré-conciliação</p>
                    <p className="mt-1 font-semibold opacity-80">A forma de pagamento define quais contas podem receber e para onde os valores podem ser transferidos.</p>
                </div>
                <Link to="/admin/financial-accounts?tab=settings" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 font-black text-white">
                    Contas e regras <ArrowRight size={16} />
                </Link>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">{error}</div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {methods.map((method) => {
                    const Icon = METHOD_ICONS[method.code] || WalletCards;
                    const isSaving = savingId === method.id;
                    return (
                        <div key={method.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"><Icon size={24} /></div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <h2 className="text-lg font-black text-gray-900 dark:text-white">{method.name}</h2>
                                        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${statusBadge(method.active)}`}>{method.active ? 'Ativa' : 'Inativa'}</span>
                                    </div>
                                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{method.description || METHOD_HINTS[method.code]}</p>

                                    {!disabled && (
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <button type="button" disabled={isSaving} onClick={() => void toggleMethod(method, 'active')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">{method.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}{method.active ? 'Desativar' : 'Ativar'}</button>
                                            <button type="button" disabled={isSaving || !method.active} onClick={() => void toggleMethod(method, 'public_enabled')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">{method.public_enabled ? 'Ocultar no público' : 'Exibir no público'}</button>
                                            <button type="button" disabled={isSaving} onClick={() => void toggleMethod(method, 'requires_proof')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><ReceiptText size={18} />{method.requires_proof ? 'Com comprovante' : 'Sem comprovante'}</button>
                                            <button type="button" disabled={isSaving} onClick={() => void toggleMethod(method, 'affects_cashbook')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><WalletCards size={18} />{method.affects_cashbook ? 'Entra no caixa' : 'Não entra no caixa'}</button>
                                        </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {method.public_enabled && <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">público</span>}
                                        {method.requires_proof && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">exige comprovante</span>}
                                        {method.requires_change_for && <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">pergunta troco</span>}
                                        {method.affects_cashbook && <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">caixa</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </PageContainer>
    );
}
