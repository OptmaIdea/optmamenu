import React from 'react';
import { Truck } from 'lucide-react';
import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import { formatDateOnlyPtBr } from '@/utils/dateTime';
import type { ProductPurchaseHistoryItem } from '../../types/productPricingHistory.types';

interface PurchaseCostHistoryTableProps {
  purchases: ProductPurchaseHistoryItem[];
}

export const PurchaseCostHistoryTable: React.FC<PurchaseCostHistoryTableProps> = ({ purchases }) => {
  if (purchases.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100 dark:border-gray-700">
        <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600">
          <Truck size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">
            Histórico Detalhado de Compras
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Entradas de compra efetivamente recebidas e integradas ao estoque no período
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
              <th className="pb-3 pr-3">Data Entrada</th>
              <th className="pb-3 px-3">Documento</th>
              <th className="pb-3 px-3">Fornecedor</th>
              <th className="pb-3 px-3 text-right">Qtd. Recebida</th>
              <th className="pb-3 px-3 text-right">Custo Unitário</th>
              <th className="pb-3 px-3 text-right">Custo Total</th>
              <th className="pb-3 pl-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-200">
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-3 pr-3 font-medium whitespace-nowrap">
                  {formatDateOnlyPtBr(p.entry_date)}
                </td>
                <td className="py-3 px-3 font-bold">
                  {p.document_number || p.invoice_number || 'ENT-DOC'}
                </td>
                <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                  {p.supplier_name || 'Sem fornecedor'}
                </td>
                <td className="py-3 px-3 text-right font-bold">
                  {formatNumberPtBr(p.received_quantity)} un.
                </td>
                <td className="py-3 px-3 text-right font-bold text-[#7B2D8E] dark:text-purple-300">
                  {formatCurrencyPtBr(p.unit_cost)}
                </td>
                <td className="py-3 px-3 text-right font-black text-gray-900 dark:text-white">
                  {formatCurrencyPtBr(p.total_cost)}
                </td>
                <td className="py-3 pl-3 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Confirmado
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
