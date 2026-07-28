import React from 'react';
import { PackageCheck, DollarSign, TrendingUp, Tag } from 'lucide-react';
import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import type { SalesPricingSummary } from '../../types/productPricingHistory.types';

interface SalesPricingSummaryCardsProps {
  summary: SalesPricingSummary;
}

export const SalesPricingSummaryCards: React.FC<SalesPricingSummaryCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Quantidade Vendida */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Qtd. Vendida</p>
          <p className="text-xl font-black text-gray-900 dark:text-white mt-1">
            {formatNumberPtBr(summary.total_quantity_sold)} <span className="text-xs font-bold text-gray-400">un.</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">{summary.sales_count} vendas no período</p>
        </div>
        <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-[#19A999]">
          <PackageCheck size={22} />
        </div>
      </div>

      {/* Receita Líquida */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Receita Líquida</p>
          <p className="text-xl font-black text-[#19A999] mt-1">
            {formatCurrencyPtBr(summary.total_net_revenue)}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Bruto: {formatCurrencyPtBr(summary.total_gross_revenue)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
          <DollarSign size={22} />
        </div>
      </div>

      {/* Preço Médio Efetivo */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Preço Médio Efetivo</p>
          <p className="text-xl font-black text-gray-900 dark:text-white mt-1">
            {formatCurrencyPtBr(summary.overall_weighted_average_effective_price)}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Base: {formatCurrencyPtBr(summary.overall_weighted_average_base_price)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-900/30 text-sky-600">
          <TrendingUp size={22} />
        </div>
      </div>

      {/* Desconto Concedido */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Desconto Concedido</p>
          <p className="text-xl font-black text-[#F1613A] mt-1">
            {formatCurrencyPtBr(summary.total_discount)}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Total economizado/abatido</p>
        </div>
        <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-[#F1613A]">
          <Tag size={22} />
        </div>
      </div>
    </div>
  );
};
