import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeDollarSign, CalendarClock, ClipboardList, Coins, Edit3, Loader2, MapPin, ShieldCheck, Tags, UserRound } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Customers360Service, type Customer360, type Customer360Order } from '@/services/customers360Service';

function formatCurrency(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

function sourceLabel(source?: string | null) {
  const labels: Record<string, string> = {
    admin: 'Cadastro administrativo', public_store: 'Loja pública', whatsapp: 'WhatsApp',
    qr_table: 'QR/Mesa', direct_sale: 'Venda direta', import: 'Importado', other: 'Outro',
  };
  return labels[source || ''] || 'Outro';
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: 'Rascunho', pending: 'Pendente', confirmed: 'Confirmado', preparing: 'Em preparo',
    ready: 'Pronto', completed: 'Concluído', cancelled: 'Cancelado', rejected: 'Recusado',
  };
  return labels[status || ''] || status || 'Não informado';
}

function shortOrderReference(order?: Pick<Customer360Order, 'id' | 'order_code'> | null) {
  const source = order?.order_code || order?.id || '';
  const compact = source.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return compact ? `Pedido #${compact}` : 'Pedido';
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

  useEffect(() => {
    if (loadingStore || !storeId || !customerId) return;
    let active = true;
    setLoading(true);
    Customers360Service.getCustomer360(storeId, customerId)
      .then((result) => { if (active) setData(result); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Erro ao carregar Vida do Cliente.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId, loadingStore, storeId]);

  const totalCompletedOrders = useMemo(() => (data?.orders || []).filter((order) => order.status === 'completed').length, [data]);
  const orderMap = useMemo(() => new Map((data?.orders || []).map((order) => [order.id, order])), [data]);

  if (loadingStore || loading) return <div className="p-6"><div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900"><div className="flex items-center gap-3 text-gray-600 dark:text-gray-300"><Loader2 className="animate-spin" size={20} />Carregando Vida do Cliente...</div></div></div>;
  if (error || !data?.customer) return <div className="p-6"><div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">{error || 'Cliente não encontrado.'}</div></div>;

  const customer = data.customer;
  const isProtected = customer.data_ownership === 'customer_owned' || customer.editable_by_store === false;

  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <button type="button" onClick={() => navigate('/admin/customers')} className="inline-flex items-center gap-2 text-sm font-bold text-gray-600"><ArrowLeft size={16} />Voltar para clientes</button>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700"><UserRound size={28} /></div><div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">{customer.full_name || 'Cliente sem nome'}</h1>
          <p className="mt-1 text-sm text-gray-500">{customer.phone}{customer.email ? ` • ${customer.email}` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">{sourceLabel(customer.source)}</span>{isProtected ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700"><ShieldCheck size={13} />Dados protegidos</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"><Edit3 size={13} />Editável pelo lojista</span>}</div>
        </div></div>
        {canManageCustomers && !isProtected && <button type="button" onClick={() => navigate(`/admin/customers/${customer.id}/edit`)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-5 py-3 text-sm font-black"><Edit3 size={18} />Editar</button>}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Summary icon={<ClipboardList size={17} />} label="Pedidos" value={String(customer.total_orders || data.orders.length)} note={`${totalCompletedOrders} concluídos`} />
      <Summary icon={<BadgeDollarSign size={17} />} label="Total gasto" value={formatCurrency(customer.total_spent || 0)} />
      <Summary icon={<Coins size={17} />} label="Pontos" value={String(customer.loyalty_points || 0)} note={customer.current_tier_name || customer.loyalty_tier || 'Bronze'} accent />
      <Summary icon={<CalendarClock size={17} />} label="Última compra" value={formatDateTime(customer.last_order_at)} small />
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"><h2 className="text-lg font-black">Pedidos do cliente</h2><div className="mt-4 space-y-3">
          {data.orders.map((order) => <Link key={order.id} to={`/admin/orders?orderId=${order.id}`} title={order.order_code || order.id} className="block rounded-2xl border border-gray-100 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-gray-800"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-black">{shortOrderReference(order)}</p><p className="text-xs text-gray-500">{formatDateTime(order.created_at)}</p></div><div className="text-left sm:text-right"><p className="font-black">{formatCurrency(order.total)}</p><p className="text-xs font-bold uppercase text-gray-500">{statusLabel(order.status)}</p></div></div></Link>)}
          {!data.orders.length && <Empty text="Nenhum pedido encontrado." />}
        </div></section>

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"><h2 className="text-lg font-black">Histórico de fidelidade</h2><div className="mt-4 space-y-3">
          {data.loyalty_transactions.map((transaction) => {
            const order = transaction.order_id ? orderMap.get(transaction.order_id) || null : null;
            const content = <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-4 dark:border-gray-800"><div><p className="font-bold">{order ? `Pontos do ${shortOrderReference(order)}` : (transaction.description || 'Movimentação de fidelidade')}</p><p className="text-xs text-gray-500">{formatDateTime(transaction.created_at)}</p></div><p className={`font-black ${Number(transaction.points) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{Number(transaction.points) >= 0 ? '+' : ''}{transaction.points} pts</p></div>;
            return order ? <Link key={transaction.id} to={`/admin/orders?orderId=${order.id}`} title={order.order_code || order.id} className="block transition hover:opacity-90">{content}</Link> : <div key={transaction.id}>{content}</div>;
          })}
          {!data.loyalty_transactions.length && <Empty text="Nenhuma movimentação de fidelidade." />}
        </div></section>
      </div>

      <aside className="space-y-6">
        <Aside title="Tags" icon={<Tags size={18} className="text-emerald-600" />}>{customer.tags?.length ? <div className="flex flex-wrap gap-2">{customer.tags.map((tag) => <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{tag}</span>)}</div> : <p className="text-sm text-gray-500">Sem tags cadastradas.</p>}</Aside>
        <Aside title="Observações internas"><p className="text-sm text-gray-500">{customer.internal_notes || 'Nenhuma observação interna.'}</p></Aside>
        <Aside title="Endereços" icon={<MapPin size={18} className="text-emerald-600" />}>{data.addresses.length ? <div className="space-y-2 text-sm">{data.addresses.map((address) => <p key={address.id}>{address.street}, {address.number} — {address.city}/{address.state}</p>)}</div> : <p className="text-sm text-gray-500">Nenhum endereço cadastrado.</p>}</Aside>
      </aside>
    </div>
  </div>;
}

function Summary({ icon, label, value, note, accent = false, small = false }: { icon: React.ReactNode; label: string; value: string; note?: string; accent?: boolean; small?: boolean }) {
  return <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center gap-2 text-gray-500">{icon}<p className="text-xs font-bold uppercase">{label}</p></div><p className={`mt-2 font-black ${small ? 'text-sm' : 'text-2xl'} ${accent ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>{value}</p>{note && <p className="mt-1 text-xs text-gray-500">{note}</p>}</div>;
}

function Aside({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center gap-2">{icon}<h2 className="text-lg font-black">{title}</h2></div><div className="mt-4">{children}</div></section>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">{text}</div>; }
