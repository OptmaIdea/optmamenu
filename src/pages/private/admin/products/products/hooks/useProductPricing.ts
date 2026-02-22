import { useState } from 'react';
import type { PriceRule } from '../types/product.types';

export const useProductPricing = (
    initialRules: PriceRule[] = [],
    initialLogicType: 'standard' | 'category_volume' = 'standard',
    initialPricingMode: 'inherit' | 'custom' = 'inherit'
) => {
    const [pricingMode, setPricingMode] = useState<'inherit' | 'custom'>(initialPricingMode);
    const [priceLogicType, setPriceLogicType] = useState<'standard' | 'category_volume'>(initialLogicType);
    const [priceRules, setPriceRules] = useState<PriceRule[]>(initialRules);

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

    const resetPricing = () => {
        setPricingMode('inherit');
        setPriceLogicType('standard');
        setPriceRules([]);
    };

    return {
        pricingMode,
        setPricingMode,
        priceLogicType,
        setPriceLogicType,
        priceRules,
        setPriceRules,
        handleAddRule,
        handleRuleChange,
        handleRemoveRule,
        resetPricing,
    };
};