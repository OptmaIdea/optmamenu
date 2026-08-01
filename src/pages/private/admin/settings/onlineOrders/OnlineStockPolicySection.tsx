import { useEffect, useMemo, useState } from 'react';
import { Boxes, Eye, EyeOff, Loader2, RotateCcw, Save, Search, SlidersHorizontal, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import type { OnlineOrderSettingsPayload, StockLocationOption } from '@/services/onlineOrderSettingsService';
import {
    OnlineStockProductSettingsService,
    type OnlineStockProductPolicy,
    type OnlineStockProductRow,
} from '@/services/onlineStockProductSettingsService';

interface OnlineStockPolicySectionProps {
    locations: StockLocationOption[];
    publicSalesLocationId: string;
    onPublicSalesLocationChange: (locationId: string) => void;
    settings: OnlineOrderSettingsPayload;
    onChange: (partial: OnlineOrderSettingsPayload) => void;
    disabled?: boolean;
}

function numberValue(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: string) {
    if (value.trim() === '') return null;
    return Math.max(0, numberValue(value, 0));
}

function effectiveNumber(override: number | null | undefined, fallback: unknown) {
    return override === null || override === undefined ? numberValue(fallback, 0) : numberValue(override, 0);
}

function onlinePreview(product: OnlineStockProductRow, policy: OnlineStockProductPolicy | null, settings: OnlineOrderSettingsPayload) {
    const reserve = effectiveNumber(policy?.local_reserve, settings.online_stock_local_reserve_default);
    const limit = policy?.online_limit === undefined || policy?.online_limit === null
        ? settings.online_stock_limit_default
        : policy.online_limit;
    const afterReserve = Math.max(0, product.available - reserve);
    return limit === null || limit === undefined ? afterReserve : Math.min(afterReserve, numberValue(limit, 0));
}

function ProductPolicyCard({
    product,
    defaults,
    disabled,
    onSaved,
}: {
    product: OnlineStockProductRow;
    defaults: OnlineOrderSettingsPayload;
    disabled: boolean;
    onSaved: (productId: string, policy: OnlineStockProductPolicy | null) => void;
}) {
    const { storeId } = useCurrentStore();
    const inheritedPublished = Boolean(defaults.online_stock_publish_products_by_default);
    const [published, setPublished] = useState(product.policy?.published ?? inheritedPublished);
    const [localReserve, setLocalReserve] = useState(product.policy?.local_reserve === null || product.policy?.local_reserve === undefined ? '' : String(product.policy.local_reserve));
    const [onlineLimit, setOnlineLimit] = useState(product.policy?.online_limit === null || product.policy?.online_limit === undefined ? '' : String(product.policy.online_limit));
    const [lowThreshold, setLowThreshold] = useState(product.policy?.low_stock_threshold === null || product.policy?.low_stock_threshold === undefined ? '' : String(product.policy.low_stock_threshold));
    const [showExact, setShowExact] = useState<boolean | null>(product.policy?.show_exact_stock ?? null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setPublished(product.policy?.published ?? inheritedPublished);
        setLocalReserve(product.policy?.local_reserve === null || product.policy?.local_reserve === undefined ? '' : String(product.policy.local_reserve));
        setOnlineLimit(product.policy?.online_limit === null || product.policy?.online_limit === undefined ? '' : String(product.policy.online_limit));
        setLowThreshold(product.policy?.low_stock_threshold === null || product.policy?.low_stock_threshold === undefined ? '' : String(product.policy.low_stock_threshold));
        setShowExact(product.policy?.show_exact_stock ?? null);
    }, [product.policy, inheritedPublished]);

    const draftPolicy: OnlineStockProductPolicy = {
        store_id: storeId || '',
        product_id: product.product_id,
        published,
        local_reserve: nullableNumber(localReserve),
        online_limit: nullableNumber(onlineLimit),
        low_stock_threshold: nullableNumber(lowThreshold),
        show_exact_stock: showExact,
    };
    const preview = onlinePreview(product, draftPolicy, defaults);
    const threshold = effectiveNumber(draftPolicy.low_stock_threshold, defaults.online_stock_low_threshold);
    const status = !published || preview <= 0 ? 'Indisponível' : threshold > 0 && preview <= threshold ? 'Poucas unidades' : 'Disponível';

    async function save() {
        if (!storeId) return;
        try {
            setSaving(true);
            const saved = await OnlineStockProductSettingsService.save({
                store_id: storeId,
                product_id: product.product_id,
                published,
                local_reserve: nullableNumber(localReserve),
                online_limit: nullableNumber(onlineLimit),
                low_stock_threshold: nullableNumber(lowThreshold),
                show_exact_stock: showExact,
            });
            onSaved(product.product_id, saved);
            toast.success(`${product.name}: regra online salva.`);
        } catch (error) {
            console.error('Erro ao salvar regra online do produto:', error);
            toast.error(`Não foi possível salvar a regra de ${product.name}.`);
        } finally {
            setSaving(false);
        }
    }

    async function reset() {
        if (!storeId) return;
        try {
            setSaving(true);
            await OnlineStockProductSettingsService.reset(storeId, product.product_id);
            onSaved(product.product_id, null);
            toast.success(`${product.name}: usando regras gerais.`);
        } catch (error) {
            console.error('Erro ao restaurar regra online do produto:', error);
            toast.error(`Não foi possível restaurar a regra de ${product.name}.`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <article className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex gap-3">
                <div className="h-14 w-14 flex-none overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                    {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : <Boxes className="m-4 text-gray-400" size={24} />}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="truncate font-black text-gray-900 dark:text-white">{product.name}</h3>
                            <p className="text-xs text-gray-500">{product.category_name || 'Sem categoria'}</p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-200">
                            <span>{published ? 'Publicado' : 'Oculto'}</span>
                            <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} className="h-5 w-5" disabled={disabled || saving} />
                        </label>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-950"><span className="block text-gray-500">Físico</span><strong>{product.on_hand}</strong></div>
                        <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-950"><span className="block text-gray-500">Reservado</span><strong>{product.reserved}</strong></div>
                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><span className="block">Online</span><strong>{preview}</strong></div>
                    </div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><label className="text-xs font-bold text-gray-600 dark:text-gray-300">Reserva local</label><input type="number" min="0" step="1" value={localReserve} onChange={(event) => setLocalReserve(event.target.value)} placeholder={`Herdar (${numberValue(defaults.online_stock_local_reserve_default, 0)})`} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" disabled={disabled || saving} /></div>
                <div><label className="text-xs font-bold text-gray-600 dark:text-gray-300">Teto online</label><input type="number" min="0" step="1" value={onlineLimit} onChange={(event) => setOnlineLimit(event.target.value)} placeholder={defaults.online_stock_limit_default == null ? 'Herdar (sem teto)' : `Herdar (${defaults.online_stock_limit_default})`} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" disabled={disabled || saving} /></div>
                <div><label className="text-xs font-bold text-gray-600 dark:text-gray-300">Poucas até</label><input type="number" min="0" step="1" value={lowThreshold} onChange={(event) => setLowThreshold(event.target.value)} placeholder={`Herdar (${numberValue(defaults.online_stock_low_threshold, 0)})`} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" disabled={disabled || saving} /></div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <select value={showExact === null ? 'inherit' : showExact ? 'yes' : 'no'} onChange={(event) => setShowExact(event.target.value === 'inherit' ? null : event.target.value === 'yes')} className="rounded-lg border border-gray-200 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950" disabled={disabled || saving}>
                    <option value="inherit">Quantidade: herdar regra geral</option>
                    <option value="yes">Mostrar quantidade exata</option>
                    <option value="no">Ocultar quantidade exata</option>
                </select>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${status === 'Disponível' ? 'bg-emerald-100 text-emerald-800' : status === 'Poucas unidades' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>{status}</span>
            </div>

            {!disabled && (
                <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                    {product.policy && <button type="button" onClick={reset} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"><RotateCcw size={14} />Usar regras gerais</button>}
                    <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Salvar produto</button>
                </div>
            )}
        </article>
    );
}

export default function OnlineStockPolicySection({ locations, publicSalesLocationId, onPublicSalesLocationChange, settings, onChange, disabled = false }: OnlineStockPolicySectionProps) {
    const { storeId } = useCurrentStore();
    const reserve = numberValue(settings.online_stock_local_reserve_default, 0);
    const threshold = numberValue(settings.online_stock_low_threshold, 5);
    const onlineLimit = settings.online_stock_limit_default;
    const selectedLocation = locations.find((location) => location.id === publicSalesLocationId);
    const [products, setProducts] = useState<OnlineStockProductRow[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [search, setSearch] = useState('');
    const [onlyPublished, setOnlyPublished] = useState(false);

    useEffect(() => {
        let active = true;
        async function loadProducts() {
            if (!storeId) return;
            try {
                setLoadingProducts(true);
                const rows = await OnlineStockProductSettingsService.list(storeId, publicSalesLocationId || null);
                if (active) setProducts(rows);
            } catch (error) {
                console.error('Erro ao carregar produtos da loja pública:', error);
                if (active) toast.error('Não foi possível carregar as regras online por produto.');
            } finally {
                if (active) setLoadingProducts(false);
            }
        }
        void loadProducts();
        return () => { active = false; };
    }, [storeId, publicSalesLocationId]);

    const visibleProducts = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('pt-BR');
        const inheritedPublished = Boolean(settings.online_stock_publish_products_by_default);
        return products.filter((product) => {
            const published = product.policy?.published ?? inheritedPublished;
            if (onlyPublished && !published) return false;
            if (!term) return true;
            return product.name.toLocaleLowerCase('pt-BR').includes(term) || (product.category_name || '').toLocaleLowerCase('pt-BR').includes(term);
        });
    }, [products, search, onlyPublished, settings.online_stock_publish_products_by_default]);

    function updateProductPolicy(productId: string, policy: OnlineStockProductPolicy | null) {
        setProducts((current) => current.map((product) => product.product_id === productId ? { ...product, policy } : product));
    }

    return (
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-2"><Boxes size={18} className="text-emerald-600" /><h2 className="text-lg font-black text-gray-900 dark:text-white">Estoque da loja pública</h2></div>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">A slug usa somente o saldo disponível do local escolhido. O estoque global e os demais locais não entram no cálculo público.</p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Local de estoque vinculado à slug</label><select value={publicSalesLocationId} onChange={(event) => onPublicSalesLocationChange(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled}><option value="">Selecionar automaticamente</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.code ? ` — ${location.code}` : ''}{location.is_default ? ' — padrão' : ''}</option>)}</select><p className="mt-1 text-xs text-gray-500">{selectedLocation ? `A disponibilidade pública será calculada em ${selectedLocation.name}.` : 'Sem seleção explícita, o backend tenta usar o local padrão ativo da loja.'}</p></div>
                <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Reserva mínima para venda local</label><input type="number" min="0" step="1" value={reserve} onChange={(event) => onChange({ online_stock_local_reserve_default: Math.max(0, numberValue(event.target.value, 0)) })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled} /><p className="mt-1 text-xs text-gray-500">Quantidade protegida para vendas presenciais antes de liberar saldo online.</p></div>
                <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Limite máximo disponível online</label><input type="number" min="0" step="1" value={onlineLimit === null || onlineLimit === undefined ? '' : String(onlineLimit)} onChange={(event) => onChange({ online_stock_limit_default: event.target.value === '' ? null : Math.max(0, numberValue(event.target.value, 0)) })} placeholder="Sem limite" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled} /><p className="mt-1 text-xs text-gray-500">Em branco, todo o saldo restante após a reserva local poderá ser vendido online.</p></div>
                <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Mostrar “Poucas unidades” até</label><input type="number" min="0" step="1" value={threshold} onChange={(event) => onChange({ online_stock_low_threshold: Math.max(0, numberValue(event.target.value, 0)) })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled} /><p className="mt-1 text-xs text-gray-500">Zero desativa o aviso de poucas unidades.</p></div>
                <label className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">{settings.online_stock_show_exact ? <Eye size={16} /> : <EyeOff size={16} />}Mostrar quantidade exata</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Quando desligado, o catálogo mostra apenas o estado público.</p></div><input type="checkbox" checked={Boolean(settings.online_stock_show_exact)} onChange={(event) => onChange({ online_stock_show_exact: event.target.checked })} className="h-5 w-5" disabled={disabled} /></div></label>
                <label className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 sm:col-span-2"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-bold text-gray-900 dark:text-white"><Store size={16} />Publicar produtos por padrão</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Produtos ativos entram na slug por padrão; a grade abaixo permite exceções individuais.</p></div><input type="checkbox" checked={Boolean(settings.online_stock_publish_products_by_default)} onChange={(event) => onChange({ online_stock_publish_products_by_default: event.target.checked })} className="h-5 w-5" disabled={disabled} /></div></label>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"><strong>Cálculo:</strong> disponível online = saldo disponível no local − reserva para venda local, limitado pelo teto online quando configurado. O resultado nunca fica negativo.</div>

            <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div><div className="flex items-center gap-2"><SlidersHorizontal size={17} className="text-emerald-600" /><h3 className="font-black text-gray-900 dark:text-white">Produtos publicados e exceções</h3></div><p className="mt-1 text-xs text-gray-500">Controle quais produtos entram na slug e sobrescreva as regras gerais somente quando necessário.</p></div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300"><input type="checkbox" checked={onlyPublished} onChange={(event) => setOnlyPublished(event.target.checked)} className="h-4 w-4" />Somente publicados</label>
                </div>

                <div className="relative mt-4"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto ou categoria" className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm dark:border-gray-700 dark:bg-gray-950" /></div>

                {!publicSalesLocationId && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">Selecione e salve explicitamente o local da slug para conferir os saldos por produto com segurança.</div>}

                {loadingProducts ? <div className="mt-5 flex items-center justify-center gap-2 py-8 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" />Carregando produtos e saldos...</div> : (
                    <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {visibleProducts.map((product) => <ProductPolicyCard key={product.product_id} product={product} defaults={settings} disabled={disabled} onSaved={updateProductPolicy} />)}
                        {visibleProducts.length === 0 && <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 xl:col-span-2">Nenhum produto encontrado para os filtros atuais.</div>}
                    </div>
                )}
            </div>
        </section>
    );
}
