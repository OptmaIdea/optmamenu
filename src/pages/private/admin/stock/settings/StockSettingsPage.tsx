import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Boxes,
    Loader2,
    PackageSearch,
    RefreshCw,
    Save,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import {
    StockSettingsService,
    type ProductStockRule,
    type ProductStockSettingsListItem,
    type UpdateProductStockRulePayload,
} from '@/services/stockSettingsService';

function toNumber(value: unknown, fallback = 0) {
    const normalizedValue = typeof value === 'string' ? value.replace(',', '.') : value;
    const parsed = Number(normalizedValue);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: unknown) {
    return toInteger(value, 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function formatStockNumber(value: unknown) {
    return toStockInteger(value, 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function toInteger(value: unknown, fallback = 0) {
    return Math.round(toNumber(value, fallback));
}

function toStockInteger(value: unknown, fallback = 0) {
    return toInteger(value, fallback);
}

function splitIntegerTotal(total: number, count: number) {
    if (count <= 0) return [];

    const base = Math.floor(total / count);
    const remainder = total - base * count;

    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function percentFromStock(value: number, total: number) {
    return total <= 0 ? 0 : toInteger((value / total) * 100, 0);
}

function sumRuleStock(rules: ProductStockRule[], field: 'min_stock' | 'max_stock') {
    return rules.reduce((sum, rule) => sum + toStockInteger(rule[field], 0), 0);
}

function normalizeStockRule(rule: ProductStockRule): ProductStockRule {
    return {
        ...rule,
        min_stock: rule.min_stock === null ? null : toStockInteger(rule.min_stock, 0),
        max_stock: rule.max_stock === null ? null : toStockInteger(rule.max_stock, 0),
        min_percent: rule.min_percent === null ? null : toInteger(rule.min_percent, 0),
        max_percent: rule.max_percent === null ? null : toInteger(rule.max_percent, 0),
    };
}

type DistributionField = 'min_percent' | 'max_percent' | 'min_stock' | 'max_stock';

function getErrorMessage(error: unknown, fallback = 'Erro desconhecido.') {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        return (error as { message: string }).message;
    }

    return fallback;
}

export default function StockSettingsPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [products, setProducts] = useState<ProductStockSettingsListItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [rules, setRules] = useState<ProductStockRule[]>([]);
    const [productName, setProductName] = useState('');

    const [search, setSearch] = useState('');
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingRules, setLoadingRules] = useState(false);
    const [saving, setSaving] = useState(false);

    const [minStock, setMinStock] = useState('0');
    const [maxStock, setMaxStock] = useState('0');
    const [distributionMode, setDistributionMode] = useState<'automatic' | 'manual'>('automatic');

    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const selectedProduct = useMemo(
        () => products.find((product) => product.id === selectedProductId) || null,
        [products, selectedProductId]
    );

    const minPercentTotal = useMemo(
        () => rules.reduce((sum, rule) => sum + toNumber(rule.min_percent, 0), 0),
        [rules]
    );

    const maxPercentTotal = useMemo(
        () => rules.reduce((sum, rule) => sum + toNumber(rule.max_percent, 0), 0),
        [rules]
    );

    const hasPercentWarning = minPercentTotal > 100.5 || maxPercentTotal > 100.5;

    async function loadProducts() {
        if (!storeId) return;

        try {
            setLoadingProducts(true);
            setError(null);

            const items = await StockSettingsService.listProducts(storeId, search, 150);
            setProducts(items);

            if (!selectedProductId && items.length > 0) {
                setSelectedProductId(items[0].id);
            }
        } catch (err: unknown) {
            console.error('Erro ao carregar produtos para configuração de estoque:', err);
            setError(getErrorMessage(err, 'Erro ao carregar produtos.'));
        } finally {
            setLoadingProducts(false);
        }
    }

    async function loadRules(productId: string) {
        if (!storeId || !productId) return;

        try {
            setLoadingRules(true);
            setError(null);
            setMessage(null);

            const result = await StockSettingsService.getProductRules(storeId, productId);

            if (!result.ok) {
                setError(result.message || result.error || 'Erro ao carregar regras do produto.');
                return;
            }

            setProductName(result.product?.name || '');
            setMinStock(String(toStockInteger(result.product?.min_stock, 0)));
            setMaxStock(String(toStockInteger(result.product?.max_stock, 0)));
            setRules((result.rules || []).map(normalizeStockRule));
        } catch (err: unknown) {
            console.error('Erro ao carregar regras de estoque:', err);
            setError(getErrorMessage(err, 'Erro ao carregar regras de estoque.'));
        } finally {
            setLoadingRules(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadProducts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingStore, storeId]);

    useEffect(() => {
        if (selectedProductId) {
            loadRules(selectedProductId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProductId]);

    function applyLinkedDistributionValue(
        rule: ProductStockRule,
        field: DistributionField,
        value: number | null
    ): ProductStockRule {
        const globalMin = toStockInteger(minStock, 0);
        const globalMax = toStockInteger(maxStock, 0);

        if (field === 'min_percent') {
            return {
                ...rule,
                min_percent: value,
                min_stock: value === null ? null : toStockInteger((globalMin * value) / 100, 0),
            };
        }

        if (field === 'max_percent') {
            return {
                ...rule,
                max_percent: value,
                max_stock: value === null ? null : toStockInteger((globalMax * value) / 100, 0),
            };
        }

        if (field === 'min_stock') {
            return {
                ...rule,
                min_stock: value,
                min_percent: value === null || globalMin <= 0 ? null : toInteger((value / globalMin) * 100, 0),
            };
        }

        return {
            ...rule,
            max_stock: value,
            max_percent: value === null || globalMax <= 0 ? null : toInteger((value / globalMax) * 100, 0),
        };
    }

    function updateRule(locationId: string, value: boolean) {
        setRules((previous) =>
            previous.map((rule) =>
                rule.location_id === locationId ? { ...rule, active: value } : rule
            )
        );
    }

    function updateDistributionRule(
        locationId: string,
        field: 'min_percent' | 'max_percent' | 'min_stock' | 'max_stock',
        value: string
    ) {
        if (value.trim() === '') {
            setRules((previous) =>
                previous.map((rule) =>
                    rule.location_id === locationId ? applyLinkedDistributionValue(rule, field, null) : rule
                )
            );
            return;
        }

        const isPercent = field === 'min_percent' || field === 'max_percent';
        const total = isPercent ? 100 : toStockInteger(field === 'min_stock' ? minStock : maxStock, 0);
        const nextValue = Math.min(Math.max(toInteger(value, 0), 0), total);

        if (distributionMode === 'manual') {
            setRules((previous) =>
                previous.map((rule) =>
                    rule.location_id === locationId ? applyLinkedDistributionValue(rule, field, nextValue) : rule
                )
            );
            return;
        }

        setRules((previous) => {
            const remainingRules = previous.filter((rule) => rule.location_id !== locationId);
            const shares = splitIntegerTotal(Math.max(total - nextValue, 0), remainingRules.length);
            let shareIndex = 0;

            return previous.map((rule) => {
                if (rule.location_id === locationId) {
                    return applyLinkedDistributionValue(rule, field, nextValue);
                }

                const share = shares[shareIndex] ?? 0;
                shareIndex += 1;
                return applyLinkedDistributionValue(rule, field, share);
            });
        });
    }

    function roundRuleInteger(locationId: string, field: 'min_percent' | 'max_percent' | 'min_stock' | 'max_stock') {
        setRules((previous) =>
            previous.map((rule) => {
                if (rule.location_id !== locationId) return rule;
                const value = rule[field];
                return applyLinkedDistributionValue(rule, field, value === null ? null : toInteger(value, 0));
            })
        );
    }

    function distributeEqually() {
        if (rules.length === 0) return;

        setRules((previous) => {
            if (previous.length === 0) return previous;

            const globalMin = minStock.trim()
                ? toStockInteger(minStock, 0)
                : toStockInteger(selectedProduct?.min_stock, sumRuleStock(previous, 'min_stock'));
            const globalMax = maxStock.trim()
                ? toStockInteger(maxStock, 0)
                : toStockInteger(selectedProduct?.max_stock, sumRuleStock(previous, 'max_stock'));
            const minShares = splitIntegerTotal(globalMin, previous.length);
            const maxShares = splitIntegerTotal(globalMax, previous.length);
            let shareIndex = 0;

            return previous.map((rule) => {
                const minShare = minShares[shareIndex] ?? 0;
                const maxShare = maxShares[shareIndex] ?? 0;
                shareIndex += 1;

                return {
                    ...rule,
                    use_percentage: true,
                    min_percent: percentFromStock(minShare, globalMin),
                    max_percent: percentFromStock(maxShare, globalMax),
                    min_stock: minShare,
                    max_stock: maxShare,
                };
            });
        });
    }

    function recalculateByPercent() {
        const globalMin = toStockInteger(minStock, 0);
        const globalMax = toStockInteger(maxStock, 0);

        setRules((previous) =>
            previous.map((rule) => ({
                ...rule,
                min_stock: toStockInteger((globalMin * toNumber(rule.min_percent, 0)) / 100, 0),
                max_stock: toStockInteger((globalMax * toNumber(rule.max_percent, 0)) / 100, 0),
            }))
        );
    }

    async function handleSave() {
        if (!storeId || !selectedProductId) return;

        if (toStockInteger(maxStock, 0) < toStockInteger(minStock, 0)) {
            setError('O estoque máximo global não pode ser menor que o mínimo global.');
            return;
        }

        if (hasPercentWarning) {
            setError('A soma dos percentuais não deve ultrapassar 100%.');
            return;
        }

        const payload: UpdateProductStockRulePayload[] = rules.map((rule) => ({
            location_id: rule.location_id,
            min_stock: rule.min_stock === null ? null : toStockInteger(rule.min_stock, 0),
            max_stock: rule.max_stock === null ? null : toStockInteger(rule.max_stock, 0),
            min_percent: rule.min_percent === null ? null : toInteger(rule.min_percent, 0),
            max_percent: rule.max_percent === null ? null : toInteger(rule.max_percent, 0),
            use_percentage: Boolean(rule.use_percentage),
            active: Boolean(rule.active),
        }));

        try {
            setSaving(true);
            setError(null);
            setMessage(null);

            const result = await StockSettingsService.updateProductRules({
                storeId,
                productId: selectedProductId,
                minStock: toStockInteger(minStock, 0),
                maxStock: toStockInteger(maxStock, 0),
                rules: payload,
            });

            if (!result.ok) {
                setError(result.message || result.error || 'Não foi possível salvar as regras.');
                return;
            }

            setMessage('Configurações de estoque salvas com sucesso.');
            await Promise.all([loadProducts(), loadRules(selectedProductId)]);
        } catch (err: unknown) {
            console.error('Erro ao salvar regras de estoque:', err);
            setError(getErrorMessage(err, 'Erro ao salvar regras de estoque.'));
        } finally {
            setSaving(false);
        }
    }

    if (loadingStore) {
        return (
            <div className="p-6">
                <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <Loader2 className="animate-spin" size={20} />
                        Carregando loja...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <SlidersHorizontal size={14} />
                            Estoque
                        </div>

                        <h1 className="mt-3 text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                            Configurações de estoque
                        </h1>

                        <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                            Configure mínimo/máximo global por produto e distribua os limites entre os locais
                            da loja, como estoque principal e loja física.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !selectedProductId || loadingRules}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Salvar regras
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            {message && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {message}
                </div>
            )}

            {hasPercentWarning && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                    A soma dos percentuais ultrapassou 100%. Ajuste antes de salvar.
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <aside className="lg:col-span-4">
                    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                            <PackageSearch size={18} className="text-blue-600" />
                            <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                Produtos
                            </h2>
                        </div>

                        <div className="mt-4 flex gap-2">
                            <div className="relative flex-1">
                                <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') loadProducts();
                                    }}
                                    placeholder="Buscar produto"
                                    className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={loadProducts}
                                disabled={loadingProducts}
                                className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {loadingProducts ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                            </button>
                        </div>

                        <div className="mt-4 max-h-160 space-y-2 overflow-y-auto pr-1">
                            {products.map((product) => {
                                const isSelected = product.id === selectedProductId;

                                return (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => setSelectedProductId(product.id)}
                                        className={`w-full rounded-2xl border p-3 text-left transition ${isSelected
                                            ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                                            : 'border-gray-100 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        <p className="font-bold text-gray-900 dark:text-white">
                                            {product.name}
                                        </p>

                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            {product.category_name || 'Sem categoria'}
                                        </p>

                                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                            <span>
                                                Mín: <strong>{formatStockNumber(product.min_stock)}</strong>
                                            </span>
                                            <span>
                                                Máx: <strong>{formatStockNumber(product.max_stock)}</strong>
                                            </span>
                                            <span>
                                                Disp: <strong>{formatStockNumber(product.total_available)}</strong>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}

                            {!loadingProducts && products.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    Nenhum produto encontrado.
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                <main className="space-y-6 lg:col-span-8">
                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Boxes size={18} className="text-blue-600" />
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                        {productName || selectedProduct?.name || 'Produto'}
                                    </h2>
                                </div>

                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Limites globais e distribuição por local.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={distributeEqually}
                                    disabled={!rules.length}
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    Dividir igualmente
                                </button>

                                <button
                                    type="button"
                                    onClick={recalculateByPercent}
                                    disabled={!rules.length}
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    Recalcular por %
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Estoque mínimo global
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="5"
                                    inputMode="numeric"
                                    value={minStock}
                                    onChange={(event) => setMinStock(event.target.value)}
                                    onBlur={() => setMinStock(String(toStockInteger(minStock, 0)))}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Estoque máximo global
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="5"
                                    inputMode="numeric"
                                    value={maxStock}
                                    onChange={(event) => setMaxStock(event.target.value)}
                                    onBlur={() => setMaxStock(String(toStockInteger(maxStock, 0)))}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                Distribuição por local
                            </h2>

                            <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-right">
                                <span>Min: {formatNumber(minPercentTotal)}%</span>
                                <span className="ml-3">Máx: {formatNumber(maxPercentTotal)}%</span>
                            </div>

                            <div className="inline-flex w-fit rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-950">
                                <button
                                    type="button"
                                    onClick={() => setDistributionMode('automatic')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${distributionMode === 'automatic'
                                        ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                                        }`}
                                >
                                    Autom&aacute;tico
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDistributionMode('manual')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${distributionMode === 'manual'
                                        ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                                        }`}
                                >
                                    Manual
                                </button>
                            </div>
                        </div>

                        {loadingRules ? (
                            <div className="mt-6 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                <Loader2 className="animate-spin" size={18} />
                                Carregando regras...
                            </div>
                        ) : (
                            <div className="mt-5 space-y-4">
                                {rules.map((rule) => (
                                    <div
                                        key={rule.location_id}
                                        className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <p className="font-black text-gray-900 dark:text-white">
                                                    {rule.location_name}
                                                </p>

                                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                    {rule.location_code || 'sem código'}
                                                    {rule.is_default ? ' • padrão' : ''}
                                                    {rule.allow_sales ? ' • vende' : ''}
                                                    {rule.allow_reservations ? ' • reserva' : ''}
                                                </p>
                                            </div>

                                            <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(rule.active)}
                                                    onChange={(event) =>
                                                        updateRule(rule.location_id, event.target.checked)
                                                    }
                                                />
                                                Ativo
                                            </label>
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    Mín %
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    inputMode="numeric"
                                                    value={rule.min_percent ?? ''}
                                                    onChange={(event) =>
                                                        updateDistributionRule(rule.location_id, 'min_percent', event.target.value)
                                                    }
                                                    onBlur={() => roundRuleInteger(rule.location_id, 'min_percent')}
                                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    Máx %
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    inputMode="numeric"
                                                    value={rule.max_percent ?? ''}
                                                    onChange={(event) =>
                                                        updateDistributionRule(rule.location_id, 'max_percent', event.target.value)
                                                    }
                                                    onBlur={() => roundRuleInteger(rule.location_id, 'max_percent')}
                                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    Mín local
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="5"
                                                    inputMode="numeric"
                                                    value={rule.min_stock ?? ''}
                                                    onChange={(event) =>
                                                        updateDistributionRule(rule.location_id, 'min_stock', event.target.value)
                                                    }
                                                    onBlur={() => roundRuleInteger(rule.location_id, 'min_stock')}
                                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    Máx local
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="5"
                                                    inputMode="numeric"
                                                    value={rule.max_stock ?? ''}
                                                    onChange={(event) =>
                                                        updateDistributionRule(rule.location_id, 'max_stock', event.target.value)
                                                    }
                                                    onBlur={() => roundRuleInteger(rule.location_id, 'max_stock')}
                                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-gray-50 p-3 text-xs dark:bg-gray-950">
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400">Físico</p>
                                                <p className="font-black text-gray-900 dark:text-white">
                                                    {formatStockNumber(rule.on_hand)}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400">Reservado</p>
                                                <p className="font-black text-gray-900 dark:text-white">
                                                    {formatStockNumber(rule.reserved)}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400">Disponível</p>
                                                <p className="font-black text-gray-900 dark:text-white">
                                                    {formatStockNumber(rule.available)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {!loadingRules && rules.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                        Nenhuma regra de estoque encontrada para este produto.
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}
