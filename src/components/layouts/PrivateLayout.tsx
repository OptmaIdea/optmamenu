import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useLayoutEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentUserSecurityContext } from '@/services/securityService';
import { useOrderMonitor } from '@/hooks/useOrderMonitor';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BackToTopButton from '@/components/common/navigation/BackToTopButton';
import { useInventoryAttentionCount } from '@/hooks/inventory/useInventoryAttentionCount';
import { usePermissions } from '@/hooks/usePermissions';
import { hasEffectivePermission } from '@/utils/permissions';
import { MyStoreInvitesBanner } from '@/components/invites/MyStoreInvitesBanner';
import {
    clearActiveStoreId,
    getActiveStoreId,
} from '@/utils/activeStore';
import {
    LayoutDashboard,
    Package,
    Shield,
    ShoppingBag,
    Users,
    FileText,
    HelpCircle,
    Layers,
    Menu,
    ChevronLeft,
    Moon,
    Sun,
    BarChart2,
    BarChart3,
    AlertCircle,
    Heart,
    History,
    SlidersHorizontal,
    MessageCircle,
    UserCircle,
    Smartphone,
    Clock,
    CreditCard,
    BookOpen,
    MessageSquare,
    Truck,
    RadioTower,
    Activity,
    ArrowRightLeft,
    WalletCards,
    Sparkles,
    FileStack,
    Settings,
    Megaphone,
    Store as StoreIcon,
    Power,
    RefreshCw,
    Bell
} from 'lucide-react';

type MenuItem = {
    path: string;
    icon: LucideIcon;
    label: string;
    permission?: string;
};

type MenuSection = Record<string, MenuItem[]>;

type LayoutMembership = {
    member_id: string;
    store_id: string;
    store_name: string;
    store_slug: string;
    store_logo_url?: string | null;
    role: string;
    status: string;
    is_primary_owner?: boolean;
};

function formatLayoutRole(role: string): string {
    const labels: Record<string, string> = {
        owner: 'Proprietário',
        admin: 'Administrador',
        manager: 'Gerente',
        stock_operator: 'Operador de estoque',
        cashier: 'Caixa',
        sales: 'Vendas',
        staff: 'Equipe',
        viewer: 'Visualizador',
    };

    return labels[role] ?? role;
}

export default function PrivateLayout() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
    const [userData, setUserData] = useState<{ name: string; phone: string; email: string; avatar?: string } | null>(null);
    const [storeId, setStoreId] = useState<string | null>(null);
    const { permissions, loading: loadingPermissions } = usePermissions(storeId ?? null);
    const can = (permissionCode: string) => {
        if (loadingPermissions) return true;

        return hasEffectivePermission(permissions, permissionCode);
    };
    const attentionCount = useInventoryAttentionCount();
    const [storeSlug, setStoreSlug] = useState<string | null>(null);
    const [loadingStore, setLoadingStore] = useState(true);
    const [activeMembership, setActiveMembership] = useState<LayoutMembership | null>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [sessionStartTime] = useState<Date>(() => {
        const stored = sessionStorage.getItem('optmamenu.session.start');
        if (stored) {
            const date = new Date(stored);
            if (!isNaN(date.getTime())) return date;
        }
        const now = new Date();
        sessionStorage.setItem('optmamenu.session.start', now.toISOString());
        return now;
    });
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    const navigationItems = useMemo<MenuSection>(() => ({
        dashboard: [
            { path: '/admin', icon: LayoutDashboard, label: 'Painel operacional' },
            { path: '/admin/activity', icon: BarChart2, label: 'Atividades recentes' },
            { path: '/admin/alerts', icon: AlertCircle, label: 'Alertas' },
            { path: '/admin/reports', icon: FileStack, label: 'Relatórios', permission: 'reports.view' },
        ],
        commercial: [
            { path: '/admin/orders', icon: ShoppingBag, label: 'Pedidos' },
            { path: '/admin/sales-channels', icon: RadioTower, label: 'Canais de venda' },
            { path: '/admin/payment-methods', icon: WalletCards, label: 'Pagamentos' },
            { path: '/admin/delivery', icon: Truck, label: 'Entregas' },
            { path: '/admin/commercial-dashboard', icon: BarChart3, label: 'Dashboard comercial' },
            { path: '/admin/commercial-settings', icon: Settings, label: 'Configurações comerciais' },
            { path: '/admin/customers', icon: Users, label: 'Clientes', permission: 'customers.view' },
            { path: '/admin/loyalty', icon: Heart, label: 'Fidelidade', permission: 'loyalty.view' },
            { path: '/admin/loyalty/advanced', icon: Sparkles, label: 'Fidelidade avançada', permission: 'loyalty.view' },
            { path: '/admin/messages-admin', icon: MessageSquare, label: 'Mensagens' },
            { path: '/admin/marketing', icon: Megaphone, label: 'Promoções', permission: 'marketing.view' },
        ],
        financial: [
            { path: '/admin/cashbook', icon: WalletCards, label: 'Livro diário', permission: 'cashbook.view' },
        ],
        products: [
            { path: '/admin/products', icon: Package, label: 'Produtos' },
            { path: '/admin/categories', icon: Layers, label: 'Categorias' },
            { path: '/admin/inventory', icon: FileText, label: 'Estoque por local', permission: 'stock.view' },
            { path: '/admin/products/lifecycle', icon: Activity, label: 'Vida do produto' },
            { path: '/admin/transfers', icon: ArrowRightLeft, label: 'Transferências', permission: 'stock.transfer' },
            { path: '/admin/suppliers', icon: Truck, label: 'Fornecedores' },
            { path: '/admin/stock/purchase-documents', icon: History, label: 'Compras' },
            { path: '/admin/stock/quotations', icon: FileText, label: 'Cotação' },
            { path: '/admin/stock-movements', icon: History, label: 'Movimentação', permission: 'stock.view' },
            { path: '/admin/stock-settings', icon: SlidersHorizontal, label: 'Configurações de Estoque' },
        ],
        settings: [
            { path: '/admin/settings', icon: UserCircle, label: 'Meus Dados' },
            { path: '/admin/config', icon: Smartphone, label: 'Pedido Online' },
            { path: '/admin/users', icon: Users, label: 'Usuários', permission: 'users.view' },
            { path: '/admin/hours', icon: Clock, label: 'Horários' },
            { path: '/admin/messages', icon: MessageCircle, label: 'Mensagens' },
            { path: '/admin/payments', icon: CreditCard, label: 'Pagamento' },
            { path: '/admin/security', icon: Shield, label: 'Senhas e Acesso', permission: 'security.view' },
        ],
        support: [
            { path: '/admin/legal', icon: FileText, label: 'Termos Legais' },
            { path: '/admin/faq', icon: HelpCircle, label: 'FAQ' },
            { path: '/admin/docs', icon: BookOpen, label: 'Documentação' },
        ]
    }), []);

    const SIDEBAR_GROUPS_STORAGE_KEY = 'optmamenu.sidebar.groups';
    const defaultOpenSections = {
        dashboard: true,
        commercial: false,
        financial: false,
        products: false,
        settings: false,
        support: false,
    };
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        try {
            const raw = localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
            if (raw) {
                return { ...defaultOpenSections, ...JSON.parse(raw) };
            }
        } catch {
            // noop
        }
        return defaultOpenSections;
    });

    useEffect(() => {
        const initialize = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigate('/login');
                return;
            }

            try {
                const securityContext = await getCurrentUserSecurityContext();

                if (!securityContext.authenticated) {
                    navigate('/login');
                    return;
                }

                const memberships = (securityContext.memberships ?? []).filter(
                    (membership) => membership.status === 'active'
                ) as LayoutMembership[];

                const storedActiveStoreId = getActiveStoreId();
                const primaryMembership =
                    securityContext.primary_membership as LayoutMembership | null;

                const selectedMembership =
                    memberships.find((membership) => membership.store_id === storedActiveStoreId) ??
                    primaryMembership ??
                    memberships[0] ??
                    null;

                if (storedActiveStoreId && !selectedMembership) {
                    clearActiveStoreId();
                }

                if (selectedMembership && storedActiveStoreId !== selectedMembership.store_id) {
                    localStorage.setItem('optmamenu_active_store_id', selectedMembership.store_id);
                }

                setActiveMembership(selectedMembership);

                if (!selectedMembership) {
                    setStoreId(null);
                    setStoreSlug(null);
                    setActiveMembership(null);
                    setUserData({
                        name:
                            securityContext.profile?.name ||
                            user.user_metadata?.full_name ||
                            securityContext.email ||
                            'Usuário',
                        phone:
                            securityContext.profile?.phone ||
                            user.user_metadata?.phone_number ||
                            '',
                        email: securityContext.email || user.email || '',
                        avatar: user.user_metadata?.avatar_url,
                    });
                    setLoadingStore(false);
                    return;
                }

                setStoreId(selectedMembership.store_id);
                setStoreSlug(selectedMembership.store_slug);

                setUserData({
                    name:
                        securityContext.profile?.name ||
                        user.user_metadata?.full_name ||
                        securityContext.email ||
                        'Usuário',
                    phone:
                        securityContext.profile?.phone ||
                        user.user_metadata?.phone_number ||
                        '',
                    email: securityContext.email || user.email || '',
                    avatar:
                        selectedMembership.store_logo_url ||
                        user.user_metadata?.avatar_url
                });
            } catch (error) {
                console.error('Erro ao carregar contexto de segurança:', error);

                // Fallback temporário para não travar operação caso a RPC falhe no primeiro teste.
                const { data: store, error: storeError } = await supabase.rpc('get_user_store_by_id', {
                    p_user_id: user.id,
                });

                if (storeError) {
                    console.error('Erro no fallback get_user_store_by_id:', storeError);
                }

                const storeData = store?.[0] || null;

                if (!storeData) {
                    navigate('/onboarding/create-store', { replace: true });
                    return;
                }

                setStoreId(storeData.id);
                setStoreSlug(storeData.slug);
                setActiveMembership(null);
                setUserData({
                    name: user.user_metadata?.full_name || user.email || 'Usuário',
                    phone: user.user_metadata?.phone_number || '',
                    email: user.email || '',
                    avatar: storeData.config?.visual_icon_url || user.user_metadata?.avatar_url
                });
            } finally {
                setLoadingStore(false);
            }
        };

        initialize();

        // Favicon Logic - Force reload to avoid cache issues on tablets
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
            link.href = '/assets/OptmaMenuLogo.ico';
            // Force reload by removing and re-adding
            const newLink = link.cloneNode() as HTMLLinkElement;
            newLink.href = '/assets/OptmaMenuLogo.ico?' + Date.now();
            link.parentNode?.replaceChild(newLink, link);
        }
    }, [navigate]);

    useOrderMonitor(storeId || undefined);

    // Close mobile menu on route change
    useLayoutEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    // Persist sidebar group state to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(openSections));
        } catch {
            // noop
        }
    }, [openSections]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const sessionElapsedTime = useMemo(() => {
        const diffMs = currentTime.getTime() - sessionStartTime.getTime();
        if (diffMs < 0) return '00:00:00';
        const diffSecs = Math.floor(diffMs / 1000);
        const hrs = Math.floor(diffSecs / 3600);
        const mins = Math.floor((diffSecs % 3600) / 60);
        const secs = diffSecs % 60;
        return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':');
    }, [currentTime, sessionStartTime]);

    // Resolve o grupo e item ativo
    const currentItem = useMemo(() => {
        // 1. Tenta correspondência exata de caminho
        for (const [group, items] of Object.entries(navigationItems)) {
            const matchedItem = items.find(item => pathname === item.path);
            if (matchedItem) {
                return { group, item: matchedItem };
            }
        }
        // 2. Se não achar exato, tenta por prefixo de subpasta (excluindo /admin que é raiz)
        for (const [group, items] of Object.entries(navigationItems)) {
            const matchedItem = items.find(item => {
                if (item.path === '/admin') return false;
                return pathname.startsWith(item.path + '/');
            });
            if (matchedItem) {
                return { group, item: matchedItem };
            }
        }
        return null;
    }, [navigationItems, pathname]);

    // Resolve as rotas irmãs para o Acesso Rápido (exclui o atual)
    const siblingItems = useMemo(() => {
        if (!currentItem) return [];
        const groupItems = navigationItems[currentItem.group as keyof typeof navigationItems] || [];
        return groupItems.filter(
            item => item.path !== currentItem.item.path && (!item.permission || can(item.permission))
        );
    }, [currentItem, navigationItems, permissions, loadingPermissions]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        window.dispatchEvent(new CustomEvent('optmamenu.refresh'));
        setTimeout(() => {
            setIsRefreshing(false);
        }, 1000);
    };

    const toggleSection = (section: string) => {
        setOpenSections((prev) => {
            const isOpening = !prev[section];
            const next = {
                dashboard: false,
                commercial: false,
                financial: false,
                products: false,
                settings: false,
                support: false,
            };
            if (isOpening) {
                next[section as keyof typeof next] = true;
            }
            return next;
        });
    };

    const toggleDarkMode = () => {
        document.documentElement.classList.toggle('dark');
        setIsDark(!isDark);
        localStorage.setItem('theme', !isDark ? 'dark' : 'light');
    };



    if (loadingStore) {
        return <LoadingSpinner />;
    }

    return (
        <div className="flex h-screen bg-[#F8F6F2] dark:bg-gray-950 transition-colors duration-300 font-sans overflow-hidden">
            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed md:static inset-y-0 left-0 z-40 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 
                    ${isSidebarCollapsed ? 'md:w-20' : 'md:w-72'} 
                    ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0 w-72'}
                    flex flex-col shadow-xl md:shadow-none shrink-0 h-full
                `}
            >
                {/* Header / Brand (Fixo no topo da Sidebar) */}
                <div className="h-[73px] shrink-0 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center px-4 md:px-6 bg-white dark:bg-gray-800">
                    {!isSidebarCollapsed ? (
                        <div className="flex items-center">
                            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
                                <img
                                    src="/assets/OptmaMenuLogo.webp"
                                    alt="OptmaMenu"
                                    className="h-10 w-auto"
                                />
                            </Link>
                        </div>
                    ) : (
                        <div className="flex justify-center w-full">
                            <img
                                src="/assets/OptmaMenuLogo.webp"
                                alt="Logo"
                                className="h-6 w-6 object-contain"
                                title="OptmaMenu"
                            />
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 ${isSidebarCollapsed ? 'absolute left-1/2 -translate-x-1/2 mt-12 md:mt-0 md:relative md:left-auto md:translate-x-0' : ''}`}
                    >
                        {isSidebarCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>

                {/* Scrollable Area: User logged, Accordion Menu, Switcher, Tema/Sair, Copyright */}
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-between p-4 space-y-6">
                    <div className="space-y-6">
                        {/* User Profile */}
                        {userData && (
                            <div className={`p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 shadow-sm border border-gray-100 dark:border-gray-700 transition-all ${isSidebarCollapsed ? 'flex flex-col items-center gap-2 p-1.5' : 'flex items-center gap-3'
                                }`}>
                                {userData.avatar ? (
                                    <img
                                        src={userData.avatar}
                                        alt="Avatar"
                                        className={`${isSidebarCollapsed ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover border border-gray-200 dark:border-gray-600`}
                                        title={isSidebarCollapsed ? userData.name : ''}
                                    />
                                ) : (
                                    <div className={`${isSidebarCollapsed ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-lg'} rounded-full bg-[#21A896]/10 dark:bg-[#21A896]/20 flex items-center justify-center text-[#21A896] font-bold`} title={isSidebarCollapsed ? userData.name : ''}>
                                        {userData.name.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                {!isSidebarCollapsed && (
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-bold text-gray-800 dark:text-white truncate font-candara-bold">
                                            {userData.name}
                                        </p>
                                        <p className="text-[11px] font-bold text-brand-green truncate font-candara uppercase tracking-wide">
                                            {activeMembership ? formatLayoutRole(activeMembership.role) : 'Usuário'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Navigation Menu */}
                        <nav className="space-y-4">
                            {Object.entries(navigationItems).map(([section, items]) => {
                                const isCurrentGroup = currentItem?.group === section;
                                return (
                                    <div key={section} className="space-y-1">
                                        {!isSidebarCollapsed && (
                                            <button
                                                type="button"
                                                onClick={() => toggleSection(section)}
                                                className={`w-full flex items-center justify-between px-3 py-1 mb-1 text-xs tracking-wider font-candara transition-all ${isCurrentGroup
                                                    ? 'font-black text-gray-800 dark:text-gray-200 text-[13px] uppercase'
                                                    : 'font-bold text-gray-400 dark:text-gray-500 uppercase'
                                                    }`}
                                            >
                                                <span>
                                                    {section === 'dashboard' && 'Dashboard'}
                                                    {section === 'commercial' && 'Comercial'}
                                                    {section === 'financial' && 'Financeiro'}
                                                    {section === 'products' && 'Produtos'}
                                                    {section === 'settings' && 'Configurações'}
                                                    {section === 'support' && 'Suporte'}
                                                </span>
                                                <span className="text-gray-400">{openSections[section] ? '−' : '+'}</span>
                                            </button>
                                        )}
                                        {(openSections[section] || isSidebarCollapsed) && items
                                            .filter((item) => !item.permission || can(item.permission))
                                            .map(item => {
                                                const IconComponent = item.icon;
                                                const isActive =
                                                    pathname === item.path ||
                                                    (item.path !== '/admin' && item.path !== '/admin/products' && pathname.startsWith(`${item.path}/`));

                                                return (
                                                    <Link
                                                        key={item.path}
                                                        to={item.path}
                                                        title={isSidebarCollapsed ? item.label : ''}
                                                        className={`flex items-center gap-3 rounded-xl font-bold text-sm transition-all relative
                                                        ${isSidebarCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'}
                                                        ${isActive
                                                                ? 'bg-[#21A896]/10 text-[#21A896] border border-[#21A896]/20 dark:bg-[#21A896]/20'
                                                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                                            }`}
                                                    >
                                                        <IconComponent
                                                            size={isSidebarCollapsed ? 22 : 18}
                                                            className={isActive ? 'text-[#21A896]' : 'text-gray-400'}
                                                        />
                                                        {isSidebarCollapsed && item.path === '/admin/inventory' && attentionCount > 0 && (
                                                            <span className="absolute right-3 w-2 h-2 rounded-full bg-amber-400" />
                                                        )}
                                                        {!isSidebarCollapsed && (
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="font-candara">{item.label}</span>

                                                                {item.path === '/admin/inventory' && attentionCount > 0 && (
                                                                    <span
                                                                        className="ml-2 inline-flex items-center justify-center min-w-5.5 h-5 px-2 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                                                                        title="Itens com estoque baixo ou zerado"
                                                                    >
                                                                        {attentionCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Link>
                                                );
                                            })}
                                    </div>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Footer Actions & Switcher */}
                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        {!isSidebarCollapsed && (
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400 font-candara">
                                    © {new Date().getFullYear()}{' '}
                                    <a
                                        href="https://optmaidea2.vercel.app/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                    >
                                        OptmaIdea
                                    </a>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-[#F8F6F2] dark:bg-gray-950">
                {/* Unified Header */}
                <header className="h-[73px] shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center px-4 md:px-8 z-30 shadow-sm transition-colors duration-300">
                    {/* Left Side: Hamburguer & Active Route Icon/Name */}
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            onClick={() => setIsMobileOpen(true)}
                            className="md:hidden text-gray-500 dark:text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mr-1 shrink-0"
                            aria-label="Abrir menu"
                        >
                            <Menu size={22} />
                        </button>

                        {currentItem && (
                            <div className="flex items-center gap-2 min-w-0">
                                <currentItem.item.icon className="w-5 h-5 md:w-6 md:h-6 text-brand-light shrink-0" />
                                <h1 className="font-extrabold text-sm md:text-lg text-brand-orange truncate font-candara-bold select-none">
                                    {currentItem.item.label}
                                </h1>
                            </div>
                        )}
                    </div>

                    {/* Center: Session stats */}
                    <div className="hidden lg:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 font-candara select-none">
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-750 px-2.5 py-1 rounded-full border border-gray-100 dark:border-gray-700">
                            <span className="font-bold">Acesso em:</span>
                            <span className="font-mono">{sessionStartTime.toLocaleTimeString('pt-BR')}</span>
                        </div>
                        <span className="text-gray-300 dark:text-gray-650">|</span>
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-750 px-2.5 py-1 rounded-full border border-gray-100 dark:border-gray-700">
                            <span className="font-bold">Agora:</span>
                            <span className="font-mono">{currentTime.toLocaleTimeString('pt-BR')}</span>
                        </div>
                        <span className="text-gray-300 dark:text-gray-650">|</span>
                        <div className="flex items-center gap-1.5 bg-brand-green/5 dark:bg-brand-green/10 px-3 py-1 rounded-full border border-brand-green/10">
                            <span className="font-bold text-brand-green">Tempo:</span>
                            <span className="font-bold text-brand-green font-mono">{sessionElapsedTime}</span>
                        </div>
                    </div>

                    {/* Right Side: Quick actions */}
                    <div className="flex items-center gap-1">
                        {storeSlug && (
                            <a
                                href={`/s/${storeSlug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Acessar loja: /s/${storeSlug}`}
                                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition shrink-0"
                            >
                                <StoreIcon size={19} style={{ color: 'teal-300' }} />
                            </a>
                        )}

                        {/* Messages Icon */}
                        <button
                            type="button"
                            title="Mensagens (Sem novas mensagens)"
                            className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition relative shrink-0"
                        >
                            <MessageSquare size={19} />
                            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand-light" />
                        </button>

                        {/* Alerts Icon */}
                        <button
                            type="button"
                            title={attentionCount > 0 ? `${attentionCount} alertas de estoque pendentes` : "Sem novos alertas"}
                            className={`p-2 rounded-lg transition relative shrink-0 ${attentionCount > 0
                                ? 'text-brand-light bg-brand-light/10 hover:bg-brand-light/20'
                                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            <Bell size={19} className={attentionCount > 0 ? 'animate-pulse' : ''} />
                            {attentionCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-brand-light text-gray-900 text-[10px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center border border-white dark:border-gray-800">
                                    {attentionCount}
                                </span>
                            )}
                        </button>

                        <span className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block shrink-0" />

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleDarkMode}
                            title="Alternar Tema"
                            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition shrink-0"
                        >
                            {isDark ? <Sun size={19} /> : <Moon size={19} />}
                        </button>

                        {/* Logout Power Button */}
                        <button
                            onClick={handleLogout}
                            title="Sair do painel"
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shrink-0"
                        >
                            <Power size={19} className="stroke-[2.5]" />
                        </button>
                    </div>
                </header>

                {/* Quick Access Bar */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 md:px-8 py-2.5 flex items-center justify-between flex-wrap gap-2 z-20 shrink-0">
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar py-0.5 min-w-0">
                        {siblingItems.length > 0 ? (
                            siblingItems.map((item) => {
                                const SiblingIcon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 hover:bg-[#21A896]/10 hover:text-[#21A896] text-xs font-semibold text-gray-600 dark:text-gray-300 transition-colors border border-gray-100 dark:border-gray-700 shrink-0"
                                    >
                                        <SiblingIcon size={13} className="text-gray-400 dark:text-gray-500" />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })
                        ) : (
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest select-none">
                                Menu de Operação
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Target DOM para o portal de ações rápidas da rota filha */}
                        <div id="quick-access-actions-portal" className="flex items-center gap-2" />

                        <button
                            onClick={handleRefresh}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition hover:border-[#21A896]/35 shrink-0 shadow-sm cursor-pointer"
                            title="Atualizar dados da página"
                        >
                            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                            <span>Atualizar</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area Scrollable */}
                <div id="main-scroll-container" className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-[#F8F6F2] dark:bg-gray-950">
                    <main className="flex-1 p-4 md:p-8">
                        <MyStoreInvitesBanner />
                        <Outlet />
                    </main>
                </div>
            </div>
            <BackToTopButton />
        </div>
    );
}
