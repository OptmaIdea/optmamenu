import { Link, useLocation } from 'react-router-dom';
import { Cookie, ExternalLink, ShieldCheck } from 'lucide-react';

const TERMS_UPDATED_AT = '11/02/2026';
const PRIVACY_UPDATED_AT = '11/02/2026';
const COOKIES_VERSION = '1.0';

function isPrivatePath(pathname: string) {
    return pathname === '/pdv'
        || pathname.startsWith('/admin')
        || pathname.startsWith('/onboarding');
}

export default function PublicLegalFooter() {
    const { pathname } = useLocation();

    if (isPrivatePath(pathname)) return null;

    const openCookiePreferences = () => {
        window.dispatchEvent(new CustomEvent('optmamenu:open-cookie-preferences'));
    };

    return (
        <footer className="border-t border-slate-200 bg-white px-4 py-8 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                        <p className="font-black">Privacidade e transparência</p>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6">
                        Consulte os documentos aplicáveis ao uso da plataforma e ajuste, a qualquer momento, as preferências de cookies deste dispositivo.
                    </p>
                    <nav aria-label="Documentos legais" className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold">
                        <Link to="/terms" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300">Termos de Uso</Link>
                        <Link to="/politica-privacidade" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300">Política de Privacidade</Link>
                        <Link to="/politica-cookies" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300">Política de Cookies</Link>
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
