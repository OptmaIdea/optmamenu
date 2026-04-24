import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrderMonitor } from '@/hooks/useOrderMonitor';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useInventoryAttentionCount } from '@/hooks/inventory/useInventoryAttentionCount';
import {
    LayoutDashboard,
    Package,
    ShoppingBag,
    LogOut,
    Users,
    FileText,
    HelpCircle,
    Layers,
    Menu,
    ChevronLeft,
    Moon,
    Sun,
    BarChart2,
    AlertCircle,
    Heart,
    History,
    MessageCircle,
    UserCircle,
    Smartphone,
    Clock,
    CreditCard,
    BookOpen,
    ExternalLink,
    Lock,
    MessageSquare,
    Truck,
    Activity
} from 'lucide-react';

export default function PrivateLayout() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [userData, setUserData] = useState<{ name: string; phone: string; email: string; avatar?: string } | null>(null);
    const [storeId, setStoreId] = useState<string | null>(null);
    const attentionCount = useInventoryAttentionCount();
    const [storeSlug, setStoreSlug] = useState<string | null>(null);
    const [loadingStore, setLoadingStore] = useState(true);

    const SIDEBAR_GROUPS_STORAGE_KEY = 'optmamenu.sidebar.groups';
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        dashboard: true,
        commercial: false,
        products: true,
        settings: false,
        support: false,
    });

    useEffect(() => {
        const initialize = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                // Se não houver usuário, redirecionar para login (já deve ser protegido pela rota)
                navigate('/login');
                return;
            }

            // Usa RPC para evitar stack depth limit exceeded causado por RLS policies recursivas
            const { data: store, error } = await supabase.rpc('get_user_store_by_id', {
                p_user_id: user.id,
            });

            if (error) {
                console.error('Erro ao verificar loja:', error);
            }

            const storeData = store?.[0] || null;

            if (!storeData) {
                navigate('/onboarding/create-store', { replace: true });
                return;
            }

            setStoreId(storeData.id);
            setStoreSlug(storeData.slug);
            setUserData({
                name: user.user_metadata?.full_name || 'Usuário',
                phone: user.user_metadata?.phone_number || '',
                email: user.email || '',
                avatar: storeData.config?.visual_icon_url || user.user_metadata?.avatar_url
            });
            setLoadingStore(false);
        };

        initialize();

        // Dark Mode Check
        if (document.documentElement.classList.contains('dark')) {
            setIsDark(true);
        }

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
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    // Load sidebar group state from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
            if (raw) {
                setOpenSections((prev) => ({ ...prev, ...JSON.parse(raw) }));
            }
        } catch {
            // noop
        }
    }, []);

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

    const toggleSection = (section: string) => {
        setOpenSections((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const toggleDarkMode = () => {
        document.documentElement.classList.toggle('dark');
        setIsDark(!isDark);
        localStorage.setItem('theme', !isDark ? 'dark' : 'light');
    };

    const navigationItems = useMemo(() => ({
        dashboard: [
            { path: '/admin', icon: LayoutDashboard, label: 'Painel' },
            { path: '/admin/activity', icon: BarChart2, label: 'Atividades recentes' },
            { path: '/admin/alerts', icon: AlertCircle, label: 'Alertas' },
            { path: '/admin/reports', icon: FileText, label: 'Relatórios' },
        ],
        commercial: [
            { path: '/admin/orders', icon: ShoppingBag, label: 'Pedidos' },
            { path: '/admin/customers', icon: Users, label: 'Clientes' },
            { path: '/admin/messages-admin', icon: MessageSquare, label: 'Mensagens' },
            { path: '/admin/marketing', icon: BarChart2, label: 'Promoções' },
            { path: '/admin/loyalty', icon: Heart, label: 'Fidelidade' },
        ],
        products: [
            { path: '/admin/products', icon: Package, label: 'Produtos' },
            { path: '/admin/categories', icon: Layers, label: 'Categorias' },
            { path: '/admin/inventory', icon: FileText, label: 'Estoque por local' },
            { path: '/admin/products/lifecycle', icon: Activity, label: 'Vida do produto' },
            { path: '/admin/transfers', icon: Truck, label: 'Transferências' },
            { path: '/admin/suppliers', icon: Truck, label: 'Fornecedores' },
            { path: '/admin/cashbook/purchases', icon: History, label: 'Compras' },
            { path: '/admin/stock-movements', icon: History, label: 'Movimentação' },
        ],
        settings: [
            { path: '/admin/settings', icon: UserCircle, label: 'Meus Dados' },
            { path: '/admin/config', icon: Smartphone, label: 'Pedido Online' },
            { path: '/admin/users', icon: Users, label: 'Usuários' },
            { path: '/admin/hours', icon: Clock, label: 'Horários' },
            { path: '/admin/messages', icon: MessageCircle, label: 'Mensagens' },
            { path: '/admin/payments', icon: CreditCard, label: 'Pagamento' },
            { path: '/admin/delivery', icon: Truck, label: 'Entregas' },
            { path: '/admin/security', icon: Lock, label: 'Senhas e Acesso' },
        ],
        support: [
            { path: '/admin/legal', icon: FileText, label: 'Termos Legais' },
            { path: '/admin/faq', icon: HelpCircle, label: 'FAQ' },
            { path: '/admin/docs', icon: BookOpen, label: 'Documentação' },
        ]
    }), []);

    if (loadingStore) {
        return <LoadingSpinner />;
    }

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 font-sans">
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
                    flex flex-col shadow-xl md:shadow-none
                `}
            >
                {/* Header / Brand */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    {!isSidebarCollapsed && (
                        <div>
                            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
                                <img
                                    src="/assets/OptmaMenuLogo.webp"
                                    alt="OptmaMenu"
                                    className="h-8 w-auto"
                                />
                            </Link>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-candara">Admin</span>
                                {storeSlug && (
                                    <a
                                        href={`/s/${storeSlug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-[#21A896] hover:underline flex items-center gap-1 font-bold font-candara"
                                        title="Visualizar Loja"
                                    >
                                        <ExternalLink size={10} />
                                        Ver Loja
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                    >
                        {isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
                    {Object.entries(navigationItems).map(([section, items]) => (
                        <div key={section} className="space-y-1">
                            {!isSidebarCollapsed && (
                                <button
                                    type="button"
                                    onClick={() => toggleSection(section)}
                                    className="w-full flex items-center justify-between px-4 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider font-candara"
                                >
                                    <span>
                                        {section === 'dashboard' && 'Dashboard'}
                                        {section === 'commercial' && 'Comercial'}
                                        {section === 'products' && 'Produtos'}
                                        {section === 'settings' && 'Configurações'}
                                        {section === 'support' && 'Suporte'}
                                    </span>
                                    <span className="text-gray-400">{openSections[section] ? '−' : '+'}</span>
                                </button>
                            )}
                            {(openSections[section] || isSidebarCollapsed) && items.map(item => {
                                const IconComponent = item.icon;
                                const isActive =
                                    pathname === item.path ||
                                    (item.path !== '/admin/products' && pathname.startsWith(`${item.path}/`));

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        title={isSidebarCollapsed ? item.label : ''}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                                            isActive
                                                ? 'bg-[#21A896]/10 text-[#21A896] border border-[#21A896]/20'
                                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        <IconComponent
                                            size={22}
                                            className={isActive ? 'text-[#21A896]' : 'text-gray-400'}
                                        />
                                        {isSidebarCollapsed && item.path === '/admin/inventory' && attentionCount > 0 && (
                                            <span className="absolute right-3 w-2.5 h-2.5 rounded-full bg-amber-400" />
                                        )}
                                        {!isSidebarCollapsed && (
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-candara">{item.label}</span>

                                                {item.path === '/admin/inventory' && attentionCount > 0 && (
                                                    <span
                                                        className="ml-2 inline-flex items-center justify-center min-w-[22px] h-5 px-2 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
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
                    ))}
                </nav>

                {/* Footer Section: User & Actions */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    {/* User Profile */}
                    {!isSidebarCollapsed && userData && (
                        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600">
                            {userData.avatar ? (
                                <img src={userData.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-[#21A896]/10 dark:bg-[#21A896]/20 flex items-center justify-center text-[#21A896] dark:text-[#21A896] font-bold text-lg">
                                    {userData.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold text-gray-800 dark:text-white truncate font-candara-bold">
                                    {userData.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-candara">
                                    {userData.email}
                                </p>
                            </div>
                        </div>
                    )}
                    {isSidebarCollapsed && userData && (
                        <div className="flex justify-center mb-4">
                            {userData.avatar ? (
                                <img src={userData.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200" title={userData.name} />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-[#21A896]/10 dark:bg-[#21A896]/20 flex items-center justify-center text-[#21A896] dark:text-[#21A896] font-bold text-lg" title={userData.name}>
                                    {userData.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className={`grid ${isSidebarCollapsed ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-2'}`}>
                        <button
                            onClick={toggleDarkMode}
                            title="Alternar Tema"
                            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors font-candara"
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            {!isSidebarCollapsed && <span className="text-xs font-bold">Tema</span>}
                        </button>

                        <button
                            onClick={handleLogout}
                            title="Sair"
                            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-transparent font-candara"
                        >
                            <LogOut size={18} />
                            {!isSidebarCollapsed && <span className="text-xs font-bold">Sair</span>}
                        </button>
                    </div>

                    {/* Copyright */}
                    {!isSidebarCollapsed && (
                        <div className="mt-4 text-center">
                            <p className="text-[10px] text-gray-400 font-candara">
                                © {new Date().getFullYear()} OptmaIdea
                            </p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden h-screen bg-gray-50 dark:bg-gray-900">
                {/* Mobile Header */}
                <header className="md:hidden bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center z-20 shadow-sm">
                    <button
                        onClick={() => setIsMobileOpen(true)}
                        className="text-gray-600 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        aria-label="Abrir menu"
                    >
                        <Menu size={24} />
                    </button>
                    <span className="font-black text-lg text-[#21A896] dark:text-[#21A896] italic font-candara-bold">
                        OptmaMenu
                    </span>
                    {userData && (
                        <div className="flex items-center gap-2">
                            {userData.avatar ? (
                                <img
                                    src={userData.avatar}
                                    alt="Avatar"
                                    className="w-8 h-8 rounded-full"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-[#21A896]/10 dark:bg-[#21A896]/20 flex items-center justify-center text-[#21A896] font-bold text-sm">
                                    {userData.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    )}
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}