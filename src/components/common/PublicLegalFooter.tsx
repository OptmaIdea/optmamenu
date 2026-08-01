import { Link, useLocation } from 'react-router-dom';
import { Cookie, ExternalLink, ShieldCheck } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';

const TERMS_UPDATED_AT = '11/02/2026';
const PRIVACY_UPDATED_AT = '11/02/2026';
const COOKIES_VERSION = '1.0';

function isPrivatePath(pathname: string) {
    return pathname === '/pdv'
        || pathname.startsWith('/admin')
        || pathname.startsWith('/onboarding');
}

function slugFromPublicPath(pathname: string) {
    const match = pathname.match(/^\/(?:s|loja|cardapio|q|mesa)\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default function PublicLegalFooter() {
    const { pathname } = useLocation();
    const cartContext = useCartStore((state) => state.context);
    const cartItems = useCartStore((state) => state.items);

    if (isPrivatePath(pathname)) return null;

    const pathSlug = slugFromPublicPath(pathname);
    const storeSlug = pathSlug || (pathname === '/checkout' ? cartContext?.canonicalSlug : null);
    const storeLegalBase = storeSlug ? `/s/${encodeURIComponent(storeSlug)}/legal` : null;
    const hasFixedCartBar = Boolean(storeSlug && cartItems.length > 0 && !pathname.includes('/legal/'));

    const termsPath = storeLegalBase ? `${storeLegalBase}/termos` : '/terms';
    const privacyPath = storeLegalBase ? `${storeLegalBase}/privacidade` : '/politica-privacidade';
    const cookiesPath = storeLegalBase ? `${storeLegalBase}/cookies` : '/politica-cookies';

    const openCookiePreferences = () => {
        window.dispatchEvent(new CustomEvent('optmamenu:open-cookie-preferences'));
    };

    return (
        <footer className={`border-t border-slate-200 bg-white px-4 pt-8 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 ${hasFixedCartBar ? 'pb-36 sm:pb-32' : 'pb-8'}`}>
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                        <p className="font-black">Privacidade e transparência</p>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6">
                        {storeSlug
                            ? 'Consulte os documentos específicos desta loja e ajuste, a qualquer momento, as preferências de cookies deste dispositivo.'
                            : 'Consulte os documentos aplicáveis ao uso da plataforma e ajuste, a qualquer momento, as preferências de cookies deste dispositivo.'}
                    </p>
                    <nav aria-label="Documentos legais" className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold">
                        <Link to={termsPath} className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300">Termos de Uso</Link>
                        <Link to={privacyPath} className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300">Política de Privacidade</Link>
                        <Link to={cookiesPath} className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300">Política de Cookies</Link>
                        <button type="button" onClick={openCookiePreferences} className="inline-flex items-center gap-1.5 text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300">
                            <Cookie className="h-4 w-4" aria-hidden="true" /> Gerenciar cookies
                        </button>
                    </nav>
                </div>
                <div className="text-xs leading-5 text-slate-500 dark:text-slate-400 md:text-right">
                    <p>Termos atualizados em {TERMS_UPDATED_AT}</p>
                    <p>Privacidade atualizada em {PRIVACY_UPDATED_AT}</p>
                    <p>Cookies: versão {COOKIES_VERSION}</p>
                    <p className="mt-2">
                        <a href="https://optmamenu.optmaidea.com.br" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-slate-700 hover:underline dark:text-slate-200">OptmaMenu <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                        {' · '}
                        <a href="https://optmaidea.com.br" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-slate-700 hover:underline dark:text-slate-200">OptmaIdea <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                    </p>
                </div>
            </div>
        </footer>
    );
}
