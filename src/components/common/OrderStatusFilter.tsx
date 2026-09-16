import { useEffect, useRef } from 'react';
import { Filter } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

interface OrderStatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export default function OrderStatusFilter({ value, onChange }: OrderStatusFilterProps) {
  const deepLinkHandled = useRef(false);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('orderId');
    if (!orderId || deepLinkHandled.current) return;

    // Pedidos concluídos/cancelados não pertencem ao filtro padrão "Pedidos atuais".
    // Ao chegar da Vida do Cliente, abre o histórico automaticamente antes de
    // localizar e expandir o pedido solicitado.
    if (value !== 'all') {
      onChange('all');
      return;
    }

    deepLinkHandled.current = true;
    let disposed = false;
    let timer: number | null = null;

    void (async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('order_code')
          .eq('id', orderId)
          .maybeSingle();
        if (disposed) return;
        const orderCode = data?.order_code ? String(data.order_code) : '';
        if (!orderCode) return;

        let attempts = 0;
        const focusOrder = () => {
          if (disposed) return;
          attempts += 1;
          const heading = Array.from(document.querySelectorAll('h3')).find(
            (element) => element.textContent?.trim() === orderCode,
          );
          const clickable = heading?.closest('.cursor-pointer') as HTMLElement | null;
          if (clickable) {
            clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });
            clickable.click();
            return;
          }
          if (attempts < 20) timer = window.setTimeout(focusOrder, 150);
        };
        focusOrder();
      } catch {
        // O filtro em "Todos os Status" continua permitindo localizar o pedido manualmente.
      }
    })();

    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [onChange, value]);

  return createPortal(
    <div className="relative flex-1 md:w-56">
      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={15} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 text-gray-700 dark:text-gray-400 rounded-xl focus:ring-2 focus:ring-brand-green outline-none appearance-none text-xs font-bold"
      >
        <option value="current">Pedidos Atuais</option>
        <option value="all">Todos os Status</option>
        <option value="reserved">Novos</option>
        <option value="confirmed">Em Preparo</option>
        <option value="ready">Prontos</option>
        <option value="completed">Finalizados</option>
        <option value="cancelled">Cancelados</option>
        <option value="expired_auto">Expirados automaticamente</option>
      </select>
    </div>,
    document.getElementById('quick-access-actions-portal')!
  );
}
