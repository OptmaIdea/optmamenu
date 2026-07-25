import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, TimerReset } from 'lucide-react';
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
    public_store: 'Online',
    whatsapp: 'WhatsApp',
    direct: 'Venda direta',
    in_person: 'PDV',
    qr_table: 'Mesa/QR',
  };
  return labels[channel || ''] || channel || 'NÃ£o informado';
}

export default function StockReservationsPage() {
  const storeId = getActiveStoreId();
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_active_stock_reservation_origins', {
      p_store_id: storeId,
      p_product_id: null,
    });

    if (error) {
      toast.error('NÃ£o foi possÃ­vel carregar as reservas de estoque.');
    } else {
      setRows((data || []).map((row: ReservationRow) => ({ ...row, quantity: Number(row.quantity || 0) })));
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => { void load(); }, [load]);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#21A896]">Produtos</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-slate-900">
              <TimerReset className="text-[#21A896]" /> Reservas de estoque
            </h1>
            <p className="mt-1 text-slate-500">Veja exatamente quais pedidos estÃ£o comprometendo o saldo disponÃ­vel.</p>
          </div>
          <button type="button" onClick={() => void load()} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-semibold">
            <RefreshCw size={17} /> Atualizar
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produto, pedido, cliente, local ou canal" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 outline-none focus:border-[#21A896]" />
          </label>
          <div className="flex h-11 items-center justify-center rounded-xl bg-[#21A896]/10 font-bold text-[#1A867A]">
            {totalReserved} unidade(s) reservada(s)
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center rounded-2xl bg-white"><RefreshCw className="animate-spin text-[#21A896]" /></div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhuma reserva ativa encontrada.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Qtd.</th>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Criada em</th>
                  <th className="px-4 py-3">Expira em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => (
                  <tr key={row.reservation_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{row.product_name}</td>
                    <td className="px-4 py-3 font-black text-[#7B2D8E]">{row.quantity}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.order_code || 'Sem cÃ³digo'}</div>
                      <div className="text-xs text-slate-500">{row.order_status || row.reservation_status}</div>
                    </td>
                    <td className="px-4 py-3">{row.customer_name || 'NÃ£o informado'}</td>
                    <td className="px-4 py-3">{channelLabel(row.sales_channel)}</td>
                    <td className="px-4 py-3">{row.location_name || 'NÃ£o informado'}</td>
                    <td className="px-4 py-3">{dateTime.format(new Date(row.created_at))}</td>
                    <td className="px-4 py-3">{row.expires_at ? dateTime.format(new Date(row.expires_at)) : 'Sem prazo'}</td>
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

