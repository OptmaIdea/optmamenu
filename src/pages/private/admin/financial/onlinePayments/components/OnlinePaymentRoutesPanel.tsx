import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Save, Truck, Store, WalletCards } from 'lucide-react';
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
  allow_override_on_receipt: boolean;
  active: boolean;
}

interface OnlinePaymentRoutesPanelProps {
  storeId: string;
  canManage: boolean;
}

function fulfillmentLabel(value: string) {
  return value === 'delivery' ? 'Delivery' : value === 'pickup' ? 'Retirada' : value;
}

function timingLabel(value: string) {
  return value === 'advance' ? 'Pagamento antecipado' : value === 'pay_on_fulfillment' ? 'Pago no recebimento' : value;
}

function methodLabel(value: string) {
  const labels: Record<string, string> = {
    '*': 'Qualquer forma a receber',
    cash: 'Dinheiro',
    pix: 'Pix',
    pix_manual_qr: 'Pix por QR Code',
    asaas_pix: 'Pix Asaas',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    card: 'Cartão',
    payment_link: 'Link de pagamento',
  };
  return labels[value] || value.replace(/[_-]+/g, ' ');
}

function routeBusinessLabel(row: PaymentRouteRow) {
  if (typeof row.metadata?.label === 'string' && row.metadata.label.trim()) return row.metadata.label;
  return `${fulfillmentLabel(row.fulfillment_type)} · ${methodLabel(row.payment_method_code)} · ${timingLabel(row.payment_timing)}`;
}

function accountName(accountId: string | null, accounts: FinancialAccountOption[]) {
  if (!accountId) return 'Conta não definida';
  return accounts.find((account) => account.id === accountId)?.name || 'Conta não encontrada';
}

function groupRoutes(rows: PaymentRouteRow[]) {
  return {
    delivery: rows.filter((row) => row.fulfillment_type === 'delivery'),
    pickup: rows.filter((row) => row.fulfillment_type === 'pickup'),
  };
}

export default function OnlinePaymentRoutesPanel({ storeId, canManage }: OnlinePaymentRoutesPanelProps) {
  const [routes, setRoutes] = useState<PaymentRouteRow[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccountOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RouteDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const grouped = useMemo(() => groupRoutes(routes), [routes]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [routesResult, accountsResult] = await Promise.all([
        supabase
          .from('store_order_payment_account_routes')
          .select('id, store_id, scope, fulfillment_type, payment_timing, payment_method_code, destination_financial_account_id, allow_override_on_receipt, active, sort_order, metadata')
          .eq('store_id', storeId)
          .eq('scope', 'public_store')
          .order('fulfillment_type', { ascending: true })
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
      setRoutes(nextRoutes);
      setAccounts(nextAccounts);
      setDrafts(Object.fromEntries(nextRoutes.map((route) => [
        route.id,
        {
          destination_financial_account_id: route.destination_financial_account_id || '',
          allow_override_on_receipt: route.allow_override_on_receipt,
          active: route.active,
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

  function updateDraft(routeId: string, patch: Partial<RouteDraft>) {
    setDrafts((current) => ({
      ...current,
      [routeId]: {
        ...current[routeId],
        ...patch,
      },
    }));
  }

  async function saveRoute(route: PaymentRouteRow) {
    const draft = drafts[route.id];
    if (!draft) return;

    if (!draft.destination_financial_account_id) {
      toast.warning('Escolha uma conta para essa rota.');
      return;
    }

    setSavingId(route.id);
    try {
      const { error } = await supabase
        .from('store_order_payment_account_routes')
        .update({
          destination_financial_account_id: draft.destination_financial_account_id,
          allow_override_on_receipt: draft.allow_override_on_receipt,
          active: draft.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', route.id)
        .eq('store_id', storeId);

      if (error) throw error;
      toast.success('Rota de recebimento atualizada.');
      await load();
    } catch (error) {
      console.error('Erro ao salvar rota de recebimento:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar rota de recebimento.');
    } finally {
      setSavingId(null);
    }
  }

  function renderRoute(route: PaymentRouteRow) {
    const draft = drafts[route.id] || {
      destination_financial_account_id: route.destination_financial_account_id || '',
      allow_override_on_receipt: route.allow_override_on_receipt,
      active: route.active,
    };
    const changed = draft.destination_financial_account_id !== (route.destination_financial_account_id || '') ||
      draft.allow_override_on_receipt !== route.allow_override_on_receipt ||
      draft.active !== route.active;

    return (
      <div key={route.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 dark:text-white">{routeBusinessLabel(route)}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span>{timingLabel(route.payment_timing)}</span>
              <span>•</span>
              <span>{methodLabel(route.payment_method_code)}</span>
              {route.allow_override_on_receipt && <><span>•</span><span>Conta alterável na baixa</span></>}
            </div>
          </div>
          <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ${route.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
            {route.active ? 'ATIVA' : 'INATIVA'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Conta que recebe</span>
            <select
              value={draft.destination_financial_account_id}
              disabled={!canManage || savingId === route.id}
              onChange={(event) => updateDraft(route.id, { destination_financial_account_id: event.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none transition focus:border-[#19A999] disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">Selecione uma conta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}{account.active ? '' : ' (inativa)'}</option>
              ))}
            </select>
            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
              Atual: {accountName(route.destination_financial_account_id, accounts)}
            </span>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={draft.allow_override_on_receipt}
              disabled={!canManage || savingId === route.id || route.payment_timing === 'advance'}
              onChange={(event) => updateDraft(route.id, { allow_override_on_receipt: event.target.checked })}
              className="h-4 w-4 accent-[#19A999]"
            />
            Alterável na baixa
          </label>

          <button
            type="button"
            disabled={!canManage || !changed || savingId === route.id}
            onClick={() => void saveRoute(route)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white transition hover:bg-[#188575] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingId === route.id ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
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
            <p className="font-black">Rotas de recebimento da loja online</p>
            <p className="mt-1 font-semibold opacity-90">
              Defina para qual conta financeira cada venda pública deve ir. Casos “a receber” podem permitir troca da conta na baixa; pagamentos antecipados ficam presos ao provedor escolhido.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Truck className="text-[#19A999]" size={20} />
            <h2 className="text-lg font-black">Delivery</h2>
          </div>
          {grouped.delivery.length > 0 ? grouped.delivery.map(renderRoute) : (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhuma rota de delivery cadastrada.</div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Store className="text-[#19A999]" size={20} />
            <h2 className="text-lg font-black">Retirada</h2>
          </div>
          {grouped.pickup.length > 0 ? grouped.pickup.map(renderRoute) : (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhuma rota de retirada cadastrada.</div>
          )}
        </section>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
          <p>
            Essas regras são usadas na criação dos lançamentos do Livro Diário e aparecem no Modo Extrato por conta. Se uma venda cair no destino errado, a correção deve começar por esta tabela de rotas.
          </p>
        </div>
      </div>
    </div>
  );
}
