import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    BellRing,
    Gift,
    Home,
    LogOut,
    Menu,
    MessageCircle,
    Monitor,
    Moon,
    PackageCheck,
    Search,
    ShieldCheck,
    ShoppingCart,
    Store,
    Sun,
    UserRound,
    X,
} from 'lucide-react';
import { formatBRL } from '@/utils/pricing';

type ThemeMode = 'light' | 'dark' | 'system';

interface StorefrontBottomNavigationProps {
    storeSlug: string | null;
    storeName: string;
    isAuthenticated: boolean;
    checkoutPath: string;
    cartCount: number;
    cartTotal: number;
    cartLabel?: string;
    onOpenStore: () => void;
    onOpenContact: () => void;
    onLogout: () => void | Promise<void>;
}

function readThemeMode(): ThemeMode {
    try {
        const stored = window.localStorage.getItem('optmamenu-storefront-theme');
        if (stored === 'dark' || stored === 'system') return stored;
    } catch {
        // fallback
    }
    return 'light';
}

export function StorefrontBottomNavigation({
    storeSlug,
    storeName,
    isAuthenticated,
    checkoutPath,
    cartCount,
    cartTotal,
    cartLabel = 'Carrinho',
    onOpenStore,
    onOpenContact,
    onLogout,
}: StorefrontBottomNavigationProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeMode());

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

    const openAccount = (
        tab: 'profile' | 'orders' | 'consumption' | 'loyalty' | 'messages' | 'security' = 'profile',
    ) => {
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

    const selectThemeMode = (mode: ThemeMode) => {
        setThemeMode(mode);
        try {
            window.localStorage.setItem('optmamenu-storefront-theme', mode);
        } catch {
            // tema ainda é aplicado nesta sessão
        }
        window.dispatchEvent(new CustomEvent('optmamenu:storefront-theme-mode', {
            detail: { mode },
        }));
    };

    const doLogout = async () => {
        setMenuOpen(false);
        await onLogout();
    };

    const navButton = 'relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-black transition sm:text-xs';
    const muted = 'text-slate-500 dark:text-slate-400';
    const active = 'text-emerald-600 dark:text-emerald-400';
    const menuTile = 'flex min-h-24 flex-col items-start justify-between rounded-3xl bg-slate-100 p-4 text-left dark:bg-slate-900';

    return (
        <>
            <nav
                aria-label="Navegação da loja"
                className="safe-area-bottom fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-white/95 px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
            >
                <div className="mx-auto grid min-h-[4.6rem] max-w-3xl grid-cols-5 items-stretch">
                    <button type="button" onClick={goHome} className={`${navButton} ${location.pathname === homePath ? active : muted}`} aria-label="Início">
                        <Home className="h-5 w-5" />
                        <span>Início</span>
                    </button>
                    <button type="button" onClick={onOpenStore} className={`${navButton} ${muted}`} aria-label={`Abrir área da ${storeName}`}>
                        <Store className="h-5 w-5" />
                        <span>Loja</span>
                    </button>
                    <Link to={checkoutPath} className={`${navButton} ${muted}`} aria-label={`Abrir ${cartLabel.toLowerCase()}`}>
                        <span className="relative">
                            <ShoppingCart className="h-5 w-5" />
                            {cartCount > 0 && (
                                <span className="absolute -right-3 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-black text-white">
                                    {cartCount > 99 ? '99+' : cartCount}
                                </span>
                            )}
                        </span>
                        <span>{cartLabel}</span>
                    </Link>
                    <button type="button" onClick={() => openAccount('profile')} className={`${navButton} ${muted}`} aria-label={isAuthenticated ? 'Perfil' : 'Entrar'}>
                        <UserRound className="h-5 w-5" />
                        <span>{isAuthenticated ? 'Perfil' : 'Entrar'}</span>
                    </button>
                    <button type="button" onClick={() => setMenuOpen(true)} className={`${navButton} ${menuOpen ? active : muted}`} aria-label="Menu">
                        <Menu className="h-5 w-5" />
                        <span>Menu</span>
                    </button>
                </div>
            </nav>

            <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="fixed right-5 top-5 z-[85] hidden min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 text-sm font-black text-slate-700 shadow-lg backdrop-blur md:flex dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-200"
                aria-label="Abrir menu da loja"
            >
                <Menu className="h-5 w-5 text-emerald-600" />
                Menu
            </button>

            {menuOpen && (
                <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/45 backdrop-blur-sm md:items-stretch md:justify-end">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="store-navigation-menu-title"
                        className="max-h-[88vh] w-full overflow-hidden rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-950 md:h-full md:max-h-none md:max-w-md md:rounded-none md:rounded-l-[2rem]"
                    >
                        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Menu</p>
                                <h2 id="store-navigation-menu-title" className="mt-1 truncate text-xl font-black text-slate-900 dark:text-white">{storeName}</h2>
                            </div>
                            <button type="button" onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300" aria-label="Fechar menu" autoFocus>
                                <X className="h-5 w-5" />
                            </button>
                        </header>

                        <div className="max-h-[calc(88vh-5rem)] overflow-y-auto p-4 pb-8 md:max-h-[calc(100vh-5rem)]">
                            <div className="space-y-5">
                                <section>
                                    <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Loja</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button type="button" onClick={focusSearch} className={menuTile}>
                                            <Search className="h-6 w-6 text-emerald-600" />
                                            <span className="font-black text-slate-900 dark:text-white">Buscar produtos</span>
                                        </button>
                                        <button type="button" onClick={() => { setMenuOpen(false); onOpenStore(); }} className={menuTile}>
                                            <Store className="h-6 w-6 text-emerald-600" />
                                            <span className="font-black text-slate-900 dark:text-white">Conheça a loja</span>
                                        </button>
                                        <Link to={checkoutPath} onClick={() => setMenuOpen(false)} className={menuTile}>
                                            <span className="relative">
                                                <ShoppingCart className="h-6 w-6 text-emerald-600" />
                                                {cartCount > 0 && (
                                                    <span className="absolute -right-3 -top-3 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white">
                                                        {cartCount > 99 ? '99+' : cartCount}
                                                    </span>
                                                )}
                                            </span>
                                            <span>
                                                <span className="block font-black text-slate-900 dark:text-white">{cartLabel}</span>
                                                <span className="mt-1 block text-xs font-bold text-slate-500 dark:text-slate-400">
                                                    {cartCount > 0 ? `${cartCount} item(ns) · R$ ${formatBRL(cartTotal)}` : 'Vazio'}
                                                </span>
                                            </span>
                                        </Link>
                                    </div>
                                </section>

                                <section>
                                    <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                                        {isAuthenticated ? 'Minha área' : 'Conta'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {isAuthenticated ? (
                                            <>
                                                <button type="button" onClick={() => openAccount('messages')} className={menuTile}>
                                                    <BellRing className="h-6 w-6 text-emerald-600" />
                                                    <span>
                                                        <span className="block font-black text-slate-900 dark:text-white">Mensagens</span>
                                                        <span className="mt-1 block text-xs font-bold text-slate-500 dark:text-slate-400">Pedidos, fidelidade e sistema</span>
                                                    </span>
                                                </button>
                                                <button type="button" onClick={() => openAccount('orders')} className={menuTile}>
                                                    <PackageCheck className="h-6 w-6 text-emerald-600" />
                                                    <span className="font-black text-slate-900 dark:text-white">Meus pedidos</span>
                                                </button>
                                                <button type="button" onClick={() => openAccount('consumption')} className={menuTile}>
                                                    <ShoppingCart className="h-6 w-6 text-emerald-600" />
                                                    <span className="font-black text-slate-900 dark:text-white">Meu consumo</span>
                                                </button>
                                                <button type="button" onClick={() => openAccount('loyalty')} className="flex min-h-24 flex-col items-start justify-between rounded-3xl bg-amber-50 p-4 text-left dark:bg-amber-950/20">
                                                    <Gift className="h-6 w-6 text-amber-600" />
                                                    <span>
                                                        <span className="block font-black text-slate-900 dark:text-white">Fidelidade</span>
                                                        <span className="mt-1 block text-xs font-bold text-slate-500 dark:text-slate-400">Saldo, benefícios e extrato</span>
                                                    </span>
                                                </button>
                                                <button type="button" onClick={() => openAccount('profile')} className={menuTile}>
                                                    <UserRound className="h-6 w-6 text-emerald-600" />
                                                    <span className="font-black text-slate-900 dark:text-white">Minha conta</span>
                                                </button>
                                            </>
                                        ) : (
                                            <button type="button" onClick={() => openAccount('profile')} className="col-span-2 flex min-h-20 items-center gap-4 rounded-3xl bg-slate-100 p-4 text-left dark:bg-slate-900">
                                                <UserRound className="h-6 w-6 text-emerald-600" />
                                                <span>
                                                    <span className="block font-black text-slate-900 dark:text-white">Entrar ou criar conta</span>
                                                    <span className="mt-1 block text-xs font-bold text-slate-500 dark:text-slate-400">Acesse pedidos, consumo, fidelidade e mensagens</span>
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                </section>

                                <section>
                                    <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Preferências</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2 rounded-3xl bg-slate-100 p-4 dark:bg-slate-900">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-black text-slate-900 dark:text-white">Tema</p>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Claro, escuro ou conforme o sistema.</p>
                                                </div>
                                                {themeMode === 'system'
                                                    ? <Monitor className="h-5 w-5 text-emerald-600" />
                                                    : themeMode === 'dark'
                                                        ? <Moon className="h-5 w-5 text-emerald-600" />
                                                        : <Sun className="h-5 w-5 text-amber-500" />}
                                            </div>
                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                                {([
                                                    ['light', 'Claro', Sun],
                                                    ['dark', 'Escuro', Moon],
                                                    ['system', 'Sistema', Monitor],
                                                ] as const).map(([mode, label, Icon]) => (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        onClick={() => selectThemeMode(mode)}
                                                        className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-2 text-xs font-black transition ${themeMode === mode
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-300'}`}
                                                    >
                                                        <Icon className="h-4 w-4" /> {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {isAuthenticated && (
                                            <>
                                                <button type="button" onClick={() => openAccount('security')} className={menuTile}>
                                                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                                                    <span className="font-black text-slate-900 dark:text-white">Segurança</span>
                                                </button>
                                                <button type="button" onClick={() => void doLogout()} className="flex min-h-24 flex-col items-start justify-between rounded-3xl bg-red-50 p-4 text-left dark:bg-red-950/20">
                                                    <LogOut className="h-6 w-6 text-red-600" />
                                                    <span className="font-black text-red-700 dark:text-red-300">Sair</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </section>
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
