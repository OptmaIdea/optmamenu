import { Filter } from 'lucide-react';
import { createPortal } from 'react-dom';

interface OrderStatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export default function OrderStatusFilter({ value, onChange }: OrderStatusFilterProps) {
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
