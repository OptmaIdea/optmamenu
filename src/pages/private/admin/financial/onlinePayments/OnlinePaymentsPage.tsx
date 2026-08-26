import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FlaskConical,
  KeyRound,
  Landmark,
  RefreshCw,
  Webhook,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { getActiveStoreId } from '@/utils/activeStore';
import {
  OnlinePaymentsService,
  type AsaasSandboxPixCharge,
  type AsaasSandboxStatus,
  type OnlinePaymentProvider,
  type OnlinePaymentSettlementAccount,
  type OnlinePaymentsWorkspace,
} from '@/services/onlinePaymentsService';

type Tab = 'overview' | 'providers' | 'transactions' | 'proofs' | 'events' | 'sandbox';

type SummaryCard = {
  label: string;
  value: number;
  Icon: LucideIcon;
  tone: string;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'providers', label: 'Provedores' },
  { id: 'transactions', label: 'Transações' },
  { id: 'proofs', label: 'Comprovantes' },
  { id: 'events', label: 'Webhooks e eventos' },
  { id: 'sandbox', label: 'Laboratório Sandbox' },
];

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    created: 'Criado', pending: 'Pendente', authorized: 'Autorizado', paid: 'Pago', failed: 'Falhou',
    expired: 'Expirado', cancelled: 'Cancelado', partially_refunded: 'Estorno parcial', refunded: 'Estornado',
    submitted: 'Aguardando conferência', confirmed: 'Confirmado', rejected: 'Rejeitado', superseded: 'Substituído',
  };
  return labels[status] || status;
}

function statusTone(status: string) {
  if (['paid', 'confirmed', 'ready'].includes(status)) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
  if (['failed', 'rejected', 'expired', 'cancelled'].includes(status)) return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
  if (['pending', 'submitted', 'created', 'authorized'].includes(status)) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function credentialLabel(status: OnlinePaymentProvider['credential_status']) {
  return {
    not_required: 'Não requer credenciais',
    not_configured: 'Credenciais pendentes',
    configured: 'Credenciais configuradas',
    invalid: 'Credenciais com erro',
    ready: 'Conexão pronta',
  }[status];
}

function capabilityLabel(capability: string) {
  const labels: Record<string, string> = {
    pix: 'PIX',
    refunds: 'Estornos',
    webhooks: 'Webhooks',
    credit_card: 'Cartão',
    payment_link: 'Link de pagamento',
    test_scenarios: 'Cenários de teste',
  };
  return labels[capability] || capability.replaceAll('_', ' ');
}

function sandboxBalanceLabel(value: unknown) {
  if (!value || typeof value !== 'object') return 'Indisponível';
  const row = value as Record<string, unknown>;
  const amount = Number(row.balance ?? row.value);
  return Number.isFinite(amount) ? money.format(amount) : 'Indisponível';
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão',
    payment_link: 'Link de pagamento',
  };
  return labels[method] || method.replaceAll('_', ' ');
}

export default function OnlinePaymentsPage() {
  const storeId = getActiveStoreId();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [workspace, setWorkspace] = useState<OnlinePaymentsWorkspace | null>(null);
  const [asaasStatus, setAsaasStatus] = useState<AsaasSandboxStatus | null>(null);
  const [settlementAccounts, setSettlementAccounts] = useState<OnlinePaymentSettlementAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [sandboxAmount, setSandboxAmount] = useState('42,00');
  const [asaasAmount, setAsaasAmount] = useState('1,00');
  const [asaasPixCharge, setAsaasPixCharge] = useState<AsaasSandboxPixCharge | null>(null);
  const [sandboxMethod, setSandboxMethod] = useState('pix');
  const [sandboxScenario, setSandboxScenario] = useState<'pending' | 'approved' | 'declined' | 'expired'>('pending');

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await OnlinePaymentsService.getWorkspace(storeId);
      setWorkspace(data);
      try {
        const [status, accounts] = await Promise.all([
          OnlinePaymentsService.getAsaasSandboxStatus(storeId),
          OnlinePaymentsService.listSettlementAccounts(storeId),
        ]);
        setAsaasStatus(status);
        setSettlementAccounts(accounts);
      } catch {
        setAsaasStatus(null);
        setSettlementAccounts([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar pagamentos online.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { void load(); }, [load]);

  const optmaProvider = useMemo(() => workspace?.providers.find((item) => item.provider_code === 'optma_sandbox' && item.environment === 'sandbox') || null, [workspace]);
  const asaasProvider = useMemo(() => workspace?.providers.find((item) => item.provider_code === 'asaas' && item.environment === 'sandbox') || null, [workspace]);

  const summaryCards = useMemo<SummaryCard[]>(() => [
    { label: 'Pendentes', value: workspace?.counts.pending || 0, Icon: Clock3, tone: 'text-amber-600' },
    { label: 'Pagos', value: workspace?.counts.paid || 0, Icon: CheckCircle2, tone: 'text-emerald-600' },
    { label: 'Falhas/expirados', value: workspace?.counts.failed || 0, Icon: XCircle, tone: 'text-rose-600' },
    { label: 'Comprovantes', value: workspace?.counts.proofs_pending || 0, Icon: FileCheck2, tone: 'text-blue-600' },
  ], [workspace]);

  async function toggleProvider(provider: OnlinePaymentProvider) {
    if (!storeId || !workspace?.permissions.manage) return;
    setWorking(true);
    try {
      await OnlinePaymentsService.saveProvider({
        storeId,
        providerCode: provider.provider_code,
        environment: provider.environment,
        enabled: !provider.enabled,
        isDefault: provider.is_default,
        publicConfig: provider.public_config,
      });
      toast.success(`${provider.display_name} ${provider.enabled ? 'desativado' : 'ativado'}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar o provedor.');
    } finally {
      setWorking(false);
    }
  }

  async function saveSettlementAccount(provider: OnlinePaymentProvider, accountId: string) {
    if (!storeId || !workspace?.permissions.manage) return;
    setWorking(true);
    try {
      await OnlinePaymentsService.saveProvider({
        storeId,
        providerCode: provider.provider_code,
        environment: provider.environment,
        enabled: provider.enabled,
        isDefault: provider.is_default,
        publicConfig: {
          ...provider.public_config,
          settlement_financial_account_id: accountId || null,
        },
      });
      toast.success(accountId ? 'Conta de liquidação atualizada.' : 'Conta de liquidação removida.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a conta de liquidação.');
    } finally {
      setWorking(false);
    }
  }

  async function createSandboxIntent() {
    if (!storeId) return;
    const amount = Number(sandboxAmount.replace('.', '').replace(',', '.'));
    if (!(amount > 0)) {
      toast.warning('Informe um valor válido.');
      return;
    }
    setWorking(true);
    try {
      await OnlinePaymentsService.createOptmaSandboxIntent({ storeId, amount, methodCode: sandboxMethod, scenario: sandboxScenario });
      toast.success('Transação fictícia criada.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar a simulação.');
    } finally {
      setWorking(false);
    }
  }

  async function simulate(intentId: string, action: 'approve' | 'decline' | 'expire' | 'cancel' | 'refund') {
    if (!storeId) return;
    setWorking(true);
    try {
      await OnlinePaymentsService.simulateOptmaSandbox(storeId, intentId, action);
      toast.success('Evento de pagamento simulado.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível simular o evento.');
    } finally {
      setWorking(false);
    }
  }

  async function createAsaasPixCharge() {
    if (!storeId) return;
    const amount = Number(asaasAmount.replace('.', '').replace(',', '.'));
    if (!(amount > 0)) {
      toast.warning('Informe um valor válido para o PIX de teste.');
      return;
    }
    setWorking(true);
    try {
      const charge = await OnlinePaymentsService.createAsaasSandboxPix({
        storeId,
        amount,
        description: 'PIX fictício de homologação OptmaMenu',
      });
      setAsaasPixCharge(charge);
      toast.success('PIX de teste gerado. Você já pode realizar o pagamento Sandbox.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o PIX de teste.');
    } finally {
      setWorking(false);
    }
  }

  async function payAsaasPixCharge() {
    if (!storeId || !asaasPixCharge?.qr?.payload || !asaasPixCharge.intent?.amount) return;
    setWorking(true);
    try {
      await OnlinePaymentsService.payAsaasSandboxPix({
        storeId,
        payload: asaasPixCharge.qr.payload,
        amount: Number(asaasPixCharge.intent.amount),
      });
      toast.success('Pagamento Sandbox solicitado. Atualizando os eventos...');
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível pagar o PIX de teste.');
    } finally {
      setWorking(false);
    }
  }

  if (!storeId) {
    return <PageContainer title="Pagamentos online" category="Financeiro"><div className="rounded-2xl border p-6">Selecione uma loja.</div></PageContainer>;
  }

  return (
    <PageContainer
      title="Pagamentos online"
      category="FINANCEIRO"
      subtitle="Configure provedores, acompanhe transações, comprovantes e webhooks sem misturar credenciais com o frontend."
      icon={<CreditCard className="text-[#19A999]" size={28} />}
      onRefresh={() => void load()}
    >
      <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-5 py-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 shrink-0" size={20} />
          <div>
            <p className="font-bold">Ambiente de homologação</p>
            <p className="text-sm opacity-90">Use somente contas, CPF/CNPJ e cartões fictícios de Sandbox. Nenhuma chave de API deve aparecer nesta tela, no Git ou em logs.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-[#19A999] text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}>
            {tab.label}{tab.id === 'proofs' && workspace?.counts.proofs_pending ? ` (${workspace.counts.proofs_pending})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"><RefreshCw className="animate-spin text-[#19A999]" /></div>
      ) : !workspace ? null : (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-4">
                {summaryCards.map(({ label, value, Icon, tone }) => (
                  <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                    <Icon className={tone} size={22} />
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="text-3xl font-black text-gray-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Fluxo autoritativo</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {['Pedido', 'Provedor', 'Webhook', 'Pagamento confirmado', 'Livro Diário / conta'].map((step, index) => (
                    <div key={step} className="rounded-xl bg-gray-50 p-4 text-center text-sm font-semibold text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                      <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#19A999] text-white">{index + 1}</span><br />{step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'providers' && (
            <div className="grid gap-5 lg:grid-cols-2">
              {[optmaProvider, asaasProvider].filter(Boolean).map((provider) => provider && (
                <div key={provider.id} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      {provider.provider_code === 'asaas' ? <Landmark className="text-blue-600" /> : <FlaskConical className="text-violet-600" />}
                      <div><h2 className="text-lg font-black text-gray-900 dark:text-white">{provider.display_name}</h2><p className="text-sm text-gray-500 dark:text-gray-400">{provider.environment === 'sandbox' ? 'Ambiente de testes' : 'Produção'}</p></div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${provider.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>{provider.enabled ? 'ATIVO' : 'INATIVO'}</span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-950"><p className="text-xs uppercase text-gray-500">Credencial</p><p className="mt-1 font-bold text-gray-900 dark:text-white">{credentialLabel(provider.credential_status)}</p></div>
                    <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-950"><p className="text-xs uppercase text-gray-500">Padrão</p><p className="mt-1 font-bold text-gray-900 dark:text-white">{provider.is_default ? 'Sim' : 'Não'}</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {Object.entries(provider.capabilities || {}).filter(([, value]) => value).map(([key]) => <span key={key} className="rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">{capabilityLabel(key)}</span>)}
                  </div>
                  {provider.provider_code === 'asaas' && (
                    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                      <p className="font-bold">Conexão Sandbox</p>
                      <p className="mt-1">Conta recebedora: {asaasStatus?.merchantConfigured ? 'conexão validada no servidor' : 'aguardando configuração'}</p>
                      <p>Conta compradora: {asaasStatus?.buyerConfigured ? 'conexão validada no servidor' : 'aguardando configuração'}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-gray-950/40"><span className="block text-xs font-semibold uppercase opacity-70">Saldo recebedor</span>{sandboxBalanceLabel(asaasStatus?.merchantBalance)}</div>
                        <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-gray-950/40"><span className="block text-xs font-semibold uppercase opacity-70">Saldo comprador</span>{sandboxBalanceLabel(asaasStatus?.buyerBalance)}</div>
                      </div>
                      {workspace.permissions.manage && (
                        <label className="mt-4 block">
                          <span className="block text-xs font-bold uppercase tracking-wide">Conta de liquidação do PIX</span>
                          <select
                            value={typeof provider.public_config?.settlement_financial_account_id === 'string' ? provider.public_config.settlement_financial_account_id : ''}
                            disabled={working}
                            onChange={(event) => void saveSettlementAccount(provider, event.target.value)}
                            className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800 dark:bg-gray-950 dark:text-white"
                          >
                            <option value="">Selecione uma conta</option>
                            {settlementAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                          </select>
                          <span className="mt-1 block text-xs opacity-80">Essa escolha será a rota autoritativa dos recebimentos Asaas; o sistema não usará uma conta presumida.</span>
                        </label>
                      )}
                    </div>
                  )}
                  {workspace.permissions.manage && <button disabled={working || (provider.provider_code === 'asaas' && !asaasStatus?.merchantConfigured && !provider.enabled)} onClick={() => void toggleProvider(provider)} className="mt-5 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">{provider.enabled ? 'Desativar' : 'Ativar'}</button>}
                </div>
              ))}
              {workspace.permissions.credentials && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900/60 lg:col-span-2">
                  <div className="flex gap-3"><KeyRound className="text-[#19A999]" /><div><h3 className="font-black text-gray-900 dark:text-white">Credenciais ficam fora do banco e do navegador</h3><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">A tela mostra somente se o segredo está configurado. Chaves reais ou Sandbox nunca são retornadas ao frontend.</p></div></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-3">
              {workspace.transactions.length === 0 ? <Empty text="Nenhuma transação online registrada." /> : workspace.transactions.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="font-black text-gray-900 dark:text-white">{item.order_code || item.external_payment_id || 'Transação de laboratório'}</p><p className="text-sm text-gray-500">{item.provider_name} · {paymentMethodLabel(item.method_code)} · {dateTime.format(new Date(item.created_at))}</p></div>
                    <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(item.status)}`}>{statusLabel(item.status)}</span><strong className="text-lg text-gray-900 dark:text-white">{money.format(Number(item.amount))}</strong></div>
                  </div>
                  {item.checkout_url && <a href={item.checkout_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#19A999]">Abrir checkout Sandbox <ExternalLink size={14} /></a>}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'proofs' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                Comprovantes manuais permanecem vinculados ao pedido. Esta área centraliza a fila; a decisão financeira continua auditada no pedido e no Livro Diário.
              </div>
              {workspace.proofs.length === 0 ? <Empty text="Nenhum comprovante enviado." /> : workspace.proofs.map((proof) => (
                <div key={proof.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="font-black text-gray-900 dark:text-white">{proof.order_code || 'Pedido'}</p><p className="text-sm text-gray-500">{proof.original_file_name || 'Comprovante'} · {proof.submitted_at ? dateTime.format(new Date(proof.submitted_at)) : dateTime.format(new Date(proof.created_at))}</p></div>
                    <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(proof.status)}`}>{statusLabel(proof.status)}</span>{proof.declared_amount != null && <strong>{money.format(Number(proof.declared_amount))}</strong>}</div>
                  </div>
                </div>
              ))}
              <Link to="/admin/orders" className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 font-bold text-white">Abrir pedidos para conferência <ExternalLink size={15} /></Link>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-3">
              {!workspace.permissions.events ? <Empty text="Você não possui permissão para visualizar eventos técnicos." /> : workspace.events.length === 0 ? <Empty text="Nenhum webhook ou evento registrado." /> : workspace.events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Webhook className="text-[#19A999]" size={20} /><div><p className="font-black text-gray-900 dark:text-white">{event.event_type}</p><p className="text-sm text-gray-500">{event.provider_code} · {dateTime.format(new Date(event.received_at))}</p></div></div><div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${event.signature_valid === false ? statusTone('failed') : statusTone('paid')}`}>{event.signature_valid === false ? 'Assinatura inválida' : 'Assinatura válida'}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${event.processed ? statusTone('paid') : statusTone('pending')}`}>{event.processed ? 'Processado' : 'Pendente'}</span></div></div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-900 dark:bg-violet-950/30">
                <div className="flex items-start gap-3"><FlaskConical className="text-violet-600" /><div><h2 className="font-black text-violet-950 dark:text-violet-100">OptmaPay Sandbox descartável</h2><p className="mt-1 text-sm text-violet-800 dark:text-violet-200">Gere cenários determinísticos sem banco, adquirente ou dados reais. Estes registros servem apenas para homologação da máquina de estados.</p></div></div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <input value={sandboxAmount} onChange={(e) => setSandboxAmount(e.target.value)} placeholder="42,00" className="rounded-xl border border-violet-200 bg-white px-3 py-2 dark:border-violet-800 dark:bg-gray-950" />
                  <select value={sandboxMethod} onChange={(e) => setSandboxMethod(e.target.value)} className="rounded-xl border border-violet-200 bg-white px-3 py-2 dark:border-violet-800 dark:bg-gray-950"><option value="pix">PIX</option><option value="credit_card">Cartão</option><option value="payment_link">Link</option></select>
                  <select value={sandboxScenario} onChange={(e) => setSandboxScenario(e.target.value as typeof sandboxScenario)} className="rounded-xl border border-violet-200 bg-white px-3 py-2 dark:border-violet-800 dark:bg-gray-950"><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="declined">Recusado</option><option value="expired">Expirado</option></select>
                  <button disabled={working || !workspace.permissions.manage} onClick={() => void createSandboxIntent()} className="rounded-xl bg-violet-600 px-4 py-2 font-bold text-white disabled:opacity-50">Gerar cenário</button>
                </div>
              </div>

              {workspace.transactions.filter((item) => item.provider_code === 'optma_sandbox').slice(0, 12).map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-gray-900 dark:text-white">{item.external_payment_id}</p><p className="text-sm text-gray-500">{paymentMethodLabel(item.method_code)} · {money.format(Number(item.amount))}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(item.status)}`}>{statusLabel(item.status)}</span></div>
                  {workspace.permissions.manage && <div className="mt-4 flex flex-wrap gap-2">{item.status === 'pending' && <><Action label="Aprovar" onClick={() => void simulate(item.id, 'approve')} /><Action label="Recusar" onClick={() => void simulate(item.id, 'decline')} /><Action label="Expirar" onClick={() => void simulate(item.id, 'expire')} /></>}{item.status === 'paid' && <Action label="Estornar" onClick={() => void simulate(item.id, 'refund')} />}</div>}
                </div>
              ))}

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex gap-3"><Landmark className="text-blue-600" /><div><h2 className="font-black text-blue-950 dark:text-blue-100">Asaas Sandbox</h2><p className="mt-1 text-sm text-blue-800 dark:text-blue-200">Conta recebedora: {asaasStatus?.merchantConfigured ? 'conexão pronta' : 'aguardando configuração'} · Conta compradora: {asaasStatus?.buyerConfigured ? 'conexão pronta' : 'aguardando configuração'}.</p></div></div>
                <div className="mt-5 rounded-xl border border-blue-200 bg-white/80 p-4 dark:border-blue-800 dark:bg-gray-950/40">
                  <h3 className="font-black text-blue-950 dark:text-blue-100">Testar PIX integrado</h3>
                  <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">Gere uma cobrança fictícia e pague-a pela conta compradora do Asaas Sandbox. O resultado deve aparecer em Transações e Webhooks e eventos.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <input value={asaasAmount} onChange={(event) => setAsaasAmount(event.target.value)} inputMode="decimal" placeholder="1,00" className="w-32 rounded-xl border border-blue-200 bg-white px-3 py-2 dark:border-blue-800 dark:bg-gray-950" />
                    <button disabled={working || !workspace.permissions.manage || !asaasStatus?.merchantConfigured} onClick={() => void createAsaasPixCharge()} className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Gerar PIX de teste</button>
                    {asaasPixCharge?.qr?.payload && <button disabled={working || !asaasStatus?.buyerConfigured} onClick={() => void payAsaasPixCharge()} className="rounded-xl border border-blue-300 px-4 py-2 font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:text-blue-200">Pagar com conta compradora</button>}
                  </div>
                  {asaasPixCharge?.qr?.encodedImage && (
                    <div className="mt-4 flex items-center gap-4 rounded-xl border border-dashed border-blue-200 p-3 dark:border-blue-800">
                      <img src={`data:image/png;base64,${asaasPixCharge.qr.encodedImage}`} alt="QR Code PIX de teste" className="h-24 w-24 rounded-lg bg-white p-1" />
                      <p className="text-sm text-blue-800 dark:text-blue-200">Cobrança criada. Clique em “Pagar com conta compradora” para concluir este teste fictício.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">{text}</div>;
}

function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-700 hover:border-[#19A999] hover:text-[#19A999] dark:border-gray-700 dark:text-gray-200">{label}</button>;
}
