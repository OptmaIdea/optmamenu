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
import { supabase } from '@/lib/supabase';
import PendingReceivablesPanel from './components/PendingReceivablesPanel';
import CashbookClassificationFields, {
    buildManualCashbookClassification,
} from './components/CashbookClassificationFields';

function getDateInputValue(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getEntryDateKey(entry: CashbookEntry) {
    if (entry.entry_date) return entry.entry_date.slice(0, 10);
    return getDateInputValue(new Date(entry.occurred_at));
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
    accountPlanCode: string;
    financialAccountCode: string;
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
    };
    return labels[lower] || value;
}

function getPeriodDates(period: string) {
    const today = new Date();
    
    switch (period) {
        case 'today': {
            return {
                start: getDateInputValue(today),
                end: getDateInputValue(today)
            };
        }
        case 'yesterday': {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return {
                start: getDateInputValue(yesterday),
                end: getDateInputValue(yesterday)
            };
        }
        case 'current_month': {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return {
                start: getDateInputValue(start),
                end: getDateInputValue(end)
            };
        }
        case 'last_month': {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return {
                start: getDateInputValue(start),
                end: getDateInputValue(end)
            };
        }
        case 'fortnight': {
            // Quinzena atual: 1 a 15, ou 16 a fim do mês
            const day = today.getDate();
            if (day <= 15) {
                const start = new Date(today.getFullYear(), today.getMonth(), 1);
                const end = new Date(today.getFullYear(), today.getMonth(), 15);
                return {
                    start: getDateInputValue(start),
                    end: getDateInputValue(end)
                };
            } else {
                const start = new Date(today.getFullYear(), today.getMonth(), 16);
                const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                return {
                    start: getDateInputValue(start),
                    end: getDateInputValue(end)
                };
            }
        }
        case 'last_fortnight': {
            // Quinzena anterior: se dia <= 15, 2ª quinzena do mês anterior. Se dia >= 16, 1ª quinzena do mês atual.
            const day = today.getDate();
            if (day <= 15) {
                const start = new Date(today.getFullYear(), today.getMonth() - 1, 16);
                const end = new Date(today.getFullYear(), today.getMonth(), 0);
                return {
                    start: getDateInputValue(start),
                    end: getDateInputValue(end)
                };
            } else {
                const start = new Date(today.getFullYear(), today.getMonth(), 1);
                const end = new Date(today.getFullYear(), today.getMonth(), 15);
                return {
                    start: getDateInputValue(start),
                    end: getDateInputValue(end)
                };
            }
        }
        case 'week': {
            // Semana: de Domingo a Sábado
            const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
            const sunday = new Date(today);
            sunday.setDate(today.getDate() - dayOfWeek);
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
            return {
                start: getDateInputValue(sunday),
                end: getDateInputValue(saturday)
            };
        }
        case 'last_week': {
            // Semana anterior: de Domingo a Sábado da semana anterior
            const dayOfWeek = today.getDay();
            const sunday = new Date(today);
            sunday.setDate(today.getDate() - dayOfWeek - 7);
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
            return {
                start: getDateInputValue(sunday),
                end: getDateInputValue(saturday)
            };
        }
        case 'all': {
            return { start: '', end: '' };
        }
        default:
            return { start: '', end: '' };
    }
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

    const initialDates = getPeriodDates('current_month');
    const [entries, setEntries] = useState<CashbookEntry[]>([]);
    const [summary, setSummary] = useState<CashbookSummary | null>(null);
    const [absoluteSummary, setAbsoluteSummary] = useState<CashbookSummary | null>(null);
    const [pendingAllTime, setPendingAllTime] = useState(0);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(initialDates.start);
    const [endDate, setEndDate] = useState(initialDates.end);
    const [periodFilter, setPeriodFilter] = useState('current_month');
    const [viewMode, setViewMode] = useState<'libro' | 'extrato'>('libro');
    const [extratoGroupType, setExtratoGroupType] = useState<'day' | 'week' | 'fortnight' | 'month'>('fortnight');
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

    const pendingAndCancelledSums = useMemo(() => {
        let pending = 0;
        let cancelled = 0;

        entries.forEach((entry) => {
            const dateKey = getEntryDateKey(entry);
            const inPeriod = (!startDate || dateKey >= startDate) && (!endDate || dateKey <= endDate);
            if (!inPeriod) return;

            const isCancelled = entry.status === 'cancelled' || entry.status === 'canceled';
            const isPending = !isCancelled && (
                entry.status === 'pending' ||
                entry.payment_method_code === 'pending' ||
                (entry.payment_method && entry.payment_method.toLowerCase() === 'pending')
            );

            if (isPending) {
                pending += Number(entry.amount || 0);
            } else if (isCancelled) {
                cancelled += Number(entry.amount || 0);
            }
        });

        return { pending, cancelled };
    }, [entries, startDate, endDate]);

    const entriesWithRunningBalance = useMemo(() => {
        // Ordena cronologicamente do mais antigo para o mais recente
        const sorted = [...entries].sort((a, b) => {
            const timeA = new Date(a.occurred_at || a.created_at).getTime();
            const timeB = new Date(b.occurred_at || b.created_at).getTime();
            return timeA - timeB;
        });

        let running = 0;
        const balanceMap = new Map<string, number>();

        sorted.forEach((entry) => {
            const isCancelled = entry.status === 'cancelled' || entry.status === 'canceled';
            if (entry.affects_balance && !isCancelled) {
                if (entry.direction === 'in') {
                    running += Number(entry.amount || 0);
                } else {
                    running -= Number(entry.amount || 0);
                }
            }
            balanceMap.set(entry.id, running);
        });

        return balanceMap;
    }, [entries]);

    const groupedExtrato = useMemo(() => {
        if (viewMode !== 'extrato') return [];

        const groupsMap = new Map<string, {
            key: string;
            label: string;
            dateForSort: Date;
            entries: CashbookEntry[];
            totalIn: number;
            totalOut: number;
            periodBalance: number;
            periodRealized: number;
            periodPending: number;
            endingBalance: number;
        }>();

        filteredEntries.forEach((entry) => {
            const dateObj = new Date(entry.occurred_at || entry.entry_date);
            const dateStr = dateObj.toISOString().slice(0, 10);
            
            let groupKey = '';
            let groupLabel = '';
            let dateForSort = dateObj;

            if (extratoGroupType === 'day') {
                groupKey = dateStr;
                groupLabel = dateObj.toLocaleDateString('pt-BR');
                dateForSort = new Date(dateStr + 'T00:00:00.000Z');
            } else if (extratoGroupType === 'week') {
                const dayOfWeek = dateObj.getDay();
                const sunday = new Date(dateObj);
                sunday.setDate(dateObj.getDate() - dayOfWeek);
                const saturday = new Date(sunday);
                saturday.setDate(sunday.getDate() + 6);
                const sundayStr = sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                const saturdayStr = saturday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                
                groupKey = sunday.toISOString().slice(0, 10);
                groupLabel = `Semana de ${sundayStr} a ${saturdayStr}`;
                dateForSort = new Date(groupKey + 'T00:00:00.000Z');
            } else if (extratoGroupType === 'fortnight') {
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = dateObj.getDate();
                const q = day <= 15 ? 'Q1' : 'Q2';
                groupKey = `${year}-${month}-${q}`;
                
                const monthName = dateObj.toLocaleString('pt-BR', { month: 'long' });
                const monthYearLabel = `${month}/${year}`;
                groupLabel = q === 'Q1' 
                    ? `Quinzena 1 - ${monthYearLabel} (1 a 15 de ${monthName})` 
                    : `Quinzena 2 - ${monthYearLabel} (16 a ${new Date(year, dateObj.getMonth() + 1, 0).getDate()} de ${monthName})`;
                
                dateForSort = q === 'Q1' 
                    ? new Date(year, dateObj.getMonth(), 1)
                    : new Date(year, dateObj.getMonth(), 16);
            } else { // month
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                groupKey = `${year}-${month}`;
                const monthName = dateObj.toLocaleString('pt-BR', { month: 'long' });
                groupLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
                dateForSort = new Date(year, dateObj.getMonth(), 1);
            }

            if (!groupsMap.has(groupKey)) {
                groupsMap.set(groupKey, {
                    key: groupKey,
                    label: groupLabel,
                    dateForSort,
                    entries: [],
                    totalIn: 0,
                    totalOut: 0,
                    periodBalance: 0,
                    periodRealized: 0,
                    periodPending: 0,
                    endingBalance: 0,
                });
            }

            const g = groupsMap.get(groupKey)!;
            g.entries.push(entry);

            const isCancelled = entry.status === 'cancelled' || entry.status === 'canceled';

            const isPending =
                !isCancelled &&
                (
                    entry.status === 'pending' ||
                    entry.payment_method_code === 'pending' ||
                    entry.payment_method?.toLowerCase() === 'pending' ||
                    entry.affects_balance === false
                );

            const isRealized = !isCancelled && !isPending && entry.affects_balance === true;

            const amountVal = Number(entry.amount || 0);
            const signedAmount = entry.direction === 'in' ? amountVal : -amountVal;

            if (isRealized) {
                if (entry.direction === 'in') {
                    g.totalIn += amountVal;
                } else {
                    g.totalOut += amountVal;
                }

                g.periodRealized += signedAmount;
                g.periodBalance += signedAmount;
            }

            if (isPending) {
                g.periodPending += signedAmount;
            }
        });

        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
            return b.dateForSort.getTime() - a.dateForSort.getTime();
        });

        sortedGroups.forEach((g) => {
            const sortedEntries = [...g.entries].sort((a, b) => {
                return new Date(b.occurred_at || b.created_at).getTime() - new Date(a.occurred_at || a.created_at).getTime();
            });

            const activeEntry = sortedEntries.find(e => e.affects_balance && e.status !== 'cancelled' && e.status !== 'canceled');
            if (activeEntry) {
                g.endingBalance = entriesWithRunningBalance.get(activeEntry.id) || 0;
            } else {
                g.endingBalance = 0;
                let limitTime = 0;
                if (extratoGroupType === 'day') {
                    limitTime = new Date(g.dateForSort.getTime() + 24 * 3600 * 1000).getTime();
                } else if (extratoGroupType === 'week') {
                    limitTime = new Date(g.dateForSort.getTime() + 7 * 24 * 3600 * 1000).getTime();
                } else if (extratoGroupType === 'fortnight') {
                    const isQ1 = g.key.endsWith('Q1');
                    const year = g.dateForSort.getFullYear();
                    const month = g.dateForSort.getMonth();
                    limitTime = isQ1 
                        ? new Date(year, month, 16).getTime()
                        : new Date(year, month + 1, 1).getTime();
                } else { // month
                    const year = g.dateForSort.getFullYear();
                    const month = g.dateForSort.getMonth();
                    limitTime = new Date(year, month + 1, 1).getTime();
                }

                const pastEntries = [...entries]
                    .filter(e => e.affects_balance && e.status !== 'cancelled' && e.status !== 'canceled')
                    .sort((a, b) => new Date(b.occurred_at || b.created_at).getTime() - new Date(a.occurred_at || a.created_at).getTime());
                
                const matched = pastEntries.find(e => new Date(e.occurred_at || e.created_at).getTime() < limitTime);
                if (matched) {
                    g.endingBalance = entriesWithRunningBalance.get(matched.id) || 0;
                }
            }
        });

        return sortedGroups;
    }, [viewMode, filteredEntries, startDate, endDate, extratoGroupType, entriesWithRunningBalance, entries]);

    const loadData = useCallback(async () => {
        if (!storeId) return;
        try {
            setLoading(true);
            const today = new Date();
            const rangeStart = periodFilter === 'all'
                ? null
                : (startDate || getDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)));
            const rangeEnd = periodFilter === 'all'
                ? null
                : (endDate || getDateInputValue(today));
            const absoluteStart = '1970-01-01';
            const absoluteEnd = getDateInputValue(today);

            const [entriesData, summaryData, absoluteSummaryData, pendingEntriesResult] = await Promise.all([
                CashbookService.listByStore(storeId, rangeStart, rangeEnd),
                CashbookService.getSummary(storeId, rangeStart || absoluteStart, rangeEnd || absoluteEnd),
                CashbookService.getSummary(storeId, absoluteStart, absoluteEnd),
                supabase
                    .from('cashbook_entries')
                    .select('amount, direction, status, payment_method_code')
                    .eq('store_id', storeId)
                    .neq('status', 'cancelled')
                    .neq('status', 'canceled')
                    .or("status.eq.pending,payment_method_code.eq.pending")
            ]);

            const totalPending = (pendingEntriesResult.data || []).reduce((sum, item) => {
                const amount = Number(item.amount || 0);
                return item.direction === 'in' ? sum + amount : sum - amount;
            }, 0);

            setEntries(entriesData);
            setSummary(summaryData);
            setAbsoluteSummary(absoluteSummaryData);
            setPendingAllTime(totalPending);
        } catch (err) {
            console.error('Erro ao carregar dados do livro de caixa:', err);
        } finally {
            setLoading(false);
        }
    }, [storeId, periodFilter, startDate, endDate]);

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
            accountPlanCode: '',
            financialAccountCode: 'cash_drawer',
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
            accountPlanCode: entry.account_plan_code || '',
            financialAccountCode: '',
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
                const classification = buildManualCashbookClassification({
                    direction: formState.direction,
                    paymentMethodCode: formState.paymentMethodCode,
                    accountPlanCode: formState.accountPlanCode,
                    financialAccountCode: formState.financialAccountCode,
                });

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
                    account_plan_code: classification.account_plan_code,
                    source_financial_account_code: classification.source_financial_account_code,
                    destination_financial_account_code: classification.destination_financial_account_code,
                    affects_cash_drawer: classification.affects_cash_drawer,
                    affects_financial_result: classification.affects_financial_result,
                    is_transfer: classification.is_transfer,
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
            const message = error instanceof Error
                ? error.message
                : 'Erro ao salvar lançamento.';

            const isExpectedBusinessRule =
                message.includes('Saldo insuficiente no caixa físico');

            if (isExpectedBusinessRule) {
                toast.error(message);
                return;
            }

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

    if (loadingStore || (loading && entries.length === 0)) return <LoadingSpinner />;

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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">No período</p>
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
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">No período</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                    <div className="flex items-center gap-3 text-[#19A999] mb-3">
                        <div className="p-2 bg-[#19A999]/10 rounded-xl">
                            <Wallet size={20} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Saldo Atual</span>
                    </div>
                    <div className={`text-2xl font-black ${((absoluteSummary?.balance || 0) >= 0) ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>
                        {formatCurrencyPtBr(absoluteSummary?.balance || 0)}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-1.5 flex justify-between items-center border-t border-gray-100 dark:border-gray-700 pt-1.5">
                        <span>Realizado + Pendente:</span>
                        <span>{formatCurrencyPtBr((absoluteSummary?.balance || 0) + pendingAllTime)}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Total acumulado</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                    <div className="flex items-center gap-3 text-[#FAA832] mb-3">
                        <div className="p-2 bg-[#FAA832]/10 rounded-xl">
                            <History size={20} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Pendente / Cancelado</span>
                    </div>
                    <div className="text-sm font-black text-gray-900 dark:text-white space-y-1.5 mt-1">
                        <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                            <span className="text-[10px] font-bold uppercase tracking-wide">Pendente:</span>
                            <span className="text-base tracking-tighter font-extrabold">{formatCurrencyPtBr(pendingAndCancelledSums.pending)}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-400 dark:text-gray-500">
                            <span className="text-[10px] font-bold uppercase tracking-wide">Cancelado:</span>
                            <span className="text-base tracking-tighter line-through font-extrabold">{formatCurrencyPtBr(pendingAndCancelledSums.cancelled)}</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2.5 uppercase font-bold tracking-tighter">Período selecionado</p>
                </div>
            </div>

            <div className="my-6">
                <PendingReceivablesPanel
                    storeId={storeId}
                    entries={entries}
                    canConfirm={canCreateCashbookEntry}
                    onConfirmed={loadData}
                />
            </div>

            {/* Entries List */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <History size={18} className="text-gray-400" />
                        <h2 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">Últimos Lançamentos</h2>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900/60 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setViewMode('libro')}
                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                                viewMode === 'libro'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                            }`}
                        >
                            Modo Livro
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('extrato')}
                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                                viewMode === 'extrato'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                            }`}
                        >
                            Modo Extrato
                        </button>
                    </div>
                </div>

                <div className={`grid grid-cols-1 gap-3 border-b border-gray-100 p-4 dark:border-gray-700 ${viewMode === 'extrato' ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Período</span>
                        <select
                            value={periodFilter}
                            onChange={(event) => {
                                const newPeriod = event.target.value;
                                setPeriodFilter(newPeriod);
                                if (newPeriod !== 'custom') {
                                    const dates = getPeriodDates(newPeriod);
                                    setStartDate(dates.start);
                                    setEndDate(dates.end);
                                }
                            }}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                            <option value="today">Hoje</option>
                            <option value="yesterday">Ontem</option>
                            <option value="current_month">Mês Atual</option>
                            <option value="last_month">Mês Anterior</option>
                            <option value="fortnight">Quinzena Atual</option>
                            <option value="last_fortnight">Quinzena Anterior</option>
                            <option value="week">Semana (Dom-Sáb)</option>
                            <option value="last_week">Semana Anterior</option>
                            <option value="all">Todo o período</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </label>

                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data inicial</span>
                        <div className="relative">
                            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) => {
                                    setStartDate(event.target.value);
                                    setPeriodFilter('custom');
                                }}
                                disabled={periodFilter === 'all'}
                                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 disabled:opacity-50"
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
                                onChange={(event) => {
                                    setEndDate(event.target.value);
                                    setPeriodFilter('custom');
                                }}
                                disabled={periodFilter === 'all'}
                                max={getDateInputValue(new Date())}
                                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 disabled:opacity-50"
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

                    {viewMode === 'extrato' && (
                        <label className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Agrupar por</span>
                            <select
                                value={extratoGroupType}
                                onChange={(event) => setExtratoGroupType(event.target.value as any)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                            >
                                <option value="day">Diário</option>
                                <option value="week">Semanal</option>
                                <option value="fortnight">Quinzenal</option>
                                <option value="month">Mensal</option>
                            </select>
                        </label>
                    )}
                </div>

                {viewMode === 'libro' ? (
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
                                                {(entry.payment_method_code || entry.payment_method) && (
                                                    <div className={`text-[10px] uppercase font-black tracking-tighter ${isCancelled ? cancelledClass : 'text-gray-400'}`}>
                                                        {getPaymentMethodLabel(entry.payment_method_code || entry.payment_method)}
                                                    </div>
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
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-black tracking-tighter">
                                                 <div className={isCancelled ? cancelledClass : entry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}>
                                                     {entry.direction === 'in' ? '+' : '-'} {formatCurrencyPtBr(entry.amount)}
                                                 </div>
                                                 <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-0.5">
                                                     Saldo: {formatCurrencyPtBr(entriesWithRunningBalance.get(entry.id) || 0)}
                                                 </div>
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
                                                    {canCreateCashbookEntry && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditForm(entry)}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                            title={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                            aria-label={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                        >
                                                            <Edit2 size={15} />
                                                        </button>
                                                    )}
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
                ) : (
                    <div className="p-6 space-y-6">
                        {groupedExtrato.length > 0 ? (
                            groupedExtrato.map((group) => {
                                return (
                                    <div key={group.key} className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs bg-gray-50/50 dark:bg-gray-900/10">
                                        {/* Group Header */}
                                        <div className="bg-gray-50 dark:bg-gray-900/60 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
                                            <div>
                                                <h3 className="font-extrabold text-sm text-gray-800 dark:text-gray-200">
                                                    {group.label}
                                                </h3>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 text-xs font-black">
                                                <div className="text-gray-500 dark:text-gray-400">
                                                    SALDO ANTERIOR: <span className="font-extrabold">{formatCurrencyPtBr(group.endingBalance - group.periodRealized)}</span>
                                                </div>
                                                <div className="text-emerald-600 dark:text-emerald-400">
                                                    ENTRADAS: <span className="font-extrabold">+{formatCurrencyPtBr(group.totalIn)}</span>
                                                </div>
                                                <div className="text-rose-600 dark:text-rose-400">
                                                    SAÍDAS: <span className="font-extrabold">-{formatCurrencyPtBr(group.totalOut)}</span>
                                                </div>
                                                <div className="h-4 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block" />
                                                <div className="text-gray-900 dark:text-white flex items-center gap-1">
                                                    <span>SALDO DO PERÍODO:</span>
                                                    <span className={group.periodRealized >= 0 ? 'text-[#19A999]' : 'text-rose-600'}>
                                                        {formatCurrencyPtBr(group.periodRealized)}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400 font-normal">
                                                        ({formatCurrencyPtBr(group.periodRealized)} real. / <span className="text-[#FAA832] font-extrabold">{formatCurrencyPtBr(group.periodPending)} pend.</span>)
                                                    </span>
                                                </div>
                                                <div className="text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-2xs">
                                                    FECHAMENTO: <span className={group.endingBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600'}>
                                                        {formatCurrencyPtBr(group.endingBalance)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Group Transactions List */}
                                        <div className="overflow-x-auto bg-white dark:bg-gray-800">
                                            <table className="w-full text-xs">
                                                <thead className="bg-gray-50/50 dark:bg-gray-900/20 text-gray-400 uppercase text-[9px] font-black tracking-widest border-b border-gray-100 dark:border-gray-800">
                                                    <tr>
                                                        <th className="px-5 py-3 text-left">Data</th>
                                                        <th className="px-5 py-3 text-left">Descrição</th>
                                                        <th className="px-5 py-3 text-left">Tipo</th>
                                                        <th className="px-5 py-3 text-right">Valor</th>
                                                        <th className="px-5 py-3 text-right">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                                    {group.entries.map((entry) => {
                                                        const isCancelled = entry.status === 'cancelled' || entry.status === 'canceled';
                                                        const cancelledClass = isCancelled ? 'text-gray-400 line-through dark:text-gray-500' : '';
                                                        return (
                                                            <tr key={entry.id} className={`transition ${isCancelled ? 'bg-gray-50/70 opacity-75 dark:bg-gray-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                                                <td className={`px-5 py-3 whitespace-nowrap font-medium ${isCancelled ? cancelledClass : 'text-gray-500 dark:text-gray-400'}`}>
                                                                    {new Date(entry.occurred_at).toLocaleDateString('pt-BR')}
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <div className={`font-bold tracking-tight ${isCancelled ? cancelledClass : 'text-gray-900 dark:text-white'}`}>
                                                                        {entry.type === 'sale' ? (
                                                                            <>Venda concluída: {entry.description.replace('Venda concluída pelo pedido ', '')}</>
                                                                        ) : (
                                                                            entry.description
                                                                        )}
                                                                    </div>
                                                                    {entry.type === 'sale' && (
                                                                        <div className={`mt-0.5 text-[10px] font-bold ${isCancelled ? cancelledClass : 'text-gray-500 dark:text-gray-400'}`}>
                                                                            Cliente: {getCustomerLabel(entry) || entry.customer_id || 'Não informado'}
                                                                        </div>
                                                                    )}
                                                                    {(entry.payment_method_code || entry.payment_method) && (
                                                                        <div className={`text-[9px] uppercase font-black tracking-tighter ${isCancelled ? cancelledClass : 'text-gray-400'}`}>
                                                                            {getPaymentMethodLabel(entry.payment_method_code || entry.payment_method)}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-3 whitespace-nowrap">
                                                                    <div className="flex items-center gap-1.5">
                                                                        {entry.direction === 'in' ? (
                                                                            <ArrowUpCircle size={14} className="text-emerald-500" />
                                                                        ) : (
                                                                            <ArrowDownCircle size={14} className="text-rose-500" />
                                                                        )}
                                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${entry.direction === 'in' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                                                            {entry.direction === 'in' ? 'Entrada' : 'Saída'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3 whitespace-nowrap text-right font-black tracking-tighter">
                                                                    <div className={isCancelled ? cancelledClass : entry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}>
                                                                        {entry.direction === 'in' ? '+' : '-'} {formatCurrencyPtBr(entry.amount)}
                                                                    </div>
                                                                    <div className="text-[9px] text-gray-400 dark:text-gray-500 font-bold mt-0.5">
                                                                        Saldo: {formatCurrencyPtBr(entriesWithRunningBalance.get(entry.id) || 0)}
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3 text-right">
                                                                    <div className="flex justify-end gap-1.5">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setSelectedEntry(entry)}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                                            title="Ver detalhes"
                                                                        >
                                                                            <Eye size={13} />
                                                                        </button>
                                                                        {canCreateCashbookEntry && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openEditForm(entry)}
                                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                                                title={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                                            >
                                                                                <Edit2 size={13} />
                                                                            </button>
                                                                        )}
                                                                        {entry.type !== 'sale' && !isCancelled && canCancelCashbookEntry && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleCancelEntry(entry)}
                                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                                                                                title="Cancelar lançamento"
                                                                            >
                                                                                <Ban size={13} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-16 text-center text-gray-400 italic">
                                Nenhum lançamento agrupado encontrado para este período.
                            </div>
                        )}
                    </div>
                )}
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
                                            onChange={(event) => {
                                                const val = event.target.value;
                                                const defaultAcc = val === 'cash' ? 'cash_drawer' : val === 'pix' ? 'pix_wallet' : val === 'card' ? 'card_receivable' : '';
                                                setFormState({
                                                    ...formState,
                                                    paymentMethodCode: val,
                                                    financialAccountCode: defaultAcc,
                                                });
                                            }}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                        >
                                            <option value="cash">Dinheiro</option>
                                            <option value="pix">Pix</option>
                                            <option value="card">Cartão</option>
                                            <option value="pending">Pendente</option>
                                        </select>
                                    </label>

                                    <CashbookClassificationFields
                                        storeId={storeId}
                                        direction={formState.direction}
                                        paymentMethodCode={formState.paymentMethodCode}
                                        accountPlanCode={formState.accountPlanCode}
                                        financialAccountCode={formState.financialAccountCode}
                                        onAccountPlanCodeChange={(value) => setFormState({ ...formState, accountPlanCode: value })}
                                        onFinancialAccountCodeChange={(value) => setFormState({ ...formState, financialAccountCode: value })}
                                    />

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
