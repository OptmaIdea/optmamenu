import { NumericFormat } from 'react-number-format';
import { Trash2 } from 'lucide-react';
import type { CategoryVolumeScope } from '../types/category.types';

interface CategoryFormFieldsProps {
    name: string;
    description: string;
    imageUrl: string | null;
    sortOrder: number;
    active: boolean;
    priceLogicType: 'standard' | 'category_volume';
    volumeScope: CategoryVolumeScope;
    priceRules: { min: number; price: number }[];
    setName: (value: string) => void;
    setDescription: (value: string) => void;
    setImageUrl: (value: string | null) => void;
    setSortOrder: (value: number) => void;
    setActive: (value: boolean) => void;
    setPriceLogicType: (value: 'standard' | 'category_volume') => void;
    setVolumeScope: (value: CategoryVolumeScope) => void;
    setPriceRules: (value: { min: number; price: number }[]) => void;
    onImageFileChange?: (file: File | null) => void;
    disabled?: boolean;
}

export default function CategoryFormFields({
    name,
    description,
    sortOrder,
    active,
    priceLogicType,
    volumeScope,
    priceRules,
    setName,
    setDescription,
    setSortOrder,
    setActive,
    setPriceLogicType,
    setVolumeScope,
    setPriceRules,
    disabled = false,
}: CategoryFormFieldsProps) {
    const handleSelectPricingMode = (mode: 'standard' | 'category_volume') => {
        setPriceLogicType(mode);
        if (mode === 'standard') {
            const r0 = priceRules?.find(rule => rule.min === 0) ?? priceRules?.[0];
            setPriceRules([{ min: 0, price: r0?.price ?? 0 }]);
            return;
        }
        if (!Array.isArray(priceRules) || priceRules.length === 0) {
            setPriceRules([{ min: 1, price: 0 }]);
        }
    };

    const getStandardPrice = () => {
        const r0 = priceRules?.find(rule => rule.min === 0) ?? priceRules?.[0];
        return typeof r0?.price === 'number' ? r0.price : 0;
    };

    const setStandardPrice = (price: number) => setPriceRules([{ min: 0, price }]);
    const handleAddRule = () => setPriceRules([...priceRules, { min: 0, price: 0 }]);

    const handleRuleChange = (index: number, field: 'min' | 'price', value: string) => {
        const next = [...priceRules];
        next[index] = { ...next[index], [field]: Number.parseFloat(value) || 0 };
        setPriceRules(next);
    };

    const handleRemoveRule = (index: number) => {
        setPriceRules(priceRules.filter((_, currentIndex) => currentIndex !== index));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Nome da Categoria <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-gray-900 outline-none focus:border-[#19A999] focus:ring-2 focus:ring-[#19A999]/20 dark:border-gray-600 dark:bg-gray-900/50 dark:text-white"
                            placeholder="Ex: Picolés Cremosos"
                            required
                            disabled={disabled}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Descrição</label>
                        <textarea
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={7}
                            className="w-full resize-none rounded-lg border border-gray-300 bg-gray-50 p-3 text-gray-900 outline-none focus:border-[#19A999] focus:ring-2 focus:ring-[#19A999]/20 dark:border-gray-600 dark:bg-gray-900/50 dark:text-white"
                            placeholder="Descrição da categoria..."
                            disabled={disabled}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Ordem de Exibição</label>
                        <input
                            type="number"
                            value={sortOrder}
                            onChange={(event) => setSortOrder(Number.parseInt(event.target.value, 10) || 0)}
                            min="0"
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-gray-900 outline-none focus:border-[#19A999] focus:ring-2 focus:ring-[#19A999]/20 dark:border-gray-600 dark:bg-gray-900/50 dark:text-white"
                            disabled={disabled}
                        />
                        <p className="mt-1 text-xs text-gray-500">Número menor aparece primeiro no cardápio</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Status</label>
                        <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/30">
                            <button
                                type="button"
                                onClick={() => setActive(true)}
                                className={`flex-1 rounded-lg px-4 py-2 font-bold transition-all ${active ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                                disabled={disabled}
                            >
                                Ativo
                            </button>
                            <button
                                type="button"
                                onClick={() => setActive(false)}
                                className={`flex-1 rounded-lg px-4 py-2 font-bold transition-all ${!active ? 'bg-red-500 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                                disabled={disabled}
                            >
                                Inativo
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Precificação</label>
                        <div className="flex w-full rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                            <button
                                type="button"
                                onClick={() => handleSelectPricingMode('standard')}
                                className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${priceLogicType === 'standard' ? 'bg-white text-[#19A999] shadow-sm dark:bg-gray-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                                disabled={disabled}
                            >
                                Preço Padrão
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectPricingMode('category_volume')}
                                className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${priceLogicType === 'category_volume' ? 'bg-white text-[#19A999] shadow-sm dark:bg-gray-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                                disabled={disabled}
                            >
                                Atacado (Volume)
                            </button>
                        </div>
                    </div>

                    {priceLogicType === 'standard' && (
                        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Preço único da categoria (R$)</label>
                            <div className="flex items-center gap-3">
                                <span className="text-gray-500">R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={getStandardPrice()}
                                    onChange={(event) => setStandardPrice(Number(event.target.value || 0))}
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    )}

                    {priceLogicType === 'category_volume' && (
                        <>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                                <label className="mb-3 block text-sm font-bold text-gray-700 dark:text-gray-300">Como calcular o volume?</label>
                                <div className="grid gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setVolumeScope('combined')}
                                        className={`rounded-xl border p-3 text-left transition ${volumeScope === 'combined' ? 'border-[#19A999] bg-[#19A999]/10' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800'}`}
                                        disabled={disabled}
                                    >
                                        <span className="block font-bold text-gray-800 dark:text-white">Somar todos os produtos da categoria</span>
                                        <span className="mt-1 block text-xs text-gray-500">Ex.: 7 Chicletes + 1 Chocolate = faixa de 8 unidades para ambos.</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setVolumeScope('per_product')}
                                        className={`rounded-xl border p-3 text-left transition ${volumeScope === 'per_product' ? 'border-[#19A999] bg-[#19A999]/10' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800'}`}
                                        disabled={disabled}
                                    >
                                        <span className="block font-bold text-gray-800 dark:text-white">Calcular cada produto separadamente</span>
                                        <span className="mt-1 block text-xs text-gray-500">Cada sabor alcança sua própria faixa conforme sua quantidade individual.</span>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                                <div className="mb-3 flex items-center justify-between">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Regras de Atacado</label>
                                    {!disabled && (
                                        <button
                                            type="button"
                                            onClick={handleAddRule}
                                            className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                                        >
                                            + Adicionar Regra
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {priceRules.length === 0 ? (
                                        <p className="text-xs italic text-gray-500">Nenhuma regra de atacado configurada.</p>
                                    ) : (
                                        priceRules.map((rule, index) => (
                                            <div key={`${rule.min}-${index}`} className="flex items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                                                <div className="flex-1">
                                                    <label className="mb-1 block text-xs font-semibold text-gray-500">A partir de (un)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                                        value={rule.min}
                                                        onChange={(event) => handleRuleChange(index, 'min', event.target.value)}
                                                        min="0"
                                                        disabled={disabled}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="mb-1 block text-xs font-semibold text-gray-500">Preço Unitário (R$)</label>
                                                    <NumericFormat
                                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                                        value={rule.price}
                                                        onValueChange={(values) => handleRuleChange(index, 'price', values.value)}
                                                        decimalScale={2}
                                                        fixedDecimalScale
                                                        decimalSeparator=","
                                                        thousandSeparator="."
                                                        disabled={disabled}
                                                    />
                                                </div>
                                                {!disabled && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRule(index)}
                                                        className="rounded-lg p-2 text-red-500 transition hover:bg-red-500/10"
                                                        title="Remover regra"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
