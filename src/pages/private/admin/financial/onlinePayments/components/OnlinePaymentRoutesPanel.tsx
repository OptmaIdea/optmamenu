import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Save, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface FinancialAccountOption {
  id: string;
  name: string;
  active: boolean;
  sort_order?: number | null;
}

interface PaymentRouteRow {
  id: string;
  store_id: string;
  scope: string;
  fulfillment_type: string;
  payment_timing: string;
  payment_method_code: string;
  destination_financial_account_id: string | null;
  allow_override_on_receipt: boolean;
  active: boolean;
  sort_order: number | null;
  metadata: Record<string, unknown> | null;
}

interface RouteDraft {
  destination_financial_account_id: string;
  active: boolean;
}

interface RouteGroup {
  key: string;
  title: string;
  description: string;
  timing: string;
  methods: string[];
  rows: PaymentRouteRow[];
  allowOverride: boolean;
}

interface OnlinePaymentRoutesPanelProps {
  storeId: string;
  canManage: boolean;
}

const GROUP_ORDER = [
  'online_pix',
  'direct_pix',
  'card_credit_online',
  'card_credit_machine',
  'card_debit_online',
  'card_debit_machine',
  'payment_link',
  'cash',
  'other_receivable',
];

function canonicalGroup(row: PaymentRouteRow) {
  const method = row.payment_method_code;
  const timing = row.payment_timing;

  if (['pix_manual_qr', 'asaas_pix'].includes(method) || (method === 'pix' && timing === 'advance')) return 'online_pix';
  if (method === 'pix') return 'direct_pix';
  if (method === 'credit_card' && timing === 'advance') return 'card_credit_online';
  if (method === 'credit_card') return 'card_credit_machine';
  if (method === 'debit_card' && timing === 'advance') return 'card_debit_online';
  if (method === 'debit_card') return 'card_debit_machine';
  if (method === 'payment_link') return 'payment_link';
  if (method === 'cash') return 'cash';
  if (method === '*') return 'other_receivable';
  return `${timing}_${method}`;
}

function groupTitle(key: string) {
  const labels: Record<string, string> = {
    online_pix: 'Pix online cópia e cola / QR Code gerado',
    direct_pix: 'Pix direto por chave ou QR Code de mesa',
    card_credit_online: 'Cartão de crédito online',
    card_credit_machine: 'Cartão de crédito na maquininha',
    card_debit_online: 'Cartão de débito online',
    card_debit_machine: 'Cartão de débito na maquininha',
    payment_link: 'Link de pagamento',
    cash: 'Dinheiro',
    other_receivable: 'Outra forma a receber',
  };
  return labels[key] || key.replace(/[_-]+/g, ' ');
}

function groupDescription(group: RouteGroup) {
  const appliesTo = Array.from(new Set(group.rows.map((row) => row.fulfillment_type === 'delivery' ? 'entrega' : row.fulfillment_type === 'pickup' ? 'retirada' : row.fulfillment_type))).join(' e ');
  const timing = group.timing === 'advance' ? 'pagamento antecipado' : 'pagamento no recebimento';
  if (group.key === 'online_pix') return `Usado para Pix gerado no checkout online. Aplica em ${appliesTo}.`;
  if (group.key === 'direct_pix') return `Usado quando o cliente paga Pix direto na chave/QR da loja. Aplica em ${appliesTo}.`;
  if (group.key.includes('machine')) return `Usado para pagamento na maquininha no momento da entrega, retirada, mesa ou balcão. Aplica em ${appliesTo}.`;
  return `${timing}. Aplica em ${appliesTo}.`;
}

function buildGroups(rows: PaymentRouteRow[]): RouteGroup[] {
  const map = new Map<string, PaymentRouteRow[]>();
  rows.forEach((row) => {
    const key = canonicalGroup(row);
    map.set(key, [...(map.get(key) || []), row]);
  });

  return Array.from(map.entries())
    .map(([key, groupRows]) => ({
      key,
      title: groupTitle(key),
      description: '',
      timing: groupRows.some((row) => row.payment_timing === 'advance') ? 'advance' : 'pay_on_fulfillment',
      methods: Array.from(new Set(groupRows.map((row) => row.payment_method_code))),
      rows: groupRows,
      allowOverride: groupRows.some((row) => row.allow_override_on_receipt),
    }))
    .map((group) => ({ ...group, description: groupDescription(group) }))
    .sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a.key);
      const bi = GROUP_ORDER.indexOf(b.key);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.title.localeCompare(b.title);
    });
}

function accountName(accountId: string | null, accounts: FinancialAccountOption[]) {
  if (!accountId) return 'Conta não definida';
  return accounts.find((account) => account.id === accountId)?.name || 'Conta não encontrada';
}

function defaultGroupAccount(group: RouteGroup) {
  const first = group.rows.find((row) => row.destination_financial_account_id)?.destination_financial_account_id;
  const allSame = group.rows.every((row) => (row.destination_financial_account_id || '') === (first || ''));
  return allSame ? (first || '') : '';
}

export default function OnlinePaymentRoutesPanel({ storeId, canManage }: OnlinePaymentRoutesPanelProps) {
  const [routes, setRoutes] = useState<PaymentRouteRow[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccountOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RouteDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const groups = useMemo(() => buildGroups(routes), [routes]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [routesResult, accountsResult] = await Promise.all([
        supabase
          .from('store_order_payment_account_routes')
          .select('id, store_id, scope, fulfillment_type, payment_timing, payment_method_code, destination_financial_account_id, allow_override_on_receipt, active, sort_order, metadata')
          .eq('store_id', storeId)
          .eq('scope', 'public_store')
          .order('sort_order', { ascending: true }),
        supabase
          .from('store_financial_accounts')
          .select('id, name, active, sort_order')
          .eq('store_id', storeId)
          .order('active', { ascending: false })
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      ]);

      if (routesResult.error) throw routesResult.error;
      if (accountsResult.error) throw accountsResult.error;

      const nextRoutes = (routesResult.data || []) as PaymentRouteRow[];
      const nextAccounts = (accountsResult.data || []) as FinancialAccountOption[];
      const nextGroups = buildGroups(nextRoutes);
      setRoutes(nextRoutes);
      setAccounts(nextAccounts);
      setDrafts(Object.fromEntries(nextGroups.map((group) => [
        group.key,
        {
          destination_financial_account_id: defaultGroupAccount(group),
          active: group.rows.every((row) => row.active),
        },
      ])));
    } catch (error) {
      console.error('Erro ao carregar rotas de recebimento:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar rotas de recebimento.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(groupKey: string, patch: Partial<RouteDraft>) {
    setDrafts((current) => ({
      ...current,
      [groupKey]: {
        ...current[groupKey],
        ...patch,
      },
    }));
  }

  async function saveGroup(group: RouteGroup) {
    const draft = drafts[group.key];
    if (!draft) return;

    if (!draft.destination_financial_account_id) {
      toast.warning('Escolha uma conta para essa forma de pagamento.');
      return;
    }

    setSavingKey(group.key);
    try {
      const { error } = await supabase
        .from('store_order_payment_account_routes')
        .update({
          destination_financial_account_id: draft.destination_financial_account_id,
          active: draft.active,
          updated_at: new Date().toISOString(),
        })
        .in('id', group.rows.map((row) => row.id))
        .eq('store_id', storeId);

      if (error) throw error;
      toast.success('Forma de pagamento atualizada.');
      await load();
    } catch (error) {
      console.error('Erro ao salvar rota de recebimento:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar forma de pagamento.');
    } finally {
      setSavingKey(null);
    }
  }

  function renderGroup(group: RouteGroup) {
    const draft = drafts[group.key] || {
      destination_financial_account_id: defaultGroupAccount(group),
      active: group.rows.every((row) => row.active),
    };
    const currentAccount = defaultGroupAccount(group);
    const changed = draft.destination_financial_account_id !== currentAccount || draft.active !== group.rows.every((row) => row.active);
    const mixedAccounts = !currentAccount;

    return (
      <div key={group.key} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-base font-black text-gray-900 dark:text-white">{group.title}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{group.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span>Canal online</span>
              <span>•</span>
              <span>{group.timing === 'advance' ? 'Antecipado' : 'No recebimento'}</span>
              {group.allowOverride && <><span>•</span><span>Alterável na baixa</span></>}
            </div>
          </div>
          <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ${draft.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
            {draft.active ? 'ATIVA' : 'INATIVA'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Conta destino padrão</span>
            <select
              value={draft.destination_financial_account_id}
              disabled={!canManage || savingKey === group.key}
              onChange={(event) => updateDraft(group.key, { destination_financial_account_id: event.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-base font-bold text-gray-800 outline-none transition focus:border-[#19A999] disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-950 dark:text-white sm:py-2 sm:text-sm"
            >
              <option value="">{mixedAccounts ? 'Contas diferentes nas variações' : 'Selecione uma conta'}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}{account.active ? '' : ' (inativa)'}</option>
              ))}
            </select>
            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
              Atual: {mixedAccounts ? 'contas diferentes nas variações internas' : accountName(currentAccount, accounts)}
            </span>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-3 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200 sm:py-2">
            <input
              type="checkbox"
              checked={draft.active}
              disabled={!canManage || savingKey === group.key}
              onChange={(event) => updateDraft(group.key, { active: event.target.checked })}
              className="h-4 w-4 accent-[#19A999]"
            />
            Forma ativa
          </label>

          <button
            type="button"
            disabled={!canManage || !changed || savingKey === group.key}
            onClick={() => void saveGroup(group)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-3 text-sm font-black text-white transition hover:bg-[#188575] disabled:cursor-not-allowed disabled:opacity-50 sm:py-2"
          >
            {savingKey === group.key ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <RefreshCw className="animate-spin text-[#19A999]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
        <div className="flex gap-3">
          <WalletCards className="mt-0.5 shrink-0" size={20} />
          <div>
            <p className="font-black">Recebimentos da loja online</p>
            <p className="mt-1 font-semibold opacity-90">
              Configure por forma de pagamento e conta destino padrão. Banco ou adquirente ficam na conta financeira; a forma de pagamento é Pix, cartão, dinheiro, link ou outra forma aceita.
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Canal online</h2>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Essas regras alimentam pedidos públicos, Livro Diário, extrato por conta e conciliação.</p>
        </div>
        {groups.length > 0 ? groups.map(renderGroup) : (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhuma forma de pagamento cadastrada para a loja online.</div>
        )}
      </section>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
          <p>
            Para não confundir operação com banco, a conta destino aparece separada da forma de pagamento. Exemplo: “Pix online cópia e cola / QR Code gerado” pode cair em InfinitePay, AsaaS Pix ou qualquer outra conta configurada.
          </p>
        </div>
      </div>
    </div>
  );
}
