import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { CartItem, Category, Product, StoreConfig } from '@/types';
import { ProductCard } from '@/pages/store/ProductCard';
import { ProductModal } from '@/pages/store/ProductModal';
import { PublicStoreHero } from '@/pages/store/components/PublicStoreHero';
import { useCartStore } from '@/store/useCartStore';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { AuthService } from '@/services/customerAuth';
import { CustomerService } from '@/services/customerService';
import CustomerProfile from '@/pages/store/components/CustomerProfile';
import {
    PublicStorefrontService,
    type PublicDeliveryMethod,
} from '@/services/publicStorefrontService';
import { timezoneUtils } from '@/utils/timezoneUtils';
import { formatBRL } from '@/utils/pricing';
import {
    AlertCircle,
    ArrowUp,
    BadgePercent,
    ChevronDown,
    Gift,
    Loader2,
    Layers3,
    LogOut,
    Moon,
    Search,
    Sun,
    Truck,
    User,
    X,
} from 'lucide-react';

interface Store {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    phone_number?: string;
    reservation_time_minutes?: number;
    public_catalog_enabled?: boolean;
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

// Customer authentication is intentionally fail-closed until the server-side
// password + OTP flow can issue a verified customer JWT. Guest storefront and
// checkout remain available independently.
const CUSTOMER_PORTAL_AUTH_ENABLED = false;

function normalizeText(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isProductUnavailable(product: Product) {
    return product.public_availability?.status === 'unavailable'
        || Number(product.stock_quantity ?? 0) <= 0;
}

function sharedCartIntentFingerprint(input: {
    context?: { storeId?: string; type?: string; tableCode?: string } | null;
    fulfillmentType?: string | null;
    deliveryMethodCode?: string | null;
    items?: Array<{ id?: string; quantity?: number }>;
}) {
    const lines = (Array.isArray(input.items) ? input.items : [])
        .map((item) => ({
            id: String(item.id || ''),
            quantity: Math.max(0, Math.trunc(Number(item.quantity || 0))),
        }))
        .filter((item) => item.id && item.quantity > 0)
        .sort((left, right) => left.id.localeCompare(right.id));

    return JSON.stringify({
        storeId: input.context?.storeId || null,
        type: input.context?.type || null,
        tableCode: input.context?.tableCode || null,
        fulfillmentType: input.fulfillmentType || null,
        deliveryMethodCode: input.deliveryMethodCode || null,
        lines,
    });
}

export default function Catalog() {
    const { storeSlug, tableCode } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const isQrTableMode = Boolean(tableCode);

    const {
        items: cartItems,
        context: cartContext,
        fulfillmentType: cartFulfillmentType,
        deliveryMethodCode: cartDeliveryMethodCode,
        addToCart,
        bindContext,
        setFulfillment,
        syncCatalogPricing,
    } = useCartStore();

    const { isAuthenticated, customer } = useCustomerAuth();

    const [store, setStore] = useState<Store | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryMethods, setDeliveryMethods] = useState<PublicDeliveryMethod[]>([]);
    const [loadingStore, setLoadingStore] = useState(true);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [showCategoryPanel, setShowCategoryPanel] = useState(false);
    const [infoModal, setInfoModal] = useState<'pricing' | 'delivery' | 'loyalty' | null>(null);
    const sharedCartLoadedKeyRef = useRef<string | null>(null);
    const sharedCartRemoteRevisionRef = useRef(0);
    const sharedCartLastSyncedFingerprintRef = useRef('');
    const sharedCartSaveChainRef = useRef<Promise<void>>(Promise.resolve());
    const sharedCartPendingWritesRef = useRef(0);

    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showCompleteProfileModal, setShowCompleteProfileModal] = useState(false);
    const [loginStep, setLoginStep] = useState<'password_login' | 'register_form' | 'otp'>('password_login');
    const [loginPhone, setLoginPhone] = useState('');
    const [loginOtp, setLoginOtp] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginNickname, setLoginNickname] = useState('');
    const [loginBirthDate, setLoginBirthDate] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    const [storeHours, setStoreHours] = useState<Array<{
        day_of_week: number;
        open_time: string | null;
        close_time: string | null;
        is_closed: boolean;
    }>>([]);
    const [storeStatus, setStoreStatus] = useState<{
        isOpen: boolean;
        canOrder: boolean;
        message: string | null;
        isClosingSoon: boolean;
    }>({ isOpen: true, canOrder: true, message: null, isClosingSoon: false });

    useEffect(() => {
        const handleScroll = () => setShowBackToTop(window.scrollY > 360);
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const focusSearch = () => {
            searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            window.setTimeout(() => searchInputRef.current?.focus(), 250);
        };

        window.addEventListener('optmamenu:focus-store-search', focusSearch);
        return () => window.removeEventListener('optmamenu:focus-store-search', focusSearch);
    }, []);

    useEffect(() => {
        if (!showCategoryPanel && !infoModal) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setShowCategoryPanel(false);
            setInfoModal(null);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [infoModal, showCategoryPanel]);

    const applyCatalog = useCallback((catalog: Awaited<ReturnType<typeof PublicStorefrontService.getCatalogBySlug>>) => {
        if (!catalog.ok || !catalog.catalog_enabled) {
            setCategories([]);
            setProducts([]);
            syncCatalogPricing([], []);
            return;
        }

        const normalizedCategories = catalog.categories || [];
        const normalizedProducts = normalizedCategories.flatMap((category) =>
            (category.products || []).map((product) => ({
                ...product,
                category_id: product.category_id || category.id,
            })),
        );

        setCategories(normalizedCategories);
        setProducts(normalizedProducts);
        syncCatalogPricing(normalizedCategories, normalizedProducts);
    }, [syncCatalogPricing]);

    const refreshCatalog = useCallback(async () => {
        if (!storeSlug) return;
        try {
            const catalog = await PublicStorefrontService.getCatalogBySlug(storeSlug);
            applyCatalog(catalog);
        } catch (error) {
            console.error('Erro ao atualizar catálogo público:', error);
        }
    }, [applyCatalog, storeSlug]);

    useEffect(() => {
        async function loadStorefront() {
            if (!storeSlug) return;

            setLoadingStore(true);
            setLoadingProducts(true);

            try {
                const storefront = await PublicStorefrontService.getStorefrontBySlug(storeSlug);
                if (!storefront.ok || !storefront.store) {
                    setStore(null);
                    setProducts([]);
                    setCategories([]);
                    return;
                }

                const mappedStore = PublicStorefrontService.toCatalogStore(storefront.store);
                setStore(mappedStore);
                setStoreHours(storefront.store.hours || []);

                bindContext({
                    storeId: mappedStore.id,
                    requestedSlug: storeSlug,
                    canonicalSlug: mappedStore.slug || storeSlug,
                    type: isQrTableMode ? 'table' : 'remote',
                    tableCode: isQrTableMode ? tableCode : undefined,
                });

                setFulfillment(
                    isQrTableMode ? 'table' : 'pickup',
                    isQrTableMode ? 'qr_table' : 'pickup',
                );

                const [catalog, delivery] = await Promise.all([
                    PublicStorefrontService.getCatalogBySlug(storeSlug),
                    PublicStorefrontService.getPublicDeliveryMethodsBySlug(storeSlug),
                ]);

                applyCatalog(catalog);

                setDeliveryMethods(delivery.ok ? delivery.delivery_methods || [] : []);
            } catch (error) {
                console.error('Erro ao carregar loja pública:', error);
                setStore(null);
                setCategories([]);
                setProducts([]);
                setDeliveryMethods([]);
            } finally {
                setLoadingStore(false);
                setLoadingProducts(false);
            }
        }

        loadStorefront();
    }, [applyCatalog, bindContext, isQrTableMode, setFulfillment, storeSlug, tableCode]);

    useEffect(() => {
        if (!store?.id || !customer?.id || !isAuthenticated) {
            sharedCartLoadedKeyRef.current = null;
            sharedCartRemoteRevisionRef.current = 0;
            sharedCartLastSyncedFingerprintRef.current = '';
            sharedCartPendingWritesRef.current = 0;
            return;
        }

        const syncKey = `${customer.id}:${store.id}`;
        if (sharedCartLoadedKeyRef.current === syncKey) return;

        let cancelled = false;

        const restoreSharedCart = async () => {
            try {
                const remote = await CustomerService.getSelfCartDraft();
                if (cancelled) return;

                const remoteCart = remote.cart as {
                    context?: { storeId?: string } | null;
                    fulfillmentType?: 'pickup' | 'delivery' | 'table' | null;
                    deliveryMethodCode?: string | null;
                    items?: CartItem[];
                    cleared?: boolean;
                };

                const remoteRevision = Number(remote.revision || 0);
                if (remoteRevision > 0 || remote.updatedAt) {
                    sharedCartRemoteRevisionRef.current = remoteRevision;
                    const remoteItems = Array.isArray(remoteCart.items) ? remoteCart.items : [];
                    const current = useCartStore.getState();

                    const restoredState = {
                        context: current.context,
                        items: remoteCart.cleared ? [] : remoteItems,
                        fulfillmentType: current.fulfillmentType || remoteCart.fulfillmentType || 'pickup',
                        deliveryMethodCode: current.deliveryMethodCode || remoteCart.deliveryMethodCode || null,
                    };
                    sharedCartLastSyncedFingerprintRef.current = sharedCartIntentFingerprint(restoredState);
                    useCartStore.setState({
                        items: restoredState.items,
                        fulfillmentType: restoredState.fulfillmentType,
                        deliveryMethodCode: restoredState.deliveryMethodCode,
                    });

                    if (!remoteCart.cleared && remoteItems.length > 0) {
                        // Reidrata preço/estoque com o catálogo autoritativo atual.
                        await refreshCatalog();
                    }
                    return;
                }

                // Primeiro uso do carrinho remoto: publica o estado local autenticado.
                const current = useCartStore.getState();
                if (current.context?.storeId === store.id) {
                    const result = await CustomerService.saveSelfCartDraft({
                        schemaVersion: current.schemaVersion,
                        context: current.context,
                        fulfillmentType: current.fulfillmentType,
                        deliveryMethodCode: current.deliveryMethodCode,
                        items: current.items,
                    });
                    const savedRevision = Number(result?.revision || 0);
                    if (savedRevision > 0) {
                        sharedCartRemoteRevisionRef.current = savedRevision;
                        sharedCartLastSyncedFingerprintRef.current = sharedCartIntentFingerprint(current);
                    }
                }
            } catch (error) {
                console.warn('[CART_SYNC] Não foi possível recuperar o carrinho compartilhado:', error);
            } finally {
                if (!cancelled) sharedCartLoadedKeyRef.current = syncKey;
            }
        };

        void restoreSharedCart();

        return () => {
            cancelled = true;
        };
    }, [customer?.id, isAuthenticated, refreshCatalog, store?.id]);

    useEffect(() => {
        if (!store?.id || !customer?.id || !isAuthenticated) return;

        const syncKey = `${customer.id}:${store.id}`;
        if (sharedCartLoadedKeyRef.current !== syncKey) return;
        if (cartContext?.storeId !== store.id) return;

        const current = useCartStore.getState();
        const currentFingerprint = sharedCartIntentFingerprint(current);
        if (currentFingerprint === sharedCartLastSyncedFingerprintRef.current) return;

        const timer = window.setTimeout(() => {
            sharedCartPendingWritesRef.current += 1;
            sharedCartSaveChainRef.current = sharedCartSaveChainRef.current
                .catch(() => undefined)
                .then(async () => {
                    let attempts = 0;

                    while (attempts < 4) {
                        attempts += 1;
                        const latest = useCartStore.getState();
                        if (latest.context?.storeId !== store.id) return;

                        const latestFingerprint = sharedCartIntentFingerprint(latest);
                        if (latestFingerprint === sharedCartLastSyncedFingerprintRef.current) return;

                        const result = await CustomerService.saveSelfCartDraft({
                            schemaVersion: latest.schemaVersion,
                            context: latest.context,
                            fulfillmentType: latest.fulfillmentType,
                            deliveryMethodCode: latest.deliveryMethodCode,
                            items: latest.items,
                            syncBaseRevision: sharedCartRemoteRevisionRef.current > 0
                                ? sharedCartRemoteRevisionRef.current
                                : null,
                        });

                        const resultRevision = Number(result?.revision || 0);
                        if (resultRevision > 0) {
                            sharedCartRemoteRevisionRef.current = resultRevision;
                        }

                        if (result?.stale) {
                            // Outro dispositivo gravou primeiro. Rebaseamos a alteração local
                            // sobre a revisão mais recente em vez de restaurar o carrinho antigo.
                            continue;
                        }

                        sharedCartLastSyncedFingerprintRef.current = latestFingerprint;

                        const afterSave = useCartStore.getState();
                        if (sharedCartIntentFingerprint(afterSave) === latestFingerprint) {
                            return;
                        }
                    }

                    console.warn('[CART_SYNC] Carrinho mudou repetidamente em outros dispositivos; nova tentativa ficará para o próximo ciclo.');
                })
                .catch((error) => {
                    console.warn('[CART_SYNC] Não foi possível sincronizar o carrinho:', error);
                })
                .finally(() => {
                    sharedCartPendingWritesRef.current = Math.max(0, sharedCartPendingWritesRef.current - 1);
                });
        }, 600);

        return () => window.clearTimeout(timer);
    }, [
        cartContext,
        cartDeliveryMethodCode,
        cartFulfillmentType,
        cartItems,
        customer?.id,
        isAuthenticated,
        store?.id,
    ]);

    useEffect(() => {
        if (!store?.id || !customer?.id || !isAuthenticated) return;

        let active = true;
        const syncFromServer = async () => {
            if (document.visibilityState !== 'visible') return;

            try {
                const remote = await CustomerService.getSelfCartDraft();
                if (!active) return;

                const remoteRevision = Number(remote.revision || 0);
                if (remoteRevision <= 0 || remoteRevision <= sharedCartRemoteRevisionRef.current) {
                    return;
                }

                const current = useCartStore.getState();
                const currentFingerprint = sharedCartIntentFingerprint(current);
                const hasLocalChanges = currentFingerprint !== sharedCartLastSyncedFingerprintRef.current;
                if (sharedCartPendingWritesRef.current > 0 || hasLocalChanges) {
                    // Nunca deixa polling remoto apagar uma edição local ainda não persistida.
                    return;
                }

                const remoteCart = remote.cart as {
                    fulfillmentType?: 'pickup' | 'delivery' | 'table' | null;
                    deliveryMethodCode?: string | null;
                    items?: CartItem[];
                    cleared?: boolean;
                };

                const appliedState = {
                    context: current.context,
                    items: remoteCart.cleared
                        ? []
                        : (Array.isArray(remoteCart.items) ? remoteCart.items : []),
                    fulfillmentType: current.fulfillmentType || remoteCart.fulfillmentType || 'pickup',
                    deliveryMethodCode: current.deliveryMethodCode || remoteCart.deliveryMethodCode || null,
                };
                sharedCartRemoteRevisionRef.current = remoteRevision;
                sharedCartLastSyncedFingerprintRef.current = sharedCartIntentFingerprint(appliedState);
                useCartStore.setState({
                    items: appliedState.items,
                    fulfillmentType: appliedState.fulfillmentType,
                    deliveryMethodCode: appliedState.deliveryMethodCode,
                });

                if (!remoteCart.cleared && Array.isArray(remoteCart.items) && remoteCart.items.length > 0) {
                    await refreshCatalog();
                }
            } catch (error) {
                console.warn('[CART_SYNC] Não foi possível atualizar o carrinho de outro dispositivo:', error);
            }
        };

        const intervalId = window.setInterval(() => void syncFromServer(), 10000);
        const onFocus = () => void syncFromServer();
        const onVisibility = () => {
            if (document.visibilityState === 'visible') void syncFromServer();
        };

        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            active = false;
            window.clearInterval(intervalId);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [customer?.id, isAuthenticated, refreshCatalog, store?.id]);

    useEffect(() => {
        if (!store?.id || !storeSlug) return;

        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') void refreshCatalog();
        };

        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') void refreshCatalog();
        }, 15000);

        window.addEventListener('focus', refreshWhenVisible);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', refreshWhenVisible);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
    }, [refreshCatalog, store?.id, storeSlug]);

    useEffect(() => {
        if (!store || storeHours.length === 0) return;

        const checkStatus = () => {
            const now = timezoneUtils.getBrazilDate();
            const today = storeHours.find((hour) => hour.day_of_week === now.getDay());

            if (!today || today.is_closed || !today.open_time || !today.close_time) {
                setStoreStatus({
                    isOpen: false,
                    canOrder: false,
                    message: '🔴 Loja fechada. Estamos esperando seu pedido 😀',
                    isClosingSoon: false,
                });
                return;
            }

            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const [openHour, openMinute] = today.open_time.split(':').map(Number);
            const [closeHour, closeMinute] = today.close_time.split(':').map(Number);
            const openTotal = openHour * 60 + openMinute;
            const closeTotal = closeHour * 60 + closeMinute;
            const isOvernight = closeTotal < openTotal;
            const isInsideWindow = isOvernight
                ? currentMinutes >= openTotal || currentMinutes < closeTotal
                : currentMinutes >= openTotal && currentMinutes < closeTotal;

            if (!isInsideWindow) {
                setStoreStatus({
                    isOpen: false,
                    canOrder: false,
                    message: `🔴 Loja fechada. Abrimos às ${today.open_time.slice(0, 5)}.`,
                    isClosingSoon: false,
                });
                return;
            }

            const minutesUntilClose = isOvernight && currentMinutes >= openTotal
                ? closeTotal + 1440 - currentMinutes
                : closeTotal - currentMinutes;
            const closingBuffer = store.config?.closing_buffer_minutes || 0;

            if (closingBuffer > 0 && minutesUntilClose <= closingBuffer) {
                setStoreStatus({
                    isOpen: true,
                    canOrder: false,
                    message: `⚠️ Pedidos encerrados. Funcionamos até ${today.close_time.slice(0, 5)}.`,
                    isClosingSoon: true,
                });
                return;
            }

            setStoreStatus({
                isOpen: true,
                canOrder: true,
                message: null,
                isClosingSoon: false,
            });
        };

        checkStatus();
        const timer = window.setInterval(checkStatus, 30_000);
        return () => window.clearInterval(timer);
    }, [store, storeHours]);

    const filteredProducts = useMemo(() => {
        const normalizedSearch = normalizeText(searchTerm);

        return products
            .filter((product) => {
                const matchesSearch = normalizeText(product.name).includes(normalizedSearch);
                const matchesCategory = selectedCategory === 'all'
                    || product.category_id === selectedCategory;
                return matchesSearch && matchesCategory;
            })
            .sort((left, right) => {
                const leftUnavailable = isProductUnavailable(left);
                const rightUnavailable = isProductUnavailable(right);

                if (leftUnavailable !== rightUnavailable) {
                    return leftUnavailable ? 1 : -1;
                }

                return sortOrder === 'asc'
                    ? left.name.localeCompare(right.name, 'pt-BR')
                    : right.name.localeCompare(left.name, 'pt-BR');
            });
    }, [products, searchTerm, selectedCategory, sortOrder]);

    const primaryCategories = useMemo(() => categories.slice(0, 4), [categories]);
    const selectedCategoryIsHidden = selectedCategory !== 'all'
        && !primaryCategories.some((category) => category.id === selectedCategory);

    const deliveryMinimum = useMemo(() => {
        const values = deliveryMethods
            .filter((method) => method.fulfillment_type === 'delivery')
            .map((method) => Number(method.minimum_order_value || 0))
            .filter((value) => value > 0);

        return values.length > 0 ? Math.min(...values) : 0;
    }, [deliveryMethods]);

    const hasDelivery = useMemo(
        () => deliveryMethods.some((method) => method.fulfillment_type === 'delivery'),
        [deliveryMethods],
    );

    const hasProgressivePricing = useMemo(
        () => categories.some((category) => (
            category.price_logic_type === 'category_volume'
            || (category.price_rules?.length || 0) > 0
            || (category.pricing_group?.price_rules?.length || 0) > 0
        )) || products.some((product) => (product.price_rules?.length || 0) > 0),
        [categories, products],
    );

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

    const handleLoginPassword = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!store?.id) return;

        setLoginLoading(true);
        setLoginError('');

        try {
            await AuthService.loginWithPassword(loginPhone, loginPassword, store.id);
            setShowLoginModal(false);
            resetLoginForm();
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Não foi possível entrar.');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleRegisterFormSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!store?.id) return;

        setLoginLoading(true);
        setLoginError('');

        try {
            const status = await AuthService.checkStatus(loginPhone, store.id);
            if (status.exists) {
                setLoginError('Telefone já cadastrado.');
                return;
            }
            await AuthService.sendOtp(loginPhone, store.id);
            setLoginStep('otp');
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Não foi possível enviar o código.');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleVerifyOtp = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!store?.id) return;

        setLoginLoading(true);
        setLoginError('');

        try {
            const result = await AuthService.verifyOtp(loginPhone, loginOtp, store.id);
            if (result.isNewUser) {
                await AuthService.registerUser({
                    phone: loginPhone.replace(/\D/g, ''),
                    storeId: store.id,
                    storeName: store.name,
                    nickname: loginNickname,
                    marketingConsent: false,
                    contactPreference: 'whatsapp',
                    birthDate: loginBirthDate,
                    loyaltyOptIn: false,
                });
            }
            setShowLoginModal(false);
            resetLoginForm();
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Não foi possível validar o código.');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleCustomerLogout = async () => {
        await AuthService.logoutCustomer();
    };

    const openProduct = (product: Product) => {
        setSelectedProduct(product);
        setIsProductModalOpen(true);
    };

    const closeProduct = () => {
        setIsProductModalOpen(false);
        const params = new URLSearchParams(location.search);
        const returnTo = params.get('returnTo');
        const hadProduct = params.has('product');

        params.delete('product');
        params.delete('returnTo');

        if (hadProduct) {
            const query = params.toString();
            navigate(`${location.pathname}${query ? `?${query}` : ''}`, { replace: true });
        }

        if (returnTo === 'consumption') {
            window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent('optmamenu:open-customer-account', {
                    detail: { tab: 'consumption' },
                }));
            }, 0);
        }
    };

    useEffect(() => {
        if (loadingProducts || products.length === 0) return;
        const productId = new URLSearchParams(location.search).get('product');
        if (!productId) return;

        const product = products.find((item) => item.id === productId);
        if (!product) return;

        setSelectedProduct(product);
        setIsProductModalOpen(true);
    }, [loadingProducts, location.search, products]);

    if (loadingStore) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-[#19A999]" />
            </div>
        );
    }

    if (!store) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
                <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
                <h1 className="text-2xl font-bold">Loja não encontrada</h1>
                <p className="mt-2 text-gray-500">A loja “{storeSlug}” não existe ou está desativada.</p>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-gray-50 pb-28 transition-colors duration-300 dark:bg-slate-900"
            style={{ backgroundColor: store.config?.visual_color_secondary }}
        >
            {storeStatus.message && (
                <div
                    className={`sticky top-0 z-[60] px-4 py-3 text-center text-sm font-bold text-white shadow-md ${storeStatus.isClosingSoon ? 'bg-amber-500' : storeStatus.canOrder ? 'bg-blue-600' : 'bg-red-600'}`}
                >
                    {storeStatus.message}
                </div>
            )}

            <header
                className="sticky top-0 z-40 border-b border-black/5 px-4 py-3 shadow-sm"
                style={{ backgroundColor: store.config?.visual_color_primary || '#19A999' }}
            >
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        {(store.logo_url || store.config?.visual_icon_url) && (
                            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white/30 bg-white">
                                <img
                                    src={store.logo_url || store.config?.visual_icon_url}
                                    alt={`Logo ${store.name}`}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        )}
                        <div className="min-w-0">
                            <h1
                                className="truncate text-lg font-black sm:text-xl"
                                style={{ color: store.config?.visual_color_text || '#ffffff' }}
                            >
                                {store.name}
                            </h1>
                            {store.config?.visual_slogan && (
                                <p
                                    className="truncate text-xs opacity-90"
                                    style={{ color: store.config?.visual_color_text || '#ffffff' }}
                                >
                                    {store.config.visual_slogan}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent(
                                    isAuthenticated
                                        ? 'optmamenu:open-customer-account'
                                        : 'optmamenu:open-customer-auth',
                                    isAuthenticated ? { detail: { tab: 'profile' } } : undefined,
                                ));
                            }}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/20 px-3 text-xs font-black text-white shadow-sm transition hover:bg-white/30"
                            aria-label={isAuthenticated ? 'Abrir minha conta' : 'Entrar ou criar conta'}
                            title={isAuthenticated ? 'Minha conta' : 'Entrar'}
                        >
                            <User className="h-4 w-4" />
                            <span className="hidden sm:inline">
                                {isAuthenticated ? `Olá, ${customer?.nickname || customer?.full_name || 'cliente'}` : 'Entrar'}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                window.setTimeout(() => searchInputRef.current?.focus(), 220);
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                            aria-label="Buscar produtos"
                            title="Buscar"
                        >
                            <Search size={18} />
                        </button>

                        {isAuthenticated && (
                            <button
                                type="button"
                                onClick={() => void handleCustomerLogout()}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                                aria-label="Sair da conta"
                                title="Sair"
                            >
                                <LogOut size={17} />
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                document.documentElement.classList.toggle('dark');
                                setIsDark((current) => !current);
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
                            aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    </div>
                </div>
            </header>

            <PublicStoreHero
                storeName={store.name}
                description={store.description}
                config={store.config}
            />

            {isQrTableMode && tableCode && (
                <div className="mx-auto mt-4 max-w-5xl px-4">
                    <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 shadow-sm dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-100">
                        Pedido para a mesa/comanda <strong>{tableCode}</strong>.
                    </div>
                </div>
            )}

            {(hasProgressivePricing || hasDelivery || store.config?.loyalty_active) && (
            <section
                aria-label="Informações da loja"
                className="mx-auto mt-5 flex max-w-5xl gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
            >
                {hasProgressivePricing && (
                <button
                    type="button"
                    onClick={() => setInfoModal('pricing')}
                    title="Ver como funciona o desconto por quantidade"
                    className="flex min-w-44 flex-1 items-center gap-3 rounded-2xl bg-[#0b43c9] px-4 py-4 text-left text-white shadow-sm transition hover:brightness-105"
                >
                    <BadgePercent className="h-8 w-8 shrink-0" />
                    <span className="text-sm font-black leading-4">Compre mais<br />pague menos</span>
                </button>
                )}

                {hasDelivery && (
                <button
                    type="button"
                    onClick={() => setInfoModal('delivery')}
                    title="Ver condições de entrega"
                    className="flex min-w-44 flex-1 items-center gap-3 rounded-2xl bg-[#0b43c9] px-4 py-4 text-left text-white shadow-sm transition hover:brightness-105"
                >
                    <Truck className="h-8 w-8 shrink-0" />
                    <span className="text-sm font-black leading-4">Delivery<br />consulte condições</span>
                </button>
                )}

                {store.config?.loyalty_active && (
                    <button
                        type="button"
                        onClick={() => {
                            if (isAuthenticated) {
                                window.dispatchEvent(new CustomEvent('optmamenu:open-customer-account', {
                                    detail: { tab: 'loyalty' },
                                }));
                            } else {
                                setInfoModal('loyalty');
                            }
                        }}
                        title="Ver fidelidade e benefícios"
                        className="flex min-w-44 flex-1 items-center gap-3 rounded-2xl bg-[#0b43c9] px-4 py-4 text-left text-white shadow-sm transition hover:brightness-105"
                    >
                        <Gift className="h-8 w-8 shrink-0" />
                        <span className="text-sm font-black leading-4">Fidelidade<br />ganhe benefícios</span>
                    </button>
                )}
            </section>
            )}

            <main className="mx-auto mt-5 max-w-5xl px-4">
                <div className="mb-5 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                            ref={searchInputRef}
                            type="search"
                            placeholder={store.config?.catalog_search_placeholder?.trim() || 'Buscar produtos'}
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="w-full rounded-2xl border-none bg-white py-4 pl-12 pr-4 shadow-md outline-none dark:bg-slate-800 dark:text-white"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setSortOrder((current) => current === 'asc' ? 'desc' : 'asc')}
                        className="rounded-2xl bg-white px-4 text-sm font-black shadow-md dark:bg-slate-800 dark:text-white"
                        title={sortOrder === 'asc' ? 'Ordenar de Z a A' : 'Ordenar de A a Z'}
                    >
                        {sortOrder === 'asc' ? 'A–Z' : 'Z–A'}
                    </button>
                </div>

                {categories.length > 0 && (
                    <section className="mb-5">
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('all')}
                                className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-black shadow-sm transition ${selectedCategory === 'all'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700'}`}
                            >
                                Tudo
                            </button>
                            {primaryCategories.map((category) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-black shadow-sm transition ${selectedCategory === category.id
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700'}`}
                                >
                                    {category.name}
                                </button>
                            ))}
                            {categories.length > 4 && (
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryPanel(true)}
                                    className={`inline-flex items-center whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-black shadow-sm transition ${selectedCategoryIsHidden
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700'}`}
                                >
                                    <Layers3 className="mr-2 h-4 w-4" />
                                    Mais ({categories.length - 4})
                                    <ChevronDown className="ml-1 h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </section>
                )}

                {loadingProducts ? (
                    <Loader2 className="mx-auto mt-10 animate-spin" />
                ) : filteredProducts.length === 0 ? (
                    <div className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm dark:bg-slate-800 dark:text-gray-300">
                        Nenhum produto encontrado para esta busca.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                        {filteredProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onOpenDetails={openProduct}
                            />
                        ))}
                    </div>
                )}
            </main>

            <ProductModal
                isOpen={isProductModalOpen}
                onClose={closeProduct}
                product={selectedProduct}
                onAddToCart={(product, quantity) => addToCart(product, quantity)}
            />

            {showBackToTop && (
                <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed bottom-[10rem] right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white shadow-xl transition hover:bg-slate-700 lg:bottom-24"
                    aria-label="Voltar ao topo"
                    title="Voltar ao topo"
                >
                    <ArrowUp className="h-5 w-5" />
                </button>
            )}

            {showCategoryPanel && (
                <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="category-panel-title"
                        className="max-h-[80vh] w-full overflow-hidden rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-950 sm:max-w-2xl sm:rounded-[2rem]"
                    >
                        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Catálogo</p>
                                <h2 id="category-panel-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">Todas as categorias</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCategoryPanel(false)}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                aria-label="Fechar categorias"
                                autoFocus
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </header>
                        <div className="grid max-h-[calc(80vh-5rem)] grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCategory('all');
                                    setShowCategoryPanel(false);
                                }}
                                className={`min-h-14 rounded-2xl border px-3 text-left text-sm font-black transition ${selectedCategory === 'all'
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'}`}
                            >
                                Tudo
                            </button>
                            {categories.map((category) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategory(category.id);
                                        setShowCategoryPanel(false);
                                    }}
                                    className={`min-h-14 rounded-2xl border px-3 text-left text-sm font-black transition ${selectedCategory === category.id
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'}`}
                                >
                                    {category.name}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {infoModal && (
                <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="store-info-modal-title"
                        className="w-full rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-950 sm:max-w-lg sm:rounded-[2rem] sm:p-6"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Informações da loja</p>
                                <h2 id="store-info-modal-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                                    {infoModal === 'pricing'
                                        ? 'Compre mais e pague menos'
                                        : infoModal === 'delivery'
                                            ? 'Condições de delivery'
                                            : 'Fidelidade e benefícios'}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInfoModal(null)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                aria-label="Fechar informações"
                                autoFocus
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {infoModal === 'pricing' && (
                            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                <p>Alguns produtos podem ter preços progressivos conforme a quantidade, inclusive quando a loja configura grupos ou categorias combinadas.</p>
                                <p className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-900">
                                    Quando houver uma condição especial, o produto mostra os preços e quantidades aplicáveis antes de você concluir o pedido.
                                </p>
                            </div>
                        )}

                        {infoModal === 'delivery' && (
                            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                {deliveryMethods.filter((method) => method.fulfillment_type === 'delivery').length === 0 ? (
                                    <p>A loja não possui uma modalidade de entrega pública disponível neste momento.</p>
                                ) : (
                                    deliveryMethods
                                        .filter((method) => method.fulfillment_type === 'delivery')
                                        .map((method) => (
                                            <div key={method.code} className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-900">
                                                <p className="font-black text-slate-900 dark:text-white">{method.name}</p>
                                                {method.description && <p className="mt-1">{method.description}</p>}
                                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                                                    {Number(method.minimum_order_value || 0) > 0 && (
                                                        <span>Mínimo: R$ {formatBRL(Number(method.minimum_order_value))}</span>
                                                    )}
                                                    <span>
                                                        Taxa: {Number(method.delivery_fee || 0) > 0
                                                            ? `R$ ${formatBRL(Number(method.delivery_fee))}`
                                                            : 'conforme condição da loja'}
                                                    </span>
                                                    {(method.estimated_minutes_min || method.estimated_minutes_max) && (
                                                        <span>
                                                            Prazo: {method.estimated_minutes_min || '?'}–{method.estimated_minutes_max || '?'} min
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                )}
                                {deliveryMinimum > 0 && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        O menor pedido mínimo de entrega configurado atualmente é R$ {formatBRL(deliveryMinimum)}. Retirada pode ter regras diferentes.
                                    </p>
                                )}
                            </div>
                        )}

                        {infoModal === 'loyalty' && (
                            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                <p>Clientes participantes podem acumular pontos e receber benefícios conforme as regras definidas pela própria {store.name}.</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInfoModal(null);
                                        window.dispatchEvent(new CustomEvent('optmamenu:open-customer-auth'));
                                    }}
                                    className="min-h-11 w-full rounded-2xl bg-emerald-600 px-4 font-black text-white"
                                >
                                    Entrar para consultar
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {CUSTOMER_PORTAL_AUTH_ENABLED && showLoginModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-slate-800">
                        <button
                            type="button"
                            onClick={() => {
                                setShowLoginModal(false);
                                resetLoginForm();
                            }}
                            className="absolute right-3 top-3 rounded-full bg-gray-100 p-2 dark:bg-slate-700"
                            aria-label="Fechar"
                        >
                            <X size={16} />
                        </button>

                        <h2 className="mb-4 text-xl font-bold dark:text-white">
                            {loginStep === 'password_login' ? 'Bem-vindo de volta' : 'Nova conta'}
                        </h2>

                        {loginError && (
                            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                {loginError}
                            </div>
                        )}

                        {loginStep === 'password_login' && (
                            <form onSubmit={handleLoginPassword} className="space-y-4">
                                <input
                                    type="tel"
                                    placeholder="Telefone"
                                    value={loginPhone}
                                    onChange={(event) => setLoginPhone(event.target.value)}
                                    className="w-full rounded-xl bg-gray-50 p-3 dark:bg-slate-700 dark:text-white"
                                    required
                                />
                                <input
                                    type="password"
                                    placeholder="Senha"
                                    value={loginPassword}
                                    onChange={(event) => setLoginPassword(event.target.value)}
                                    className="w-full rounded-xl bg-gray-50 p-3 dark:bg-slate-700 dark:text-white"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={loginLoading}
                                    className="w-full rounded-xl bg-[#f85e33] py-3 font-bold text-white disabled:opacity-60"
                                >
                                    {loginLoading ? 'Entrando...' : 'Entrar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLoginStep('register_form')}
                                    className="w-full font-bold text-green-600"
                                >
                                    Criar uma conta
                                </button>
                            </form>
                        )}

                        {loginStep === 'register_form' && (
                            <form onSubmit={handleRegisterFormSubmit} className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Nome"
                                    value={loginNickname}
                                    onChange={(event) => setLoginNickname(event.target.value)}
                                    className="w-full rounded-xl bg-gray-50 p-3 dark:bg-slate-700 dark:text-white"
                                    required
                                />
                                <input
                                    type="tel"
                                    placeholder="Telefone"
                                    value={loginPhone}
                                    onChange={(event) => setLoginPhone(event.target.value)}
                                    className="w-full rounded-xl bg-gray-50 p-3 dark:bg-slate-700 dark:text-white"
                                    required
                                />
                                <input
                                    type="date"
                                    value={loginBirthDate}
                                    onChange={(event) => setLoginBirthDate(event.target.value)}
                                    className="w-full rounded-xl bg-gray-50 p-3 dark:bg-slate-700 dark:text-white"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={loginLoading}
                                    className="w-full rounded-xl bg-green-600 py-3 font-bold text-white disabled:opacity-60"
                                >
                                    {loginLoading ? 'Enviando...' : 'Continuar'}
                                </button>
                            </form>
                        )}

                        {loginStep === 'otp' && (
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <p className="text-center text-sm dark:text-gray-200">
                                    Digite o código enviado para {loginPhone}
                                </p>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={loginOtp}
                                    onChange={(event) => setLoginOtp(event.target.value)}
                                    className="w-full rounded-xl bg-gray-50 p-3 text-center text-2xl font-bold dark:bg-slate-700 dark:text-white"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={loginLoading}
                                    className="w-full rounded-xl bg-green-600 py-3 font-bold text-white disabled:opacity-60"
                                >
                                    {loginLoading ? 'Validando...' : 'Validar'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {CUSTOMER_PORTAL_AUTH_ENABLED && showCompleteProfileModal && (
                <CustomerProfile
                    onClose={() => setShowCompleteProfileModal(false)}
                    storeConfig={store.config}
                    storeId={store.id}
                    initialTab="data"
                    onUpdate={() => undefined}
                />
            )}
        </div>
    );
}
