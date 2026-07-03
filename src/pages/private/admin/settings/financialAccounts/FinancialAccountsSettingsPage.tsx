import { useEffect, useMemo, useState } from 'react';
import { Building2, Edit3, Loader2, Plus, RefreshCw, Save, ToggleLeft, ToggleRight, WalletCards, X } from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { getActiveStoreId } from '@/utils/activeStore';
import {
  FinancialAccountsService,
  type FinancialAccountType,
  type SaveFinancialAccountInput,
  type StoreFinancialAccount,
} from '@/services/financialAccountsService';

const ACCOUNT_TYPES: Array<{ value: FinancialAccountType; label: string }> = [
  { value: 'cash_drawer', label: 'Caixa físico' },
  { value: 'safe', label: 'Cofre' },
  { value: 'bank', label: 'Banco' },
  { value: 'pix_wallet', label: 'Carteira Pix' },
  { value: 'card_acquirer', label: 'Maquininha' },
  { value: 'card_receivable', label: 'Recebíveis de cartão' },
  { value: 'owner', label: 'Proprietário' },
  { value: 'other', label: 'Outro' },
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

function accountTypeLabel(type: string) {
  return ACCOUNT_TYPES.find((item) => item.value === type)?.label || type;
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

export default function FinancialAccountsSettingsPage() {
  const storeId = getActiveStoreId();
  const [accounts, setAccounts] = useState<StoreFinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);

  const groupedAccounts = useMemo(() => {
    return ACCOUNT_TYPES.map((type) => ({
      ...type,
      accounts: accounts.filter((account) => account.account_type === type.value),
    })).filter((group) => group.accounts.length > 0);
  }, [accounts]);

  async function loadAccounts() {
    if (!storeId) return;

    try {
      setLoading(true);
      const items = await FinancialAccountsService.list(storeId, showInactive);
      setAccounts(items);
    } catch (error) {
      console.error('Erro ao carregar contas financeiras:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar contas financeiras.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, showInactive]);

  function startCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function startEdit(account: StoreFinancialAccount) {
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

  async function saveAccount(event: React.FormEvent) {
    event.preventDefault();

    if (!storeId) {
      toast.error('Nenhuma loja ativa selecionada.');
      return;
    }

    if (!form.name.trim()) {
      toast.error('Informe o nome da conta financeira.');
      return;
    }

    try {
      setSaving(true);
      const payload: SaveFinancialAccountInput = {
        storeId,
        accountId: form.id,
        code: form.code.trim() || slugifyCode(form.name),
        name: form.name.trim(),
        accountType: form.accountType,
        description: form.description.trim() || null,
        isDefault: form.isDefault,
        active: form.active,
        sortOrder: form.id ? accounts.find((item) => item.id === form.id)?.sort_order || 0 : 500,
        metadata: { source: 'financial_accounts_settings_page' },
      };

      await FinancialAccountsService.save(payload);
      toast.success('Conta financeira salva.');
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await loadAccounts();
    } catch (error) {
      console.error('Erro ao salvar conta financeira:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar conta financeira.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(account: StoreFinancialAccount) {
    if (!storeId) return;

    try {
      await FinancialAccountsService.setActive(storeId, account.id, !account.active);
      toast.success(account.active ? 'Conta desativada.' : 'Conta reativada.');
      await loadAccounts();
    } catch (error) {
      console.error('Erro ao alterar status da conta:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar status da conta.');
    }
  }

  return (
    <PageContainer
      title="Contas financeiras"
      subtitle="Cadastre caixas, cofres, bancos, carteiras Pix, maquininhas e recebíveis usados pela loja."
      category="Configurações"
      icon={<WalletCards className="text-[#19A999]" size={28} />}
      flat
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-bold text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-100">
          <p>
            Essas contas separam dinheiro físico, Pix, cartões, cofre, bancos e valores do proprietário. Elas serão usadas no Livro Diário, fechamento do caixa, sangrias, reforço de troco e transferências internas.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Cadastro de contas</h2>
            <p className="mt-1 text-xs font-semibold text-gray-400">Desative contas antigas em vez de apagar, preservando o histórico.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowInactive((current) => !current)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
            >
              {showInactive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {showInactive ? 'Mostrando inativas' : 'Ocultando inativas'}
            </button>
            <button
              type="button"
              onClick={loadAccounts}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white transition hover:bg-teal-700"
            >
              <Plus size={16} />
              Nova conta
            </button>
          </div>
        </div>

        {formOpen && (
          <form onSubmit={saveAccount} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  {form.id ? 'Editar conta financeira' : 'Nova conta financeira'}
                </h3>
                <p className="mt-1 text-xs font-semibold text-gray-400">Código pode ficar em branco para ser gerado pelo nome.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setFormOpen(false);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nome</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Caixa Balcão, Banco Itaú, Stone"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo</span>
                <select
                  value={form.accountType}
                  onChange={(event) => setForm((current) => ({ ...current, accountType: event.target.value as FinancialAccountType }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Código</span>
                <input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="Ex.: banco_itau"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Descrição</span>
                <input
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
                />
                Conta padrão deste tipo
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                />
                Ativa
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar conta
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center rounded-2xl bg-white p-8 dark:bg-gray-900">
            <Loader2 className="animate-spin text-teal-600" />
          </div>
        ) : groupedAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm font-bold text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            Nenhuma conta financeira cadastrada.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedAccounts.map((group) => (
              <section key={group.value} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  <Building2 size={16} />
                  {group.label}
                </h3>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {group.accounts.map((account) => (
                    <div key={account.id} className={`rounded-2xl border p-4 ${account.active ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/60' : 'border-gray-200 bg-gray-100 opacity-70 dark:border-gray-800 dark:bg-gray-900'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black text-gray-900 dark:text-white">{account.name}</p>
                          <p className="text-xs font-semibold text-gray-400">{account.code} · {accountTypeLabel(account.account_type)}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {account.is_default && <span className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-black uppercase text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">Padrão</span>}
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${account.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                            {account.active ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                      </div>
                      {account.description && <p className="mt-2 text-xs font-bold text-gray-500 dark:text-gray-400">{account.description}</p>}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(account)}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600 hover:border-teal-200 hover:text-teal-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        >
                          <Edit3 size={14} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(account)}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600 hover:border-teal-200 hover:text-teal-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        >
                          {account.active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                          {account.active ? 'Desativar' : 'Reativar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
