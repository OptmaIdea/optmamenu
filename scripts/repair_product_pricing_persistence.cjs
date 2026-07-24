const fs = require('fs');
const path = require('path');

const file = path.resolve('src/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal.tsx');
let source = fs.readFileSync(file, 'utf8');

const saveBefore = `            pricingMode: useCategoryPricing ? 'inherit' : 'custom',\n            priceLogicType,\n            priceRules: priceRules.map(r => ({ min: r.min, price: Number(r.price) || 0 })),`;
const saveAfter = `            pricingMode: useCategoryPricing ? 'inherit' : 'custom',\n            priceLogicType: pricingMode,\n            priceRules: priceRules.map(r => ({ min: r.min, price: Number(r.price) || 0 })),`;

if (!source.includes(saveBefore)) {
    throw new Error('Bloco de salvamento da precificação não encontrado.');
}
source = source.replace(saveBefore, saveAfter);

const resetBefore = `        setPricingMode('standard');\n        setPriceLogicType('standard');\n        setPriceRules([]);`;
const resetAfter = `        setPricingMode('standard');\n        setPriceLogicType('standard');\n        setUseCategoryPricing(true);\n        setPriceRules([]);`;

if (!source.includes(resetBefore)) {
    throw new Error('Bloco de reset da precificação não encontrado.');
}
source = source.replace(resetBefore, resetAfter);

fs.writeFileSync(file, source, 'utf8');
console.log('[product-pricing-persistence] Modo e faixas próprias do produto conectados ao salvamento.');
