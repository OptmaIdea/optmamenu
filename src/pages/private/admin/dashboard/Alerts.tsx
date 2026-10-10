// src/pages/private/admin/dashboard/Alerts.tsx
import { useMemo, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, TrendingUp, AlertCircle } from 'lucide-react';

import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { useStockAlerts } from '@/hooks/stock/useStockAlerts';
import { useAccountsPayableDueAlerts } from '@/hooks/financial/useAccountsPayableDueAlerts';

function StockList({
  title,
  items,
  tone = 'neutral',
}: {
  title: string;
  items: { id: string; name: string; stock_quantity: number; min_stock: number; max_stock: number }[];
  tone?: 'critical' | 'warning' | 'info' | 'neutral';
}) {
  const toneClass =
    tone === 'critical'
      ? 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-900/10'
      : tone === 'warning'
        ? 'border-yellow-200 bg-yellow-50/40 dark:border-yellow-900/40 dark:bg-yellow-900/10'
        : tone === 'info'
          ? 'border-purple-200 bg-purple-50/40 dark:border-purple-900/40 dark:bg-purple-900/10'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-candara text-base font-black">{title}</h3>
        <span className="text-xs opacity-70">{items.length} itens</span>
      </div>

      {items.length === 0 ? (
        <div className="text-sm opacity-70">Nada por aqui 🎉</div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span className="text-sm font-candara truncate pr-2">{p.name}</span>
              <span className="text-xs font-black opacity-80 shrink-0">
                {p.stock_quantity} <span className="opacity-60">/ min {p.min_stock} / max {p.max_stock}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Alerts() {
  const { store, storeId, loading: storeLoading } = useCurrentStore();
  const financialAlerts = useAccountsPayableDueAlerts(storeId || undefined);
  const { hasPermission } = usePermissions(storeId || null);
  const [holidays, setHolidays] = useState<Array<{ id: string | null; date: string; name: string; automatic?: boolean; category?: string }>>([]);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);
  const canManageHolidays = hasPermission('accounts_payable.manage');

  useEffect(() => {
    if (!storeId) { setHolidays([]); return; }
    let mounted = true;
    const load = async () => {
      const { data, error } = await supabase.rpc('list_store_financial_holidays_safe', {
        p_store_id: storeId, p_year: holidayYear,
      });
      if (mounted && !error && data?.ok) setHolidays(data.items || []);
    };
    void load();
    return () => { mounted = false; };
  }, [storeId, holidayYear]);

  const saveHoliday = async () => {
    if (!storeId || !holidayDate || holidayName.trim().length < 2) return toast.warning('Informe data e descrição do feriado.');
    setSavingHoliday(true);
    try {
      const { data, error } = await supabase.rpc('save_store_financial_holiday_safe', {
        p_store_id: storeId, p_date: holidayDate, p_name: holidayName.trim(),
      });
      if (error || !data?.ok) throw error || new Error(data?.error || 'Erro ao salvar feriado.');
      setHolidayYear(Number(holidayDate.slice(0,4)));
      const { data: list } = await supabase.rpc('list_store_financial_holidays_safe', {
        p_store_id: storeId, p_year: Number(holidayDate.slice(0,4)),
      });
      if (list?.ok) setHolidays(list.items || []);
      setHolidayName('');
      setHolidayDate('');
      toast.success('Feriado cadastrado para esta unidade.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao salvar feriado.'); }
    finally { setSavingHoliday(false); }
  };

  const removeHoliday = async (date: string) => {
    if (!storeId) return;
    const { data, error } = await supabase.rpc('delete_store_financial_holiday_safe', {
      p_store_id: storeId, p_date: date,
    });
    if (error || !data?.ok) return toast.error(error?.message || data?.error || 'Erro ao remover feriado.');
    setHolidays((current) => current.filter((item) => item.date !== date));
    toast.success('Feriado removido.');
  };
  const { loading, error, summary, lists } = useStockAlerts(storeId || undefined, {
    autoRefreshMs: 5 * 60 * 1000,
    limitPerList: 12,
  });

  const title = useMemo(() => {
    if (store?.name) return `Alertas — ${store.name}`;
    return 'Alertas';
  }, [store?.name]);

  const isLoading = storeLoading || loading;

  return (
    <PageContainer
      title={title}
      subtitle={store?.name ? `Avisos financeiros e de estoque — ${store.name}` : "Acompanhe vencimentos e alertas de estoque"}
      category="Dashboard"
      icon={<AlertCircle size={28} className="text-[#19A999]" />}
      action={
        <Link
          to="/admin/inventory"
          className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-3.5 py-2 text-sm font-black text-white hover:opacity-90 transition shadow-sm"
        >
          <Package size={16} />
          Ver estoque
        </Link>
      }
      flat
    >

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900/50 dark:bg-gray-900" aria-label="Vencimentos de contas a pagar">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-black text-gray-900 dark:text-white">Contas a pagar · vencidas e próximos 5 dias</h2>
          <p className="text-xs text-gray-500">Contagem em dias corridos. O calendário indica dias não úteis, sem alterar automaticamente o vencimento contratual.</p></div>
          <Link to="/admin/accounts-payable" className="text-sm font-bold text-teal-700 hover:underline dark:text-teal-300">Ver todas as contas</Link>
        </div>
        {financialAlerts.error && <p className="mb-2 text-xs text-amber-700">Avisos indisponíveis: {financialAlerts.error}</p>}
        {financialAlerts.loading ? <p className="text-sm text-gray-500">Consultando vencimentos...</p> : financialAlerts.items.length === 0 ? <p className="text-sm text-gray-500">Nenhuma parcela vencida ou com vencimento nos próximos cinco dias.</p> : (
          <div className="space-y-2">{financialAlerts.items.map((item) => (
            <Link key={item.installment_id} to={`/admin/accounts-payable?payable=${encodeURIComponent(item.payable_id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 hover:border-teal-400 dark:border-gray-700">
              <div className="min-w-0"><p className="font-bold text-gray-900 dark:text-white">{item.description || item.payable_code} · parcela {item.installment_number}</p>
                <p className="text-xs text-gray-500">{item.payable_code} · vencimento {item.due_date.split('-').reverse().join('/')}</p>{item.is_non_business_due_date && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">Vencimento em dia não útil · próximo dia útil {item.next_business_date?.split('-').reverse().join('/')}. Confira a regra contratual.</p>}</div>
              <div className="text-right"><p className={`text-sm font-black ${item.days_until_due < 0 ? 'text-red-600' : item.days_until_due === 0 ? 'text-orange-600' : 'text-amber-600'}`}>{item.days_until_due < 0 ? `${Math.abs(item.days_until_due)} dia(s) em atraso` : item.days_until_due === 0 ? 'Vence hoje' : `Vence em ${item.days_until_due} dia(s)`}</p>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{Number(item.open_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
            </Link>
          ))}</div>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-black dark:text-white">Calendário financeiro de feriados</h2><p className="text-xs text-gray-500">Feriados nacionais e bancários recorrentes são gerados automaticamente; cadastre abaixo apenas feriados estaduais e municipais. Datas de expediente especial não alteram o vencimento contratual.</p></div>
          <label className="text-xs font-bold text-gray-500">Ano <select value={holidayYear} onChange={(e) => setHolidayYear(Number(e.target.value))} className="ml-2 rounded-lg border px-2 py-1 dark:bg-gray-950">{[new Date().getFullYear()-1,new Date().getFullYear(),new Date().getFullYear()+1].map(y=><option key={y} value={y}>{y}</option>)}</select></label>
        </div>
        {canManageHolidays && <div className="mb-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]"><input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} className="rounded-xl border px-3 py-2 dark:bg-gray-950"/><input placeholder="Nome do feriado" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} className="rounded-xl border px-3 py-2 dark:bg-gray-950"/><button type="button" onClick={() => void saveHoliday()} disabled={savingHoliday} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Adicionar</button></div>}
        {holidays.length===0 ? <p className="text-sm text-gray-500">Nenhum feriado disponível para {holidayYear}.</p> : <div className="grid gap-2 sm:grid-cols-2">{holidays.map(h => <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm dark:border-gray-700"><span>{h.date.split('-').reverse().join('/')} · {h.name}{h.automatic ? ' (automático)' : ' (local)'}</span>{canManageHolidays && !h.automatic && <button type="button" onClick={() => void removeHoliday(h.date)} className="text-xs font-bold text-rose-600">Remover</button>}</div>)}</div>}
      </section>

      {/* Cards (sem badges) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Crítico"
          value={isLoading ? '—' : summary.criticalCount}
          icon={<AlertTriangle size={20} />}
        />
        <StatsCard
          title="Sem estoque"
          value={isLoading ? '—' : summary.zeroCount}
          icon={<Package size={20} />}
        />
        <StatsCard
          title="Estoque baixo"
          value={isLoading ? '—' : summary.lowCount}
          icon={<AlertTriangle size={20} />}
        />
        <StatsCard
          title="Excesso"
          value={isLoading ? '—' : summary.excessCount}
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StockList title="Sem estoque (zerado)" items={lists.zero} tone="critical" />
        <StockList title="Estoque baixo" items={lists.low} tone="warning" />
        <StockList title="Excesso de estoque" items={lists.excess} tone="info" />
      </div>

      {/* Ajuda rápida */}
      <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="text-sm opacity-80">
          <span className="font-black">Crítico</span> = sem estoque + abaixo do mínimo. Excesso é alerta de otimização (capital parado),
          então não entra em crítico.
        </div>
      </div>
    </PageContainer>
  );
}
