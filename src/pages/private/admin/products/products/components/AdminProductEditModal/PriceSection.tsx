import { NumericFormat } from 'react-number-format';
import { Trash2 } from 'lucide-react';
import type { PriceRule } from '../../types/product.types';

interface PriceSectionProps {
    pricingMode: 'inherit' | 'custom';
    onPricingModeChange: (mode: 'inherit' | 'custom') => void;
    priceLogicType: 'standard' | 'category_volume';
    onPriceLogicTypeChange: (type: 'standard' | 'category_volume') => void;
    priceRules: PriceRule[];
    onAddRule: () => void;
    onRuleChange: (index: number, field: 'min' | 'price', value: string) => void;
    onRemoveRule: (index: number) => void;
    categoryName?: string;
    categoryLogicType?: string;
    price: string;
    onPriceChange: (value: string) => void;
    isPriceDisabled: boolean;
    isPriceRequired: boolean;
}

export const PriceSection = ({
    pricingMode,
    onPricingModeChange,
    priceLogicType,
    onPriceLogicTypeChange,
    priceRules,
    onAddRule,
    onRuleChange,
    onRemoveRule,
    categoryName,
    categoryLogicType,
    price,
    onPriceChange,
    isPriceDisabled,
    isPriceRequired,
}: PriceSectionProps) => {
    return (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Precificação</h3>
            <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit mb-6">
                <button
                    type="button"
                    onClick={() => onPricingModeChange('inherit')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${pricingMode === 'inherit'
                            ? 'bg-white dark:bg-gray-600 text-[#21A896] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                >
                    Usar da Categoria
                </button>
                <button
                    type="button"
                    onClick={() => onPricingModeChange('custom')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${pricingMode === 'custom'
                            ? 'bg-white dark:bg-gray-600 text-[#21A896] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                >
                    Personalizado
                </button>
            </div>

            {pricingMode === 'inherit' ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-xl text-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-8 bg-[#21A896] rounded-full"></div>
                        <div>
                            <span className="font-bold block text-gray-800 dark:text-white">
                                Herdando da Categoria: {categoryName || 'Selecione uma categoria'}
                            </span>
                            <span className="text-xs">
                                Regra Atual: {categoryLogicType === 'category_volume' ? 'Atacado (Volume)' : 'Preço Padrão'}
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all ${priceLogicType === 'standard'
                                ? 'border-[#21A896] bg-[#21A896]/5 dark:bg-[#21A896]/10'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                            }`}>
                            <input
                                type="radio"
                                name="priceLogic"
                                value="standard"
                                checked={priceLogicType === 'standard'}
                                onChange={() => onPriceLogicTypeChange('standard')}
                                className="mt-1 accent-[#21A896]"
                            />
                            <div>
                                <span className={`block font-bold ${priceLogicType === 'standard' ? 'text-[#21A896]' : 'text-gray-800 dark:text-gray-200'
                                    }`}>
                                    Preço Padrão
                                </span>
                            </div>
                        </label>
                        <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all ${priceLogicType === 'category_volume'
                                ? 'border-[#21A896] bg-[#21A896]/5 dark:bg-[#21A896]/10'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                            }`}>
                            <input
                                type="radio"
                                name="priceLogic"
                                value="category_volume"
                                checked={priceLogicType === 'category_volume'}
                                onChange={() => onPriceLogicTypeChange('category_volume')}
                                className="mt-1 accent-[#21A896]"
                            />
                            <div>
                                <span className={`block font-bold ${priceLogicType === 'category_volume' ? 'text-[#21A896]' : 'text-gray-800 dark:text-gray-200'
                                    }`}>
                                    Atacado (Volume)
                                </span>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            <div className="mt-6">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    {priceLogicType === 'category_volume' && pricingMode === 'custom'
                        ? 'Preço Base (calculado via atacado)'
                        : 'Preço de Venda'}
                </label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-gray-400">R$</span>
                    <NumericFormat
                        className={`w-full pl-12 p-4 border rounded-xl outline-none transition-all text-lg font-bold ${isPriceDisabled
                                ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[#21A896]/20 focus:border-[#21A896] text-gray-900 dark:text-white'
                            }`}
                        value={price}
                        onValueChange={(values) => !isPriceDisabled && onPriceChange(values.value)}
                        decimalScale={2}
                        fixedDecimalScale
                        decimalSeparator=","
                        thousandSeparator="."
                        placeholder="0,00"
                        required={isPriceRequired}
                        disabled={isPriceDisabled}
                    />
                </div>
            </div>

            {pricingMode === 'custom' && priceLogicType === 'category_volume' && (
                <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Regras de Atacado
                        </label>
                        <button
                            type="button"
                            onClick={onAddRule}
                            className="text-xs flex items-center gap-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition font-medium"
                        >
                            + Adicionar Regra
                        </button>
                    </div>
                    <div className="space-y-3">
                        {priceRules.map((rule, index) => (
                            <div key={index} className="flex gap-4 items-end bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">A partir de (un)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-sm"
                                        value={rule.min}
                                        onChange={(e) => onRuleChange(index, 'min', e.target.value)}
                                        min="1"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Preço Unitário (R$)</label>
                                    <NumericFormat
                                        className="w-full p-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-sm"
                                        value={rule.price}
                                        onValueChange={(values) => onRuleChange(index, 'price', values.value)}
                                        decimalScale={2}
                                        fixedDecimalScale
                                        decimalSeparator=","
                                        thousandSeparator="."
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onRemoveRule(index)}
                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition mb-[1px]"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};