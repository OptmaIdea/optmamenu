import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  CheckSquare,
  ClipboardCheck,
  Edit3,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Square,
  ToggleLeft,
  ToggleRight,
  TriangleAlert,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { getActiveStoreId } from '@/utils/activeStore';
import {
  FinancialAccountsService,
  type FinancialAccountBalance,
  type FinancialAccountBalancesResult,
  type FinancialAccountMovement,
  type FinancialAccountMovementsResult,
  type FinancialAccountType,
  type UnallocatedCashbookEntry,
} from '@/services/financialAccountsService';
import { FinancialAccountReassignmentService } from '@/services/financialAccountReassignmentService';
import { getFinancialAccountCodeLabel, getFinancialAccountTypeLabel } from '@/utils/finance/ptBrFinancialLabels';

const ACCOUNT_TYPES: Array<{ value: FinancialAccountType; label: string }> = [
  { value: 'cash_drawer', label: getFinancialAccountTypeLabel('cash_drawer') },
  { value: 'safe', label: getFinancialAccountTypeLabel('safe') },
  { value: 'bank', label: getFinancialAccountTypeLabel('bank') },
  { value: 'pix_wallet', label: getFinancialAccountTypeLabel('pix_wallet') },
  { value: 'card_acquirer', label: getFinancialAccountTypeLabel('card_acquirer') },
  { value: 'card_receivable', label: getFinancialAccountTypeLabel('card_receivable') },
  { value: 'owner', label: getFinancialAccountTypeLabel('owner') },
  { value: 'other', label: getFinancialAccountTypeLabel('other') },
];

const EMPTY_FORM = {
  id: null as string | null,
  code: '',
  name: '',
  accountType: 'cash_drawer' as FinancialAccountType,
  description: '',
  isDefault: false,
  isSalesClearingDefault: false,
  acceptedPaymentMethods: [] as string[],
  active: true,
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

type WorkspaceTab = 'balances' | 'unallocated' | 'reconciliation' | 'settings';
type AccountStatusFilter = 'active' | 'inactive' | 'all';

type TransferFormState = {
  sourceAccountId: string;
  paymentMethodCode: string;
  destinationAccountId: string;
  amount: string;
  reason: string;
};

function formatMoney(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem movimentação';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : dateTime.format(date);
}

function accountTypeLabel(type: string) {
  return getFinancialAccountTypeLabel(type, 'raw');
}

function accountCodeLabel(code: string) {
  const label = getFinancialAccountCodeLabel(code, 'dash');
  return label === '—' ? code : label;
}

function slugifyCode(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function fallbackPaymentLabel(value?: string | null) {
  const labels: Record<string, string> = {
    cash: 'Dinheiro',
    pix: 'Pix',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    bank_transfer: 'Transferência bancária',
    voucher: 'Voucher / benefício',
    other: 'Outro',
    pending: 'Pendente',
  };
  return value ? labels[value] || value : 'Não informado';
}

function sourceLabel(value?: string | null) {
  const labels: Record<string, string> = {
    order: 'Venda / pedido',
    direct_sale: 'Venda direta',
    public_order: 'Loja pública',
    financial_account_transfer: 'Transferência entre contas',
    manual: 'Lançamento manual',
    cashbook: 'Livro Diário',
    adjustment: 'Ajuste financeiro',
    refund: 'Estorno / devolução',
  };
  return value ? labels[value] || value.replaceAll('_', ' ') : 'Origem não informada';
}

function paymentCodeFromEntry(entry: UnallocatedCashbookEntry | FinancialAccountMovement) {
  return entry.payment_method_code || entry.payment_method || '';
}

function inDateRange(entryDate: string, startDate: string, endDate: string) {
  if (startDate && entryDate < startDate) return false;
  if (endDate && entryDate > endDate) return false;
  return true;
}

export default function FinancialAccountsWorkspacePage() {
  const storeId = getActiveStoreId();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as WorkspaceTab | null;
  const activeTab: WorkspaceTab = ['balances', 'unallocated', 'reconciliation', 'settings'].includes(requestedTab || '')
    ? (requestedTab as WorkspaceTab)
    : 'balances';

  const [balances, setBalances] = useState<FinancialAccountBalancesResult | null>(null);
  const [unallocated, setUnallocated] = useState<UnallocatedCashbookEntry[]>([]);
  const [unallocatedTotal, setUnallocatedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [entryPaymentCodes, setEntryPaymentCodes] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [bulkAccountId, setBulkAccountId] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState<AccountStatusFilter>('active');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [transferForm, setTransferForm] = useState<TransferFormState | null>(null);
  const [transferWorking, setTransferWorking] = useState(false);

  const [reconciliationAccountId, setReconciliationAccountId] = useState('');
  const [reconciliationPaymentCode, setReconciliationPaymentCode] = useState('');
  const [reconciliationStart, setReconciliationStart] = useState('');
  const [reconciliationEnd, setReconciliationEnd] = useState('');
  const [reconciliation, setReconciliation] = useState<FinancialAccountMovementsResult | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [checkedMovements, setCheckedMovements] = useState<Record<string, boolean>>({});
  const [movementPaymentCodes, setMovementPaymentCodes] = useState<Record<string, string>>({});
  const [movementAccounts, setMovementAccounts] = useState<Record<string, string>>({});
  const [movementReasons, setMovementReasons] = useState<Record<string, string>>({});
  const [bulkReassignmentAccountId, setBulkReassignmentAccountId] = useState('');
  const [bulkReassignmentReason, setBulkReassignmentReason] = useState('');
  const [bulkReassignmentWorking, setBulkReassignmentWorking] = useState(false);

  const accounts = useMemo(() => balances?.accounts || [], [balances]);
  const paymentMethods = useMemo(() => balances?.paymentMethods || [], [balances]);
  const receiptPaymentMethods = useMemo(
    () => paymentMethods.filter((method) => method.affects_cashbook && method.code !== 'pending'),
    [paymentMethods],
  );
  const activeAccounts = useMemo(() => accounts.filter((account) => account.active), [accounts]);
  const visibleBalanceAccounts = useMemo(
    () => accounts.filter((account) => {
      if (accountStatusFilter === 'active') return account.active;
      if (accountStatusFilter === 'inactive') return !account.active;
      return true;
    }),
    [accounts, accountStatusFilter],
  );
  const canManage = balances?.canManage ?? false;

  const paymentName = (code?: string | null) => {
    if (!code) return 'Não informado';
    return paymentMethods.find((method) => method.code === code)?.name || fallbackPaymentLabel(code);
  };

  function paymentBaseCode(code: string) {
    return paymentMethods.find((method) => method.code === code)?.base_code || code;
  }

  function accountAcceptsPayment(account: FinancialAccountBalance, code: string) {
    if (!code || code === 'pending') return false;
    const baseCode = paymentBaseCode(code);
    return Boolean(account.accepted_payment_methods?.some((acceptedCode) => acceptedCode === code || acceptedCode === baseCode));
  }

  function accountsForPayment(code: string) {
    if (!code || code === 'pending') return [];
    return activeAccounts.filter((account) => accountAcceptsPayment(account, code));
  }

  function preferredAccountForPayment(code: string) {
    if (!code || code === 'pending') return '';
    const preferredAccountId = paymentMethods.find((method) => method.code === code)?.preferred_financial_account_id || '';
    if (!preferredAccountId) return '';
    return accountsForPayment(code).some((account) => account.id === preferredAccountId) ? preferredAccountId : '';
  }

  const periodFilteredUnallocated = useMemo(
    () => unallocated.filter((entry) => inDateRange(entry.entry_date, periodStart, periodEnd)),
    [unallocated, periodStart, periodEnd],
  );

  const unallocatedByPayment = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const entry of periodFilteredUnallocated) {
      const code = paymentCodeFromEntry(entry) || 'unknown';
      grouped.set(code, (grouped.get(code) || 0) + 1);
    }
    return Array.from(grouped.entries()).sort((left, right) => paymentName(left[0]).localeCompare(paymentName(right[0]), 'pt-BR'));
  }, [periodFilteredUnallocated, paymentMethods]);

  const visibleUnallocated = useMemo(
    () => periodFilteredUnallocated.filter((entry) => paymentFilter === 'all' || (paymentCodeFromEntry(entry) || 'unknown') === paymentFilter),
    [periodFilteredUnallocated, paymentFilter],
  );

  const selectedEntries = useMemo(
    () => visibleUnallocated.filter((entry) => selectedRows[entry.id]),
    [selectedRows, visibleUnallocated],
  );

  const selectedPaymentCodes = useMemo(
    () => Array.from(new Set(selectedEntries.map(paymentCodeFromEntry).filter(Boolean))),
    [selectedEntries],
  );

  const compatibleBulkAccounts = useMemo(() => {
    if (selectedPaymentCodes.length === 0) return activeAccounts;
    return activeAccounts.filter((account) => selectedPaymentCodes.every((code) => accountAcceptsPayment(account, code)));
  }, [activeAccounts, selectedPaymentCodes, paymentMethods]);

  async function loadData() {
    if (!storeId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [balanceResult, pendingResult] = await Promise.all([
        FinancialAccountsService.getBalances(storeId),
        FinancialAccountsService.listUnallocated(storeId, 500, 0),
      ]);
      setBalances(balanceResult);
      setUnallocated(pendingResult.items);
      setUnallocatedTotal(pendingResult.total);
    } catch (error) {
      console.error('Erro ao carregar saldos por conta:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar saldos por conta.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [storeId]);

  function setTab(tab: WorkspaceTab) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }

  function startCreate() {
    const initialMethods = paymentMethods
      .map((method) => method.code)
      .filter((code) => ['cash', 'pix', 'debit_card', 'credit_card'].includes(code));
    setForm({ ...EMPTY_FORM, acceptedPaymentMethods: initialMethods });
    setFormOpen(true);
  }

  function startEdit(account: FinancialAccountBalance) {
    setForm({
      id: account.id,
      code: account.code,
      name: account.name,
      accountType: account.account_type,
      description: account.description || '',
      isDefault: account.is_default,
      isSalesClearingDefault: Boolean(account.is_sales_clearing_default),
      acceptedPaymentMethods: account.accepted_payment_methods || [],
      active: account.active,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setForm(EMPTY_FORM);
    setFormOpen(false);
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId) return;
    if (!form.name.trim()) return toast.error('Informe o nome da conta financeira.');
    if (form.isSalesClearingDefault && form.acceptedPaymentMethods.length === 0) {
      return toast.error('A conta de entrada das vendas precisa aceitar ao menos uma forma de pagamento.');
    }

    try {
      setSaving(true);
      const current = accounts.find((account) => account.id === form.id);
      const saved = await FinancialAccountsService.save({
        storeId,
        accountId: form.id,
        code: form.code.trim() || slugifyCode(form.name),
        name: form.name.trim(),
        accountType: form.accountType,
        description: form.description.trim() || null,
        isDefault: form.isDefault,
        active: form.active,
        sortOrder: current?.sort_order ?? 500,
        metadata: { source: 'saldos_por_conta' },
      });
      await FinancialAccountsService.saveRouting({
        storeId,
        accountId: saved.id,
        paymentMethodCodes: form.acceptedPaymentMethods,
        isSalesClearingDefault: form.isSalesClearingDefault,
      });
      toast.success('Conta financeira e regras de recebimento salvas.');
      closeForm();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar conta financeira.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(account: FinancialAccountBalance) {
    if (!storeId) return;
    if (account.active && account.is_sales_clearing_default) {
      toast.error('Defina outra conta como entrada das vendas antes de desativar esta conta.');
      return;
    }
    try {
      await FinancialAccountsService.setActive(storeId, account.id, !account.active);
      toast.success(account.active ? 'Conta desativada.' : 'Conta reativada.');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar a conta financeira.');
    }
  }

  function effectiveEntryPayment(entry: UnallocatedCashbookEntry) {
    return entryPaymentCodes[entry.id] || paymentCodeFromEntry(entry);
  }

  async function saveUnallocatedEntry(entry: UnallocatedCashbookEntry) {
    if (!storeId) return;
    const originalCode = paymentCodeFromEntry(entry);
    const nextCode = effectiveEntryPayment(entry);
    const accountId = selectedAccounts[entry.id] || null;
    const reason = reasons[entry.id];

    if (nextCode === 'pending') return toast.error('Escolha a forma de pagamento efetivamente recebida.');
    if (nextCode === originalCode && !accountId) return toast.error('Escolha uma conta ou altere a forma de pagamento.');

    try {
      setWorkingId(entry.id);
      if (nextCode !== originalCode) {
        await FinancialAccountsService.changePaymentRoute({
          storeId,
          entryId: entry.id,
          paymentMethodCode: nextCode,
          accountId,
          reason,
        });
        toast.success(accountId ? 'Forma de recebimento e conta ajustadas.' : 'Forma de recebimento ajustada.');
      } else if (accountId) {
        await FinancialAccountsService.classifyEntry(storeId, entry.id, accountId, reason);
        toast.success('Lançamento distribuído.');
      }
      setSelectedAccounts((current) => ({ ...current, [entry.id]: '' }));
      setEntryPaymentCodes((current) => ({ ...current, [entry.id]: '' }));
      setReasons((current) => ({ ...current, [entry.id]: '' }));
      setSelectedRows((current) => ({ ...current, [entry.id]: false }));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao ajustar lançamento.');
    } finally {
      setWorkingId(null);
    }
  }

  function selectAllVisible() {
    setSelectedRows(Object.fromEntries(visibleUnallocated.map((entry) => [entry.id, true])));
    setBulkAccountId('');
  }

  function clearSelection() {
    setSelectedRows({});
    setBulkAccountId('');
    setBulkReason('');
  }

  async function distributeBulk() {
    if (!storeId) return;
    if (selectedEntries.length === 0) return toast.error('Selecione ao menos um lançamento visível.');
    if (!bulkAccountId) return toast.error('Selecione a conta para a distribuição em lote.');

    try {
      setBulkWorking(true);
      const count = await FinancialAccountsService.classifyEntriesBulk(
        storeId,
        selectedEntries.map((entry) => entry.id),
        bulkAccountId,
        bulkReason,
      );
      toast.success(`${count} lançamento(s) distribuído(s) em lote.`);
      clearSelection();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao distribuir lançamentos em lote.');
    } finally {
      setBulkWorking(false);
    }
  }

  function openTransfer(account: FinancialAccountBalance, paymentMethodCode: string, balance: number) {
    setTransferForm({
      sourceAccountId: account.id,
      paymentMethodCode,
      destinationAccountId: '',
      amount: balance > 0 ? String(balance.toFixed(2)).replace('.', ',') : '',
      reason: '',
    });
  }

  const transferSource = transferForm
    ? accounts.find((account) => account.id === transferForm.sourceAccountId) || null
    : null;
  const transferMethodBalance = transferSource && transferForm
    ? transferSource.payment_breakdown.find((item) => item.payment_method_code === transferForm.paymentMethodCode)?.balance || 0
    : 0;
  const transferDestinations = transferForm
    ? accountsForPayment(transferForm.paymentMethodCode).filter((account) => account.id !== transferForm.sourceAccountId)
    : [];

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId || !transferForm) return;
    const amount = Number(transferForm.amount.replace('.', '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Informe um valor de transferência válido.');
    if (!transferForm.destinationAccountId) return toast.error('Selecione a conta de destino.');

    try {
      setTransferWorking(true);
      await FinancialAccountsService.transfer({
        storeId,
        sourceAccountId: transferForm.sourceAccountId,
        destinationAccountId: transferForm.destinationAccountId,
        paymentMethodCode: transferForm.paymentMethodCode,
        amount,
        reason: transferForm.reason,
      });
      toast.success('Transferência entre contas concluída.');
      setTransferForm(null);
      await loadData();
      if (activeTab === 'reconciliation') await loadReconciliation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao transferir entre contas.');
    } finally {
      setTransferWorking(false);
    }
  }

  async function loadReconciliation(accountId = reconciliationAccountId, paymentCode = reconciliationPaymentCode) {
    if (!storeId || !accountId) {
      setReconciliation(null);
      return;
    }
    try {
      setReconciliationLoading(true);
      const result = await FinancialAccountsService.listMovements({
        storeId,
        accountId,
        paymentMethodCode: paymentCode || null,
        startDate: reconciliationStart || null,
        endDate: reconciliationEnd || null,
        limit: 500,
      });
      setReconciliation(result);
      setCheckedMovements({});
      setMovementPaymentCodes({});
      setMovementAccounts({});
      setMovementReasons({});
      setBulkReassignmentAccountId('');
      setBulkReassignmentReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar conferência.');
    } finally {
      setReconciliationLoading(false);
    }
  }

  async function openReconciliation(account: FinancialAccountBalance, paymentCode: string) {
    setReconciliationAccountId(account.id);
    setReconciliationPaymentCode(paymentCode);
    setTab('reconciliation');
    await loadReconciliation(account.id, paymentCode);
  }

  function movementPayment(movement: FinancialAccountMovement) {
    return movementPaymentCodes[movement.id] || paymentCodeFromEntry(movement);
  }

  function currentMovementAccount(movement: FinancialAccountMovement, code: string) {
    const explicit = movementAccounts[movement.id];
    if (explicit !== undefined) return explicit;
    const current = reconciliationAccountId;
    return current && accountsForPayment(code).some((account) => account.id === current) ? current : '';
  }

  async function saveMovementAdjustment(movement: FinancialAccountMovement) {
    if (!storeId) return;
    const code = movementPayment(movement);
    const accountId = currentMovementAccount(movement, code);
    if (!code || code === 'pending') return toast.error('Escolha uma forma de recebimento válida.');
    if (!accountId) return toast.error('Escolha a conta exata para este lançamento.');

    try {
      setWorkingId(movement.id);
      await FinancialAccountsService.changePaymentRoute({
        storeId,
        entryId: movement.id,
        paymentMethodCode: code,
        accountId,
        reason: movementReasons[movement.id],
      });
      toast.success('Lançamento ajustado e auditado.');
      await loadData();
      await loadReconciliation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao ajustar lançamento.');
    } finally {
      setWorkingId(null);
    }
  }

  const checkedItems = useMemo(
    () => (reconciliation?.items || []).filter((movement) => checkedMovements[movement.id]),
    [reconciliation, checkedMovements],
  );
  const checkedNet = checkedItems.reduce((total, item) => total + item.signed_amount, 0);
  const reconciliationSourceAccount = accounts.find((account) => account.id === reconciliationAccountId) || null;
  const checkedPaymentCodes = Array.from(new Set(checkedItems.map(paymentCodeFromEntry).filter(Boolean)));
  const bulkReassignmentDestinations = activeAccounts.filter((account) =>
    account.id !== reconciliationAccountId
    && checkedPaymentCodes.every((code) => accountAcceptsPayment(account, code)),
  );

  async function reassignCheckedMovements() {
    if (!storeId || !reconciliationAccountId) return;
    if (checkedItems.length === 0) return toast.error('Selecione ao menos um lançamento para reatribuir.');
    if (!bulkReassignmentAccountId) return toast.error('Selecione a conta de destino.');

    try {
      setBulkReassignmentWorking(true);
      const result = await FinancialAccountReassignmentService.reassignBulk({
        storeId,
        sourceAccountId: reconciliationAccountId,
        destinationAccountId: bulkReassignmentAccountId,
        entryIds: checkedItems.map((movement) => movement.id),
        reason: bulkReassignmentReason,
      });
      const transferMessage = result.neutralizedTransferCount > 0
        ? ` ${result.neutralizedTransferCount} transferência(s) redundante(s) neutralizada(s).`
        : '';
      toast.success(`${result.movedCount} lançamento(s) reatribuído(s).${transferMessage}`);
      setCheckedMovements({});
      setBulkReassignmentAccountId('');
      setBulkReassignmentReason('');
      await loadData();
      await loadReconciliation(reconciliationAccountId, reconciliationPaymentCode);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao reatribuir lançamentos em lote.');
    } finally {
      setBulkReassignmentWorking(false);
    }
  }

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof WalletCards; badge?: number }> = [
    { id: 'balances', label: 'Saldos', icon: WalletCards },
    { id: 'unallocated', label: 'Não distribuído', icon: TriangleAlert, badge: balances?.unallocated.count || 0 },
    { id: 'reconciliation', label: 'Conferência', icon: ClipboardCheck },
    { id: 'settings', label: 'Contas e regras', icon: Settings2 },
  ];

  return (
    <PageContainer
      title="Saldos por conta"
      subtitle="Pré-conciliação: acompanhe o dinheiro por forma de recebimento, distribua exceções e confira conta por conta."
      category="Financeiro"
      icon={<WalletCards className="text-[#19A999]" size={28} />}
      flat
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${selected ? 'bg-teal-600 text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-600 hover:border-teal-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300'}`}
                >
                  <Icon size={16} />
                  {tab.label}
                  {Boolean(tab.badge) && <span className={`rounded-full px-2 py-0.5 text-[10px] ${selected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{tab.badge}</span>}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-600 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded-2xl bg-white dark:bg-gray-900"><Loader2 className="animate-spin text-teal-600" size={28} /></div>
        ) : !balances ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">Não foi possível carregar os saldos.</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <button type="button" onClick={() => setTab('balances')} className="rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Saldo do livro</p><p className="mt-2 text-3xl font-black dark:text-white">{formatMoney(balances.summary.bookBalance)}</p>
              </button>
              <button type="button" onClick={() => setTab('balances')} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-left shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Distribuído</p><p className="mt-2 text-3xl font-black text-emerald-800 dark:text-emerald-200">{formatMoney(balances.summary.allocatedBalance)}</p>
              </button>
              <button type="button" onClick={() => setTab('unallocated')} className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
                <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Não distribuído</p><p className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">{formatMoney(balances.summary.unallocatedBalance)}</p><p className="mt-1 text-xs font-bold text-amber-700/70">{balances.unallocated.count} lançamento(s)</p>
              </button>
            </div>

            {activeTab === 'balances' && (
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div><h2 className="text-lg font-black dark:text-white">Contas financeiras</h2><p className="text-xs font-semibold text-gray-400">Clique em uma forma dentro da conta para abrir a conferência detalhada. Contas inativas preservam o histórico e podem ter seus lançamentos reatribuídos em lote.</p></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setAccountStatusFilter('active')} className={`rounded-xl border px-3 py-2 text-xs font-black transition ${accountStatusFilter === 'active' ? 'border-teal-600 bg-teal-600 text-white' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>Ativas ({accounts.filter((account) => account.active).length})</button>
                    <button type="button" onClick={() => setAccountStatusFilter('inactive')} className={`rounded-xl border px-3 py-2 text-xs font-black transition ${accountStatusFilter === 'inactive' ? 'border-amber-600 bg-amber-600 text-white' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>Inativas ({accounts.filter((account) => !account.active).length})</button>
                    <button type="button" onClick={() => setAccountStatusFilter('all')} className={`rounded-xl border px-3 py-2 text-xs font-black transition ${accountStatusFilter === 'all' ? 'border-slate-700 bg-slate-700 text-white' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>Todas ({accounts.length})</button>
                  </div>
                </div>
                {visibleBalanceAccounts.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm font-bold text-gray-400">Nenhuma conta neste filtro.</div> : <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {visibleBalanceAccounts.map((account) => (
                    <div key={account.id} className={`rounded-2xl border p-4 ${account.active ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50' : 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/10'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-black dark:text-white">{account.name}</p><p className="text-xs font-semibold text-gray-400">{accountCodeLabel(account.code)} · {accountTypeLabel(account.account_type)}</p></div>
                        <div className="flex flex-wrap justify-end gap-1">{!account.active && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800">Inativa</span>}{account.is_sales_clearing_default && <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase text-blue-700">Entrada das vendas</span>}{account.is_default && <span className="rounded-full bg-teal-100 px-2 py-1 text-[10px] font-black uppercase text-teal-700">Padrão</span>}</div>
                      </div>
                      {!account.active && <p className="mt-2 rounded-lg bg-amber-100/70 px-2 py-1 text-[11px] font-bold text-amber-800">Conta inativa · não recebe novos lançamentos; histórico preservado.</p>}
                      <p className={`mt-4 text-2xl font-black ${account.balance < 0 ? 'text-red-600' : 'dark:text-white'}`}>{formatMoney(account.balance)}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-emerald-50 p-2 font-bold text-emerald-700"><ArrowDownCircle size={14} />Entradas<br />{formatMoney(account.inflows)}</div><div className="rounded-xl bg-red-50 p-2 font-bold text-red-700"><ArrowUpCircle size={14} />Saídas<br />{formatMoney(account.outflows)}</div></div>
                      <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aceita</p><div className="mt-2 flex flex-wrap gap-1.5">{(account.accepted_payment_methods || []).map((code) => <span key={code} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">{paymentName(code)}</span>)}</div></div>
                      {account.payment_breakdown.length > 0 && <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Composição do saldo</p>{account.payment_breakdown.map((item) => {
                        const destinations = accountsForPayment(item.payment_method_code).filter((candidate) => candidate.id !== account.id);
                        const canTransfer = canManage && account.active && item.balance > 0 && destinations.length > 0;
                        return <div key={item.payment_method_code} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs dark:bg-gray-900"><button type="button" onClick={() => void openReconciliation(account, item.payment_method_code)} className="min-w-0 flex-1 text-left"><p className="font-black text-gray-700 dark:text-gray-200">{paymentName(item.payment_method_code)}</p><p className="font-semibold text-gray-400">{item.movement_count} movimento(s) · conferir</p></button><div className="flex items-center gap-2"><span className="font-black dark:text-white">{formatMoney(item.balance)}</span>{canManage && <button type="button" onClick={() => openTransfer(account, item.payment_method_code, item.balance)} disabled={!canTransfer} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-teal-700 disabled:opacity-30" title={canTransfer ? 'Transferir para conta compatível' : account.active ? 'Sem destino compatível' : 'Conta inativa: use reatribuição de lançamentos'}><ArrowRightLeft size={14} /></button>}</div></div>;
                      })}</div>}
                      <p className="mt-3 text-[11px] font-semibold text-gray-400">{account.movement_count} movimentação(ões) · {formatDate(account.last_movement_at)}</p>
                      {canManage && account.movement_count > 0 && <button type="button" onClick={() => void openReconciliation(account, '')} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:border-blue-300"><ArrowRightLeft size={14} />Alterar lançamentos em lote</button>}
                    </div>
                  ))}
                </div>}
              </section>
            )}

            {activeTab === 'unallocated' && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-950/10">
                <div className="mb-4 flex items-start gap-3"><TriangleAlert className="mt-0.5 text-amber-600" size={22} /><div><h2 className="font-black text-amber-900 dark:text-amber-200">Não distribuído</h2><p className="text-sm font-semibold text-amber-800/75 dark:text-amber-300/75">Exceções, histórico antigo e recebimentos que ainda precisam de rota. Pendente pode ser convertido para a forma realmente recebida.</p></div></div>
                <div className="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900/40 dark:bg-gray-900">
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <label className="text-xs font-black text-gray-500">De<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-semibold dark:border-gray-700 dark:bg-gray-950" /></label>
                    <label className="text-xs font-black text-gray-500">Até<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-semibold dark:border-gray-700 dark:bg-gray-950" /></label>
                    <button type="button" onClick={() => { setPeriodStart(''); setPeriodEnd(''); setPaymentFilter('all'); }} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-black text-gray-600"><Filter size={15} />Limpar filtros</button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setPaymentFilter('all')} className={`rounded-lg border px-3 py-2 text-xs font-black transition ${paymentFilter === 'all' ? 'border-teal-600 bg-teal-600 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300'}`}>Todos ({periodFilteredUnallocated.length})</button>{unallocatedByPayment.map(([code, count]) => <button key={code} type="button" onClick={() => setPaymentFilter(code)} className={`rounded-lg border px-3 py-2 text-xs font-black transition ${paymentFilter === code ? 'border-teal-600 bg-teal-600 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-teal-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300'}`}>{paymentName(code)} ({count})</button>)}</div>
                  <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={selectAllVisible} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black text-gray-600"><CheckSquare size={14} />Selecionar visíveis ({visibleUnallocated.length})</button><button type="button" onClick={clearSelection} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black text-gray-600"><Square size={14} />Limpar seleção</button><span className="text-xs font-semibold text-gray-400">{visibleUnallocated.length} exibido(s) · {unallocatedTotal} no total</span></div>
                  {selectedEntries.length > 0 && <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_auto]"><select value={bulkAccountId} onChange={(event) => setBulkAccountId(event.target.value)} className="rounded-xl border px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950"><option value="">Conta para {selectedEntries.length} selecionado(s)</option>{compatibleBulkAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><input value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} placeholder="Motivo comum (opcional)" className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /><button type="button" onClick={() => void distributeBulk()} disabled={bulkWorking || !bulkAccountId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{bulkWorking ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Distribuir em lote</button></div>}
                  {selectedEntries.length > 0 && compatibleBulkAccounts.length === 0 && <p className="mt-2 text-xs font-bold text-red-600">A seleção mistura formas sem uma conta compatível comum. Filtre por forma de pagamento antes de distribuir.</p>}
                </div>

                <div className="mt-4 space-y-3">{visibleUnallocated.length === 0 ? <div className="rounded-xl bg-white p-6 text-center text-sm font-bold text-gray-500 dark:bg-gray-900">Nenhum lançamento para os filtros atuais.</div> : visibleUnallocated.map((entry) => {
                  const originalCode = paymentCodeFromEntry(entry);
                  const effectiveCode = effectiveEntryPayment(entry);
                  const compatibleAccounts = accountsForPayment(effectiveCode);
                  const preferredAccountId = preferredAccountForPayment(effectiveCode);
                  const methodChanged = effectiveCode !== originalCode;
                  const accountSelected = Boolean(selectedAccounts[entry.id]);
                  return <div key={entry.id} className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-900 ${selectedRows[entry.id] ? 'border-amber-500 ring-1 ring-amber-300' : 'border-amber-100 dark:border-amber-900/40'}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 flex-1 gap-3">{canManage && <input type="checkbox" checked={Boolean(selectedRows[entry.id])} onChange={(event) => { setSelectedRows((current) => ({ ...current, [entry.id]: event.target.checked })); setBulkAccountId(''); }} className="mt-1 h-4 w-4" />}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${entry.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{entry.direction === 'in' ? 'Entrada' : 'Saída'}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">{paymentName(originalCode)}</span><span className="text-xs font-bold text-gray-400">{entry.entry_code || 'Sem código'} · {formatDate(entry.occurred_at)}</span></div><p className="mt-2 font-black dark:text-white">{entry.description}</p><p className="mt-1 text-xs font-semibold text-gray-500">Origem: {sourceLabel(entry.source)}</p></div></div><p className={`text-xl font-black ${entry.direction === 'in' ? 'text-emerald-700' : 'text-red-700'}`}>{entry.direction === 'in' ? '+' : '-'}{formatMoney(entry.amount)}</p></div>
                    {canManage && <div className="mt-4 grid gap-2 xl:grid-cols-[1fr_1fr_1fr_auto]"><select value={effectiveCode} onChange={(event) => { const nextCode = event.target.value; setEntryPaymentCodes((current) => ({ ...current, [entry.id]: nextCode })); setSelectedAccounts((current) => ({ ...current, [entry.id]: preferredAccountForPayment(nextCode) })); }} className="rounded-xl border px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950"><option value="pending">Pendente</option>{receiptPaymentMethods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</select><select value={selectedAccounts[entry.id] || ''} onChange={(event) => setSelectedAccounts((current) => ({ ...current, [entry.id]: event.target.value }))} disabled={effectiveCode === 'pending'} className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950"><option value="">{effectiveCode === 'pending' ? 'Troque a forma para escolher a conta' : 'Selecione a conta compatível'}</option>{compatibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.id === preferredAccountId ? ' · preferencial' : ''}</option>)}</select><input value={reasons[entry.id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [entry.id]: event.target.value }))} placeholder="Motivo/observação (opcional)" className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /><button type="button" onClick={() => void saveUnallocatedEntry(entry)} disabled={workingId === entry.id || (!methodChanged && !accountSelected) || effectiveCode === 'pending'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{workingId === entry.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{methodChanged ? (accountSelected ? 'Salvar e distribuir' : 'Salvar forma') : 'Distribuir'}</button></div>}
                  </div>;
                })}</div>
              </section>
            )}

            {activeTab === 'reconciliation' && (
              <section className="rounded-2xl border border-blue-100 bg-blue-50/30 p-5 dark:border-blue-900/40 dark:bg-blue-950/10">
                <div className="mb-4"><h2 className="font-black text-gray-900 dark:text-white">Conferência em tela</h2><p className="text-sm font-semibold text-gray-500">Use os ticadores para conferir extrato, caixa ou resumo da maquininha sem imprimir. Os ticadores são apenas visuais nesta sessão.</p></div>
                <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"><select value={reconciliationAccountId} onChange={(event) => { setReconciliationAccountId(event.target.value); setReconciliation(null); setCheckedMovements({}); setBulkReassignmentAccountId(''); }} className="rounded-xl border px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950"><option value="">Selecione a conta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.active ? '' : ' · inativa'}</option>)}</select><select value={reconciliationPaymentCode} onChange={(event) => setReconciliationPaymentCode(event.target.value)} className="rounded-xl border px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950"><option value="">Todas as formas</option><option value="pending">Pendente</option>{receiptPaymentMethods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</select><input type="date" value={reconciliationStart} onChange={(event) => setReconciliationStart(event.target.value)} className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /><input type="date" value={reconciliationEnd} onChange={(event) => setReconciliationEnd(event.target.value)} className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /><button type="button" onClick={() => void loadReconciliation()} disabled={!reconciliationAccountId || reconciliationLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{reconciliationLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}Gerar</button></div>
                {reconciliationSourceAccount && !reconciliationSourceAccount.active && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">Conta inativa selecionada. Você pode conferir o histórico e reatribuir os lançamentos para uma conta ativa compatível.</div>}

                {reconciliation && <><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-white p-4 dark:bg-gray-900"><p className="text-xs font-black uppercase text-gray-400">Movimentos</p><p className="mt-1 text-xl font-black dark:text-white">{reconciliation.total}</p></div><div className="rounded-xl bg-white p-4 dark:bg-gray-900"><p className="text-xs font-black uppercase text-gray-400">Saldo do filtro</p><p className="mt-1 text-xl font-black dark:text-white">{formatMoney(reconciliation.netBalance)}</p></div><div className="rounded-xl bg-white p-4 dark:bg-gray-900"><p className="text-xs font-black uppercase text-gray-400">Conferidos</p><p className="mt-1 text-xl font-black dark:text-white">{checkedItems.length} · {formatMoney(checkedNet)}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setCheckedMovements(Object.fromEntries(reconciliation.items.map((item) => [item.id, true]))); setBulkReassignmentAccountId(''); }} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-black text-gray-600"><CheckSquare size={14} />Marcar todos</button><button type="button" onClick={() => { setCheckedMovements({}); setBulkReassignmentAccountId(''); setBulkReassignmentReason(''); }} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-black text-gray-600"><Square size={14} />Limpar</button></div>
                {canManage && checkedItems.length > 0 && <div className="mt-3 rounded-2xl border border-blue-200 bg-white p-4 dark:border-blue-900/50 dark:bg-gray-900"><div className="mb-3"><p className="text-sm font-black text-gray-800 dark:text-white">Alterar conta em lote</p><p className="text-xs font-semibold text-gray-500">Origem: {reconciliationSourceAccount?.name || 'Conta selecionada'} · {checkedItems.length} lançamento(s). Se uma transferência entre a conta antiga e a nova ficar redundante, ela será neutralizada com auditoria.</p></div><div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]"><select value={bulkReassignmentAccountId} onChange={(event) => setBulkReassignmentAccountId(event.target.value)} className="rounded-xl border px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950"><option value="">Selecione a nova conta</option>{bulkReassignmentDestinations.map((account) => <option key={account.id} value={account.id}>{account.name} · {accountCodeLabel(account.code)}</option>)}</select><input value={bulkReassignmentReason} onChange={(event) => setBulkReassignmentReason(event.target.value)} placeholder="Motivo da reatribuição (opcional)" className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /><button type="button" onClick={() => void reassignCheckedMovements()} disabled={bulkReassignmentWorking || !bulkReassignmentAccountId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{bulkReassignmentWorking ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}Reatribuir selecionados</button></div>{bulkReassignmentDestinations.length === 0 && <p className="mt-2 text-xs font-bold text-red-600">Nenhuma conta ativa aceita todas as formas de pagamento da seleção atual.</p>}</div>}
                <div className="mt-4 space-y-2">{reconciliation.items.map((movement) => {
                  const code = movementPayment(movement);
                  const compatible = accountsForPayment(code);
                  const preferredAccountId = preferredAccountForPayment(code);
                  const selectedAccountId = currentMovementAccount(movement, code);
                  return <div key={movement.id} className={`rounded-xl border bg-white p-4 dark:bg-gray-900 ${checkedMovements[movement.id] ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-gray-100 dark:border-gray-800'}`}><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><label className="flex min-w-0 flex-1 items-start gap-3"><input type="checkbox" checked={Boolean(checkedMovements[movement.id])} onChange={(event) => { setCheckedMovements((current) => ({ ...current, [movement.id]: event.target.checked })); setBulkReassignmentAccountId(''); }} className="mt-1 h-4 w-4" /><span className="min-w-0"><span className="block font-black dark:text-white">{movement.description}</span><span className="mt-1 block text-xs font-semibold text-gray-500">{movement.entry_code || 'Sem código'} · {formatDate(movement.occurred_at)} · {sourceLabel(movement.source)}{movement.order_code ? ` · ${movement.order_code}` : ''}{movement.counterpart_account_name ? ` · contraparte: ${movement.counterpart_account_name}` : ''}</span></span></label><div className="flex items-center gap-2"><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">{paymentName(paymentCodeFromEntry(movement))}</span><span className={`min-w-24 text-right text-lg font-black ${movement.signed_amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{movement.signed_amount >= 0 ? '+' : ''}{formatMoney(movement.signed_amount)}</span></div></div>{canManage && !movement.is_transfer && <div className="mt-3 grid gap-2 xl:grid-cols-[1fr_1fr_1fr_auto]"><select value={code} onChange={(event) => { const nextCode = event.target.value; setMovementPaymentCodes((current) => ({ ...current, [movement.id]: nextCode })); setMovementAccounts((current) => ({ ...current, [movement.id]: preferredAccountForPayment(nextCode) })); }} className="rounded-xl border px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950"><option value="pending">Pendente</option>{receiptPaymentMethods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</select><select value={selectedAccountId} onChange={(event) => setMovementAccounts((current) => ({ ...current, [movement.id]: event.target.value }))} className="rounded-xl border px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950"><option value="">Conta exata</option>{compatible.map((account) => <option key={account.id} value={account.id}>{account.name}{account.id === preferredAccountId ? ' · preferencial' : ''}</option>)}</select><input value={movementReasons[movement.id] || ''} onChange={(event) => setMovementReasons((current) => ({ ...current, [movement.id]: event.target.value }))} placeholder="Motivo do ajuste (opcional)" className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /><button type="button" onClick={() => void saveMovementAdjustment(movement)} disabled={workingId === movement.id || code === 'pending' || !selectedAccountId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{workingId === movement.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Ajustar</button></div>}{movement.is_transfer && <p className="mt-2 text-xs font-semibold text-gray-400">Transferência interna: pode ser incluída na reatribuição em lote; se origem e destino virarem a mesma conta, a transferência redundante será neutralizada com auditoria.</p>}</div>;
                })}</div></>}
              </section>
            )}

            {activeTab === 'settings' && (
              <section className="rounded-2xl border border-teal-100 bg-teal-50/30 p-5 dark:border-teal-900/50 dark:bg-teal-950/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black dark:text-white">Contas e regras de recebimento</h2><p className="text-xs font-semibold text-gray-500">Configure quais formas cada conta aceita e qual é a conta operacional de entrada das vendas.</p></div>{canManage && <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white"><Plus size={16} />Nova conta</button>}</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => <div key={account.id} className="rounded-xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"><div className="flex items-start justify-between gap-3"><div><p className="font-black dark:text-white">{account.name}</p><p className="text-xs text-gray-400">{accountTypeLabel(account.account_type)}</p></div><div className="flex flex-wrap justify-end gap-1">{account.is_sales_clearing_default && <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-blue-700">Entrada das vendas</span>}<span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${account.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{account.active ? 'Ativa' : 'Inativa'}</span></div></div><p className="mt-2 text-xs font-semibold text-gray-500">Aceita: {(account.accepted_payment_methods || []).map(paymentName).join(', ') || 'nenhuma forma configurada'}</p>{canManage && <div className="mt-3 flex gap-2"><button type="button" onClick={() => startEdit(account)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black text-gray-600"><Edit3 size={14} />Editar</button><button type="button" onClick={() => void toggleActive(account)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black text-gray-600">{account.active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}{account.active ? 'Desativar' : 'Reativar'}</button></div>}</div>)}</div>
              </section>
            )}
          </>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><form onSubmit={saveAccount} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-gray-900"><div className="flex items-start justify-between border-b p-5 dark:border-gray-800"><div><h3 className="font-black dark:text-white">{form.id ? 'Editar conta financeira' : 'Nova conta financeira'}</h3><p className="text-xs font-semibold text-gray-400">Defina também quais formas de pagamento esta conta pode receber.</p></div><button type="button" onClick={closeForm} className="rounded-xl border p-2 text-gray-500"><X size={16} /></button></div><div className="grid gap-4 p-5 md:grid-cols-2"><label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Nome</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950" required /></label><label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Tipo</span><select value={form.accountType} onChange={(event) => setForm((current) => ({ ...current, accountType: event.target.value as FinancialAccountType }))} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950">{ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Código</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="Gerado automaticamente" className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950" /></label><label className="space-y-1 md:col-span-2"><span className="text-xs font-black uppercase text-gray-400">Descrição</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950" /></label><div className="md:col-span-2 rounded-2xl border p-4 dark:border-gray-700"><p className="text-xs font-black uppercase tracking-widest text-gray-400">Formas aceitas nesta conta</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{paymentMethods.map((method) => { const checked = form.acceptedPaymentMethods.includes(method.code); return <label key={method.code} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${checked ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-600'}`}><input type="checkbox" checked={checked} onChange={(event) => setForm((current) => ({ ...current, acceptedPaymentMethods: event.target.checked ? Array.from(new Set([...current.acceptedPaymentMethods, method.code])) : current.acceptedPaymentMethods.filter((code) => code !== method.code) }))} />{method.name}</label>; })}</div></div><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} />Conta padrão do tipo</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Conta ativa</label><label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900"><input type="checkbox" className="mt-1" checked={form.isSalesClearingDefault} onChange={(event) => setForm((current) => ({ ...current, isSalesClearingDefault: event.target.checked }))} /><span><strong>Conta de entrada das vendas.</strong><br /><span className="font-semibold opacity-80">Vendas novas entram primeiro aqui e depois são transferidas para contas compatíveis por forma de recebimento.</span></span></label></div><div className="flex justify-end gap-2 border-t p-5 dark:border-gray-800"><button type="button" onClick={closeForm} className="rounded-xl border px-4 py-2 text-sm font-black text-gray-600">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Salvar</button></div></form></div>
      )}

      {transferForm && transferSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><form onSubmit={submitTransfer} className="w-full max-w-lg rounded-3xl bg-white shadow-2xl dark:bg-gray-900"><div className="flex items-start justify-between border-b p-5 dark:border-gray-800"><div><h3 className="font-black dark:text-white">Transferir entre contas</h3><p className="text-xs font-semibold text-gray-400">{transferSource.name} · {paymentName(transferForm.paymentMethodCode)} · disponível {formatMoney(transferMethodBalance)}</p></div><button type="button" onClick={() => setTransferForm(null)} className="rounded-xl border p-2 text-gray-500"><X size={16} /></button></div><div className="space-y-4 p-5"><label className="block space-y-1"><span className="text-xs font-black uppercase text-gray-400">Conta de destino</span><select value={transferForm.destinationAccountId} onChange={(event) => setTransferForm((current) => current ? { ...current, destinationAccountId: event.target.value } : current)} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950" required><option value="">Selecione uma conta que aceite {paymentName(transferForm.paymentMethodCode)}</option>{transferDestinations.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="block space-y-1"><span className="text-xs font-black uppercase text-gray-400">Valor</span><input inputMode="decimal" value={transferForm.amount} onChange={(event) => setTransferForm((current) => current ? { ...current, amount: event.target.value } : current)} className="w-full rounded-xl border px-3 py-2 text-lg font-black dark:border-gray-700 dark:bg-gray-950" required /></label><label className="block space-y-1"><span className="text-xs font-black uppercase text-gray-400">Motivo/observação</span><input value={transferForm.reason} onChange={(event) => setTransferForm((current) => current ? { ...current, reason: event.target.value } : current)} placeholder="Ex.: Pix do caixa para a CEF" className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950" /></label><div className="rounded-xl bg-gray-50 p-3 text-xs font-semibold text-gray-500 dark:bg-gray-950">A transferência não altera o resultado do Livro Diário; apenas move o saldo entre contas.</div></div><div className="flex justify-end gap-2 border-t p-5 dark:border-gray-800"><button type="button" onClick={() => setTransferForm(null)} className="rounded-xl border px-4 py-2 text-sm font-black text-gray-600">Cancelar</button><button type="submit" disabled={transferWorking || transferDestinations.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{transferWorking ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}Transferir</button></div></form></div>
      )}
    </PageContainer>
  );
}
