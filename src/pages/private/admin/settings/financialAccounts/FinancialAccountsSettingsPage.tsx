import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
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

function paymentLabel(value?: string | null) {
  const labels: Record<string, string> = {
    cash: 'Dinheiro',
    pix: 'Pix',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    pending: 'Pendente',
  };
  return value ? labels[value] || value : 'Não informado';
}

export default function FinancialAccountsSettingsPage() {
  const storeId = getActiveStoreId();
  const [balances, setBalances] = useState<FinancialAccountBalancesResult | null>(null);
  const [unallocated, setUnallocated] = useState<UnallocatedCashbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [showAccountManagement, setShowAccountManagement] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const accounts = useMemo(() => balances?.accounts || [], [balances]);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.active), [accounts]);
  const canManage = balances?.canManage ?? false;

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
    setForm(EMPTY_FORM);
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

    try {
      setSaving(true);
      const current = accounts.find((account) => account.id === form.id);
      await FinancialAccountsService.save({
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
      toast.success('Conta financeira salva.');
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
    try {
      await FinancialAccountsService.setActive(storeId, account.id, !account.active);
      toast.success(account.active ? 'Conta desativada.' : 'Conta reativada.');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar a conta financeira.');
    }
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
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao classificar lançamento.');
    } finally {
      setClassifyingId(null);
    }
  }

  return (
    <PageContainer
      title="Saldos por conta"
      subtitle="Veja onde o dinheiro está alocado e distribua lançamentos antigos que ainda não têm conta financeira."
      category="Financeiro"
      icon={<WalletCards className="text-[#19A999]" size={28} />}
      flat
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Posição financeira atual</h2>
            <p className="mt-1 text-xs font-semibold text-gray-400">Somente lançamentos confirmados que afetam saldo entram nos valores abaixo.</p>
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
                <p className="mt-2 text-xs font-semibold text-emerald-700/70 dark:text-emerald-300/70">Saldo já atribuído a caixa, banco, Pix, recebíveis e outras contas.</p>
              </div>
              <div className={`rounded-2xl border p-5 shadow-sm ${balances.unallocated.count > 0 ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20' : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
                <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Não distribuído</p>
                <p className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">{formatMoney(balances.summary.unallocatedBalance)}</p>
                <p className="mt-2 text-xs font-semibold text-amber-700/70 dark:text-amber-300/70">{balances.unallocated.count} lançamento(s) aguardando classificação manual.</p>
              </div>
            </div>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">Contas financeiras</h2>
                  <p className="text-xs font-semibold text-gray-400">Entradas menos saídas desde o início do histórico.</p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAccountManagement((current) => !current)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-600 hover:border-teal-300 hover:text-teal-700 dark:border-gray-700 dark:text-gray-300"
                  >
                    {showAccountManagement ? 'Ocultar cadastro' : 'Gerenciar contas'}
                  </button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {accounts.map((account) => (
                  <div key={account.id} className={`rounded-2xl border p-4 ${account.active ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50' : 'border-gray-200 bg-gray-100 opacity-65 dark:border-gray-800 dark:bg-gray-950'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-gray-900 dark:text-white">{account.name}</p>
                        <p className="text-xs font-semibold text-gray-400">{accountCodeLabel(account.code)} · {accountTypeLabel(account.account_type)}</p>
                      </div>
                      {account.is_default && <span className="rounded-full bg-teal-100 px-2 py-1 text-[10px] font-black uppercase text-teal-700 dark:bg-teal-950 dark:text-teal-300">Padrão</span>}
                    </div>
                    <p className={`mt-4 text-2xl font-black ${account.balance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{formatMoney(account.balance)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-emerald-50 p-2 font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><ArrowDownCircle className="mb-1" size={14} />Entradas<br />{formatMoney(account.inflows)}</div>
                      <div className="rounded-xl bg-red-50 p-2 font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300"><ArrowUpCircle className="mb-1" size={14} />Saídas<br />{formatMoney(account.outflows)}</div>
                    </div>
                    <p className="mt-3 text-[11px] font-semibold text-gray-400">{account.movement_count} movimentação(ões) · {formatDate(account.last_movement_at)}</p>
                  </div>
                ))}
              </div>
            </section>

            {canManage && showAccountManagement && (
              <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5 dark:border-teal-900/50 dark:bg-teal-950/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-black text-gray-900 dark:text-white">Cadastro de contas</h2>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Desative contas antigas em vez de apagar para preservar o histórico.</p>
                  </div>
                  <button type="button" onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white hover:bg-teal-700"><Plus size={16} />Nova conta</button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {accounts.map((account) => (
                    <div key={account.id} className="rounded-xl border border-white bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-black dark:text-white">{account.name}</p><p className="text-xs text-gray-400">{accountTypeLabel(account.account_type)}</p></div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${account.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{account.active ? 'Ativa' : 'Inativa'}</span>
                      </div>
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
                  <p className="text-sm font-semibold text-amber-800/75 dark:text-amber-300/75">Nenhum valor antigo é inferido automaticamente. Escolha manualmente a conta correta; cada alteração fica registrada em auditoria.</p>
                </div>
              </div>

              {unallocated.length === 0 ? (
                <div className="rounded-xl bg-white p-5 text-center text-sm font-bold text-emerald-700 dark:bg-gray-900 dark:text-emerald-300">Todos os lançamentos que afetam saldo estão distribuídos.</div>
              ) : (
                <div className="space-y-3">
                  {unallocated.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm dark:border-amber-900/40 dark:bg-gray-900">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${entry.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{entry.direction === 'in' ? 'Entrada' : 'Saída'}</span>
                            <span className="text-xs font-bold text-gray-400">{entry.entry_code || 'Sem código'} · {formatDate(entry.occurred_at)}</span>
                          </div>
                          <p className="mt-2 font-black text-gray-900 dark:text-white">{entry.description}</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{paymentLabel(entry.payment_method_code || entry.payment_method)} · origem: {entry.source}</p>
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
                            <option value="">Selecione a conta</option>
                            {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {accountTypeLabel(account.account_type)}</option>)}
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
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={saveAccount} className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
              <div><h3 className="font-black dark:text-white">{form.id ? 'Editar conta financeira' : 'Nova conta financeira'}</h3><p className="text-xs font-semibold text-gray-400">Código pode ficar em branco para ser gerado pelo nome.</p></div>
              <button type="button" onClick={closeForm} className="rounded-xl border p-2 text-gray-500 dark:border-gray-700"><X size={16} /></button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Nome</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" required /></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Tipo</span><select value={form.accountType} onChange={(event) => setForm((current) => ({ ...current, accountType: event.target.value as FinancialAccountType }))} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white">{ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-gray-400">Código</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="Gerado automaticamente" className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
              <label className="space-y-1 md:col-span-2"><span className="text-xs font-black uppercase text-gray-400">Descrição</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
              <label className="flex items-center gap-2 text-sm font-bold dark:text-gray-200"><input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} />Conta padrão do tipo</label>
              <label className="flex items-center gap-2 text-sm font-bold dark:text-gray-200"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Conta ativa</label>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 p-5 dark:border-gray-800">
              <button type="button" onClick={closeForm} className="rounded-xl border px-4 py-2 text-sm font-black text-gray-600 dark:border-gray-700 dark:text-gray-300">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Salvar</button>
            </div>
          </form>
        </div>
      )}
    </PageContainer>
  );
}
