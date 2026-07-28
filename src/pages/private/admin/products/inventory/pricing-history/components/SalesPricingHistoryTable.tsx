import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import { formatDateOnlyPtBr } from '@/utils/dateTime';
import type { ProductItemPricingSnapshot } from '../../types/productPricingHistory.types';

interface SalesPricingHistoryTableProps {
  snapshots: ProductItemPricingSnapshot[];
}

const PAGE_SIZE = 50;

export const SalesPricingHistoryTable: React.FC<SalesPricingHistoryTableProps> = ({ snapshots }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(snapshots.length / PAGE_SIZE) || 1;

  const currentSnapshots = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return snapshots.slice(start, start + PAGE_SIZE);
  }, [snapshots, currentPage]);

  if (snapshots.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-[#19A999]">
            <ShoppingBag size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              Histórico Detalhado de Vendas
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Registros individuais de cada item faturado no período selecionado
            </p>
          </div>
        </div>

        <div className="text-xs font-medium text-gray-500">
          Exibindo {currentSnapshots.length} de {snapshots.length} registros
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
              <th className="pb-3 pr-3">Data</th>
              <th className="pb-3 px-3">Pedido</th>
              <th className="pb-3 px-3">Canal</th>
              <th className="pb-3 px-3 text-right">Qtd</th>
              <th className="pb-3 px-3 text-right">Preço Base</th>
              <th className="pb-3 px-3 text-right">Preço Efetivo</th>
              <th className="pb-3 px-3 text-right">Desconto Total</th>
              <th className="pb-3 px-3 text-right">Subtotal Líquido</th>
              <th className="pb-3 px-3">Origem da Regra</th>
              <th className="pb-3 pl-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-200">
            {currentSnapshots.map((item) => (
              <tr key={item.order_item_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-3 pr-3 font-medium whitespace-nowrap">
                  {formatDateOnlyPtBr(item.sold_at)}
                </td>
                <td className="py-3 px-3 font-bold">
                  {item.order_code || item.order_id.slice(0, 8)}
                </td>
                <td className="py-3 px-3 capitalize text-gray-500">
                  {item.sales_channel.replace('_', ' ')}
                </td>
                <td className="py-3 px-3 text-right font-bold">
                  {formatNumberPtBr(item.quantity)} un.
                </td>
                <td className="py-3 px-3 text-right text-gray-500">
                  {formatCurrencyPtBr(item.base_price)}
                </td>
                <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                  {formatCurrencyPtBr(item.effective_unit_price)}
                </td>
                <td className="py-3 px-3 text-right text-[#F1613A]">
                  {formatCurrencyPtBr(item.discount_total)}
                </td>
                <td className="py-3 px-3 text-right font-black text-[#19A999]">
                  {formatCurrencyPtBr(item.net_subtotal)}
                </td>
                <td className="py-3 px-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {item.pricing_origin_label}
                  </span>
                </td>
                <td className="py-3 pl-3 text-right">
                  <Link
                    to={`/admin/orders?search=${item.order_code || item.order_id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#19A999] hover:underline"
                  >
                    <span>Ver venda</span>
                    <ExternalLink size={11} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold disabled:opacity-40"
          >
            <ChevronLeft size={14} />
            <span>Anterior</span>
          </button>

          <span className="text-xs font-medium text-gray-500">
            Página {currentPage} de {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold disabled:opacity-40"
          >
            <span>Próxima</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
