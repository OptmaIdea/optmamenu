import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  CheckSquare,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
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
  type FinancialAccountType,
  type UnallocatedCashbookEntry,
} from '@/services/financialAccountsService';
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
    other: 'Outro',
    pending: 'Pendente',
  };
  return value ? labels[value] || value : 'Não informado';
}

function paymentCodeFromEntry(entry: UnallocatedCashbookEntry) {
  return entry.payment_method_code || entry.payment_method || '';
}

type TransferFormState = {
  sourceAccountId: string;
  paymentMethodCode: string;
  destinationAccountId: string;
  amount: string;
  reason: string;
};

export default function FinancialAccountsSettingsPage() {
  const storeId = getActiveStoreId();
  const [balances, setBalances] = useState<FinancialAccountBalancesResult | null>(null);
  const [unallocated, setUnallocated] = useState<UnallocatedCashbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [bulkAccountId, setBulkAccountId] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [showAccountManagement, setShowAccountManagement] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [transferForm, setTransferForm] = useState<TransferFormState | null>(null);
  const [transferWorking, setTransferWorking] = useState(false);

  const accounts = useMemo(() => balances?.accounts || [], [balances]);
  const paymentMethods = useMemo(() => balances?.paymentMethods || [], [balances]);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.active), [accounts]);
  const canManage = balances?.canManage ?? false;

  const paymentName = (code?: string | null) => {
    if (!code) return 'Não informado';
    return paymentMethods.find((method) => method.code === code)?.name || fallbackPaymentLabel(code);
  };

  const selectedEntries = useMemo(
    () => unallocated.filter((entry) => selectedRows[entry.id]),
    [selectedRows, unallocated],
  );

  const selectedPaymentCodes = useMemo(
    () => Array.from(new Set(selectedEntries.map(paymentCodeFromEntry).filter(Boolean))),
    [selectedEntries],
  );

  const compatibleBulkAccounts = useMemo(() => {
    if (selectedPaymentCodes.length === 0) return activeAccounts;
    return activeAccounts.filter((account) =>
      selectedPaymentCodes.every((code) => account.accepted_payment_methods?.includes(code)),
    );
  }, [activeAccounts, selectedPaymentCodes]);

  const unallocatedByPayment = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const entry of unallocated) {
      const code = paymentCodeFromEntry(entry) || 'unknown';
      grouped.set(code, (grouped.get(code) || 0) + 1);
    }
    return Array.from(grouped.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [unallocated]);

  async function loadData() {
    if (!storeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [balanceResult, pendingResult] = await Promise.all([
        FinancialAccountsService.getBalances(storeId),
        FinancialAccountsService.listUnallocated(storeId, 100, 0),
      ]);
      setBalances(balanceResult);
      setUnallocated(pendingResult.items);
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
      toast.error('Defina outra conta como entrada padrão das vendas antes de desativar esta conta.');
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

  function accountsForEntry(entry: UnallocatedCashbookEntry) {
    const code = paymentCodeFromEntry(entry);
    if (!code) return activeAccounts;
    return activeAccounts.filter((account) => account.accepted_payment_methods?.includes(code));
  }

  async function classifyEntry(entry: UnallocatedCashbookEntry) {
    if (!storeId) return;
    const accountId = selectedAccounts[entry.id];
    if (!accountId) return toast.error('Selecione a conta de destino/origem do lançamento.');

    try {
      setClassifyingId(entry.id);
      await FinancialAccountsService.classifyEntry(storeId, entry.id, accountId, reasons[entry.id]);
      toast.success('Lançamento distribuído. Saldos recalculados.');
      setSelectedAccounts((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      setReasons((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      setSelectedRows((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao classificar lançamento.');
    } finally {
      setClassifyingId(null);
    }
  }

  function selectAllVisible() {
    setSelectedRows(Object.fromEntries(unallocated.map((entry) => [entry.id, true])));
    setBulkAccountId('');
  }

  function selectPaymentMethod(code: string) {
    setSelectedRows(Object.fromEntries(
      unallocated
        .filter((entry) => (paymentCodeFromEntry(entry) || 'unknown') === code)
        .map((entry) => [entry.id, true]),
    ));
    setBulkAccountId('');
  }

  function clearSelection() {
    setSelectedRows({});
    setBulkAccountId('');
    setBulkReason('');
  }

  async function distributeBulk() {
    if (!storeId) return;
    if (selectedEntries.length === 0) return toast.error('Selecione ao menos um lançamento.');
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
    ? activeAccounts.filter((account) =>
        account.id !== transferForm.sourceAccountId
        && account.accepted_payment_methods?.includes(transferForm.paymentMethodCode),
      )
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao transferir entre contas.');
    } finally {
      setTransferWorking(false);
    }
  }

  return (
    <PageContainer
      title="Saldos por conta"
      subtitle="Concentre as vendas em uma conta operacional e distribua os valores por forma de pagamento para as contas corretas."
      category="Financeiro"
      icon={<WalletCards className="text-[#19A999]" size={28} />}
      flat
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Posição financeira atual</h2>
            <p className="mt-1 text-xs font-semibold text-gray-400">Vendas novas entram automaticamente na conta operacional configurada quando ela aceita a forma de pagamento.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded-2xl bg-white dark:bg-gray-900">
            <Loader2 className="animate-spin text-teal-600" size={28} />
          </div>
        ) : !balances ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">Não foi possível carregar os saldos.</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Saldo do livro</p>
                <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{formatMoney(balances.summary.bookBalance)}</p>
                <p className="mt-2 text-xs font-semibold text-gray-400">Resultado financeiro registrado no Livro Diário.</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Distribuído em contas</p>
                <p className="mt-2 text-3xl font-black text-emerald-800 dark:text-emerald-200">{formatMoney(balances.summary.allocatedBalance)}</p>
                <p className="mt-2 text-xs font-semibold text-emerald-700/70 dark:text-emerald-300/70">Saldo atribuído a contas e preservado por forma de pagamento.</p>
              </div>
              <div className={`rounded-2xl border p-5 shadow-sm ${balances.unallocated.count > 0 ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20' : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
                <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Não distribuído</p>
                <p className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">{formatMoney(balances.summary.unallocatedBalance)}</p>
                <p className="mt-2 text-xs font-semibold text-amber-700/70 dark:text-amber-300/70">{balances.unallocated.count} lançamento(s) sem rota válida ou do histórico antigo.</p>
              </div>
            </div>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">Contas financeiras</h2>
                  <p className="text-xs font-semibold text-gray-400">Cada conta mantém o saldo total e a composição por Dinheiro, Pix, débito, crédito e demais meios aceitos.</p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAccountManagement((current) => !current)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-600 hover:border-teal-300 hover:text-teal-700 dark:border-gray-700 dark:text-gray-300"
                  >
                    {showAccountManagement ? 'Ocultar cadastro' : 'Gerenciar contas e regras'}
                  </button>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {accounts.map((account) => (
                  <div key={account.id} className={`rounded-2xl border p-4 ${account.active ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50' : 'border-gray-200 bg-gray-100 opacity-65 dark:border-gray-800 dark:bg-gray-950'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-gray-900 dark:text-white">{account.name}</p>
                        <p className="text-xs font-semibold text-gray-400">{accountCodeLabel(account.code)} · {accountTypeLabel(account.account_type)}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {account.is_sales_clearing_default && <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-300">Entrada das vendas</span>}
                        {account.is_default && <span className="rounded-full bg-teal-100 px-2 py-1 text-[10px] font-black uppercase text-teal-700 dark:bg-teal-950 dark:text-teal-300">Padrão</span>}
                      </div>
                    </div>
                    <p className={`mt-4 text-2xl font-black ${account.balance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{formatMoney(account.balance)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-emerald-50 p-2 font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><ArrowDownCircle className="mb-1" size={14} />Entradas<br />{formatMoney(account.inflows)}</div>
                      <div className="rounded-xl bg-red-50 p-2 font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300"><ArrowUpCircle className="mb-1" size={14} />Saídas<br />{formatMoney(account.outflows)}</div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aceita</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(account.accepted_payment_methods || []).length === 0 ? (
                          <span className="text-xs font-semibold text-amber-600">Nenhuma forma configurada</span>
                        ) : account.accepted_payment_methods?.map((code) => (
                          <span key={code} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">{paymentName(code)}</span>
                        ))}
                      </div>
                    </div>

                    {account.payment_breakdown.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Composição do saldo</p>
                        {account.payment_breakdown.map((item) => {
                          const destinations = activeAccounts.filter((candidate) =>
                            candidate.id !== account.id
                            && candidate.accepted_payment_methods?.includes(item.payment_method_code),
                          );
                          const canTransfer = canManage && item.balance > 0 && destinations.length > 0;
                          return (
                            <div key={item.payment_method_code} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs dark:bg-gray-900">
                              <div>
                                <p className="font-black text-gray-700 dark:text-gray-200">{paymentName(item.payment_method_code)}</p>
                                <p className="font-semibold text-gray-400">{item.movement_count} movimento(s)</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-black ${item.balance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{formatMoney(item.balance)}</span>
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => openTransfer(account, item.payment_method_code, item.balance)}
                                    disabled={!canTransfer}
                                    title={canTransfer ? 'Transferir este saldo para uma conta compatível' : 'Nenhuma conta compatível ou saldo indisponível'}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-teal-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700 dark:text-teal-300"
                                  >
                                    <ArrowRightLeft size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-3 text-[11px] font-semibold text-gray-400">{account.movement_count} movimentação(ões) · {formatDate(account.last_movement_at)}</p>
                  </div>
                ))}
              </div>
            </section>

            {canManage && showAccountManagement && (
              <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5 dark:border-teal-900/50 dark:bg-teal-950/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-black text-gray-900 dark:text-white">Cadastro e roteamento de contas</h2>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Configure o que cada conta aceita e qual recebe automaticamente as vendas novas.</p>
                  </div>
                  <button type="button" onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white hover:bg-teal-700"><Plus size={16} />Nova conta</button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {accounts.map((account) => (
                    <div key={account.id} className="rounded-xl border border-white bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-black dark:text-white">{account.name}</p><p className="text-xs text-gray-400">{accountTypeLabel(account.account_type)}</p></div>
                        <div className="flex gap-1">
                          {account.is_sales_clearing_default && <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-blue-700">Entrada das vendas</span>}
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${account.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{account.active ? 'Ativa' : 'Inativa'}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-gray-500">Aceita: {(account.accepted_payment_methods || []).map(paymentName).join(', ') || 'nenhuma forma configurada'}</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => startEdit(account)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black text-gray-600 dark:text-gray-300"><Edit3 size={14} />Editar</button>
                        <button type="button" onClick={() => void toggleActive(account)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black text-gray-600 dark:text-gray-300">{account.active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}{account.active ? 'Desativar' : 'Reativar'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/10">
              <div className="mb-4 flex items-start gap-3">
                <TriangleAlert className="mt-0.5 shrink-0 text-amber-600" size={22} />
                <div>
                  <h2 className="font-black text-amber-900 dark:text-amber-200">Não distribuído</h2>
                  <p className="text-sm font-semibold text-amber-800/75 dark:text-amber-300/75">Esta área passa a ser exceção: histórico antigo, falha de configuração ou lançamento sem rota. Nada antigo é inferido automaticamente.</p>
                </div>
              </div>

              {unallocated.length === 0 ? (
                <div className="rounded-xl bg-white p-5 text-center text-sm font-bold text-emerald-700 dark:bg-gray-900 dark:text-emerald-300">Todos os lançamentos que afetam saldo estão distribuídos.</div>
              ) : (
                <div className="space-y-4">
                  {canManage && (
                    <div className="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900/40 dark:bg-gray-900">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={selectAllVisible} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black text-gray-600 dark:text-gray-300"><CheckSquare size={14} />Selecionar todos ({unallocated.length})</button>
                        <button type="button" onClick={clearSelection} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black text-gray-600 dark:text-gray-300"><Square size={14} />Limpar seleção</button>
                        {unallocatedByPayment.map(([code, count]) => (
                          <button key={code} type="button" onClick={() => selectPaymentMethod(code)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{paymentName(code)} ({count})</button>
                        ))}
                      </div>

                      {selectedEntries.length > 0 && (
                        <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
                          <select
                            value={bulkAccountId}
                            onChange={(event) => setBulkAccountId(event.target.value)}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          >
                            <option value="">Conta para {selectedEntries.length} selecionado(s)</option>
                            {compatibleBulkAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {accountTypeLabel(account.account_type)}</option>)}
                          </select>
                          <input
                            value={bulkReason}
                            onChange={(event) => setBulkReason(event.target.value)}
                            placeholder="Motivo comum (opcional)"
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => void distributeBulk()}
                            disabled={bulkWorking || !bulkAccountId}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                          >
                            {bulkWorking ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            Distribuir em lote
                          </button>
                        </div>
                      )}
                      {selectedEntries.length > 0 && compatibleBulkAccounts.length === 0 && (
                        <p className="mt-2 text-xs font-bold text-red-600">Nenhuma conta aceita todas as formas de pagamento presentes nesta seleção. Selecione por forma de pagamento ou ajuste as regras da conta.</p>
                      )}
                    </div>
                  )}

                  {unallocated.map((entry) => {
                    const compatibleAccounts = accountsForEntry(entry);
                    return (
                      <div key={entry.id} className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-900 ${selectedRows[entry.id] ? 'border-amber-500 ring-1 ring-amber-300' : 'border-amber-100 dark:border-amber-900/40'}`}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 flex-1 gap-3">
                            {canManage && (
                              <label className="mt-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selectedRows[entry.id])}
                                  onChange={(event) => {
                                    setSelectedRows((current) => ({ ...current, [entry.id]: event.target.checked }));
                                    setBulkAccountId('');
                                  }}
                                  className="h-4 w-4"
                                />
                              </label>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${entry.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{entry.direction === 'in' ? 'Entrada' : 'Saída'}</span>
                                <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600 dark:bg-gray-800 dark:text-gray-300">{paymentName(paymentCodeFromEntry(entry))}</span>
                                <span className="text-xs font-bold text-gray-400">{entry.entry_code || 'Sem código'} · {formatDate(entry.occurred_at)}</span>
                              </div>
                              <p className="mt-2 font-black text-gray-900 dark:text-white">{entry.description}</p>
                              <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">origem: {entry.source}</p>
                            </div>
                          </div>
                          <p className={`text-xl font-black ${entry.direction === 'in' ? 'text-emerald-700' : 'text-red-700'}`}>{entry.direction === 'in' ? '+' : '-'}{formatMoney(entry.amount)}</p>
                        </div>

                        {canManage ? (
                          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                            <select
                              value={selectedAccounts[entry.id] || ''}
                              onChange={(event) => setSelectedAccounts((current) => ({ ...current, [entry.id]: event.target.value }))}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            >
                              <option value="">Selecione a conta compatível</option>
                              {compatibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {accountTypeLabel(account.account_type)}</option>)}
                            </select>
                            <input
                              value={reasons[entry.id] || ''}
                              onChange={(event) => setReasons((current) => ({ ...current, [entry.id]: event.target.value }))}
                              placeholder="Motivo/observação (opcional)"
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => void classifyEntry(entry)}
                              disabled={classifyingId === entry.id || !selectedAccounts[entry.id]}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                            >
                              {classifyingId === entry.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                              Distribuir
                            </button>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs font-semibold text-gray-400">Você possui acesso de leitura. A distribuição exige permissão de gestão financeira.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={saveAccount} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
              <div><h3 className="font-black dark:text-white">{form.id ? 'Editar conta financeira' : 'Nova conta financeira'}</h3><p className="text-xs font-semibold text-gray-400">Defina também quais formas de pagamento esta conta pode receber.</p></div>
              <button type="button" onClick={closeForm} className="rounded-xl border p-2 text-gray-500 dark:border-gray-700"><X size={16} /></button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Nome</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" required /></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Tipo</span><select value={form.accountType} onChange={(event) => setForm((current) => ({ ...current, accountType: event.target.value as FinancialAccountType }))} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white">{ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Código</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="Gerado automaticamente" className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
              <label className="space-y-1 md:col-span-2"><span className="text-xs font-black uppercase text-gray-400">Descrição</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>

              <div className="md:col-span-2 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Formas aceitas nesta conta</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {paymentMethods.map((method) => {
                    const checked = form.acceptedPaymentMethods.includes(method.code);
                    return (
                      <label key={method.code} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${checked ? 'border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950/20 dark:text-teal-200' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            acceptedPaymentMethods: event.target.checked
                              ? Array.from(new Set([...current.acceptedPaymentMethods, method.code]))
                              : current.acceptedPaymentMethods.filter((code) => code !== method.code),
                          }))}
                        />
                        {method.name}
                      </label>
                    );
                  })}
                </div>
                {form.acceptedPaymentMethods.some((code) => !paymentMethods.some((method) => method.code === code)) && (
                  <p className="mt-2 text-xs font-semibold text-gray-400">Também preservadas: {form.acceptedPaymentMethods.filter((code) => !paymentMethods.some((method) => method.code === code)).map(paymentName).join(', ')}.</p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm font-bold dark:text-gray-200"><input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} />Conta padrão do tipo</label>
              <label className="flex items-center gap-2 text-sm font-bold dark:text-gray-200"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Conta ativa</label>
              <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
                <input type="checkbox" className="mt-1" checked={form.isSalesClearingDefault} onChange={(event) => setForm((current) => ({ ...current, isSalesClearingDefault: event.target.checked }))} />
                <span><strong>Conta de entrada das vendas.</strong><br /><span className="font-semibold opacity-80">Quando marcada, vendas novas entram primeiro aqui. Depois você transfere Pix, cartões ou dinheiro para contas compatíveis. Só pode existir uma por loja.</span></span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 p-5 dark:border-gray-800">
              <button type="button" onClick={closeForm} className="rounded-xl border px-4 py-2 text-sm font-black text-gray-600 dark:border-gray-700 dark:text-gray-300">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Salvar</button>
            </div>
          </form>
        </div>
      )}

      {transferForm && transferSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitTransfer} className="w-full max-w-lg rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
              <div>
                <h3 className="font-black dark:text-white">Transferir entre contas</h3>
                <p className="text-xs font-semibold text-gray-400">{transferSource.name} · {paymentName(transferForm.paymentMethodCode)} · disponível {formatMoney(transferMethodBalance)}</p>
              </div>
              <button type="button" onClick={() => setTransferForm(null)} className="rounded-xl border p-2 text-gray-500 dark:border-gray-700"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block space-y-1">
                <span className="text-xs font-black uppercase text-gray-400">Conta de destino</span>
                <select value={transferForm.destinationAccountId} onChange={(event) => setTransferForm((current) => current ? { ...current, destinationAccountId: event.target.value } : current)} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" required>
                  <option value="">Selecione uma conta que aceite {paymentName(transferForm.paymentMethodCode)}</option>
                  {transferDestinations.map((account) => <option key={account.id} value={account.id}>{account.name} · {accountTypeLabel(account.account_type)}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-black uppercase text-gray-400">Valor</span>
                <input inputMode="decimal" value={transferForm.amount} onChange={(event) => setTransferForm((current) => current ? { ...current, amount: event.target.value } : current)} className="w-full rounded-xl border px-3 py-2 text-lg font-black dark:border-gray-700 dark:bg-gray-950 dark:text-white" required />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-black uppercase text-gray-400">Motivo/observação</span>
                <input value={transferForm.reason} onChange={(event) => setTransferForm((current) => current ? { ...current, reason: event.target.value } : current)} placeholder="Ex.: transferência do Pix do caixa para a CEF" className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <div className="rounded-xl bg-gray-50 p-3 text-xs font-semibold text-gray-500 dark:bg-gray-950 dark:text-gray-400">A transferência não altera o resultado financeiro do Livro Diário; apenas move o saldo da mesma forma de pagamento entre duas contas.</div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 p-5 dark:border-gray-800">
              <button type="button" onClick={() => setTransferForm(null)} className="rounded-xl border px-4 py-2 text-sm font-black text-gray-600 dark:border-gray-700 dark:text-gray-300">Cancelar</button>
              <button type="submit" disabled={transferWorking || transferDestinations.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{transferWorking ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}Transferir</button>
            </div>
          </form>
        </div>
      )}
    </PageContainer>
  );
}
