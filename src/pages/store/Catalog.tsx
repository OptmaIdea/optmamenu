import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Product, Category, StoreConfig } from '@/types';
import { ProductCard } from '@/pages/store/ProductCard';
import { ProductModal } from '@/pages/store/ProductModal';
import { useCartStore } from '@/store/useCartStore';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { AuthService } from '@/services/customerAuth';
import { CustomerService } from '@/services/customerService';
import { CartDrawer } from '@/pages/store/components/CartDrawer';
import CustomerProfile from '@/pages/store/components/CustomerProfile';
import { timezoneUtils } from '@/utils/timezoneUtils';
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
    contacts?: {
        whatsapp_business?: string;
    };
    config?: StoreConfig;
}

export default function Catalog() {
    const { storeSlug } = useParams();
    const { addToCart, setCategoryRules } = useCartStore();
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

    const [storeHours, setStoreHours] = useState<any[]>([]);
    const [storeExceptions, setStoreExceptions] = useState<any[]>([]);
    const [storeStatus, setStoreStatus] = useState<{
        isOpen: boolean;
        canOrder: boolean;
        message: string | null;
        isClosingSoon: boolean;
    }>({ isOpen: false, canOrder: false, message: null, isClosingSoon: false });

    useEffect(() => {
        async function fetchStore() {
            if (!storeSlug) return;
            setLoadingStore(true);
            try {
                const { data, error } = await supabase.rpc(
                    'get_store_by_slug',
                    { p_slug: storeSlug }
                );
                if (error) {
                    console.error('Error fetching store:', error);
                } else if (data) {
                    const storeData = Array.isArray(data) ? data[0] : data;
                    const [hoursRes, exceptionsRes, loyaltyRes] = await Promise.all([
                        supabase.from('store_hours').select('*').eq('store_id', storeData.id),
                        supabase.from('store_schedules_exceptions').select('*').eq('store_id', storeData.id),
                        supabase.from('fidelity_programs').select('is_active').eq('store_id', storeData.id).maybeSingle()
                    ]);

                    if (hoursRes.data) setStoreHours(hoursRes.data);
                    if (exceptionsRes.data) setStoreExceptions(exceptionsRes.data);

                    if (storeData.config) {
                        storeData.config.loyalty_active = loyaltyRes.data?.is_active ?? false;
                    }
                    setStore(storeData);
                    fetchCatalogData(storeData.id);
                }
            } catch (err) {
                console.error('Exception fetching store:', err);
            } finally {
                setLoadingStore(false);
            }
        }
        fetchStore();
    }, [storeSlug]);

    const refreshCustomerData = () => {
        if (customer?.id) {
            CustomerService.getAddresses(customer.id).then(setCustomerAddresses).catch(console.error);
            CustomerService.getNotifications(customer.id).then(setNotifications).catch(console.error);
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

    const handleAddToCart = (product: Product, quantity = 1) => {
        if (!storeStatus.canOrder) {
            alert(storeStatus.message || "A loja está fechada no momento.");
            return;
        }
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

    async function fetchCatalogData(id: string) {
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
    }

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
                <Loader2 className="animate-spin h-12 w-12 text-[#21A896]" />
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

            <CartDrawer store={store as any} isOrderingAllowed={storeStatus.canOrder} />
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
