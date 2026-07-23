import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useLayoutEffect, useCallback, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { clearSessionSecurity } from '@/utils/sessionSecurity';
import { getCurrentUserSecurityContext } from '@/services/securityService';
import { useOrderMonitor } from '@/hooks/useOrderMonitor';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BackToTopButton from '@/components/common/navigation/BackToTopButton';
import { useInventoryAttentionCount } from '@/hooks/inventory/useInventoryAttentionCount';
import { usePermissions } from '@/hooks/usePermissions';
import { hasEffectivePermission } from '@/utils/permissions';
import { useRealtimeListener } from '@/hooks/useRealtimeListener';
import { MyStoreInvitesBanner } from '@/components/invites/MyStoreInvitesBanner';
import { useIdleSessionTimeout } from '@/hooks/useIdleSessionTimeout';
import {
    PERMISSIONS_CHANGED_EVENT,
    type PermissionsChangedPayload,
} from '@/utils/permissionEvents';
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
    ChevronDown,
    Moon,
    Sun,
    BarChart2,
    BarChart3,
    AlertCircle,
    Heart,
    History,
    SlidersHorizontal,
    UserCircle,
    Clock,
    BookOpen,
    MessageSquare,
    Truck,
    RadioTower,
    Activity,
    ArrowRightLeft,
    WalletCards,
    Sparkles,
    FileStack,
    Megaphone,
    Store as StoreIcon,
    Power,
    RefreshCw,
    Bell,
    Building,
    ScrollText,
    BadgeDollarSign,
    FolderTree,
} from 'lucide-react';

type MenuItem = {
    path: string;
    icon: LucideIcon;
    label: string;
    permission?: string;
    permissions?: string[];
    anyPermissions?: string[];
    queryString?: string;
    alwaysVisible?: boolean;
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
    custom_role_name?: string | null;
    custom_role_base_role?: string | null;
    custom_role_id?: string | null;
    access_blocked?: boolean | null;
    access_message?: string | null;
    profile_avatar_url?: string | null;
    avatar_url?: string | null;
    internal_alias?: string | null;
    profile_name?: string | null;
    member_avatar_url?: string | null;
    onboarding_required?: boolean | null;
    onboarding_completed_at?: string | null;
};

const SECURITY_TAB_VIEW_PERMISSIONS = [
    'security.context.view',
    'security.logs.view',
    'security.roles.view',
    'security.custom_roles.view',
    'security.user_permissions.view',
    'security.sensitive_actions.view',
    'security.pin_token.view',
    'security.sessions.view',
];

const SETTINGS_TAB_VIEW_PERMISSIONS = [
    'settings.store.view',
    'settings.commercial.view',
    'settings.orders.view',
    'settings.hours.view',
    'settings.stock.view',
    'settings.delivery.view',
    'settings.payment.view',
    'messages.view',
    'settings.legal.view',
    'settings.system.view',
    'settings.appearance.view',
    'settings.appearance.manage',
];

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

function getInitials(name?: string | null): string {
    if (!name) return 'U';

    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) return 'U';

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function PrivateLayout() {
    const location = useLocation();
    const { pathname } = location;
    const navigate = useNavigate();
    useIdleSessionTimeout();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isQuickAccessOpen, setIsQuickAccessOpen] = useState(false);
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
    const [userData, setUserData] = useState<{ name: string; alias: string; phone: string; email: string; avatar?: string } | null>(null);
    const [storeId, setStoreId] = useState<string | null>(null);
    const { permissions, refreshing: refreshingPermissions } = usePermissions(storeId ?? null);
    const attentionCount = useInventoryAttentionCount();
    const [storeSlug, setStoreSlug] = useState<string | null>(null);
    const [isPublicStoreEnabled, setIsPublicStoreEnabled] = useState(false);
    const [loadingStore, setLoadingStore] = useState(true);
    const [activeMembership, setActiveMembership] = useState<LayoutMembership | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const layoutRealtimeChannelIdRef = useRef(Math.random().toString(36).slice(2));

    const isOnboardingPending =
        activeMembership?.status === 'active' &&
        (
            activeMembership?.onboarding_required === true ||
            !activeMembership?.onboarding_completed_at
        );

    const isOwner = activeMembership?.role === 'owner';

    const hasPermission = useCallback((key: string) => {
        if (activeMembership?.role === 'owner') return true;

        return hasEffectivePermission(permissions, key);
    }, [permissions, activeMembership?.role]);

    const hasRootPermission = useCallback((key: string) => {
        if (activeMembership?.role === 'owner') return true;

        return permissions.some((permission) =>
            permission.permission_code === key &&
            permission.allowed === true
        );
    }, [permissions, activeMembership?.role]);

    useEffect(() => {
    }, [
        storeId,
        refreshingPermissions,
        activeMembership?.role,
        activeMembership?.custom_role_name,
        permissions,
    ]);

    useEffect(() => {
        const handlePublicStoreSettingsChanged = (event: Event) => {
            const customEvent = event as CustomEvent<{
                public_store_enabled?: boolean;
                slug?: string;
            }>;

            if (typeof customEvent.detail?.public_store_enabled === 'boolean') {
                setIsPublicStoreEnabled(customEvent.detail.public_store_enabled);
            }

            if (customEvent.detail?.slug) {
                setStoreSlug(customEvent.detail.slug);
            }
        };

        window.addEventListener(
            'optmamenu:public-store-settings-changed',
            handlePublicStoreSettingsChanged
        );

        return () => {
            window.removeEventListener(
                'optmamenu:public-store-settings-changed',
                handlePublicStoreSettingsChanged
            );
        };
    }, []);

    const can = useCallback((permissionCode: string | string[]) => {
        if (Array.isArray(permissionCode)) {
            return permissionCode.every((code) => hasPermission(code));
        }

        return hasPermission(permissionCode);
    }, [hasPermission]);

    const canShowSecurityMenu = useCallback(() => {
        if (!hasRootPermission('security.view')) return false;

        return SECURITY_TAB_VIEW_PERMISSIONS.some((permission) =>
            hasPermission(permission)
        );
    }, [hasRootPermission, hasPermission]);

    const canShowSettingsMenu = useCallback(() => {
        if (!hasPermission('settings.view')) return false;

        return SETTINGS_TAB_VIEW_PERMISSIONS.some((permission) =>
            hasPermission(permission)
        );
    }, [hasPermission]);

    const SECTION_ACCESS_PERMISSIONS: Record<string, string | null> = {
        dashboard: 'dashboard.view',
        commercial: 'commercial.view',
        financial: 'financial.view',
        products: null,
        security: 'security.view',
        settings: 'settings.view',
        support: 'support.view',
    };

    const isMenuItemVisible = useCallback((section: string, item: MenuItem) => {
        if (isOnboardingPending) {
            const allowedPaths = ['/admin/my-profile', '/admin/my-history'];
            return allowedPaths.some((path) =>
                item.path.startsWith(path)
            );
        }

        if (item.path === '/admin/users') {
            return hasPermission('users.view');
        }

        if (isOwner) return true;

        if (section === 'security' && !hasRootPermission('security.view')) {
            return false;
        }

        if (item.path === '/admin/security') {
            return canShowSecurityMenu();
        }

        const sectionAccessPermission = SECTION_ACCESS_PERMISSIONS[section];
        if (sectionAccessPermission && !hasPermission(sectionAccessPermission)) {
            return false;
        }

        if (item.alwaysVisible) {
            return true;
        }

        if (item.path === '/admin/settings') {
            if (item.permissions?.length) {
                return can(item.permissions);
            }

            const tabParam = item.queryString?.split('tab=')[1];

            if (!tabParam) {
                return canShowSettingsMenu();
            }

            const viewKey = `settings.${tabParam}.view`;

            return hasPermission('settings.view') && hasPermission(viewKey);
        }

        if (item.permissions?.length && !can(item.permissions)) {
            return false;
        }

        if (item.anyPermissions?.length) {
            return item.anyPermissions.some((permission) => hasPermission(permission));
        }

        if (item.permission) {
            return hasPermission(item.permission);
        }

        return true;
    }, [isOnboardingPending, isOwner, hasPermission, hasRootPermission, can, canShowSecurityMenu, canShowSettingsMenu]);

    const [isNewSession] = useState(() => {
        const stored = sessionStorage.getItem('optmamenu.session.start');
        return !stored;
    });
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
    const [isClockPopoverOpen, setIsClockPopoverOpen] = useState(false);
    const [popoverTimeoutId, setPopoverTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

    const navigationItems = useMemo<MenuSection>(() => ({
        personal: [
            {
                path: '/admin/my-history',
                icon: ScrollText,
                label: 'Meu Histórico',
                alwaysVisible: true,
            },
            {
                path: '/admin/my-profile',
                icon: UserCircle,
                label: 'Meus Dados',
                alwaysVisible: true,
            },
        ],
        dashboard: [
            { path: '/admin/alerts', icon: AlertCircle, label: 'Alertas', permission: 'dashboard.alerts.view' },
            { path: '/admin/activity', icon: BarChart2, label: 'Atividades recentes', permission: 'dashboard.activity.view' },
            { path: '/admin', icon: LayoutDashboard, label: 'Painel operacional', permission: 'dashboard.view' },
            { path: '/admin/reports', icon: FileStack, label: 'Relatórios', permission: 'reports.view' },
        ],
        commercial: [
            { path: '/admin/sales-channels', icon: RadioTower, label: 'Canais de venda', permission: 'commercial.sales_channels.view' },
            { path: '/admin/customers', icon: Users, label: 'Clientes', permission: 'customers.view' },
            { path: '/admin/commercial-dashboard', icon: BarChart3, label: 'Dashboard comercial', permission: 'commercial.dashboard.view' },
            { path: '/admin/loyalty', icon: Heart, label: 'Fidelidade', permission: 'loyalty.view' },
            { path: '/admin/loyalty/advanced', icon: Sparkles, label: 'Fidelidade avançada', permission: 'loyalty.view' },
            { path: '/admin/messages-admin', icon: MessageSquare, label: 'Mensagens', permission: 'messages.view' },
            { path: '/admin/orders', icon: ShoppingBag, label: 'Pedidos', permission: 'orders.view' },
            { path: '/admin/marketing', icon: Megaphone, label: 'Promoções', permission: 'marketing.view' },
            { path: '/admin/direct-sales', icon: BadgeDollarSign, label: 'Venda direta', permission: 'orders.manage' },
        ],
        financial: [
            { path: '/admin/cashbook', icon: WalletCards, label: 'Livro diário', permission: 'cashbook.view' },
            { path: '/admin/account-plan', icon: FolderTree, label: 'Plano de contas', permission: 'financial.account_plan.view' },
            { path: '/admin/financial-accounts', icon: Building, label: 'Contas financeiras', permission: 'financial.accounts.view' },
        ],
        products: [
            { path: '/admin/categories', icon: Layers, label: 'Categorias', permission: 'categories.view' },
            { path: '/admin/stock/purchase-documents', icon: History, label: 'Compras', permission: 'purchases.view' },
            { path: '/admin/stock/quotations', icon: FileText, label: 'Cotação', permission: 'quotes.view' },
            { path: '/admin/inventory', icon: FileText, label: 'Estoque', permission: 'stock.view' },
            { path: '/admin/suppliers', icon: Truck, label: 'Fornecedores', permission: 'suppliers.view' },
            { path: '/admin/stock/movements', icon: History, label: 'Movimentação', permission: 'stock.view' },
            { path: '/admin/products', icon: Package, label: 'Produtos', permission: 'products.manage' },
            { path: '/admin/transfers', icon: ArrowRightLeft, label: 'Transferências', permission: 'transfers.view' },
            { path: '/admin/products/lifecycle', icon: Activity, label: 'Vida do produto', permission: 'products.manage' },
        ],
        team: [
            {
                path: '/admin/users',
                icon: Users,
                label: 'Usuários',
                permission: 'users.view',
            },
        ],
        settings: [
            {
                path: '/admin/settings',
                icon: Building,
                label: 'Configurações da Loja',
            },
        ],
        security: [
            {
                path: '/admin/security',
                icon: Shield,
                label: 'Senhas e Acesso',
            },
        ],
        support: [
            { path: '/admin/docs', icon: BookOpen, label: 'Documentação', permission: 'support.view' },
            { path: '/admin/faq', icon: HelpCircle, label: 'FAQ', permission: 'support.view' },
            { path: '/admin/legal', icon: FileText, label: 'Termos Legais', permission: 'support.view' },
        ]
    }), []);

    const SIDEBAR_GROUPS_STORAGE_KEY = 'optmamenu.sidebar.groups';
    const defaultOpenSections = {
        personal: true,
        dashboard: true,
        commercial: false,
        financial: false,
        products: false,
        team: false,
        settings: false,
        security: false,
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

            setUserId(user.id);

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

                if (selectedMembership) {
                    const isSuspended =
                        selectedMembership.status === 'suspended' ||
                        selectedMembership.access_blocked === true;

                    if (isSuspended) {
                        const message =
                            selectedMembership.access_message ||
                            `Seu acesso à loja ${selectedMembership.store_name} está suspenso. Procure o responsável.`;

                        toast.warning(message);
                        clearActiveStoreId();
                        navigate('/login', { replace: true });
                        return;
                    }
                }

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
                    setIsPublicStoreEnabled(false);
                    setActiveMembership(null);
                    const nameNoMembership =
                        securityContext.profile?.name ||
                        user.user_metadata?.full_name ||
                        securityContext.email ||
                        'Usuário';
                    setUserData({
                        name: nameNoMembership,
                        alias:
                            securityContext.profile?.internal_alias ||
                            nameNoMembership.split(' ')[0],
                        phone:
                            securityContext.profile?.phone ||
                            user.user_metadata?.phone_number ||
                            '',
                        email: securityContext.email || user.email || '',
                        avatar:
                            securityContext.profile?.profile_avatar_url ||
                            securityContext.profile?.avatar_url ||
                            primaryMembership?.profile_avatar_url ||
                            primaryMembership?.avatar_url ||
                            memberships[0]?.profile_avatar_url ||
                            memberships[0]?.avatar_url ||
                            user.user_metadata?.avatar_url,
                    });
                    setLoadingStore(false);
                    return;
                }

                setStoreId(selectedMembership.store_id);
                setStoreSlug(selectedMembership.store_slug);

                const { data: publicStoreRow } = await supabase
                    .from('stores')
                    .select('public_store_enabled')
                    .eq('id', selectedMembership.store_id)
                    .maybeSingle();

                setIsPublicStoreEnabled(Boolean(publicStoreRow?.public_store_enabled));

                const [{ data: profileRow }, { data: memberAliasRow }] = await Promise.all([
                    supabase
                        .from('profiles')
                        .select('name, avatar_url, phone, mobile_phone, whatsapp_phone, cpf, birthdata, zip_code, address, address_number, complement, district, city, state, instagram_url, facebook_url, website_url')
                        .eq('id', user.id)
                        .maybeSingle(),
                    supabase
                        .from('store_members')
                        .select(`
                          internal_alias,
                          member_avatar_url,
                          member_email,
                          member_phone,
                          member_mobile_phone,
                          member_whatsapp_phone
                        `)
                        .eq('user_id', user.id)
                        .eq('store_id', selectedMembership.store_id)
                        .maybeSingle(),
                ]);

                // FIX.4: fullName = nome completo (para subtítulo)
                const fullName =
                    profileRow?.name ||
                    selectedMembership?.profile_name ||
                    user.email;

                // FIX.4: displayName = apelido para sidebar/header
                // Ordem: RPC membership  → store_members direto  → email username  → 'Usuário'
                const resolvedAlias =
                    selectedMembership?.internal_alias ||
                    memberAliasRow?.internal_alias ||
                    profileRow?.name?.split(' ')[0] ||
                    user.email?.split('@')[0] ||
                    'Usuário';

                // avatar: member_avatar_url  → avatar_url  → fallbacks
                const resolvedAvatar =
                    selectedMembership?.member_avatar_url ||
                    selectedMembership?.avatar_url ||
                    memberAliasRow?.member_avatar_url ||
                    profileRow?.avatar_url ||
                    user.user_metadata?.avatar_url ||
                    null;

                setUserData({
                    name: fullName,
                    alias: resolvedAlias,
                    phone:
                        profileRow?.phone ||
                        securityContext.profile?.phone ||
                        user.user_metadata?.phone_number ||
                        '',
                    email: securityContext.email || user.email || '',
                    avatar: resolvedAvatar,
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
                const fallbackName = user.user_metadata?.full_name || user.email || 'Usuário';
                setUserData({
                    name: fallbackName,
                    alias: fallbackName.split(' ')[0],
                    phone: user.user_metadata?.phone_number || '',
                    email: user.email || '',
                    avatar: user.user_metadata?.avatar_url
                });
            } finally {
                setLoadingStore(false);
            }
        };

        initialize();

        const handleSecurityRefresh = () => {
            void initialize();
        };

        window.addEventListener('optmamenu:security-context-refresh', handleSecurityRefresh);

        // Favicon Logic - Force reload to avoid cache issues on tablets
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
            link.href = '/OptmaMenuLogo.ico';
            // Force reload by removing and re-adding
            const newLink = link.cloneNode() as HTMLLinkElement;
            newLink.href = '/OptmaMenuLogo.ico?' + Date.now();
            link.parentNode?.replaceChild(newLink, link);
        }

        return () => {
            window.removeEventListener('optmamenu:security-context-refresh', handleSecurityRefresh);
        };
    }, [navigate]);

    useOrderMonitor(storeId || undefined);

    const realtimeTables = useMemo(() => {
        if (!userId) return [];

        const list = [
            {
                table: 'store_members',
                filter: `user_id=eq.${userId}`,
            },
            {
                table: 'profiles',
                filter: `id=eq.${userId}`,
            },
        ];

        if (storeId) {
            list.push({
                table: 'stores',
                filter: `id=eq.${storeId}`,
            });
        }

        return list;
    }, [userId, storeId]);

    // [CORREÇÃO 7] Refresh incremental: atualiza apenas alias, avatar e dados do membro
    // sem re-executar initialize() completo (que reconstri toda a sesso e causa reload visual).
    //  chamado quando store_members.permissions ou store_members mudam para o usuário atual.
    // Mudanas estruturais (suspenso, troca de loja) ainda passam por optmamenu:security-context-refresh.
    const refreshMemberData = useCallback(async () => {
        if (!userId || !storeId) return;

        try {
            const { data: memberRow } = await supabase
                .from('store_members')
                .select(`
                    role,
                    status,
                    custom_role_id,
                    internal_alias,
                    member_avatar_url,
                    member_email,
                    member_phone,
                    sensitive_actions,
                    store_custom_roles (
                        name,
                        base_role
                    )
                `)
                .eq('user_id', userId)
                .eq('store_id', storeId)
                .maybeSingle();

            if (!memberRow) return;

            // Extrai dados da função personalizada com segurança contra array/objeto
            const customRoleRaw = memberRow.store_custom_roles;
            const customRole = (
                Array.isArray(customRoleRaw) ? customRoleRaw[0] : customRoleRaw
            ) as { name: string; base_role: string } | null;

            // Se o membro foi suspenso, ou se papel/permissões mudaram, requer refresh do contexto completo
            const hasSecurityChanged =
                memberRow.status === 'suspended' ||
                memberRow.role !== activeMembership?.role ||
                memberRow.custom_role_id !== activeMembership?.custom_role_id ||
                customRole?.name !== activeMembership?.custom_role_name ||
                customRole?.base_role !== activeMembership?.custom_role_base_role ||
                JSON.stringify(memberRow.sensitive_actions) !== JSON.stringify((activeMembership as any)?.sensitive_actions);

            if (hasSecurityChanged) {
                window.dispatchEvent(new CustomEvent('optmamenu:security-context-refresh'));
                return;
            }

            // Caso contrário: atualiza apenas os campos de exibição
            setUserData((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    alias: memberRow.internal_alias || prev.alias,
                    avatar: memberRow.member_avatar_url || prev.avatar,
                    email: memberRow.member_email || prev.email,
                    phone: memberRow.member_phone || prev.phone,
                };
            });

            setActiveMembership((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    internal_alias: memberRow.internal_alias || prev.internal_alias,
                    member_avatar_url: memberRow.member_avatar_url || prev.member_avatar_url,
                    avatar_url: memberRow.member_avatar_url || prev.avatar_url,
                };
            });
        } catch (err) {
            console.error('[PrivateLayout] Erro no refreshMemberData:', err);
        }
    }, [userId, storeId, activeMembership]);

    // Debounce unificado em 450ms (entre os 400ms do usePermissions e os 500ms anteriores),
    // evitando dois re-renders consecutivos quando o mesmo evento chega em ambos.
    const debouncedContextRefresh = useMemo(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                void refreshMemberData();
            }, 450);
        };
    }, [refreshMemberData]);

    useRealtimeListener({
        channelName: `layout_context_rt_${userId || 'pending'}_${storeId || 'none'}_${layoutRealtimeChannelIdRef.current}`,
        tables: realtimeTables,
        onChanged: debouncedContextRefresh,
        enabled: !!userId,
    });

    useEffect(() => {
        if (!storeId) return;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const scheduleMemberRefresh = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                void refreshMemberData();
            }, 450);
        };

        const handlePermissionsChanged = (event: Event) => {
            const detail = (event as CustomEvent<PermissionsChangedPayload>).detail;

            if (!detail?.storeId || detail.storeId === storeId) {
                scheduleMemberRefresh();
            }
        };

        window.addEventListener(PERMISSIONS_CHANGED_EVENT, handlePermissionsChanged);

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            window.removeEventListener(PERMISSIONS_CHANGED_EVENT, handlePermissionsChanged);
        };
    }, [storeId, refreshMemberData]);

    // Close mobile menu on route change
    useLayoutEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    // 9.9K.3   Guarda de primeiro acesso: redireciona para /admin/my-profile se onboarding pendente
    const allowedDuringOnboarding = [
        '/admin/my-profile',
        '/admin/my-history',
    ];

    useEffect(() => {
        if (!activeMembership) return;
        if (!isOnboardingPending) return;

        const currentPath = location.pathname;
        const isAllowed = allowedDuringOnboarding.some((path) =>
            currentPath.startsWith(path)
        );

        if (!isAllowed) {
            toast.info('Complete seus dados para continuar usando o sistema.');
            navigate('/admin/my-profile', { replace: true });
        }
    }, [activeMembership?.member_id, isOnboardingPending, location.pathname]);

    // Persist sidebar group state to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(openSections));
        } catch {
            // noop
        }
    }, [openSections]);

    const handleLogout = async () => {
        const activeStoreId = getActiveStoreId();

        if (activeStoreId) {
            try {
                await supabase.rpc('log_user_session_event', {
                    p_store_id: activeStoreId,
                    p_action: 'session_logout',
                    p_details: {
                        source: 'private_layout',
                        session_started_at: sessionStartTime.toISOString(),
                        session_elapsed: sessionElapsedTime,
                    },
                    p_outcome: 'success',
                });
            } catch (error) {
                console.warn('Não foi possível registrar logout:', error);
            }
        }

        clearActiveStoreId();
        sessionStorage.removeItem('optmamenu.session.start');
        clearSessionSecurity();
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
    };

    useEffect(() => {
        if (isNewSession && pathname !== '/admin') {
            navigate('/admin', { replace: true });
        }
    }, [isNewSession, pathname, navigate]);

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

    const handleClockClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (popoverTimeoutId) {
            clearTimeout(popoverTimeoutId);
            setPopoverTimeoutId(null);
        }

        if (isClockPopoverOpen) {
            // Se já está aberto, reinicia o timer para mantê-lo visível por mais 5s
            const id = setTimeout(() => {
                setIsClockPopoverOpen(false);
            }, 5000);
            setPopoverTimeoutId(id);
        } else {
            // Se está fechado, abre e inicia o timer de 5s
            setIsClockPopoverOpen(true);
            const id = setTimeout(() => {
                setIsClockPopoverOpen(false);
            }, 5000);
            setPopoverTimeoutId(id);
        }
    };

    // Fechar popover ao clicar fora
    useEffect(() => {
        if (!isClockPopoverOpen) return;

        const handleOutsideClick = () => {
            setIsClockPopoverOpen(false);
            if (popoverTimeoutId) {
                clearTimeout(popoverTimeoutId);
                setPopoverTimeoutId(null);
            }
        };

        document.addEventListener('click', handleOutsideClick);
        return () => {
            document.removeEventListener('click', handleOutsideClick);
        };
    }, [isClockPopoverOpen, popoverTimeoutId]);

    // Limpar timeout ao desmontar
    useEffect(() => {
        return () => {
            if (popoverTimeoutId) clearTimeout(popoverTimeoutId);
        };
    }, [popoverTimeoutId]);

    // Resolve o grupo e item ativo
    const currentItem = useMemo(() => {
        const search = location.search || '';
        // 1. Tenta correspondência exata de caminho e query string
        for (const [group, items] of Object.entries(navigationItems)) {
            const matchedItem = items.find(item => {
                if (pathname !== item.path) return false;
                if (item.queryString) {
                    if (item.path === '/admin/settings' && item.queryString === 'tab=store') {
                        return search.includes('tab=store') || !search.includes('tab=');
                    }
                    return search.includes(item.queryString);
                }
                return true;
            });
            if (matchedItem) {
                return { group, item: matchedItem };
            }
        }
        // 2. Se não achar exato com query string, tenta correspondência simples de caminho
        for (const [group, items] of Object.entries(navigationItems)) {
            const matchedItem = items.find(item => pathname === item.path);
            if (matchedItem) {
                return { group, item: matchedItem };
            }
        }
        // 3. Se não achar exato, tenta por prefixo de subpasta (excluindo /admin que é raiz)
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
    }, [navigationItems, pathname, location.search]);

    // Helper para verificar se um item de menu está ativo no contexto atual
    const isMenuItemActive = useCallback(
        (item: MenuItem, currentSearch: string) => {
            const pathMatches =
                pathname === item.path ||
                (item.path !== '/admin' && item.path !== '/admin/products' && pathname.startsWith(`${item.path}/`));
            if (!pathMatches) return false;
            if (item.queryString) {
                const search = currentSearch || '';
                if (item.path === '/admin/settings' && item.queryString === 'tab=store') {
                    return search.includes('tab=store') || !search.includes('tab=');
                }
                return search.includes(item.queryString);
            }
            return true;
        },
        [pathname]
    );

    // Resolve as rotas irmãs para o Acesso Rápido (exclui o atual)
    const siblingItems = useMemo(() => {
        if (!currentItem) return [];
        const groupItems = navigationItems[currentItem.group as keyof typeof navigationItems] || [];
        return groupItems.filter(
            item => {
                const isSameItem =
                    item.path === currentItem.item.path &&
                    (item.queryString ?? '') === (currentItem.item.queryString ?? '');
                return !isSameItem && isMenuItemVisible(currentItem.group, item);
            }
        );
    }, [currentItem, navigationItems, isMenuItemVisible]);

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
                personal: false,
                dashboard: false,
                commercial: false,
                financial: false,
                products: false,
                team: false,
                settings: false,
                security: false,
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
                        {/*                         {userData && (
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
                                    <div className={`${isSidebarCollapsed ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-lg'} rounded-full bg-[#19A999]/10 dark:bg-[#19A999]/20 flex items-center justify-center text-[#19A999] font-bold`} title={isSidebarCollapsed ? userData.name : ''}>
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
                        )} */}

                        {/* Active Store */}
                        {activeMembership && (
                            <div
                                className={`rounded-xl bg-gray-50 dark:bg-gray-700/50 shadow-sm border border-gray-100 dark:border-gray-700 transition-all ${isSidebarCollapsed ? 'p-1.5 flex justify-center' : 'p-2 flex items-center gap-3'
                                    }`}
                            >
                                <div
                                    className={`relative ${isSidebarCollapsed ? 'w-8 h-8' : 'w-10 h-10'
                                        } rounded-full overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0`}
                                    title={isSidebarCollapsed ? activeMembership.store_name : ''}
                                >
                                    {activeMembership.store_logo_url ? (
                                        <img
                                            src={activeMembership.store_logo_url}
                                            alt={activeMembership.store_name}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    ) : (
                                        <StoreIcon size={isSidebarCollapsed ? 16 : 20} className="text-brand-green" />
                                    )}
                                </div>

                                {!isSidebarCollapsed && (
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-bold text-gray-800 dark:text-white truncate font-candara-bold">
                                            {activeMembership.store_name}
                                        </p>
                                        <p className="text-[11px] font-bold text-brand-green truncate font-candara uppercase tracking-wide">
                                            {activeMembership.custom_role_name
                                                ? activeMembership.custom_role_name
                                                : formatLayoutRole(activeMembership.role)}
                                        </p>
                                        {activeMembership.custom_role_name && (
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate font-candara">
                                                Base: {formatLayoutRole(activeMembership.role)}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Logged User */}
                        {userData && (
                            <div
                                className={`rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 transition-all ${isSidebarCollapsed ? 'p-1.5 flex justify-center' : 'p-2 flex items-center gap-3'
                                    }`}
                            >
                                <div className={`relative ${isSidebarCollapsed ? 'h-8 w-8 text-[11px]' : 'h-12 w-12 text-sm'} overflow-hidden rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-600`} title={isSidebarCollapsed ? userData.name : ''}>
                                    {userData.avatar ? (
                                        <img
                                            src={userData.avatar}
                                            alt={userData.name}
                                            className="absolute inset-0 h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-teal-800 dark:text-teal-200 font-black">{getInitials(userData.name)}</span>
                                    )}
                                </div>

                                {!isSidebarCollapsed && (
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-bold text-gray-800 dark:text-white truncate font-candara-bold">
                                            {userData.alias}
                                        </p>
                                        {/*                                         <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate font-candara">
                                            {userData.email}
                                        </p> */}
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate font-candara">
                                            Sessão iniciada às {sessionStartTime.toLocaleTimeString('pt-BR')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Navigation Menu */}
                        {/* [CORREÇÃO 3] Indicador discreto aparece apenas durante refresh
                            silencioso (refreshingPermissions), nunca durante loading inicial,
                            garantindo que a sidebar nunca pisca ou some durante atualizaes. */}
                        {refreshingPermissions && (
                            <div className="px-4 py-1 text-[10px] text-gray-400">
                                Atualizando permissões...
                            </div>
                        )}
                        <nav className="space-y-4">
                            {Object.entries(navigationItems).map(([section, items]) => {
                                const visibleItems = items.filter((item) =>
                                    isMenuItemVisible(section, item)
                                );

                                if (visibleItems.length === 0) {
                                    return null;
                                }

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
                                                    {section === 'personal' && 'Pessoal'}
                                                    {section === 'dashboard' && 'Dashboard'}
                                                    {section === 'commercial' && 'Comercial'}
                                                    {section === 'financial' && 'Financeiro'}
                                                    {section === 'products' && 'Produtos'}
                                                    {section === 'team' && 'Usuários e Equipe'}
                                                    {section === 'settings' && 'Configurações'}
                                                    {section === 'security' && 'Segurança'}
                                                    {section === 'support' && 'Suporte'}
                                                </span>
                                                <ChevronDown
                                                    size={14}
                                                    className={`text-gray-400 transition-transform duration-200 ${openSections[section] ? 'rotate-180' : ''
                                                        }`}
                                                />
                                            </button>
                                        )}
                                        {(openSections[section] || isSidebarCollapsed) && visibleItems
                                            .map(item => {
                                                const IconComponent = item.icon;
                                                const isActive = isMenuItemActive(item, location.search);
                                                const linkTo = item.queryString
                                                    ? `${item.path}?${item.queryString}`
                                                    : item.path;

                                                return (
                                                    <Link
                                                        key={`${item.path}-${item.queryString ?? ''}`}
                                                        to={linkTo}
                                                        title={isSidebarCollapsed ? item.label : ''}
                                                        className={`flex items-center gap-3 rounded-xl font-bold text-sm transition-all relative
                                                        ${isSidebarCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'}
                                                        ${isActive
                                                                ? 'bg-[#19A999]/10 text-[#19A999] border border-[#19A999]/20 dark:bg-[#19A999]/20'
                                                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                                            }`}
                                                    >
                                                        <IconComponent
                                                            size={isSidebarCollapsed ? 22 : 18}
                                                            className={isActive ? 'text-[#19A999]' : 'text-gray-400'}
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
                                        href="https://www.optmaidea.com.br/"
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

                    {/* Right Side: Quick actions */}
                    <div className="flex items-center gap-1.5 ml-auto">
                        {/* User Identity Chip   apelido + avatar do usuário logado */}
                        {userData && (
                            <div
                                className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 shrink-0 select-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                onClick={() => navigate('/admin/my-profile')}
                            >
                                <div className="relative h-6 w-6 rounded-full overflow-hidden bg-teal-100 dark:bg-teal-950 flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-600">
                                    {userData.avatar ? (
                                        <img
                                            src={userData.avatar}
                                            alt={userData.alias}
                                            className="absolute inset-0 h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-[10px] text-teal-800 dark:text-teal-200 font-black">
                                            {getInitials(userData.alias)}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 font-candara">
                                    {userData.alias}
                                </span>
                            </div>
                        )}

                        {userData && storeSlug && (
                            <span className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700 mx-1 hidden lg:block shrink-0" />
                        )}

                        {/* Store Slug Icon (Casinha para slug) - cor brand green #19A999 */}
                        {storeSlug && (
                            isPublicStoreEnabled ? (
                                <a
                                    href={`/s/${storeSlug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Acessar loja: /s/${storeSlug}`}
                                    className="p-2 rounded-lg text-[#19A999] hover:bg-gray-100 dark:hover:bg-gray-700 transition shrink-0"
                                >
                                    <StoreIcon size={19} className="text-[#19A999]" />
                                </a>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    title="Loja pública desativada"
                                    className="p-2 rounded-lg text-gray-300 dark:text-gray-600 cursor-not-allowed shrink-0"
                                >
                                    <StoreIcon size={19} />
                                </button>
                            )
                        )}

                        <span className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block shrink-0" />

                        {/* Mensagens Sininho Relógio */}
                        <div className="flex items-center gap-1">
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

                            {/* Relógio Icon with Popover */}
                            <div className="relative shrink-0">
                                <button
                                    type="button"
                                    onClick={handleClockClick}
                                    title="Tempo de Sessão"
                                    className={`p-2 rounded-lg transition relative shrink-0 ${isClockPopoverOpen
                                        ? 'text-[#19A999] bg-[#19A999]/10 hover:bg-[#19A999]/20'
                                        : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <Clock size={19} />
                                </button>

                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-xl z-50 transition-all duration-300 origin-top-right ${isClockPopoverOpen
                                        ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                                        : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                                        }`}
                                >
                                    <div className="space-y-3 font-candara text-xs text-gray-650 dark:text-gray-300">
                                        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2 mb-1">
                                            <Clock size={15} className="text-[#19A999]" />
                                            <span className="font-bold text-gray-800 dark:text-white">Informações da Sessão</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-550 dark:text-gray-400">Sessão iniciada às:</span>
                                            <span className="font-mono font-bold text-gray-800 dark:text-white">
                                                {sessionStartTime.toLocaleTimeString('pt-BR')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-550 dark:text-gray-400">Horário atual:</span>
                                            <span className="font-mono font-bold text-gray-800 dark:text-white">
                                                {currentTime.toLocaleTimeString('pt-BR')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                                            <span className="text-gray-550 dark:text-gray-400">Duração da sessão:</span>
                                            <span className="font-mono font-bold text-[#19A999]">
                                                {sessionElapsedTime}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <span className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block shrink-0" />

                        {/* Seletor de tema Botão desligar */}
                        <div className="flex items-center gap-1">
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
                    </div>
                </header>

                {/* Quick Access Bar */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 md:px-8 py-2.5 flex items-center justify-between flex-wrap gap-2 z-20 shrink-0">
                    <div className="flex items-center gap-1.5 py-0.5 min-w-0">
                        {siblingItems.length > 0 ? (
                            <>
                                {/* Telas grandes: lista de links inline */}
                                <div className="hidden xl:flex items-center gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar min-w-0">
                                    {siblingItems.map((item) => {
                                        const SiblingIcon = item.icon;
                                        const siblingTo = item.queryString
                                            ? `${item.path}?${item.queryString}`
                                            : item.path;
                                        return (
                                            <Link
                                                key={`${item.path}-${item.queryString ?? ''}`}
                                                to={siblingTo}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 hover:bg-[#19A999]/10 hover:text-[#19A999] text-xs font-semibold text-gray-600 dark:text-gray-300 transition-colors border border-gray-100 dark:border-gray-700 shrink-0"
                                            >
                                                <SiblingIcon size={13} className="text-gray-400 dark:text-gray-500" />
                                                <span>{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>

                                {/* Telas menores (desktop compactado/tablet/mobile): menu suspenso por hover/clique */}
                                <div
                                    className="relative xl:hidden"
                                    onMouseEnter={() => setIsQuickAccessOpen(true)}
                                    onMouseLeave={() => setIsQuickAccessOpen(false)}
                                >
                                    <button
                                        onClick={() => setIsQuickAccessOpen(!isQuickAccessOpen)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 hover:bg-[#19A999]/10 hover:text-[#19A999] text-xs font-bold text-gray-600 dark:text-gray-300 transition-all border border-gray-150 dark:border-gray-700 shrink-0 cursor-pointer shadow-sm"
                                    >
                                        <SlidersHorizontal size={13} className="text-gray-400 dark:text-gray-500" />
                                        <span>Acesso Rápido</span>
                                        <ChevronDown size={13} className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isQuickAccessOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isQuickAccessOpen && (
                                        <div className="absolute left-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl py-1.5 z-50 animate-fadeIn flex flex-col gap-0.5">
                                            {siblingItems.map((item) => {
                                                const SiblingIcon = item.icon;
                                                const siblingTo = item.queryString
                                                    ? `${item.path}?${item.queryString}`
                                                    : item.path;
                                                return (
                                                    <Link
                                                        key={`${item.path}-${item.queryString ?? ''}`}
                                                        to={siblingTo}
                                                        onClick={() => setIsQuickAccessOpen(false)}
                                                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-[#19A999]/10 hover:text-[#19A999] dark:hover:bg-[#19A999]/20 transition-all rounded-lg mx-1"
                                                    >
                                                        <SiblingIcon size={14} className="text-gray-400 dark:text-gray-500" />
                                                        <span>{item.label}</span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition hover:border-[#19A999]/35 shrink-0 shadow-sm cursor-pointer"
                            title="Atualizar dados da página"
                        >
                            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                            <span>Atualizar</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area Scrollable */}
                <div id="main-scroll-container" className="flex-1 min-w-0 overflow-y-auto custom-scrollbar flex flex-col bg-[#F8F6F2] dark:bg-gray-950">
                    <main className="flex-1 min-w-0 p-4 md:p-8">
                        <MyStoreInvitesBanner />
                        <Outlet />
                    </main>
                </div>
            </div>
            <BackToTopButton />
        </div>
    );
}
