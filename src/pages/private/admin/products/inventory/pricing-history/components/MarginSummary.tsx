import React from 'react';
import { Calculator, AlertCircle, TrendingUp, Percent } from 'lucide-react';
import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import type { EstimatedMarginSummary } from '../../types/productPricingHistory.types';

interface MarginSummaryProps {
  summary: EstimatedMarginSummary;
}

export const MarginSummary: React.FC<MarginSummaryProps> = ({ summary }) => {
  const isAvailable = summary.has_sale_data && summary.has_purchase_data;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700/60">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#7B2D8E]/10 text-[#7B2D8E] dark:bg-[#7B2D8E]/30 dark:text-purple-300">
            <Calculator size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              Análise de Margem Estimada
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Confronto gerencial entre preço médio efetivo de venda e custo médio ponderado de compra
            </p>
          </div>
        </div>
      </div>

      {!isAvailable ? (
        <div className="py-8 text-center flex flex-col items-center justify-center">
          <AlertCircle className="h-10 w-10 text-amber-500/60 mb-2" />
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
            Dados insuficientes para estimativa de margem
          </h4>
          <p className="text-xs text-gray-500 max-w-md mt-1">
            {!summary.has_sale_data && !summary.has_purchase_data
              ? 'Não há registros de vendas nem de compras confirmadas para este produto no período selecionado.'
              : !summary.has_sale_data
              ? 'Há compras registradas, mas não foram encontradas vendas concluídas no período.'
              : 'Há vendas no período, porém nenhuma entrada de compra confirmada no mesmo período para calcular o custo médio ponderado.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Preço Médio vs Custo Médio */}
          <div className="rounded-2xl bg-white dark:bg-gray-800/80 p-4 border border-gray-100 dark:border-gray-700/60">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
              Preço Médio vs Custo Médio
            </span>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400">Preço Venda Efetivo:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatCurrencyPtBr(summary.overall_weighted_sale_price)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400">Custo Compra Ponderado:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrencyPtBr(summary.weighted_average_purchase_cost)}
                </span>
              </div>
            </div>
          </div>

          {/* Margem Unitária Estimada */}
          <div className="rounded-2xl bg-white dark:bg-gray-800/80 p-4 border border-gray-100 dark:border-gray-700/60">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
              Margem Unitária Estimada
            </span>
            <p className={`text-2xl font-black mt-1 ${summary.unit_margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
              {formatCurrencyPtBr(summary.unit_margin)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Lucro bruto por unidade vendida</p>
          </div>

          {/* Margem % Sobre Venda */}
          <div className="rounded-2xl bg-white dark:bg-gray-800/80 p-4 border border-gray-100 dark:border-gray-700/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Margem % sobre Venda
              </span>
              <Percent size={14} className="text-[#19A999]" />
            </div>
            <p className={`text-2xl font-black mt-1 ${summary.margin_percentage_on_sale >= 0 ? 'text-[#19A999]' : 'text-rose-600'}`}>
              {formatNumberPtBr(summary.margin_percentage_on_sale)}%
            </p>
            <p className="text-[11px] text-gray-400 mt-1">(Margem / Preço de Venda) × 100</p>
          </div>

          {/* Markup % Sobre Custo */}
          <div className="rounded-2xl bg-white dark:bg-gray-800/80 p-4 border border-gray-100 dark:border-gray-700/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Markup % sobre Custo
              </span>
              <TrendingUp size={14} className="text-[#7B2D8E]" />
            </div>
            <p className={`text-2xl font-black mt-1 ${summary.markup_percentage_on_cost >= 0 ? 'text-[#7B2D8E] dark:text-purple-300' : 'text-rose-600'}`}>
              {formatNumberPtBr(summary.markup_percentage_on_cost)}%
            </p>
            <p className="text-[11px] text-gray-400 mt-1">(Margem / Custo de Compra) × 100</p>
          </div>
        </div>
      )}

      {/* Nota Explicativa Gerencial */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <AlertCircle size={14} className="text-gray-400 shrink-0" />
        <span>
          <strong>Aviso Gerencial:</strong> Estimativa calculada com base no preço médio de venda e no custo médio de compra do período selecionado. Não substitui apuração contábil ou fiscal.
        </span>
      </div>
    </div>
  );
};
