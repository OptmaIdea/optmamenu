import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    BellRing,
    Home,
    List,
    Menu,
    MessageCircle,
    PackageCheck,
    Search,
    ShieldCheck,
    ShoppingCart,
    UserRound,
    X,
} from 'lucide-react';

interface StorefrontBottomNavigationProps {
    storeSlug: string | null;
    storeName: string;
    cartCount: number;
    isAuthenticated: boolean;
    onOpenStore: () => void;
    onOpenContact: () => void;
}

export function StorefrontBottomNavigation({
    storeSlug,
    storeName,
    cartCount,
    isAuthenticated,
    onOpenStore,
    onOpenContact,
}: StorefrontBottomNavigationProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        if (!menuOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [menuOpen]);

    const homePath = storeSlug ? `/s/${encodeURIComponent(storeSlug)}` : location.pathname;

    const openAccount = (tab: 'profile' | 'orders' | 'consumption' | 'communications' | 'security' = 'profile') => {
        setMenuOpen(false);
        window.dispatchEvent(new CustomEvent(
            isAuthenticated ? 'optmamenu:open-customer-account' : 'optmamenu:open-customer-auth',
            isAuthenticated ? { detail: { tab } } : undefined,
        ));
    };

    const focusSearch = () => {
        setMenuOpen(false);
        if (location.pathname !== homePath) {
            navigate(homePath);
            window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent('optmamenu:focus-store-search'));
            }, 120);
            return;
        }
        window.dispatchEvent(new CustomEvent('optmamenu:focus-store-search'));
    };

    const goHome = () => {
        setMenuOpen(false);
        if (location.pathname === homePath) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            navigate(homePath);
        }
    };

    const navButton = 'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-black transition sm:text-xs';
    const muted = 'text-slate-500 dark:text-slate-400';
    const active = 'text-emerald-600 dark:text-emerald-400';

    return (
        <>
            <nav
                aria-label="Navegação da loja"
                className="safe-area-bottom fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-white/95 px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden"
            >
                <div className="mx-auto flex min-h-[4.6rem] max-w-3xl items-stretch">
                    <button
                        type="button"
                        onClick={goHome}
                        className={`${navButton} ${location.pathname === homePath ? active : muted}`}
                        aria-label="Início"
                    >
                        <Home className="h-5 w-5" />
                        <span>Início</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate(storeSlug ? `/checkout?store=${encodeURIComponent(storeSlug)}` : '/checkout')}
                        className={`${navButton} ${location.pathname === '/checkout' ? active : muted}`}
                        aria-label="Carrinho"
                    >
                        <span className="relative">
                            <ShoppingCart className="h-5 w-5" />
                            {cartCount > 0 && (
                                <span className="absolute -right-3 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-black text-white">
                                    {cartCount > 99 ? '99+' : cartCount}
                                </span>
                            )}
                        </span>
                        <span>Carrinho</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenStore}
                        className={`${navButton} ${muted}`}
                        aria-label={`Abrir área da ${storeName}`}
                    >
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-xl bg-emerald-100 px-2 text-[11px] font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {storeName.trim().slice(0, 1).toUpperCase() || 'L'}
                        </span>
                        <span className="max-w-full truncate px-1">{storeName || 'Loja'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => openAccount('profile')}
                        className={`${navButton} ${muted}`}
                        aria-label={isAuthenticated ? 'Perfil' : 'Entrar'}
                    >
                        <UserRound className="h-5 w-5" />
                        <span>{isAuthenticated ? 'Perfil' : 'Entrar'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setMenuOpen(true)}
                        className={`${navButton} ${menuOpen ? active : muted}`}
                        aria-label="Menu"
                    >
                        <Menu className="h-5 w-5" />
                        <span>Menu</span>
                    </button>
                </div>
            </nav>

            {menuOpen && (
                <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/45 backdrop-blur-sm lg:hidden">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="store-navigation-menu-title"
                        className="max-h-[88vh] w-full overflow-hidden rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-950"
                    >
                        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Navegação</p>
                                <h2 id="store-navigation-menu-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">{storeName}</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMenuOpen(false)}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                aria-label="Fechar menu"
                                autoFocus
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </header>

                        <div className="max-h-[calc(88vh-5rem)] overflow-y-auto p-4 pb-8">
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={focusSearch} className="flex min-h-24 flex-col items-start justify-between rounded-3xl bg-slate-100 p-4 text-left dark:bg-slate-900">
                                    <Search className="h-6 w-6 text-emerald-600" />
                                    <span className="font-black text-slate-900 dark:text-white">Buscar produtos</span>
                                </button>
                                <button type="button" onClick={onOpenStore} className="flex min-h-24 flex-col items-start justify-between rounded-3xl bg-slate-100 p-4 text-left dark:bg-slate-900">
                                    <List className="h-6 w-6 text-emerald-600" />
                                    <span className="font-black text-slate-900 dark:text-white">Sobre a loja</span>
                                </button>
                                {isAuthenticated && (
                                    <>
                                        <button type="button" onClick={() => openAccount('orders')} className="flex min-h-24 flex-col items-start justify-between rounded-3xl bg-slate-100 p-4 text-left dark:bg-slate-900">
                                            <PackageCheck className="h-6 w-6 text-emerald-600" />
                                            <span className="font-black text-slate-900 dark:text-white">Meus pedidos</span>
                                        </button>
                                        <button type="button" onClick={() => openAccount('consumption')} className="flex min-h-24 flex-col items-start justify-between rounded-3xl bg-slate-100 p-4 text-left dark:bg-slate-900">
                                            <ShoppingCart className="h-6 w-6 text-emerald-600" />
                                            <span className="font-black text-slate-900 dark:text-white">Meu consumo</span>
                                        </button>
                                        <button type="button" onClick={() => openAccount('communications')} className="flex min-h-24 flex-col items-start justify-between rounded-3xl bg-slate-100 p-4 text-left dark:bg-slate-900">
                                            <BellRing className="h-6 w-6 text-emerald-600" />
                                            <span className="font-black text-slate-900 dark:text-white">Comunicações</span>
                                        </button>
                                        <button type="button" onClick={() => openAccount('security')} className="flex min-h-24 flex-col items-start justify-between rounded-3xl bg-slate-100 p-4 text-left dark:bg-slate-900">
                                            <ShieldCheck className="h-6 w-6 text-emerald-600" />
                                            <span className="font-black text-slate-900 dark:text-white">Segurança</span>
                                        </button>
                                    </>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setMenuOpen(false);
                                    onOpenContact();
                                }}
                                className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 text-left font-black text-slate-700 dark:border-slate-800 dark:text-slate-200"
                            >
                                <MessageCircle className="h-5 w-5 text-emerald-600" />
                                Fale com a loja
                            </button>

                            {storeSlug && (
                                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                                    <Link to={`/s/${encodeURIComponent(storeSlug)}/legal/termos`} onClick={() => setMenuOpen(false)} className="rounded-2xl bg-slate-100 px-2 py-3 text-slate-600 dark:bg-slate-900 dark:text-slate-300">Termos</Link>
                                    <Link to={`/s/${encodeURIComponent(storeSlug)}/legal/privacidade`} onClick={() => setMenuOpen(false)} className="rounded-2xl bg-slate-100 px-2 py-3 text-slate-600 dark:bg-slate-900 dark:text-slate-300">Privacidade</Link>
                                    <Link to={`/s/${encodeURIComponent(storeSlug)}/legal/cookies`} onClick={() => setMenuOpen(false)} className="rounded-2xl bg-slate-100 px-2 py-3 text-slate-600 dark:bg-slate-900 dark:text-slate-300">Cookies</Link>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
