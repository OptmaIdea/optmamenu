import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, Settings2, ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'optmamenu.cookieConsent';
const CONSENT_VERSION = '3.0';

type ConsentPreferences = {
    version: string;
    essential: true;
    analytics: boolean;
    marketing: boolean;
    decidedAt: string;
};

function readStoredConsent(): ConsentPreferences | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
        if (parsed.version !== CONSENT_VERSION) return null;
        return {
            version: CONSENT_VERSION,
            essential: true,
            analytics: Boolean(parsed.analytics),
            marketing: Boolean(parsed.marketing),
            decidedAt: parsed.decidedAt || new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

function clearNonEssentialCookies() {
    ['analytics', 'marketing'].forEach((name) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
    });
}

export default function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [analytics, setAnalytics] = useState(false);
    const [marketing, setMarketing] = useState(false);

    useEffect(() => {
        const stored = readStoredConsent();
        if (!stored) {
            setIsVisible(true);
            return;
        }
        setAnalytics(stored.analytics);
        setMarketing(stored.marketing);
    }, []);

    const saveConsent = (preferences: { analytics: boolean; marketing: boolean }) => {
        const payload: ConsentPreferences = {
            version: CONSENT_VERSION,
            essential: true,
            analytics: preferences.analytics,
            marketing: preferences.marketing,
            decidedAt: new Date().toISOString(),
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        localStorage.setItem('APP_COOKIE_CONSENT', preferences.analytics || preferences.marketing ? 'accepted' : 'rejected');
        localStorage.setItem('APP_COOKIE_CONSENT_VERSION', CONSENT_VERSION);

        if (!preferences.analytics || !preferences.marketing) clearNonEssentialCookies();

        window.dispatchEvent(new CustomEvent('optmamenu:cookie-consent', { detail: payload }));
        setIsVisible(false);
        setShowPreferences(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-[9999] border-t border-slate-200 bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto max-w-5xl p-4 sm:p-5">
                {!showPreferences ? (
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                <Cookie className="h-6 w-6" />
                            </span>
                            <div>
                                <h2 className="font-black text-slate-950 dark:text-white">Cookies e privacidade</h2>
                                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    Cookies essenciais mantêm o carrinho, a sessão e as preferências locais. Analytics e marketing só serão ativados com sua autorização.
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
                                    <Link to="/politica-privacidade" className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300">Política de Privacidade</Link>
                                    <Link to="/politica-privacidade#cookies" className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300">Informações sobre cookies</Link>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto">
                            <button type="button" onClick={() => saveConsent({ analytics: false, marketing: false })} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                                Só essenciais
                            </button>
                            <button type="button" onClick={() => setShowPreferences(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                                <Settings2 className="h-4 w-4" /> Preferências
                            </button>
                            <button type="button" onClick={() => saveConsent({ analytics: true, marketing: true })} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                                Aceitar todos
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                    <ShieldCheck className="h-6 w-6" />
                                </span>
                                <div>
                                    <h2 className="font-black text-slate-950 dark:text-white">Preferências de cookies</h2>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Escolha quais categorias podem ser usadas neste dispositivo.</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowPreferences(false)} className="rounded-full bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200" aria-label="Fechar preferências">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="font-black text-slate-900 dark:text-white">Essenciais</h3>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">Sempre ativos</span>
                                </div>
                                <p className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">Necessários para carrinho, autenticação, segurança e preferências básicas.</p>
                            </div>

                            <label className="cursor-pointer rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="font-black text-slate-900 dark:text-white">Analytics</h3>
                                    <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600" />
                                </div>
                                <p className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">Ajuda a entender uso, desempenho e pontos de melhoria sem alterar o funcionamento do pedido.</p>
                            </label>

                            <label className="cursor-pointer rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="font-black text-slate-900 dark:text-white">Marketing</h3>
                                    <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600" />
                                </div>
                                <p className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">Autoriza recursos promocionais e medição de campanhas quando forem configurados.</p>
                            </label>
                        </div>

                        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => saveConsent({ analytics: false, marketing: false })} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
                                Rejeitar opcionais
                            </button>
                            <button type="button" onClick={() => saveConsent({ analytics, marketing })} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                                Salvar preferências
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
