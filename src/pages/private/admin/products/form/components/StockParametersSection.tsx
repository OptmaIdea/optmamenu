import React from 'react';
import { Layers, AlertCircle, Info } from 'lucide-react';

interface StockParametersSectionProps {
  minStock: number;
  setMinStock: (val: number) => void;
  maxStock: number;
  setMaxStock: (val: number) => void;
  errors?: { minStock?: string; maxStock?: string };
}

export const StockParametersSection: React.FC<StockParametersSectionProps> = ({
  minStock,
  setMinStock,
  maxStock,
  setMaxStock,
  errors,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
        <div className="p-2 bg-[#19A999]/10 rounded-lg">
          <Layers size={18} className="text-[#19A999]" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base">Parâmetros de Estoque</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Defina os limites para alertas de estoque crítico ou excesso.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Estoque Mínimo */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            Estoque Mínimo Global
          </label>
          <input
            type="number"
            min={0}
            value={minStock}
            onChange={(e) => setMinStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
            placeholder="0"
            className={`w-full px-3 py-2.5 bg-white dark:bg-gray-700 border ${
              errors?.minStock ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-600'
            } rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white`}
          />
          {errors?.minStock ? (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} />
              {errors.minStock}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Dispara alertas de reposição quando a quantidade total atingir ou estiver abaixo deste valor.
            </p>
          )}
        </div>

        {/* Estoque Máximo */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            Estoque Máximo Global
          </label>
          <input
            type="number"
            min={0}
            value={maxStock}
            onChange={(e) => setMaxStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
            placeholder="0"
            className={`w-full px-3 py-2.5 bg-white dark:bg-gray-700 border ${
              errors?.maxStock ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-600'
            } rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white`}
          />
          {errors?.maxStock ? (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} />
              {errors.maxStock}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Evita compras ou movimentações em excesso além da capacidade recomendada.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
        <Info size={16} className="shrink-0" />
        <span>
          O saldo físico e disponível de estoque é gerenciado por localidade na tela de <strong>Estoque por Local</strong> ou via <strong>Entradas e Saídas</strong>.
        </span>
      </div>
    </div>
  );
};
