import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Plus,
    Minus,
    ArrowUpCircle,
    ArrowDownCircle,
    Ban,
    Calendar,
    Edit2,
    Eye,
    History,
    Search,
    Save,
    X,
    WalletCards
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import PageContainer from '@/components/common/PageContainer';
import { CashbookService, type CashbookDirection, type CashbookEntry, type CashbookSummary } from '@/services/cashbookService';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatCurrencyPtBr } from '@/utils/export/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

function getDateInputValue(value: Date) {
    return value.toISOString().slice(0, 10);
}

function getEntryDateKey(entry: CashbookEntry) {
    return new Date(entry.occurred_at || entry.entry_date).toISOString().slice(0, 10);
}

function getMetadataText(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
    for (const key of keys) {
        const value = metadata?.[key];
        if (typeof value === 'string' && value.trim()) return value;
        if (typeof value === 'number') return String(value);
    }

    return null;
}

function getCustomerLabel(entry: CashbookEntry) {
    return entry.order?.customer_name || getMetadataText(entry.metadata, ['customer_name', 'customer', 'client_name']);
}

function getTypeLabel(entry: CashbookEntry) {
    const labels: Record<string, string> = {
        sale: 'Venda',
        manual_income: 'Entrada manual',
        manual_expense: 'Saída manual',
        refund: 'Estorno',
        adjustment: 'Ajuste',
        transfer: 'Transferência',
        other: 'Outro',
    };

    return labels[entry.type] || entry.type;
}

function getStatusLabel(status?: string | null) {
    const labels: Record<string, string> = {
        confirmed: 'Confirmado',
        completed: 'Concluído',
        pending: 'Pendente',
        cancelled: 'Cancelado',
        canceled: 'Cancelado',
        active: 'Ativo',
        voided: 'Anulado',
    };

    return status ? labels[status] || status : '—';
}

type CashbookFormMode = 'create' | 'edit';
type CashbookStatusFilter = 'active' | 'cancelled' | 'all';

interface CashbookFormState {
    mode: CashbookFormMode;
    direction: CashbookDirection;
    entry: CashbookEntry | null;
    description: string;
    amount: string;
    paymentMethodCode: string;
    notes: string;
    occurredAt: string;
}

function getDateTimeLocalValue(value?: string | null) {
    const date = value ? new Date(value) : new Date();
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function getFormTitle(form: CashbookFormState) {
    if (form.mode === 'edit') return form.entry?.type === 'sale' ? 'Editar descrição da venda' : 'Editar lançamento';
    return form.direction === 'in' ? 'Nova entrada' : 'Nova saída';
}

export default function CashbookPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();

    // Permissões
    const { hasPermission } = usePermissions(storeId ?? null);
    const canCreateCashbookEntry = hasPermission('cashbook.create');
    const canCancelCashbookEntry = hasPermission('cashbook.cancel');
    const canExportReports = hasPermission('reports.export');

    function handlePrint() {
        if (!canExportReports) {
            toast.error('Você não tem permissão para imprimir relatórios.');
            return;
        }
        window.print();
    }

    const [entries, setEntries] = useState<CashbookEntry[]>([]);
    const [summary, setSummary] = useState<CashbookSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<CashbookStatusFilter>('active');
    const [selectedEntry, setSelectedEntry] = useState<CashbookEntry | null>(null);
    const [formState, setFormState] = useState<CashbookFormState | null>(null);
    const [savingForm, setSavingForm] = useState(false);

    const filteredEntries = useMemo(() => {
        const customerTerm = customerFilter.trim().toLowerCase();

        return entries.filter((entry) => {
            const isCancelled = entry.status === 'cancelled' || entry.status === 'canceled';
            if (statusFilter === 'active' && isCancelled) return false;
            if (statusFilter === 'cancelled' && !isCancelled) return false;

            const dateKey = getEntryDateKey(entry);
            if (startDate && dateKey < startDate) return false;
            if (endDate && dateKey > endDate) return false;

            if (customerTerm) {
                const haystack = [
                    getCustomerLabel(entry),
                    entry.customer_id,
                    entry.order_id,
                    entry.description,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                if (!haystack.includes(customerTerm)) return false;
            }

            return true;
        });
    }, [customerFilter, endDate, entries, startDate, statusFilter]);

    const loadData = useCallback(async () => {
        if (!storeId) return;
        try {
            setLoading(true);
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
            const now = today.toISOString();

            const [entriesData, summaryData] = await Promise.all([
                CashbookService.listByStore(storeId),
                CashbookService.getSummary(storeId, firstDayOfMonth, now)
            ]);
            setEntries(entriesData);
            setSummary(summaryData);
        } catch (err) {
            console.error('Erro ao carregar dados do livro de caixa:', err);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadData();
        }
    }, [loadData, loadingStore, storeId]);

    function openCreateForm(direction: CashbookDirection) {
        setFormState({
            mode: 'create',
            direction,
            entry: null,
            description: '',
            amount: '',
            paymentMethodCode: 'cash',
            notes: '',
            occurredAt: getDateTimeLocalValue(),
        });
    }

    function openEditForm(entry: CashbookEntry) {
        setSelectedEntry(null);
        setFormState({
            mode: 'edit',
            direction: entry.direction,
            entry,
            description: entry.description,
            amount: String(entry.amount ?? ''),
            paymentMethodCode: entry.payment_method_code || 'cash',
            notes: entry.notes || '',
            occurredAt: getDateTimeLocalValue(entry.occurred_at),
        });
    }

    async function handleSubmitForm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!storeId || !formState) return;

        if (!canCreateCashbookEntry) {
            alert('Você não tem permissão para lançar no Livro Diário.');
            return;
        }

        const amount = Number(formState.amount.replace(',', '.'));
        const isSaleEdit = formState.mode === 'edit' && formState.entry?.type === 'sale';

        if (!formState.description.trim()) {
            alert('Informe uma descrição.');
            return;
        }

        if (!isSaleEdit && (!Number.isFinite(amount) || amount <= 0)) {
            alert('Informe um valor maior que zero.');
            return;
        }

        try {
            setSavingForm(true);

            if (formState.mode === 'create') {
                await CashbookService.create({
                    store_id: storeId,
                    type: formState.direction === 'in' ? 'manual_income' : 'manual_expense',
                    direction: formState.direction,
                    amount,
                    description: formState.description.trim(),
                    payment_method_code: formState.paymentMethodCode || null,
                    notes: formState.notes.trim() || null,
                    occurred_at: new Date(formState.occurredAt).toISOString(),
                    metadata: { origin: 'admin_cashbook' },
                });
            } else if (formState.entry) {
                await CashbookService.update({
                    entry_id: formState.entry.id,
                    store_id: storeId,
                    description: formState.description.trim(),
                    amount: isSaleEdit ? undefined : amount,
                    payment_method_code: isSaleEdit ? undefined : formState.paymentMethodCode || null,
                    notes: isSaleEdit ? undefined : formState.notes.trim() || null,
                    occurred_at: isSaleEdit ? undefined : new Date(formState.occurredAt).toISOString(),
                });
            }

            setFormState(null);
            await loadData();
        } catch (error) {
            console.error('Erro ao salvar lançamento:', error);
            alert('Erro ao salvar lançamento.');
        } finally {
            setSavingForm(false);
        }
    }

    async function handleCancelEntry(entry: CashbookEntry) {
        if (!storeId || entry.type === 'sale') return;

        if (!canCancelCashbookEntry) {
            alert('Você não tem permissão para cancelar lançamentos do Livro Diário.');
            return;
        }

        if (!window.confirm('Cancelar este lançamento? Ele deixará de afetar o saldo.')) return;

        try {
            await CashbookService.cancel(storeId, entry.id);
            await loadData();
        } catch (error) {
            console.error('Erro ao cancelar lançamento:', error);
            alert('Erro ao cancelar lançamento.');
        }
    }

    if (loadingStore || loading) return <LoadingSpinner />;

    return (
        <PageContainer
            title="Livro diário de caixa"
            subtitle="Gerencie entradas, saídas e lançamentos financeiros simples da loja."
            category="Financeiro"
            icon={<WalletCards size={28} className="text-[#19A999]" />}
            onRefresh={loadData}
            action={
                <div className="flex items-center gap-2">
                    {canCreateCashbookEntry && (
                        <>
                            <button
                                type="button"
                                onClick={() => openCreateForm('in')}
                                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-bold transition shadow-sm active:scale-95 rounded-xl"
                            >
                                <Plus size={16} />
                                Nova Entrada
                            </button>
                            <button
                                type="button"
                                onClick={() => openCreateForm('out')}
                                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-bold transition shadow-sm active:scale-95 rounded-xl"
                            >
                                <Minus size={16} />
                                Nova Saída
                            </button>
                        </>
                    )}
                    {canExportReports && (
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                            Imprimir
                        </button>
                    )}
                </div>
            }
            flat
        >

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                    <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-3">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Entradas</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {formatCurrencyPtBr(summary?.total_in || 0)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Este mês</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                    <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
                        <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
                            <TrendingDown size={20} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Saídas</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {formatCurrencyPtBr(summary?.total_out || 0)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Este mês</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                    <div className="flex items-center gap-3 text-[#19A999] mb-3">
                        <div className="p-2 bg-[#19A999]/10 rounded-xl">
                            <Wallet size={20} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Saldo Atual</span>
                    </div>
                    <div className={`text-2xl font-black ${((summary?.balance || 0) >= 0) ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>
                        {formatCurrencyPtBr(summary?.balance || 0)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Total acumulado</p>
                </div>
            </div>

            {/* Entries List */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <History size={18} className="text-gray-400" />
                        <h2 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">Últimos Lançamentos</h2>
                    </div>
                    <button className="text-xs font-black text-[#19A999] hover:underline uppercase tracking-widest">
                        Ver todos
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 dark:border-gray-700 md:grid-cols-4">
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data inicial</span>
                        <div className="relative">
                            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                            />
                        </div>
                    </label>

                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data final</span>
                        <div className="relative">
                            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(event) => setEndDate(event.target.value)}
                                max={getDateInputValue(new Date())}
                                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                            />
                        </div>
                    </label>

                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cliente em venda</span>
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={customerFilter}
                                onChange={(event) => setCustomerFilter(event.target.value)}
                                placeholder="Nome, descrição, pedido ou cliente"
                                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                            />
                        </div>
                    </label>

                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</span>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as CashbookStatusFilter)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                            <option value="active">Ativos</option>
                            <option value="cancelled">Cancelados</option>
                            <option value="all">Todos</option>
                        </select>
                    </label>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="px-6 py-4 text-left">Data</th>
                                <th className="px-6 py-4 text-left">Descrição</th>
                                <th className="px-6 py-4 text-left">Tipo</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredEntries.length > 0 ? (
                                filteredEntries.map((entry) => {
                                    const isCancelled = entry.status === 'cancelled' || entry.status === 'canceled';
                                    const cancelledClass = isCancelled ? 'text-gray-400 line-through dark:text-gray-500' : '';

                                    return (
                                    <tr key={entry.id} className={`transition ${isCancelled ? 'bg-gray-50/70 opacity-75 dark:bg-gray-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                        <td className={`px-6 py-4 whitespace-nowrap font-medium ${isCancelled ? cancelledClass : 'text-gray-500 dark:text-gray-400'}`}>
                                            {new Date(entry.occurred_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`font-bold tracking-tight ${isCancelled ? cancelledClass : 'text-gray-900 dark:text-white'}`}>
                                                {entry.type === 'sale' ? (
                                                    <>
                                                        Venda concluída: {entry.description.replace('Venda concluída pelo pedido ', '')}
                                                    </>
                                                ) : (
                                                    entry.description
                                                )}
                                            </div>
                                            {entry.type === 'sale' && (
                                                <div className={`mt-1 text-xs font-bold ${isCancelled ? cancelledClass : 'text-gray-500 dark:text-gray-400'}`}>
                                                    Cliente: {getCustomerLabel(entry) || entry.customer_id || 'Não informado'}
                                                </div>
                                            )}
                                            {entry.payment_method && (
                                                <div className={`text-[10px] uppercase font-black tracking-tighter ${isCancelled ? cancelledClass : 'text-gray-400'}`}>{entry.payment_method}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {entry.direction === 'in' ? (
                                                    <ArrowUpCircle size={16} className="text-emerald-500" />
                                                ) : (
                                                    <ArrowDownCircle size={16} className="text-rose-500" />
                                                )}
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${entry.direction === 'in' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                                    {entry.direction === 'in' ? 'Entrada' : 'Saída'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-right font-black tracking-tighter ${isCancelled ? cancelledClass : entry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {entry.direction === 'in' ? '+' : '-'} {formatCurrencyPtBr(entry.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedEntry(entry)}
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                    title="Ver detalhes"
                                                    aria-label="Ver detalhes"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openEditForm(entry)}
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                    title={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                    aria-label={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                                {entry.type !== 'sale' && !isCancelled && canCancelCashbookEntry && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCancelEntry(entry)}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                                                        title="Cancelar lançamento"
                                                        aria-label="Cancelar lançamento"
                                                    >
                                                        <Ban size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-gray-400 italic">
                                        Nenhum lançamento encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {formState && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <form
                        onSubmit={handleSubmitForm}
                        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-gray-900"
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6 dark:border-gray-800">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-[#19A999]">
                                    Livro diário
                                </p>
                                <h3 className="mt-1 text-xl font-black text-gray-900 dark:text-white">
                                    {getFormTitle(formState)}
                                </h3>
                            </div>

                            <button
                                type="button"
                                onClick={() => setFormState(null)}
                                className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                aria-label="Fechar formulário"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 p-6">
                            {formState.mode === 'edit' && formState.entry?.type === 'sale' && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                                    Lançamentos de venda permitem alterar apenas a descrição.
                                </div>
                            )}

                            <label className="block space-y-1">
                                <span className="text-xs font-black uppercase tracking-widest text-gray-500">Descrição</span>
                                <input
                                    value={formState.description}
                                    onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                    placeholder="Descrição do lançamento"
                                />
                            </label>

                            {formState.entry?.type !== 'sale' && (
                                <>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <label className="block space-y-1">
                                            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Valor</span>
                                            <input
                                                value={formState.amount}
                                                onChange={(event) => setFormState({ ...formState, amount: event.target.value })}
                                                inputMode="decimal"
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                                placeholder="0,00"
                                            />
                                        </label>

                                        <label className="block space-y-1">
                                            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Data e hora</span>
                                            <input
                                                type="datetime-local"
                                                value={formState.occurredAt}
                                                onChange={(event) => setFormState({ ...formState, occurredAt: event.target.value })}
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                            />
                                        </label>
                                    </div>

                                    <label className="block space-y-1">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Forma de pagamento</span>
                                        <select
                                            value={formState.paymentMethodCode}
                                            onChange={(event) => setFormState({ ...formState, paymentMethodCode: event.target.value })}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                        >
                                            <option value="cash">Dinheiro</option>
                                            <option value="pix">Pix</option>
                                            <option value="card">Cartão</option>
                                            <option value="pending">Pendente</option>
                                        </select>
                                    </label>

                                    <label className="block space-y-1">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Observações</span>
                                        <textarea
                                            value={formState.notes}
                                            onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                                            rows={3}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                            placeholder="Detalhes internos opcionais"
                                        />
                                    </label>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-gray-100 p-6 dark:border-gray-800">
                            <button
                                type="button"
                                onClick={() => setFormState(null)}
                                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={savingForm || !canCreateCashbookEntry}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white transition hover:bg-[#188575] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Save size={16} />
                                Salvar lançamento
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {selectedEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-[#19A999]">
                                    Detalhes do lançamento
                                </p>
                                <h3 className="mt-1 text-xl font-black text-gray-900 dark:text-white">
                                    {selectedEntry.description}
                                </h3>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedEntry(null)}
                                className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                aria-label="Fechar detalhes"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-5 p-6">
                            <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cliente</p>
                                <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">
                                    {getCustomerLabel(selectedEntry) || selectedEntry.customer_id || 'Não informado'}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valor</p>
                                    <p className={`mt-1 text-2xl font-black ${selectedEntry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {selectedEntry.direction === 'in' ? '+' : '-'} {formatCurrencyPtBr(selectedEntry.amount)}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo</p>
                                    <p className="mt-1 font-black text-gray-900 dark:text-white">
                                        {getTypeLabel(selectedEntry)} / {selectedEntry.direction === 'in' ? 'Entrada' : 'Saída'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data</p>
                                    <p className="mt-1 font-bold text-gray-800 dark:text-gray-100">
                                        {new Date(selectedEntry.occurred_at).toLocaleString('pt-BR')}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</p>
                                    <p className="mt-1 font-bold text-gray-800 dark:text-gray-100">
                                        {getStatusLabel(selectedEntry.status)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Forma de pagamento</p>
                                    <p className="mt-1 font-bold text-gray-800 dark:text-gray-100">
                                        {selectedEntry.payment_method || selectedEntry.payment_method_code || '—'}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Afeta saldo</p>
                                    <p className="mt-1 font-bold text-gray-800 dark:text-gray-100">
                                        {selectedEntry.affects_balance ? 'Sim' : 'Não'}
                                    </p>
                                </div>
                            </div>

                            {selectedEntry.notes && (
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Observações</p>
                                    <p className="mt-1 whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                                        {selectedEntry.notes}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
