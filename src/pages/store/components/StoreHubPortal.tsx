import { useEffect, useState } from 'react';
import {
    Award,
    CalendarClock,
    ExternalLink,
    FileText,
    Gift,
    Globe2,
    Instagram,
    Mail,
    MapPin,
    MessageCircle,
    Phone,
    ShieldCheck,
    Sparkles,
    Store,
    X,
} from 'lucide-react';
import {
    PublicStorefrontService,
    type PublicLoyaltyResponse,
    type PublicStorefrontStore,
} from '@/services/publicStorefrontService';
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
}

export function StoreHubPortal({ open, onClose, store }: StoreHubPortalProps) {
    const [loyaltyInfo, setLoyaltyInfo] = useState<PublicLoyaltyResponse | null>(null);
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const [showLoyaltyRules, setShowLoyaltyRules] = useState(false);

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

    useEffect(() => {
        if (!open || !store || !store.visual_config?.loyalty_active) {
            setLoyaltyInfo(null);
            setShowLoyaltyRules(false);
            return;
        }

        let active = true;
        setLoyaltyLoading(true);
        void PublicStorefrontService.getPublicLoyaltyProgramBySlug(store.slug)
            .then((result) => {
                if (active) setLoyaltyInfo(result);
            })
            .catch(() => {
                if (active) setLoyaltyInfo(null);
            })
            .finally(() => {
                if (active) setLoyaltyLoading(false);
            });

        return () => {
            active = false;
        };
    }, [open, store?.slug, store?.visual_config?.loyalty_active]);

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
    const loyaltyProgram = loyaltyInfo?.program || null;
    const loyaltyRewards = loyaltyInfo?.rewards || [];

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
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-white shadow-sm">
                            {(store.logo_url || config.visual_icon_url) ? (
                                <img src={store.logo_url || config.visual_icon_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <Store className="h-8 w-8 text-emerald-700" />
                            )}
                        </div>
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
                    {(config.about_text || config.about_image_url) && (
                        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                            {config.about_image_url && (
                                <img src={config.about_image_url} alt="" className="h-44 w-full object-cover sm:h-56" />
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

                    {config.loyalty_active && (
                        <section className="mt-4 overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white dark:border-amber-900/50 dark:from-amber-950/20 dark:via-slate-950 dark:to-slate-950">
                            <div className="p-5 sm:p-6">
                                <div className="flex items-start gap-4">
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white">
                                        <Gift className="h-6 w-6" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                                {loyaltyProgram?.name || `Clube de vantagens da ${store.name}`}
                                            </h3>
                                            <Sparkles className="h-4 w-4 text-amber-600" />
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                            Regras, campanhas, vantagens e prêmios divulgados pela própria loja ficam aqui.
                                        </p>
                                    </div>
                                </div>

                                {loyaltyLoading ? (
                                    <p className="mt-5 rounded-2xl bg-white/70 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-900/70 dark:text-slate-300">
                                        Carregando informações do programa…
                                    </p>
                                ) : loyaltyProgram ? (
                                    <>
                                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
                                                <CalendarClock className="h-5 w-5 text-amber-600" />
                                                <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-400">Validade</p>
                                                <p className="mt-1 font-black text-slate-900 dark:text-white">
                                                    {loyaltyProgram.points_validity_months
                                                        ? `${loyaltyProgram.points_validity_months} meses`
                                                        : 'Conforme regra'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
                                                <Sparkles className="h-5 w-5 text-emerald-600" />
                                                <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-400">Entrada</p>
                                                <p className="mt-1 font-black text-slate-900 dark:text-white">
                                                    {loyaltyProgram.enable_join_bonus && loyaltyProgram.join_bonus_points
                                                        ? `+${loyaltyProgram.join_bonus_points} pts`
                                                        : 'Sem bônus fixo'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
                                                <Gift className="h-5 w-5 text-fuchsia-600" />
                                                <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-400">Aniversário</p>
                                                <p className="mt-1 font-black text-slate-900 dark:text-white">
                                                    {loyaltyProgram.enable_birthday_bonus && loyaltyProgram.birthday_bonus_points
                                                        ? `+${loyaltyProgram.birthday_bonus_points} pts`
                                                        : 'Conforme campanha'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
                                                <Award className="h-5 w-5 text-blue-600" />
                                                <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-400">Resgates</p>
                                                <p className="mt-1 font-black text-slate-900 dark:text-white">
                                                    {loyaltyProgram.min_points_redemption
                                                        ? `A partir de ${loyaltyProgram.min_points_redemption} pts`
                                                        : 'Veja os prêmios'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-[0.15em] text-amber-700 dark:text-amber-300">Benefícios e prêmios</p>
                                                    <h4 className="mt-1 font-black text-slate-900 dark:text-white">Destaques disponíveis agora</h4>
                                                </div>
                                                <Award className="h-5 w-5 text-amber-600" />
                                            </div>

                                            {loyaltyRewards.length === 0 ? (
                                                <p className="mt-3 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                                                    Não há prêmio com vigência ativa neste momento. Novas campanhas aparecerão aqui quando a loja publicá-las.
                                                </p>
                                            ) : (
                                                <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                                                    {loyaltyRewards.map((reward) => (
                                                        <div key={reward.id} className="w-48 shrink-0 overflow-hidden rounded-2xl border border-amber-100 bg-white dark:border-amber-900/30 dark:bg-slate-900">
                                                            {reward.image_url ? (
                                                                <img src={reward.image_url} alt="" className="h-28 w-full object-cover" />
                                                            ) : (
                                                                <div className="flex h-28 items-center justify-center bg-amber-50 dark:bg-amber-950/20">
                                                                    <Gift className="h-8 w-8 text-amber-500" />
                                                                </div>
                                                            )}
                                                            <div className="p-3">
                                                                <p className="line-clamp-2 text-sm font-black text-slate-900 dark:text-white">{reward.title}</p>
                                                                <p className="mt-2 text-xs font-black text-amber-700 dark:text-amber-300">{reward.points_cost} pts</p>
                                                                {Number(reward.additional_cash_cost || 0) > 0 && (
                                                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                                        + R$ {Number(reward.additional_cash_cost || 0).toFixed(2).replace('.', ',')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setShowLoyaltyRules((current) => !current)}
                                            className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 text-sm font-black text-amber-800 transition hover:bg-amber-50 dark:border-amber-900/50 dark:bg-slate-900 dark:text-amber-200"
                                        >
                                            <FileText className="h-4 w-4" />
                                            {showLoyaltyRules ? 'Ocultar termos e regulamento' : 'Ver termos e regulamento'}
                                        </button>

                                        {showLoyaltyRules && (
                                            <div className="mt-3 space-y-3">
                                                <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                    {loyaltyProgram.program_terms || 'A loja ainda não publicou um regulamento detalhado.'}
                                                </div>
                                                {loyaltyProgram.voucher_terms && (
                                                    <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                        {loyaltyProgram.voucher_terms}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="mt-5 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                                        A fidelidade está habilitada, mas o programa institucional não está publicado neste momento.
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
                                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700">
                                    <MessageCircle className="h-4 w-4" /> WhatsApp
                                </a>
                            )}
                            {config.contact_email && (
                                <a href={`mailto:${config.contact_email}`} className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <Mail className="h-4 w-4" /> {config.contact_email}
                                </a>
                            )}
                            {(config.contact_phone || store.phone_number) && (
                                <a href={`tel:${config.contact_phone || store.phone_number}`} className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <Phone className="h-4 w-4" /> {config.contact_phone || store.phone_number}
                                </a>
                            )}
                            {mapUrl && (
                                <a href={mapUrl} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
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
