const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/pages/store/Catalog.tsx');
let source = fs.readFileSync(file, 'utf8');

const oldDestructure = `        clearCart,\n        setCategoryRules,\n    } = useCartStore();`;
const newDestructure = `        clearCart,\n        setCategoryRules,\n        syncCatalogPricing,\n    } = useCartStore();`;

if (!source.includes(oldDestructure)) {
    throw new Error('Bloco do carrinho não encontrado no Catalog.tsx');
}
source = source.replace(oldDestructure, newDestructure);

const oldSync = `                setCategories(normalizedCategories);\n                setCategoryRules(normalizedCategories);\n                setProducts(normalizedProducts);`;
const newSync = `                setCategories(normalizedCategories);\n                syncCatalogPricing(normalizedCategories, normalizedProducts);\n                setProducts(normalizedProducts);`;

if (!source.includes(oldSync)) {
    throw new Error('Bloco de sincronização do catálogo não encontrado no Catalog.tsx');
}
source = source.replace(oldSync, newSync);

fs.writeFileSync(file, source);
console.log('[public-catalog-pricing] Regras públicas e carrinho persistido sincronizados.');
