import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
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
    ShoppingCart,
    Sparkles,
    ShieldCheck,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import { AuthService } from '@/services/customerAuth';
import { CustomerService } from '@/services/customerService';
import { PublicStorefrontService } from '@/services/publicStorefrontService';
import { flushCustomerCartServerSync } from '@/services/customerCartPersistence';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { useCartStore } from '@/store/useCartStore';
import { formatBRL } from '@/utils/pricing';
import { toast } from 'sonner';

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
    total?: number | string | null;
    created_at?: string | null;
    status_changed_at?: string | null;
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

type AccountTab = 'profile' | 'addresses' | 'orders' | 'consumption' | 'loyalty' | 'security';

const CUSTOMER_ORDERS_REFRESH_MS = 12000;

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
        total: typeof order.total === 'number' || typeof order.total === 'string' ? order.total : null,
        created_at: order.created_at ? String(order.created_at) : null,
        status_changed_at: order.status_changed_at ? String(order.status_changed_at) : null,
        fulfillment_type: order.fulfillment_type ? String(order.fulfillment_type) : null,
        order_items: orderItems,
    };
}

function orderStatusLabel(status?: string | null) {
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

function orderActivityLabel(status?: string | null) {
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
    switch (order.status) {
        case 'confirmed': return `${code}: seu pedido foi confirmado e está em preparo.`;
        case 'ready': return `${code}: seu pedido está pronto.`;
        case 'out_for_delivery': return `${code}: saiu para entrega. Acompanhe por aqui as próximas atualizações.`;
        case 'completed': return `${code}: pedido concluído. Obrigado pela compra!`;
        case 'cancelled': return `${code}: o pedido foi cancelado.`;
        default: return `${code}: status atualizado para ${orderStatusLabel(order.status)}.`;
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

export function CustomerAccountPortal() {
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
    const [showLoyaltyTerms, setShowLoyaltyTerms] = useState(false);
    const [showLoyaltyExitConfirm, setShowLoyaltyExitConfirm] = useState(false);
    const [marketingWhatsapp, setMarketingWhatsapp] = useState(false);
    const [marketingEmail, setMarketingEmail] = useState(false);
    const [marketingSms, setMarketingSms] = useState(false);
    const [profileDirty, setProfileDirty] = useState(false);
    const [emailVerificationSending, setEmailVerificationSending] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [expandedConsumptionKey, setExpandedConsumptionKey] = useState<string | null>(null);
    const [reorderLoadingOrderId, setReorderLoadingOrderId] = useState<string | null>(null);
    const ordersRef = useRef<CustomerOrderSummary[]>([]);
    const ordersRequestInFlightRef = useRef(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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

    const displayName = useMemo(
        () => customer?.nickname || customer?.full_name || 'cliente',
        [customer?.full_name, customer?.nickname],
    );

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
                createdAt: string | null;
                quantity: number;
                unitPrice: number;
                lineTotal: number;
            }>;
        }>();

        orders
            .filter((order) => order.status !== 'cancelled')
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
            });
    }, [orders]);


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

    useEffect(() => {
        if (profileDirty) return;
        setNickname(customer?.nickname || '');
        setFullName(customer?.full_name || '');
        setEmail(customer?.email || '');
        setCpf(customer?.cpf || '');
        setBirthDate(customer?.birth_date || '');
    }, [customer?.birth_date, customer?.cpf, customer?.email, customer?.full_name, customer?.nickname, profileDirty]);

    useEffect(() => {
        if (!open || tab !== 'security' || !customer?.id) return;

        let active = true;
        void CustomerService.getSelfAccountDeletionRequest()
            .then((request) => {
                if (!active) return;
                setDeletionRequestStatus(request?.status || null);
            })
            .catch(() => {
                // O status não deve impedir o restante da área de segurança.
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
        const latest = new Map<string, string>();
        consents.forEach((consent) => {
            if (!latest.has(consent.consent_type)) latest.set(consent.consent_type, consent.action);
        });
        setMarketingWhatsapp(latest.get('marketing_whatsapp') === 'granted');
        setMarketingEmail(latest.get('marketing_email') === 'granted');
        setMarketingSms(latest.get('marketing_sms') === 'granted');
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
        if (!open || !customer || tab !== 'loyalty') return;
        let active = true;

        void Promise.all([
            refreshCustomerSnapshot(),
            loadLoyaltyTransactions(),
            loadLoyaltyProgram(),
            loadMarketingConsents(),
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
        loadMarketingConsents,
    ]);

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
            link.download = `optmamenu-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
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
                marketingWhatsapp,
                marketingEmail,
                marketingSms,
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

    const leaveLoyaltyProgram = async () => {
        clearFeedback();
        setLoyaltySaving(true);
        try {
            await CustomerService.leaveSelfLoyalty();
            setLoyaltyTransactions([]);
            await Promise.all([
                refreshCustomerSnapshot(),
                loadLoyaltyProgram(),
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

    const savePassword = async () => {
        clearFeedback();
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
            await AuthService.setPassword(newPassword);
            setNewPassword('');
            setConfirmPassword('');
            setMessage('Senha atualizada com sucesso.');
        } catch (passwordError) {
            setError(passwordError instanceof Error ? passwordError.message : 'Não foi possível atualizar a senha.');
        } finally {
            setLoading(false);
        }
    };

    const tabs: Array<{ id: AccountTab; label: string; icon: typeof UserRound }> = [
        { id: 'profile', label: 'Meus dados', icon: UserRound },
        { id: 'addresses', label: 'Endereços', icon: MapPin },
        { id: 'orders', label: 'Pedidos', icon: PackageCheck },
        { id: 'consumption', label: 'Meu consumo', icon: History },
        { id: 'loyalty', label: 'Fidelidade', icon: Gift },
        { id: 'security', label: 'Segurança', icon: KeyRound },
    ];

    return (
        <>
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

            {open && (
                <div className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
                    <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[90vh] sm:max-w-4xl sm:rounded-3xl">
                        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Minha conta</p>
                                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">{displayName}</h2>
                                <p className="text-xs text-slate-500">{customer.phone}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                aria-label="Fechar minha conta"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </header>

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
                                                Esta lista verifica novos status a cada 12 segundos enquanto Pedidos estiver aberto.
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

                                    {orders.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Ainda não há pedidos vinculados a esta conta.</div>
                                    ) : orders.map((order) => {
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
                                                            {orderActivityAt(order) ? `${orderActivityLabel(order.status)} em ${new Date(orderActivityAt(order) as string).toLocaleString('pt-BR')}` : ''}
                                                        </p>
                                                        <p className="mt-1 text-xs font-bold text-slate-500">{orderStatusLabel(order.status)}{order.fulfillment_type ? ` · ${fulfillmentLabel(order.fulfillment_type)}` : ''}</p>
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
                                                    Veja quais produtos você já pediu nesta loja, quando comprou, quantidade e quanto pagou em cada pedido. Pedidos cancelados não entram neste resumo.
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    {consumptionHistory.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                                            Ainda não há produtos para mostrar no seu histórico.
                                        </div>
                                    ) : consumptionHistory.map((product) => {
                                        const expanded = expandedConsumptionKey === product.key;
                                        return (
                                            <section key={product.key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedConsumptionKey(expanded ? null : product.key)}
                                                    className="flex w-full items-start justify-between gap-4 p-4 text-left"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate font-black text-slate-900 dark:text-white">{product.name}</p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {product.totalQuantity} unidade(s) em {product.occurrences.length} pedido(s)
                                                            {product.lastOrderedAt ? ' · última compra ' + new Date(product.lastOrderedAt).toLocaleDateString('pt-BR') : ''}
                                                        </p>
                                                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-400">
                                                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                            {expanded ? 'Ocultar compras' : 'Ver quando comprei'}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total pago</p>
                                                        <p className="mt-1 font-black text-emerald-700 dark:text-emerald-400">R$ {formatBRL(product.totalSpent)}</p>
                                                    </div>
                                                </button>

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

                            {tab === 'loyalty' && (
                                <div className="mx-auto max-w-2xl space-y-4">
                                    <section className={`rounded-3xl p-5 shadow-lg ${customer.loyalty_opt_in ? 'bg-emerald-600 text-white' : 'border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-slate-900 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-slate-950 dark:text-white'}`}>
                                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Gift className={`h-7 w-7 ${customer.loyalty_opt_in ? 'text-white' : 'text-emerald-600'}`} />
                                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${customer.loyalty_opt_in ? 'bg-white/15 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>
                                                        {customer.loyalty_opt_in ? 'Participação ativa' : 'Adesão disponível'}
                                                    </span>
                                                </div>
                                                <h3 className="mt-4 text-2xl font-black">{customer.loyalty_opt_in ? 'Você faz parte do Clube de Pontos' : 'Participe do nosso Clube de Pontos'}</h3>
                                                <p className={`mt-2 max-w-xl text-sm leading-6 ${customer.loyalty_opt_in ? 'text-emerald-100' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {customer.loyalty_opt_in
                                                        ? 'Compras elegíveis podem gerar pontos e benefícios conforme as regras vigentes da loja.'
                                                        : 'A adesão é voluntária. Depois de entrar, suas próximas compras elegíveis poderão acumular pontos e liberar benefícios exclusivos.'}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (customer.loyalty_opt_in) {
                                                        setShowLoyaltyExitConfirm(true);
                                                        setLoyaltyJoinOpen(false);
                                                    } else {
                                                        setLoyaltyJoinOpen((current) => !current);
                                                        setLoyaltyDataResponsibilityAccepted(false);
                                                        setShowLoyaltyExitConfirm(false);
                                                    }
                                                    clearFeedback();
                                                }}
                                                disabled={loyaltySaving || loyaltyBlocked}
                                                className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl px-5 text-sm font-black transition disabled:opacity-50 ${customer.loyalty_opt_in ? 'border border-white/40 bg-white/10 text-white hover:bg-white/20' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                            >
                                                {loyaltySaving
                                                    ? 'Salvando…'
                                                    : customer.loyalty_opt_in
                                                        ? 'Sair do programa'
                                                        : loyaltyBlocked
                                                            ? 'Participação bloqueada'
                                                            : 'Quero participar'}
                                            </button>
                                        </div>
                                    </section>

                                    {loyaltyBlocked && (
                                        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
                                            <h3 className="font-black text-red-800 dark:text-red-200">Participação indisponível</h3>
                                            <p className="mt-2 text-sm leading-6 text-red-700 dark:text-red-300">
                                                A loja bloqueou este CPF para o programa de fidelidade.
                                                {loyaltyBlockReason ? ` Motivo informado: ${loyaltyBlockReason}` : ' Fale com a loja para mais informações.'}
                                            </p>
                                        </section>
                                    )}

                                    {!customer.loyalty_opt_in && loyaltyJoinOpen && !loyaltyBlocked && (
                                        <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/15">
                                            <h3 className="font-black text-slate-900 dark:text-white">Entrar no programa</h3>
                                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                A participação no programa é separada das permissões de marketing. Escolha abaixo como deseja receber novidades; comunicações essenciais de pedido e segurança continuam independentes destas opções.
                                            </p>

                                            <label className="mt-4 flex items-start gap-3 rounded-2xl bg-white p-3 text-sm dark:bg-slate-900">
                                                <input
                                                    type="checkbox"
                                                    checked={loyaltyTermsAccepted}
                                                    onChange={(event) => setLoyaltyTermsAccepted(event.target.checked)}
                                                    className="mt-1"
                                                />
                                                <span className="text-slate-700 dark:text-slate-200">
                                                    Li e aceito o <button type="button" onClick={() => setShowLoyaltyTerms((current) => !current)} className="font-black text-emerald-700 underline dark:text-emerald-300">regulamento do programa de fidelidade</button>.
                                                </span>
                                            </label>

                                            <label className="mt-3 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                                                <input
                                                    type="checkbox"
                                                    checked={loyaltyDataResponsibilityAccepted}
                                                    onChange={(event) => setLoyaltyDataResponsibilityAccepted(event.target.checked)}
                                                    className="mt-1"
                                                />
                                                <span className="text-slate-700 dark:text-slate-200">
                                                    Declaro que sou responsável pela veracidade e atualização das informações fornecidas à loja e que possuo legitimidade para aderir ao programa e aceitar seu regulamento.
                                                </span>
                                            </label>

                                            {showLoyaltyTerms && (
                                                <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-emerald-100 bg-white p-4 text-xs leading-5 text-slate-600 dark:border-emerald-900/40 dark:bg-slate-900 dark:text-slate-300">
                                                    {loyaltyProgram?.program_terms || 'A loja ainda não publicou um regulamento para este programa.'}
                                                </div>
                                            )}

                                            <div className="mt-4">
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Quero receber promoções e novidades por</p>
                                                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                                    <label className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                        <input type="checkbox" checked={marketingWhatsapp} onChange={(event) => setMarketingWhatsapp(event.target.checked)} />
                                                        <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                                                    </label>
                                                    <label className={`flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-bold dark:bg-slate-900 ${customer.email_verified ? 'text-slate-700 dark:text-slate-200' : 'cursor-not-allowed text-slate-400'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={marketingEmail}
                                                            disabled={!customer.email_verified}
                                                            onChange={(event) => setMarketingEmail(event.target.checked)}
                                                        />
                                                        <Mail className="h-4 w-4 text-emerald-600" /> {customer.email_verified ? 'E-mail' : 'E-mail (confirme primeiro)'}
                                                    </label>
                                                    <label className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                        <input type="checkbox" checked={marketingSms} onChange={(event) => setMarketingSms(event.target.checked)} />
                                                        <MessageCircle className="h-4 w-4 text-emerald-600" /> SMS
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                                <button type="button" onClick={() => setLoyaltyJoinOpen(false)} className="flex-1 rounded-2xl border border-slate-200 py-3 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Agora não</button>
                                                <button type="button" onClick={() => void joinLoyaltyProgram()} disabled={loyaltySaving || !loyaltyTermsAccepted || !loyaltyDataResponsibilityAccepted || loyaltyMissingFields.length > 0} className="flex-1 rounded-2xl bg-emerald-600 py-3 font-black text-white disabled:opacity-50">
                                                    Confirmar participação
                                                </button>
                                            </div>
                                        </section>
                                    )}

                                    {customer.loyalty_opt_in && showLoyaltyExitConfirm && (
                                        <section className="rounded-3xl border-2 border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20">
                                            <h3 className="font-black text-red-900 dark:text-red-100">Sair do programa apaga seus dados de fidelidade</h3>
                                            <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">
                                                Ao confirmar, seu saldo de pontos, extrato de movimentações, vouchers e demais dados operacionais deste programa serão excluídos permanentemente e não poderão ser restaurados. Seu cadastro de cliente e histórico de compras permanecem. Você poderá participar novamente no futuro, salvo se a loja bloquear seu CPF por descumprimento dos termos.
                                            </p>
                                            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                                <button type="button" onClick={() => setShowLoyaltyExitConfirm(false)} className="flex-1 rounded-2xl border border-red-200 bg-white py-3 font-bold text-red-700 dark:bg-slate-950">Continuar participando</button>
                                                <button type="button" onClick={() => void leaveLoyaltyProgram()} disabled={loyaltySaving} className="flex-1 rounded-2xl bg-red-600 py-3 font-black text-white disabled:opacity-50">
                                                    Apagar dados e sair
                                                </button>
                                            </div>
                                        </section>
                                    )}

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-lg dark:bg-slate-900">
                                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Saldo de pontos</p>
                                            <p className="mt-2 text-4xl font-black">{customer.loyalty_points || 0}</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-300">Nível {customer.loyalty_tier || 'Bronze'}</p>
                                            {!customer.loyalty_opt_in && <p className="mt-3 text-xs leading-5 text-amber-300">Você ainda não está participando. Ative sua adesão acima para pontuar nas próximas compras elegíveis.</p>}
                                        </section>

                                        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
                                            <Sparkles className="h-7 w-7 text-amber-600 dark:text-amber-300" />
                                            <h3 className="mt-4 font-black text-slate-900 dark:text-white">Benefícios e novidades do clube</h3>
                                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Este espaço é separado dos banners do cardápio e ficará reservado para campanhas, vantagens e comunicações exclusivas de fidelidade.</p>
                                        </section>
                                    </div>

                                    {loyaltyAgeRestricted && (
                                        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 dark:border-red-900/40 dark:bg-red-950/20">
                                            <h3 className="font-black text-red-900 dark:text-red-100">Participação disponível a partir dos 18 anos</h3>
                                            <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">
                                                Pela data de nascimento informada, este cadastro ainda não atende à idade mínima definida para o programa de fidelidade da loja.
                                            </p>
                                        </section>
                                    )}

                                    {loyaltyMissingFields.length > 0 && (
                                        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
                                            <h3 className="font-black text-amber-900 dark:text-amber-100">Complete seus dados para a fidelidade</h3>
                                            <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200">
                                                Faltam: {loyaltyMissingFields.join(', ')}. Os dados podem ser preenchidos em Meus dados; a confirmação do e-mail é feita pela própria loja.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setTab('profile')}
                                                className="mt-3 rounded-2xl bg-amber-600 px-4 py-2 text-sm font-black text-white"
                                            >
                                                Completar meus dados
                                            </button>
                                        </section>
                                    )}

                                    {customer.loyalty_opt_in && (
                                    <section className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Extrato de pontos</h3>
                                                <p className="mt-1 text-xs text-slate-500">Ganhos, resgates e ajustes registrados no programa.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void loadLoyaltyTransactions()}
                                                disabled={loyaltyLoading}
                                                className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                                            >
                                                <RefreshCw className={`h-3.5 w-3.5 ${loyaltyLoading ? 'animate-spin' : ''}`} />
                                                Atualizar
                                            </button>
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            {loyaltyLoading && loyaltyTransactions.length === 0 ? (
                                                <p className="text-sm text-slate-500">Carregando extrato…</p>
                                            ) : loyaltyTransactions.length === 0 ? (
                                                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900">Ainda não há movimentações de pontos.</p>
                                            ) : loyaltyTransactions.map((transaction) => (
                                                <div key={transaction.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{transaction.description || 'Movimentação de fidelidade'}</p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {transaction.created_at ? new Date(transaction.created_at).toLocaleString('pt-BR') : ''}
                                                            {transaction.order_code ? ` · ${transaction.order_code}` : ''}
                                                        </p>
                                                    </div>
                                                    <span className={`shrink-0 text-sm font-black ${transaction.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {transaction.points >= 0 ? '+' : ''}{transaction.points} pts
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                    )}

                                    <section className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Termos e regras do programa</h3>
                                                <p className="mt-1 text-xs text-slate-500">{loyaltyProgram?.name || 'Programa de fidelidade da loja'}</p>
                                            </div>
                                            <button type="button" onClick={() => setShowLoyaltyTerms((current) => !current)} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                <FileText className="h-4 w-4" /> {showLoyaltyTerms ? 'Ocultar' : 'Ver regulamento'}
                                            </button>
                                        </div>
                                        {showLoyaltyTerms && (
                                            <div className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                {loyaltyProgram?.program_terms || 'A loja ainda não publicou um regulamento para este programa.'}
                                            </div>
                                        )}
                                    </section>

                                    <section className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                                        <h3 className="font-black text-slate-900 dark:text-white">Como funciona</h3>
                                        <div className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                                            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><strong className="block text-slate-900 dark:text-white">1. Participe</strong>Confirme sua adesão ao programa.</div>
                                            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><strong className="block text-slate-900 dark:text-white">2. Compre</strong>Pedidos elegíveis seguem as regras de pontuação da loja.</div>
                                            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><strong className="block text-slate-900 dark:text-white">3. Acompanhe</strong>Veja saldo, nível e futuras vantagens nesta área.</div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {tab === 'security' && (
                                <div className="mx-auto max-w-xl space-y-4">
                                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
                                        Sua conta da loja é protegida pelo telefone confirmado por SMS e pela senha criada por você. Dependendo da política de segurança, uma alteração sensível pode pedir nova confirmação por SMS.
                                    </div>
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
                                    <PasswordField label="Nova senha" value={newPassword} onChange={setNewPassword} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" />
                                    <PasswordField label="Repita a nova senha" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repita a nova senha" autoComplete="new-password" />
                                    <button type="button" onClick={savePassword} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                                        <KeyRound className="h-4 w-4" /> Alterar senha
                                    </button>
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
