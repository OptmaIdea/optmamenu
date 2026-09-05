import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ArrowRight,
    Banknote,
    Clock,
    CreditCard,
    Landmark,
    Link2,
    Loader2,
    MoreHorizontal,
    Plus,
    QrCode,
    ReceiptText,
    Save,
    Ticket,
    ToggleLeft,
    ToggleRight,
    WalletCards,
    X,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import PageContainer from '@/components/common/PageContainer';
import {
    PaymentMethodsService,
    type BasePaymentMethodCode,
    type StorePaymentMethod,
} from '@/services/paymentMethodsService';
import { FinancialAccountsService, type FinancialAccountBalance } from '@/services/financialAccountsService';

const METHOD_ICONS: Record<BasePaymentMethodCode, React.ElementType> = {
    pending: Clock,
    cash: Banknote,
    pix: QrCode,
    debit_card: CreditCard,
    credit_card: CreditCard,
    bank_transfer: Landmark,
    voucher: Ticket,
    other: MoreHorizontal,
};

const METHOD_HINTS: Record<BasePaymentMethodCode, string> = {
    pending: 'Pagamento ainda não definido no momento do pedido.',
    cash: 'Pagamento em dinheiro, com suporte a troco quando necessário.',
    pix: 'Pagamento instantâneo por Pix.',
    debit_card: 'Pagamento com cartão de débito.',
    credit_card: 'Pagamento com cartão de crédito.',
    bank_transfer: 'Pagamento por transferência bancária.',
    voucher: 'Vale, benefício ou voucher aceito pela loja.',
    other: 'Forma adicional para situações específicas da operação.',
};

const VARIANT_BASES: Array<{ code: Exclude<BasePaymentMethodCode, 'pending'>; label: string }> = [
    { code: 'cash', label: 'Dinheiro' },
    { code: 'pix', label: 'Pix' },
    { code: 'debit_card', label: 'Cartão de débito' },
    { code: 'credit_card', label: 'Cartão de crédito' },
    { code: 'bank_transfer', label: 'Transferência bancária' },
    { code: 'voucher', label: 'Voucher / benefício' },
    { code: 'other', label: 'Outro' },
];

const EMPTY_VARIANT = {
    id: null as string | null,
    name: '',
    baseCode: 'debit_card' as Exclude<BasePaymentMethodCode, 'pending'>,
    description: '',
    preferredFinancialAccountId: '',
    active: true,
    publicEnabled: false,
    requiresProof: true,
    requiresChangeFor: false,
    affectsCashbook: true,
};

function statusBadge(active: boolean) {
    return active
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
}

export default function PaymentMethodsPage({ withoutHeader = false, disabled = false }: { withoutHeader?: boolean; disabled?: boolean } = {}) {
    const { storeId, loading: loadingStore } = useCurrentStore();
    const [methods, setMethods] = useState<StorePaymentMethod[]>([]);
    const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountBalance[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [variantOpen, setVariantOpen] = useState(false);
    const [variantSaving, setVariantSaving] = useState(false);
    const [variant, setVariant] = useState(EMPTY_VARIANT);

    const publicMethodsCount = useMemo(
        () => methods.filter((method) => method.active && method.public_enabled).length,
        [methods]
    );

    const cashbookMethodsCount = useMemo(
        () => methods.filter((method) => method.active && method.affects_cashbook).length,
        [methods]
    );

    const customMethodsCount = useMemo(
        () => methods.filter((method) => method.is_custom_variant).length,
        [methods]
    );

    async function loadMethods() {
        if (!storeId) return;
        try {
            setLoading(true);
            setError(null);
            const data = await PaymentMethodsService.listByStore(storeId);
            setMethods(data);

            try {
                const financial = await FinancialAccountsService.getBalances(storeId);
                setFinancialAccounts(financial.accounts.filter((account) => account.active));
            } catch (financialError) {
                console.warn('Contas financeiras indisponíveis na configuração de pagamento:', financialError);
                setFinancialAccounts([]);
            }
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
            await PaymentMethodsService.update({ id: method.id, [field]: !method[field] });
            await loadMethods();
        } catch (err: any) {
            console.error('Erro ao atualizar forma de pagamento:', err);
            toast.error(err?.message || 'Erro ao atualizar forma de pagamento.');
        } finally {
            setSavingId(null);
        }
    }

    function startVariant(method?: StorePaymentMethod) {
        if (method?.is_custom_variant) {
            setVariant({
                id: method.id,
                name: method.name,
                baseCode: method.base_code === 'pending' ? 'other' : method.base_code,
                description: method.description || '',
                preferredFinancialAccountId: method.preferred_financial_account_id || '',
                active: method.active,
                publicEnabled: method.public_enabled,
                requiresProof: method.requires_proof,
                requiresChangeFor: method.requires_change_for,
                affectsCashbook: method.affects_cashbook,
            });
        } else {
            setVariant(EMPTY_VARIANT);
        }
        setVariantOpen(true);
    }

    function closeVariant() {
        setVariantOpen(false);
        setVariant(EMPTY_VARIANT);
    }

    async function saveVariant(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!storeId) return;
        if (!variant.name.trim()) return toast.error('Informe um nome amigável para a forma de pagamento.');
        if (!variant.preferredFinancialAccountId) return toast.error('Vincule a forma específica à conta financeira usada na conferência.');

        try {
            setVariantSaving(true);
            await PaymentMethodsService.saveVariant({
                storeId,
                methodId: variant.id,
                name: variant.name,
                baseCode: variant.baseCode,
                description: variant.description,
                preferredFinancialAccountId: variant.preferredFinancialAccountId,
                active: variant.active,
                publicEnabled: variant.publicEnabled,
                requiresProof: variant.requiresProof,
                requiresChangeFor: variant.requiresChangeFor,
                affectsCashbook: variant.affectsCashbook,
                sortOrder: variant.id ? methods.find((method) => method.id === variant.id)?.sort_order ?? 500 : 500,
            });
            toast.success(variant.id ? 'Forma específica atualizada.' : 'Forma específica criada e vinculada à conta.');
            closeVariant();
            await loadMethods();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao salvar forma específica.');
        } finally {
            setVariantSaving(false);
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
            subtitle="Configure as formas aceitas e, quando necessário, crie variações específicas por banco, carteira ou maquininha."
            category="Comercial"
            icon={<WalletCards size={28} className="text-[#19A999]" />}
            onRefresh={loadMethods}
            withoutHeader={withoutHeader}
            flat
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-gray-150 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Cadastradas</p><p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{methods.length}</p></div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/20"><p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">Públicas</p><p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">{publicMethodsCount}</p></div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-900/20"><p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Entram no caixa</p><p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">{cashbookMethodsCount}</p></div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-900/20"><p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Específicas</p><p className="mt-2 text-2xl font-black text-violet-900 dark:text-violet-100">{customMethodsCount}</p></div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-100 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="font-black">Conta compatível e pré-conciliação</p>
                    <p className="mt-1 font-semibold opacity-80">Ex.: “Cartão de débito InfinitePay” continua sendo débito, mas já fica associado à conta InfinitePay para facilitar a conferência e a distribuição.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!disabled && financialAccounts.length > 0 && <button type="button" onClick={() => startVariant()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 font-black text-white"><Plus size={16} />Nova forma específica</button>}
                    <Link to="/admin/financial-accounts?tab=settings" className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 font-black text-white">Contas e regras <ArrowRight size={16} /></Link>
                </div>
            </div>

            {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {methods.map((method) => {
                    const baseCode = method.base_code || 'other';
                    const Icon = METHOD_ICONS[baseCode] || WalletCards;
                    const isSaving = savingId === method.id;
                    return (
                        <div key={method.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"><Icon size={24} /></div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-lg font-black text-gray-900 dark:text-white">{method.name}</h2>
                                                {method.is_custom_variant && <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">específica</span>}
                                            </div>
                                            {method.preferred_financial_account_name && <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-teal-700 dark:text-teal-300"><Link2 size={12} />Conferência: {method.preferred_financial_account_name}</p>}
                                        </div>
                                        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${statusBadge(method.active)}`}>{method.active ? 'Ativa' : 'Inativa'}</span>
                                    </div>
                                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{method.description || METHOD_HINTS[baseCode]}</p>

                                    {!disabled && (
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <button type="button" disabled={isSaving} onClick={() => void toggleMethod(method, 'active')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">{method.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}{method.active ? 'Desativar' : 'Ativar'}</button>
                                            <button type="button" disabled={isSaving || !method.active} onClick={() => void toggleMethod(method, 'public_enabled')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">{method.public_enabled ? 'Ocultar no público' : 'Exibir no público'}</button>
                                            <button type="button" disabled={isSaving} onClick={() => void toggleMethod(method, 'requires_proof')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><ReceiptText size={18} />{method.requires_proof ? 'Com comprovante' : 'Sem comprovante'}</button>
                                            <button type="button" disabled={isSaving} onClick={() => void toggleMethod(method, 'affects_cashbook')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><WalletCards size={18} />{method.affects_cashbook ? 'Entra no caixa' : 'Não entra no caixa'}</button>
                                            {method.is_custom_variant && <button type="button" onClick={() => startVariant(method)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300"><Link2 size={16} />Editar vínculo e nome</button>}
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

            {variantOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <form onSubmit={saveVariant} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
                        <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
                            <div><h3 className="font-black text-gray-900 dark:text-white">{variant.id ? 'Editar forma específica' : 'Nova forma específica'}</h3><p className="mt-1 text-xs font-semibold text-gray-400">Use para separar adquirentes, carteiras ou meios que precisam de conferência própria.</p></div>
                            <button type="button" onClick={closeVariant} className="rounded-xl border p-2 text-gray-500 dark:border-gray-700"><X size={16} /></button>
                        </div>
                        <div className="grid gap-4 p-5 md:grid-cols-2">
                            <label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Tipo-base</span><select value={variant.baseCode} disabled={Boolean(variant.id)} onChange={(event) => setVariant((current) => ({ ...current, baseCode: event.target.value as Exclude<BasePaymentMethodCode, 'pending'>, requiresProof: ['pix','debit_card','credit_card','bank_transfer'].includes(event.target.value), requiresChangeFor: event.target.value === 'cash' }))} className="w-full rounded-xl border px-3 py-2 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white">{VARIANT_BASES.map((base) => <option key={base.code} value={base.code}>{base.label}</option>)}</select></label>
                            <label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Nome exibido</span><input value={variant.name} onChange={(event) => setVariant((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Cartão de débito InfinitePay" className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" required /></label>
                            <label className="space-y-1 md:col-span-2"><span className="text-xs font-black uppercase text-gray-400">Conta preferencial para conferência</span><select value={variant.preferredFinancialAccountId} onChange={(event) => setVariant((current) => ({ ...current, preferredFinancialAccountId: event.target.value }))} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" required><option value="">Selecione a conta</option>{financialAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {accountTypeLabelForVariant(account.account_type)}</option>)}</select><p className="text-xs font-semibold text-gray-400">A conta passa a aceitar esta forma específica e será sugerida na pré-conciliação.</p></label>
                            <label className="space-y-1 md:col-span-2"><span className="text-xs font-black uppercase text-gray-400">Descrição</span><textarea value={variant.description} onChange={(event) => setVariant((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="Ex.: Vendas no débito processadas pela InfinitePay." className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200"><input type="checkbox" checked={variant.active} onChange={(event) => setVariant((current) => ({ ...current, active: event.target.checked }))} />Ativa</label>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200"><input type="checkbox" checked={variant.publicEnabled} onChange={(event) => setVariant((current) => ({ ...current, publicEnabled: event.target.checked }))} />Exibir ao cliente</label>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200"><input type="checkbox" checked={variant.requiresProof} onChange={(event) => setVariant((current) => ({ ...current, requiresProof: event.target.checked }))} />Exige comprovante</label>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200"><input type="checkbox" checked={variant.affectsCashbook} onChange={(event) => setVariant((current) => ({ ...current, affectsCashbook: event.target.checked }))} />Entra no caixa</label>
                        </div>
                        <div className="rounded-xl bg-violet-50 p-4 text-sm font-semibold text-violet-800 mx-5 mb-5 dark:bg-violet-950/20 dark:text-violet-200">A forma específica mantém seu tipo-base. Assim “Débito InfinitePay” continua sendo débito para venda e relatórios, mas preserva a adquirente/conta exata para conferência.</div>
                        <div className="flex justify-end gap-2 border-t border-gray-100 p-5 dark:border-gray-800"><button type="button" onClick={closeVariant} className="rounded-xl border px-4 py-2 text-sm font-black text-gray-600 dark:border-gray-700 dark:text-gray-300">Cancelar</button><button type="submit" disabled={variantSaving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{variantSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Salvar forma específica</button></div>
                    </form>
                </div>
            )}
        </PageContainer>
    );
}

function accountTypeLabelForVariant(type: string) {
    const labels: Record<string, string> = {
        cash_drawer: 'Caixa',
        safe: 'Cofre',
        bank: 'Banco',
        pix_wallet: 'Carteira Pix',
        card_acquirer: 'Maquininha / adquirente',
        card_receivable: 'Recebíveis de cartão',
        owner: 'Proprietário',
        other: 'Outra conta',
    };
    return labels[type] || type;
}
