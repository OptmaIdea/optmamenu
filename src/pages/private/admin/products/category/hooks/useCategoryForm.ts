import { useState } from 'react';
import type { Category, CategoryFormData, PriceRule, CategoryVolumeScope } from '../types/category.types';

export const useCategoryForm = (initialCategory?: Category | null) => {
    const [name, setName] = useState(initialCategory?.name || '');
    const [description, setDescription] = useState(initialCategory?.description || '');
    const [imageUrl, setImageUrl] = useState<string | null>(initialCategory?.image_url || null);
    const [sortOrder, setSortOrder] = useState(initialCategory?.sort_order || 0);
    const [active, setActive] = useState(initialCategory?.active ?? true);
    const [priceLogicType, setPriceLogicType] = useState<'standard' | 'category_volume'>(
        initialCategory?.price_logic_type || 'standard'
    );
    const [volumeScope, setVolumeScope] = useState<CategoryVolumeScope>(
        initialCategory?.pricing_strategy?.volume_scope || 'combined'
    );

    const normalizeRules = (logicType: 'standard' | 'category_volume', rules: PriceRule[]) => {
        const safe = Array.isArray(rules) ? rules.filter(r => r && typeof r.min === 'number' && typeof r.price === 'number') : [];
        if (logicType === 'standard') {
            const r0 = safe.find(r => r.min === 0) ?? safe[0];
            return [{ min: 0, price: r0?.price ?? 0 }];
        }
        return safe;
    };

    const [priceRules, setPriceRules] = useState<PriceRule[]>(
        normalizeRules(initialCategory?.price_logic_type || 'standard',
            Array.isArray(initialCategory?.price_rules) ? initialCategory.price_rules : [])
    );

    const resetForm = () => {
        setName('');
        setDescription('');
        setImageUrl(null);
        setSortOrder(0);
        setActive(true);
        setPriceLogicType('standard');
        setVolumeScope('combined');
        setPriceRules([{ min: 0, price: 0 }]);
    };

    const loadCategory = (category: Category) => {
        setName(category.name);
        setDescription(category.description || '');
        setImageUrl(category.image_url ?? null);
        setSortOrder(category.sort_order);
        setActive(category.active);
        setPriceLogicType(category.price_logic_type);
        setVolumeScope(category.pricing_strategy?.volume_scope || 'combined');
        setPriceRules(normalizeRules(category.price_logic_type, Array.isArray(category.price_rules) ? category.price_rules : []));
    };

    const getFormData = (): CategoryFormData => ({
        name,
        description,
        image_url: imageUrl,
        sort_order: sortOrder,
        active,
        price_logic_type: priceLogicType,
        price_rules: priceRules,
        pricing_strategy: {
            volume_scope: volumeScope,
        },
    });

    return {
        name, setName,
        description, setDescription,
        imageUrl, setImageUrl,
        sortOrder, setSortOrder,
        active, setActive,
        priceLogicType, setPriceLogicType,
        volumeScope, setVolumeScope,
        priceRules, setPriceRules,
        resetForm,
        loadCategory,
        getFormData,
    };
};
