import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Loader2, MessageCircle, Save, ShieldCheck, ShoppingBag, Smartphone, Store, Truck } from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import {
    OnlineOrderSettingsService,
    normalizeOnlineOrderSettings,
    type OnlineDeliveryMethodOption,
    type OnlineOrderSettingsPayload,
    type OnlineOrderSettingsStore,
    type StockLocationOption,
} from '@/services/onlineOrderSettingsService';

function asNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function ToggleCard({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="font-bold text-gray-900 dark:text-white">{title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
                </div>
                <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5" disabled={disabled} />
            </div>
        </label>
    );
}

export default function OnlineOrderSettingsPage({ withoutHeader = false, disabled = false }: { withoutHeader?: boolean; disabled?: boolean } = {}) {
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [store, setStore] = useState<OnlineOrderSettingsStore | null>(null);
    const [locations, setLocations] = useState<StockLocationOption[]>([]);
    const [deliveryMethods, setDeliveryMethods] = useState<OnlineDeliveryMethodOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [publicStoreEnabled, setPublicStoreEnabled] = useState(false);
    const [publicCatalogEnabled, setPublicCatalogEnabled] = useState(false);
    const [slug, setSlug] = useState('');
    const [minimumOrderValue, setMinimumOrderValue] = useState('0');
    const [reservationTimeMinutes, setReservationTimeMinutes] = useState('10');
    const [publicSalesLocationId, setPublicSalesLocationId] = useState('');
    const [whatsappBusiness, setWhatsappBusiness] = useState('');
    const [mainEmail, setMainEmail] = useState('');
    const [orderSettings, setOrderSettings] = useState<OnlineOrderSettingsPayload>(() => normalizeOnlineOrderSettings());

    const publicUrl = useMemo(() => (slug ? `/s/${slug}` : ''), [slug]);
    const publicMethods = useMemo(() => deliveryMethods.filter((method) => method.active && method.public_enabled), [deliveryMethods]);
    const deliveryMethodOptions = useMemo(() => publicMethods.filter((method) => method.fulfillment_type === 'delivery'), [publicMethods]);
    const pickupMethodOptions = useMemo(() => publicMethods.filter((method) => method.fulfillment_type === 'pickup'), [publicMethods]);

    async function loadData() {
        if (!storeId) return;
        try {
            setLoading(true);
            setError(null);
            setMessage(null);

            const [storeData, locationData, methodData] = await Promise.all([
                OnlineOrderSettingsService.getSettings(storeId),
                OnlineOrderSettingsService.listStockLocations(storeId),
                OnlineOrderSettingsService.listDeliveryMethods(storeId),
            ]);

            const normalized = normalizeOnlineOrderSettings(storeData.order_settings);
            setStore(storeData);
            setLocations(locationData);
            setDeliveryMethods(methodData);
            setPublicStoreEnabled(Boolean(storeData.public_store_enabled));
            setPublicCatalogEnabled(Boolean(storeData.public_catalog_enabled));
            setSlug(storeData.slug || '');
            setMinimumOrderValue(String(asNumber(storeData.minimum_order_value, 0)));
            setReservationTimeMinutes(String(asNumber(storeData.reservation_time_minutes, 10)));
            setPublicSalesLocationId(storeData.public_sales_location_id || '');
            setWhatsappBusiness(storeData.contacts?.whatsapp_business || '');
            setMainEmail(storeData.contacts?.main_email || '');
            setOrderSettings(normalized);
        } catch (err: any) {
            console.error('Erro ao carregar Pedido Online:', err);
            setError(err?.message || 'Erro ao carregar configurações do Pedido Online.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId) void loadData();
    }, [loadingStore, storeId]);

    function updateOrderSettings(partial: OnlineOrderSettingsPayload) {
        setOrderSettings((current) => normalizeOnlineOrderSettings({ ...current, ...partial }));
    }

    async function handleSave() {
        if (!storeId) return;
        if (disabled) {
            toast.error('Você não tem permissão para executar esta alteração.');
            return;
        }

        const normalizedSlug = slug.trim().toLowerCase();
        const currentSlug = (store?.slug || '').trim().toLowerCase();
        if (currentSlug && normalizedSlug !== currentSlug) {
            const confirmed = window.confirm(
                `Você está alterando o endereço público da loja.\n\nAtual: /s/${currentSlug}\nNovo: /s/${normalizedSlug}\n\nLinks e QR Codes antigos continuarão levando para esta mesma loja, mas novos materiais devem usar o endereço novo. Deseja continuar?`
            );
            if (!confirmed) return;
        }

        try {
            setSaving(true);
            setError(null);
            setMessage(null);

            const result = await OnlineOrderSettingsService.update({
                store_id: storeId,
                public_store_enabled: publicStoreEnabled,
                public_catalog_enabled: publicCatalogEnabled,
                slug: normalizedSlug,
                minimum_order_value: asNumber(minimumOrderValue, 0),
                reservation_time_minutes: Math.max(1, Math.floor(asNumber(reservationTimeMinutes, 10))),
                public_sales_location_id: publicSalesLocationId || null,
                whatsapp_business: whatsappBusiness,
                main_email: mainEmail,
                website: store?.contacts?.website as string | undefined,
                social_media: store?.contacts?.social_media as string | undefined,
                order_settings: normalizeOnlineOrderSettings(orderSettings),
            });

            if (!result.ok) {
                const errorMessage = result.message || result.error || 'Não foi possível salvar as configurações.';
                setError(errorMessage);
                toast.error(errorMessage);
                return;
            }

            setMessage('Configurações do Pedido Online salvas com sucesso.');
            toast.success('Pedido Online salvo com sucesso.');
            window.dispatchEvent(new CustomEvent('optmamenu:public-store-settings-changed', {
                detail: {
                    public_store_enabled: publicStoreEnabled,
                    slug,
                },
            }));
            await loadData();
        } catch (err: any) {
            console.error('Erro ao salvar Pedido Online:', err);
            const errorMessage = err?.message || 'Erro ao salvar configurações do Pedido Online.';
            setError(errorMessage);
            toast.error(errorMessage);
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
                        Carregando configurações do Pedido Online...
                    </div>
                </div>
            </div>
        );
    }

    const headerAction = publicUrl && !disabled ? (
        publicStoreEnabled ? (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 shadow-sm">
                <ExternalLink size={16} /> Abrir loja
            </a>
        ) : (
            <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500" title="Ative a loja pública para abrir o link.">
                <ExternalLink size={16} /> Loja desativada
            </span>
        )
    ) : undefined;

    return (
        <PageContainer
            title="Pedido Online"
            subtitle="Configure loja pública, catálogo, mínimo de entrega, retirada, WhatsApp e mensagens padrão."
            category="Configurações"
            icon={<Smartphone size={28} className="text-[#19A999]" />}
            onRefresh={loadData}
            action={headerAction}
            withoutHeader={withoutHeader}
            flat
        >
            {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
            {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</div>}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2"><Store size={18} className="text-emerald-600" /><h2 className="text-lg font-black text-gray-900 dark:text-white">Loja pública e catálogo</h2></div>
                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <ToggleCard title="Loja pública ativa" description="Permite acesso ao cardápio por slug público." checked={publicStoreEnabled} onChange={setPublicStoreEnabled} disabled={disabled} />
                            <ToggleCard title="Catálogo público ativo" description="Exibe produtos e categorias no cardápio público." checked={publicCatalogEnabled} onChange={setPublicCatalogEnabled} disabled={disabled} />
                            <ToggleCard title="Mostrar imagens" description="Exibe imagens cadastradas nos produtos." checked={Boolean(orderSettings.show_product_images)} onChange={(checked) => updateOrderSettings({ show_product_images: checked })} disabled={disabled} />
                            <ToggleCard title="Mostrar indisponíveis" description="Mantém produtos indisponíveis visíveis no catálogo." checked={Boolean(orderSettings.show_unavailable_products)} onChange={(checked) => updateOrderSettings({ show_unavailable_products: checked })} disabled={disabled} />
                        </div>
                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Slug público</label><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} minLength={3} maxLength={60} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" placeholder="gelinharessjn" disabled={disabled} /><p className="mt-1 text-xs text-gray-500">Link: {publicUrl || 'configure um slug'}</p>{store?.slug && slug.trim().toLowerCase() !== store.slug.trim().toLowerCase() && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">A mudança preservará o endereço antigo como alias protegido, mas novos QR Codes e materiais devem usar o novo link.</p>}</div>
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Local de venda pública</label><select value={publicSalesLocationId} onChange={(event) => setPublicSalesLocationId(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled}><option value="">Selecionar automaticamente</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.is_default ? ' — padrão' : ''}</option>)}</select></div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2"><Truck size={18} className="text-emerald-600" /><h2 className="text-lg font-black text-gray-900 dark:text-white">Entrega, retirada e mínimo</h2></div>
                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <ToggleCard title="Permitir entrega" description="Cliente poderá escolher entrega quando houver método público ativo." checked={Boolean(orderSettings.allow_delivery)} onChange={(checked) => updateOrderSettings({ allow_delivery: checked })} disabled={disabled} />
                            <ToggleCard title="Permitir retirada" description="Cliente poderá retirar no local sem endereço." checked={Boolean(orderSettings.allow_pickup)} onChange={(checked) => updateOrderSettings({ allow_pickup: checked })} disabled={disabled} />
                            <ToggleCard title="Mínimo na entrega" description="Aplica pedido mínimo na entrega." checked={Boolean(orderSettings.delivery_minimum_enabled)} onChange={(checked) => updateOrderSettings({ delivery_minimum_enabled: checked })} disabled={disabled} />
                            <ToggleCard title="Mínimo na retirada" description="Por padrão fica desligado: retirada sem mínimo." checked={Boolean(orderSettings.pickup_minimum_enabled)} onChange={(checked) => updateOrderSettings({ pickup_minimum_enabled: checked })} disabled={disabled} />
                        </div>
                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Pedido mínimo para entrega</label><input type="number" min="0" step="0.01" value={minimumOrderValue} onChange={(event) => setMinimumOrderValue(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled} /></div>
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Tempo de reserva, em minutos</label><input type="number" min="1" max="240" value={reservationTimeMinutes} onChange={(event) => setReservationTimeMinutes(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled} /></div>
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Método padrão para entrega</label><select value={(orderSettings.default_delivery_method_code as string) || ''} onChange={(event) => updateOrderSettings({ default_delivery_method_code: event.target.value || undefined })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled}><option value="">Automático</option>{deliveryMethodOptions.map((method) => <option key={method.id} value={method.code}>{method.name}</option>)}</select></div>
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Método padrão para retirada</label><select value={(orderSettings.default_pickup_method_code as string) || ''} onChange={(event) => updateOrderSettings({ default_pickup_method_code: event.target.value || undefined })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled}><option value="">Automático</option>{pickupMethodOptions.map((method) => <option key={method.id} value={method.code}>{method.name}</option>)}</select></div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2"><MessageCircle size={18} className="text-emerald-600" /><h2 className="text-lg font-black text-gray-900 dark:text-white">WhatsApp e mensagens padrão</h2></div>
                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <ToggleCard title="Finalizar por WhatsApp" description="Gera mensagem para confirmação manual pelo lojista." checked={Boolean(orderSettings.allow_whatsapp_checkout)} onChange={(checked) => updateOrderSettings({ allow_whatsapp_checkout: checked })} disabled={disabled} />
                            <ToggleCard title="Exigir telefone" description="Mantém telefone obrigatório no pedido público." checked={Boolean(orderSettings.require_customer_phone)} onChange={(checked) => updateOrderSettings({ require_customer_phone: checked })} disabled={disabled} />
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">WhatsApp principal</label><input value={whatsappBusiness} onChange={(event) => setWhatsappBusiness(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" placeholder="5562999999999" disabled={disabled} /></div>
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">E-mail principal</label><input value={mainEmail} onChange={(event) => setMainEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" placeholder="loja@email.com" disabled={disabled} /></div>
                        </div>
                        <div className="mt-5 space-y-4">
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Mensagem inicial do WhatsApp</label><textarea value={(orderSettings.whatsapp_order_message as string) || ''} onChange={(event) => updateOrderSettings({ whatsapp_order_message: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled} /></div>
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Instruções de retirada</label><textarea value={(orderSettings.pickup_instructions as string) || ''} onChange={(event) => updateOrderSettings({ pickup_instructions: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled} /></div>
                            <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Instruções de entrega</label><textarea value={(orderSettings.delivery_instructions as string) || ''} onChange={(event) => updateOrderSettings({ delivery_instructions: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" disabled={disabled} /></div>
                        </div>
                    </section>
                </div>

                <aside className="space-y-4">
                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"><div className="flex items-center gap-2 font-black"><ShieldCheck size={18} />Configuração integrada</div><p className="mt-2">Usa as regras comerciais, métodos de entrega e loja pública já cadastrados.</p></div>
                    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"><p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Loja atual</p><p className="mt-1 text-lg font-black text-gray-900 dark:text-white">{store?.name || 'Loja'}</p><p className="mt-1 text-sm text-gray-500">/{slug || 'slug'}</p></div>
                    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white"><ShoppingBag size={18} className="text-emerald-600" />Métodos públicos</div><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{publicMethods.length} método(s) público(s) ativo(s).</p></div>
                    {!disabled && <button type="button" onClick={handleSave} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}Salvar Pedido Online</button>}
                </aside>
            </div>
        </PageContainer>
    );
}
