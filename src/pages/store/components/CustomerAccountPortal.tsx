import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BellRing,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Eye,
    EyeOff,
    FileText,
    Gift,
    History,
    KeyRound,
    Loader2,
    LogOut,
    Mail,
    MapPin,
    MessageCircle,
    PackageCheck,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Search,
    ShoppingCart,
    ShieldCheck,
    Star,
    Trash2,
    UserRound,
    X,
    XCircle,
} from 'lucide-react';
import { AuthService, type TrustedCustomerDevice } from '@/services/customerAuth';
import {
    CustomerService,
    type CustomerLoyaltyReward,
    type CustomerLoyaltyVoucher,
    type CustomerSelfConsentEvent,
} from '@/services/customerService';
import { PublicStorefrontService } from '@/services/publicStorefrontService';
import { flushCustomerCartServerSync } from '@/services/customerCartPersistence';
import { supabaseCustomer } from '@/lib/supabase';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { useCartStore } from '@/store/useCartStore';
import { formatBRL } from '@/utils/pricing';
import { toast } from 'sonner';
import { systemConfirm } from '@/components/common/SystemDialogProvider';

interface CustomerAddress {
    id?: string;
    zip_code: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    is_default: boolean;
}

interface CustomerOrderItemSummary {
    id: string;
    product_id?: string | null;
    quantity: number;
    unit_price: number;
    product?: {
        id?: string | null;
        name?: string | null;
    } | null;
}

interface CustomerOrderSummary {
    id: string;
    order_code?: string | null;
    status?: string | null;
    status_reason?: string | null;
    payment_status?: string | null;
    payment_method_code?: string | null;
    public_order_token?: string | null;
    total?: number | string | null;
    created_at?: string | null;
    status_changed_at?: string | null;
    available_until?: string | null;
    cancellation_grace_until?: string | null;
    fulfillment_type?: string | null;
    order_items: CustomerOrderItemSummary[];
}

interface LoyaltyTransactionSummary {
    id: string;
    type?: string | null;
    points: number;
    description?: string | null;
    order_id?: string | null;
    order_code?: string | null;
    created_at?: string | null;
}

interface CustomerNotificationSummary {
    id: string;
    title?: string | null;
    message?: string | null;
    type?: string | null;
    category?: string | null;
    read?: boolean;
    created_at?: string | null;
}

interface LoyaltyProgramSummary {
    id?: string;
    name?: string;
    is_active?: boolean;
    points_per_currency?: number | string;
    min_order_value?: number | string;
    enable_join_bonus?: boolean;
    join_bonus_points?: number;
    enable_birthday_bonus?: boolean;
    birthday_bonus_points?: number;
    points_validity_months?: number;
    min_points_redemption?: number;
    program_terms?: string;
    voucher_terms?: string;
    updated_at?: string;
}

type AccountTab =
    | 'profile'
    | 'loyalty-settings'
    | 'addresses'
    | 'orders'
    | 'consumption'
    | 'communications'
    | 'messages'
    | 'loyalty'
    | 'privacy'
    | 'security';

type NotificationCategoryFilter =
    | 'all'
    | 'orders'
    | 'loyalty'
    | 'system'
    | 'profile'
    | 'security'
    | 'marketing'
    | 'general';

type LoyaltyTransactionFilter = 'all' | 'earned' | 'spent';

const CUSTOMER_ORDERS_REFRESH_MS = 12000;
const CUSTOMER_SECURITY_REFRESH_MS = 8000;

const EMPTY_ADDRESS: CustomerAddress = {
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
    is_default: false,
};

function onlyDigits(value: string) {
    return value.replace(/\D/g, '');
}

function formatCep(value: string) {
    const digits = onlyDigits(value).slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function normalizeOrder(order: Record<string, unknown>): CustomerOrderSummary {
    const rawItems = Array.isArray(order.order_items) ? order.order_items : [];
    const orderItems = rawItems.map((raw) => {
        const item = raw as Record<string, unknown>;
        const rawProduct = item.product && typeof item.product === 'object'
            ? item.product as Record<string, unknown>
            : null;
        return {
            id: String(item.id ?? ''),
            product_id: item.product_id ? String(item.product_id) : null,
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price || 0),
            product: rawProduct ? {
                id: rawProduct.id ? String(rawProduct.id) : null,
                name: rawProduct.name ? String(rawProduct.name) : null,
            } : null,
        };
    });

    return {
        id: String(order.id ?? ''),
        order_code: order.order_code ? String(order.order_code) : null,
        status: order.status ? String(order.status) : null,
        status_reason: order.status_reason ? String(order.status_reason) : null,
        payment_status: order.payment_status ? String(order.payment_status) : null,
        payment_method_code: order.payment_method_code ? String(order.payment_method_code) : null,
        public_order_token: order.public_order_token ? String(order.public_order_token) : null,
        total: typeof order.total === 'number' || typeof order.total === 'string' ? order.total : null,
        created_at: order.created_at ? String(order.created_at) : null,
        status_changed_at: order.status_changed_at ? String(order.status_changed_at) : null,
        available_until: order.available_until ? String(order.available_until) : null,
        cancellation_grace_until: order.cancellation_grace_until ? String(order.cancellation_grace_until) : null,
        fulfillment_type: order.fulfillment_type ? String(order.fulfillment_type) : null,
        order_items: orderItems,
    };
}

function orderStatusLabel(status?: string | null, statusReason?: string | null) {
    if (status === 'cancelled' && statusReason === 'expired') return 'Expirado';
    switch (status) {
        case 'reserved': return 'Reservado';
        case 'confirmed': return 'Confirmado';
        case 'ready': return 'Pronto';
        case 'out_for_delivery': return 'Saiu para entrega';
        case 'completed': return 'Concluído';
        case 'cancelled': return 'Cancelado';
        default: return status || 'Em andamento';
    }
}

function orderActivityLabel(status?: string | null, statusReason?: string | null) {
    if (status === 'cancelled' && statusReason === 'expired') return 'Expirou';
    switch (status) {
        case 'reserved': return 'Recebido';
        case 'confirmed': return 'Confirmado';
        case 'ready': return 'Pronto';
        case 'out_for_delivery': return 'Saiu para entrega';
        case 'completed': return 'Concluído';
        case 'cancelled': return 'Cancelado';
        default: return 'Atualizado';
    }
}

function orderActivityAt(order: CustomerOrderSummary) {
    return order.status_changed_at || order.created_at || null;
}

function orderPickupDeadlineLabel(order: CustomerOrderSummary) {
    if (
        order.status !== 'ready'
        || order.fulfillment_type !== 'pickup'
        || order.payment_status === 'paid'
        || !order.available_until
    ) return null;

    const deadline = new Date(order.available_until);
    if (Number.isNaN(deadline.getTime())) return null;
    return `Retire até ${deadline.toLocaleString('pt-BR')}`;
}

function consentTypeLabel(value?: string | null) {
    switch (value) {
        case 'loyalty_program': return 'Participação na fidelidade';
        case 'loyalty_data_responsibility': return 'Responsabilidade pelos dados da fidelidade';
        case 'marketing_whatsapp': return 'Marketing por WhatsApp';
        case 'marketing_email': return 'Marketing por e-mail';
        case 'marketing_sms': return 'Marketing por SMS';
        case 'loyalty_whatsapp': return 'Fidelidade por WhatsApp';
        case 'loyalty_email': return 'Fidelidade por e-mail';
        case 'loyalty_sms': return 'Fidelidade por SMS';
        case 'loyalty_webapp': return 'Mensagens da fidelidade no site/app';
        case 'terms': return 'Termos de uso';
        case 'privacy': return 'Política de privacidade';
        default:
            return String(value || 'Consentimento')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
}

function consentSourceLabel(value?: string | null) {
    switch (value) {
        case 'customer_portal':
        case 'customer_marketing_preferences':
        case 'customer_loyalty_preferences':
        case 'customer_loyalty_join':
        case 'customer_portal_profile':
            return 'Área do cliente';
        case 'registration':
        case 'self_signup':
            return 'Cadastro';
        case 'admin':
        case 'backoffice':
            return 'Loja';
        default:
            return value ? String(value).replace(/_/g, ' ') : 'Não informado';
    }
}

function notificationCategoryLabel(value?: string | null) {
    switch (value) {
        case 'orders': return 'Pedidos';
        case 'loyalty': return 'Fidelidade';
        case 'profile': return 'Perfil';
        case 'security': return 'Segurança';
        case 'marketing': return 'Marketing';
        case 'general': return 'Geral';
        default: return 'Sistema';
    }
}

function notificationCategoryClass(value?: string | null) {
    switch (value) {
        case 'orders': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
        case 'loyalty': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
        case 'profile': return 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300';
        case 'security': return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';
        case 'marketing': return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300';
        default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    }
}

function fulfillmentLabel(value?: string | null) {
    switch (value) {
        case 'delivery': return 'Entrega';
        case 'pickup': return 'Retirada';
        case 'table':
        case 'qr_table': return 'Mesa/QR';
        case 'dine_in': return 'Consumo no local';
        default: return value || '';
    }
}

function friendlyOrderStatusMessage(order: CustomerOrderSummary) {
    const code = order.order_code || `Pedido ${order.id.slice(0, 8)}`;
    if (order.status === 'cancelled' && order.status_reason === 'expired') {
        return `${code}: o prazo de retirada terminou e o pedido não está mais disponível. Você pode fazer um novo pedido.`;
    }
    switch (order.status) {
        case 'confirmed': return `${code}: seu pedido foi confirmado e está em preparo.`;
        case 'ready': return `${code}: seu pedido está pronto.`;
        case 'out_for_delivery': return `${code}: saiu para entrega. Acompanhe por aqui as próximas atualizações.`;
        case 'completed': return `${code}: pedido concluído. Obrigado pela compra!`;
        case 'cancelled': return `${code}: o pedido foi cancelado.`;
        default: return `${code}: status atualizado para ${orderStatusLabel(order.status, order.status_reason)}.`;
    }
}

function PasswordField({
    label,
    value,
    onChange,
    placeholder,
    autoComplete,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    autoComplete: string;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">{label}</label>
            <div className="relative">
                <input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete={autoComplete}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-3 pr-12 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder={placeholder}
                />
                <button
                    type="button"
                    onClick={() => setVisible((current) => !current)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-emerald-600"
                    aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                    title={visible ? 'Ocultar senha' : 'Mostrar senha'}
                >
                    {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
            </div>
        </div>
    );
}

export function CustomerAccountPortal({ hideTrigger = false }: { hideTrigger?: boolean }) {
    const navigate = useNavigate();
    const customer = useCustomerAuth((state) => state.customer);
    const cartContext = useCartStore((state) => state.context);
    const addToCart = useCartStore((state) => state.addToCart);
    const openCart = useCartStore((state) => state.openCart);
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<AccountTab>('profile');
    const [loading, setLoading] = useState(false);
    const [cepLoading, setCepLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [nickname, setNickname] = useState(customer?.nickname || '');
    const [fullName, setFullName] = useState(customer?.full_name || '');
    const [email, setEmail] = useState(customer?.email || '');
    const [cpf, setCpf] = useState(customer?.cpf || '');
    const [birthDate, setBirthDate] = useState(customer?.birth_date || '');

    const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
    const [addressForm, setAddressForm] = useState<CustomerAddress>(EMPTY_ADDRESS);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [showAddressForm, setShowAddressForm] = useState(false);

    const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
    const [ordersRefreshing, setOrdersRefreshing] = useState(false);
    const [ordersUpdatedAt, setOrdersUpdatedAt] = useState<Date | null>(null);
    const [loyaltySaving, setLoyaltySaving] = useState(false);
    const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransactionSummary[]>([]);
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgramSummary | null>(null);
    const [loyaltyBlocked, setLoyaltyBlocked] = useState(false);
    const [loyaltyBlockReason, setLoyaltyBlockReason] = useState<string | null>(null);
    const [loyaltyJoinOpen, setLoyaltyJoinOpen] = useState(false);
    const [loyaltyTermsAccepted, setLoyaltyTermsAccepted] = useState(false);
    const [loyaltyDataResponsibilityAccepted, setLoyaltyDataResponsibilityAccepted] = useState(false);
    const [showLoyaltyExitConfirm, setShowLoyaltyExitConfirm] = useState(false);
    const [marketingWhatsapp, setMarketingWhatsapp] = useState(false);
    const [marketingEmail, setMarketingEmail] = useState(false);
    const [marketingSms, setMarketingSms] = useState(false);
    const [marketingPreferencesSaving, setMarketingPreferencesSaving] = useState(false);
    const [loyaltyWhatsapp, setLoyaltyWhatsapp] = useState(false);
    const [loyaltyEmail, setLoyaltyEmail] = useState(false);
    const [loyaltySms, setLoyaltySms] = useState(false);
    const loyaltyWebApp = true;
    const [loyaltyPreferencesSaving, setLoyaltyPreferencesSaving] = useState(false);
    const [loyaltyRewards, setLoyaltyRewards] = useState<CustomerLoyaltyReward[]>([]);
    const [loyaltyVouchers, setLoyaltyVouchers] = useState<CustomerLoyaltyVoucher[]>([]);
    const [loyaltyRewardsLoading, setLoyaltyRewardsLoading] = useState(false);
    const [loyaltyTransactionFilter, setLoyaltyTransactionFilter] = useState<LoyaltyTransactionFilter>('all');
    const [notifications, setNotifications] = useState<CustomerNotificationSummary[]>([]);
    const [notificationCategoryFilter, setNotificationCategoryFilter] = useState<NotificationCategoryFilter>('all');
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [consentEvents, setConsentEvents] = useState<CustomerSelfConsentEvent[]>([]);
    const [profileDirty, setProfileDirty] = useState(false);
    const [emailVerificationSending, setEmailVerificationSending] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [expandedConsumptionKey, setExpandedConsumptionKey] = useState<string | null>(null);
    const [reorderLoadingOrderId, setReorderLoadingOrderId] = useState<string | null>(null);
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled' | 'expired'>('all');
    const [orderFulfillmentFilter, setOrderFulfillmentFilter] = useState<'all' | 'pickup' | 'delivery'>('all');
    const [orderSearch, setOrderSearch] = useState('');
    const [consumptionFulfillmentFilter, setConsumptionFulfillmentFilter] = useState<'all' | 'pickup' | 'delivery'>('all');
    const [consumptionSearch, setConsumptionSearch] = useState('');
    const [consumptionCatalog, setConsumptionCatalog] = useState<Map<string, {
        id: string;
        imageUrl: string | null;
    }>>(new Map());
    const ordersRef = useRef<CustomerOrderSummary[]>([]);
    const ordersRequestInFlightRef = useRef(false);
    const loyaltyTopRef = useRef<HTMLDivElement | null>(null);
    const [storeDisplayName, setStoreDisplayName] = useState('esta loja');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [trustedDevices, setTrustedDevices] = useState<TrustedCustomerDevice[]>([]);
    const [trustedDevicesLoading, setTrustedDevicesLoading] = useState(false);
    const [trustedDevicesRevoking, setTrustedDevicesRevoking] = useState(false);
    const [editingTrustedDeviceId, setEditingTrustedDeviceId] = useState<string | null>(null);
    const [editingTrustedDeviceLabel, setEditingTrustedDeviceLabel] = useState('');
    const [revokingTrustedDeviceId, setRevokingTrustedDeviceId] = useState<string | null>(null);
    const [targetDevicePassword, setTargetDevicePassword] = useState('');
    const [revokeAllDevicesOpen, setRevokeAllDevicesOpen] = useState(false);
    const [revokeAllDevicesPassword, setRevokeAllDevicesPassword] = useState('');
    const [productRatings, setProductRatings] = useState<Record<string, number>>({});
    const [ratingSavingProductId, setRatingSavingProductId] = useState<string | null>(null);
    const [exportingData, setExportingData] = useState(false);
    const [deletionOpen, setDeletionOpen] = useState(false);
    const [deletionPassword, setDeletionPassword] = useState('');
    const [deletionOtp, setDeletionOtp] = useState('');
    const [deletionOtpSent, setDeletionOtpSent] = useState(false);
    const [deletionSubmitting, setDeletionSubmitting] = useState(false);
    const [deletionRequestStatus, setDeletionRequestStatus] = useState<string | null>(null);
    const [phoneChangeOpen, setPhoneChangeOpen] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [phoneChangeOtp, setPhoneChangeOtp] = useState('');
    const [phoneChangeOtpSent, setPhoneChangeOtpSent] = useState(false);
    const [phoneChangeSubmitting, setPhoneChangeSubmitting] = useState(false);
    const [protectedProfileOpen, setProtectedProfileOpen] = useState(false);
    const [protectedCpf, setProtectedCpf] = useState('');
    const [protectedBirthDate, setProtectedBirthDate] = useState('');
    const [protectedProfileOtp, setProtectedProfileOtp] = useState('');
    const [protectedProfileOtpSent, setProtectedProfileOtpSent] = useState(false);
    const [protectedProfileSubmitting, setProtectedProfileSubmitting] = useState(false);

    const displayName = useMemo(
        () => customer?.nickname || customer?.full_name || 'cliente',
        [customer?.full_name, customer?.nickname],
    );

    useEffect(() => {
        const slug = cartContext?.canonicalSlug || cartContext?.requestedSlug;
        if (!slug) {
            setStoreDisplayName('esta loja');
            return;
        }

        let active = true;
        void PublicStorefrontService.getStorefrontBySlug(slug)
            .then((result) => {
                if (!active) return;
                const name = result.store?.name?.trim();
                setStoreDisplayName(name || 'esta loja');
            })
            .catch(() => {
                if (active) setStoreDisplayName('esta loja');
            });

        return () => {
            active = false;
        };
    }, [cartContext?.canonicalSlug, cartContext?.requestedSlug]);

    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const consumptionHistory = useMemo(() => {
        const grouped = new Map<string, {
            key: string;
            productId: string | null;
            name: string;
            totalQuantity: number;
            totalSpent: number;
            lastOrderedAt: string | null;
            occurrences: Array<{
                orderId: string;
                orderCode: string;
                status: string | null;
                fulfillmentType: string | null;
                createdAt: string | null;
                quantity: number;
                unitPrice: number;
                lineTotal: number;
            }>;
        }>();

        orders
            .filter((order) => order.status === 'completed')
            .filter((order) => (
                consumptionFulfillmentFilter === 'all'
                || order.fulfillment_type === consumptionFulfillmentFilter
            ))
            .forEach((order) => {
                order.order_items.forEach((item) => {
                    const name = item.product?.name || 'Produto indisponível';
                    const productId = item.product_id || item.product?.id || null;
                    const key = productId || ('name:' + name.toLocaleLowerCase('pt-BR'));
                    const lineTotal = Number(item.unit_price || 0) * Number(item.quantity || 0);
                    const current = grouped.get(key) || {
                        key,
                        productId,
                        name,
                        totalQuantity: 0,
                        totalSpent: 0,
                        lastOrderedAt: null,
                        occurrences: [],
                    };

                    current.totalQuantity += Number(item.quantity || 0);
                    current.totalSpent += lineTotal;
                    if (!current.lastOrderedAt || (
                        order.created_at
                        && new Date(order.created_at).getTime() > new Date(current.lastOrderedAt).getTime()
                    )) {
                        current.lastOrderedAt = order.created_at || null;
                    }
                    current.occurrences.push({
                        orderId: order.id,
                        orderCode: order.order_code || ('Pedido ' + order.id.slice(0, 8)),
                        status: order.status || null,
                        fulfillmentType: order.fulfillment_type || null,
                        createdAt: order.created_at || null,
                        quantity: Number(item.quantity || 0),
                        unitPrice: Number(item.unit_price || 0),
                        lineTotal,
                    });
                    grouped.set(key, current);
                });
            });

        return Array.from(grouped.values())
            .map((item) => ({
                ...item,
                occurrences: item.occurrences.sort((a, b) => {
                    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    return bTime - aTime;
                }),
            }))
            .sort((a, b) => {
                const bTime = b.lastOrderedAt ? new Date(b.lastOrderedAt).getTime() : 0;
                const aTime = a.lastOrderedAt ? new Date(a.lastOrderedAt).getTime() : 0;
                return bTime - aTime;
            })
            .filter((item) => (
                !consumptionSearch.trim()
                || item.name.toLocaleLowerCase('pt-BR').includes(consumptionSearch.trim().toLocaleLowerCase('pt-BR'))
            ));
    }, [orders, consumptionFulfillmentFilter, consumptionSearch]);

    const filteredOrders = useMemo(() => {
        const search = orderSearch.trim().toLocaleLowerCase('pt-BR');

        return orders.filter((order) => {
            const statusMatches = orderStatusFilter === 'all'
                || (orderStatusFilter === 'active' && !['completed', 'cancelled'].includes(order.status || ''))
                || (orderStatusFilter === 'expired' && order.status === 'cancelled' && order.status_reason === 'expired')
                || (orderStatusFilter === 'cancelled' && order.status === 'cancelled' && order.status_reason !== 'expired')
                || order.status === orderStatusFilter;
            if (!statusMatches) return false;

            if (
                orderFulfillmentFilter !== 'all'
                && order.fulfillment_type !== orderFulfillmentFilter
            ) return false;

            if (!search) return true;
            const searchable = [
                order.order_code,
                orderStatusLabel(order.status, order.status_reason),
                fulfillmentLabel(order.fulfillment_type),
                ...order.order_items.map((item) => item.product?.name || ''),
            ].join(' ').toLocaleLowerCase('pt-BR');

            return searchable.includes(search);
        });
    }, [orders, orderFulfillmentFilter, orderSearch, orderStatusFilter]);


    const loyaltyAgeRestricted = useMemo(() => {
        if (!customer?.birth_date) return false;
        const birth = new Date(`${customer.birth_date}T12:00:00`);
        if (Number.isNaN(birth.getTime())) return false;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
        return age < 18;
    }, [customer?.birth_date]);

    const loyaltyMissingFields = useMemo(() => {
        if (!customer) return ['cadastro'];
        const missing: string[] = [];
        if (!customer.full_name || customer.full_name.trim().length < 3) missing.push('nome');
        if (!customer.birth_date) missing.push('data de nascimento');
        if (loyaltyAgeRestricted) missing.push('idade mínima de 18 anos');
        if (onlyDigits(customer.cpf || '').length !== 11) missing.push('CPF');

        const normalizedEmail = String(customer.email || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            missing.push('e-mail válido');
        } else if (!customer.email_verified) {
            missing.push('confirmação do e-mail');
        }
        return missing;
    }, [customer, loyaltyAgeRestricted]);

    const loyaltyTotals = useMemo(() => loyaltyTransactions.reduce((totals, transaction) => {
        if (transaction.points > 0) totals.earned += transaction.points;
        if (transaction.points < 0) totals.spent += Math.abs(transaction.points);
        return totals;
    }, { earned: 0, spent: 0 }), [loyaltyTransactions]);

    const filteredLoyaltyTransactions = useMemo(() => {
        if (loyaltyTransactionFilter === 'earned') return loyaltyTransactions.filter((item) => item.points > 0);
        if (loyaltyTransactionFilter === 'spent') return loyaltyTransactions.filter((item) => item.points < 0);
        return loyaltyTransactions;
    }, [loyaltyTransactionFilter, loyaltyTransactions]);

    const filteredNotifications = useMemo(() => (
        notificationCategoryFilter === 'all'
            ? notifications
            : notifications.filter((item) => (item.category || 'system') === notificationCategoryFilter)
    ), [notificationCategoryFilter, notifications]);

    const securityActivity = useMemo(() => (
        notifications
            .filter((item) => item.category === 'security' || item.category === 'profile')
            .slice(0, 12)
    ), [notifications]);

    const latestConsentEvents = useMemo(() => {
        const latest = new Map<string, CustomerSelfConsentEvent>();
        [...consentEvents]
            .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
            .forEach((event) => {
                if (!latest.has(event.consent_type)) latest.set(event.consent_type, event);
            });
        return Array.from(latest.values());
    }, [consentEvents]);

    const recentConsentEvents = useMemo(() => (
        [...consentEvents]
            .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
            .slice(0, 16)
    ), [consentEvents]);

    useEffect(() => {
        if (profileDirty) return;
        setNickname(customer?.nickname || '');
        setFullName(customer?.full_name || '');
        setEmail(customer?.email || '');
        setCpf(customer?.cpf || '');
        setBirthDate(customer?.birth_date || '');
    }, [customer?.birth_date, customer?.cpf, customer?.email, customer?.full_name, customer?.nickname, profileDirty]);

    useEffect(() => {
        if (!open || tab !== 'privacy' || !customer?.id) return;

        let active = true;
        void CustomerService.getSelfAccountDeletionRequest()
            .then((request) => {
                if (!active) return;
                setDeletionRequestStatus(request?.status || null);
            })
            .catch(() => {
                // O status não deve impedir o restante da área de privacidade.
            });

        return () => {
            active = false;
        };
    }, [customer?.id, open, tab]);

    const clearFeedback = () => {
        setMessage('');
        setError('');
    };

    const loadAddresses = async () => {
        if (!customer) return;
        const data = await CustomerService.getAddresses(customer.id);
        setAddresses(data.map((item) => ({
            id: item.id,
            zip_code: item.zip_code,
            street: item.street,
            number: item.number,
            complement: item.complement,
            district: item.district,
            city: item.city,
            state: item.state,
            is_default: item.is_default,
        })));
    };

    const loadOrders = useCallback(async (options?: { notifyStatusChanges?: boolean; showSpinner?: boolean }) => {
        if (!customer || ordersRequestInFlightRef.current) return;
        const notifyStatusChanges = options?.notifyStatusChanges ?? false;
        const showSpinner = options?.showSpinner ?? false;
        ordersRequestInFlightRef.current = true;
        if (showSpinner) setOrdersRefreshing(true);

        try {
            let data;
            try {
                data = await CustomerService.getOrders();
            } catch (firstError) {
                await new Promise((resolve) => window.setTimeout(resolve, 250));
                try {
                    data = await CustomerService.getOrders();
                } catch {
                    const restored = await AuthService.restoreSession();
                    if (!restored?.customer) throw firstError;
                    data = await CustomerService.getOrders();
                }
            }
            const nextOrders = (data as unknown as Record<string, unknown>[]).map(normalizeOrder);

            if (notifyStatusChanges && ordersRef.current.length > 0) {
                const previousById = new Map(ordersRef.current.map((order) => [order.id, order.status]));
                nextOrders.forEach((order) => {
                    const previousStatus = previousById.get(order.id);
                    if (previousStatus && previousStatus !== order.status) {
                        toast.info(friendlyOrderStatusMessage(order));
                    }
                });
            }

            ordersRef.current = nextOrders;
            setOrders(nextOrders);
            setOrdersUpdatedAt(new Date());
        } catch (loadError) {
            if (showSpinner) toast.error('Não foi possível atualizar seus pedidos agora.');
            throw loadError;
        } finally {
            ordersRequestInFlightRef.current = false;
            if (showSpinner) setOrdersRefreshing(false);
        }
    }, [customer?.id]);

    const loadLoyaltyTransactions = useCallback(async () => {
        if (!customer) return;
        setLoyaltyLoading(true);
        try {
            const data = await CustomerService.getSelfLoyaltyTransactions(100);
            setLoyaltyTransactions((data as Record<string, unknown>[]).map((item) => ({
                id: String(item.id ?? ''),
                type: item.type ? String(item.type) : null,
                points: Number(item.points || 0),
                description: item.description ? String(item.description) : null,
                order_id: item.order_id ? String(item.order_id) : null,
                order_code: item.order_code ? String(item.order_code) : null,
                created_at: item.created_at ? String(item.created_at) : null,
            })));
        } catch (loyaltyError) {
            console.error('[LOYALTY] Falha ao carregar extrato:', loyaltyError);
        } finally {
            setLoyaltyLoading(false);
        }
    }, [customer?.id]);

    const refreshCustomerSnapshot = useCallback(async () => {
        if (!customer) return;
        const profile = await CustomerService.getSelfProfile();
        if (!profile || typeof profile !== 'object') return;

        const next = profile as Record<string, unknown>;
        useCustomerAuth.setState((state) => {
            if (!state.customer || state.customer.id !== customer.id) return state;
            return {
                ...state,
                customer: {
                    ...state.customer,
                    ...next,
                    loyalty_points: Number(next.loyalty_points ?? state.customer.loyalty_points ?? 0),
                    loyalty_opt_in: Boolean(next.loyalty_opt_in ?? state.customer.loyalty_opt_in),
                    marketing_consent: Boolean(next.marketing_consent ?? state.customer.marketing_consent),
                },
            };
        });
    }, [customer?.id]);

    const loadLoyaltyProgram = useCallback(async () => {
        if (!customer) return;
        const result = await CustomerService.getSelfLoyaltyProgram();
        setLoyaltyProgram(result.program as LoyaltyProgramSummary | null);
        setLoyaltyBlocked(result.membershipBlocked);
        setLoyaltyBlockReason(result.blockReason);
    }, [customer?.id]);

    const loadMarketingConsents = useCallback(async () => {
        if (!customer) return;
        const consents = await CustomerService.getSelfConsents();
        setConsentEvents(consents);
        const latest = new Map<string, string>();
        consents.forEach((consent) => {
            if (!latest.has(consent.consent_type)) latest.set(consent.consent_type, consent.action);
        });
        setMarketingWhatsapp(latest.get('marketing_whatsapp') === 'granted');
        setMarketingEmail(latest.get('marketing_email') === 'granted');
        setMarketingSms(latest.get('marketing_sms') === 'granted');
        setLoyaltyWhatsapp(latest.get('loyalty_whatsapp') === 'granted');
        setLoyaltyEmail(latest.get('loyalty_email') === 'granted');
        setLoyaltySms(latest.get('loyalty_sms') === 'granted');
    }, [customer?.id]);

    const loadLoyaltyRewards = useCallback(async () => {
        if (!customer) return;
        setLoyaltyRewardsLoading(true);
        try {
            const result = await CustomerService.getSelfLoyaltyRewards();
            setLoyaltyRewards(result.rewards);
            setLoyaltyVouchers(result.vouchers);
        } finally {
            setLoyaltyRewardsLoading(false);
        }
    }, [customer?.id]);

    const loadNotifications = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
        if (!customer) return;
        if (!silent) setNotificationsLoading(true);
        try {
            const rows = await CustomerService.getNotifications(customer.id);
            setNotifications((rows || []).map((row) => {
                const item = row as Record<string, unknown>;
                return {
                    id: String(item.id ?? ''),
                    title: item.title ? String(item.title) : null,
                    message: item.message ? String(item.message) : null,
                    type: item.type ? String(item.type) : null,
                    category: item.category ? String(item.category) : 'system',
                    read: Boolean(item.read),
                    created_at: item.created_at ? String(item.created_at) : null,
                };
            }).filter((item) => item.id));
        } finally {
            if (!silent) setNotificationsLoading(false);
        }
    }, [customer?.id]);

    const loadTrustedDevices = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
        if (!customer) return;
        if (!silent) setTrustedDevicesLoading(true);
        try {
            const devices = await AuthService.listTrustedDevices();
            setTrustedDevices(devices);
        } finally {
            if (!silent) setTrustedDevicesLoading(false);
        }
    }, [customer?.id]);

    const loadProductRatings = useCallback(async () => {
        if (!customer) return;
        const ratings = await CustomerService.getSelfProductRatings();
        setProductRatings(Object.fromEntries(ratings.map((item) => [item.productId, item.rating])));
    }, [customer?.id]);

    useEffect(() => {
        ordersRef.current = [];
        setOrders([]);
        setOrdersUpdatedAt(null);
    }, [customer?.id]);

    useEffect(() => {
        if (!open || !customer) return;
        let active = true;
        setLoading(true);
        clearFeedback();

        void Promise.all([loadAddresses(), loadOrders()])
            .catch((loadError) => {
                if (!active) return;
                setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar sua conta.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [open, customer?.id, loadOrders]);

    useEffect(() => {
        if (!open || !customer || (tab !== 'orders' && tab !== 'consumption')) return;

        let active = true;
        let channel: ReturnType<typeof supabaseCustomer.channel> | null = null;

        void (async () => {
            const token = await AuthService.getRealtimeAccessToken();
            if (!active || !token) return;

            await supabaseCustomer.realtime.setAuth(token);
            if (!active) return;

            channel = supabaseCustomer
                .channel(`customer-orders-${customer.store_id}-${customer.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'orders',
                        filter: `customer_id=eq.${customer.id}`,
                    },
                    () => {
                        if (!active || document.visibilityState !== 'visible') return;
                        void loadOrders({ notifyStatusChanges: true }).catch(() => undefined);
                    },
                )
                .subscribe();
        })().catch(() => {
            // O polling abaixo permanece como fallback caso o canal não conecte.
        });

        return () => {
            active = false;
            if (channel) void supabaseCustomer.removeChannel(channel);
        };
    }, [open, customer?.id, customer?.store_id, tab, loadOrders]);

    useEffect(() => {
        if (!open || !customer || (tab !== 'orders' && tab !== 'consumption')) return;

        const refreshOrders = () => {
            if (document.visibilityState !== 'visible') return;
            void loadOrders({ notifyStatusChanges: true }).catch(() => undefined);
        };

        refreshOrders();
        const intervalId = window.setInterval(refreshOrders, CUSTOMER_ORDERS_REFRESH_MS);
        document.addEventListener('visibilitychange', refreshOrders);
        window.addEventListener('focus', refreshOrders);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', refreshOrders);
            window.removeEventListener('focus', refreshOrders);
        };
    }, [open, customer?.id, tab, loadOrders]);

    useEffect(() => {
        if (!open || !customer) return;

        const refreshAccount = () => {
            if (document.visibilityState !== 'visible') return;
            void refreshCustomerSnapshot().catch(() => undefined);
        };

        refreshAccount();
        const intervalId = window.setInterval(refreshAccount, CUSTOMER_ORDERS_REFRESH_MS);
        window.addEventListener('focus', refreshAccount);
        document.addEventListener('visibilitychange', refreshAccount);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', refreshAccount);
            document.removeEventListener('visibilitychange', refreshAccount);
        };
    }, [open, customer?.id, refreshCustomerSnapshot]);

    useEffect(() => {
        if (!open || !customer || tab !== 'consumption') return;
        void loadProductRatings().catch(() => undefined);
    }, [open, customer?.id, tab, loadProductRatings]);

    useEffect(() => {
        if (!open || !customer || tab !== 'consumption') return;
        const slug = cartContext?.canonicalSlug || cartContext?.requestedSlug;
        if (!slug) return;

        let active = true;
        void PublicStorefrontService.getCatalogBySlug(slug)
            .then((catalog) => {
                if (!active || !catalog.ok || !catalog.catalog_enabled) return;
                const next = new Map<string, { id: string; imageUrl: string | null }>();
                (catalog.categories || []).forEach((category) => {
                    (category.products || []).forEach((product) => {
                        const imageUrl = Array.isArray(product.images) && product.images.length > 0
                            ? product.images[0] || null
                            : product.image_url || null;
                        next.set(product.id, { id: product.id, imageUrl });
                    });
                });
                setConsumptionCatalog(next);
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [open, customer?.id, tab, cartContext?.canonicalSlug, cartContext?.requestedSlug]);

    const openConsumedProduct = (productId: string | null) => {
        if (!productId) return;
        const slug = cartContext?.canonicalSlug || cartContext?.requestedSlug;
        if (!slug) {
            toast.error('Não foi possível abrir este produto agora.');
            return;
        }

        const basePath = cartContext?.type === 'table' && cartContext.tableCode
            ? `/q/${encodeURIComponent(slug)}/${encodeURIComponent(cartContext.tableCode)}`
            : `/s/${encodeURIComponent(slug)}`;

        setOpen(false);
        navigate(`${basePath}?product=${encodeURIComponent(productId)}&returnTo=consumption`);
    };

    useEffect(() => {
        const reopenAccount = (event: Event) => {
            const detail = (event as CustomEvent<{ tab?: AccountTab }>).detail;
            const targetTab = detail?.tab;
            if (!targetTab) return;
            setTab(targetTab);
            setOpen(true);
        };

        window.addEventListener('optmamenu:open-customer-account', reopenAccount);
        return () => window.removeEventListener('optmamenu:open-customer-account', reopenAccount);
    }, []);

    useEffect(() => {
        if (!open || !customer || tab !== 'loyalty' || !customer.loyalty_opt_in) return;

        let active = true;
        let channel: ReturnType<typeof supabaseCustomer.channel> | null = null;

        void (async () => {
            const token = await AuthService.getRealtimeAccessToken();
            if (!active || !token) return;

            await supabaseCustomer.realtime.setAuth(token);
            if (!active) return;

            channel = supabaseCustomer
                .channel(`customer-loyalty-${customer.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'loyalty_transactions',
                        filter: `customer_id=eq.${customer.id}`,
                    },
                    () => {
                        if (!active || document.visibilityState !== 'visible') return;
                        void Promise.all([
                            loadLoyaltyTransactions(),
                            refreshCustomerSnapshot(),
                        ]).catch(() => undefined);
                    },
                )
                .subscribe();
        })().catch(() => undefined);

        return () => {
            active = false;
            if (channel) void supabaseCustomer.removeChannel(channel);
        };
    }, [
        open,
        customer?.id,
        customer?.loyalty_opt_in,
        tab,
        loadLoyaltyTransactions,
        refreshCustomerSnapshot,
    ]);

    useEffect(() => {
        if (!open || !customer || tab !== 'loyalty') return;
        let active = true;

        void Promise.all([
            refreshCustomerSnapshot(),
            loadLoyaltyTransactions(),
            loadLoyaltyProgram(),
            loadLoyaltyRewards(),
        ]).catch((loyaltyError) => {
            if (active) console.error('[LOYALTY] Falha ao atualizar fidelidade:', loyaltyError);
        });

        return () => {
            active = false;
        };
    }, [
        open,
        customer?.id,
        tab,
        refreshCustomerSnapshot,
        loadLoyaltyTransactions,
        loadLoyaltyProgram,
        loadLoyaltyRewards,
    ]);

    useEffect(() => {
        if (!open || !customer || tab !== 'loyalty-settings') return;

        void Promise.all([
            refreshCustomerSnapshot(),
            loadLoyaltyProgram(),
            loadMarketingConsents(),
        ]).catch((loyaltyError) => {
            console.error('[LOYALTY_SETTINGS] Falha ao atualizar configurações:', loyaltyError);
        });
    }, [
        open,
        customer?.id,
        tab,
        refreshCustomerSnapshot,
        loadLoyaltyProgram,
        loadMarketingConsents,
    ]);

    useEffect(() => {
        if (!open || !customer || tab !== 'communications') return;
        void loadMarketingConsents().catch((communicationError) => {
            console.error('[CUSTOMER_MARKETING] Falha ao atualizar preferências:', communicationError);
        });
    }, [open, customer?.id, tab, loadMarketingConsents]);

    useEffect(() => {
        if (!open || !customer || tab !== 'privacy') return;
        void loadMarketingConsents().catch((privacyError) => {
            console.error('[CUSTOMER_PRIVACY] Falha ao atualizar histórico de consentimentos:', privacyError);
        });
    }, [open, customer?.id, tab, loadMarketingConsents]);

    useEffect(() => {
        if (!open || !customer || tab !== 'messages') return;

        void loadNotifications().catch((notificationError) => {
            console.error('[CUSTOMER_MESSAGES] Falha ao atualizar mensagens:', notificationError);
        });

        const intervalId = window.setInterval(() => {
            void loadNotifications({ silent: true }).catch(() => undefined);
        }, CUSTOMER_ORDERS_REFRESH_MS);

        return () => window.clearInterval(intervalId);
    }, [open, customer?.id, tab, loadNotifications]);

    useEffect(() => {
        if (!open || !customer || tab !== 'security') return;

        const refreshTrustedDevices = () => {
            if (document.visibilityState !== 'visible') return;
            void loadTrustedDevices({ silent: true }).catch(() => undefined);
        };

        void Promise.all([
            loadTrustedDevices(),
            loadNotifications({ silent: true }),
        ]).catch(() => undefined);
        const intervalId = window.setInterval(refreshTrustedDevices, CUSTOMER_SECURITY_REFRESH_MS);
        window.addEventListener('focus', refreshTrustedDevices);
        document.addEventListener('visibilitychange', refreshTrustedDevices);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', refreshTrustedDevices);
            document.removeEventListener('visibilitychange', refreshTrustedDevices);
        };
    }, [open, customer?.id, tab, loadNotifications, loadTrustedDevices]);

    if (!customer) return null;

    const logout = async () => {
        setLoading(true);
        try {
            await flushCustomerCartServerSync().catch(() => undefined);
            await AuthService.logoutCustomer();
            setOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const downloadSelfData = async () => {
        clearFeedback();
        setExportingData(true);
        try {
            const exported = await CustomerService.exportSelfData();
            const blob = new Blob(
                [JSON.stringify(exported, null, 2)],
                { type: 'application/json;charset=utf-8' },
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const exportSlug = cartContext?.canonicalSlug || cartContext?.requestedSlug || 'loja';
            link.download = `meus-dados-${exportSlug}-${new Date().toISOString().slice(0, 10)}.json`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
            const feedback = 'Seus dados foram exportados em um arquivo JSON.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (exportError) {
            const feedback = exportError instanceof Error
                ? exportError.message
                : 'Não foi possível exportar seus dados agora.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setExportingData(false);
        }
    };

    const openProtectedProfileCorrection = () => {
        setProtectedProfileOpen((current) => {
            const next = !current;
            if (next) {
                setProtectedCpf(onlyDigits(customer.cpf || ''));
                setProtectedBirthDate(customer.birth_date || '');
                setProtectedProfileOtp('');
                setProtectedProfileOtpSent(false);
                clearFeedback();
            }
            return next;
        });
    };

    const requestProtectedProfileOtp = async () => {
        clearFeedback();
        setProtectedProfileSubmitting(true);
        try {
            await AuthService.sendOtp(customer.phone, customer.store_id, 'profile_change');
            setProtectedProfileOtpSent(true);
            const feedback = 'Enviamos um código por SMS ao seu telefone confirmado. Ele expira em 5 minutos.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (otpError) {
            const feedback = otpError instanceof Error
                ? otpError.message
                : 'Não foi possível enviar o código de confirmação agora.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setProtectedProfileSubmitting(false);
        }
    };

    const confirmProtectedProfileCorrection = async () => {
        clearFeedback();
        if (onlyDigits(protectedProfileOtp).length !== 6) {
            setError('Informe o código de 6 dígitos recebido por SMS.');
            return;
        }

        const currentCpf = onlyDigits(customer.cpf || '');
        const nextCpf = onlyDigits(protectedCpf);
        const currentBirth = customer.birth_date || '';
        const cpfChanged = Boolean(nextCpf) && nextCpf !== currentCpf;
        const birthChanged = Boolean(protectedBirthDate) && protectedBirthDate !== currentBirth;

        if (!cpfChanged && !birthChanged) {
            setError('Altere o CPF ou a data de nascimento antes de confirmar.');
            return;
        }

        setProtectedProfileSubmitting(true);
        try {
            const result = await CustomerService.changeSelfSensitiveProfile({
                otp: onlyDigits(protectedProfileOtp),
                cpf: cpfChanged ? nextCpf : null,
                birthDate: birthChanged ? protectedBirthDate : null,
            });

            await refreshCustomerSnapshot();
            setCpf(result.cpf || nextCpf || currentCpf);
            setBirthDate(result.birthDate || protectedBirthDate || currentBirth);
            setProfileDirty(false);
            setProtectedProfileOpen(false);
            setProtectedProfileOtp('');
            setProtectedProfileOtpSent(false);
            const feedback = 'Dados protegidos atualizados com confirmação por SMS.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (profileError) {
            const feedback = profileError instanceof Error
                ? profileError.message
                : 'Não foi possível corrigir seus dados protegidos.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setProtectedProfileSubmitting(false);
        }
    };

    const requestPhoneChangeOtp = async () => {
        clearFeedback();
        if (!newPhone.trim()) {
            setError('Informe o novo telefone.');
            return;
        }

        setPhoneChangeSubmitting(true);
        try {
            await AuthService.sendOtp(newPhone.trim(), customer.store_id, 'phone_change');
            setPhoneChangeOtpSent(true);
            const feedback = 'Enviamos um código por SMS para o novo telefone. Ele expira em 5 minutos.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (otpError) {
            const feedback = otpError instanceof Error
                ? otpError.message
                : 'Não foi possível enviar o código para o novo telefone.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setPhoneChangeSubmitting(false);
        }
    };

    const confirmPhoneChange = async () => {
        clearFeedback();
        if (!newPhone.trim()) {
            setError('Informe o novo telefone.');
            return;
        }
        if (onlyDigits(phoneChangeOtp).length !== 6) {
            setError('Informe o código de 6 dígitos recebido no novo telefone.');
            return;
        }

        setPhoneChangeSubmitting(true);
        try {
            const result = await CustomerService.changeSelfPhone(
                newPhone.trim(),
                onlyDigits(phoneChangeOtp),
            );

            if (result.unchanged) {
                setPhoneChangeOpen(false);
                setNewPhone('');
                setPhoneChangeOtp('');
                setPhoneChangeOtpSent(false);
                const feedback = 'Este telefone já é o telefone confirmado da sua conta.';
                setMessage(feedback);
                toast.success(feedback);
                return;
            }

            await flushCustomerCartServerSync().catch(() => undefined);
            const feedback = 'Telefone alterado e confirmado. Por segurança, entre novamente usando o novo número.';
            toast.success(feedback);
            await AuthService.logoutCustomer();
            setOpen(false);
        } catch (phoneError) {
            const feedback = phoneError instanceof Error
                ? phoneError.message
                : 'Não foi possível alterar o telefone agora.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setPhoneChangeSubmitting(false);
        }
    };

    const requestDeletionOtp = async () => {
        clearFeedback();
        setDeletionSubmitting(true);
        try {
            await AuthService.sendOtp(customer.phone, customer.store_id, 'account_delete');
            setDeletionOtpSent(true);
            const feedback = 'Enviamos um código por SMS para confirmar esta solicitação sensível.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (otpError) {
            const feedback = otpError instanceof Error
                ? otpError.message
                : 'Não foi possível enviar o código de confirmação agora.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setDeletionSubmitting(false);
        }
    };

    const submitDeletionRequest = async () => {
        clearFeedback();
        if (!deletionPassword) {
            setError('Informe sua senha atual.');
            return;
        }
        if (onlyDigits(deletionOtp).length !== 6) {
            setError('Informe o código de 6 dígitos recebido por SMS.');
            return;
        }

        setDeletionSubmitting(true);
        try {
            const request = await CustomerService.requestSelfAccountDeletion(
                deletionPassword,
                onlyDigits(deletionOtp),
            );
            setDeletionRequestStatus(request.status || 'pending');

            const processed = await CustomerService.processSelfAccountDeletion();
            setDeletionRequestStatus(processed.status || 'executed');
            setDeletionPassword('');
            setDeletionOtp('');
            setDeletionOtpSent(false);

            const feedback = 'Sua conta foi excluída. Registros que precisem permanecer por obrigação legal foram desvinculados da sua identidade.';
            toast.success(feedback);
            setMessage(feedback);

            await AuthService.logoutCustomer();
            setOpen(false);
        } catch (deletionError) {
            const feedback = deletionError instanceof Error
                ? deletionError.message
                : 'Não foi possível concluir a exclusão da conta.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setDeletionSubmitting(false);
        }
    };

    const saveProfile = async () => {
        clearFeedback();
        if (!fullName.trim()) {
            setError('Informe seu nome.');
            return;
        }
        setLoading(true);
        try {
            await CustomerService.updateProfile(customer.id, {
                nickname: nickname.trim() || undefined,
                full_name: fullName.trim(),
                email: email.trim() || undefined,
                cpf: cpf.trim() || undefined,
                birth_date: birthDate || undefined,
            });
            await AuthService.restoreSession();
            setProfileDirty(false);
            setMessage('Dados atualizados com sucesso.');
        } catch (profileError) {
            setError(profileError instanceof Error ? profileError.message : 'Não foi possível atualizar seus dados.');
        } finally {
            setLoading(false);
        }
    };

    const requestEmailVerification = async () => {
        clearFeedback();
        if (profileDirty || email.trim().toLowerCase() !== String(customer.email || '').trim().toLowerCase()) {
            setError('Salve seus dados antes de solicitar a confirmação deste e-mail.');
            return;
        }
        if (!email.trim()) {
            setError('Cadastre um e-mail válido antes de solicitar a confirmação.');
            return;
        }

        setEmailVerificationSending(true);
        try {
            const result = await CustomerService.requestSelfEmailVerification();
            if (result.alreadyVerified) {
                await refreshCustomerSnapshot();
                setMessage('Este e-mail já está confirmado.');
                return;
            }

            const feedback = `A loja enviou um link de confirmação para ${result.email || email}. O link expira em 30 minutos.`;
            setMessage(feedback);
            toast.success(feedback);
        } catch (verificationError) {
            const feedback = verificationError instanceof Error
                ? verificationError.message
                : 'Não foi possível enviar a confirmação de e-mail agora.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setEmailVerificationSending(false);
        }
    };

    const resetAddressForm = () => {
        setAddressForm(EMPTY_ADDRESS);
        setEditingAddressId(null);
        setShowAddressForm(false);
        setCepLoading(false);
    };

    const lookupAddressCep = async () => {
        const cep = onlyDigits(addressForm.zip_code);
        if (cep.length !== 8) {
            setError('Informe um CEP válido com 8 dígitos.');
            return;
        }

        setCepLoading(true);
        setError('');
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (!response.ok) throw new Error('cep_lookup_failed');
            const data = await response.json() as {
                erro?: boolean;
                logradouro?: string;
                bairro?: string;
                localidade?: string;
                uf?: string;
            };
            if (data.erro) {
                setError('CEP não encontrado. Confira o número ou preencha o endereço manualmente.');
                return;
            }
            setAddressForm((current) => ({
                ...current,
                zip_code: formatCep(cep),
                street: data.logradouro || current.street,
                district: data.bairro || current.district,
                city: data.localidade || current.city,
                state: (data.uf || current.state).toUpperCase(),
            }));
        } catch {
            setError('Não foi possível consultar o CEP agora. Você ainda pode preencher o endereço manualmente.');
        } finally {
            setCepLoading(false);
        }
    };

    const saveAddress = async () => {
        clearFeedback();
        setLoading(true);
        try {
            if (editingAddressId) {
                await CustomerService.updateAddress(editingAddressId, addressForm);
            } else {
                await CustomerService.addAddress({ ...addressForm, customer_id: customer.id });
            }
            await loadAddresses();
            const wasEditing = Boolean(editingAddressId);
            resetAddressForm();
            setMessage(wasEditing ? 'Endereço atualizado.' : 'Endereço adicionado.');
        } catch (addressError) {
            setError(addressError instanceof Error ? addressError.message : 'Não foi possível salvar o endereço.');
        } finally {
            setLoading(false);
        }
    };

    const editAddress = (address: CustomerAddress) => {
        clearFeedback();
        setAddressForm({ ...address, zip_code: formatCep(address.zip_code) });
        setEditingAddressId(address.id || null);
        setShowAddressForm(true);
    };

    const deleteAddress = async (id?: string) => {
        if (!id) return;
        clearFeedback();
        setLoading(true);
        try {
            await CustomerService.deleteAddress(id);
            await loadAddresses();
            setMessage('Endereço excluído.');
        } catch (addressError) {
            setError(addressError instanceof Error ? addressError.message : 'Não foi possível excluir o endereço.');
        } finally {
            setLoading(false);
        }
    };

    const makeDefault = async (address: CustomerAddress) => {
        if (!address.id) return;
        clearFeedback();
        setLoading(true);
        try {
            await CustomerService.updateAddress(address.id, { is_default: true });
            await loadAddresses();
            setMessage('Endereço padrão atualizado.');
        } catch (addressError) {
            setError(addressError instanceof Error ? addressError.message : 'Não foi possível atualizar o endereço padrão.');
        } finally {
            setLoading(false);
        }
    };

    const joinLoyaltyProgram = async () => {
        clearFeedback();
        if (loyaltyBlocked) {
            const feedback = loyaltyBlockReason
                ? `Sua participação está bloqueada pela loja: ${loyaltyBlockReason}`
                : 'Sua participação neste programa está bloqueada. Fale com a loja para mais informações.';
            setError(feedback);
            toast.error(feedback);
            return;
        }
        if (loyaltyMissingFields.length > 0) {
            setError(`Complete os requisitos antes de participar: ${loyaltyMissingFields.join(', ')}.`);
            return;
        }
        if (!loyaltyTermsAccepted) {
            setError('Leia e aceite o regulamento do programa de fidelidade para continuar.');
            return;
        }
        if (!loyaltyDataResponsibilityAccepted) {
            setError('Confirme que você é responsável pela veracidade das informações fornecidas.');
            return;
        }

        setLoyaltySaving(true);
        try {
            const session = await AuthService.restoreSession();
            if (!session?.customer) throw new Error('Sua sessão expirou. Entre novamente.');
            if (!session.customer.email_verified) {
                throw new Error('Confirme seu e-mail com a loja antes de participar do programa.');
            }

            const result = await CustomerService.joinSelfLoyalty({
                acceptTerms: true,
                dataResponsibility: true,
                loyaltyWhatsapp,
                loyaltyEmail,
                loyaltySms,
            });

            await Promise.all([
                refreshCustomerSnapshot(),
                loadLoyaltyTransactions(),
                loadLoyaltyProgram(),
                loadMarketingConsents(),
            ]);

            setLoyaltyJoinOpen(false);
            setLoyaltyTermsAccepted(false);
            setLoyaltyDataResponsibilityAccepted(false);

            const feedback = result?.already_member
                ? 'Sua participação já estava ativa. Preferências e dados do programa foram atualizados.'
                : 'Adesão confirmada! Seu cadastro atende aos requisitos e suas preferências foram registradas.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (loyaltyError) {
            const feedback = loyaltyError instanceof Error ? loyaltyError.message : 'Não foi possível concluir sua adesão ao programa.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setLoyaltySaving(false);
        }
    };

    const saveCommunicationPreferences = async () => {
        clearFeedback();
        setMarketingPreferencesSaving(true);
        try {
            await Promise.all([
                CustomerService.setSelfConsent('marketing_whatsapp', marketingWhatsapp, { source: 'customer_marketing_preferences' }),
                CustomerService.setSelfConsent('marketing_email', marketingEmail, { source: 'customer_marketing_preferences' }),
                CustomerService.setSelfConsent('marketing_sms', marketingSms, { source: 'customer_marketing_preferences' }),
            ]);
            await loadMarketingConsents();
            const feedback = 'Preferências de marketing atualizadas.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (preferencesError) {
            const feedback = preferencesError instanceof Error ? preferencesError.message : 'Não foi possível salvar suas preferências de marketing.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setMarketingPreferencesSaving(false);
        }
    };

    const saveLoyaltyCommunicationPreferences = async () => {
        clearFeedback();
        setLoyaltyPreferencesSaving(true);
        try {
            await Promise.all([
                CustomerService.setSelfConsent('loyalty_whatsapp', loyaltyWhatsapp, { source: 'customer_loyalty_preferences' }),
                CustomerService.setSelfConsent('loyalty_email', loyaltyEmail, { source: 'customer_loyalty_preferences' }),
                CustomerService.setSelfConsent('loyalty_sms', loyaltySms, { source: 'customer_loyalty_preferences' }),
                CustomerService.setSelfConsent('loyalty_webapp', loyaltyWebApp, { source: 'customer_loyalty_preferences' }),
            ]);
            await loadMarketingConsents();
            const feedback = 'Preferências de comunicação da fidelidade atualizadas.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (preferencesError) {
            const feedback = preferencesError instanceof Error ? preferencesError.message : 'Não foi possível salvar as comunicações da fidelidade.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setLoyaltyPreferencesSaving(false);
        }
    };

    const markNotificationRead = async (notificationId: string) => {
        await CustomerService.markAsRead(notificationId);
        setNotifications((current) => current.map((notification) =>
            notification.id === notificationId ? { ...notification, read: true } : notification
        ));
    };

    const markAllNotificationsRead = async () => {
        await CustomerService.markAllAsRead(customer?.id);
        setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    };

    const leaveLoyaltyProgram = async () => {
        clearFeedback();
        setLoyaltySaving(true);
        try {
            await CustomerService.leaveSelfLoyalty();
            setLoyaltyTransactions([]);
            await Promise.all([
                refreshCustomerSnapshot(),
                loadLoyaltyProgram(),
                loadLoyaltyRewards(),
            ]);
            setShowLoyaltyExitConfirm(false);
            const feedback = 'Sua participação foi encerrada. Saldo, extrato, vouchers e dados operacionais do programa foram removidos e não podem ser restaurados.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (loyaltyError) {
            const feedback = loyaltyError instanceof Error ? loyaltyError.message : 'Não foi possível encerrar sua participação.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setLoyaltySaving(false);
        }
    };

    const reorderOrder = async (order: CustomerOrderSummary) => {
        clearFeedback();
        setReorderLoadingOrderId(order.id);
        try {
            const slug = cartContext?.canonicalSlug || cartContext?.requestedSlug;
            if (!slug) throw new Error('Não foi possível identificar a loja atual para refazer o pedido.');

            const catalog = await PublicStorefrontService.getCatalogBySlug(slug);
            if (!catalog.ok || !catalog.catalog_enabled) {
                throw new Error('O catálogo da loja não está disponível neste momento.');
            }

            const currentProducts = new Map(
                (catalog.categories || [])
                    .flatMap((category) => category.products || [])
                    .map((product) => [product.id, product] as const),
            );

            let addedUnits = 0;
            const unavailable: string[] = [];

            for (const item of order.order_items) {
                const productId = item.product_id || item.product?.id || '';
                const currentProduct = productId ? currentProducts.get(productId) : undefined;
                if (!currentProduct) {
                    unavailable.push(item.product?.name || 'Produto indisponível');
                    continue;
                }

                const before = useCartStore.getState().items.find((cartItem) => cartItem.id === currentProduct.id)?.quantity || 0;
                addToCart(currentProduct, Math.max(1, item.quantity));
                const after = useCartStore.getState().items.find((cartItem) => cartItem.id === currentProduct.id)?.quantity || 0;
                const delta = Math.max(0, after - before);

                if (delta > 0) addedUnits += delta;
                else unavailable.push(currentProduct.name);
            }

            if (addedUnits <= 0) {
                throw new Error('Nenhum item deste pedido está disponível para recompra agora.');
            }

            openCart();
            const feedback = unavailable.length > 0
                ? `Adicionamos ${addedUnits} item(ns) ao carrinho. Alguns itens não estão disponíveis agora: ${unavailable.join(', ')}.`
                : `Pedido preparado no carrinho com ${addedUnits} item(ns), usando preços e estoque atuais.`;
            setMessage(feedback);
            toast.success(feedback);
        } catch (reorderError) {
            const feedback = reorderError instanceof Error ? reorderError.message : 'Não foi possível preparar a recompra.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setReorderLoadingOrderId(null);
        }
    };

    const cancelCustomerOrder = async (order: CustomerOrderSummary) => {
        const confirmed = await systemConfirm({
            title: 'Cancelar este pedido?',
            description: 'A reserva dos itens será liberada. Esta ação vale apenas para pedidos ainda não pagos e que não avançaram no atendimento.',
            confirmLabel: 'Cancelar pedido',
            cancelLabel: 'Manter pedido',
            tone: 'danger',
        });
        if (!confirmed) return;

        clearFeedback();
        setCancellingOrderId(order.id);
        try {
            await CustomerService.cancelSelfOrder(order.id);
            await loadOrders({ notifyStatusChanges: false });
            if (expandedOrderId === order.id) setExpandedOrderId(null);
            const feedback = `${order.order_code || 'Pedido'} cancelado. A reserva dos itens foi liberada.`;
            setMessage(feedback);
            toast.success(feedback);
        } catch (cancelError) {
            const feedback = cancelError instanceof Error
                ? cancelError.message
                : 'Não foi possível cancelar este pedido.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setCancellingOrderId(null);
        }
    };

    const savePassword = async () => {
        clearFeedback();
        if (!currentPassword) {
            setError('Informe sua senha atual.');
            return;
        }
        if (newPassword.length < 8 || newPassword.length > 72 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            setError('A senha deve ter de 8 a 72 caracteres, com pelo menos uma letra e um número.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        try {
            const result = await AuthService.setPassword(newPassword, currentPassword);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            await loadTrustedDevices({ silent: true }).catch(() => undefined);
            const feedback = result.revokedCount > 0
                ? `Senha alterada com segurança. ${result.revokedCount} outro(s) dispositivo(s) foram desconectados.`
                : 'Senha alterada com segurança. Sua sessão atual foi renovada.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (passwordError) {
            const feedback = passwordError instanceof Error ? passwordError.message : 'Não foi possível atualizar a senha.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setLoading(false);
        }
    };

    const startRenameTrustedDevice = (device: TrustedCustomerDevice) => {
        setEditingTrustedDeviceId(device.id);
        setEditingTrustedDeviceLabel(device.label || 'Dispositivo confiável');
        setRevokingTrustedDeviceId(null);
        setTargetDevicePassword('');
        clearFeedback();
    };

    const saveTrustedDeviceLabel = async (deviceId: string, nextLabel = editingTrustedDeviceLabel) => {
        clearFeedback();
        const label = nextLabel.trim();
        if (label.length > 40) {
            setError('Use um apelido de até 40 caracteres.');
            return;
        }

        setTrustedDevicesLoading(true);
        try {
            const savedLabel = await AuthService.renameTrustedDevice(deviceId, label);
            setTrustedDevices((devices) => devices.map((device) => (
                device.id === deviceId ? { ...device, label: savedLabel } : device
            )));
            setEditingTrustedDeviceId(null);
            setEditingTrustedDeviceLabel('');
            toast.success(label ? 'Apelido do dispositivo atualizado.' : 'Nome automático do dispositivo restaurado.');
        } catch (deviceError) {
            const feedback = deviceError instanceof Error
                ? deviceError.message
                : 'Não foi possível renomear o dispositivo.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setTrustedDevicesLoading(false);
        }
    };

    const rateConsumedProduct = async (productId: string, rating: number) => {
        setRatingSavingProductId(productId);
        try {
            const savedRating = await CustomerService.rateSelfProduct(productId, rating);
            setProductRatings((current) => ({ ...current, [productId]: savedRating }));
            toast.success('Sua avaliação foi salva.');
        } catch (ratingError) {
            toast.error(ratingError instanceof Error ? ratingError.message : 'Não foi possível salvar sua avaliação.');
        } finally {
            setRatingSavingProductId(null);
        }
    };

    const revokeTrustedDevice = async (device: TrustedCustomerDevice) => {
        clearFeedback();
        if (device.is_current) {
            await logout();
            return;
        }
        if (!targetDevicePassword) {
            setError('Informe sua senha atual para desconectar este dispositivo.');
            return;
        }

        setTrustedDevicesRevoking(true);
        try {
            const result = await AuthService.revokeTrustedDevice(device.id, targetDevicePassword);
            setTrustedDevices(result.devices);
            setRevokingTrustedDeviceId(null);
            setTargetDevicePassword('');
            const feedback = `${result.label} foi desconectado da sua conta.`;
            setMessage(feedback);
            toast.success(feedback);
        } catch (deviceError) {
            const feedback = deviceError instanceof Error
                ? deviceError.message
                : 'Não foi possível desconectar o dispositivo.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setTrustedDevicesRevoking(false);
        }
    };

    const revokeAllOtherTrustedDevices = async () => {
        clearFeedback();
        if (!revokeAllDevicesPassword) {
            setError('Informe sua senha atual para desconectar os outros dispositivos.');
            return;
        }

        setTrustedDevicesRevoking(true);
        try {
            const result = await AuthService.revokeOtherTrustedDevices(revokeAllDevicesPassword);
            setTrustedDevices(result.devices);
            setRevokeAllDevicesOpen(false);
            setRevokeAllDevicesPassword('');
            const feedback = result.revokedCount > 0
                ? `${result.revokedCount} outro(s) dispositivo(s) foram desconectados.`
                : 'Não havia outros dispositivos ativos para desconectar.';
            setMessage(feedback);
            toast.success(feedback);
        } catch (deviceError) {
            const feedback = deviceError instanceof Error
                ? deviceError.message
                : 'Não foi possível desconectar os outros dispositivos.';
            setError(feedback);
            toast.error(feedback);
        } finally {
            setTrustedDevicesRevoking(false);
        }
    };

    const tabs: Array<{ id: AccountTab; label: string; icon: typeof UserRound }> = [
        { id: 'profile', label: 'Meus dados', icon: UserRound },
        { id: 'loyalty-settings', label: 'Fidelidade', icon: Gift },
        { id: 'addresses', label: 'Endereços', icon: MapPin },
        { id: 'orders', label: 'Pedidos', icon: PackageCheck },
        { id: 'consumption', label: 'Meu consumo', icon: History },
        { id: 'communications', label: 'Marketing', icon: MessageCircle },
        { id: 'privacy', label: 'Privacidade', icon: FileText },
        { id: 'security', label: 'Segurança', icon: KeyRound },
    ];

    return (
        <>
            {!hideTrigger && (
            <div className="fixed bottom-28 left-4 z-[65] sm:bottom-5">
                <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-white p-1 pl-2 shadow-xl dark:border-emerald-900 dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="flex min-h-9 items-center gap-2 rounded-full px-2 text-left"
                        aria-label="Abrir minha conta"
                        title="Abrir minha conta"
                    >
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span className="max-w-36 truncate text-xs font-black text-slate-800 dark:text-white">Olá, {displayName}</span>
                    </button>
                    <button
                        type="button"
                        onClick={logout}
                        disabled={loading}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/40 dark:text-red-300"
                        aria-label="Sair da conta"
                        title="Sair da conta"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    </button>
                </div>
            </div>
            )}

            {open && (
                <div className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
                    <div
                        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[90vh] sm:max-w-4xl sm:rounded-3xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="customer-account-title"
                    >
                        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                                        {tab === 'loyalty' ? storeDisplayName : tab === 'messages' ? 'Central da loja' : 'Minha conta'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => void logout()}
                                        disabled={loading}
                                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-200 px-2.5 text-[11px] font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/20"
                                        aria-label="Sair da conta"
                                        title="Sair"
                                    >
                                        <LogOut className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">Sair</span>
                                    </button>
                                </div>
                                <h2 id="customer-account-title" className="mt-1 truncate text-xl font-black text-slate-900 dark:text-white">
                                    {tab === 'loyalty'
                                        ? 'Minha fidelidade'
                                        : tab === 'messages'
                                            ? 'Mensagens'
                                            : tab === 'loyalty-settings'
                                                ? 'Configurar fidelidade'
                                                : tab === 'privacy'
                                                    ? 'Privacidade e dados'
                                                    : displayName}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {tab === 'loyalty'
                                        ? `Pontos, extrato e benefícios da ${storeDisplayName}`
                                        : tab === 'messages'
                                            ? 'Pedidos, fidelidade, perfil e sistema'
                                            : tab === 'loyalty-settings'
                                                ? 'Adesão e comunicações do programa'
                                                : tab === 'privacy'
                                                    ? 'Consentimentos, cópia e exclusão dos dados'
                                                    : customer.phone}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                aria-label="Fechar minha conta"
                                autoFocus
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </header>

                        {tab !== 'loyalty' && tab !== 'messages' && (
                            <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 px-3 py-3 dark:border-slate-800 sm:px-6">
                                {tabs.map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => { setTab(id); clearFeedback(); }}
                                        className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition ${tab === id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                                    >
                                        <Icon className="h-4 w-4" /> {label}
                                    </button>
                                ))}
                            </nav>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
                            {loading && (
                                <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-100 p-3 text-sm font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Atualizando sua conta...
                                </div>
                            )}
                            {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
                            {message && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div>}

                            {tab === 'profile' && (
                                <div className="mx-auto max-w-xl space-y-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Apelido / identificação</label>
                                        <input value={nickname} onChange={(event) => { setNickname(event.target.value); setProfileDirty(true); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                        <p className="mt-1 text-xs text-slate-500">É o nome usado para identificar sua conta na loja. Pode ser diferente do nome completo.</p>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Nome completo</label>
                                        <input value={fullName} onChange={(event) => { setFullName(event.target.value); setProfileDirty(true); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">E-mail</label>
                                        <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setProfileDirty(true); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="voce@exemplo.com" />
                                        <p className={`mt-1 text-xs ${customer.email_verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {customer.email_verified
                                                ? 'E-mail verificado.'
                                                : 'E-mail ainda não verificado. Alterar o endereço de e-mail remove qualquer verificação anterior.'}
                                        </p>
                                        {!customer.email_verified && customer.email && (
                                            <button
                                                type="button"
                                                onClick={() => void requestEmailVerification()}
                                                disabled={emailVerificationSending || profileDirty}
                                                className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
                                            >
                                                <Mail className="h-4 w-4" />
                                                {emailVerificationSending ? 'Enviando confirmação…' : 'Confirmar meu e-mail com a loja'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">CPF</label>
                                            <input
                                                inputMode="numeric"
                                                value={cpf}
                                                onChange={(event) => { setCpf(onlyDigits(event.target.value).slice(0, 11)); setProfileDirty(true); }}
                                                disabled={Boolean(customer.cpf)}
                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                placeholder="Somente números"
                                            />
                                            {customer.cpf && <p className="mt-1 text-xs text-slate-500">Após o primeiro preenchimento, a alteração exige fluxo seguro específico.</p>}
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Data de nascimento</label>
                                            <input
                                                type="date"
                                                value={birthDate}
                                                onChange={(event) => { setBirthDate(event.target.value); setProfileDirty(true); }}
                                                disabled={Boolean(customer.birth_date)}
                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                            />
                                            {customer.birth_date && <p className="mt-1 text-xs text-slate-500">Após o primeiro preenchimento, a alteração exige fluxo seguro específico.</p>}
                                        </div>
                                    </div>
                                    {(customer.cpf || customer.birth_date) && (
                                        <section className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="text-sm font-black text-slate-900 dark:text-white">CPF e data de nascimento protegidos</h3>
                                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                        Depois do primeiro preenchimento, uma correção exige esta sessão confiável e um código SMS enviado ao celular confirmado.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={openProtectedProfileCorrection}
                                                    disabled={protectedProfileSubmitting}
                                                    className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                                    aria-expanded={protectedProfileOpen}
                                                >
                                                    {protectedProfileOpen ? 'Fechar' : 'Corrigir'}
                                                </button>
                                            </div>

                                            {protectedProfileOpen && (
                                                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                                                            CPF corrigido
                                                            <input
                                                                inputMode="numeric"
                                                                value={protectedCpf}
                                                                onChange={(event) => {
                                                                    setProtectedCpf(onlyDigits(event.target.value).slice(0, 11));
                                                                    if (protectedProfileOtpSent) {
                                                                        setProtectedProfileOtpSent(false);
                                                                        setProtectedProfileOtp('');
                                                                    }
                                                                }}
                                                                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                                placeholder="Somente números"
                                                            />
                                                        </label>
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                                                            Data de nascimento corrigida
                                                            <input
                                                                type="date"
                                                                value={protectedBirthDate}
                                                                onChange={(event) => {
                                                                    setProtectedBirthDate(event.target.value);
                                                                    if (protectedProfileOtpSent) {
                                                                        setProtectedProfileOtpSent(false);
                                                                        setProtectedProfileOtp('');
                                                                    }
                                                                }}
                                                                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                            />
                                                        </label>
                                                    </div>

                                                    <p className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                        O código é enviado somente ao celular já confirmado da conta. Alterar os valores depois do envio invalida esta etapa e exige um novo código.
                                                    </p>

                                                    <button
                                                        type="button"
                                                        onClick={() => void requestProtectedProfileOtp()}
                                                        disabled={protectedProfileSubmitting}
                                                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                                    >
                                                        {protectedProfileSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                                        {protectedProfileOtpSent ? 'Reenviar código SMS' : 'Enviar código SMS'}
                                                    </button>

                                                    {protectedProfileOtpSent && (
                                                        <>
                                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                                                                Código SMS
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    autoComplete="one-time-code"
                                                                    value={protectedProfileOtp}
                                                                    onChange={(event) => setProtectedProfileOtp(onlyDigits(event.target.value).slice(0, 6))}
                                                                    maxLength={6}
                                                                    placeholder="000000"
                                                                    className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-center text-base tracking-[0.3em] text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                                />
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => void confirmProtectedProfileCorrection()}
                                                                disabled={protectedProfileSubmitting || onlyDigits(protectedProfileOtp).length !== 6}
                                                                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                                            >
                                                                {protectedProfileSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                                                Confirmar correção
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </section>
                                    )}

                                    <div className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Celular confirmado</label>
                                                <div className="font-semibold text-slate-700 dark:text-slate-200">{customer.phone}</div>
                                                <p className="mt-1 text-xs leading-5 text-slate-500">A troca exige confirmação por SMS no novo número. Depois da alteração, os dispositivos confiáveis são revogados e você entra novamente.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPhoneChangeOpen((current) => !current);
                                                    setNewPhone('');
                                                    setPhoneChangeOtp('');
                                                    setPhoneChangeOtpSent(false);
                                                    clearFeedback();
                                                }}
                                                disabled={phoneChangeSubmitting}
                                                className="shrink-0 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                                                aria-expanded={phoneChangeOpen}
                                            >
                                                {phoneChangeOpen ? 'Cancelar' : 'Alterar telefone'}
                                            </button>
                                        </div>

                                        {phoneChangeOpen && (
                                            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                                                    Novo telefone
                                                    <input
                                                        type="tel"
                                                        inputMode="tel"
                                                        autoComplete="tel"
                                                        value={newPhone}
                                                        onChange={(event) => {
                                                            setNewPhone(event.target.value);
                                                            if (phoneChangeOtpSent) {
                                                                setPhoneChangeOtpSent(false);
                                                                setPhoneChangeOtp('');
                                                            }
                                                        }}
                                                        placeholder="DDD + número; +55 é opcional"
                                                        className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                    />
                                                </label>

                                                <button
                                                    type="button"
                                                    onClick={() => void requestPhoneChangeOtp()}
                                                    disabled={phoneChangeSubmitting || !newPhone.trim()}
                                                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                                >
                                                    {phoneChangeSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                                                    {phoneChangeOtpSent ? 'Reenviar código SMS' : 'Enviar código ao novo telefone'}
                                                </button>

                                                {phoneChangeOtpSent && (
                                                    <>
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                                                            Código SMS
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                autoComplete="one-time-code"
                                                                value={phoneChangeOtp}
                                                                onChange={(event) => setPhoneChangeOtp(onlyDigits(event.target.value).slice(0, 6))}
                                                                maxLength={6}
                                                                placeholder="000000"
                                                                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-center text-base tracking-[0.3em] text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                            />
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => void confirmPhoneChange()}
                                                            disabled={phoneChangeSubmitting || onlyDigits(phoneChangeOtp).length !== 6}
                                                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                                        >
                                                            {phoneChangeSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
                                                            Confirmar novo telefone
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button type="button" onClick={saveProfile} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                                        <Save className="h-4 w-4" /> Salvar dados
                                    </button>
                                </div>
                            )}

                            {tab === 'loyalty-settings' && (
                                <div className="mx-auto max-w-2xl space-y-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTab('loyalty');
                                            clearFeedback();
                                        }}
                                        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-left transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                                    >
                                        <span>
                                            <span className="block text-sm font-black text-emerald-800 dark:text-emerald-200">Ir para Minha fidelidade</span>
                                            <span className="mt-1 block text-xs font-semibold text-emerald-700/70 dark:text-emerald-300/70">Saldo, benefícios, vouchers e extrato de pontos</span>
                                        </span>
                                        <Gift className="h-5 w-5 shrink-0 text-emerald-600" />
                                    </button>

                                    <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/40 dark:bg-amber-950/10">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Gift className="h-6 w-6 text-amber-600" />
                                                    <h3 className="font-black text-slate-900 dark:text-white">Adesão ao programa</h3>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Esta aba cuida da participação e das comunicações da fidelidade. Seus dados pessoais continuam em Meus dados.
                                                </p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${customer.loyalty_opt_in
                                                ? 'bg-emerald-600 text-white'
                                                : loyaltyBlocked
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                                                {customer.loyalty_opt_in ? 'Participando' : loyaltyBlocked ? 'Bloqueada' : 'Não aderiu'}
                                            </span>
                                        </div>

                                        {loyaltyBlocked && (
                                            <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/20 dark:text-red-300">
                                                A loja bloqueou este CPF para o programa.{loyaltyBlockReason ? ` Motivo: ${loyaltyBlockReason}` : ''}
                                            </p>
                                        )}

                                        {!customer.loyalty_opt_in && !loyaltyBlocked && loyaltyMissingFields.length > 0 && (
                                            <p className="mt-4 rounded-2xl bg-white p-3 text-sm text-amber-800 dark:bg-slate-900 dark:text-amber-200">
                                                Para aderir, complete em Meus dados: {loyaltyMissingFields.join(', ')}.
                                            </p>
                                        )}

                                        {!customer.loyalty_opt_in && !loyaltyBlocked && (
                                            <div className="mt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLoyaltyJoinOpen((current) => !current);
                                                        setLoyaltyDataResponsibilityAccepted(false);
                                                        setShowLoyaltyExitConfirm(false);
                                                        clearFeedback();
                                                    }}
                                                    disabled={loyaltySaving || loyaltyMissingFields.length > 0}
                                                    className="min-h-10 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50"
                                                >
                                                    {loyaltyJoinOpen ? 'Fechar adesão' : 'Quero participar'}
                                                </button>
                                            </div>
                                        )}

                                        {!customer.loyalty_opt_in && loyaltyJoinOpen && !loyaltyBlocked && (
                                            <div className="mt-4 space-y-3 border-t border-amber-200 pt-4 dark:border-amber-900/40">
                                                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 dark:bg-slate-900">
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900 dark:text-white">Regulamento</p>
                                                        <p className="mt-1 text-xs text-slate-500">Termos e apresentação institucional ficam em Loja.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => window.dispatchEvent(new CustomEvent('optmamenu:open-store-hub'))}
                                                        className="shrink-0 rounded-xl border border-amber-200 px-3 py-2 text-xs font-black text-amber-700 dark:border-amber-900/50 dark:text-amber-300"
                                                    >
                                                        Abrir Loja
                                                    </button>
                                                </div>
                                                <label className="flex items-start gap-3 rounded-2xl bg-white p-3 text-sm dark:bg-slate-900">
                                                    <input type="checkbox" checked={loyaltyTermsAccepted} onChange={(event) => setLoyaltyTermsAccepted(event.target.checked)} className="mt-1" />
                                                    <span className="text-slate-700 dark:text-slate-200">Li e aceito o regulamento publicado pela loja.</span>
                                                </label>
                                                <label className="flex items-start gap-3 rounded-2xl bg-white p-3 text-sm dark:bg-slate-900">
                                                    <input type="checkbox" checked={loyaltyDataResponsibilityAccepted} onChange={(event) => setLoyaltyDataResponsibilityAccepted(event.target.checked)} className="mt-1" />
                                                    <span className="text-slate-700 dark:text-slate-200">Declaro que sou responsável pela veracidade e atualização das informações fornecidas à loja.</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => void joinLoyaltyProgram()}
                                                    disabled={loyaltySaving || !loyaltyTermsAccepted || !loyaltyDataResponsibilityAccepted || loyaltyMissingFields.length > 0}
                                                    className="min-h-11 w-full rounded-2xl bg-emerald-600 px-4 font-black text-white disabled:opacity-50"
                                                >
                                                    {loyaltySaving ? 'Confirmando…' : 'Confirmar participação'}
                                                </button>
                                            </div>
                                        )}

                                        {customer.loyalty_opt_in && (
                                            <button
                                                type="button"
                                                onClick={() => setShowLoyaltyExitConfirm((current) => !current)}
                                                disabled={loyaltySaving}
                                                className="mt-4 min-h-10 rounded-2xl border border-red-200 px-4 text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300"
                                            >
                                                Sair do programa
                                            </button>
                                        )}

                                        {customer.loyalty_opt_in && showLoyaltyExitConfirm && (
                                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                                                <p className="text-sm font-black text-red-900 dark:text-red-100">Sair apaga os dados operacionais da fidelidade</p>
                                                <p className="mt-2 text-xs leading-5 text-red-800 dark:text-red-200">Saldo, extrato e vouchers do programa serão removidos permanentemente. Seu cadastro e histórico de compras permanecem.</p>
                                                <div className="mt-3 flex gap-2">
                                                    <button type="button" onClick={() => setShowLoyaltyExitConfirm(false)} className="flex-1 rounded-xl border border-red-200 bg-white py-2 text-xs font-black text-red-700 dark:bg-slate-950">Cancelar</button>
                                                    <button type="button" onClick={() => void leaveLoyaltyProgram()} disabled={loyaltySaving} className="flex-1 rounded-xl bg-red-600 py-2 text-xs font-black text-white disabled:opacity-50">Apagar e sair</button>
                                                </div>
                                            </div>
                                        )}
                                    </section>

                                    <section className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                                        <div className="flex items-start gap-3">
                                            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Comunicações da fidelidade</h3>
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Canais para pontos, benefícios, prêmios e assuntos do programa. Independentes do marketing geral.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Web/App</span><input type="checkbox" checked={loyaltyWebApp} disabled /></label>
                                            <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">WhatsApp</span><input type="checkbox" checked={loyaltyWhatsapp} onChange={(event) => setLoyaltyWhatsapp(event.target.checked)} /></label>
                                            <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">E-mail</span><input type="checkbox" checked={loyaltyEmail} onChange={(event) => setLoyaltyEmail(event.target.checked)} /></label>
                                            <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">SMS</span><input type="checkbox" checked={loyaltySms} onChange={(event) => setLoyaltySms(event.target.checked)} /></label>
                                        </div>
                                        {customer.loyalty_opt_in ? (
                                            <button type="button" onClick={() => void saveLoyaltyCommunicationPreferences()} disabled={loyaltyPreferencesSaving} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50">
                                                {loyaltyPreferencesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                {loyaltyPreferencesSaving ? 'Salvando…' : 'Salvar comunicações da fidelidade'}
                                            </button>
                                        ) : (
                                            <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-400">Estas escolhas serão usadas quando você concluir a adesão.</p>
                                        )}
                                    </section>
                                </div>
                            )}

                            {tab === 'addresses' && (
                                <div className="mx-auto max-w-2xl space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="font-black text-slate-900 dark:text-white">Endereços salvos</h3>
                                            <p className="text-xs text-slate-500">Você pode manter até 3 endereços.</p>
                                        </div>
                                        {!showAddressForm && addresses.length < 3 && (
                                            <button type="button" onClick={() => { setEditingAddressId(null); setAddressForm(EMPTY_ADDRESS); setShowAddressForm(true); clearFeedback(); }} className="flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white">
                                                <Plus className="h-4 w-4" /> Adicionar
                                            </button>
                                        )}
                                    </div>

                                    {showAddressForm && (
                                        <div className="space-y-3 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/10">
                                            <div className="flex gap-2">
                                                <input
                                                    value={addressForm.zip_code}
                                                    onChange={(event) => setAddressForm({ ...addressForm, zip_code: formatCep(event.target.value) })}
                                                    onBlur={() => { if (onlyDigits(addressForm.zip_code).length === 8) void lookupAddressCep(); }}
                                                    inputMode="numeric"
                                                    placeholder="CEP"
                                                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                />
                                                <button type="button" onClick={() => void lookupAddressCep()} disabled={cepLoading} className="rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-black text-emerald-700 disabled:opacity-50 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300">
                                                    {cepLoading ? 'Buscando…' : 'Buscar'}
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <input value={addressForm.state} onChange={(event) => setAddressForm({ ...addressForm, state: event.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" maxLength={2} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.street} onChange={(event) => setAddressForm({ ...addressForm, street: event.target.value })} placeholder="Rua / avenida" className="rounded-2xl border border-slate-200 bg-white p-3 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.number} onChange={(event) => setAddressForm({ ...addressForm, number: event.target.value })} placeholder="Número" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.complement} onChange={(event) => setAddressForm({ ...addressForm, complement: event.target.value })} placeholder="Complemento" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.district} onChange={(event) => setAddressForm({ ...addressForm, district: event.target.value })} placeholder="Bairro" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.city} onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })} placeholder="Cidade" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                            </div>
                                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                                                <input type="checkbox" checked={addressForm.is_default} onChange={(event) => setAddressForm({ ...addressForm, is_default: event.target.checked })} /> Endereço padrão
                                            </label>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={resetAddressForm} className="flex-1 rounded-2xl border border-slate-200 py-3 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
                                                <button type="button" onClick={saveAddress} disabled={loading || cepLoading} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Salvar</button>
                                            </div>
                                        </div>
                                    )}

                                    {!showAddressForm && addresses.length === 0 && (
                                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Nenhum endereço salvo ainda.</div>
                                    )}

                                    {!showAddressForm && addresses.map((address) => (
                                        <div key={address.id || `${address.street}-${address.number}`} className={`rounded-3xl border p-4 ${address.is_default ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-black text-slate-900 dark:text-white">{address.street}, {address.number}</p>
                                                        {address.is_default && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">PADRÃO</span>}
                                                    </div>
                                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{address.district} · {address.city}/{address.state}</p>
                                                    <p className="text-xs text-slate-500">CEP {formatCep(address.zip_code)}{address.complement ? ` · ${address.complement}` : ''}</p>
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    <button type="button" onClick={() => editAddress(address)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Editar endereço"><Pencil className="h-4 w-4" /></button>
                                                    <button type="button" onClick={() => deleteAddress(address.id)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300" aria-label="Excluir endereço"><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            </div>
                                            {!address.is_default && <button type="button" onClick={() => makeDefault(address)} className="mt-3 text-xs font-black text-emerald-700 hover:underline dark:text-emerald-400">Definir como padrão</button>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {tab === 'orders' && (
                                <div className="mx-auto max-w-2xl space-y-3">
                                    <div className="flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">Acompanhamento automático ativo</p>
                                            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                                                Esta lista recebe novos status em tempo real quando disponível e mantém uma verificação de segurança a cada 12 segundos enquanto Pedidos estiver aberto.
                                                {ordersUpdatedAt ? ` Última atualização: ${ordersUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.` : ''}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void loadOrders({ notifyStatusChanges: true, showSpinner: true }).catch(() => undefined)}
                                            disabled={ordersRefreshing}
                                            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${ordersRefreshing ? 'animate-spin' : ''}`} />
                                            {ordersRefreshing ? 'Atualizando…' : 'Atualizar agora'}
                                        </button>
                                    </div>

                                    <div className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_auto_auto]">
                                        <label className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            <input
                                                value={orderSearch}
                                                onChange={(event) => setOrderSearch(event.target.value)}
                                                placeholder="Buscar pedido ou item"
                                                className="min-h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <select
                                            value={orderStatusFilter}
                                            onChange={(event) => setOrderStatusFilter(event.target.value as typeof orderStatusFilter)}
                                            className="min-h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            aria-label="Filtrar pedidos por status"
                                        >
                                            <option value="all">Todos os status</option>
                                            <option value="active">Em andamento</option>
                                            <option value="completed">Concluídos</option>
                                            <option value="cancelled">Cancelados</option>
                                            <option value="expired">Expirados</option>
                                        </select>
                                        <select
                                            value={orderFulfillmentFilter}
                                            onChange={(event) => setOrderFulfillmentFilter(event.target.value as typeof orderFulfillmentFilter)}
                                            className="min-h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            aria-label="Filtrar pedidos por forma de recebimento"
                                        >
                                            <option value="all">Retirada e entrega</option>
                                            <option value="pickup">Retirada</option>
                                            <option value="delivery">Entrega</option>
                                        </select>
                                    </div>

                                    {orders.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Ainda não há pedidos vinculados a esta conta.</div>
                                    ) : filteredOrders.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Nenhum pedido corresponde aos filtros escolhidos.</div>
                                    ) : filteredOrders.map((order) => {
                                        const expanded = expandedOrderId === order.id;
                                        return (
                                            <div key={order.id} className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                                                    className="flex w-full items-start justify-between gap-3 p-4 text-left"
                                                >
                                                    <div>
                                                        <p className="font-black text-slate-900 dark:text-white">{order.order_code || `Pedido ${order.id.slice(0, 8)}`}</p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {orderActivityAt(order) ? `${orderActivityLabel(order.status, order.status_reason)} em ${new Date(orderActivityAt(order) as string).toLocaleString('pt-BR')}` : ''}
                                                        </p>
                                                        <p className="mt-1 text-xs font-bold text-slate-500">{orderStatusLabel(order.status, order.status_reason)}{order.fulfillment_type ? ` · ${fulfillmentLabel(order.fulfillment_type)}` : ''}</p>
                                                        {orderPickupDeadlineLabel(order) && (
                                                            <p className="mt-1 text-xs font-black text-amber-700 dark:text-amber-300">{orderPickupDeadlineLabel(order)}</p>
                                                        )}
                                                        {order.created_at && orderActivityAt(order) !== order.created_at && (
                                                            <p className="mt-1 text-[11px] text-slate-400">Pedido criado em {new Date(order.created_at).toLocaleString('pt-BR')}</p>
                                                        )}
                                                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-400">
                                                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                            {expanded ? 'Ocultar itens' : 'Ver o que foi comprado'}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 text-sm font-black text-emerald-700 dark:text-emerald-400">R$ {formatBRL(Number(order.total || 0))}</span>
                                                </button>

                                                {expanded && (
                                                    <div className="border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                                                        <div className="space-y-2">
                                                            {order.order_items.length === 0 ? (
                                                                <p className="text-sm text-slate-500">Os itens deste pedido não estão disponíveis no histórico.</p>
                                                            ) : order.order_items.map((item) => (
                                                                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm dark:bg-slate-950">
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-slate-900 dark:text-white">{item.quantity}x {item.product?.name || 'Produto indisponível'}</p>
                                                                        <p className="text-xs text-slate-500">Preço no pedido: R$ {formatBRL(item.unit_price)} cada</p>
                                                                    </div>
                                                                    <span className="shrink-0 font-black text-slate-700 dark:text-slate-200">R$ {formatBRL(item.unit_price * item.quantity)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {order.status === 'completed' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void reorderOrder(order)}
                                                                    disabled={reorderLoadingOrderId === order.id || order.order_items.length === 0}
                                                                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                                                >
                                                                    <ShoppingCart className="h-4 w-4" />
                                                                    {reorderLoadingOrderId === order.id ? 'Verificando disponibilidade…' : 'Comprar novamente'}
                                                                </button>
                                                                <p className="mt-2 text-center text-xs text-slate-500">A recompra usa catálogo, preço e estoque atuais. Itens indisponíveis não são adicionados.</p>
                                                            </>
                                                        )}

                                                        {order.status === 'reserved'
                                                            && order.payment_status === 'pending'
                                                            && Boolean(order.public_order_token)
                                                            && ['pix', 'debit_card', 'credit_card'].includes(order.payment_method_code || '') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpen(false);
                                                                    navigate(`/p/${encodeURIComponent(order.public_order_token as string)}`);
                                                                }}
                                                                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-700"
                                                            >
                                                                <CreditCard className="h-4 w-4" />
                                                                Continuar pagamento
                                                            </button>
                                                        )}

                                                        {order.status === 'reserved' && order.payment_status !== 'paid' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => void cancelCustomerOrder(order)}
                                                                disabled={cancellingOrderId === order.id}
                                                                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"
                                                            >
                                                                {cancellingOrderId === order.id
                                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                    : <XCircle className="h-4 w-4" />}
                                                                {cancellingOrderId === order.id ? 'Cancelando…' : 'Cancelar pedido'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {tab === 'consumption' && (
                                <div className="mx-auto max-w-2xl space-y-4">
                                    <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                                        <div className="flex items-start gap-3">
                                            <History className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Meu histórico de consumo</h3>
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Aqui entram somente produtos de pedidos concluídos. Você pode filtrar por retirada, entrega ou buscar um item específico.
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/10">
                                        <div className="flex items-start gap-3">
                                            <Star className="mt-0.5 h-5 w-5 shrink-0 fill-current text-amber-500" />
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Conte o que achou</h3>
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Avalie os produtos que você já comprou. Sua nota ajuda a formar os Favoritos da loja — apenas estrelas, sem comentários públicos.
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_auto]">
                                        <label className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            <input
                                                value={consumptionSearch}
                                                onChange={(event) => setConsumptionSearch(event.target.value)}
                                                placeholder="Buscar produto"
                                                className="min-h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <select
                                            value={consumptionFulfillmentFilter}
                                            onChange={(event) => setConsumptionFulfillmentFilter(event.target.value as typeof consumptionFulfillmentFilter)}
                                            className="min-h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            aria-label="Filtrar consumo por forma de recebimento"
                                        >
                                            <option value="all">Retirada e entrega</option>
                                            <option value="pickup">Retirada</option>
                                            <option value="delivery">Entrega</option>
                                        </select>
                                    </div>

                                    {consumptionHistory.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                                            Ainda não há produtos concluídos para mostrar com estes filtros.
                                        </div>
                                    ) : consumptionHistory.map((product) => {
                                        const expanded = expandedConsumptionKey === product.key;
                                        return (
                                            <section key={product.key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                                <div className="flex items-start gap-3 p-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (product.productId && consumptionCatalog.has(product.productId)) {
                                                                openConsumedProduct(product.productId);
                                                            }
                                                        }}
                                                        disabled={!product.productId || !consumptionCatalog.has(product.productId)}
                                                        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 disabled:cursor-default dark:border-slate-800 dark:bg-slate-900"
                                                        aria-label={product.productId && consumptionCatalog.has(product.productId) ? `Abrir ${product.name} no catálogo` : undefined}
                                                    >
                                                        {product.productId && consumptionCatalog.get(product.productId)?.imageUrl ? (
                                                            <img
                                                                src={consumptionCatalog.get(product.productId)?.imageUrl || ''}
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <ShoppingCart className="h-5 w-5 text-slate-400" />
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedConsumptionKey(expanded ? null : product.key)}
                                                        className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
                                                    >
                                                        <div className="min-w-0">
                                                            {product.productId && consumptionCatalog.has(product.productId) ? (
                                                                <span
                                                                    role="link"
                                                                    tabIndex={0}
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        openConsumedProduct(product.productId);
                                                                    }}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                                            event.preventDefault();
                                                                            event.stopPropagation();
                                                                            openConsumedProduct(product.productId);
                                                                        }
                                                                    }}
                                                                    className="block truncate font-black text-slate-900 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300"
                                                                >
                                                                    {product.name}
                                                                </span>
                                                            ) : (
                                                                <p className="truncate font-black text-slate-900 dark:text-white">{product.name}</p>
                                                            )}
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {product.totalQuantity} unidade(s) em {product.occurrences.length} pedido(s)
                                                            {product.lastOrderedAt ? ' · última compra ' + new Date(product.lastOrderedAt).toLocaleDateString('pt-BR') : ''}
                                                        </p>
                                                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-400">
                                                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                            {expanded ? 'Ocultar pedidos' : 'Pedidos'}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total pago</p>
                                                        <p className="mt-1 font-black text-emerald-700 dark:text-emerald-400">R$ {formatBRL(product.totalSpent)}</p>
                                                    </div>
                                                    </button>
                                                </div>

                                                {product.productId && (
                                                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                                                        <div>
                                                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Sua avaliação</p>
                                                            <p className="mt-0.5 text-[11px] text-slate-400">Disponível porque esta compra foi concluída.</p>
                                                        </div>
                                                        <div className="flex items-center gap-1" aria-label={`Avaliar ${product.name}`}>
                                                            {[1, 2, 3, 4, 5].map((rating) => {
                                                                const selected = rating <= Number(productRatings[product.productId || ''] || 0);
                                                                return (
                                                                    <button
                                                                        key={rating}
                                                                        type="button"
                                                                        onClick={() => void rateConsumedProduct(product.productId || '', rating)}
                                                                        disabled={ratingSavingProductId === product.productId}
                                                                        className="rounded-lg p-1 text-amber-500 transition hover:scale-110 disabled:opacity-50"
                                                                        aria-label={`${rating} estrela${rating === 1 ? '' : 's'}`}
                                                                        title={`${rating} estrela${rating === 1 ? '' : 's'}`}
                                                                    >
                                                                        <Star className={`h-5 w-5 ${selected ? 'fill-current' : ''}`} />
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {expanded && (
                                                    <div className="space-y-2 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                                                        {product.occurrences.map((occurrence) => (
                                                            <div key={occurrence.orderId + ':' + product.key} className="rounded-2xl bg-white p-3 text-sm dark:bg-slate-950">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <p className="font-black text-slate-900 dark:text-white">{occurrence.orderCode}</p>
                                                                        <p className="mt-1 text-xs text-slate-500">
                                                                            {occurrence.createdAt ? new Date(occurrence.createdAt).toLocaleString('pt-BR') : 'Data não disponível'}
                                                                            {occurrence.status ? ' · ' + orderStatusLabel(occurrence.status) : ''}
                                                                        </p>
                                                                    </div>
                                                                    <span className="shrink-0 font-black text-slate-700 dark:text-slate-200">R$ {formatBRL(occurrence.lineTotal)}</span>
                                                                </div>
                                                                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                                                                    {occurrence.quantity} × R$ {formatBRL(occurrence.unitPrice)} cada
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </section>
                                        );
                                    })}
                                </div>
                            )}

                            {tab === 'communications' && (
                                <div className="mx-auto max-w-2xl space-y-4">
                                    <section className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50/60 p-5 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/10">
                                        <div className="flex items-start gap-3">
                                            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-600" />
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Marketing e novidades da loja</h3>
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Promoções e campanhas comerciais gerais. Comunicações de fidelidade são configuradas separadamente na aba Fidelidade.
                                                </p>
                                            </div>
                                        </div>
                                    </section>
                                    <section className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">WhatsApp</span><input type="checkbox" checked={marketingWhatsapp} onChange={(event) => setMarketingWhatsapp(event.target.checked)} /></label>
                                            <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">E-mail</span><input type="checkbox" checked={marketingEmail} onChange={(event) => setMarketingEmail(event.target.checked)} /></label>
                                            <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">SMS</span><input type="checkbox" checked={marketingSms} onChange={(event) => setMarketingSms(event.target.checked)} /></label>
                                        </div>
                                        <button type="button" onClick={() => void saveCommunicationPreferences()} disabled={marketingPreferencesSaving} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 px-4 text-sm font-black text-white disabled:opacity-50">
                                            {marketingPreferencesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            {marketingPreferencesSaving ? 'Salvando…' : 'Salvar preferências de marketing'}
                                        </button>
                                        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Mensagens essenciais de pedido, conta e segurança não dependem destas permissões.</p>
                                    </section>
                                </div>
                            )}

                            {tab === 'messages' && (
                                <div className="mx-auto max-w-2xl space-y-4">
                                    <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                                                <div>
                                                    <h3 className="font-black text-slate-900 dark:text-white">Mensagens</h3>
                                                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Pedidos, fidelidade, sistema, perfil e segurança organizados por categoria.</p>
                                                </div>
                                            </div>
                                            <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">{notifications.filter((item) => !item.read).length} não lida(s)</span>
                                        </div>
                                    </section>
                                    <section className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="flex flex-wrap gap-2">
                                            {([
                                                ['all', 'Todas'], ['orders', 'Pedidos'], ['loyalty', 'Fidelidade'], ['profile', 'Perfil'],
                                                ['security', 'Segurança'], ['marketing', 'Marketing'], ['system', 'Sistema'], ['general', 'Geral'],
                                            ] as Array<[NotificationCategoryFilter, string]>).map(([value, label]) => (
                                                <button key={value} type="button" onClick={() => setNotificationCategoryFilter(value)} className={`rounded-full px-3 py-2 text-xs font-black transition ${notificationCategoryFilter === value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>{label}</button>
                                            ))}
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <button type="button" onClick={() => void loadNotifications()} disabled={notificationsLoading} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">{notificationsLoading ? 'Atualizando…' : 'Atualizar'}</button>
                                            {notifications.some((item) => !item.read) && <button type="button" onClick={() => void markAllNotificationsRead()} className="flex-1 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">Marcar todas como lidas</button>}
                                        </div>
                                    </section>
                                    {notificationsLoading && notifications.length === 0 ? (
                                        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div>
                                    ) : filteredNotifications.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Nenhuma mensagem nesta categoria.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {filteredNotifications.map((notification) => (
                                                <button key={notification.id} type="button" onClick={() => { if (!notification.read) void markNotificationRead(notification.id); }} className={`w-full rounded-3xl border p-4 text-left transition ${notification.read ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950' : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20'}`}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${notificationCategoryClass(notification.category)}`}>{notificationCategoryLabel(notification.category)}</span>
                                                            <p className="mt-2 font-black text-slate-900 dark:text-white">{notification.title || 'Mensagem da loja'}</p>
                                                            {notification.message && <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{notification.message}</p>}
                                                        </div>
                                                        {!notification.read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-label="Não lida" />}
                                                    </div>
                                                    <p className="mt-3 text-[11px] font-semibold text-slate-400">{notification.created_at ? new Date(notification.created_at).toLocaleString('pt-BR') : 'Data não disponível'}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {tab === 'loyalty' && (
                                <div ref={loyaltyTopRef} className="mx-auto max-w-3xl space-y-4">
                                    <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl dark:bg-slate-900 sm:p-6">
                                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Minha fidelidade</p>
                                                <div className="mt-2 flex items-end gap-3"><span className="text-5xl font-black">{customer.loyalty_points || 0}</span><span className="pb-1 text-sm font-bold text-slate-300">pontos</span></div>
                                                <p className="mt-2 text-sm font-semibold text-slate-300">Nível {customer.loyalty_tier || 'Bronze'}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button type="button" onClick={() => setTab('loyalty-settings')} className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white">Configurar fidelidade</button>
                                                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('optmamenu:open-store-hub'))} className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white">Ver programa na Loja</button>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/15"><p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Ganhos</p><p className="mt-2 text-2xl font-black text-emerald-800 dark:text-emerald-200">+{loyaltyTotals.earned}</p><p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/70">créditos no extrato</p></section>
                                        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/15"><p className="text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-300">Usos e débitos</p><p className="mt-2 text-2xl font-black text-red-800 dark:text-red-200">-{loyaltyTotals.spent}</p><p className="mt-1 text-xs text-red-700/70 dark:text-red-300/70">resgates e ajustes</p></section>
                                        <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Validade</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{loyaltyProgram?.points_validity_months ? `${loyaltyProgram.points_validity_months} meses` : 'Regulamento'}</p><p className="mt-1 text-xs text-slate-500">política do programa</p></section>
                                    </div>

                                    <section className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/10">
                                        <div className="flex items-start justify-between gap-3">
                                            <div><p className="text-xs font-black uppercase tracking-[0.15em] text-amber-700 dark:text-amber-300">Benefícios disponíveis</p><h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">O que seus pontos podem liberar</h3></div>
                                            <button type="button" onClick={() => void loadLoyaltyRewards()} disabled={loyaltyRewardsLoading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-700 shadow-sm disabled:opacity-50 dark:bg-slate-900 dark:text-amber-300" aria-label="Atualizar benefícios"><RefreshCw className={`h-4 w-4 ${loyaltyRewardsLoading ? 'animate-spin' : ''}`} /></button>
                                        </div>
                                        {loyaltyRewardsLoading && loyaltyRewards.length === 0 ? (
                                            <div className="mt-4 flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-amber-600" /></div>
                                        ) : loyaltyRewards.length === 0 ? (
                                            <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300">Não há benefício com vigência ativa neste momento.</p>
                                        ) : (
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                {loyaltyRewards.map((reward) => {
                                                    const missing = Math.max(0, reward.pointsCost - Number(customer.loyalty_points || 0));
                                                    return (
                                                        <div key={reward.id} className="overflow-hidden rounded-2xl border border-amber-100 bg-white dark:border-amber-900/30 dark:bg-slate-900">
                                                            <div className="flex gap-3 p-3">
                                                                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-amber-50 dark:bg-amber-950/20">{reward.imageUrl ? <img src={reward.imageUrl} alt="" className="h-full w-full object-cover" /> : <Gift className="h-7 w-7 text-amber-500" />}</div>
                                                                <div className="min-w-0 flex-1"><p className="line-clamp-2 font-black text-slate-900 dark:text-white">{reward.title}</p>{reward.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{reward.description}</p>}<p className="mt-2 text-sm font-black text-amber-700 dark:text-amber-300">{reward.pointsCost} pts</p>{reward.additionalCashCost > 0 && <p className="text-[11px] text-slate-500">+ R$ {formatBRL(reward.additionalCashCost)}</p>}</div>
                                                            </div>
                                                            <div className={`border-t px-3 py-2 text-xs font-black ${reward.affordable ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300' : 'border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'}`}>{reward.affordable ? 'Você já tem pontos para este benefício' : `Faltam ${missing} pontos`}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>

                                    {loyaltyVouchers.length > 0 && (
                                        <section className="rounded-3xl border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-900/40 dark:bg-violet-950/10">
                                            <h3 className="font-black text-slate-900 dark:text-white">Meus vouchers ativos</h3>
                                            <div className="mt-3 space-y-2">{loyaltyVouchers.map((voucher) => <div key={voucher.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 dark:bg-slate-900"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900 dark:text-white">{voucher.rewardTitle || 'Benefício'}</p><p className="mt-1 text-xs text-slate-500">{voucher.code ? `Código ${voucher.code}` : 'Voucher ativo'}</p></div><div className="shrink-0 text-right"><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{voucher.status || 'active'}</span>{voucher.expiresAt && <p className="mt-1 text-[10px] text-slate-400">até {new Date(voucher.expiresAt).toLocaleDateString('pt-BR')}</p>}</div></div>)}</div>
                                        </section>
                                    )}

                                    <section className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div><h3 className="font-black text-slate-900 dark:text-white">Extrato de pontos</h3><p className="mt-1 text-xs text-slate-500">Ganhos e usos em ordem cronológica.</p></div>
                                            <button type="button" onClick={() => void loadLoyaltyTransactions()} disabled={loyaltyLoading} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"><RefreshCw className={`h-3.5 w-3.5 ${loyaltyLoading ? 'animate-spin' : ''}`} />Atualizar</button>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">{([['all','Todos'],['earned','Ganhos'],['spent','Usos e débitos']] as Array<[LoyaltyTransactionFilter,string]>).map(([value,label]) => <button key={value} type="button" onClick={() => setLoyaltyTransactionFilter(value)} className={`rounded-full px-3 py-2 text-xs font-black ${loyaltyTransactionFilter===value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>{label}</button>)}</div>
                                        <div className="mt-4 space-y-2">
                                            {loyaltyLoading && loyaltyTransactions.length === 0 ? <p className="text-sm text-slate-500">Carregando extrato…</p> : filteredLoyaltyTransactions.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900">Nenhuma movimentação neste filtro.</p> : filteredLoyaltyTransactions.map((transaction) => (
                                                <div key={transaction.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><div className="min-w-0"><p className="text-sm font-bold text-slate-900 dark:text-white">{transaction.description || 'Movimentação de fidelidade'}</p><p className="mt-1 text-xs text-slate-500">{transaction.created_at ? new Date(transaction.created_at).toLocaleString('pt-BR') : ''}{transaction.order_code ? ` · ${transaction.order_code}` : ''}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-sm font-black ${transaction.points >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{transaction.points >= 0 ? '+' : ''}{transaction.points} pts</span></div>
                                            ))}
                                        </div>
                                        <button type="button" onClick={() => loyaltyTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600 dark:border-slate-700 dark:text-slate-300"><ChevronUp className="h-4 w-4" /> Voltar ao topo</button>
                                    </section>
                                </div>
                            )}

                            {tab === 'privacy' && (
                                <div className="mx-auto max-w-2xl space-y-4">
                                    <section className="rounded-3xl border border-sky-200 bg-sky-50/70 p-5 dark:border-sky-900/50 dark:bg-sky-950/15">
                                        <div className="flex items-start gap-3">
                                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Privacidade e controle dos seus dados</h3>
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Consulte os consentimentos registrados nesta loja, baixe uma cópia dos seus dados e solicite a exclusão da conta quando quiser.
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Consentimentos atuais</h3>
                                                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                    Marketing e fidelidade continuam sendo configurados em suas abas próprias.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void loadMarketingConsents()}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                                aria-label="Atualizar consentimentos"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </button>
                                        </div>

                                        {latestConsentEvents.length === 0 ? (
                                            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                Ainda não há registros de consentimento para mostrar.
                                            </p>
                                        ) : (
                                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                                {latestConsentEvents.map((event) => (
                                                    <div key={event.consent_type} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <p className="text-sm font-black text-slate-900 dark:text-white">{consentTypeLabel(event.consent_type)}</p>
                                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${event.action === 'granted'
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                                {event.action === 'granted' ? 'Permitido' : 'Revogado'}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                            {new Date(event.created_at).toLocaleString('pt-BR')} · {consentSourceLabel(event.source)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => { setTab('communications'); clearFeedback(); }}
                                                className="min-h-11 rounded-2xl border border-fuchsia-200 px-4 text-sm font-black text-fuchsia-700 dark:border-fuchsia-900/50 dark:text-fuchsia-300"
                                            >
                                                Gerenciar marketing
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setTab('loyalty-settings'); clearFeedback(); }}
                                                className="min-h-11 rounded-2xl border border-amber-200 px-4 text-sm font-black text-amber-700 dark:border-amber-900/50 dark:text-amber-300"
                                            >
                                                Gerenciar fidelidade
                                            </button>
                                        </div>
                                    </section>

                                    <section className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                                        <h3 className="font-black text-slate-900 dark:text-white">Histórico recente de consentimentos</h3>
                                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                            Este histórico é somente leitura e registra concessões e revogações.
                                        </p>
                                        {recentConsentEvents.length === 0 ? (
                                            <p className="mt-4 text-sm text-slate-500">Nenhum evento registrado.</p>
                                        ) : (
                                            <div className="mt-4 space-y-2">
                                                {recentConsentEvents.map((event, index) => (
                                                    <div key={`${event.consent_type}-${event.created_at}-${index}`} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{consentTypeLabel(event.consent_type)}</p>
                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                {consentSourceLabel(event.source)}
                                                                {event.terms_version ? ` · termos ${event.terms_version}` : ''}
                                                                {event.privacy_version ? ` · privacidade ${event.privacy_version}` : ''}
                                                            </p>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${event.action === 'granted'
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                                {event.action === 'granted' ? 'Permitido' : 'Revogado'}
                                                            </span>
                                                            <p className="mt-1 text-[10px] text-slate-400">{new Date(event.created_at).toLocaleString('pt-BR')}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <section className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="flex items-start gap-3">
                                            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-black text-slate-900 dark:text-white">Cópia dos meus dados</h3>
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Baixe uma cópia estruturada dos dados vinculados à sua conta nesta loja, incluindo cadastro, endereços, consentimentos, pedidos e histórico de segurança sem segredos de autenticação.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={downloadSelfData}
                                                    disabled={exportingData || loading}
                                                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                                >
                                                    {exportingData ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                                                    {exportingData ? 'Preparando arquivo…' : 'Exportar meus dados'}
                                                </button>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-3xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/10">
                                        <div className="flex items-start gap-3">
                                            <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-black text-slate-900 dark:text-white">Exclusão da conta</h3>
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Você pode solicitar a exclusão dos dados pessoais da sua conta. Registros que precisem ser preservados por obrigação comercial, fiscal, contábil ou legal serão mantidos de forma isolada e, quando possível, sem vínculo direto com sua identidade.
                                                </p>
                                                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    Recomendamos exportar seus dados acima antes de continuar.
                                                </p>

                                                {deletionRequestStatus === 'pending' ? (
                                                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200" role="status">
                                                        Sua solicitação de exclusão está registrada e aguardando processamento.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletionOpen((current) => !current)}
                                                            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-300 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                                                            aria-expanded={deletionOpen}
                                                        >
                                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                            {deletionOpen ? 'Fechar solicitação' : 'Solicitar exclusão da conta'}
                                                        </button>

                                                        {deletionOpen && (
                                                            <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 dark:bg-slate-950">
                                                                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                                    Por segurança, exigimos sua senha atual e um código enviado por SMS ao telefone confirmado.
                                                                </p>
                                                                <PasswordField
                                                                    label="Senha atual"
                                                                    value={deletionPassword}
                                                                    onChange={setDeletionPassword}
                                                                    placeholder="Sua senha atual"
                                                                    autoComplete="current-password"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={requestDeletionOtp}
                                                                    disabled={deletionSubmitting}
                                                                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                                                >
                                                                    {deletionSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                                                                    {deletionOtpSent ? 'Reenviar código SMS' : 'Enviar código SMS'}
                                                                </button>
                                                                {deletionOtpSent && (
                                                                    <>
                                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                                                                            Código SMS
                                                                            <input
                                                                                type="text"
                                                                                inputMode="numeric"
                                                                                autoComplete="one-time-code"
                                                                                value={deletionOtp}
                                                                                onChange={(event) => setDeletionOtp(onlyDigits(event.target.value).slice(0, 6))}
                                                                                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base tracking-[0.3em] text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                                                aria-describedby="delete-account-otp-help"
                                                                            />
                                                                        </label>
                                                                        <p id="delete-account-otp-help" className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                                            O código é exclusivo para esta solicitação e expira conforme a política de segurança da loja.
                                                                        </p>
                                                                        <button
                                                                            type="button"
                                                                            onClick={submitDeletionRequest}
                                                                            disabled={deletionSubmitting || !deletionPassword || onlyDigits(deletionOtp).length !== 6}
                                                                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50"
                                                                        >
                                                                            {deletionSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                                                            Confirmar solicitação de exclusão
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {tab === 'security' && (
                                <div className="mx-auto max-w-xl space-y-4">
                                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
                                        Sua conta na {storeDisplayName} é protegida pelo telefone confirmado por SMS e pela senha criada por você. Alterações sensíveis exigem reautenticação e podem encerrar acessos em outros dispositivos.
                                    </div>

                                    <section className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Atividades de segurança</h3>
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Mostramos apenas eventos relevantes para você, sem nomes técnicos de sessão ou heartbeat.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void loadNotifications()}
                                                disabled={notificationsLoading}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-300"
                                                aria-label="Atualizar atividades de segurança"
                                            >
                                                <RefreshCw className={`h-4 w-4 ${notificationsLoading ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>

                                        {securityActivity.length === 0 ? (
                                            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                Nenhuma atividade relevante registrada recentemente.
                                            </p>
                                        ) : (
                                            <div className="mt-4 space-y-2">
                                                {securityActivity.map((activity) => (
                                                    <div key={activity.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                                                        <div className="flex items-start gap-3">
                                                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-black text-slate-900 dark:text-white">{activity.title || 'Atualização de segurança'}</p>
                                                                {activity.message && <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{activity.message}</p>}
                                                                <p className="mt-1 text-[11px] text-slate-400">{activity.created_at ? new Date(activity.created_at).toLocaleString('pt-BR') : 'Data não disponível'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <section className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="flex items-start gap-3">
                                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <h3 className="font-black text-slate-900 dark:text-white">Dispositivos confiáveis</h3>
                                                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                            São navegadores que já confirmaram seu telefone por SMS. Um dispositivo precisa confirmar novamente após o período de segurança ou depois de ficar inativo.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => void loadTrustedDevices()}
                                                        disabled={trustedDevicesLoading || trustedDevicesRevoking}
                                                        className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                                                    >
                                                        <RefreshCw className={`h-3.5 w-3.5 ${trustedDevicesLoading ? 'animate-spin' : ''}`} />
                                                        Atualizar
                                                    </button>
                                                </div>

                                                {trustedDevicesLoading && trustedDevices.length === 0 ? (
                                                    <div className="flex justify-center py-6">
                                                        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                                                    </div>
                                                ) : trustedDevices.length === 0 ? (
                                                    <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900">
                                                        Nenhum dispositivo confiável foi listado para esta sessão.
                                                    </p>
                                                ) : (
                                                    <div className="mt-4 space-y-2">
                                                        {trustedDevices.map((device) => (
                                                            <div key={device.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                                                                <div className="min-w-0">
                                                                    {device.is_current && (
                                                                        <div className="mb-2">
                                                                            <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                                                                                Este dispositivo
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {editingTrustedDeviceId === device.id ? (
                                                                        <div className="space-y-2">
                                                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                                                <input
                                                                                    type="text"
                                                                                    value={editingTrustedDeviceLabel}
                                                                                    maxLength={40}
                                                                                    onChange={(event) => setEditingTrustedDeviceLabel(event.target.value)}
                                                                                    onFocus={(event) => event.currentTarget.select()}
                                                                                    className="min-h-10 w-full min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                                                                    aria-label="Apelido do dispositivo"
                                                                                    autoFocus
                                                                                />
                                                                                <div className="flex shrink-0 gap-2">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => void saveTrustedDeviceLabel(device.id)}
                                                                                        disabled={trustedDevicesLoading}
                                                                                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white disabled:opacity-50"
                                                                                        aria-label="Salvar apelido"
                                                                                        title="Salvar apelido"
                                                                                    >
                                                                                        <Save className="h-4 w-4" />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setEditingTrustedDeviceId(null);
                                                                                            setEditingTrustedDeviceLabel('');
                                                                                        }}
                                                                                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 dark:border-slate-700"
                                                                                        aria-label="Cancelar edição"
                                                                                        title="Cancelar"
                                                                                    >
                                                                                        <X className="h-4 w-4" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => void saveTrustedDeviceLabel(device.id, '')}
                                                                                disabled={trustedDevicesLoading}
                                                                                className="text-left text-xs font-black text-slate-500 underline-offset-2 hover:text-emerald-700 hover:underline disabled:opacity-50 dark:text-slate-400 dark:hover:text-emerald-300"
                                                                            >
                                                                                Remover apelido e usar nome automático
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex min-w-0 items-center gap-2">
                                                                            <p className="truncate font-black text-slate-900 dark:text-white">{device.label}</p>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => startRenameTrustedDevice(device)}
                                                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-emerald-600 dark:hover:bg-slate-800"
                                                                                aria-label={`Dar apelido para ${device.label}`}
                                                                                title="Renomear dispositivo"
                                                                            >
                                                                                <Pencil className="h-3.5 w-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                                        Última atividade: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString('pt-BR') : 'não informada'}
                                                                    </p>
                                                                    <p className="text-xs leading-5 text-slate-400">
                                                                        Última confirmação por SMS: {device.last_otp_verified_at ? new Date(device.last_otp_verified_at).toLocaleString('pt-BR') : 'não informada'}
                                                                    </p>
                                                                </div>

                                                                {revokingTrustedDeviceId === device.id && !device.is_current ? (
                                                                    <div className="mt-3 rounded-xl border border-red-200 bg-white p-3 dark:border-red-900/50 dark:bg-slate-950">
                                                                        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                                                                            Confirme sua senha para desconectar somente <strong>{device.label}</strong>.
                                                                        </p>
                                                                        <div className="mt-2">
                                                                            <PasswordField
                                                                                label="Senha atual"
                                                                                value={targetDevicePassword}
                                                                                onChange={setTargetDevicePassword}
                                                                                placeholder="Sua senha atual"
                                                                                autoComplete="current-password"
                                                                            />
                                                                        </div>
                                                                        <div className="mt-3 flex gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setRevokingTrustedDeviceId(null);
                                                                                    setTargetDevicePassword('');
                                                                                }}
                                                                                className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-black text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => void revokeTrustedDevice(device)}
                                                                                disabled={trustedDevicesRevoking || !targetDevicePassword}
                                                                                className="flex-1 rounded-xl bg-red-600 py-2 text-xs font-black text-white disabled:opacity-50"
                                                                            >
                                                                                {trustedDevicesRevoking ? 'Desconectando…' : 'Desconectar'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="mt-3 flex justify-end">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (device.is_current) {
                                                                                    void logout();
                                                                                    return;
                                                                                }
                                                                                setEditingTrustedDeviceId(null);
                                                                                setRevokingTrustedDeviceId(device.id);
                                                                                setTargetDevicePassword('');
                                                                                clearFeedback();
                                                                            }}
                                                                            disabled={trustedDevicesRevoking}
                                                                            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/20"
                                                                        >
                                                                            <LogOut className="h-3.5 w-3.5" />
                                                                            {device.is_current ? 'Sair deste dispositivo' : 'Desconectar este dispositivo'}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {trustedDevices.length > 1 && (
                                                    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                                                        {!revokeAllDevicesOpen ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setRevokeAllDevicesOpen(true);
                                                                    setRevokeAllDevicesPassword('');
                                                                    setRevokingTrustedDeviceId(null);
                                                                    clearFeedback();
                                                                }}
                                                                disabled={trustedDevicesRevoking}
                                                                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/20"
                                                            >
                                                                <LogOut className="h-4 w-4" />
                                                                Desconectar todos os outros dispositivos
                                                            </button>
                                                        ) : (
                                                            <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-950/15">
                                                                <p className="text-sm font-black text-red-800 dark:text-red-200">Desconectar todos os outros dispositivos?</p>
                                                                <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">Eles precisarão confirmar o telefone por SMS para entrar novamente. Este dispositivo permanecerá conectado.</p>
                                                                <div className="mt-3">
                                                                    <PasswordField
                                                                        label="Senha atual"
                                                                        value={revokeAllDevicesPassword}
                                                                        onChange={setRevokeAllDevicesPassword}
                                                                        placeholder="Sua senha atual"
                                                                        autoComplete="current-password"
                                                                    />
                                                                </div>
                                                                <div className="mt-3 flex gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setRevokeAllDevicesOpen(false);
                                                                            setRevokeAllDevicesPassword('');
                                                                        }}
                                                                        className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void revokeAllOtherTrustedDevices()}
                                                                        disabled={trustedDevicesRevoking || !revokeAllDevicesPassword}
                                                                        className="flex-1 rounded-xl bg-red-600 py-2 text-xs font-black text-white disabled:opacity-50"
                                                                    >
                                                                        {trustedDevicesRevoking ? 'Desconectando…' : 'Desconectar todos'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="flex items-start gap-3">
                                            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-black text-slate-900 dark:text-white">Alterar senha</h3>
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    Confirme sua senha atual. Depois da alteração, outras sessões e dispositivos confiáveis são desconectados por segurança; este dispositivo recebe uma sessão nova.
                                                </p>
                                                <div className="mt-4 space-y-3">
                                                    <PasswordField label="Senha atual" value={currentPassword} onChange={setCurrentPassword} placeholder="Sua senha atual" autoComplete="current-password" />
                                                    <PasswordField label="Nova senha" value={newPassword} onChange={setNewPassword} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" />
                                                    <PasswordField label="Repita a nova senha" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repita a nova senha" autoComplete="new-password" />
                                                </div>
                                                <button type="button" onClick={savePassword} disabled={loading || !currentPassword || !newPassword || !confirmPassword} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Alterar senha
                                                </button>
                                            </div>
                                        </div>
                                    </section>
                                    <button type="button" onClick={logout} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 py-3 font-black text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/20">
                                        <LogOut className="h-4 w-4" /> Sair da conta
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
