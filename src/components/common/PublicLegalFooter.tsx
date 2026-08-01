import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Cookie,
    ExternalLink,
    Facebook,
    Globe2,
    Instagram,
    Mail,
    Music2,
    ShieldCheck,
    Twitter,
} from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { PublicStorefrontService } from '@/services/publicStorefrontService';
import type { StoreConfig } from '@/types';

const TERMS_UPDATED_AT = '11/02/2026';
const PRIVACY_UPDATED_AT = '11/02/2026';
const COOKIES_VERSION = '1.0';
const APP_VERSION = '0.10.0-rc.1';
const CURRENT_YEAR = 2026;

function isPrivatePath(pathname: string) {
    return pathname === '/pdv'
        || pathname.startsWith('/admin')
        || pathname.startsWith('/onboarding');
}

function slugFromPublicPath(pathname: string) {
    const match = pathname.match(/^\/(?:s|loja|cardapio|q|mesa)\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function normalizeExternalUrl(value?: string) {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

type SocialLink = {
    key: string;
    label: string;
    href: string;
    icon: React.ReactNode;
};

export default function PublicLegalFooter() {
    const { pathname } = useLocation();
    const cartContext = useCartStore((state) => state.context);
    const cartItems = useCartStore((state) => state.items);
    const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);

    const pathSlug = slugFromPublicPath(pathname);
    const storeSlug = pathSlug || (pathname === '/checkout' ? cartContext?.canonicalSlug : null);

    useEffect(() => {
        let active = true;

        async function loadPublicStoreConfig() {
            if (!storeSlug) {
                setStoreConfig(null);
                return;
            }

            try {
                const result = await PublicStorefrontService.getStorefrontBySlug(storeSlug);
                if (!active) return;
                setStoreConfig(result.ok && result.store ? result.store.visual_config || null : null);
            } catch {
                if (active) setStoreConfig(null);
            }
        }

        void loadPublicStoreConfig();
        return () => { active = false; };
    }, [storeSlug]);

    if (isPrivatePath(pathname)) return null;

    const storeLegalBase = storeSlug ? `/s/${encodeURIComponent(storeSlug)}/legal` : null;
    const hasFixedCartBar = Boolean(storeSlug && cartItems.length > 0 && !pathname.includes('/legal/'));

    const termsPath = storeLegalBase ? `${storeLegalBase}/termos` : '/terms';
    const privacyPath = storeLegalBase ? `${storeLegalBase}/privacidade` : '/politica-privacidade';
    const cookiesPath = storeLegalBase ? `${storeLegalBase}/cookies` : '/politica-cookies';

    const socialLinks = Object.entries({
        instagram: {
            label: 'Instagram',
            href: normalizeExternalUrl(storeConfig?.social_links?.instagram),
            icon: <Instagram className="h-5 w-5" aria-hidden="true" />,
        },
        facebook: {
            label: 'Facebook',
            href: normalizeExternalUrl(storeConfig?.social_links?.facebook),
            icon: <Facebook className="h-5 w-5" aria-hidden="true" />,
        },
        tiktok: {
            label: 'TikTok',
            href: normalizeExternalUrl(storeConfig?.social_links?.tiktok),
            icon: <Music2 className="h-5 w-5" aria-hidden="true" />,
        },
        twitter: {
            label: 'X / Twitter',
            href: normalizeExternalUrl(storeConfig?.social_links?.twitter),
            icon: <Twitter className="h-5 w-5" aria-hidden="true" />,
        },
        website: {
            label: 'Site da loja',
            href: normalizeExternalUrl(storeConfig?.social_links?.website),
            icon: <Globe2 className="h-5 w-5" aria-hidden="true" />,
        },
    })
        .filter((entry): entry is [string, { label: string; href: string; icon: React.ReactNode }] => Boolean(entry[1].href))
        .map(([key, value]): SocialLink => ({ key, ...value }));

    const openCookiePreferences = () => {
        window.dispatchEvent(new CustomEvent('optmamenu:open-cookie-preferences'));
    };

    return (
        <footer className={`border-t border-slate-200 bg-slate-100 px-4 pt-7 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 ${hasFixedCartBar ? 'pb-36 sm:pb-32' : 'pb-7'}`}>
            <div className="mx-auto max-w-5xl">
                <div className="flex items-center justify-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <span>Privacidade e transparência</span>
                </div>

                <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">
                    {storeSlug
                        ? 'Documentos da loja e preferências de privacidade deste dispositivo.'
                        : 'Documentos da plataforma e preferências de privacidade deste dispositivo.'}
                </p>

                <nav aria-label="Documentos legais" className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-bold">
                    <Link to={termsPath} className="text-slate-700 underline-offset-4 hover:underline dark:text-slate-200">Termos de Uso</Link>
                    <Link to={privacyPath} className="text-slate-700 underline-offset-4 hover:underline dark:text-slate-200">Privacidade</Link>
                    <Link to={cookiesPath} className="text-slate-700 underline-offset-4 hover:underline dark:text-slate-200">Cookies</Link>
                    <button type="button" onClick={openCookiePreferences} className="inline-flex items-center gap-1.5 text-slate-700 underline-offset-4 hover:underline dark:text-slate-200">
                        <Cookie className="h-4 w-4" aria-hidden="true" /> Gerenciar cookies
                    </button>
                </nav>

                {socialLinks.length > 0 && (
                    <div aria-label="Redes sociais da loja" className="mt-5 flex items-center justify-center gap-2">
                        {socialLinks.map((social) => (
                            <a
                                key={social.key}
                                href={social.href}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={social.label}
                                title={social.label}
                                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                            >
                                {social.icon}
                            </a>
                        ))}
                    </div>
                )}

                <div className="mx-auto mt-5 max-w-3xl border-t border-slate-300 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                        <span>© {CURRENT_YEAR}</span>
                        <a href="https://optmaidea.com.br" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-slate-700 hover:underline dark:text-slate-200">
                            OptmaIdea <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                        <span>·</span>
                        <a href="https://optmamenu.optmaidea.com.br" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-slate-700 hover:underline dark:text-slate-200">
                            OptmaMenu ver. {APP_VERSION} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                        <span>· {CURRENT_YEAR}</span>
                    </p>

                    <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                        <span>Termos atualizados em {TERMS_UPDATED_AT}</span>
                        <span aria-hidden="true">|</span>
                        <span>Privacidade atualizada em {PRIVACY_UPDATED_AT}</span>
                        <span aria-hidden="true">|</span>
                        <span>Cookies: versão {COOKIES_VERSION}</span>
                    </p>

                    <a href="mailto:faleconosco@optmaidea.com.br" className="mt-2 inline-flex items-center gap-1.5 font-bold text-slate-600 hover:underline dark:text-slate-300">
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" /> faleconosco@optmaidea.com.br
                    </a>
                </div>
            </div>
        </footer>
    );
}
