import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  CircleUserRound,
  Coins,
  GitMerge,
  History,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Customers360Service,
  type CustomerTimelineEvent,
  type CustomerTimelineResult,
} from '@/services/customers360Service';
import { getShortDocumentReference } from '@/utils/documentReference';

type TimelineFilter = 'all' | 'profile' | 'order' | 'loyalty' | 'consent' | 'address' | 'merge' | 'communication';

const FILTERS: Array<{ value: TimelineFilter; label: string }> = [
  { value: 'all', label: 'Tudo' },
  { value: 'profile', label: 'Cadastro' },
  { value: 'order', label: 'Pedidos' },
  { value: 'loyalty', label: 'Fidelidade' },
  { value: 'consent', label: 'Consentimentos' },
  { value: 'address', label: 'Endereços' },
  { value: 'merge', label: 'Fusões' },
  { value: 'communication', label: 'Comunicações' },
];

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

function formatCurrency(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function eventIcon(category: string) {
  switch (category) {
    case 'order':
      return <ShoppingBag size={17} />;
    case 'loyalty':
      return <Coins size={17} />;
    case 'consent':
      return <ShieldCheck size={17} />;
    case 'address':
      return <MapPin size={17} />;
    case 'merge':
      return <GitMerge size={17} />;
    case 'communication':
      return <Bell size={17} />;
    default:
      return <CircleUserRound size={17} />;
  }
}

function eventClass(category: string) {
  switch (category) {
    case 'order':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200';
    case 'loyalty':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200';
    case 'consent':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200';
    case 'address':
      return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200';
    case 'merge':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-200';
    case 'communication':
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
  }
}

function consentTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    terms_of_use: 'Termos de uso',
    privacy_policy: 'Política de privacidade',
    loyalty_program: 'Programa de fidelidade',
    marketing_whatsapp: 'Marketing por WhatsApp',
    marketing_email: 'Marketing por e-mail',
    marketing_sms: 'Marketing por SMS',
  };
  const key = typeof value === 'string' ? value : '';
  return labels[key] || key || null;
}

function TimelineMetadata({ event }: { event: CustomerTimelineEvent }) {
  const metadata = event.metadata || {};

  if (event.category === 'order') {
    const total = formatCurrency(metadata.total);
    const status = typeof metadata.status === 'string' ? metadata.status : null;
    const orderId = typeof metadata.order_id === 'string' ? metadata.order_id : null;
    const orderCode = typeof metadata.order_code === 'string' ? metadata.order_code : null;

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        {total && <span className="rounded-full bg-gray-100 px-2.5 py-1 font-black text-gray-700 dark:bg-gray-800 dark:text-gray-200">{total}</span>}
        {status && <span className="rounded-full bg-gray-100 px-2.5 py-1 font-bold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">{status}</span>}
        {orderId && (
          <Link
            to={`/admin/orders?orderId=${orderId}`}
            className="rounded-full bg-blue-50 px-2.5 py-1 font-black text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-200"
          >
            Abrir {getShortDocumentReference(orderCode || orderId, { fallbackLabel: 'pedido' })}
          </Link>
        )}
      </div>
    );
  }

  if (event.category === 'loyalty') {
    const points = Number(metadata.points);
    if (!Number.isFinite(points)) return null;
    return (
      <p className={`mt-2 text-xs font-black ${points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
        {points >= 0 ? '+' : ''}{points} pts
      </p>
    );
  }

  if (event.category === 'consent') {
    const type = consentTypeLabel(metadata.consent_type);
    const action = metadata.action === 'granted' ? 'Concedido' : metadata.action === 'revoked' ? 'Revogado' : null;
    if (!type && !action) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        {type && <span className="rounded-full bg-gray-100 px-2.5 py-1 font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{type}</span>}
        {action && (
          <span className={`rounded-full px-2.5 py-1 font-black ${action === 'Concedido' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200'}`}>
            {action}
          </span>
        )}
      </div>
    );
  }

  if (event.category === 'address') {
    const city = typeof metadata.city === 'string' ? metadata.city : null;
    const state = typeof metadata.state === 'string' ? metadata.state : null;
    if (!city && !state) return null;
    return <p className="mt-2 text-xs font-bold text-gray-500 dark:text-gray-400">{[city, state].filter(Boolean).join('/')}</p>;
  }

  return null;
}

export default function CustomerTimelineSection({ storeId, customerId }: { storeId: string; customerId: string }) {
  const [timeline, setTimeline] = useState<CustomerTimelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Customers360Service.getCustomerTimeline(storeId, customerId, 150)
      .then((result) => {
        if (active) setTimeline(result);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a linha do tempo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customerId, reloadToken, storeId]);

  const filteredEvents = useMemo(() => {
    const events = timeline?.events || [];
    if (filter === 'all') return events;
    return events.filter((event) => event.category === filter);
  }, [filter, timeline?.events]);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const event of timeline?.events || []) {
      result.set(event.category, (result.get(event.category) || 0) + 1);
    }
    return result;
  }, [timeline?.events]);

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History size={19} className="text-[#19A999]" />
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Linha do tempo do cliente</h2>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Cadastro, pedidos confirmadamente vinculados, fidelidade e eventos de governança em ordem cronológica.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadToken((current) => current + 1)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar histórico
        </button>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => {
          const count = item.value === 'all' ? timeline?.events.length || 0 : counts.get(item.value) || 0;
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${active ? 'bg-[#19A999] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
            >
              {item.label} · {count}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <p>
            Pedidos aparecem aqui somente quando estão vinculados de forma confirmada ao cadastro. Um telefone informado em pedido eventual, sozinho, não cria associação automática com o cliente.
          </p>
        </div>
      </div>

      {!timeline?.sensitiveDataVisible && !loading && !error && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          Eventos sensíveis de consentimento, endereço, fusão e comunicação estão ocultos pela permissão de dados sensíveis.
        </div>
      )}

      <div className="mt-5">
        {loading && (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <Loader2 size={17} className="animate-spin" />
            Carregando linha do tempo...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            <p className="font-black">Não foi possível carregar a linha do tempo.</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}

        {!loading && !error && filteredEvents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Nenhum evento encontrado neste filtro.
          </div>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <div className="relative space-y-0">
            <div className="absolute bottom-4 left-[17px] top-4 w-px bg-gray-200 dark:bg-gray-700" />
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative flex gap-4 pb-5 last:pb-0">
                <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-gray-900 ${eventClass(event.category)}`}>
                  {eventIcon(event.category)}
                </div>
                <div className="min-w-0 flex-1 rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="font-black text-gray-900 dark:text-white">{event.title}</p>
                      {event.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{event.description}</p>}
                    </div>
                    <p className="shrink-0 text-[11px] font-bold text-gray-400">{formatDateTime(event.occurred_at)}</p>
                  </div>
                  <TimelineMetadata event={event} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
