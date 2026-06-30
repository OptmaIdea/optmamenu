import { NumericFormat } from 'react-number-format';
import { Trash2 } from 'lucide-react';

interface CategoryFormFieldsProps {
    // Dados
    name: string;
    description: string;
    imageUrl: string | null;
    sortOrder: number;
    active: boolean;
    priceLogicType: 'standard' | 'category_volume';
    priceRules: { min: number; price: number }[];

    // Setters
    setName: (value: string) => void;
    setDescription: (value: string) => void;
    setImageUrl: (value: string | null) => void;
    setSortOrder: (value: number) => void;
    setActive: (value: boolean) => void;
    setPriceLogicType: (value: 'standard' | 'category_volume') => void;
    setPriceRules: (value: { min: number; price: number }[]) => void;

    // Upload
    onImageFileChange?: (file: File | null) => void;

    // Estado de desabilitado (read‑only)
    disabled?: boolean;
}

export default function CategoryFormFields({
    name,
    description,
    sortOrder,
    active,
    priceLogicType,
    priceRules,
    setName,
    setDescription,
    setSortOrder,
    setActive,
    setPriceLogicType,
    setPriceRules,
    disabled = false,
}: CategoryFormFieldsProps) {

    
    const handleSelectPricingMode = (mode: 'standard' | 'category_volume') => {
        setPriceLogicType(mode);

        if (mode === 'standard') {
            // Preço único: mantém somente 1 regra (min=0)
            const r0 = priceRules?.find(r => r.min === 0) ?? priceRules?.[0];
            setPriceRules([{ min: 0, price: r0?.price ?? 0 }]);
            return;
        }

        // Atacado (volume): garante pelo menos 1 regra inicial
        const safe = Array.isArray(priceRules) ? priceRules : [];
        if (safe.length === 0) {
            setPriceRules([{ min: 1, price: 0 }]);
        }
    };

    const getStandardPrice = () => {
        const r0 = priceRules?.find(r => r.min === 0) ?? priceRules?.[0];
        return typeof r0?.price === 'number' ? r0.price : 0;
    };

    const setStandardPrice = (price: number) => {
        setPriceRules([{ min: 0, price }]);
    };

const handleAddRule = () => {
        setPriceRules([...priceRules, { min: 0, price: 0 }]);
    };

    const handleRuleChange = (index: number, field: 'min' | 'price', value: string) => {
        const newRules = [...priceRules];
        newRules[index] = { ...newRules[index], [field]: parseFloat(value) || 0 };
        setPriceRules(newRules);
    };

    const handleRemoveRule = (index: number) => {
        setPriceRules(priceRules.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-6">
            {/* Grid de 2 colunas para campos principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coluna da esquerda: campos básicos */}
                <div className="space-y-4">
                    {/* Nome */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Nome da Categoria <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999]/20 focus:border-[#19A999] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                            placeholder="Ex: Picolés Cremosos"
                            required
                            disabled={disabled}
                        />
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Descrição
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={7}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999]/20 focus:border-[#19A999] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white resize-none"
                            placeholder="Descrição da categoria..."
                            disabled={disabled}
                        />
                    </div>

                    {/* Ordem de exibição */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Ordem de Exibição
                        </label>
                        <input
                            type="number"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                            min="0"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999]/20 focus:border-[#19A999] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                            disabled={disabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Número menor aparece primeiro no cardápio
                        </p>
                    </div>
                </div>

                {/* Coluna da direita: status e tipo de preço */}
                <div className="space-y-4">
                    {/* Status Ativo/Inativo */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Status
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setActive(true)}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${active
                                    ? 'bg-green-500 text-white shadow-md'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    }`}
                                disabled={disabled}
                            >
                                Ativo
                            </button>
                            <button
                                type="button"
                                onClick={() => setActive(false)}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${!active
                                    ? 'bg-red-500 text-white shadow-md'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    }`}
                                disabled={disabled}
                            >
                                Inativo
                            </button>
                        </div>
                    </div>

                    {/* Tipo de precificação */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Precificação
                        </label>
                        <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-full">
                            <button
                                type="button"
                                onClick={() => handleSelectPricingMode('standard')}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${priceLogicType === 'standard'
                                    ? 'bg-white dark:bg-gray-600 text-[#19A999] shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                    }`}
                                disabled={disabled}
                            >
                                Preço Padrão
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectPricingMode('category_volume')}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${priceLogicType === 'category_volume'
                                    ? 'bg-white dark:bg-gray-600 text-[#19A999] shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                    }`}
                                disabled={disabled}
                            >
                                Atacado (Volume)
                            </button>
                        </div>
                    </div>

                    {priceLogicType === 'standard' && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Preço único da categoria (R$)
                            </label>
                            <div className="flex items-center gap-3">
                                <span className="text-gray-500">R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={getStandardPrice()}
                                    onChange={(e) => setStandardPrice(Number(e.target.value || 0))}
                                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    disabled={disabled}
                                />
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Dica: este valor será aplicado a todos os produtos desta categoria. Para atacado por volume, use a aba "Atacado (Volume)".
                            </p>
                        </div>
                    )}

                    {/* Regras de atacado (se aplicável) */}
                    {priceLogicType === 'category_volume' && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                    Regras de Atacado
                                </label>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={handleAddRule}
                                        className="text-xs flex items-center gap-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition font-medium"
                                    >
                                        + Adicionar Regra
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                {priceRules.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic">
                                        Nenhuma regra de atacado configurada.
                                    </p>
                                ) : (
                                    priceRules.map((rule, index) => (
                                        <div
                                            key={index}
                                            className="flex gap-3 items-end bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                                        >
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                                                    A partir de (un)
                                                </label>
                                                <input
                                                    type="number"
                                                    className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                                                    value={rule.min}
                                                    onChange={(e) => handleRuleChange(index, 'min', e.target.value)}
                                                    min="1"
                                                    disabled={disabled}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                                                    Preço Unitário (R$)
                                                </label>
                                                <NumericFormat
                                                    className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
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
                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}