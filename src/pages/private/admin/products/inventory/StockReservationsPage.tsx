import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Search, TimerReset } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';

type ReservationRow = {
  reservation_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  reservation_status: string;
  expires_at: string | null;
  created_at: string;
  location_id: string | null;
  location_name: string | null;
  order_id: string | null;
  order_code: string | null;
  order_status: string | null;
  customer_name: string | null;
  sales_channel: string | null;
  fulfillment_type: string | null;
};

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function channelLabel(channel?: string | null) {
  const labels: Record<string, string> = {
    public_store: 'Loja pública',
    whatsapp: 'WhatsApp',
    direct: 'Venda direta',
    in_person: 'PDV',
    phone: 'Telefone',
    qr_table: 'Mesa/QR',
  };
  return labels[channel || ''] || channel || 'Não informado';
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    reserved: 'Reservado',
    confirmed: 'Confirmado',
    ready: 'Pronto',
    active: 'Ativa',
  };
  return labels[status || ''] || status || 'Não informado';
}

export default function StockReservationsPage() {
  const storeId = getActiveStoreId();
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!storeId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc('get_active_stock_reservation_origins', {
      p_store_id: storeId,
      p_product_id: null,
    });

    if (error) {
      toast.error('Não foi possível carregar as reservas de estoque.');
      setRows([]);
    } else {
      setRows((data || []).map((row: ReservationRow) => ({
        ...row,
        quantity: Number(row.quantity || 0),
      })));
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.product_name} ${row.order_code || ''} ${row.customer_name || ''} ${row.location_name || ''} ${channelLabel(row.sales_channel)}`
        .toLocaleLowerCase('pt-BR')
        .includes(term)
    );
  }, [rows, search]);

  const totalReserved = visibleRows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <PageContainer title="Reservas de estoque">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#21A896]">Produtos</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-slate-900 dark:text-white">
              <TimerReset className="text-[#21A896]" /> Reservas de estoque
            </h1>
            <p className="mt-1 text-slate-600 dark:text-slate-300">Veja quais pedidos estão comprometendo o saldo disponível em cada local.</p>
          </div>
          <button type="button" onClick={() => void load()} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produto, pedido, cliente, local ou canal" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#21A896] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500" />
          </label>
          <div className="flex h-11 items-center justify-center rounded-xl border border-teal-900/20 bg-[#21A896]/10 font-bold text-[#1A867A] dark:border-teal-700/50 dark:bg-teal-950/40 dark:text-teal-200">
            {totalReserved} unidade(s) reservada(s)
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><RefreshCw className="animate-spin text-[#21A896]" /></div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Nenhuma reserva ativa encontrada.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Qtd.</th>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Criação</th>
                  <th className="px-4 py-3">Expiração</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleRows.map((row) => (
                  <tr key={row.reservation_id} className="text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.product_name}</td>
                    <td className="px-4 py-3 font-black text-[#7B2D8E] dark:text-fuchsia-300">{row.quantity}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{row.order_code || 'Sem código'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{statusLabel(row.order_status || row.reservation_status)}</div>
                    </td>
                    <td className="px-4 py-3">{row.customer_name || 'Não informado'}</td>
                    <td className="px-4 py-3">{channelLabel(row.sales_channel)}</td>
                    <td className="px-4 py-3">{row.location_name || 'Não informado'}</td>
                    <td className="px-4 py-3">{dateTime.format(new Date(row.created_at))}</td>
                    <td className="px-4 py-3">{row.expires_at ? dateTime.format(new Date(row.expires_at)) : 'Sem prazo'}</td>
                    <td className="px-4 py-3">
                      {row.order_id ? (
                        <Link to={`/admin/orders?orderId=${row.order_id}`} className="inline-flex items-center gap-1 font-semibold text-[#1A867A] hover:underline dark:text-teal-300">
                          Abrir pedido <ExternalLink size={14} />
                        </Link>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">Indisponível</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
