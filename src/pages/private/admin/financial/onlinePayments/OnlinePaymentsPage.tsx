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
  type OptmaPayCredentialStatus,
  type OptmaPaySandboxPixIntent,
  type OptmaPaySandboxStatus,
  type OnlinePaymentProvider,
  type OnlinePaymentSettlementAccount,
  type OnlinePaymentsWorkspace,
} from '@/services/onlinePaymentsService';
import OnlinePaymentRoutesPanel from './components/OnlinePaymentRoutesPanel';

type Tab = 'overview' | 'providers' | 'routes' | 'transactions' | 'proofs' | 'events' | 'sandbox';

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
  { id: 'routes', label: 'Rotas de recebimento' },
  { id: 'transactions', label: 'Transações' },
  { id: 'proofs', label: 'Comprovantes' },
  { id: 'events', label: 'Webhooks e eventos' },
  { id: 'sandbox', label: 'Laboratório Sandbox' },
];

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    created: 'Criado',
    pending: 'Pendente',
    authorized: 'Autorizado',
    paid: 'Pago',
    failed: 'Falhou',
    expired: 'Expirado',
    cancelled: 'Cancelado',
    partially_refunded: 'Estorno parcial',
    refunded: 'Estornado',
    submitted: 'Aguardando conferência',
    confirmed: 'Confirmado',
    rejected: 'Rejeitado',
    superseded: 'Substituído',
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

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    payment_link: 'Link de pagamento',
    cash: 'Dinheiro',
  };
  return labels[method] || method.replaceAll('_', ' ');
}

export default function OnlinePaymentsPage() {
  const storeId = getActiveStoreId();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [workspace, setWorkspace] = useState<OnlinePaymentsWorkspace | null>(null);
  const [optmaStatus, setOptmaStatus] = useState<OptmaPaySandboxStatus | null>(null);
  const [optmaCredential, setOptmaCredential] = useState<OptmaPayCredentialStatus | null>(null);
  const [settlementAccounts, setSettlementAccounts] = useState<OnlinePaymentSettlementAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [optmaAccountId, setOptmaAccountId] = useState('');
  const [optmaApiKey, setOptmaApiKey] = useState('');
  const [optmaWebhookSecret, setOptmaWebhookSecret] = useState('');
  const [optmaSettlementAccountId, setOptmaSettlementAccountId] = useState('');
  const [optmaAmount, setOptmaAmount] = useState('1,00');
  const [optmaPixIntent, setOptmaPixIntent] = useState<OptmaPaySandboxPixIntent | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await OnlinePaymentsService.getWorkspace(storeId);
      setWorkspace(data);

      const [accountsResult, statusResult] = await Promise.allSettled([
        OnlinePaymentsService.listSettlementAccounts(storeId),
        OnlinePaymentsService.getOptmaPaySandboxStatus(storeId),
      ]);

      setSettlementAccounts(accountsResult.status === 'fulfilled' ? accountsResult.value : []);
      setOptmaStatus(statusResult.status === 'fulfilled' ? statusResult.value : null);

      if (data.permissions.credentials) {
        try {
          const credential = await OnlinePaymentsService.getOptmaPayCredentialStatus(storeId);
          setOptmaCredential(credential);
          setOptmaAccountId(credential.accountId || '');
          setOptmaSettlementAccountId(credential.settlementFinancialAccountId || '');
        } catch {
          setOptmaCredential(null);
        }
      } else {
        setOptmaCredential(null);
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
  const optmaSettlementAccount = useMemo(() => {
    const accountId = optmaCredential?.settlementFinancialAccountId
      || (typeof optmaProvider?.public_config?.settlement_financial_account_id === 'string'
        ? optmaProvider.public_config.settlement_financial_account_id
        : '');
    return accountId ? settlementAccounts.find((account) => account.id === accountId) || null : null;
  }, [optmaCredential?.settlementFinancialAccountId, optmaProvider, settlementAccounts]);
  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || 'Visão geral';

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

  async function saveOptmaCredentials() {
    if (!storeId || !workspace?.permissions.credentials) return;
    if (!optmaAccountId.trim()) {
      toast.warning('Informe o Account ID da conta recebedora no OptmaPay.');
      return;
    }
    if (!optmaSettlementAccountId) {
      toast.warning('Selecione a conta financeira que receberá a liquidação.');
      return;
    }

    setWorking(true);
    try {
      const status = await OnlinePaymentsService.saveOptmaPayCredentials({
        storeId,
        accountId: optmaAccountId.trim(),
        apiKey: optmaApiKey.trim() || undefined,
        webhookSecret: optmaWebhookSecret.trim() || undefined,
        settlementFinancialAccountId: optmaSettlementAccountId,
      });
      setOptmaCredential(status);
      setOptmaApiKey('');
      setOptmaWebhookSecret('');
      toast.success('Credenciais salvas com segurança no Supabase Vault.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar as credenciais.');
    } finally {
      setWorking(false);
    }
  }

  async function testOptmaConnection() {
    if (!storeId) return;
    setWorking(true);
    try {
      const status = await OnlinePaymentsService.getOptmaPaySandboxStatus(storeId);
      setOptmaStatus(status);
      if (status.credentialStatus === 'ready') {
        toast.success(`Conexão OptmaPay validada${status.account?.name ? `: ${status.account.name}` : '.'}`);
      } else {
        toast.warning(status.error || 'A conexão ainda não está pronta.');
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível testar a conexão OptmaPay.');
    } finally {
      setWorking(false);
    }
  }

  async function createOptmaPixIntent() {
    if (!storeId) return;
    const amount = Number(optmaAmount.replace('.', '').replace(',', '.'));
    if (!(amount > 0)) {
      toast.warning('Informe um valor válido para o PIX de teste.');
      return;
    }

    setWorking(true);
    try {
      const result = await OnlinePaymentsService.createOptmaPaySandboxPix({
        storeId,
        amount,
        description: 'PIX Sandbox de homologação OptmaMenu',
      });
      setOptmaPixIntent(result);
      toast.success('Instrução PIX OptmaPay criada. Pague-a no banco Sandbox para testar o webhook.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o PIX OptmaPay.');
    } finally {
      setWorking(false);
    }
  }

  async function copyText(value?: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Código copiado.');
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
    }
  }

  if (!storeId) {
    return <PageContainer title="Pagamentos online" category="Financeiro"><div className="rounded-2xl border p-6">Selecione uma loja.</div></PageContainer>;
  }

  return (
    <PageContainer
      title="Pagamentos online"
      category="FINANCEIRO"
      subtitle="Configure provedores, rotas de recebimento, transações, comprovantes e webhooks."
      icon={<CreditCard className="text-[#19A999]" size={28} />}
      onRefresh={() => void load()}
    >
      <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 shrink-0" size={20} />
          <div>
            <p className="font-bold">Ambiente de homologação</p>
            <p className="text-sm opacity-90">Use somente contas, CPF/CNPJ e cartões fictícios de Sandbox. Nenhuma chave de API deve aparecer nesta tela, no Git ou em logs.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        <label className="block sm:hidden">
          <span className="mb-1 block text-xs font-black uppercase tracking-widest text-gray-400">Seção</span>
          <select value={activeTab} onChange={(event) => setActiveTab(event.target.value as Tab)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-white" aria-label={`Seção atual: ${activeTabLabel}`}>
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.label}{tab.id === 'proofs' && workspace?.counts.proofs_pending ? ` (${workspace.counts.proofs_pending})` : ''}</option>
            ))}
          </select>
        </label>
        <div className="hidden flex-wrap gap-2 sm:flex">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-[#19A999] text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}>
              {tab.label}{tab.id === 'proofs' && workspace?.counts.proofs_pending ? ` (${workspace.counts.proofs_pending})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"><RefreshCw className="animate-spin text-[#19A999]" /></div>
      ) : !workspace ? null : (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {summaryCards.map(({ label, value, Icon, tone }) => (
                  <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
                    <Icon className={tone} size={22} />
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="text-3xl font-black text-gray-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Configuração da loja online</h2>
                <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
                  <p className="font-black">QR Code PIX gera recebimento em: {optmaSettlementAccount?.name || 'conta ainda não definida'}</p>
                  <p className="mt-1 text-xs font-semibold opacity-80">As demais formas usam as Rotas de recebimento. Configure o destino por delivery, retirada, pagamento antecipado ou pagamento no recebimento.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setActiveTab('providers')} className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-black text-white">Alterar provedor</button>
                    <button type="button" onClick={() => setActiveTab('routes')} className="rounded-lg border border-teal-300 px-3 py-2 text-xs font-black text-teal-800 dark:border-teal-700 dark:text-teal-100">Configurar rotas</button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
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
                <div key={provider.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      {provider.provider_code === 'optma_sandbox'
                        ? <Landmark className="text-violet-600" />
                        : <FlaskConical className="text-amber-600" />}
                      <div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">{provider.display_name}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {provider.provider_code === 'optma_sandbox' ? 'Banco Sandbox externo · dinheiro real: não' : 'Integração legada em retirada'}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${provider.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                      {provider.enabled ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-950">
                      <p className="text-xs uppercase text-gray-500">Credencial</p>
                      <p className="mt-1 font-bold text-gray-900 dark:text-white">{credentialLabel(provider.credential_status)}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-950">
                      <p className="text-xs uppercase text-gray-500">Padrão</p>
                      <p className="mt-1 font-bold text-gray-900 dark:text-white">{provider.is_default ? 'Sim' : 'Não'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {Object.entries(provider.capabilities || {})
                      .filter(([, value]) => value)
                      .map(([key]) => (
                        <span key={key} className="rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                          {capabilityLabel(key)}
                        </span>
                      ))}
                  </div>

                  {provider.provider_code === 'optma_sandbox' ? (
                    <div className="mt-5 space-y-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
                      <div>
                        <p className="font-black">Conexão OptmaPay Sandbox</p>
                        <p className="mt-1 text-xs opacity-80">
                          Status: {optmaStatus?.credentialStatus === 'ready' ? 'conexão validada' : optmaStatus?.error || 'aguardando credenciais válidas'}.
                        </p>
                        {optmaStatus?.account?.name && (
                          <p className="mt-1 text-xs font-semibold">Conta: {optmaStatus.account.name}</p>
                        )}
                      </div>

                      {workspace.permissions.credentials && (
                        <div className="space-y-3 rounded-xl bg-white/80 p-4 dark:bg-gray-950/40">
                          <div className="rounded-lg border border-violet-200 bg-violet-100/70 p-3 text-xs dark:border-violet-800 dark:bg-violet-950/50">
                            <p className="font-black">Webhook a cadastrar no OptmaPay</p>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                              <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-2 text-[11px] text-gray-800 dark:bg-gray-950 dark:text-gray-100">
                                {optmaCredential?.webhookUrl || 'Carregando endpoint...'}
                              </code>
                              <button type="button" disabled={!optmaCredential?.webhookUrl} onClick={() => void copyText(optmaCredential?.webhookUrl)} className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-black disabled:opacity-50 dark:border-violet-700">
                                Copiar
                              </button>
                            </div>
                          </div>

                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-wide">Account ID OptmaPay</span>
                            <input value={optmaAccountId} onChange={(event) => setOptmaAccountId(event.target.value)} placeholder="UUID da conta recebedora" autoComplete="off" className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-violet-800 dark:bg-gray-950 dark:text-white" />
                          </label>

                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-wide">API key Sandbox</span>
                            <input type="password" value={optmaApiKey} onChange={(event) => setOptmaApiKey(event.target.value)} placeholder={optmaCredential?.apiKeyConfigured ? 'Já configurada — deixe vazio para preservar' : 'sk_test_optmapay_...'} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-violet-800 dark:bg-gray-950 dark:text-white" />
                          </label>

                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-wide">Webhook secret</span>
                            <input type="password" value={optmaWebhookSecret} onChange={(event) => setOptmaWebhookSecret(event.target.value)} placeholder={optmaCredential?.webhookSecretConfigured ? 'Já configurado — deixe vazio para preservar' : 'whsec_optmapay_...'} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-violet-800 dark:bg-gray-950 dark:text-white" />
                          </label>

                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-wide">Conta financeira de liquidação</span>
                            <select value={optmaSettlementAccountId} onChange={(event) => setOptmaSettlementAccountId(event.target.value)} className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold text-gray-900 dark:border-violet-800 dark:bg-gray-950 dark:text-white">
                              <option value="">Selecione uma conta</option>
                              {settlementAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                            </select>
                          </label>

                          <p className="text-xs opacity-80">
                            Os segredos são enviados somente à Edge Function autenticada e persistidos criptografados no Supabase Vault. Eles não são devolvidos a esta tela.
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={working} onClick={() => void saveOptmaCredentials()} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                              Salvar credenciais no Vault
                            </button>
                            <button type="button" disabled={working || !optmaCredential?.apiKeyConfigured} onClick={() => void testOptmaConnection()} className="rounded-lg border border-violet-300 px-4 py-2 text-xs font-black disabled:opacity-50 dark:border-violet-700">
                              Testar conexão
                            </button>
                          </div>
                        </div>
                      )}

                      {workspace.permissions.manage && (
                        <button disabled={working} onClick={() => void toggleProvider(provider)} className="rounded-xl border border-violet-300 px-4 py-2 text-sm font-bold disabled:opacity-50 dark:border-violet-700">
                          {provider.enabled ? 'Desativar OptmaPay' : 'Ativar OptmaPay'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                      <p className="font-black">Asaas é somente legado</p>
                      <p className="mt-1 text-xs opacity-80">Não são criadas novas credenciais, cobranças ou testes Asaas. A integração será removida depois da homologação do OptmaPay.</p>
                      {workspace.permissions.manage && provider.enabled && (
                        <button disabled={working} onClick={() => void toggleProvider(provider)} className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-xs font-black disabled:opacity-50 dark:border-amber-700">
                          Desativar legado
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {workspace.permissions.credentials && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900/60 lg:col-span-2">
                  <div className="flex gap-3">
                    <KeyRound className="text-[#19A999]" />
                    <div>
                      <h3 className="font-black text-gray-900 dark:text-white">Credenciais protegidas no Vault</h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">API key e segredo HMAC são gravados no Supabase Vault e nunca são retornados ao navegador depois do salvamento.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'routes' && <OnlinePaymentRoutesPanel storeId={storeId} canManage={workspace.permissions.manage} />}

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
              <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">Comprovantes manuais permanecem vinculados ao pedido. Esta área centraliza a fila; a decisão financeira continua auditada no pedido e no Livro Diário.</div>
              {workspace.proofs.length === 0 ? <Empty text="Nenhum comprovante enviado." /> : workspace.proofs.map((proof) => (
                <div key={proof.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-gray-900 dark:text-white">{proof.order_code || 'Pedido'}</p><p className="text-sm text-gray-500">{proof.original_file_name || 'Comprovante'} · {proof.submitted_at ? dateTime.format(new Date(proof.submitted_at)) : dateTime.format(new Date(proof.created_at))}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(proof.status)}`}>{statusLabel(proof.status)}</span>{proof.declared_amount != null && <strong>{money.format(Number(proof.declared_amount))}</strong>}</div></div>
                </div>
              ))}
              <Link to="/admin/orders" className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 font-bold text-white">Abrir pedidos para conferência <ExternalLink size={15} /></Link>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-3">
              {!workspace.permissions.events ? <Empty text="Você não possui permissão para visualizar eventos técnicos." /> : workspace.events.length === 0 ? <Empty text="Nenhum webhook ou evento registrado." /> : workspace.events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Webhook className="text-[#19A999]" size={20} /><div><p className="font-black text-gray-900 dark:text-white">{event.event_type}</p><p className="text-sm text-gray-500">{event.provider_code} · {dateTime.format(new Date(event.received_at))}</p></div></div><div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${event.signature_valid === false ? statusTone('failed') : statusTone('paid')}`}>{event.signature_valid === false ? 'Assinatura inválida' : 'Assinatura válida'}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${event.processed ? statusTone('paid') : statusTone('pending')}`}>{event.processed ? 'Processado' : 'Pendente'}</span></div></div></div>
              ))}
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-900 dark:bg-violet-950/30">
                <div className="flex items-start gap-3">
                  <Landmark className="text-violet-600" />
                  <div>
                    <h2 className="font-black text-violet-950 dark:text-violet-100">OptmaPay Sandbox integrado</h2>
                    <p className="mt-1 text-sm text-violet-800 dark:text-violet-200">
                      Este laboratório usa o banco fictício externo, HMAC real de webhook e a mesma infraestrutura de intents/eventos do OptmaMenu. Nenhum dinheiro real é movimentado.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/80 p-3 dark:bg-gray-950/40">
                    <p className="text-xs font-bold uppercase opacity-60">Conexão</p>
                    <p className="mt-1 font-black">{optmaStatus?.credentialStatus === 'ready' ? 'Pronta' : 'Pendente'}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 dark:bg-gray-950/40">
                    <p className="text-xs font-bold uppercase opacity-60">Ambiente</p>
                    <p className="mt-1 font-black">Sandbox</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 dark:bg-gray-950/40">
                    <p className="text-xs font-bold uppercase opacity-60">Dinheiro real</p>
                    <p className="mt-1 font-black">Não</p>
                  </div>
                </div>

                {optmaStatus?.error && (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    {optmaStatus.error}
                  </div>
                )}

                <div className="mt-5 rounded-xl border border-violet-200 bg-white/80 p-4 dark:border-violet-800 dark:bg-gray-950/40">
                  <h3 className="font-black text-violet-950 dark:text-violet-100">Golden PIX</h3>
                  <p className="mt-1 text-sm text-violet-800 dark:text-violet-200">
                    Gere uma instrução e pague no OptmaPay. O evento <code>pix.paid</code> deverá retornar assinado ao OptmaMenu.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input value={optmaAmount} onChange={(event) => setOptmaAmount(event.target.value)} inputMode="decimal" placeholder="1,00" className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 dark:border-violet-800 dark:bg-gray-950 sm:w-36" />
                    <button disabled={working || !workspace.permissions.manage || optmaStatus?.credentialStatus !== 'ready' || !optmaProvider?.enabled} onClick={() => void createOptmaPixIntent()} className="rounded-xl bg-violet-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      Gerar PIX OptmaPay
                    </button>
                    <button disabled={working} onClick={() => void testOptmaConnection()} className="rounded-xl border border-violet-300 px-4 py-2 font-bold text-violet-800 disabled:opacity-50 dark:border-violet-700 dark:text-violet-100">
                      Testar conexão
                    </button>
                  </div>

                  {optmaPixIntent?.intent?.pix_payload && (
                    <div className="mt-4 space-y-3 rounded-xl border border-violet-200 p-3 dark:border-violet-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase opacity-60">Referência</p>
                          <p className="break-all font-mono text-xs">{optmaPixIntent.intent.external_reference}</p>
                        </div>
                        <strong>{money.format(Number(optmaPixIntent.intent.amount))}</strong>
                      </div>
                      <textarea readOnly value={optmaPixIntent.intent.pix_payload} rows={4} className="w-full resize-none rounded-lg border border-violet-200 bg-white p-3 font-mono text-xs text-gray-900 dark:border-violet-800 dark:bg-gray-950 dark:text-white" />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void copyText(optmaPixIntent.intent?.pix_payload)} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white">
                          Copiar código PIX
                        </button>
                        <a href="https://optmapay.optmaidea.com.br" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-violet-300 px-3 py-2 text-xs font-black text-violet-800 dark:border-violet-700 dark:text-violet-100">
                          Abrir OptmaPay <ExternalLink size={13} />
                        </a>
                      </div>
                      <p className="text-xs opacity-70">Expira em {dateTime.format(new Date(optmaPixIntent.intent.expires_at))}. Depois do pagamento, atualize esta tela para conferir evento e transação.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="font-black text-gray-900 dark:text-white">Eventos recentes do OptmaPay</h3>
                <div className="mt-3 space-y-2">
                  {workspace.events.filter((event) => event.provider_code === 'optma_sandbox').slice(0, 8).map((event) => (
                    <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-950">
                      <div>
                        <p className="font-black">{event.event_type}</p>
                        <p className="text-xs text-gray-500">{dateTime.format(new Date(event.received_at))}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${event.signature_valid === false ? statusTone('failed') : statusTone('paid')}`}>
                          {event.signature_valid === false ? 'Assinatura inválida' : 'Assinatura válida'}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${event.processed ? statusTone('paid') : statusTone('pending')}`}>
                          {event.processed ? 'Processado' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {workspace.events.filter((event) => event.provider_code === 'optma_sandbox').length === 0 && (
                    <p className="text-sm text-gray-500">Nenhum webhook OptmaPay recebido ainda.</p>
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
