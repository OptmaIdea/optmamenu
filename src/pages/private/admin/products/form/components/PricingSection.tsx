import React from 'react';
import { DollarSign, Plus, Trash2, Info, AlertCircle } from 'lucide-react';
import { NumericFormat } from 'react-number-format';
import type { FormPriceRule } from '../types/productForm.types';

interface PricingSectionProps {
  price: string;
  setPrice: (val: string) => void;
  pricingMode: 'standard' | 'category_volume';
  setPricingMode: (val: 'standard' | 'category_volume') => void;
  useCategoryPricing: boolean;
  setUseCategoryPricing: (val: boolean) => void;
  priceRules: FormPriceRule[];
  onAddRule: () => void;
  onRuleChange: (index: number, field: 'min' | 'price', value: string) => void;
  onRemoveRule: (index: number) => void;
  errors?: { price?: string };
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  price,
  setPrice,
  pricingMode,
  setPricingMode,
  useCategoryPricing,
  setUseCategoryPricing,
  priceRules,
  onAddRule,
  onRuleChange,
  onRemoveRule,
  errors,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
        <div className="p-2 bg-[#19A999]/10 rounded-lg">
          <DollarSign size={18} className="text-[#19A999]" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base">Preço e Regras de Precificação</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Defina o valor de venda e regras de preço do produto.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Opção de herança e modo */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            Modo de precificação
          </label>
          <select
            value={pricingMode}
            onChange={(e) => setPricingMode(e.target.value as 'standard' | 'category_volume')}
            className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white"
          >
            <option value="standard">Preço único padrão</option>
            <option value="category_volume">Atacado por faixas de quantidade</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl w-full cursor-pointer">
            <input
              type="checkbox"
              checked={useCategoryPricing}
              onChange={(e) => setUseCategoryPricing(e.target.checked)}
              className="w-4 h-4 text-[#19A999] rounded border-gray-300 focus:ring-[#19A999]"
            />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Herdar regras de preço da categoria selecionada
            </span>
          </label>
        </div>
      </div>

      {/* Preço Base */}
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
          Preço base (R$) {!useCategoryPricing && <span className="text-red-500">*</span>}
        </label>
        <NumericFormat
          value={price}
          onValueChange={(values) => setPrice(values.value)}
          decimalScale={2}
          fixedDecimalScale
          decimalSeparator=","
          thousandSeparator="."
          placeholder="0,00"
          disabled={useCategoryPricing}
          className={`w-full px-3 py-2.5 bg-white dark:bg-gray-700 border ${
            errors?.price ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-600'
          } rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500`}
        />
        {errors?.price && (
          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle size={12} />
            {errors.price}
          </p>
        )}
      </div>

      {useCategoryPricing && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-800 dark:text-blue-300 text-xs">
          <Info size={16} className="shrink-0" />
          <span>
            O preço deste produto é calculado automaticamente com base na categoria associada.
          </span>
        </div>
      )}

      {/* Tabela de regras de atacado por faixas se pricingMode for 'category_volume' e não usar preço da categoria */}
      {pricingMode === 'category_volume' && !useCategoryPricing && (
        <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Faixas de Desconto por Quantidade (Atacado)
            </label>
            <button
              type="button"
              onClick={onAddRule}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Adicionar Faixa</span>
            </button>
          </div>

          {priceRules.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              Nenhuma faixa de atacado cadastrada. Clique em "Adicionar Faixa" para definir descontos progressivos por quantidade.
            </p>
          ) : (
            <div className="space-y-2">
              {priceRules.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">
                      A partir de (unidades)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={rule.min}
                      onChange={(e) => onRuleChange(idx, 'min', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">
                      Preço unitário (R$)
                    </label>
                    <NumericFormat
                      value={rule.price}
                      onValueChange={(values) => onRuleChange(idx, 'price', values.value)}
                      decimalScale={2}
                      fixedDecimalScale
                      decimalSeparator=","
                      thousandSeparator="."
                      placeholder="0,00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveRule(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition mt-4 cursor-pointer"
                    title="Remover faixa"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
