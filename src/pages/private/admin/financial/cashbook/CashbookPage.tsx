import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
    History,
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
import { OnlinePaymentsService } from '@/services/onlinePaymentsService';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatCurrencyPtBr } from '@/utils/export/formatters';
import { formatFinancialAccountOptionLabel } from '@/utils/finance/ptBrFinancialLabels';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import PendingReceivablesPanel from './components/PendingReceivablesPanel';
import CashbookClassificationFields, {
    buildManualCashbookClassification,
} from './components/CashbookClassificationFields';
import DateRangeFilter, { getPeriodDates, getDateInputValue } from '@/components/common/DateRangeFilter';

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

function isCancelledStatus(status?: string | null) {
    return status === 'cancelled' || status === 'canceled' || status === 'voided';
}

type CashbookFormMode = 'create' | 'edit';
type CashbookStatusFilter = 'active' | 'cancelled' | 'all';
type ViewMode = 'libro' | 'extrato';
type StatementDetailMode = 'simple' | 'full';

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

interface FinancialAccountOption {
    id: string;
    name: string;
    code: string | null;
    account_type: string | null;
    active: boolean;
    sort_order?: number | null;
    created_at?: string | null;
    metadata?: { hidden_from_workspace?: boolean; [key: string]: unknown } | null;
}

interface AccountStatementAccount {
    id: string;
    name: string;
    code: string | null;
    account_type: string | null;
    active: boolean;
}

interface AccountStatementItem {
    id: string;
    entry_code: string | null;
    entry_date: string;
    occurred_at: string;
    description: string;
    notes?: string | null;
    payment_method?: string | null;
    payment_method_code?: string | null;
    source?: string | null;
    source_id?: string | null;
    order_id?: string | null;
    order_code?: string | null;
    order_customer_name?: string | null;
    customer_id?: string | null;
    type?: string | null;
    account_plan_code?: string | null;
    metadata?: Record<string, unknown> | null;
    affects_financial_result?: boolean | null;
    is_transfer?: boolean | null;
    amount?: number;
    account_direction: 'in' | 'out' | 'transfer';
    signed_amount: number;
    running_balance_after: number;
    counterpart_account_name?: string | null;
    counterpart_account_code?: string | null;
    source_financial_account_id?: string | null;
    destination_financial_account_id?: string | null;
}

interface AccountStatementResult {
    ok: boolean;
    error?: string;
    scope: 'consolidated' | 'account';
    account: AccountStatementAccount | null;
    start_date?: string | null;
    end_date?: string | null;
    opening_balance: number;
    period_inflows: number;
    period_outflows: number;
    period_net: number;
    final_balance: number;
    total: number;
    items: AccountStatementItem[];
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
        pix_manual_qr: 'Pix por QR Code',
        pix_asaas: 'Pix online',
        asaas_pix: 'Pix online',
        payment_link: 'Link de pagamento',
        cash_drawer: 'Caixa da loja',
        card_receivable: 'Recebíveis de cartão',
        external: 'Movimento externo',
        bank_transfer: 'Transferência bancária',
        adjustment: 'Ajuste de saldo',
    };
    return labels[lower] || value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAccountTypeLabel(value?: string | null) {
    const labels: Record<string, string> = {
        cash_drawer: 'Caixa da loja',
        bank: 'Conta bancária',
        pix_wallet: 'Carteira Pix',
        card_acquirer: 'Adquirente',
        card_receivable: 'Recebíveis',
        safe: 'Retaguarda do caixa',
        owner: 'Sócio / proprietário',
        other: 'Outra conta',
    };
    return value ? labels[value] || value : 'Conta financeira';
}

function formatDate(value?: string | null) {
    if (!value) return '—';
    const normalized = value.includes('T') ? value : `${value}T00:00:00`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

function formatDateTime(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

function getPeriodLabel(periodFilter: string, startDate: string, endDate: string) {
    if (periodFilter === 'all') return 'Todo o período';
    if (startDate && endDate) return `${formatDate(startDate)} a ${formatDate(endDate)}`;
    return 'Período selecionado';
}

function normalizeStatement(raw: Record<string, unknown>): AccountStatementResult {
    return {
        ok: Boolean(raw.ok),
        error: typeof raw.error === 'string' ? raw.error : undefined,
        scope: raw.scope === 'account' ? 'account' : 'consolidated',
        account: raw.account && typeof raw.account === 'object' ? raw.account as AccountStatementAccount : null,
        start_date: typeof raw.start_date === 'string' ? raw.start_date : null,
        end_date: typeof raw.end_date === 'string' ? raw.end_date : null,
        opening_balance: Number(raw.opening_balance || 0),
        period_inflows: Number(raw.period_inflows || 0),
        period_outflows: Number(raw.period_outflows || 0),
        period_net: Number(raw.period_net || 0),
        final_balance: Number(raw.final_balance || 0),
        total: Number(raw.total || 0),
        items: Array.isArray(raw.items)
            ? raw.items.map((item) => {
                const row = item as Record<string, unknown>;
                return {
                    ...row,
                    account_direction: row.account_direction === 'out'
                        ? 'out'
                        : row.account_direction === 'transfer'
                            ? 'transfer'
                            : 'in',
                    amount: Number(row.amount || 0),
                    signed_amount: Number(row.signed_amount || 0),
                    running_balance_after: Number(row.running_balance_after || 0),
                } as AccountStatementItem;
            })
            : [],
    };
}

export default function CashbookPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();

    const { hasPermission } = usePermissions(storeId ?? null);
    const canCreateCashbookEntry = hasPermission('cashbook.create');
    const canCancelCashbookEntry = hasPermission('cashbook.cancel');
    const canExportReports = hasPermission('reports.export');
    const canViewOnlinePayments = hasPermission('payments.online.view');

    const initialDates = getPeriodDates('current_month');
    const [entries, setEntries] = useState<CashbookEntry[]>([]);
    const [summary, setSummary] = useState<CashbookSummary | null>(null);
    const [cardReceivables, setCardReceivables] = useState({
        count: 0,
        gross: 0,
        fees: 0,
        net: 0,
    });
    const [receivableByOrderId, setReceivableByOrderId] = useState<Record<string, {
        status: string;
        settledAt: string | null;
        expectedSettlementAt: string | null;
        grossAmount: number;
        feeAmount: number;
        anticipationFeeAmount: number;
        netAmount: number;
    }>>({});
    const [accounts, setAccounts] = useState<FinancialAccountOption[]>([]);
    const [statement, setStatement] = useState<AccountStatementResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [statementLoading, setStatementLoading] = useState(false);
    const [startDate, setStartDate] = useState(initialDates.start);
    const [endDate, setEndDate] = useState(initialDates.end);
    const [periodFilter, setPeriodFilter] = useState('current_month');
    const [viewMode, setViewMode] = useState<ViewMode>('libro');
    const [statementDetailMode, setStatementDetailMode] = useState<StatementDetailMode>('simple');
    const [statementAccountId, setStatementAccountId] = useState('all');
    const [customerFilter, setCustomerFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<CashbookStatusFilter>('active');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<CashbookEntry | null>(null);
    const [selectedStatementItem, setSelectedStatementItem] = useState<AccountStatementItem | null>(null);
    const [formState, setFormState] = useState<CashbookFormState | null>(null);
    const [savingForm, setSavingForm] = useState(false);
    const [balanceAdjustmentForm, setBalanceAdjustmentForm] = useState<{
        targetBalance: string;
        effectiveAt: string;
        notes: string;
    } | null>(null);
    const [savingBalanceAdjustment, setSavingBalanceAdjustment] = useState(false);

    const selectedAccount = useMemo(
        () => accounts.find((account) => account.id === statementAccountId) || null,
        [accounts, statementAccountId],
    );

    const accountNameById = useMemo(
        () => Object.fromEntries(accounts.map((account) => [account.id, account.name])),
        [accounts],
    );

    const displayedStatementItems = useMemo(() => {
        const items = statement?.items || [];
        if (statementDetailMode === 'full') return items;
        if (statementAccountId !== 'all') return items;

        return items.filter((item) => item.source !== 'online_payment_settlement');
    }, [statement?.items, statementAccountId, statementDetailMode]);

    const filteredEntries = useMemo(() => {
        const customerTerm = customerFilter.trim().toLowerCase();

        return entries.filter((entry) => {
            // Modo Livro é propositalmente operacional: liquidações e transferências
            // entre contas ficam no Modo Extrato para não parecerem receitas/despesas.
            if (entry.is_transfer === true || entry.affects_financial_result === false) return false;

            const isCancelled = isCancelledStatus(entry.status);
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
                    entry.payment_method,
                    entry.payment_method_code,
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

            const amount = Number(entry.amount || 0);
            const signed = entry.direction === 'in' ? amount : -amount;
            const isCancelled = isCancelledStatus(entry.status);
            const isPending = !isCancelled && (
                entry.status === 'pending' ||
                entry.payment_method_code === 'pending' ||
                (entry.payment_method && entry.payment_method.toLowerCase() === 'pending') ||
                entry.affects_balance === false
            );

            if (isPending) pending += signed;
            if (isCancelled) cancelled += signed;
        });

        return { pending, cancelled };
    }, [entries, startDate, endDate]);

    const loadStatement = useCallback(async () => {
        if (!storeId) return;
        try {
            setStatementLoading(true);
            const { data, error } = await supabase.rpc('list_financial_account_statement_safe', {
                p_store_id: storeId,
                p_account_id: statementAccountId === 'all' ? null : statementAccountId,
                p_start_date: periodFilter === 'all' ? null : (startDate || null),
                p_end_date: periodFilter === 'all' ? null : (endDate || null),
                p_limit: 500,
                p_offset: 0,
            });
            if (error) throw error;
            const normalized = normalizeStatement((data || {}) as Record<string, unknown>);
            if (!normalized.ok) throw new Error(normalized.error || 'Erro ao carregar extrato.');
            setStatement(normalized);
        } catch (error) {
            console.error('Erro ao carregar extrato financeiro:', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao carregar extrato financeiro.');
        } finally {
            setStatementLoading(false);
        }
    }, [endDate, periodFilter, startDate, statementAccountId, storeId]);

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

            const [entriesData, summaryData, accountsResult, onlineReceivablesResult] = await Promise.all([
                CashbookService.listByStore(storeId, rangeStart, rangeEnd),
                CashbookService.getSummary(storeId, rangeStart || absoluteStart, rangeEnd || absoluteEnd),
                supabase
                    .from('store_financial_accounts')
                    .select('id, name, code, account_type, active, sort_order, created_at, metadata')
                    .eq('store_id', storeId)
                    .order('active', { ascending: false })
                    .order('sort_order', { ascending: true })
                    .order('name', { ascending: true }),
                canViewOnlinePayments
                    ? OnlinePaymentsService.listReceivables(storeId, { limit: 500 }).catch(() => null)
                    : Promise.resolve(null),
            ]);

            if (accountsResult.error) throw accountsResult.error;

            const allCardReceivables = onlineReceivablesResult?.items || [];
            const openCardReceivables = allCardReceivables.filter(
                (receivable) => receivable.status !== 'settled',
            );

            setEntries(entriesData);
            setSummary(summaryData);
            setCardReceivables({
                count: openCardReceivables.length,
                gross: openCardReceivables.reduce((total, receivable) => total + Number(receivable.gross_amount || 0), 0),
                fees: openCardReceivables.reduce(
                    (total, receivable) => total + Number(receivable.fee_amount || 0) + Number(receivable.anticipation_fee_amount || 0),
                    0,
                ),
                net: openCardReceivables.reduce((total, receivable) => total + Number(receivable.net_amount || 0), 0),
            });
            setReceivableByOrderId(Object.fromEntries(
                allCardReceivables
                    .filter((receivable) => Boolean(receivable.order_id))
                    .map((receivable) => [
                        receivable.order_id as string,
                        {
                            status: receivable.status,
                            settledAt: receivable.settled_at || null,
                            expectedSettlementAt: receivable.expected_settlement_at || null,
                            grossAmount: Number(receivable.gross_amount || 0),
                            feeAmount: Number(receivable.fee_amount || 0),
                            anticipationFeeAmount: Number(receivable.anticipation_fee_amount || 0),
                            netAmount: Number(receivable.net_amount || 0),
                        },
                    ]),
            ));
            setAccounts(((accountsResult.data || []) as FinancialAccountOption[]).filter(
                (account) => account.active && account.metadata?.hidden_from_workspace !== true,
            ));
        } catch (err) {
            console.error('Erro ao carregar dados do livro de caixa:', err);
            toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados do livro de caixa.');
        } finally {
            setLoading(false);
        }
    }, [storeId, periodFilter, startDate, endDate, canViewOnlinePayments]);

    useEffect(() => {
        if (!loadingStore && storeId) {
            void loadData();
        }
    }, [loadData, loadingStore, storeId]);

    useEffect(() => {
        if (!loadingStore && storeId) {
            void loadStatement();
        }
    }, [loadStatement, loadingStore, storeId]);

    function handlePrint() {
        if (!canExportReports) {
            toast.error('Você não tem permissão para imprimir relatórios.');
            return;
        }
        window.print();
    }

    function openCreateForm(direction: CashbookDirection, account?: FinancialAccountOption | null) {
        const paymentMethodCode = account
            ? account.account_type === 'cash_drawer'
                ? 'cash'
                : account.account_type === 'pix_wallet'
                    ? 'pix'
                    : ['card_receivable', 'card_acquirer'].includes(account.account_type || '')
                        ? 'card'
                        : 'external'
            : 'cash';

        setFormState({
            mode: 'create',
            direction,
            entry: null,
            description: '',
            amount: '',
            paymentMethodCode,
            notes: '',
            occurredAt: getDateTimeLocalValue(),
            accountPlanCode: '',
            financialAccountCode: account?.code || 'clc',
        });
    }

    function openBalanceAdjustment() {
        if (!selectedAccount) {
            toast.error('Selecione uma conta específica para ajustar o saldo acumulado.');
            return;
        }

        setBalanceAdjustmentForm({
            targetBalance: String(Number(statement?.final_balance || 0).toFixed(2)).replace('.', ','),
            effectiveAt: getDateTimeLocalValue(),
            notes: '',
        });
    }

    async function handleBalanceAdjustment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!storeId || !selectedAccount || !balanceAdjustmentForm) return;

        const targetBalance = Number(balanceAdjustmentForm.targetBalance.replace(',', '.'));
        if (!Number.isFinite(targetBalance)) {
            toast.error('Informe um saldo válido.');
            return;
        }

        try {
            setSavingBalanceAdjustment(true);
            const result = await CashbookService.adjustFinancialAccountBalance({
                store_id: storeId,
                account_id: selectedAccount.id,
                effective_at: new Date(balanceAdjustmentForm.effectiveAt).toISOString(),
                target_balance: targetBalance,
                notes: balanceAdjustmentForm.notes.trim() || null,
            });

            setBalanceAdjustmentForm(null);
            await loadData();
            await loadStatement();

            if (result.changed === false) {
                toast.success('O saldo acumulado já estava conferido.');
            } else {
                toast.success('Saldo acumulado ajustado sem alterar o resultado operacional.');
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível ajustar o saldo acumulado.');
        } finally {
            setSavingBalanceAdjustment(false);
        }
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
            await loadStatement();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro ao salvar lançamento.';
            const isExpectedBusinessRule = message.includes('Saldo insuficiente no caixa físico');
            if (!isExpectedBusinessRule) console.error('Erro ao salvar lançamento:', error);
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
            await loadStatement();
        } catch (error) {
            console.error('Erro ao cancelar lançamento:', error);
            toast.error('Erro ao cancelar lançamento.');
        }
    }

    if (loadingStore || (loading && entries.length === 0 && !statement)) return <LoadingSpinner />;

    const periodLabel = getPeriodLabel(periodFilter, startDate, endDate);
    const statementScopeLabel = statementAccountId === 'all'
        ? 'Todas as contas'
        : selectedAccount?.name || statement?.account?.name || 'Conta selecionada';
    const statementScopeDetail = statementAccountId === 'all'
        ? 'Extrato consolidado da loja'
        : getAccountTypeLabel(selectedAccount?.account_type || statement?.account?.account_type);

    return (
        <PageContainer
            title="Livro diário de caixa"
            subtitle="Resultado da operação e extrato de cada conta financeira, separados para facilitar a conferência."
            category="Financeiro"
            icon={<WalletCards size={28} className="text-[#19A999]" />}
            onRefresh={() => { void loadData(); void loadStatement(); }}
            action={
                <div className="grid w-full max-w-full grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:flex sm:w-auto sm:items-center">
                    {canViewOnlinePayments && (
                        <Link
                            to="/admin/online-payments?tab=receivables"
                            className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-2 py-2 text-center text-sm font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200 sm:px-4"
                        >
                            <Landmark size={16} />Recebíveis
                        </Link>
                    )}
                    {canCreateCashbookEntry && (
                        <>
                            <button type="button" onClick={() => openCreateForm('in')} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-2 py-2 text-center text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 sm:px-4"><Plus size={16} />Nova Entrada</button>
                            <button type="button" onClick={() => openCreateForm('out')} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-2 py-2 text-center text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 active:scale-95 sm:px-4"><Minus size={16} />Nova Saída</button>
                        </>
                    )}
                    {canExportReports && <button type="button" onClick={handlePrint} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-2 text-center text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 sm:px-4">Imprimir</button>}
                </div>
            }
            flat
        >
            <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-4 text-sm font-bold text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/20 dark:text-teal-100">
                <span className="font-black">Leitura simples:</span> <strong>Modo Livro</strong> mostra somente o que altera o resultado da operação. <strong>Modo Extrato</strong> mostra onde o dinheiro está e as transferências entre contas.
            </div>

            {viewMode === 'libro' ? (
                <>
                <div className="grid max-w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
                    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:rounded-3xl sm:p-6"><div className="mb-3 flex items-center gap-3 text-emerald-600 dark:text-emerald-400"><div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-900/20"><TrendingUp size={20} /></div><span className="text-xs font-black uppercase tracking-widest">Entradas</span></div><div className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(summary?.total_in || 0)}</div><p className="mt-1 text-[10px] font-bold uppercase tracking-tighter text-gray-400">Afetam o resultado · {periodLabel}</p></div>
                    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:rounded-3xl sm:p-6"><div className="mb-3 flex items-center gap-3 text-rose-600 dark:text-rose-400"><div className="rounded-xl bg-rose-50 p-2 dark:bg-rose-900/20"><TrendingDown size={20} /></div><span className="text-xs font-black uppercase tracking-widest">Saídas</span></div><div className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(summary?.total_out || 0)}</div><p className="mt-1 text-[10px] font-bold uppercase tracking-tighter text-gray-400">Afetam o resultado · {periodLabel}</p></div>
                    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:rounded-3xl sm:p-6"><div className="mb-3 flex items-center gap-3 text-[#19A999]"><div className="rounded-xl bg-[#19A999]/10 p-2"><Wallet size={20} /></div><span className="text-xs font-black uppercase tracking-widest">Resultado operacional</span></div><div className={`text-2xl font-black ${(summary?.balance || 0) >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>{formatCurrencyPtBr(summary?.balance || 0)}</div><p className="mt-1 text-[10px] font-bold uppercase tracking-tighter text-gray-400">Reconhecido no período · não é saldo bancário</p></div>
                    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:rounded-3xl sm:p-6"><div className="mb-3 flex items-center gap-3 text-[#FAA832]"><div className="rounded-xl bg-[#FAA832]/10 p-2"><History size={20} /></div><span className="text-xs font-black uppercase tracking-widest">Não realizado</span></div><div className="space-y-1.5 text-sm font-black text-gray-900 dark:text-white"><div className="flex items-center justify-between text-amber-600 dark:text-amber-400"><span className="text-[10px] uppercase tracking-wide">Pendente</span><span>{formatCurrencyPtBr(pendingAndCancelledSums.pending)}</span></div><div className="flex items-center justify-between text-gray-400"><span className="text-[10px] uppercase tracking-wide">Cancelado</span><span className="line-through">{formatCurrencyPtBr(pendingAndCancelledSums.cancelled)}</span></div></div><p className="mt-2 text-[10px] font-bold uppercase tracking-tighter text-gray-400">Do período filtrado</p></div>
                </div>
                {canViewOnlinePayments && cardReceivables.count > 0 && (
                    <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-violet-800 dark:text-violet-200">
                                    <Landmark size={18} />
                                    <p className="font-black">Recebíveis de cartão ainda não liquidados</p>
                                </div>
                                <p className="mt-1 text-sm font-semibold text-violet-950/80 dark:text-violet-100/80">
                                    <strong>{formatCurrencyPtBr(cardReceivables.net)}</strong> líquidos em {cardReceivables.count} recebível(is) aguardando liquidação.
                                </p>
                                <p className="mt-1 text-xs text-violet-800/75 dark:text-violet-200/75">
                                    As vendas já estão no resultado. Abra Recebíveis apenas para acompanhar quando o dinheiro será liquidado.
                                </p>
                            </div>
                            <Link
                                to="/admin/online-payments?tab=receivables"
                                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-700"
                            >
                                Abrir recebíveis
                            </Link>
                        </div>
                    </div>
                )}
                </>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-[#19A999]">Extrato financeiro</p><h2 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{statementScopeLabel}</h2><p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{statementScopeDetail} · {periodLabel}</p><div className="mt-3 inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-950"><button type="button" onClick={() => setStatementDetailMode('simple')} className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${statementDetailMode === 'simple' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white' : 'text-gray-500'}`}>Simplificado</button><button type="button" onClick={() => setStatementDetailMode('full')} className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${statementDetailMode === 'full' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white' : 'text-gray-500'}`}>Completo</button></div><p className="mt-2 max-w-xl text-xs font-semibold text-gray-400">{statementDetailMode === 'simple' ? 'No consolidado, liquidações técnicas são incorporadas ao status da venda original.' : 'Mostra também cada transferência e liquidação técnica entre contas.'}</p></div><div className="w-full max-w-md space-y-2"><label className="block space-y-1"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Conta do extrato</span><select value={statementAccountId} onChange={(event) => setStatementAccountId(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-600 dark:bg-slate-950 dark:text-white"><option value="all">Todas as contas — consolidado</option>{accounts.map((account) => <option key={account.id} value={account.id}>{formatFinancialAccountOptionLabel(account)}{account.active ? '' : ' (inativa)'}</option>)}</select></label>{selectedAccount && canCreateCashbookEntry && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><button type="button" onClick={() => openCreateForm('in', selectedAccount)} disabled={!selectedAccount.code} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">+ Entrada externa</button><button type="button" onClick={() => openCreateForm('out', selectedAccount)} disabled={!selectedAccount.code} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">− Saída externa</button><button type="button" onClick={openBalanceAdjustment} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 hover:bg-cyan-100 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-200">Ajustar saldo</button></div>}</div></div></div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"><p className="text-xs font-black uppercase tracking-widest text-gray-400">Saldo acumulado</p><p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(statement?.opening_balance || 0)}</p><p className="mt-1 text-[10px] font-bold uppercase text-gray-400">Até o início do período</p></div>
                        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"><p className="text-xs font-black uppercase tracking-widest text-emerald-600">Entradas</p><p className="mt-2 text-2xl font-black text-emerald-600">{formatCurrencyPtBr(statement?.period_inflows || 0)}</p><p className="mt-1 text-[10px] font-bold uppercase text-gray-400">Neste período</p></div>
                        <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"><p className="text-xs font-black uppercase tracking-widest text-rose-600">Saídas</p><p className="mt-2 text-2xl font-black text-rose-600">{formatCurrencyPtBr(statement?.period_outflows || 0)}</p><p className="mt-1 text-[10px] font-bold uppercase text-gray-400">Neste período</p></div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"><p className="text-xs font-black uppercase tracking-widest text-gray-400">Variação do período</p><p className={`mt-2 text-2xl font-black ${(statement?.period_net || 0) >= 0 ? 'text-[#19A999]' : 'text-rose-600'}`}>{formatCurrencyPtBr(statement?.period_net || 0)}</p><p className="mt-1 text-[10px] font-bold uppercase text-gray-400">Entradas - saídas</p></div>
                        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 shadow-sm dark:border-teal-900/60 dark:bg-teal-950/20"><p className="text-xs font-black uppercase tracking-widest text-teal-700 dark:text-teal-300">Saldo ao fim</p><p className={`mt-2 text-2xl font-black ${(statement?.final_balance || 0) >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>{formatCurrencyPtBr(statement?.final_balance || 0)}</p><p className="mt-1 text-[10px] font-bold uppercase text-gray-500">{statementScopeLabel}</p></div>
                    </div>
                </div>
            )}

            <div className="my-6"><PendingReceivablesPanel storeId={storeId} entries={entries} canConfirm={canCreateCashbookEntry} onConfirmed={() => { void loadData(); void loadStatement(); }} /></div>

            <div className="max-w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-center gap-2"><History size={18} className="text-gray-400" /><h2 className="font-black uppercase tracking-tight text-gray-900 dark:text-white">{viewMode === 'extrato' ? 'Extrato por conta' : 'Operações do período'}</h2></div><div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900/60"><button type="button" onClick={() => setViewMode('libro')} className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'libro' ? 'bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>Modo Livro</button><button type="button" onClick={() => setViewMode('extrato')} className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'extrato' ? 'bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>Modo Extrato</button></div></div>
                <div className="border-b border-gray-100 dark:border-gray-700"><div className="flex p-3 md:hidden"><button type="button" onClick={() => setFiltersOpen((open) => !open)} className="inline-flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200"><span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} /> Filtros e período</span>{filtersOpen ? <span>Ocultar</span> : <span>Mostrar</span>}</button></div><div className={`${filtersOpen ? 'grid' : 'hidden'} grid-cols-1 gap-3 p-3 sm:p-4 md:grid ${viewMode === 'extrato' ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}><DateRangeFilter periodFilter={periodFilter} onPeriodChange={setPeriodFilter} startDate={startDate} onStartDateChange={setStartDate} endDate={endDate} onEndDateChange={setEndDate} className="col-span-1 md:col-span-3" />{viewMode === 'extrato' ? <label className="space-y-1 md:col-span-2"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Conta</span><select value={statementAccountId} onChange={(event) => setStatementAccountId(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"><option value="all">Todas as contas — consolidado</option>{accounts.map((account) => <option key={account.id} value={account.id}>{formatFinancialAccountOptionLabel(account)}{account.active ? '' : ' (inativa)'}</option>)}</select></label> : <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cliente em venda</span><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} placeholder="Nome, descrição, pedido ou cliente" className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" /></div></label>}<label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CashbookStatusFilter)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" disabled={viewMode === 'extrato'}><option value="active">Ativos</option><option value="cancelled">Cancelados</option><option value="all">Todos</option></select></label></div></div>

                {viewMode === 'libro' && (
                    <div className="border-b border-gray-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-slate-300 sm:px-6">
                        Aqui aparecem somente vendas, despesas, estornos e ajustes que afetam o resultado. Liquidações de cartão e outras transferências internas ficam no <strong>Modo Extrato</strong>.
                    </div>
                )}

                {viewMode === 'libro' ? (
                    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"><table className="w-full min-w-[660px] text-sm"><thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:bg-gray-900/40"><tr><th className="px-6 py-4 text-left">Data</th><th className="px-6 py-4 text-left">Descrição</th><th className="px-6 py-4 text-left">Tipo</th><th className="px-6 py-4 text-right">Valor</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-50 dark:divide-gray-700">{filteredEntries.length > 0 ? filteredEntries.map((entry) => { const isCancelled = isCancelledStatus(entry.status); const cancelledClass = isCancelled ? 'text-gray-400 line-through dark:text-gray-500' : ''; return <tr key={entry.id} className={`transition ${isCancelled ? 'bg-gray-50/70 opacity-75 dark:bg-gray-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}><td className={`whitespace-nowrap px-6 py-4 font-medium ${isCancelled ? cancelledClass : 'text-gray-500 dark:text-gray-400'}`}>{formatDate(entry.occurred_at)}</td><td className="px-6 py-4"><div className={`font-bold tracking-tight ${isCancelled ? cancelledClass : 'text-gray-900 dark:text-white'}`}>{entry.type === 'sale' ? <>Venda concluída: {entry.description.replace('Venda concluída pelo pedido ', '')}</> : entry.description}</div>{entry.type === 'sale' && <div className={`mt-1 text-xs font-bold ${isCancelled ? cancelledClass : 'text-gray-500 dark:text-gray-400'}`}>Cliente: {getCustomerLabel(entry) || entry.customer_id || 'Não informado'}</div>}{(entry.payment_method_code || entry.payment_method) && <div className={`text-[10px] font-black uppercase tracking-tighter ${isCancelled ? cancelledClass : 'text-gray-400'}`}>{getPaymentMethodLabel(entry.payment_method_code || entry.payment_method)}</div>}</td><td className="whitespace-nowrap px-6 py-4"><div className="flex items-center gap-2">{entry.direction === 'in' ? <ArrowUpCircle size={16} className="text-emerald-500" /> : <ArrowDownCircle size={16} className="text-rose-500" />}<span className={`text-[10px] font-black uppercase tracking-widest ${entry.direction === 'in' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{entry.direction === 'in' ? 'Entrada' : 'Saída'}</span></div></td><td className="whitespace-nowrap px-6 py-4 text-right font-black tracking-tighter"><div className={isCancelled ? cancelledClass : entry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}>{entry.direction === 'in' ? '+' : '-'} {formatCurrencyPtBr(entry.amount)}</div></td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => setSelectedEntry(entry)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700" title="Ver detalhes" aria-label="Ver detalhes"><Eye size={15} /></button>{canCreateCashbookEntry && <button type="button" onClick={() => openEditForm(entry)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700" title={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'} aria-label={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}><Edit2 size={15} /></button>}{entry.type !== 'sale' && !isCancelled && canCancelCashbookEntry && <button type="button" onClick={() => handleCancelEntry(entry)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30" title="Cancelar lançamento" aria-label="Cancelar lançamento"><Ban size={15} /></button>}</div></td></tr>; }) : <tr><td colSpan={5} className="px-6 py-16 text-center italic text-gray-400">Nenhum lançamento encontrado.</td></tr>}</tbody></table></div>
                ) : (
                    <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-sm"><thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:bg-gray-900/40"><tr><th className="px-6 py-4 text-left">Data</th><th className="px-6 py-4 text-left">Lançamento</th><th className="px-6 py-4 text-left">Forma</th><th className="px-6 py-4 text-right">Entrada</th><th className="px-6 py-4 text-right">Saída</th><th className="px-6 py-4 text-right">Saldo após</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-50 dark:divide-gray-700">{statementLoading ? <tr><td colSpan={7} className="px-6 py-16 text-center font-bold text-gray-400">Carregando extrato financeiro...</td></tr> : statement && displayedStatementItems.length > 0 ? displayedStatementItems.map((item) => {
                        const receivable = item.order_id ? receivableByOrderId[item.order_id] : null;
                        const isSettlement = item.source === 'online_payment_settlement';
                        const sourceAccountName = item.source_financial_account_id ? accountNameById[item.source_financial_account_id] : null;
                        const destinationAccountName = item.destination_financial_account_id ? accountNameById[item.destination_financial_account_id] : null;
                        const totalFees = receivable
                            ? receivable.feeAmount + receivable.anticipationFeeAmount
                            : Number(item.metadata?.total_fee_amount || item.metadata?.fee_amount || 0);
                        const grossAmount = receivable?.grossAmount || Number(item.metadata?.gross_amount || 0);
                        const creditedNet = receivable?.netAmount || Number(item.metadata?.net_amount || item.amount || 0);
                        const isOpeningEntry = item.source === 'cashbook' || item.type === 'adjustment';
                        const title = isSettlement ? 'Recebimento de cartão'
                          : isOpeningEntry && String(item.notes || '').includes('Abertura de conta') && item.description.startsWith('Ajuste de saldo acumulado')
                            ? item.description.replace('Ajuste de saldo acumulado', 'Saldo inicial de abertura')
                            : item.description;
                        return <tr key={item.id} className="transition hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="whitespace-nowrap px-6 py-4 font-medium text-gray-500 dark:text-gray-400">{formatDate(item.occurred_at)}</td><td className="px-6 py-4"><div className="flex flex-wrap items-center gap-2"><div className="font-bold tracking-tight text-gray-900 dark:text-white">{title}</div>{!isSettlement && item.type === 'sale' && receivable && <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${receivable.status === 'settled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>{receivable.status === 'settled' ? `Liquidado${receivable.settledAt ? ` · ${formatDate(receivable.settledAt)}` : ''}` : 'A receber'}</span>}</div><div className="mt-1 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-tighter text-gray-400">{item.order_code && <span>{item.order_code}</span>}{item.order_customer_name && <span>Cliente: {item.order_customer_name}</span>}{isSettlement && grossAmount > 0 && <span className="normal-case tracking-normal text-gray-500 dark:text-gray-300">Venda bruta {formatCurrencyPtBr(grossAmount)} · Taxas {formatCurrencyPtBr(totalFees)} · Líquido creditado {formatCurrencyPtBr(creditedNet)}</span>}{isSettlement && statementDetailMode === 'full' && sourceAccountName && destinationAccountName && <span>Movimentação interna: {sourceAccountName} → {destinationAccountName}</span>}{!isSettlement && item.type === 'sale' && receivable && <span className="normal-case tracking-normal text-gray-500 dark:text-gray-300">Bruto {formatCurrencyPtBr(receivable.grossAmount)} · Taxas {formatCurrencyPtBr(receivable.feeAmount + receivable.anticipationFeeAmount)} · Líquido {formatCurrencyPtBr(receivable.netAmount)}</span>}{!isSettlement && item.type === 'sale' && receivable?.status !== 'settled' && receivable?.expectedSettlementAt && <span>Previsto: {formatDate(receivable.expectedSettlementAt)}</span>}</div></td><td className="whitespace-nowrap px-6 py-4 text-xs font-black uppercase text-gray-500 dark:text-gray-400">{getPaymentMethodLabel(item.payment_method_code || item.payment_method)}</td><td className="whitespace-nowrap px-6 py-4 text-right font-black text-emerald-600">{item.signed_amount > 0 ? `+ ${formatCurrencyPtBr(item.signed_amount)}` : '—'}</td><td className="whitespace-nowrap px-6 py-4 text-right font-black text-rose-600">{item.signed_amount < 0 ? `- ${formatCurrencyPtBr(Math.abs(item.signed_amount))}` : '—'}</td><td className={`whitespace-nowrap px-6 py-4 text-right font-black ${(item.running_balance_after || 0) >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>{formatCurrencyPtBr(item.running_balance_after || 0)}</td><td className="px-6 py-4 text-right"><button type="button" onClick={() => setSelectedStatementItem(item)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700" title="Ver detalhes"><Eye size={15} /></button></td></tr>;
                    }) : <tr><td colSpan={7} className="px-6 py-16 text-center italic text-gray-400">Nenhum movimento financeiro encontrado para este escopo.</td></tr>}</tbody></table></div>
                )}
            </div>

            {formState && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><form onSubmit={handleSubmitForm} className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-gray-900"><div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6 dark:border-gray-800"><div><p className="text-xs font-black uppercase tracking-widest text-[#19A999]">Livro diário</p><h3 className="mt-1 text-xl font-black text-gray-900 dark:text-white">{getFormTitle(formState)}</h3></div><button type="button" onClick={() => setFormState(null)} className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800" aria-label="Fechar formulário"><X size={18} /></button></div><div className="space-y-4 p-6">{formState.mode === 'edit' && formState.entry?.type === 'sale' && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">Lançamentos de venda permitem alterar apenas a descrição.</div>}<label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Descrição</span><input value={formState.description} onChange={(event) => setFormState({ ...formState, description: event.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="Descrição do lançamento" /></label>{formState.entry?.type !== 'sale' && <><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Valor</span><input value={formState.amount} onChange={(event) => setFormState({ ...formState, amount: event.target.value })} inputMode="decimal" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="0,00" /></label><label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Data e hora</span><input type="datetime-local" value={formState.occurredAt} onChange={(event) => setFormState({ ...formState, occurredAt: event.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" /></label></div><label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Forma de pagamento</span><select value={formState.paymentMethodCode} onChange={(event) => { const val = event.target.value; const defaultAcc = ['cash', 'pix', 'card'].includes(val) ? 'clc' : val === 'external' ? formState.financialAccountCode : ''; setFormState({ ...formState, paymentMethodCode: val, financialAccountCode: defaultAcc }); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"><option value="cash">Dinheiro</option><option value="pix">Pix</option><option value="card">Cartão</option><option value="external">Movimento externo / banco</option><option value="pending">Pendente</option></select></label><CashbookClassificationFields storeId={storeId} direction={formState.direction} paymentMethodCode={formState.paymentMethodCode} accountPlanCode={formState.accountPlanCode} financialAccountCode={formState.financialAccountCode} onAccountPlanCodeChange={(value) => setFormState({ ...formState, accountPlanCode: value })} onFinancialAccountCodeChange={(value) => setFormState({ ...formState, financialAccountCode: value })} /><label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500">Observações</span><textarea value={formState.notes} onChange={(event) => setFormState({ ...formState, notes: event.target.value })} rows={3} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="Detalhes internos opcionais" /></label></>}</div><div className="flex justify-end gap-2 border-t border-gray-100 p-6 dark:border-gray-800"><button type="button" onClick={() => setFormState(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancelar</button><button type="submit" disabled={savingForm || !canCreateCashbookEntry} className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white transition hover:bg-[#188575] disabled:cursor-not-allowed disabled:opacity-60"><Save size={16} />Salvar lançamento</button></div></form></div>}

            {balanceAdjustmentForm && selectedAccount && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><form onSubmit={handleBalanceAdjustment} className="w-full max-w-lg overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6 dark:border-gray-700"><div><p className="text-xs font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-300">Conferência de conta</p><h3 className="mt-1 text-xl font-black text-gray-900 dark:text-white">Ajustar saldo acumulado</h3><p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-300">{selectedAccount.name}</p><p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Cadastrada em {formatDateTime(selectedAccount.created_at)} · saldo calculado {formatCurrencyPtBr(statement?.final_balance || 0)}</p></div><button type="button" onClick={() => setBalanceAdjustmentForm(null)} className="rounded-xl border border-gray-200 p-2 text-gray-500 dark:border-gray-600 dark:text-gray-200"><X size={18} /></button></div><div className="space-y-4 p-6"><div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-semibold text-cyan-950 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100">Informe o saldo real mostrado pelo banco ou pela conta externa. O valor pode ser negativo quando houver saldo devedor ou uso de limite. O sistema cria apenas a diferença necessária para reconciliar o extrato; isso <strong>não altera o resultado operacional</strong>.</div><label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">Saldo real / acumulado</span><input value={balanceAdjustmentForm.targetBalance} onChange={(event) => setBalanceAdjustmentForm({ ...balanceAdjustmentForm, targetBalance: event.target.value })} inputMode="decimal" required className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-lg font-black text-gray-900 outline-none focus:border-cyan-500 dark:border-gray-600 dark:bg-slate-950 dark:text-white" placeholder="0,00" /></label><label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">Data e hora da conferência</span><input type="datetime-local" value={balanceAdjustmentForm.effectiveAt} onChange={(event) => setBalanceAdjustmentForm({ ...balanceAdjustmentForm, effectiveAt: event.target.value })} required className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-900 outline-none focus:border-cyan-500 dark:border-gray-600 dark:bg-slate-950 dark:text-white" /></label><label className="block space-y-1"><span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">Observação</span><textarea value={balanceAdjustmentForm.notes} onChange={(event) => setBalanceAdjustmentForm({ ...balanceAdjustmentForm, notes: event.target.value })} rows={3} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-cyan-500 dark:border-gray-600 dark:bg-slate-950 dark:text-white" placeholder="Ex.: saldo inicial trazido do banco / conferência do extrato" /></label></div><div className="flex justify-end gap-2 border-t border-gray-100 p-6 dark:border-gray-700"><button type="button" onClick={() => setBalanceAdjustmentForm(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 dark:border-gray-600 dark:text-gray-200">Cancelar</button><button type="submit" disabled={savingBalanceAdjustment} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-black text-white hover:bg-cyan-700 disabled:opacity-50">{savingBalanceAdjustment ? 'Ajustando…' : 'Confirmar saldo'}</button></div></form></div>}

            {selectedEntry && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-gray-900"><div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"><div><p className="text-xs font-black uppercase tracking-widest text-[#19A999]">Detalhes do lançamento</p><h3 className="mt-1 text-xl font-black text-gray-900 dark:text-white">{selectedEntry.description}</h3></div><button type="button" onClick={() => setSelectedEntry(null)} className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800" aria-label="Fechar detalhes"><X size={18} /></button></div><div className="space-y-5 p-6"><div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cliente</p><p className="mt-1 text-lg font-black text-gray-900 dark:text-white">{getCustomerLabel(selectedEntry) || selectedEntry.customer_id || 'Não informado'}</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valor</p><p className={`mt-1 text-2xl font-black ${selectedEntry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>{selectedEntry.direction === 'in' ? '+' : '-'} {formatCurrencyPtBr(selectedEntry.amount)}</p></div><div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo</p><p className="mt-1 font-black text-gray-900 dark:text-white">{getTypeLabel(selectedEntry)} / {selectedEntry.direction === 'in' ? 'Entrada' : 'Saída'}</p></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{formatDateTime(selectedEntry.occurred_at)}</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{getStatusLabel(selectedEntry.status)}</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Forma de pagamento</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{getPaymentMethodLabel(selectedEntry.payment_method || selectedEntry.payment_method_code)}</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Afeta saldo</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{selectedEntry.affects_balance ? 'Sim' : 'Não'}</p></div></div>{selectedEntry.notes && <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Observações</p><p className="mt-1 whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-200">{selectedEntry.notes}</p></div>}</div></div></div>}

            {selectedStatementItem && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-gray-900"><div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"><div><p className="text-xs font-black uppercase tracking-widest text-[#19A999]">Detalhes do extrato</p><h3 className="mt-1 text-xl font-black text-gray-900 dark:text-white">{selectedStatementItem.description}</h3></div><button type="button" onClick={() => setSelectedStatementItem(null)} className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800" aria-label="Fechar detalhes"><X size={18} /></button></div><div className="space-y-5 p-6"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Movimento</p><p className={`mt-1 text-2xl font-black ${selectedStatementItem.signed_amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{selectedStatementItem.signed_amount >= 0 ? '+' : '-'} {formatCurrencyPtBr(Math.abs(selectedStatementItem.signed_amount))}</p></div><div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Saldo após o lançamento</p><p className={`mt-1 text-2xl font-black ${selectedStatementItem.running_balance_after >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>{formatCurrencyPtBr(selectedStatementItem.running_balance_after)}</p></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{formatDateTime(selectedStatementItem.occurred_at)}</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Forma de pagamento</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{getPaymentMethodLabel(selectedStatementItem.payment_method_code || selectedStatementItem.payment_method)}</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pedido</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{selectedStatementItem.order_code || '—'}</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cliente</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{selectedStatementItem.order_customer_name || selectedStatementItem.customer_id || '—'}</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Escopo</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{statementScopeLabel}</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Contrapartida</p><p className="mt-1 font-bold text-gray-800 dark:text-gray-100">{selectedStatementItem.counterpart_account_name || '—'}</p></div></div></div></div></div>}
        </PageContainer>
    );
}
