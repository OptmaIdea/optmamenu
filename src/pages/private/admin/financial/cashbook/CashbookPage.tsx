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
    Edit2,
    Eye,
    Search,
    SlidersHorizontal,
    Save,
    X,
    WalletCards,
    Landmark,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import PageContainer from '@/components/common/PageContainer';
import { CashbookService, type CashbookDirection, type CashbookEntry, type CashbookSummary } from '@/services/cashbookService';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatCurrencyPtBr } from '@/utils/export/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import PendingReceivablesPanel from './components/PendingReceivablesPanel';
import DateRangeFilter, { getPeriodDates, getDateInputValue } from '@/components/common/DateRangeFilter';

type CashbookFormMode = 'create' | 'edit';
type CashbookStatusFilter = 'active' | 'cancelled' | 'all';

type EnrichedCashbookEntry = CashbookEntry & {
    financial_account_name?: string | null;
    financial_account_code?: string | null;
    financial_account_type?: string | null;
    destination_account_name?: string | null;
    destination_account_code?: string | null;
    source_account_name?: string | null;
    source_account_code?: string | null;
    destination_financial_account?: { name?: string | null; code?: string | null; account_type?: string | null } | null;
    source_financial_account?: { name?: string | null; code?: string | null; account_type?: string | null } | null;
};

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

function isCancelledEntry(entry: CashbookEntry) {
    return entry.status === 'cancelled' || entry.status === 'canceled' || entry.status === 'voided';
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

function getPaymentMethodLabel(value?: string | null) {
    if (!value) return '—';
    const lower = value.toLowerCase();
    const labels: Record<string, string> = {
        pending: 'Pendente',
        pix: 'Pix',
        cash: 'Dinheiro',
        card: 'Cartão',
        credit_card: 'Cartão de crédito',
        debit_card: 'Cartão de débito',
        dinheiro: 'Dinheiro',
        pix_manual_qr: 'Pix por QR Code',
        pix_asaas: 'Pix online',
        asaas_pix: 'Pix online',
        payment_link: 'Link de pagamento',
        cash_drawer: 'Caixa físico',
        card_receivable: 'Recebíveis de cartão',
    };
    return labels[lower] || value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAccountTypeLabel(value?: string | null) {
    const labels: Record<string, string> = {
        cash_drawer: 'Caixa físico',
        pix_wallet: 'Carteira Pix',
        bank: 'Banco',
        card_acquirer: 'Adquirente',
        card_receivable: 'Recebíveis de cartão',
        safe: 'Cofre',
        owner: 'Proprietário',
        other: 'Outra conta',
    };
    return value ? labels[value] || value.replace(/[_-]+/g, ' ') : 'Conta financeira';
}

function getEntryAccount(entry: CashbookEntry) {
    const enriched = entry as EnrichedCashbookEntry;
    const metadata = entry.metadata || {};
    const name =
        enriched.financial_account_name ||
        enriched.destination_account_name ||
        enriched.source_account_name ||
        enriched.destination_financial_account?.name ||
        enriched.source_financial_account?.name ||
        getMetadataText(metadata, ['financial_account_name', 'destination_account_name', 'sales_clearing_account_name']);
    const code =
        enriched.financial_account_code ||
        enriched.destination_account_code ||
        enriched.source_account_code ||
        enriched.destination_financial_account?.code ||
        enriched.source_financial_account?.code ||
        getMetadataText(metadata, ['financial_account_code', 'destination_account_code', 'sales_clearing_account_code']);
    const type =
        enriched.financial_account_type ||
        enriched.destination_financial_account?.account_type ||
        enriched.source_financial_account?.account_type ||
        getMetadataText(metadata, ['financial_account_type', 'destination_account_type']);
    return { name: name || (code ? getPaymentMethodLabel(code) : 'Sem conta definida'), code: code || null, type: type || null };
}

function getDateTimeLocalValue(value?: string | null) {
    const date = value ? new Date(value) : new Date();
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatEntryDate(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

function getPeriodLabel(periodFilter: string, startDate: string, endDate: string) {
    if (periodFilter === 'all') return 'todo o período';
    if (startDate && endDate) {
        return `${new Date(`${startDate}T00:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${endDate}T00:00:00`).toLocaleDateString('pt-BR')}`;
    }
    return 'período selecionado';
}

function getDefaultFinancialAccountCode(paymentMethodCode: string, direction: CashbookDirection) {
    if (direction === 'in') {
        if (paymentMethodCode === 'cash') return 'cash_drawer';
        if (paymentMethodCode === 'pix') return 'pix_wallet';
        if (paymentMethodCode === 'card') return 'card_receivable';
    }
    if (direction === 'out') {
        if (paymentMethodCode === 'cash') return 'cash_drawer';
        if (paymentMethodCode === 'pix') return 'pix_wallet';
        if (paymentMethodCode === 'card') return 'card_receivable';
    }
    return '';
}

function getFormTitle(form: CashbookFormState) {
    if (form.mode === 'edit') return form.entry?.type === 'sale' ? 'Editar descrição da venda' : 'Editar lançamento';
    return form.direction === 'in' ? 'Nova entrada' : 'Nova saída';
}

export default function CashbookPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();
    const { hasPermission } = usePermissions(storeId ?? null);
    const canCreateCashbookEntry = hasPermission('cashbook.create');
    const canCancelCashbookEntry = hasPermission('cashbook.cancel');
    const canExportReports = hasPermission('reports.export');

    const initialDates = getPeriodDates('current_month');
    const [entries, setEntries] = useState<CashbookEntry[]>([]);
    const [summary, setSummary] = useState<CashbookSummary | null>(null);
    const [absoluteSummary, setAbsoluteSummary] = useState<CashbookSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(initialDates.start);
    const [endDate, setEndDate] = useState(initialDates.end);
    const [periodFilter, setPeriodFilter] = useState('current_month');
    const [customerFilter, setCustomerFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<CashbookStatusFilter>('active');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<CashbookEntry | null>(null);
    const [formState, setFormState] = useState<CashbookFormState | null>(null);
    const [savingForm, setSavingForm] = useState(false);

    const periodLabel = useMemo(() => getPeriodLabel(periodFilter, startDate, endDate), [periodFilter, startDate, endDate]);

    const filteredEntries = useMemo(() => {
        const customerTerm = customerFilter.trim().toLowerCase();
        return entries.filter((entry) => {
            const isCancelled = isCancelledEntry(entry);
            if (statusFilter === 'active' && isCancelled) return false;
            if (statusFilter === 'cancelled' && !isCancelled) return false;
            if (!customerTerm) return true;
            const account = getEntryAccount(entry);
            const haystack = [
                getCustomerLabel(entry),
                entry.customer_id,
                entry.order_id,
                entry.description,
                entry.payment_method,
                entry.payment_method_code,
                account.name,
                account.code,
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(customerTerm);
        });
    }, [customerFilter, entries, statusFilter]);

    const nonRealized = useMemo(() => {
        let pending = 0;
        let cancelled = 0;
        entries.forEach((entry) => {
            const amount = Number(entry.amount || 0);
            const signed = entry.direction === 'out' ? -amount : amount;
            if (isCancelledEntry(entry)) {
                cancelled += signed;
                return;
            }
            const isPending = entry.status === 'pending' || entry.payment_method_code === 'pending' || entry.affects_balance === false;
            if (isPending) pending += signed;
        });
        return { pending, cancelled };
    }, [entries]);

    const loadData = useCallback(async () => {
        if (!storeId) return;
        try {
            setLoading(true);
            const today = new Date();
            const absoluteStart = '1970-01-01';
            const absoluteEnd = getDateInputValue(today);
            const rangeStart = periodFilter === 'all'
                ? absoluteStart
                : (startDate || getDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)));
            const rangeEnd = periodFilter === 'all' ? absoluteEnd : (endDate || absoluteEnd);

            const [entriesData, summaryData, absoluteSummaryData] = await Promise.all([
                CashbookService.listByStore(storeId, rangeStart, rangeEnd),
                CashbookService.getSummary(storeId, rangeStart, rangeEnd),
                CashbookService.getSummary(storeId, absoluteStart, absoluteEnd),
            ]);

            setEntries(entriesData);
            setSummary(summaryData);
            setAbsoluteSummary(absoluteSummaryData);
        } catch (err) {
            console.error('Erro ao carregar dados do livro de caixa:', err);
            toast.error('Erro ao carregar o Livro Diário.');
        } finally {
            setLoading(false);
        }
    }, [storeId, periodFilter, startDate, endDate]);

    useEffect(() => {
        if (!loadingStore && storeId) loadData();
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
            toast.error('Você não tem permissão para lançar no Livro Diário.');
            return;
        }

        const amount = Number(formState.amount.replace(',', '.'));
        const isSaleEdit = formState.mode === 'edit' && formState.entry?.type === 'sale';
        if (!formState.description.trim()) {
            toast.error('Informe uma descrição.');
            return;
        }
        if (!isSaleEdit && (!Number.isFinite(amount) || amount <= 0)) {
            toast.error('Informe um valor maior que zero.');
            return;
        }

        try {
            setSavingForm(true);
            if (formState.mode === 'create') {
                const accountCode = getDefaultFinancialAccountCode(formState.paymentMethodCode, formState.direction);
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
                    source_financial_account_code: formState.direction === 'out' ? accountCode : null,
                    destination_financial_account_code: formState.direction === 'in' ? accountCode : null,
                    affects_cash_drawer: accountCode === 'cash_drawer',
                    affects_financial_result: true,
                    is_transfer: false,
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
            const message = error instanceof Error ? error.message : 'Erro ao salvar lançamento.';
            console.error('Erro ao salvar lançamento:', error);
            toast.error(message);
        } finally {
            setSavingForm(false);
        }
    }

    async function handleCancelEntry(entry: CashbookEntry) {
        if (!storeId || entry.type === 'sale') return;
        if (!canCancelCashbookEntry) {
            toast.error('Você não tem permissão para cancelar lançamentos do Livro Diário.');
            return;
        }
        if (!window.confirm('Cancelar este lançamento? Ele deixará de afetar o saldo.')) return;
        try {
            await CashbookService.cancel(storeId, entry.id);
            await loadData();
        } catch (error) {
            console.error('Erro ao cancelar lançamento:', error);
            toast.error('Erro ao cancelar lançamento.');
        }
    }

    function handlePrint() {
        if (!canExportReports) {
            toast.error('Você não tem permissão para imprimir relatórios.');
            return;
        }
        window.print();
    }

    if (loadingStore || (loading && entries.length === 0)) return <LoadingSpinner />;

    const periodResult = Number(summary?.balance || 0);
    const totalBalance = Number(absoluteSummary?.balance || 0);

    return (
        <PageContainer
            title="Livro diário de caixa"
            subtitle="Entradas, saídas, saldo do período e conta financeira de cada lançamento."
            category="Financeiro"
            icon={<WalletCards size={28} className="text-[#19A999]" />}
            onRefresh={loadData}
            action={
                <div className="grid w-full max-w-full grid-cols-1 gap-2 min-[430px]:grid-cols-3 sm:flex sm:w-auto sm:items-center">
                    {canCreateCashbookEntry && (
                        <>
                            <button type="button" onClick={() => openCreateForm('in')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
                                <Plus size={16} /> Nova entrada
                            </button>
                            <button type="button" onClick={() => openCreateForm('out')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700">
                                <Minus size={16} /> Nova saída
                            </button>
                        </>
                    )}
                    {canExportReports && (
                        <button type="button" onClick={handlePrint} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            Imprimir
                        </button>
                    )}
                </div>
            }
            flat
        >
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm font-bold text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100">
                <span className="font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">Leitura da tela:</span>{' '}
                entradas, saídas e resultado respeitam o filtro. Saldo geral é o acumulado da loja até hoje.
            </div>

            <div className="grid max-w-full grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
                <SummaryCard title="Entradas" value={summary?.total_in || 0} subtitle={`No período: ${periodLabel}`} positive icon={<TrendingUp size={20} />} />
                <SummaryCard title="Saídas" value={summary?.total_out || 0} subtitle={`No período: ${periodLabel}`} negative icon={<TrendingDown size={20} />} />
                <SummaryCard title="Resultado" value={periodResult} subtitle="Entradas menos saídas do período" positive={periodResult >= 0} negative={periodResult < 0} icon={<ArrowUpCircle size={20} />} />
                <SummaryCard title="Saldo geral" value={totalBalance} subtitle="Acumulado de todos os lançamentos" positive={totalBalance >= 0} negative={totalBalance < 0} emphasized icon={<Wallet size={20} />} />
            </div>

            {(nonRealized.pending !== 0 || nonRealized.cancelled !== 0) && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                    Valores não realizados no período filtrado: pendente {formatCurrencyPtBr(nonRealized.pending)} · cancelado {formatCurrencyPtBr(nonRealized.cancelled)}.
                </div>
            )}

            <div className="my-6">
                <PendingReceivablesPanel storeId={storeId} entries={entries} canConfirm={canCreateCashbookEntry} onConfirmed={loadData} />
            </div>

            <div className="max-w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <Landmark size={18} className="text-gray-400" />
                            <h2 className="font-black uppercase tracking-tight text-gray-900 dark:text-white">Lançamentos do período</h2>
                        </div>
                        <p className="mt-1 text-xs font-bold text-gray-400">Cada linha mostra forma de pagamento e conta financeira. Não há saldo por linha para não misturar período com acumulado.</p>
                    </div>
                </div>

                <div className="border-b border-gray-100 dark:border-gray-700">
                    <div className="flex p-3 md:hidden">
                        <button type="button" onClick={() => setFiltersOpen((open) => !open)} className="inline-flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} /> Filtros e período</span>
                            {filtersOpen ? <span>Ocultar</span> : <span>Mostrar</span>}
                        </button>
                    </div>
                    <div className={`${filtersOpen ? 'grid' : 'hidden'} grid-cols-1 gap-3 p-3 sm:p-4 md:grid md:grid-cols-5`}>
                        <DateRangeFilter periodFilter={periodFilter} onPeriodChange={setPeriodFilter} startDate={startDate} onStartDateChange={setStartDate} endDate={endDate} onEndDateChange={setEndDate} className="col-span-1 md:col-span-3" />
                        <label className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Buscar</span>
                            <div className="relative">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} placeholder="Cliente, pedido, conta ou forma" className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" />
                            </div>
                        </label>
                        <label className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</span>
                            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CashbookStatusFilter)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                <option value="active">Ativos</option>
                                <option value="cancelled">Cancelados</option>
                                <option value="all">Todos</option>
                            </select>
                        </label>
                    </div>
                </div>

                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <table className="min-w-[860px] w-full text-sm">
                        <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:bg-gray-900/40">
                            <tr>
                                <th className="px-5 py-4 text-left">Data</th>
                                <th className="px-5 py-4 text-left">Descrição</th>
                                <th className="px-5 py-4 text-left">Conta</th>
                                <th className="px-5 py-4 text-left">Forma</th>
                                <th className="px-5 py-4 text-left">Tipo</th>
                                <th className="px-5 py-4 text-right">Valor</th>
                                <th className="px-5 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredEntries.length > 0 ? filteredEntries.map((entry) => (
                                <CashbookRow key={entry.id} entry={entry} canCreate={canCreateCashbookEntry} canCancel={canCancelCashbookEntry} onView={setSelectedEntry} onEdit={openEditForm} onCancel={handleCancelEntry} />
                            )) : (
                                <tr><td colSpan={7} className="py-16 text-center text-gray-400 italic">Nenhum lançamento encontrado para este filtro.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {formState && (
                <CashbookFormModal formState={formState} saving={savingForm} canCreate={canCreateCashbookEntry} onClose={() => setFormState(null)} onChange={setFormState} onSubmit={handleSubmitForm} />
            )}

            {selectedEntry && (
                <CashbookDetailsModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
            )}
        </PageContainer>
    );
}

function SummaryCard({ title, value, subtitle, icon, positive, negative, emphasized }: { title: string; value: number; subtitle: string; icon: React.ReactNode; positive?: boolean; negative?: boolean; emphasized?: boolean }) {
    const accent = negative ? 'text-rose-600 dark:text-rose-400' : positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300';
    return (
        <div className={`rounded-2xl bg-white p-3 shadow-sm dark:bg-gray-800 sm:rounded-3xl sm:p-6 ${emphasized ? 'border-2 border-[#19A999]/30 dark:border-[#19A999]/40' : 'border border-gray-100 dark:border-gray-700'}`}>
            <div className={`mb-3 flex items-center gap-3 ${accent}`}>
                <div className="rounded-xl bg-current/10 p-2">{icon}</div>
                <span className="text-xs font-black uppercase tracking-widest">{title}</span>
            </div>
            <div className={`text-2xl font-black ${negative ? 'text-rose-600' : 'text-gray-900 dark:text-white'}`}>{formatCurrencyPtBr(value)}</div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-tighter text-gray-400">{subtitle}</p>
        </div>
    );
}

function CashbookRow({ entry, canCreate, canCancel, onView, onEdit, onCancel }: { entry: CashbookEntry; canCreate: boolean; canCancel: boolean; onView: (entry: CashbookEntry) => void; onEdit: (entry: CashbookEntry) => void; onCancel: (entry: CashbookEntry) => void }) {
    const isCancelled = isCancelledEntry(entry);
    const account = getEntryAccount(entry);
    const rowClass = isCancelled ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-white';

    return (
        <tr className="transition hover:bg-gray-50 dark:hover:bg-gray-700/40">
            <td className={`px-5 py-3 whitespace-nowrap font-bold ${isCancelled ? rowClass : 'text-gray-600 dark:text-gray-300'}`}>{formatEntryDate(entry.entry_date || entry.occurred_at)}</td>
            <td className="px-5 py-3">
                <div className={`font-bold tracking-tight ${rowClass}`}>{entry.type === 'sale' ? `Venda concluída: ${entry.description.replace('Venda concluída pelo pedido ', '')}` : entry.description}</div>
                {entry.type === 'sale' && <div className={`mt-0.5 text-[10px] font-bold ${isCancelled ? rowClass : 'text-gray-500 dark:text-gray-400'}`}>Cliente: {getCustomerLabel(entry) || entry.customer_id || 'Não informado'}</div>}
            </td>
            <td className="px-5 py-3">
                <div className={`font-black ${isCancelled ? rowClass : 'text-gray-800 dark:text-gray-100'}`}>{account.name}</div>
                <div className="text-[9px] font-black uppercase tracking-wider text-gray-400">{getAccountTypeLabel(account.type)}</div>
            </td>
            <td className="px-5 py-3 whitespace-nowrap"><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:bg-gray-900 dark:text-gray-300">{getPaymentMethodLabel(entry.payment_method || entry.payment_method_code)}</span></td>
            <td className="px-5 py-3 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                    {entry.direction === 'in' ? <ArrowUpCircle size={14} className="text-emerald-500" /> : <ArrowDownCircle size={14} className="text-rose-500" />}
                    <span className={`text-[9px] font-black uppercase tracking-widest ${entry.direction === 'in' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{entry.direction === 'in' ? 'Entrada' : 'Saída'}</span>
                </div>
            </td>
            <td className="px-5 py-3 whitespace-nowrap text-right font-black tracking-tighter"><div className={isCancelled ? rowClass : entry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}>{entry.direction === 'in' ? '+' : '-'} {formatCurrencyPtBr(entry.amount)}</div></td>
            <td className="px-5 py-3 text-right">
                <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => onView(entry)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700" title="Ver detalhes"><Eye size={13} /></button>
                    {canCreate && <button type="button" onClick={() => onEdit(entry)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700" title={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}><Edit2 size={13} /></button>}
                    {entry.type !== 'sale' && !isCancelled && canCancel && <button type="button" onClick={() => onCancel(entry)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30" title="Cancelar lançamento"><Ban size={13} /></button>}
                </div>
            </td>
        </tr>
    );
}

function CashbookFormModal({ formState, saving, canCreate, onClose, onChange, onSubmit }: { formState: CashbookFormState; saving: boolean; canCreate: boolean; onClose: () => void; onChange: (form: CashbookFormState) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
    const isSaleEdit = formState.mode === 'edit' && formState.entry?.type === 'sale';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <form onSubmit={onSubmit} className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6 dark:border-gray-800">
                    <div><p className="text-xs font-black uppercase tracking-widest text-[#19A999]">Livro diário</p><h3 className="mt-1 text-xl font-black text-gray-900 dark:text-white">{getFormTitle(formState)}</h3></div>
                    <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800" aria-label="Fechar formulário"><X size={18} /></button>
                </div>
                <div className="space-y-4 p-6">
                    {isSaleEdit && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">Lançamentos de venda permitem alterar apenas a descrição.</div>}
                    <label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Descrição</span><input value={formState.description} onChange={(event) => onChange({ ...formState, description: event.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="Descrição do lançamento" /></label>
                    {!isSaleEdit && <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Valor</span><input value={formState.amount} onChange={(event) => onChange({ ...formState, amount: event.target.value })} inputMode="decimal" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="0,00" /></label>
                            <label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Data e hora</span><input type="datetime-local" value={formState.occurredAt} onChange={(event) => onChange({ ...formState, occurredAt: event.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" /></label>
                        </div>
                        <label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Forma de pagamento</span><select value={formState.paymentMethodCode} onChange={(event) => onChange({ ...formState, paymentMethodCode: event.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"><option value="cash">Dinheiro</option><option value="pix">Pix</option><option value="card">Cartão</option><option value="pending">Pendente</option></select></label>
                        <label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Observações</span><textarea value={formState.notes} onChange={(event) => onChange({ ...formState, notes: event.target.value })} rows={3} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="Detalhes internos opcionais" /></label>
                    </>}
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-100 p-6 dark:border-gray-800"><button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancelar</button><button type="submit" disabled={saving || !canCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white transition hover:bg-[#188575] disabled:cursor-not-allowed disabled:opacity-60"><Save size={16} /> Salvar lançamento</button></div>
            </form>
        </div>
    );
}

function CashbookDetailsModal({ entry, onClose }: { entry: CashbookEntry; onClose: () => void }) {
    const account = getEntryAccount(entry);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"><div><p className="text-xs font-black uppercase tracking-widest text-[#19A999]">Detalhes do lançamento</p><h3 className="mt-1 text-xl font-black text-gray-900 dark:text-white">{entry.description}</h3></div><button type="button" onClick={onClose} className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800" aria-label="Fechar detalhes"><X size={18} /></button></div>
                <div className="space-y-5 p-6">
                    <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cliente</p><p className="mt-1 text-lg font-black text-gray-900 dark:text-white">{getCustomerLabel(entry) || entry.customer_id || 'Não informado'}</p></div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valor</p><p className={`mt-1 text-2xl font-black ${entry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>{entry.direction === 'in' ? '+' : '-'} {formatCurrencyPtBr(entry.amount)}</p></div><div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Conta financeira</p><p className="mt-1 font-black text-gray-900 dark:text-white">{account.name}</p><p className="mt-0.5 text-xs font-bold text-gray-500 dark:text-gray-400">{getAccountTypeLabel(account.type)}</p></div></div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Info label="Data" value={new Date(entry.occurred_at).toLocaleString('pt-BR')} /><Info label="Status" value={getStatusLabel(entry.status)} /><Info label="Forma de pagamento" value={getPaymentMethodLabel(entry.payment_method || entry.payment_method_code)} /><Info label="Afeta saldo" value={entry.affects_balance ? 'Sim' : 'Não'} /></div>
                    {entry.notes && <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Observações</p><p className="mt-1 whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-200">{entry.notes}</p></div>}
                </div>
            </div>
        </div>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{value}</p></div>;
}
