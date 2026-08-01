import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Category, Product, StoreConfig } from '@/types';
import { ProductCard } from '@/pages/store/ProductCard';
import { ProductModal } from '@/pages/store/ProductModal';
import { useCartStore } from '@/store/useCartStore';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { AuthService } from '@/services/customerAuth';
import CustomerProfile from '@/pages/store/components/CustomerProfile';
import {
    PublicStorefrontService,
    type PublicDeliveryMethod,
} from '@/services/publicStorefrontService';
import { timezoneUtils } from '@/utils/timezoneUtils';
import { buildWhatsappUrl, canOpenWhatsapp } from '@/utils/whatsapp';
import { formatBRL } from '@/utils/pricing';
import {
    AlertCircle,
    ArrowUp,
    BadgePercent,
    Gift,
    Loader2,
    LogOut,
    MessageCircle,
    Moon,
    Search,
    ShoppingCart,
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

function normalizeText(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isProductUnavailable(product: Product) {
    return product.public_availability?.status === 'unavailable'
        || Number(product.stock_quantity ?? 0) <= 0;
}

export default function Catalog() {
    const { storeSlug, tableCode } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const isQrTableMode = Boolean(tableCode);

    const {
        items: cartItems,
        addToCart,
        bindContext,
        setFulfillment,
        syncCatalogPricing,
    } = useCartStore();

    const { isAuthenticated, customer, logout } = useCustomerAuth();

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

                if (!catalog.ok || !catalog.catalog_enabled) {
                    setCategories([]);
                    setProducts([]);
                    syncCatalogPricing([], []);
                } else {
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
                }

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
    }, [bindContext, isQrTableMode, setFulfillment, storeSlug, syncCatalogPricing, tableCode]);

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

    const cartTotal = useMemo(
        () => cartItems.reduce((total, item) => total + Number(item.price || 0) * item.quantity, 0),
        [cartItems],
    );

    const cartQuantity = useMemo(
        () => cartItems.reduce((total, item) => total + item.quantity, 0),
        [cartItems],
    );

    const deliveryMinimum = useMemo(() => {
        const values = deliveryMethods
            .filter((method) => method.fulfillment_type === 'delivery')
            .map((method) => Number(method.minimum_order_value || 0))
            .filter((value) => value > 0);

        return values.length > 0 ? Math.min(...values) : 0;
    }, [deliveryMethods]);

    const publicStoreUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${location.pathname}`
        : `/s/${storeSlug}`;

    const whatsappPhone = store?.whatsapp?.digits
        || store?.contacts?.whatsapp_business
        || store?.phone_number
        || '';
    const whatsappEnabled = canOpenWhatsapp(whatsappPhone);
    const whatsappUrl = whatsappEnabled && store
        ? buildWhatsappUrl(
            whatsappPhone,
            [
                `Olá! Vim pelo cardápio online da ${store.name}.`,
                '',
                'Gostaria de fazer um pedido ou tirar uma dúvida.',
                '',
                `Cardápio: ${publicStoreUrl}`,
            ].join('\n'),
        )
        : '';

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
            await AuthService.loginWithPassword(loginPhone, loginPassword.toLowerCase(), store.id);
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
                    marketingConsent: true,
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

    const openProduct = (product: Product) => {
        setSelectedProduct(product);
        setIsProductModalOpen(true);
    };

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
                        {isAuthenticated ? (
                            <div className="flex items-center rounded-full bg-white/20 p-1 pl-3 text-white">
                                <button
                                    type="button"
                                    onClick={() => setShowCompleteProfileModal(true)}
                                    className="max-w-24 truncate text-xs font-bold"
                                >
                                    Olá, {customer?.nickname || 'cliente'}
                                </button>
                                <button
                                    type="button"
                                    onClick={logout}
                                    className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-500"
                                    aria-label="Sair"
                                >
                                    <LogOut size={15} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowLoginModal(true)}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
                                aria-label="Entrar"
                            >
                                <User size={20} />
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

            {store.config?.visual_banner_url && (
                <div className="mx-auto mt-4 max-w-5xl overflow-hidden px-4">
                    <img
                        src={store.config.visual_banner_url}
                        alt="Banner da loja"
                        className="h-40 w-full rounded-2xl object-cover shadow-sm md:h-64"
                    />
                </div>
            )}

            {isQrTableMode && tableCode && (
                <div className="mx-auto mt-4 max-w-5xl px-4">
                    <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 shadow-sm dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-100">
                        Pedido para a mesa/comanda <strong>{tableCode}</strong>.
                    </div>
                </div>
            )}

            <section
                aria-label="Informações da loja"
                className="mx-auto mt-5 flex max-w-5xl gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
            >
                <button
                    type="button"
                    title="Produtos participantes podem ter preço reduzido conforme a quantidade combinada no carrinho."
                    className="flex min-w-44 flex-1 items-center gap-3 rounded-2xl bg-[#0b43c9] px-4 py-4 text-left text-white shadow-sm"
                >
                    <BadgePercent className="h-8 w-8 shrink-0" />
                    <span className="text-sm font-black leading-4">Compre mais<br />pague menos</span>
                </button>

                <button
                    type="button"
                    title={deliveryMinimum > 0
                        ? `Entrega disponível conforme área atendida. Pedido mínimo a partir de R$ ${formatBRL(deliveryMinimum)}.`
                        : 'Entrega disponível conforme área atendida, taxas e condições da loja.'}
                    className="flex min-w-44 flex-1 items-center gap-3 rounded-2xl bg-[#0b43c9] px-4 py-4 text-left text-white shadow-sm"
                >
                    <Truck className="h-8 w-8 shrink-0" />
                    <span className="text-sm font-black leading-4">Delivery<br />consulte condições</span>
                </button>

                {store.config?.loyalty_active && (
                    <button
                        type="button"
                        title="Compras elegíveis podem gerar pontos e benefícios conforme as regras da loja."
                        className="flex min-w-44 flex-1 items-center gap-3 rounded-2xl bg-[#0b43c9] px-4 py-4 text-left text-white shadow-sm"
                    >
                        <Gift className="h-8 w-8 shrink-0" />
                        <span className="text-sm font-black leading-4">Fidelidade<br />ganhe benefícios</span>
                    </button>
                )}
            </section>

            <main className="mx-auto mt-5 max-w-5xl px-4">
                <div className="mb-5 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="search"
                            placeholder="Qual sabor você busca?"
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
                    <section className="mb-5 flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                        <button
                            type="button"
                            onClick={() => setSelectedCategory('all')}
                            className={`whitespace-nowrap rounded-full px-6 py-2.5 shadow-sm ${selectedCategory === 'all'
                                ? 'bg-green-600 text-white'
                                : 'bg-white text-gray-700 dark:bg-slate-800 dark:text-gray-200'}`}
                        >
                            Tudo
                        </button>
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => setSelectedCategory(category.id)}
                                className={`whitespace-nowrap rounded-full px-6 py-2.5 shadow-sm ${selectedCategory === category.id
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white text-gray-700 dark:bg-slate-800 dark:text-gray-200'}`}
                            >
                                {category.name}
                            </button>
                        ))}
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
                onClose={() => setIsProductModalOpen(false)}
                product={selectedProduct}
                onAddToCart={(product, quantity) => addToCart(product, quantity)}
            />

            {whatsappEnabled && (
                <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`fixed right-4 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-green-600 text-white shadow-xl transition hover:bg-green-700 ${cartItems.length > 0 ? 'bottom-28' : 'bottom-5'}`}
                    aria-label="Falar com a loja pelo WhatsApp"
                    title="Falar com a loja pelo WhatsApp"
                >
                    <MessageCircle className="h-6 w-6" />
                </a>
            )}

            {showBackToTop && (
                <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className={`fixed right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white shadow-xl transition hover:bg-slate-700 ${cartItems.length > 0 ? 'bottom-44' : whatsappEnabled ? 'bottom-20' : 'bottom-5'}`}
                    aria-label="Voltar ao topo"
                    title="Voltar ao topo"
                >
                    <ArrowUp className="h-5 w-5" />
                </button>
            )}

            {cartItems.length > 0 && (
                <button
                    type="button"
                    onClick={() => navigate('/checkout')}
                    className="safe-area-bottom fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl bg-emerald-600 px-5 py-4 text-left text-white shadow-2xl transition hover:bg-emerald-700 active:scale-[0.99]"
                >
                    <span className="flex items-center gap-3">
                        <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                            <ShoppingCart className="h-6 w-6" />
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-emerald-700">
                                {cartQuantity}
                            </span>
                        </span>
                        <span>
                            <span className="block text-xs font-bold opacity-90">
                                {cartQuantity} {cartQuantity === 1 ? 'item' : 'itens'}
                            </span>
                            <span className="block text-xl font-black">R$ {formatBRL(cartTotal)}</span>
                        </span>
                    </span>
                    <span className="font-black">Ver carrinho</span>
                </button>
            )}

            {showLoginModal && (
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

            {showCompleteProfileModal && (
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
