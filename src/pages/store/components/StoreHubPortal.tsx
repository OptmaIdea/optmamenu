import { useEffect } from 'react';
import {
    ExternalLink,
    Gift,
    Globe2,
    Instagram,
    Mail,
    MapPin,
    MessageCircle,
    Phone,
    ShieldCheck,
    Sparkles,
    X,
} from 'lucide-react';
import type { PublicStorefrontStore } from '@/services/publicStorefrontService';
import { buildWhatsappUrl, canOpenWhatsapp } from '@/utils/whatsapp';

function normalizeExternalUrl(value?: string | null) {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

interface StoreHubPortalProps {
    open: boolean;
    onClose: () => void;
    store: PublicStorefrontStore | null;
    authenticated: boolean;
    onOpenLoyalty: () => void;
}

export function StoreHubPortal({
    open,
    onClose,
    store,
    authenticated,
    onOpenLoyalty,
}: StoreHubPortalProps) {
    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, onClose]);

    if (!open || !store) return null;

    const config = store.visual_config || {};
    const supportWhatsapp = config.contact_whatsapp_support || store.whatsapp?.digits || store.phone_number || '';
    const whatsappUrl = canOpenWhatsapp(supportWhatsapp)
        ? buildWhatsappUrl(
            supportWhatsapp,
            `Olá! Vim pela loja online da ${store.name} e gostaria de falar com vocês.`,
        )
        : null;
    const mapUrl = normalizeExternalUrl(config.contact_map_link);
    const websiteUrl = normalizeExternalUrl(config.social_links?.website);
    const instagramUrl = normalizeExternalUrl(config.social_links?.instagram);
    const facebookUrl = normalizeExternalUrl(config.social_links?.facebook);

    return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4">
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="store-hub-title"
                className="max-h-[92vh] w-full overflow-hidden rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-950 sm:max-w-3xl sm:rounded-[2rem]"
            >
                <header
                    className="relative overflow-hidden px-5 pb-5 pt-6 text-white sm:px-7"
                    style={{ backgroundColor: config.visual_color_primary || '#19A999' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/30"
                        aria-label="Fechar área da loja"
                        autoFocus
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="flex items-center gap-4 pr-12">
                        {(store.logo_url || config.visual_icon_url) && (
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/30 bg-white shadow-sm">
                                <img
                                    src={store.logo_url || config.visual_icon_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/75">Conheça a loja</p>
                            <h2 id="store-hub-title" className="mt-1 truncate text-2xl font-black">{store.name}</h2>
                            {(config.visual_slogan || store.description) && (
                                <p className="mt-1 line-clamp-2 text-sm font-medium text-white/85">
                                    {config.visual_slogan || store.description}
                                </p>
                            )}
                        </div>
                    </div>
                </header>

                <div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-4 py-5 sm:px-7">
                    {config.loyalty_active && (
                        <button
                            type="button"
                            onClick={onOpenLoyalty}
                            className="mb-4 flex w-full items-center gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
                        >
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white">
                                <Gift className="h-6 w-6" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-black text-slate-900 dark:text-white">Pontos e benefícios</span>
                                <span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-slate-300">
                                    {authenticated
                                        ? 'Veja seus pontos, benefícios e regras do programa da loja.'
                                        : 'Entre para consultar participação, pontos e benefícios disponíveis.'}
                                </span>
                            </span>
                            <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
                        </button>
                    )}

                    {(config.about_text || config.about_image_url) && (
                        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                            {config.about_image_url && (
                                <img
                                    src={config.about_image_url}
                                    alt=""
                                    className="h-44 w-full object-cover sm:h-56"
                                />
                            )}
                            <div className="p-5">
                                <h3 className="font-black text-slate-900 dark:text-white">Sobre {store.name}</h3>
                                {config.about_text && (
                                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">
                                        {config.about_text}
                                    </p>
                                )}
                            </div>
                        </section>
                    )}

                    <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-emerald-600" />
                            <h3 className="font-black text-slate-900 dark:text-white">Fale com a loja</h3>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            Dúvidas sobre pedido, entrega, retirada ou produtos são respondidas pela própria {store.name}.
                        </p>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {whatsappUrl && (
                                <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex min-h-12 items-center gap-3 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700"
                                >
                                    <MessageCircle className="h-4 w-4" /> WhatsApp
                                </a>
                            )}
                            {config.contact_email && (
                                <a
                                    href={`mailto:${config.contact_email}`}
                                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    <Mail className="h-4 w-4" /> {config.contact_email}
                                </a>
                            )}
                            {(config.contact_phone || store.phone_number) && (
                                <a
                                    href={`tel:${config.contact_phone || store.phone_number}`}
                                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    <Phone className="h-4 w-4" /> {config.contact_phone || store.phone_number}
                                </a>
                            )}
                            {mapUrl && (
                                <a
                                    href={mapUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    <MapPin className="h-4 w-4" /> Ver no mapa
                                </a>
                            )}
                        </div>

                        {config.contact_address && (
                            <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                <strong>Endereço:</strong> {config.contact_address}
                            </p>
                        )}
                    </section>

                    {(instagramUrl || facebookUrl || websiteUrl) && (
                        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="font-black text-slate-900 dark:text-white">Acompanhe a loja</h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {instagramUrl && (
                                    <a href={instagramUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                                        <Instagram className="h-4 w-4" /> Instagram
                                    </a>
                                )}
                                {facebookUrl && (
                                    <a href={facebookUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                                        <Globe2 className="h-4 w-4" /> Facebook
                                    </a>
                                )}
                                {websiteUrl && (
                                    <a href={websiteUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                                        <ExternalLink className="h-4 w-4" /> Site
                                    </a>
                                )}
                            </div>
                        </section>
                    )}

                    <div className="mt-4 flex items-start gap-3 rounded-3xl bg-slate-100 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        <p>
                            Atendimento comercial, pedidos e informações desta página são responsabilidade da própria loja.
                            Os documentos de privacidade explicam separadamente o papel da infraestrutura tecnológica.
                        </p>
                    </div>

                    {config.footer_text && (
                        <p className="mt-5 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {config.footer_text}
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}
