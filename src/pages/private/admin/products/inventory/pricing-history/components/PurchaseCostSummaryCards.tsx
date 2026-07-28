import React from 'react';
import { Truck, Receipt, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import type { PurchaseCostSummary } from '../../types/productPricingHistory.types';

interface PurchaseCostSummaryCardsProps {
  summary: PurchaseCostSummary;
}

export const PurchaseCostSummaryCards: React.FC<PurchaseCostSummaryCardsProps> = ({ summary }) => {
  const hasPurchases = summary.total_quantity_purchased > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Quantidade Recebida */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Qtd. Recebida</p>
          <p className="text-xl font-black text-gray-900 dark:text-white mt-1">
            {hasPurchases ? `${formatNumberPtBr(summary.total_quantity_purchased)} un.` : '—'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {summary.purchases_count} entradas confirmadas
          </p>
        </div>
        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600">
          <Truck size={22} />
        </div>
      </div>

      {/* Valor Total Comprado */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Valor Total Comprado</p>
          <p className="text-xl font-black text-gray-900 dark:text-white mt-1">
            {hasPurchases ? formatCurrencyPtBr(summary.total_purchased_value) : 'Sem compras'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Total investido no estoque</p>
        </div>
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
          <Receipt size={22} />
        </div>
      </div>

      {/* Custo Médio Ponderado */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Custo Médio Ponderado</p>
          <p className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
            {hasPurchases ? formatCurrencyPtBr(summary.weighted_average_purchase_cost) : 'Sem compras'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Custo real de aquisição</p>
        </div>
        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600">
          <ArrowDownRight size={22} />
        </div>
      </div>

      {/* Menor / Maior Custo */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Menor / Maior Custo</p>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">
            {summary.min_unit_cost !== null ? formatCurrencyPtBr(summary.min_unit_cost) : '—'} /{' '}
            {summary.max_unit_cost !== null ? formatCurrencyPtBr(summary.max_unit_cost) : '—'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Variação de custo no período</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <ArrowUpRight size={22} />
        </div>
      </div>
    </div>
  );
};
