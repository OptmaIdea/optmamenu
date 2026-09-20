import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  Ban,
  ClipboardList,
  Coins,
  Edit3,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Tags,
  UserRound,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Customers360Service,
  type Customer360,
  type Customer360Consent,
  type Customer360Order,
  type CustomerDeletionAuditItem,
} from '@/services/customers360Service';
import { getShortDocumentReference } from '@/utils/documentReference';
import { supabase } from '@/lib/supabase';
import { systemConfirm } from '@/components/common/SystemDialogProvider';
import { toast } from 'sonner';
import CustomerTimelineSection from './CustomerTimelineSection';

function formatCurrency(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

function sourceLabel(source?: string | null) {
  const labels: Record<string, string> = {
    admin: 'Cadastro administrativo',
    public_store: 'Loja pública',
    whatsapp: 'WhatsApp',
    qr_table: 'QR/Mesa',
    direct_sale: 'Venda direta',
    import: 'Importado',
    other: 'Outro',
  };
  return labels[source || ''] || 'Outro';
}

function consentSourceLabel(source?: string | null) {
  const labels: Record<string, string> = {
    admin_recorded: 'Registrado no administrativo',
    customer_portal: 'Portal do cliente',
    customer_portal_profile: 'Perfil do cliente',
    public_store: 'Loja pública',
    whatsapp: 'WhatsApp',
    qr_table: 'QR/Mesa',
  };
  return labels[source || ''] || source || 'Origem não informada';
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    pending: 'Pendente',
    confirmed: 'Confirmado',
    preparing: 'Em preparo',
    ready: 'Pronto',
    out_for_delivery: 'Saiu para entrega',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    rejected: 'Recusado',
    expired: 'Expirado',
  };
  return labels[status || ''] || status || 'Não informado';
}

function consentLabel(type?: string | null) {
  const labels: Record<string, string> = {
    terms_of_use: 'Termos de uso',
    privacy_policy: 'Política de privacidade',
    loyalty_program: 'Fidelidade',
    marketing_whatsapp: 'Marketing por WhatsApp',
    marketing_email: 'Marketing por e-mail',
    marketing_sms: 'Marketing por SMS',
  };
  return labels[type || ''] || type || 'Consentimento';
}

function shortOrderReference(order?: Pick<Customer360Order, 'id' | 'order_code'> | null) {
  return getShortDocumentReference(order?.order_code || order?.id, { fallbackLabel: 'Pedido' });
}

function latestConsent(consents: Customer360Consent[], type: string) {
  return consents.find((consent) => consent.consent_type === type) || null;
}

function isGranted(consent?: Customer360Consent | null) {
  return consent?.action === 'granted';
}

export default function CustomerLifecyclePage() {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const { storeId, loading: loadingStore } = useCurrentStore();
  const { hasPermission } = usePermissions(storeId ?? null);
  const canManageCustomers = hasPermission('customers.manage');
  const [data, setData] = useState<Customer360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletedAudit, setDeletedAudit] = useState<CustomerDeletionAuditItem | null>(null);
  const [loyaltyMembershipBlocked, setLoyaltyMembershipBlocked] = useState(false);
  const [loyaltyMembershipReason, setLoyaltyMembershipReason] = useState<string | null>(null);
  const [loyaltyMembershipLoading, setLoyaltyMembershipLoading] = useState(false);
  const [loyaltyBanReason, setLoyaltyBanReason] = useState('Descumprimento dos termos do programa de fidelidade');

  useEffect(() => {
    if (loadingStore || !storeId || !customerId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setDeletedAudit(null);
    setData(null);

    void (async () => {
      try {
        const result = await Customers360Service.getCustomer360(storeId, customerId);
        if (active) setData(result);
      } catch (err: unknown) {
        try {
          const deletions = await Customers360Service.getDeletionHistory(storeId, customerId, 1);
          if (!active) return;
          if (deletions.length > 0) {
            setDeletedAudit(deletions[0]);
            setError(null);
            return;
          }
        } catch (historyError) {
          console.error('Erro ao verificar histórico de exclusão do cliente:', historyError);
        }

        if (active) {
          const rawMessage = err instanceof Error ? err.message : '';
          setError(
            rawMessage === 'customer_not_found'
              ? 'Cliente não encontrado ou cadastro não está mais ativo.'
              : rawMessage || 'Erro ao carregar Vida do Cliente.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [customerId, loadingStore, storeId]);

  useEffect(() => {
    if (loadingStore || !storeId || !customerId) return;
    let active = true;

    void supabase.rpc('get_admin_customer_loyalty_membership_safe', {
      p_store_id: storeId,
      p_customer_id: customerId,
    }).then(({ data: result, error: membershipError }) => {
      if (!active || membershipError || !result?.ok) return;
      setLoyaltyMembershipBlocked(Boolean(result.blocked));
      setLoyaltyMembershipReason(result.reason ? String(result.reason) : null);
    });

    return () => {
      active = false;
    };
  }, [customerId, loadingStore, storeId]);

  const totalCompletedOrders = useMemo(
    () => (data?.orders || []).filter((order) => order.status === 'completed').length,
    [data],
  );

  const orderMap = useMemo(
    () => new Map((data?.orders || []).map((order) => [order.id, order])),
    [data],
  );

  const currentConsents = useMemo(() => {
    const consents = data?.consents || [];
    return {
      terms: latestConsent(consents, 'terms_of_use'),
      privacy: latestConsent(consents, 'privacy_policy'),
      loyalty: latestConsent(consents, 'loyalty_program'),
      whatsapp: latestConsent(consents, 'marketing_whatsapp'),
      email: latestConsent(consents, 'marketing_email'),
      sms: latestConsent(consents, 'marketing_sms'),
    };
  }, [data?.consents]);

  if (loadingStore || loading) {
    return (
      <div className="p-6">
        <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <Loader2 className="animate-spin" size={20} />
            Carregando Vida do Cliente...
          </div>
        </div>
      </div>
    );
  }

  if (deletedAudit && storeId && customerId) {
    const executed = deletedAudit.status === 'executed';
    return (
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <button
          type="button"
          onClick={() => navigate('/admin/customers')}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={16} />
          Voltar para clientes
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-gray-900">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <ShieldCheck size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Registro preservado de privacidade
              </p>
              <h1 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">
                {executed ? 'Conta excluída a pedido do titular' : 'Exclusão de conta registrada'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {executed
                  ? 'O cadastro ativo e as credenciais foram removidos. Esta página antiga não representa mais um cliente ativo; permanece apenas a trilha mínima de auditoria permitida.'
                  : 'Existe uma solicitação de exclusão para este cadastro. Consulte o histórico administrativo para acompanhar o processamento.'}
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950">
                  <p className="text-xs font-bold uppercase text-gray-500">Solicitada em</p>
                  <p className="mt-1 font-black text-gray-900 dark:text-white">{formatDateTime(deletedAudit.requested_at)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950">
                  <p className="text-xs font-bold uppercase text-gray-500">{executed ? 'Concluída em' : 'Status'}</p>
                  <p className="mt-1 font-black text-gray-900 dark:text-white">
                    {executed ? formatDateTime(deletedAudit.executed_at) : deletedAudit.status}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Referência técnica: {customerId.slice(0, 8)}… · nenhum dado pessoal apagado é reexibido nesta tela.
              </p>

              <button
                type="button"
                onClick={() => navigate('/admin/customers?tab=history')}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#178f82]"
              >
                <ClipboardList size={17} />
                Ver histórico de clientes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.customer || !storeId || !customerId) {
    return (
      <div className="p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error || 'Cliente não encontrado.'}
        </div>
      </div>
    );
  }

  const customer = data.customer;
  const isProtected = customer.data_ownership === 'customer_owned' || customer.editable_by_store === false;
  const canSeeSensitive = Boolean(data.sensitive_data_visible || customer.sensitive_data_visible);

  const updateLoyaltyMembership = async (action: 'remove' | 'ban' | 'unban') => {
    const descriptions = {
      remove: 'O saldo, o extrato, os vouchers e os dados operacionais de fidelidade deste cliente serão apagados permanentemente. Ele poderá aderir novamente depois.',
      ban: 'O saldo, o extrato e os vouchers serão apagados permanentemente e o CPF ficará impedido de ingressar novamente até que a loja retire o bloqueio.',
      unban: 'O CPF voltará a poder aderir ao programa. Os dados apagados anteriormente não serão restaurados.',
    };

    const confirmed = await systemConfirm({
      title: action === 'ban'
        ? 'Banir cliente da fidelidade?'
        : action === 'remove'
          ? 'Remover cliente da fidelidade?'
          : 'Liberar CPF para fidelidade?',
      description: descriptions[action],
      confirmLabel: action === 'ban' ? 'Banir e apagar dados' : action === 'remove' ? 'Remover e apagar dados' : 'Liberar CPF',
      cancelLabel: 'Cancelar',
      tone: action === 'unban' ? 'default' : 'danger',
    });
    if (!confirmed) return;

    setLoyaltyMembershipLoading(true);
    try {
      const { data: result, error: actionError } = await supabase.rpc('admin_set_customer_loyalty_membership_safe', {
        p_store_id: storeId,
        p_customer_id: customerId,
        p_action: action,
        p_reason: action === 'ban' ? loyaltyBanReason.trim() || null : null,
      });
      if (actionError || !result?.ok) {
        throw new Error(result?.error || actionError?.message || 'Não foi possível atualizar a participação.');
      }

      const blocked = action === 'ban' ? true : action === 'unban' ? false : loyaltyMembershipBlocked;
      setLoyaltyMembershipBlocked(blocked);
      setLoyaltyMembershipReason(action === 'ban' ? loyaltyBanReason.trim() || null : action === 'unban' ? null : loyaltyMembershipReason);

      if (action === 'ban' || action === 'remove') {
        setData((current) => current ? {
          ...current,
          customer: {
            ...current.customer,
            loyalty_opt_in: false,
            loyalty_points: 0,
            loyalty_tier: 'Bronze',
          },
          loyalty_transactions: [],
        } : current);
      }

      toast.success(
        action === 'ban'
          ? 'Cliente banido do programa e dados de fidelidade apagados.'
          : action === 'remove'
            ? 'Cliente removido do programa e dados de fidelidade apagados.'
            : 'CPF liberado para nova adesão ao programa.',
      );
    } catch (membershipError) {
      toast.error(membershipError instanceof Error ? membershipError.message : 'Não foi possível atualizar a fidelidade.');
    } finally {
      setLoyaltyMembershipLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => navigate('/admin/customers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-300"
        >
          <ArrowLeft size={16} />
          Voltar para clientes
        </button>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
              <UserRound size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                {customer.full_name || 'Cliente sem nome'}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {customer.phone}{customer.email ? ` • ${customer.email}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {sourceLabel(customer.source)}
                </span>
                {isProtected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                    <ShieldCheck size={13} />
                    Dados do cliente protegidos
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <Edit3 size={13} />
                    Cadastro da loja
                  </span>
                )}
              </div>
            </div>
          </div>

          {canManageCustomers && (
            <button
              type="button"
              onClick={() => navigate(`/admin/customers/${customer.id}/edit`)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-5 py-3 text-sm font-black text-gray-800 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <Edit3 size={18} />
              {isProtected ? 'Campos internos' : 'Editar cliente'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Summary icon={<ClipboardList size={17} />} label="Pedidos vinculados" value={String(customer.total_orders || data.orders.length)} note={`${totalCompletedOrders} concluídos`} />
        <Summary icon={<BadgeDollarSign size={17} />} label="Total gasto" value={formatCurrency(customer.total_spent || 0)} />
        <Summary
          icon={<Coins size={17} />}
          label="Pontos"
          value={String(customer.loyalty_points || 0)}
          note={`${customer.current_tier_name || customer.loyalty_tier || 'Bronze'} · ${customer.loyalty_opt_in ? 'adesão ativa' : 'sem adesão'}`}
          accent
        />
        <Summary icon={<CalendarClock size={17} />} label="Última compra" value={formatDateTime(customer.last_order_at)} small />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CustomerTimelineSection storeId={storeId} customerId={customerId} />

          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Pedidos do cliente</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Somente pedidos vinculados de forma confirmada ao cadastro.</p>
              </div>
              <span className="text-xs font-black text-gray-400">{data.orders.length} registro(s)</span>
            </div>
            <div className="mt-4 space-y-3">
              {data.orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders?orderId=${order.id}`}
                  title={order.order_code || order.id}
                  className="block rounded-2xl border border-gray-100 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-gray-800 dark:hover:border-emerald-900/60 dark:hover:bg-emerald-950/10"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-black text-gray-900 dark:text-white">{shortOrderReference(order)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(order.created_at)}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-black text-gray-900 dark:text-white">{formatCurrency(order.total)}</p>
                      <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{statusLabel(order.status)}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {!data.orders.length && <Empty text="Nenhum pedido confirmado está vinculado a este cadastro." />}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Histórico de fidelidade</h2>
            <div className="mt-4 space-y-3">
              {data.loyalty_transactions.map((transaction) => {
                const order = transaction.order_id ? orderMap.get(transaction.order_id) || null : null;
                const content = (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">
                        {order ? `Pontos do ${shortOrderReference(order)}` : (transaction.description || 'Movimentação de fidelidade')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(transaction.created_at)}</p>
                    </div>
                    <p className={`font-black ${Number(transaction.points) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {Number(transaction.points) >= 0 ? '+' : ''}{transaction.points} pts
                    </p>
                  </div>
                );
                return order ? (
                  <Link key={transaction.id} to={`/admin/orders?orderId=${order.id}`} title={order.order_code || order.id} className="block transition hover:opacity-90">
                    {content}
                  </Link>
                ) : (
                  <div key={transaction.id}>{content}</div>
                );
              })}
              {!data.loyalty_transactions.length && <Empty text="Nenhuma movimentação de fidelidade." />}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <Aside title="Gestão da fidelidade" icon={<ShieldCheck size={18} className="text-emerald-600" />}>
            <div className="space-y-3">
              <div className={`rounded-2xl p-3 text-sm font-bold ${loyaltyMembershipBlocked ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-200'}`}>
                {loyaltyMembershipBlocked
                  ? `CPF bloqueado para nova adesão${loyaltyMembershipReason ? `: ${loyaltyMembershipReason}` : '.'}`
                  : customer.loyalty_opt_in
                    ? `Participação ativa · ${customer.loyalty_points || 0} pts`
                    : 'Cliente fora do programa; pode aderir novamente.'}
              </div>

              {canManageCustomers && (
                <>
                  {!loyaltyMembershipBlocked && (
                    <input
                      value={loyaltyBanReason}
                      onChange={(event) => setLoyaltyBanReason(event.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      placeholder="Motivo do bloqueio"
                    />
                  )}
                  <div className="grid gap-2">
                    {customer.loyalty_opt_in && !loyaltyMembershipBlocked && (
                      <button
                        type="button"
                        disabled={loyaltyMembershipLoading}
                        onClick={() => void updateLoyaltyMembership('remove')}
                        className="rounded-xl border border-amber-200 px-3 py-2 text-sm font-black text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900/50 dark:text-amber-300"
                      >
                        Remover da fidelidade
                      </button>
                    )}
                    {!loyaltyMembershipBlocked ? (
                      <button
                        type="button"
                        disabled={loyaltyMembershipLoading}
                        onClick={() => void updateLoyaltyMembership('ban')}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white disabled:opacity-50"
                      >
                        <Ban size={15} /> Banir CPF da fidelidade
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={loyaltyMembershipLoading}
                        onClick={() => void updateLoyaltyMembership('unban')}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-50"
                      >
                        Liberar CPF para nova adesão
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] leading-5 text-gray-500 dark:text-gray-400">
                    Remover permite nova adesão. Banir grava um bloqueio por CPF; a loja precisa liberar explicitamente antes de uma nova participação.
                  </p>
                </>
              )}
            </div>
          </Aside>

          <Aside title="Tags" icon={<Tags size={18} className="text-emerald-600" />}>
            {customer.tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {customer.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sem tags cadastradas.</p>
            )}
          </Aside>

          <Aside title="Observações internas">
            <p className="text-sm text-gray-500 dark:text-gray-400">{customer.internal_notes || 'Nenhuma observação interna.'}</p>
          </Aside>

          <Aside title="Endereços" icon={<MapPin size={18} className="text-emerald-600" />}>
            {canSeeSensitive ? (
              data.addresses.length ? (
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                  {data.addresses.map((address) => (
                    <p key={address.id}>{address.street}, {address.number} — {address.city}/{address.state}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum endereço cadastrado.</p>
              )
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Dados ocultos pela permissão customers.sensitive.view.</p>
            )}
          </Aside>

          <Aside title="Consentimentos" icon={<ShieldCheck size={18} className="text-emerald-600" />}>
            {canSeeSensitive ? (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Estado atual</p>
                  <div className="space-y-2">
                    <ConsentStateRow label="Termos de uso" consent={currentConsents.terms} />
                    <ConsentStateRow label="Política de privacidade" consent={currentConsents.privacy} />
                    <ConsentStateRow label="Programa de fidelidade" consent={currentConsents.loyalty} icon={<Coins size={14} />} />
                    <ConsentStateRow label="WhatsApp" consent={currentConsents.whatsapp} icon={<MessageCircle size={14} />} />
                    <ConsentStateRow label="E-mail" consent={currentConsents.email} icon={<Mail size={14} />} />
                    <ConsentStateRow label="SMS" consent={currentConsents.sms} icon={<Smartphone size={14} />} />
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-bold text-gray-600 dark:text-gray-300">Marketing em algum canal</span>
                    <span className={`rounded-full px-2.5 py-1 font-black ${customer.marketing_consent ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                      {customer.marketing_consent ? 'Ativo' : 'Sem adesão'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Histórico recente</p>
                  {data.consents.length ? (
                    <div className="space-y-2">
                      {data.consents.slice(0, 8).map((consent) => (
                        <div key={consent.id} className="rounded-xl border border-gray-100 p-3 text-xs dark:border-gray-800">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-black text-gray-900 dark:text-white">{consentLabel(consent.consent_type)}</p>
                            <span className={`rounded-full px-2 py-0.5 font-black ${isGranted(consent) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200'}`}>
                              {isGranted(consent) ? 'Concedido' : 'Revogado'}
                            </span>
                          </div>
                          <p className="mt-1 text-gray-500 dark:text-gray-400">
                            {formatDateTime(consent.created_at)} · {consentSourceLabel(consent.source)}
                          </p>
                          {(consent.terms_version || consent.privacy_version) && (
                            <p className="mt-1 text-[10px] text-gray-400">
                              {consent.terms_version ? `Termos ${consent.terms_version}` : ''}
                              {consent.terms_version && consent.privacy_version ? ' · ' : ''}
                              {consent.privacy_version ? `Privacidade ${consent.privacy_version}` : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum consentimento registrado.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Histórico restrito pela permissão customers.sensitive.view.</p>
            )}
          </Aside>
        </aside>
      </div>
    </div>
  );
}

function Summary({
  icon,
  label,
  value,
  note,
  accent = false,
  small = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}
        <p className="text-xs font-bold uppercase">{label}</p>
      </div>
      <p className={`mt-2 font-black ${small ? 'text-sm' : 'text-2xl'} ${accent ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</p>}
    </div>
  );
}

function Aside({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-black text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ConsentStateRow({
  label,
  consent,
  icon,
}: {
  label: string;
  consent?: Customer360Consent | null;
  icon?: React.ReactNode;
}) {
  const granted = isGranted(consent);
  const hasEvent = Boolean(consent);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2 dark:border-gray-800">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-gray-400">{icon || <ShieldCheck size={14} />}</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-gray-800 dark:text-gray-100">{label}</p>
          {consent && (
            <p className="truncate text-[10px] text-gray-400" title={consentSourceLabel(consent.source)}>
              {formatDateTime(consent.created_at)}
            </p>
          )}
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${
          !hasEvent
            ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            : granted
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200'
        }`}
      >
        {!hasEvent ? null : granted ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
        {!hasEvent ? 'Sem registro' : granted ? 'Ativo' : 'Revogado'}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
      {text}
    </div>
  );
}
