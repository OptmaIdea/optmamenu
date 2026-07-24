import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Product, Category, StoreConfig } from '@/types';
import { ProductCard } from '@/pages/store/ProductCard';
import { ProductModal } from '@/pages/store/ProductModal';
import { useCartStore } from '@/store/useCartStore';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { AuthService } from '@/services/customerAuth';
import { CustomerService } from '@/services/customerService';
/* import { CartDrawer } from '@/pages/store/components/CartDrawer'; */
import CustomerProfile from '@/pages/store/components/CustomerProfile';
import {
    PublicStorefrontService,
    type PublicPaymentMethod,
    type PublicDeliveryMethod,
} from '@/services/publicStorefrontService';
import { PublicOrderService } from '@/services/publicOrderService';
import { timezoneUtils } from '@/utils/timezoneUtils';
import { buildWhatsappUrl, canOpenWhatsapp } from '@/utils/whatsapp';
import { PublicLoyaltyService, type PublicLoyaltyResponse } from '@/services/publicLoyaltyService';
import {
    Search,
    User,
    LogOut,
    Mail,
    Loader2,
    Bell,
    AlertCircle,
    X
} from 'lucide-react';

function compactPublicOrderCode(orderCode: string) {
    const suffix = orderCode.split('-').pop();
    return suffix ? `#${suffix}` : orderCode;
}

// Simple Theme Toggle Icon Component
function ThemeToggleIcon() {
    return (
        <>
            <svg className="block dark:hidden" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <svg className="hidden dark:block" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
        </>
    );
}

interface Store {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    phone_number?: string;
    minimum_order_value?: number;
    reservation_time_minutes?: number;
    public_catalog_enabled?: boolean;
    privacy_policy_text?: string;
    terms_of_use_text?: string;
    cookie_policy_text?: string;
    whatsapp?: {
        raw?: string;
        digits?: string;
        enabled?: boolean;
    };
    contacts?: {
        whatsapp_business?: string;
    };
    config?: StoreConfig;
}

export default function Catalog() {
    const { storeSlug, tableCode } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const isQrTableMode = Boolean(tableCode);
    const {
        items: cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        setCategoryRules,
        syncCatalogPricing,
    } = useCartStore();

    const { isAuthenticated, customer, logout } = useCustomerAuth();

    const [isDark, setIsDark] = useState(false);
    const [store, setStore] = useState<Store | null>(null);
    const [loadingStore, setLoadingStore] = useState(true);

    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showCompleteProfileModal, setShowCompleteProfileModal] = useState(false);
    const [profileInitialTab] = useState<'data' | 'address' | 'loyalty'>('data');
    const [loginStep, setLoginStep] = useState<'menu' | 'password_login' | 'register_form' | 'otp' | 'welcome_new'>('password_login');
    const [loginPhone, setLoginPhone] = useState('');
    const [loginOtp, setLoginOtp] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginNickname, setLoginNickname] = useState('');
    const [loginBirthDate, setLoginBirthDate] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const unreadCount = notifications.filter(n => !n.read).length;
    const [showNotifications, setShowNotifications] = useState(false);
    const [showTasks, setShowTasks] = useState(false);

    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery' | 'qr_table'>('pickup');
    const [deliveryAddress, setDeliveryAddress] = useState({
        street: '',
        number: '',
        complement: '',
        district: '',
        city: 'São João Nepomuceno',
        state: 'MG',
        reference: '',
    });
    const [orderLoading, setOrderLoading] = useState(false);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [orderSuccess, setOrderSuccess] = useState<{
        order_code: string;
        total: number;
        whatsapp_url?: string;
        public_order_token: string;
        tracking_url: string;
    } | null>(null);


    useEffect(() => {
        const checkoutSuccess = location.state?.orderSuccess;
        if (!checkoutSuccess) return;

        setOrderSuccess(checkoutSuccess);
        navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);

    const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);
    const [selectedPaymentMethodCode, setSelectedPaymentMethodCode] = useState('pending');

    const [deliveryMethods, setDeliveryMethods] = useState<PublicDeliveryMethod[]>([]);
    const [selectedDeliveryMethodCode, setSelectedDeliveryMethodCode] = useState('pickup');

    const [storeHours, setStoreHours] = useState<any[]>([]);
    const [storeExceptions, setStoreExceptions] = useState<any[]>([]);
    const [storeStatus, setStoreStatus] = useState<{
        isOpen: boolean;
        canOrder: boolean;
        message: string | null;
        isClosingSoon: boolean;
    }>({ isOpen: false, canOrder: false, message: null, isClosingSoon: false });
    const [loyaltyPhone, setLoyaltyPhone] = useState('');
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
    const [loyaltyResult, setLoyaltyResult] = useState<PublicLoyaltyResponse | null>(null);

    useEffect(() => {
        async function fetchPublicStorefront() {
            if (!storeSlug) return;

            setLoadingStore(true);
            setLoadingProducts(true);

            try {
                const storefront = await PublicStorefrontService.getStorefrontBySlug(storeSlug);

                if (!storefront.ok || !storefront.store) {
                    setStore(null);
                    setCategories([]);
                    setProducts([]);
                    return;
                }

                const mappedStore = PublicStorefrontService.toCatalogStore(storefront.store);
                setStore(mappedStore);

                setStoreHours(storefront.store.hours || []);
                setStoreExceptions([]);

                const catalog = await PublicStorefrontService.getCatalogBySlug(storeSlug);

                if (!catalog.ok || !catalog.catalog_enabled) {
                    setCategories([]);
                    setProducts([]);
                    setCategoryRules([]);
                    return;
                }

                const normalizedCategories = catalog.categories || [];
                const normalizedProducts = normalizedCategories.flatMap((category) =>
                    (category.products || []).map((product) => ({
                        ...product,
                        category_id: product.category_id || category.id,
                    }))
                );

                setCategories(normalizedCategories);
                syncCatalogPricing(normalizedCategories, normalizedProducts);
                setProducts(normalizedProducts);

                const paymentMethodsResult =
                    await PublicStorefrontService.getPublicPaymentMethodsBySlug(storeSlug);

                if (paymentMethodsResult.ok) {
                    const methods = paymentMethodsResult.payment_methods || [];
                    setPaymentMethods(methods);

                    const hasPending = methods.some((method) => method.code === 'pending');
                    const firstMethod = methods[0]?.code;

                    setSelectedPaymentMethodCode(hasPending ? 'pending' : firstMethod || 'pending');
                } else {
                    setPaymentMethods([]);
                    setSelectedPaymentMethodCode('pending');
                }

                const deliveryMethodsResult =
                    await PublicStorefrontService.getPublicDeliveryMethodsBySlug(storeSlug);

                if (deliveryMethodsResult.ok) {
                    const methods = deliveryMethodsResult.delivery_methods || [];
                    setDeliveryMethods(methods);

                    const qrMethod = methods.find((method) => method.code === 'qr_table');
                    const hasPickup = methods.some((method) => method.code === 'pickup');
                    const firstMethod = methods[0]?.code;

                    const selectedCode =
                        isQrTableMode && qrMethod
                            ? 'qr_table'
                            : hasPickup
                                ? 'pickup'
                                : firstMethod || 'pickup';

                    setSelectedDeliveryMethodCode(selectedCode);

                    const initialMethod = methods.find((method) => method.code === selectedCode);

                    if (initialMethod?.fulfillment_type === 'delivery') {
                        setFulfillmentType('delivery');
                    } else if (initialMethod?.fulfillment_type === 'qr_table') {
                        setFulfillmentType('qr_table');
                    } else {
                        setFulfillmentType('pickup');
                    }
                } else {
                    setDeliveryMethods([]);
                    setSelectedDeliveryMethodCode('pickup');
                    setFulfillmentType('pickup');
                }
            } catch (err) {
                console.error('Erro ao carregar loja pública:', err);
                setStore(null);
                setCategories([]);
                setProducts([]);
            } finally {
                setLoadingStore(false);
                setLoadingProducts(false);
            }
        }

        fetchPublicStorefront();
    }, [storeSlug, setCategoryRules]);

    const refreshCustomerData = () => {
        if (customer?.id) {
            CustomerService.getAddresses(customer.id).then(setCustomerAddresses).catch(console.error);
            CustomerService.getNotifications(customer.id).then(setNotifications).catch(console.error);
        }
    };

    const cartSubtotal = cartItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * item.quantity,
        0
    );

    const selectedDeliveryMethod = deliveryMethods.find(
        (method) => method.code === selectedDeliveryMethodCode
    );

    const selectedFulfillmentType =
        selectedDeliveryMethod?.fulfillment_type || fulfillmentType;

    const selectedDeliveryFee = Number(selectedDeliveryMethod?.delivery_fee || 0);

    const selectedDeliveryMinimum = Number(
        selectedDeliveryMethod?.minimum_order_value || 0
    );

    const requiresAddress = Boolean(selectedDeliveryMethod?.requires_address);
    const requiresTable = Boolean(selectedDeliveryMethod?.requires_table);

    const cartTotalWithDelivery = cartSubtotal + selectedDeliveryFee;

    const isBelowSelectedDeliveryMinimum =
        selectedDeliveryMinimum > 0 && cartSubtotal < selectedDeliveryMinimum;

    const loyaltyData =
        loyaltyResult?.found && loyaltyResult.loyalty ? loyaltyResult.loyalty : null;

    const recentLoyaltyTransactions = loyaltyData?.recent_transactions ?? [];

    const loyaltyCustomerName = loyaltyData?.customer?.name?.trim() || '';

    const loyaltyNotFoundMessage =
        loyaltyResult?.message || 'Ainda não encontramos pontos para este WhatsApp.';

    const handleCreatePublicOrder = async () => {
        if (!storeSlug) return;

        if (cartItems.length === 0) {
            setOrderError('Adicione pelo menos um item ao carrinho.');
            return;
        }

        if (!customerPhone.trim()) {
            setOrderError('Informe seu WhatsApp para continuar.');
            return;
        }

        if (isQrTableMode && !tableCode) {
            setOrderError('Mesa/comanda não identificada.');
            return;
        }

        if (requiresAddress) {
            if (!deliveryAddress.street.trim() || !deliveryAddress.number.trim() || !deliveryAddress.district.trim()) {
                setOrderError('Informe endereço, número e bairro para entrega.');
                return;
            }
        }

        if (requiresTable && !tableCode) {
            setOrderError('Mesa/comanda não identificada.');
            return;
        }

        if (isBelowSelectedDeliveryMinimum) {
            setOrderError(
                `Para ${selectedDeliveryMethod?.name || 'esta forma de entrega'}, o pedido mínimo é R$ ${selectedDeliveryMinimum
                    .toFixed(2)
                    .replace('.', ',')}.`
            );
            return;
        }

        try {
            setOrderLoading(true);
            setOrderError(null);
            setOrderSuccess(null);

            const result = await PublicOrderService.createPublicOrder({
                slug: storeSlug,
                customer_name: customerName,
                customer_phone: customerPhone,
                fulfillment_type: selectedFulfillmentType,
                sales_channel: isQrTableMode ? 'qr_table' : 'public_store',
                payment_method_code: selectedPaymentMethodCode,
                delivery_method_code: selectedDeliveryMethodCode,
                table_code: isQrTableMode ? tableCode || null : null,
                items: cartItems.map((item) => ({
                    product_id: item.id,
                    quantity: item.quantity,
                })),
                delivery_address: requiresAddress ? deliveryAddress : {},
                notes: null,
            });

            if (!result.ok || !result.order) {
                const errorLabels: Record<string, string> = {
                    minimum_order_not_reached: 'Pedido mínimo para entrega não atingido.',
                    insufficient_stock: `Estoque insuficiente para ${result.product_name || 'um dos itens'}.`,
                    product_unavailable: 'Um dos produtos não está disponível para venda.',
                    payment_method_disabled: 'Forma de pagamento indisponível para esta loja.',
                    sales_channel_disabled: 'Canal de venda indisponível para esta loja.',
                    sales_location_not_configured: 'Local de venda não configurado.',
                    invalid_customer_phone: 'WhatsApp do cliente inválido.',
                    empty_cart: 'Carrinho vazio.',
                };

                setOrderError(
                    errorLabels[result.error || ''] ||
                    result.message ||
                    `Não foi possível criar o pedido. Código: ${result.error || 'erro_desconhecido'}`
                );
                return;
            }
            const trackingUrl = `${window.location.origin}/p/${encodeURIComponent(result.order.public_order_token)}`;
            const compactCode = compactPublicOrderCode(result.order.order_code);
            const firstName = (customerName.trim() || 'Cliente').split(/\s+/)[0];
            const catalogUrl = `${window.location.origin}/s/${encodeURIComponent(storeSlug)}`;
            const orderMessage = [
                `Olá *${firstName}*. Bom ter você conosco 😊!`,
                '',
                `Recebemos seu pedido nº *${compactCode}*. Já já te damos mais detalhes.`,
                'Enquanto isso, navegue pelo nosso catálogo:',
                catalogUrl,
            ].join('\n');
            const orderWhatsappUrl = result.whatsapp?.digits && canOpenWhatsapp(result.whatsapp.digits)
                ? buildWhatsappUrl(result.whatsapp.digits, orderMessage)
                : result.whatsapp?.url || undefined;

            setOrderSuccess({
                order_code: result.order.order_code,
                total: Number(result.order.total || 0),
                whatsapp_url: orderWhatsappUrl,
                public_order_token: result.order.public_order_token,
                tracking_url: trackingUrl,
            });

            clearCart();

            if (orderWhatsappUrl) {
                window.open(orderWhatsappUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (err: any) {
            console.error('Erro ao criar pedido público:', err);
            setOrderError(err?.message || 'Erro ao criar pedido.');
        } finally {
            setOrderLoading(false);
        }
    };

    const handleCheckLoyalty = async () => {
        if (!storeSlug) return;

        setLoyaltyLoading(true);
        setLoyaltyError(null);
        setLoyaltyResult(null);

        try {
            const result = await PublicLoyaltyService.getByPhone(storeSlug, loyaltyPhone);

            if (!result.ok) {
                setLoyaltyError(result.error || 'Não foi possível consultar seus pontos.');
                return;
            }

            setLoyaltyResult(result);
        } catch (err: any) {
            console.error('Erro ao consultar fidelidade:', err);
            setLoyaltyError(err?.message || 'Erro ao consultar fidelidade.');
        } finally {
            setLoyaltyLoading(false);
        }
    };

    useEffect(() => {
        if (customer?.id) {
            refreshCustomerData();

            const channel = supabase
                .channel(`customer_notifications:${customer.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customer_notifications', filter: `customer_id=eq.${customer.id}` }, (payload) => {
                    setNotifications(prev => [payload.new, ...prev]);
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_notifications', filter: `customer_id=eq.${customer.id}` }, (payload) => {
                    setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        } else {
            setCustomerAddresses([]);
            setNotifications([]);
        }
    }, [customer?.id]);

    useEffect(() => {
        if (!store || !storeHours.length) return;
        const checkStatus = () => {
            const now = timezoneUtils.getBrazilDate();
            const currentDay = now.getDay();
            const currentDateStr = now.toISOString().split('T')[0];
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const exception = storeExceptions.find(e => e.exception_date === currentDateStr);
            let todayRule = { is_closed: false, open_time: '00:00', close_time: '23:59' };

            if (exception) {
                todayRule = { is_closed: exception.is_closed, open_time: exception.open_time || '00:00', close_time: exception.close_time || '23:59' };
            } else {
                const weekly = storeHours.find(h => h.day_of_week === currentDay);
                if (weekly) {
                    todayRule = { is_closed: weekly.is_closed, open_time: weekly.open_time, close_time: weekly.close_time };
                } else {
                    todayRule = { is_closed: true, open_time: '00:00', close_time: '00:00' };
                }
            }

            let isInsideWindow = false;
            let minutesUntilOpen = 0;
            let minutesUntilClose = 0;
            let openTotal = 0;
            let closeTotal = 0;

            const preOpeningMinutes = store.config?.pre_opening_minutes || 0;
            const closingBufferMinutes = store.config?.closing_buffer_minutes || 0;

            const formatTimeMinutes = (totalMinutes: number) => {
                const normalized = (totalMinutes + 1440) % 1440;
                const h = Math.floor(normalized / 60);
                const m = normalized % 60;
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            };

            if (!todayRule.is_closed) {
                const [openH, openM] = todayRule.open_time.split(':').map(Number);
                const [closeH, closeM] = todayRule.close_time.split(':').map(Number);
                openTotal = openH * 60 + openM;
                closeTotal = closeH * 60 + closeM;
                const isOvernight = closeTotal < openTotal;
                if (!isOvernight) {
                    isInsideWindow = currentMinutes >= openTotal && currentMinutes < closeTotal;
                    minutesUntilOpen = openTotal - currentMinutes;
                    minutesUntilClose = closeTotal - currentMinutes;
                } else {
                    isInsideWindow = currentMinutes >= openTotal || currentMinutes < closeTotal;
                    if (currentMinutes >= openTotal) {
                        minutesUntilClose = (closeTotal + 24 * 60) - currentMinutes;
                        minutesUntilOpen = 0;
                    } else {
                        minutesUntilClose = closeTotal - currentMinutes;
                        minutesUntilOpen = openTotal - currentMinutes;
                    }
                }
            }

            if (!isInsideWindow && minutesUntilOpen > 0 && minutesUntilOpen <= preOpeningMinutes) {
                setStoreStatus({ isOpen: false, canOrder: true, message: `⏳ Recebendo pedidos! Abrimos em ${minutesUntilOpen} min.`, isClosingSoon: false });
                return;
            }

            if (!isInsideWindow) {
                let msg = "🔴 Loja Fechada";
                if (currentMinutes < openTotal && !todayRule.is_closed) {
                    msg = `🔴 Loja Fechada. Reabriremos hoje às ${todayRule.open_time.slice(0, 5)}.`;
                } else {
                    msg = "🔴 Loja Fechada. Estamos esperando seu pedido 😀😀";
                }
                setStoreStatus({ isOpen: false, canOrder: false, message: msg, isClosingSoon: false });
                return;
            }

            const cutoffTotal = closeTotal - closingBufferMinutes;
            const cutoffTimeStr = formatTimeMinutes(cutoffTotal);

            if (minutesUntilClose <= closingBufferMinutes) {
                setStoreStatus({ isOpen: true, canOrder: false, message: `⚠️ Pedidos encerrados. Funcionamos até as ${todayRule.close_time.slice(0, 5)}.`, isClosingSoon: true });
                return;
            }

            const minutesUntilCutoff = minutesUntilClose - closingBufferMinutes;
            if (minutesUntilCutoff <= 60 && minutesUntilCutoff > 0) {
                setStoreStatus({ isOpen: true, canOrder: true, message: `⚠️ Pedidos aceitos somente até às ${cutoffTimeStr}.`, isClosingSoon: true });
            } else {
                setStoreStatus({ isOpen: true, canOrder: true, message: null, isClosingSoon: false });
            }
        };
        checkStatus();
        const timer = setInterval(checkStatus, 30000);
        return () => clearInterval(timer);
    }, [store, storeHours, storeExceptions]);

    /*     const getProductWhatsappUrl = (product: Product) => {
            if (!store || !whatsappEnabled) return '';
    
            const message = [
                `Olá! Vim pelo cardápio online da ${store.name}.`,
                '',
                `Tenho interesse neste item:`,
                `• ${product.name}`,
                `• Valor: R$ ${Number(product.price || 0).toFixed(2).replace('.', ',')}`,
                '',
                `Cardápio: ${publicStoreUrl}`,
            ].join('\n');
    
            return buildWhatsappUrl(whatsappPhone, message);
        }; */

    const handleAddToCart = (product: Product, quantity = 1) => {
        addToCart(product, quantity);
    };

    const resetLoginForm = () => {
        setLoginStep('password_login');
        setLoginPhone('');
        setLoginOtp('');
        setLoginPassword('');
        setLoginNickname('');
        setLoginBirthDate('');
        setLoginError('');
        setLoginLoading(false);
    };

    const handleDecreaseCartItem = (productId: string, currentQuantity: number) => {
        const nextQuantity = currentQuantity - 1;

        if (nextQuantity <= 0) {
            removeFromCart(productId);
            return;
        }

        updateQuantity(productId, nextQuantity);
    };

    const handleIncreaseCartItem = (productId: string, currentQuantity: number) => {
        updateQuantity(productId, currentQuantity + 1);
    };

    const handleRemoveCartItem = (productId: string) => {
        removeFromCart(productId);
    };

    const handleClearCart = () => {
        clearCart();
        setOrderError(null);
        setOrderSuccess(null);
    };

    const handleSelectDeliveryMethod = (method: PublicDeliveryMethod) => {
        if (isQrTableMode && method.code !== 'qr_table') {
            return;
        }

        setSelectedDeliveryMethodCode(method.code);

        if (method.fulfillment_type === 'delivery') {
            setFulfillmentType('delivery');
            return;
        }

        if (method.fulfillment_type === 'qr_table') {
            setFulfillmentType('qr_table');
            return;
        }

        setFulfillmentType('pickup');
    };

    /*     async function fetchCatalogData(id: string) {
            try {
                setLoadingProducts(true);
                const { data: catData } = await supabase.from('categories').select('*').eq('store_id', id).eq('active', true).order('sort_order', { ascending: true });
                if (catData) {
                    const normalizedCategories = catData.map((cat: any) => ({ ...cat, price_rules: typeof cat.price_rules === 'string' ? JSON.parse(cat.price_rules) : (cat.price_rules || []) }));
                    setCategories(normalizedCategories);
                    setCategoryRules(normalizedCategories);
                }
                const { data: prodData } = await supabase.from('products').select('*').eq('store_id', id).eq('active', true).order('created_at', { ascending: false });
                if (prodData) {
                    const parsedProducts = prodData.map((p: any) => {
                        let parsedImages = p.images;
                        if (typeof p.images === 'string') {
                            try { parsedImages = p.images.startsWith('{') ? p.images.replace(/^{|}$/g, '').split(',') : JSON.parse(p.images); } catch (e) { parsedImages = []; }
                        }
                        return { ...p, images: Array.isArray(parsedImages) ? parsedImages : [] };
                    });
                    setProducts(parsedProducts);
                }
            } catch (error) { console.error('Error fetching data:', error); } finally { setLoadingProducts(false); }
        } */

    const pendingTasks = useMemo(() => {
        const tasks = [];
        if (customer) {
            const isDataComplete = !(!customer.full_name || !customer.cpf || !customer.email || !customer.birth_date);
            if (!isDataComplete) tasks.push({ id: 'data', label: 'Completar Dados Pessoais', tab: 'data' });
            if (customerAddresses.length === 0) tasks.push({ id: 'address', label: 'Cadastrar Endereço', tab: 'address' });
            if (isDataComplete && customerAddresses.length > 0 && store?.config?.loyalty_active && !customer.loyalty_opt_in) {
                tasks.push({ id: 'loyalty', label: 'Participe do Clube de Pontos', tab: 'loyalty' });
            }
        }
        return tasks;
    }, [customer, customerAddresses, store]);

    const publicStoreUrl =
        typeof window !== 'undefined'
            ? `${window.location.origin}/loja/${storeSlug}`
            : `/loja/${storeSlug}`;

    const whatsappPhone =
        store?.whatsapp?.digits ||
        store?.contacts?.whatsapp_business ||
        store?.phone_number ||
        '';

    const whatsappEnabled = canOpenWhatsapp(whatsappPhone);

    const whatsappMessage = store
        ? [
            `Olá! Vim pelo cardápio online da ${store.name}.`,
            '',
            `Gostaria de fazer um pedido ou tirar uma dúvida.`,
            '',
            `Cardápio: ${publicStoreUrl}`,
        ].join('\n')
        : '';

    const whatsappUrl =
        whatsappEnabled && store
            ? buildWhatsappUrl(whatsappPhone, whatsappMessage)
            : '';

    const handleLoginPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');
        try {
            if (!store?.id) throw new Error('ID da loja faltando');
            await AuthService.loginWithPassword(loginPhone, loginPassword.toLowerCase(), store.id);
            setShowLoginModal(false);
            resetLoginForm();
        } catch (err: any) { setLoginError(err.message); } finally { setLoginLoading(false); }
    };

    const handleRegisterFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');
        try {
            if (!store?.id) throw new Error('ID da loja faltando');
            const status = await AuthService.checkStatus(loginPhone, store.id);
            if (status.exists) { setLoginError('Telefone já cadastrado.'); return; }
            await AuthService.sendOtp(loginPhone, store.id);
            setLoginStep('otp');
        } catch (err: any) { setLoginError(err.message); } finally { setLoginLoading(false); }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');
        try {
            if (!store?.id) throw new Error('ID da loja faltando');
            const res = await AuthService.verifyOtp(loginPhone, loginOtp, store.id);
            if (res.isNewUser) {
                await AuthService.registerUser({
                    phone: loginPhone.replace(/\D/g, ''),
                    storeId: store.id,
                    storeName: store.name,
                    nickname: loginNickname,
                    marketingConsent: true,
                    contactPreference: 'whatsapp',
                    birthDate: loginBirthDate,
                    loyaltyOptIn: false
                });
                setLoginStep('welcome_new');
            } else {
                setShowLoginModal(false); resetLoginForm();
            }
        } catch (err: any) { setLoginError(err.message); } finally { setLoginLoading(false); }
    };

    const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const filteredProducts = products.filter(product => {
        const matchesSearch = normalizeStr(product.name).includes(normalizeStr(searchTerm));
        const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
        return matchesSearch && matchesCategory;
    }).sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

    if (loadingStore) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
                <Loader2 className="animate-spin h-12 w-12 text-[#19A999]" />
            </div>
        );
    }

    if (!store) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold">Loja não encontrada</h1>
                <p className="text-gray-500">A loja "{storeSlug}" não existe ou está desativada.</p>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-20"
            style={{ backgroundColor: store.config?.visual_color_secondary }}
        >
            {orderSuccess && (
                <div className="fixed inset-x-4 top-5 z-[120] mx-auto max-w-lg animate-fadeIn">
                    <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl dark:border-emerald-800 dark:bg-slate-900">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✓</div>
                            <div className="min-w-0 flex-1">
                                <p className="font-black text-emerald-800 dark:text-emerald-200">Pedido enviado com sucesso!</p>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Pedido {compactPublicOrderCode(orderSuccess.order_code)} encaminhado para a loja.</p>
                                <a href={orderSuccess.tracking_url} className="mt-2 inline-flex text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">Acompanhar pedido</a>
                            </div>
                            <button type="button" onClick={() => setOrderSuccess(null)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">×</button>
                        </div>
                    </div>
                </div>
            )}

            {!storeStatus.isOpen && (
                <div className={`p-3 text-center text-white font-bold shadow-md sticky top-0 z-[60] animate-fadeIn ${storeStatus.canOrder ? 'bg-blue-600' : 'bg-red-600'}`}>
                    {storeStatus.message || "Loja Fechada"}
                </div>
            )}
            {storeStatus.isOpen && storeStatus.isClosingSoon && (
                <div className="bg-yellow-400 text-gray-900 font-bold p-2 text-sm text-center sticky top-0 z-[60] animate-pulse">
                    {storeStatus.message || "A loja fechará em breve!"}
                </div>
            )}

            <header
                className="p-4 sticky top-0 z-40 shadow-sm border-b border-black/5"
                style={{ backgroundColor: store.config?.visual_color_primary || '#00D65F' }}
            >
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {store.config?.visual_icon_url && (
                            <div className="w-12 h-12 bg-white rounded-full overflow-hidden border-2 border-white/20">
                                <img src={store.config.visual_icon_url} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div>
                            <h1 className="font-black text-xl italic uppercase" style={{ color: store.config?.visual_color_text || '#ffffff' }}>
                                {store.name}
                            </h1>
                            {store.config?.visual_slogan && (
                                <p className="text-xs opacity-90" style={{ color: store.config?.visual_color_text || '#ffffff' }}>
                                    {store.config.visual_slogan}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isAuthenticated && (
                            <>
                                <div className="relative">
                                    <button onClick={() => { setShowTasks(!showTasks); setShowNotifications(false); }} className="bg-white/20 p-2 rounded-full text-white"><Bell size={20} /></button>
                                    {pendingTasks.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">!</span>}
                                </div>
                                <div className="relative">
                                    <button onClick={() => { setShowNotifications(!showNotifications); setShowTasks(false); }} className="bg-white/20 p-2 rounded-full text-white"><Mail size={20} /></button>
                                    {unreadCount > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                                </div>
                            </>
                        )}
                        {isAuthenticated ? (
                            <div className="flex items-center gap-2 bg-white/20 rounded-full p-1 pl-3 pr-1 text-white cursor-pointer" onClick={() => setShowCompleteProfileModal(true)}>
                                <span className="text-xs font-bold">Olá, {customer?.nickname}</span>
                                <button onClick={(e) => { e.stopPropagation(); logout(); }} className="w-7 h-7 bg-white rounded-full text-red-500 flex items-center justify-center"><LogOut size={14} /></button>
                            </div>
                        ) : (
                            <button onClick={() => setShowLoginModal(true)} className="bg-white/20 p-2 rounded-full text-white flex items-center gap-2 px-4"><User size={20} /> <span className="text-xs font-bold hidden md:inline">ENTRAR</span></button>
                        )}
                        <button onClick={() => { document.documentElement.classList.toggle('dark'); setIsDark(!isDark); }} className="bg-white/20 p-2 rounded-full text-white"><ThemeToggleIcon /></button>
                    </div>
                </div>
            </header>

            {store.config?.visual_banner_url && (
                <div className="max-w-5xl mx-auto mt-4 px-4 overflow-hidden">
                    <img src={store.config.visual_banner_url} alt="Banner" className="w-full h-40 md:h-64 object-cover rounded-2xl shadow-sm" />
                </div>
            )}

            {store && (
                <div className="max-w-5xl mx-auto mt-4 px-4">
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 shadow-sm dark:border-green-900/40 dark:bg-green-950/30">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-green-950 dark:text-green-100">
                                    Atendimento pelo WhatsApp
                                </p>
                                <p className="mt-1 text-sm text-green-800 dark:text-green-200">
                                    Chame a loja para tirar dúvidas ou iniciar seu pedido.
                                </p>
                            </div>

                            {whatsappEnabled ? (
                                <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                                >
                                    Chamar no WhatsApp
                                </a>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center justify-center rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                >
                                    WhatsApp indisponível
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {store && (
                <div className="max-w-5xl mx-auto mt-4 px-4">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex-1">
                                <p className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                    {store.name} Fidelidade
                                </p>

                                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                                    Consulte seus pontos pelo WhatsApp cadastrado.
                                </p>

                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    <input
                                        value={loyaltyPhone}
                                        onChange={(event) => setLoyaltyPhone(event.target.value)}
                                        placeholder="Seu WhatsApp"
                                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-amber-900/60 dark:bg-gray-950 dark:text-white"
                                    />

                                    <button
                                        type="button"
                                        onClick={handleCheckLoyalty}
                                        disabled={loyaltyLoading || loyaltyPhone.trim().length < 8}
                                        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {loyaltyLoading ? 'Consultando...' : 'Ver pontos'}
                                    </button>
                                </div>

                                {loyaltyData && loyaltyCustomerName && (
                                    <div className="mt-3">
                                        <label className="mb-1 block text-xs font-bold uppercase text-amber-800 dark:text-amber-200">
                                            Cliente encontrado
                                        </label>

                                        <input
                                            value={loyaltyCustomerName}
                                            readOnly
                                            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-950 outline-none dark:border-amber-900/60 dark:bg-gray-950 dark:text-amber-100"
                                        />
                                    </div>
                                )}
                            </div>

                            {loyaltyData && (
                                <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm dark:bg-gray-950 lg:min-w-40">
                                    <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                        Seus pontos
                                    </p>

                                    <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300">
                                        {loyaltyData.points}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                        Nível: {loyaltyData.current_tier?.name || 'Bronze'}
                                    </p>

                                    {loyaltyData.next_tier && (
                                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                            Faltam {loyaltyData.next_tier.points_to_next_tier} pontos para{' '}
                                            {loyaltyData.next_tier.name}.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {loyaltyError && (
                            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
                                {loyaltyError}
                            </p>
                        )}

                        {loyaltyResult?.found === false && (
                            <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-amber-800 dark:bg-gray-950 dark:text-amber-100">
                                {loyaltyNotFoundMessage}
                            </p>
                        )}

                        {recentLoyaltyTransactions.length > 0 && (
                            <div className="mt-3 rounded-xl bg-white p-3 text-sm dark:bg-gray-950">
                                <p className="mb-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                                    Últimos movimentos
                                </p>

                                <div className="space-y-2">
                                    {recentLoyaltyTransactions.slice(0, 3).map((transaction) => (
                                        <div
                                            key={transaction.id}
                                            className="flex items-center justify-between gap-3 text-xs"
                                        >
                                            <span className="text-gray-600 dark:text-gray-300">
                                                {transaction.description || transaction.type}
                                            </span>

                                            <span className="font-bold text-emerald-600 dark:text-emerald-300">
                                                +{transaction.points} pts
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isQrTableMode && tableCode && (
                <div className="max-w-5xl mx-auto mt-4 px-4">
                    <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 shadow-sm dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-100">
                        Você está fazendo um pedido para a mesa/comanda <strong>{tableCode}</strong>.
                    </div>
                </div>
            )}

            {Number(store.minimum_order_value || 0) > 0 && (
                <div className="max-w-5xl mx-auto mt-4 px-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                        Pedido mínimo: <strong>R$ {Number(store.minimum_order_value).toFixed(2).replace('.', ',')}</strong>
                    </div>
                </div>
            )}

            {store && cartItems.length > 0 && (
                <div className="max-w-5xl mx-auto mt-4 px-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                    Seu carrinho
                                </p>
                                {isQrTableMode && tableCode && (
                                    <div className="mt-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-100">
                                        Pedido da mesa/comanda: <strong>{tableCode}</strong>
                                    </div>
                                )}
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {cartItems.length} item(ns) • Total R$ {cartTotalWithDelivery.toFixed(2).replace('.', ',')}
                                </p>
                                {selectedDeliveryFee > 0 && (
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Subtotal R$ {cartSubtotal.toFixed(2).replace('.', ',')} + entrega R$ {selectedDeliveryFee.toFixed(2).replace('.', ',')}
                                    </p>
                                )}
                            </div>

                            {selectedDeliveryMinimum > 0 && (
                                <div className={`rounded-xl px-3 py-2 text-sm ${isBelowSelectedDeliveryMinimum
                                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
                                    }`}>
                                    Pedido mínimo para {selectedDeliveryMethod?.name || 'entrega'}: R$ {selectedDeliveryMinimum.toFixed(2).replace('.', ',')}
                                </div>
                            )}
                        </div>

                        {deliveryMethods.length > 0 && (
                            <div className="mt-4">
                                <p className="mb-2 text-sm font-bold text-gray-900 dark:text-white">
                                    Forma de entrega
                                </p>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {deliveryMethods
                                        .filter((method) => !isQrTableMode || method.code === 'qr_table')
                                        .map((method) => {
                                            const fee = Number(method.delivery_fee || 0);
                                            const minimum = Number(method.minimum_order_value || 0);

                                            return (
                                                <label
                                                    key={method.code}
                                                    className={`cursor-pointer rounded-xl border p-3 text-sm transition ${selectedDeliveryMethodCode === method.code
                                                        ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100'
                                                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="delivery_method"
                                                        value={method.code}
                                                        checked={selectedDeliveryMethodCode === method.code}
                                                        onChange={() => handleSelectDeliveryMethod(method)}
                                                        className="mr-2"
                                                    />

                                                    <span className="font-semibold">{method.name}</span>

                                                    {minimum > 0 && (
                                                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                                                            mín. R$ {minimum.toFixed(2).replace('.', ',')}
                                                        </span>
                                                    )}

                                                    {fee > 0 && (
                                                        <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                                                            taxa R$ {fee.toFixed(2).replace('.', ',')}
                                                        </span>
                                                    )}

                                                    {method.description && (
                                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            {method.description}
                                                        </p>
                                                    )}

                                                    {(method.estimated_minutes_min || method.estimated_minutes_max) && (
                                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            Estimativa: {method.estimated_minutes_min || '?'}–
                                                            {method.estimated_minutes_max || '?'} min
                                                        </p>
                                                    )}
                                                </label>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        <div className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-gray-50 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-950/40">
                            {cartItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                                            {item.name}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            R$ {Number(item.price || 0).toFixed(2).replace('.', ',')} cada
                                        </p>
                                        <p className="mt-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            Subtotal: R$ {(Number(item.price || 0) * item.quantity).toFixed(2).replace('.', ',')}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                                        <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                                            <button
                                                type="button"
                                                onClick={() => handleDecreaseCartItem(item.id, item.quantity)}
                                                className="px-3 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                                aria-label={`Diminuir quantidade de ${item.name}`}
                                            >
                                                −
                                            </button>

                                            <span className="min-w-10 px-3 py-2 text-center text-sm font-bold text-gray-900 dark:text-white">
                                                {item.quantity}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() => handleIncreaseCartItem(item.id, item.quantity)}
                                                className="px-3 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                                aria-label={`Aumentar quantidade de ${item.name}`}
                                            >
                                                +
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleRemoveCartItem(item.id)}
                                            className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                                        >
                                            Remover
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-3 flex justify-end">
                            <button
                                type="button"
                                onClick={handleClearCart}
                                className="text-sm font-semibold text-gray-500 underline-offset-4 hover:text-red-600 hover:underline dark:text-gray-400 dark:hover:text-red-300"
                            >
                                Limpar carrinho
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <input
                                value={customerName}
                                onChange={(event) => setCustomerName(event.target.value)}
                                placeholder="Seu nome"
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                            />

                            <input
                                value={customerPhone}
                                onChange={(event) => setCustomerPhone(event.target.value)}
                                placeholder="Seu WhatsApp"
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                            />
                        </div>

                        {paymentMethods.length > 0 && (
                            <div className="mt-4">
                                <p className="mb-2 text-sm font-bold text-gray-900 dark:text-white">
                                    Forma de pagamento
                                </p>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {paymentMethods.map((method) => (
                                        <label
                                            key={method.code}
                                            className={`cursor-pointer rounded-xl border p-3 text-sm transition ${selectedPaymentMethodCode === method.code
                                                ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100'
                                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="payment_method"
                                                value={method.code}
                                                checked={selectedPaymentMethodCode === method.code}
                                                onChange={() => setSelectedPaymentMethodCode(method.code)}
                                                className="mr-2"
                                            />

                                            <span className="font-semibold">{method.name}</span>

                                            {method.requires_proof && (
                                                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                                                    comprovante
                                                </span>
                                            )}

                                            {method.requires_change_for && (
                                                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-200">
                                                    troco
                                                </span>
                                            )}

                                            {method.description && (
                                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                    {method.description}
                                                </p>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {fulfillmentType === 'delivery' && (
                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <input
                                    value={deliveryAddress.street}
                                    onChange={(event) =>
                                        setDeliveryAddress((prev) => ({ ...prev, street: event.target.value }))
                                    }
                                    placeholder="Rua"
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                                />

                                <input
                                    value={deliveryAddress.number}
                                    onChange={(event) =>
                                        setDeliveryAddress((prev) => ({ ...prev, number: event.target.value }))
                                    }
                                    placeholder="Número"
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                                />

                                <input
                                    value={deliveryAddress.district}
                                    onChange={(event) =>
                                        setDeliveryAddress((prev) => ({ ...prev, district: event.target.value }))
                                    }
                                    placeholder="Bairro"
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                                />

                                <input
                                    value={deliveryAddress.complement}
                                    onChange={(event) =>
                                        setDeliveryAddress((prev) => ({ ...prev, complement: event.target.value }))
                                    }
                                    placeholder="Complemento"
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                                />

                                <input
                                    value={deliveryAddress.reference}
                                    onChange={(event) =>
                                        setDeliveryAddress((prev) => ({ ...prev, reference: event.target.value }))
                                    }
                                    placeholder="Referência"
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 sm:col-span-2"
                                />
                            </div>
                        )}

                        {orderError && (
                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
                                {orderError}
                            </div>
                        )}

                        {orderSuccess && (
                            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                                Pedido {orderSuccess.order_code} criado com sucesso. Total R$ {orderSuccess.total.toFixed(2).replace('.', ',')}.
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleCreatePublicOrder}
                            disabled={orderLoading || isBelowSelectedDeliveryMinimum}
                            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {orderLoading ? 'Criando pedido...' : 'Finalizar pelo WhatsApp'}
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto mt-4 px-4">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
                    Cardápio público em modo de visualização. Em breve você poderá montar o pedido por aqui e finalizar pelo WhatsApp.
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-4 mt-8">
                <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Qual sabor você busca?"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-4 pl-12 pr-10 rounded-2xl border-none shadow-md outline-none bg-white dark:bg-slate-800"
                        />
                        <Search className="absolute left-4 top-4 text-gray-400 w-5 h-5" />
                    </div>
                    <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-md"><Search /></button>
                </div>

                {categories.length > 0 && (
                    <section className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-4">
                        <button onClick={() => setSelectedCategory('all')} className={`${selectedCategory === 'all' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 dark:bg-slate-800 dark:text-gray-200'} px-6 py-2 rounded-full shadow-md whitespace-nowrap`}>Tudo</button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`${selectedCategory === cat.id ? 'bg-green-600 text-white' : 'bg-white text-gray-700 dark:bg-slate-800 dark:text-gray-200'} px-6 py-2 rounded-full shadow-sm whitespace-nowrap`}>{cat.name}</button>
                        ))}
                    </section>
                )}

                {loadingProducts ? <Loader2 className="animate-spin mx-auto mt-10" /> : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {filteredProducts.map(p => (
                            <ProductCard key={p.id} product={p} onOpenDetails={() => { setSelectedProduct(p); setIsProductModalOpen(true); }} onAddToCart={handleAddToCart} />
                        ))}
                    </div>
                )}
            </main>

            {/* <CartDrawer store={store as any} isOrderingAllowed={storeStatus.canOrder} /> */}
            <ProductModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} product={selectedProduct} onAddToCart={handleAddToCart} />

            {showLoginModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 relative">
                        <button onClick={() => { setShowLoginModal(false); resetLoginForm(); }} className="absolute top-3 right-3 p-2 bg-gray-100 rounded-full"><X size={16} /></button>
                        <h2 className="text-xl font-bold mb-4">{loginStep === 'password_login' ? 'Bem-vindo de volta' : 'Nova Conta'}</h2>
                        {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{loginError}</div>}

                        {loginStep === 'password_login' && (
                            <form onSubmit={handleLoginPassword} className="space-y-4">
                                <input type="tel" placeholder="Telefone" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl" required />
                                <input type="password" placeholder="Senha" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl" required />
                                <button type="submit" disabled={loginLoading} className="w-full bg-[#f85e33] text-white py-3 rounded-xl font-bold">{loginLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Entrar'}</button>
                                <button type="button" onClick={() => setLoginStep('register_form')} className="w-full text-green-600 font-bold">Criar uma conta</button>
                            </form>
                        )}

                        {loginStep === 'register_form' && (
                            <form onSubmit={handleRegisterFormSubmit} className="space-y-4">
                                <input type="text" placeholder="Nome" value={loginNickname} onChange={(e) => setLoginNickname(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl" required />
                                <input type="tel" placeholder="Telefone" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl" required />
                                <input type="date" placeholder="Nascimento" value={loginBirthDate} onChange={(e) => setLoginBirthDate(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl" required />
                                <button type="submit" disabled={loginLoading} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold">Continuar</button>
                            </form>
                        )}

                        {loginStep === 'otp' && (
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <p className="text-sm text-center">Digite o código enviado para {loginPhone}</p>
                                <input type="text" maxLength={6} value={loginOtp} onChange={(e) => setLoginOtp(e.target.value)} className="w-full p-3 text-center text-2xl font-bold bg-gray-50 rounded-xl" required />
                                <button type="submit" disabled={loginLoading} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold">Validar</button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {showCompleteProfileModal && (
                <CustomerProfile
                    onClose={() => setShowCompleteProfileModal(false)}
                    storeConfig={store?.config}
                    storeId={store?.id}
                    initialTab={profileInitialTab as any}
                    onUpdate={refreshCustomerData}
                />
            )}
        </div>
    );
}
