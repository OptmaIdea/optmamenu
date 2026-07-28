import React from 'react';
import { Layers, PieChart } from 'lucide-react';
import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import type { PricingSourceSalesSummary } from '../../types/productPricingHistory.types';

interface SalesPricingBySourceTableProps {
  bySource: PricingSourceSalesSummary[];
}

export const SalesPricingBySourceTable: React.FC<SalesPricingBySourceTableProps> = ({ bySource }) => {
  if (bySource.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100 dark:border-gray-700">
        <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-[#19A999]">
          <Layers size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">
            Desempenho por Origem da Precificação
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Agrupamento consolidado das vendas por regra, tabela ou desconto aplicado
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
              <th className="pb-3 pr-4">Origem / Regra</th>
              <th className="pb-3 px-3 text-right">Qtd. Vendida</th>
              <th className="pb-3 px-3 text-right">Vendas</th>
              <th className="pb-3 px-3 text-right">Preço-Base Médio</th>
              <th className="pb-3 px-3 text-right">Preço Efetivo Médio</th>
              <th className="pb-3 px-3 text-right">Receita Bruta</th>
              <th className="pb-3 px-3 text-right">Desconto Total</th>
              <th className="pb-3 px-3 text-right">Receita Líquida</th>
              <th className="pb-3 pl-4 text-right">Participação %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-200">
            {bySource.map((row) => (
              <tr key={row.group_key} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-3 pr-4 font-bold">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#19A999]" />
                    <span>{row.origin_label}</span>
                  </div>
                  {row.applied_tier_min_quantity && (
                    <span className="text-[11px] font-normal text-gray-400 block ml-4">
                      Faixa: a partir de {row.applied_tier_min_quantity} un. ({formatCurrencyPtBr(row.applied_tier_price ?? 0)})
                    </span>
                  )}
                  {row.pricing_group_name_snapshot && (
                    <span className="text-[11px] font-normal text-gray-400 block ml-4">
                      Grupo: {row.pricing_group_name_snapshot}
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-right font-bold">
                  {formatNumberPtBr(row.total_quantity_sold)} un.
                </td>
                <td className="py-3 px-3 text-right text-gray-500">
                  {row.sales_count}
                </td>
                <td className="py-3 px-3 text-right text-gray-500">
                  {formatCurrencyPtBr(row.average_base_price)}
                </td>
                <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                  {formatCurrencyPtBr(row.weighted_average_price)}
                </td>
                <td className="py-3 px-3 text-right text-gray-500">
                  {formatCurrencyPtBr(row.gross_revenue)}
                </td>
                <td className="py-3 px-3 text-right text-[#F1613A]">
                  {formatCurrencyPtBr(row.total_discount)}
                </td>
                <td className="py-3 px-3 text-right font-black text-[#19A999]">
                  {formatCurrencyPtBr(row.net_revenue)}
                </td>
                <td className="py-3 pl-4 text-right">
                  <div className="inline-flex items-center gap-1 font-bold text-gray-900 dark:text-white">
                    <PieChart size={12} className="text-[#19A999]" />
                    <span>{formatNumberPtBr(row.revenue_share_percentage)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
