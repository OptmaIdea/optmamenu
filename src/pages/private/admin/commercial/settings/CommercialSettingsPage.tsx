import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    ExternalLink,
    Loader2,
    Save,
    Settings,
    ShieldCheck,
    Store,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import PageContainer from '@/components/common/PageContainer';
import {
    CommercialSettingsService,
    type CommercialSettingsStore,
    type StockLocationOption,
} from '@/services/commercialSettingsService';

function asNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export default function CommercialSettingsPage({ withoutHeader = false, disabled = false }: { withoutHeader?: boolean; disabled?: boolean } = {}) {
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [store, setStore] = useState<CommercialSettingsStore | null>(null);
    const [locations, setLocations] = useState<StockLocationOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [publicStoreEnabled, setPublicStoreEnabled] = useState(false);
    const [publicCatalogEnabled, setPublicCatalogEnabled] = useState(false);
    const [slug, setSlug] = useState('');
    const [minimumOrderValue, setMinimumOrderValue] = useState('0');
    const [reservationTimeMinutes, setReservationTimeMinutes] = useState('10');
    const [publicSalesLocationId, setPublicSalesLocationId] = useState('');

    const [whatsappBusiness, setWhatsappBusiness] = useState('');
    const [mainEmail, setMainEmail] = useState('');
    const [website, setWebsite] = useState('');
    const [socialMedia, setSocialMedia] = useState('');

    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const publicUrl = useMemo(() => {
        if (!slug) return '';
        return `/s/${slug}`;
    }, [slug]);

    async function loadData() {
        if (!storeId) return;

        try {
            setLoading(true);
            setError(null);
            setMessage(null);

            const [storeData, locationData] = await Promise.all([
                CommercialSettingsService.getStore(storeId),
                CommercialSettingsService.listStockLocations(storeId),
            ]);

            setStore(storeData);
            setLocations(locationData);

            setPublicStoreEnabled(Boolean(storeData.public_store_enabled));
            setPublicCatalogEnabled(Boolean(storeData.public_catalog_enabled));
            setSlug(storeData.slug || '');
            setMinimumOrderValue(String(asNumber(storeData.minimum_order_value, 0)));
            setReservationTimeMinutes(String(asNumber(storeData.reservation_time_minutes, 10)));
            setPublicSalesLocationId(storeData.public_sales_location_id || '');

            setWhatsappBusiness(storeData.contacts?.whatsapp_business || '');
            setMainEmail(storeData.contacts?.main_email || '');
            setWebsite(storeData.contacts?.website || '');
            setSocialMedia(storeData.contacts?.social_media || '');
        } catch (err: any) {
            console.error('Erro ao carregar configurações comerciais:', err);
            setError(err?.message || 'Erro ao carregar configurações comerciais.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadData();
        }
    }, [loadingStore, storeId]);

    async function handleSave() {
        if (!storeId) return;

        if (disabled) {
            toast.error('Você não tem permissão para executar esta alteração.');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setMessage(null);

            const result = await CommercialSettingsService.update({
                store_id: storeId,
                public_store_enabled: publicStoreEnabled,
                public_catalog_enabled: publicCatalogEnabled,
                slug,
                minimum_order_value: asNumber(minimumOrderValue, 0),
                reservation_time_minutes: Math.max(1, Math.floor(asNumber(reservationTimeMinutes, 10))),
                public_sales_location_id: publicSalesLocationId || null,
                whatsapp_business: whatsappBusiness,
                main_email: mainEmail,
                website,
                social_media: socialMedia,
            });

            if (!result.ok) {
                setError(result.message || result.error || 'Não foi possível salvar as configurações.');
                return;
            }

            setMessage('Configurações comerciais salvas com sucesso.');
            await loadData();
        } catch (err: any) {
            console.error('Erro ao salvar configurações comerciais:', err);
            setError(err?.message || 'Erro ao salvar configurações comerciais.');
        } finally {
            setSaving(false);
        }
    }

    if (loadingStore || loading) {
        return (
            <div className="p-6">
                <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <Loader2 className="animate-spin" size={20} />
                        Carregando configurações comerciais...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <PageContainer
            title="Configurações comerciais"
            subtitle="Configure a loja pública, o catálogo, o endereço por slug, WhatsApp, local de venda e regras comerciais básicas."
            category="Comercial"
            icon={<Settings size={28} className="text-[#19A999]" />}
            onRefresh={loadData}
            action={
                !disabled && publicUrl && (
                    <a
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 shadow-sm"
                    >
                        <ExternalLink size={16} />
                        Abrir loja
                    </a>
                )
            }
            withoutHeader={withoutHeader}
            flat
        >

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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                            <Store size={18} className="text-emerald-600" />
                            <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                Loja pública
                            </h2>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Loja ativa</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Permite acessar a loja por slug.
                                        </p>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={publicStoreEnabled}
                                        onChange={(event) => setPublicStoreEnabled(event.target.checked)}
                                        className="h-5 w-5"
                                        disabled={disabled}
                                    />
                                </div>
                            </label>

                            <label className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Catálogo ativo</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Exibe produtos no cardápio público.
                                        </p>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={publicCatalogEnabled}
                                        onChange={(event) => setPublicCatalogEnabled(event.target.checked)}
                                        className="h-5 w-5"
                                        disabled={disabled}
                                    />
                                </div>
                            </label>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Slug público
                                </label>
                                <input
                                    value={slug}
                                    onChange={(event) => setSlug(event.target.value.toLowerCase())}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    placeholder="gelinharessjn"
                                    disabled={disabled}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Use letras minúsculas, números e hífen. O nome deve ser exclusivo.
                                </p>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Local de venda pública
                                </label>
                                <select
                                    value={publicSalesLocationId}
                                    onChange={(event) => setPublicSalesLocationId(event.target.value)}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    disabled={disabled}
                                >
                                    <option value="">Selecionar automaticamente</option>
                                    {locations.map((location) => (
                                        <option key={location.id} value={location.id}>
                                            {location.name}
                                            {location.is_default ? ' — padrão' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            Regras comerciais
                        </h2>

                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Pedido mínimo padrão
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={minimumOrderValue}
                                    onChange={(event) => setMinimumOrderValue(event.target.value)}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    disabled={disabled}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Hoje usamos como referência para entrega. Retirada pode ficar sem mínimo.
                                </p>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Tempo de reserva, em minutos
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="240"
                                    value={reservationTimeMinutes}
                                    onChange={(event) => setReservationTimeMinutes(event.target.value)}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            Contatos e canais públicos
                        </h2>

                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    WhatsApp principal
                                </label>
                                <input
                                    value={whatsappBusiness}
                                    onChange={(event) => setWhatsappBusiness(event.target.value)}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    placeholder="5562999999999"
                                    disabled={disabled}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    E-mail principal
                                </label>
                                <input
                                    value={mainEmail}
                                    onChange={(event) => setMainEmail(event.target.value)}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    placeholder="loja@email.com"
                                    disabled={disabled}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Site
                                </label>
                                <input
                                    value={website}
                                    onChange={(event) => setWebsite(event.target.value)}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    placeholder="https://..."
                                    disabled={disabled}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Rede social principal
                                </label>
                                <input
                                    value={socialMedia}
                                    onChange={(event) => setSocialMedia(event.target.value)}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    placeholder="https://instagram.com/..."
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="space-y-4">
                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                        <div className="flex items-center gap-2 font-black">
                            <ShieldCheck size={18} />
                            Configuração segura
                        </div>
                        <p className="mt-2">
                            A slug é validada no banco para evitar duplicidade. O WhatsApp é
                            salvo normalizado em números.
                        </p>
                    </div>

                    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                            Loja atual
                        </p>
                        <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">
                            {store?.name || 'Loja'}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">/{slug}</p>
                    </div>

                    {!disabled && (
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Salvar configurações
                        </button>
                    )}
                </aside>
            </div>
        </PageContainer>
    );
}