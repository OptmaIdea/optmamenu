import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Loader, AlertCircle, CheckCircle, User, Phone, Mail, Building, MapPin, Contact, FileText, UserCircle, SlidersHorizontal, Settings, Truck, WalletCards, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router-dom';
import bcrypt from 'bcryptjs';
import type { StoreData, IBGEState, IBGECity } from './storeSettings.types';
import PageContainer from '@/components/common/PageContainer';
import CorporateTab from './tabs/CorporateTab';
import AddressTab from './tabs/AddressTab';
import ContactsTab from './tabs/ContactsTab';
import LegalTab from './tabs/LegalTab';
import { TEMPLATE_PRIVACY_POLICY, TEMPLATE_TERMS_OF_USE, TEMPLATE_COOKIE_POLICY } from '@/constants/legalTemplates';
import { getActiveStoreId, setActiveStoreId } from '@/utils/activeStore';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { hasEffectivePermission } from '@/utils/permissions';

// Import sub-pages
import CommercialSettingsPage from '@/pages/private/admin/commercial/settings/CommercialSettingsPage';
import Config from '@/pages/private/admin/settings/appearance/Appearance';
import StockSettingsPage from '@/pages/private/admin/stock/settings/StockSettingsPage';
import Delivery from '@/pages/private/admin/delivery/Delivery';
import PaymentMethodsPage from '@/pages/private/admin/commercial/paymentMethods/PaymentMethodsPage';

const SETTINGS_TABS = [
  { id: 'store', label: 'Dados da Loja', icon: Building },
  { id: 'commercial', label: 'Comercial', icon: Settings },
  { id: 'orders', label: 'Pedido Online', icon: Smartphone },
  { id: 'stock', label: 'Estoque', icon: SlidersHorizontal },
  { id: 'delivery', label: 'Entrega', icon: Truck },
  { id: 'payment', label: 'Pagamento', icon: WalletCards },
  { id: 'legal', label: 'Documentos e Termos', icon: FileText },
  { id: 'system', label: 'Sistema', icon: UserCircle },
] as const;

const settingsTabPermissions = {
  store: {
    view: ['settings.store.view', 'settings.store.manage', 'settings.view', 'settings.manage'],
    manage: ['settings.store.manage', 'settings.manage'],
  },
  commercial: {
    view: ['settings.commercial.view', 'settings.commercial.manage', 'settings.view', 'settings.manage'],
    manage: ['settings.commercial.manage', 'settings.manage'],
  },
  orders: {
    view: ['settings.orders.view', 'settings.orders.manage', 'settings.view', 'settings.manage'],
    manage: ['settings.orders.manage', 'settings.manage'],
  },
  stock: {
    view: ['settings.stock.view', 'settings.stock.manage', 'settings.view', 'settings.manage'],
    manage: ['settings.stock.manage', 'settings.manage'],
  },
  delivery: {
    view: ['settings.delivery.view', 'settings.delivery.manage', 'settings.view', 'settings.manage'],
    manage: ['settings.delivery.manage', 'settings.manage'],
  },
  payment: {
    view: ['settings.payment.view', 'settings.payment.manage', 'settings.view', 'settings.manage'],
    manage: ['settings.payment.manage', 'settings.manage'],
  },
  legal: {
    view: ['settings.legal.view', 'settings.legal.manage', 'settings.view', 'settings.manage'],
    manage: ['settings.legal.manage', 'settings.manage'],
  },
  system: {
    view: ['settings.system.view', 'settings.system.manage', 'settings.view', 'settings.manage'],
    manage: ['settings.system.manage', 'settings.manage'],
  },
} as const;


// Helper to get initials
const getInitials = (name: string) => {
    return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};


export default function StoreSettings() {
    const { securityContext, isOwner, loading: loadingSecurityContext } = useSecurityContext();

    const activeStoreIdFromStorage = getActiveStoreId();
    const fallbackStoreId = securityContext?.primary_membership?.store_id ?? null;
    const activeStoreId = activeStoreIdFromStorage ?? fallbackStoreId;

    const { permissions } = usePermissions(activeStoreId);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const activeTab = searchParams.get('tab') || 'store';
    const [activeStoreSubTab, setActiveStoreSubTab] = useState('corporate');

    const hasAnyPermission = (keys: readonly string[]) => {
        if (isOwner) return true;
        return keys.some((key) => hasEffectivePermission(permissions, key));
    };

    const allowedTabs = useMemo(() => {
        return SETTINGS_TABS.filter((tab) =>
            hasAnyPermission(settingsTabPermissions[tab.id].view)
        );
    }, [permissions, isOwner]);

    const canViewSettings = isOwner || allowedTabs.length > 0;

    const canManageStore = isOwner || hasAnyPermission(settingsTabPermissions.store.manage);
    const canManageLegal = isOwner || hasAnyPermission(settingsTabPermissions.legal.manage);
    const canManageSystem = isOwner || hasAnyPermission(settingsTabPermissions.system.manage);

    const canManageSettings = isOwner || (
        activeTab in settingsTabPermissions
            ? hasAnyPermission(settingsTabPermissions[activeTab as keyof typeof settingsTabPermissions].manage)
            : false
    );
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [userData, setUserData] = useState<{ id: string, name: string, email: string, phone: string } | null>(null);

    // ✅ Estado para a senha de estoque (campo de entrada)
    const [stockPassword, setStockPassword] = useState('');

    // IBGE States
    const [states, setStates] = useState<IBGEState[]>([]);
    const [cities, setCities] = useState<IBGECity[]>([]);
    const [loadingCities, setLoadingCities] = useState(false);

    // State
    const [store, setStore] = useState<StoreData>({
        name: '',
        slug: '',
        description: '',
        logo_url: null,
        sms_gateway_token: '',
        doc_type: 'PF',
        document: '',
        legal_name: '',
        fantasy_name: '',
        establishment_type: 'Matriz',
        address: {
            zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: ''
        },
        contacts: {
            main_email: '', secondary_emails: '', phone_responsible: '', name_responsible: '', whatsapp_business: '', whatsapp_contact: '', social_media: '', website: ''
        },
        consents: {
            terms_accepted: false, lgpd_accepted: false, responsibility_accepted: false, no_illicit_accepted: false,
            channels: { whatsapp: true, sms: true, email: true }
        },
        config: {
            opening_time: '', closing_time: '', custom_consent_text: '', tolerance_minutes: 5, pre_order_minutes: 20
        },
        privacy_policy_text: '',
        terms_of_use_text: '',
        cookie_policy_text: '',
        dpo_email: '',
        dpo_contact: ''
    });

    useEffect(() => {
        if (loadingSecurityContext) return;
        if (!isOwner && permissions.length === 0) return;

        if (allowedTabs.length === 0) {
            navigate('/admin', { replace: true });
        } else if (!allowedTabs.some((tab) => tab.id === activeTab)) {
            navigate(`/admin/settings?tab=${allowedTabs[0].id}`, { replace: true });
        }
    }, [activeTab, allowedTabs, isOwner, permissions, loadingSecurityContext, navigate]);

    useEffect(() => {
        if (!loadingSecurityContext) {
            fetchInitialData();
        }
    }, [loadingSecurityContext]);

    useEffect(() => {
        fetchStates();
    }, []);

    // Effect to load cities when state changes manually
    useEffect(() => {
        if (store.address.state) {
            fetchCities(store.address.state);
        }
    }, [store.address.state]);

    const fetchInitialData = async () => {
        if (loadingSecurityContext) return;

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Set User Metadata for Display
            setUserData({
                id: user.id,
                name: user.user_metadata.full_name || 'N/A',
                phone: user.user_metadata.phone_number || 'N/A',
                email: user.email || 'N/A'
            });

            const activeStoreIdFromStorage = getActiveStoreId();
            const fallbackStoreId =
                securityContext?.primary_membership?.store_id ?? null;
            const activeStoreId = activeStoreIdFromStorage ?? fallbackStoreId;

            if (!activeStoreId) {
                toast.error('Nenhuma loja ativa selecionada.');
                setMessage('Erro: Nenhuma loja ativa selecionada.');
                setLoading(false);
                return;
            }

            if (!activeStoreIdFromStorage && fallbackStoreId) {
                setActiveStoreId(fallbackStoreId);
            }

            const { data: storeData, error: storeError } = await supabase
                .from('stores')
                .select('*')
                .eq('id', activeStoreId)
                .maybeSingle();

            if (storeError) {
                console.error('Erro ao carregar loja ativa:', storeError);
                toast.error('Erro ao carregar dados da loja ativa.');
                throw new Error(`Erro ao buscar loja ativa: ${storeError.message}`);
            }

            if (!storeData) {
                throw new Error(
                    'Loja ativa não encontrada ou sem permissão de acesso.'
                );
            }

            const store = Array.isArray(storeData) ? storeData[0] : storeData;

            if (store) {
                setStore(prev => ({
                    ...prev,
                    ...store,
                    id: store.id,
                    address: { ...prev.address, ...(store.address || {}) },
                    contacts: { ...prev.contacts, ...(store.contacts || {}) },
                    consents: { ...prev.consents, ...(store.consents || {}) },
                    sms_gateway_token: store.sms_gateway_token || '',
                    config: { ...prev.config, ...(store.config || {}) }
                }));

                console.log('✅ Loja carregada com sucesso:', store.name);
            }
        } catch (error: any) {
            console.error('❌ Error fetching store:', error);
            setMessage(`Erro ao carregar os dados da loja: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchStates = async () => {
        try {
            const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
            const data = await res.json();
            setStates(data);
        } catch (e) {
            console.error("Error fetching states", e);
        }
    };

    const fetchCities = async (uf: string) => {
        if (!uf) return;
        setLoadingCities(true);
        try {
            const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
            const data = await res.json();
            setCities(data);
        } catch (e) {
            console.error("Error fetching cities", e);
        } finally {
            setLoadingCities(false);
        }
    };

    const [searchingCep, setSearchingCep] = useState(false);

    const handleZipLookup = async () => {
        const cep = store.address.zip_code?.replace(/\D/g, '') || '';

        if (cep.length !== 8) {
            if (cep.length > 0) setMessage('Erro: CEP inválido. Digite 8 números.');
            return;
        }

        setSearchingCep(true);
        setMessage('');

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) {
                setMessage('Erro: CEP não encontrado.');
                setSearchingCep(false);
                return;
            }

            setStore(prev => ({
                ...prev,
                address: {
                    ...prev.address,
                    street: data.logradouro,
                    neighborhood: data.bairro,
                    city: data.localidade,
                    state: data.uf
                }
            }));
            setMessage('Endereço encontrado!');
        } catch (e) {
            console.error("CEP error", e);
            setMessage('Erro ao buscar CEP. Verifique sua conexão.');
        } finally {
            setSearchingCep(false);
        }
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `store-logos/${fileName}`;

        try {
            setLoading(true);
            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('logos')
                .getPublicUrl(filePath);

            setStore(prev => ({ ...prev, logo_url: publicUrl }));
            setMessage('Logo carregada com sucesso! Não esqueça de salvar.');
        } catch (error: any) {
            setMessage('Erro ao enviar logo: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const persistStoreData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');

            const activeStoreId = getActiveStoreId();

            if (!activeStoreId) {
                throw new Error('Nenhuma loja ativa selecionada.');
            }

            // 1. Update User Metadata (Name) if changed
            if (userData && userData.name !== user.user_metadata.full_name) {
                const { error: authError } = await supabase.auth.updateUser({
                    data: { full_name: userData.name }
                });
                if (authError) console.error('Error updating user name:', authError);
            }

            // 🔐 Hashing da senha de estoque (se fornecida)
            let hashedPassword = store.stock_password_hash; // mantém o existente
            if (stockPassword) {
                const salt = await bcrypt.genSalt(10);
                hashedPassword = await bcrypt.hash(stockPassword, salt);
            }

            const payload = {
                name: store.name,
                slug: store.slug,
                description: store.description,
                doc_type: store.doc_type,
                document: store.document,
                legal_name: store.legal_name,
                fantasy_name: store.fantasy_name,
                establishment_type: store.establishment_type,
                address: store.address,
                contacts: store.contacts,
                consents: store.consents,
                phone_number: store.contacts.whatsapp_business,
                logo_url: store.logo_url,
                sms_gateway_token: store.sms_gateway_token,
                config: { ...store.config },
                stock_password_hash: hashedPassword,

                privacy_policy_text: store.privacy_policy_text,
                terms_of_use_text: store.terms_of_use_text,
                cookie_policy_text: store.cookie_policy_text,
                dpo_email: store.dpo_email,
                dpo_contact: store.dpo_contact
            };

            const { data, error } = await supabase
                .from('stores')
                .update(payload)
                .eq('id', activeStoreId)
                .select()
                .single();

            if (error) throw error;

            setMessage('Dados salvos com sucesso!');
            setStockPassword('');

            // opcional: se a RPC retornar o id, você pode sincronizar
            // Ex: se sua função retornar o registro da store
            if (data?.id) {
                setStore(prev => ({ ...prev, id: data.id }));
            } else {
                // fallback: recarrega
                await fetchInitialData();
            }
        } catch (error: any) {
            if (error.code === '23505' && (error.message || '').includes('slug')) {
                setMessage('Erro: Este Link da Loja (slug) já está em uso. Escolha outro.');
            } else {
                setMessage('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (!canManageSettings) {
            toast.error('Você não tem permissão para editar os dados da loja.');
            return;
        }

        // Manual Validation
        const requiredFields = [
            { field: store.name, label: 'Nome da Loja', tab: 'corporate' },
            { field: store.slug, label: 'Link da Loja (Slug)', tab: 'corporate' },
            { field: store.document, label: 'CPF / CNPJ', tab: 'corporate' },
            { field: store.legal_name, label: 'Razão Social / Nome Completo', tab: 'corporate' },
        ];

        for (const req of requiredFields) {
            if (!req.field || req.field.trim() === '') {
                setMessage(`Erro: O campo "${req.label}" é obrigatório.`);
                navigate('/admin/settings?tab=store', { replace: true });
                setActiveStoreSubTab(req.tab);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

        // Consent validation
        if (!store.consents.terms_accepted || !store.consents.no_illicit_accepted) {
            setMessage('Erro: Você precisa aceitar os termos e declarações legais na aba "Legal & Termos".');
            navigate('/admin/settings?tab=legal', { replace: true });
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setSaving(true);
        try {
            await persistStoreData();
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-brand-green" /></div>;

    if (!canViewSettings) {
        return (
            <PageContainer
                title="Dados da Loja"
                subtitle="Preencha as informações para ativar seu cardápio digital."
                category="Configurações"
                icon={<UserCircle className="text-[#21A896]" size={28} />}
                flat
            >
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    Você não tem permissão para acessar os dados da loja.
                </div>
            </PageContainer>
        );
    }



    return (
        <PageContainer
            title="Configurações da Loja"
            subtitle="Gerencie as configurações gerais da sua loja, regras comerciais, formas de pagamento, termos e sistema."
            category="Configurações"
            icon={<Settings className="text-[#21A896]" size={28} />}
            flat
        >
            {/* Top-level Tabs Navigation */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-3 mb-6">
                {allowedTabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => navigate(`/admin/settings?tab=${tab.id}`, { replace: true })}
                        className={`px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === tab.id
                            ? 'bg-brand-green text-white shadow-lg shadow-green-200/50 dark:shadow-none font-bold'
                            : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-700 font-bold'}`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'store' && (
                <div className="space-y-6">
                    {!canManageStore && (
                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 animate-fadeIn">
                            Você pode visualizar estes dados, mas não possui permissão para alterá-los.
                        </div>
                    )}

                    {message && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 shadow-sm border ${message.includes('Erro') ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'}`}>
                            {message.includes('Erro') ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                            <span className="font-medium">{message}</span>
                        </div>
                    )}

                    {/* Logo & Identity Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center gap-8 animate-fadeIn">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                                {store.logo_url ? (
                                    <img src={store.logo_url} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl font-bold text-gray-300 dark:text-gray-600">
                                        {store.name ? getInitials(store.name) : <Building size={48} />}
                                    </span>
                                )}

                                {/* Overlay for upload */}
                                {canManageStore && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                                        <label htmlFor="logo-upload" className="cursor-pointer text-white font-bold text-xs flex flex-col items-center">
                                            <span className="mb-1">Alterar</span>
                                            <FileText size={16} />
                                        </label>
                                    </div>
                                )}
                            </div>
                            {canManageStore && (
                                <label htmlFor="logo-upload" className="absolute bottom-0 right-0 bg-brand-green text-white p-2 rounded-full shadow-md cursor-pointer hover:brightness-110 transition">
                                    <User size={16} />
                                </label>
                            )}
                            <input
                                id="logo-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleLogoChange}
                                disabled={!canManageStore}
                            />
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Identidade Visual</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                Adicione a logo da sua marca. Ela aparecerá no topo do seu cardápio e no cabeçalho.
                                <br />Formato recomendado: JPG ou PNG quadrado, max 2MB.
                            </p>
                        </div>
                    </div>

                    {/* User Metadata Header */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between animate-fadeIn">
                        <div>
                            <h3 className="text-gray-800 dark:text-brand-mint font-bold mb-1 flex items-center gap-2">
                                <User size={18} /> Conta Vinculada
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Estes são seus dados de acesso ao sistema.</p>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <div className="bg-white dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-2">
                                <User size={16} className="text-gray-400" />
                                <input
                                    type="text"
                                    className="font-bold text-gray-700 dark:text-gray-200 bg-transparent outline-none w-40 disabled:opacity-60"
                                    value={userData?.name || ''}
                                    onChange={e => setUserData(prev => prev ? { ...prev, name: e.target.value } : null)}
                                    placeholder="Seu Nome"
                                    disabled={!canManageStore}
                                />
                                {canManageStore && (
                                    <span className="text-xs text-brand-green cursor-pointer hover:underline" title="O nome será salvo ao clicar em 'Salvar Alterações'">Editar</span>
                                )}
                            </div>
                            <div className="bg-white dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-2">
                                <Mail size={16} className="text-gray-400" />
                                <span className="font-bold text-gray-700 dark:text-gray-200">{userData?.email}</span>
                            </div>
                            <div className="bg-white dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-2">
                                <Phone size={16} className="text-gray-400" />
                                <span className="font-bold text-gray-700 dark:text-gray-200">{userData?.phone}</span>
                            </div>
                        </div>
                    </section>

                    <form onSubmit={handleSave} noValidate className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fadeIn">
                        {/* Sub-tabs Header */}
                        <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setActiveStoreSubTab('corporate')}
                                className={`flex items-center gap-2 px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors border-b-2 ${activeStoreSubTab === 'corporate'
                                    ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-900/10'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750'}`}
                            >
                                <Building size={18} /> Dados Corporativos
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveStoreSubTab('address')}
                                className={`flex items-center gap-2 px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors border-b-2 ${activeStoreSubTab === 'address'
                                    ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-900/10'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750'}`}
                            >
                                <MapPin size={18} /> Endereço
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveStoreSubTab('contacts')}
                                className={`flex items-center gap-2 px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors border-b-2 ${activeStoreSubTab === 'contacts'
                                    ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-900/10'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750'}`}
                            >
                                <Contact size={18} /> Contatos
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="p-6 md:p-8">
                            {activeStoreSubTab === 'corporate' && (
                                <CorporateTab store={store} setStore={setStore} disabled={!canManageStore} />
                            )}
                            {activeStoreSubTab === 'address' && (
                                <AddressTab
                                    store={store}
                                    setStore={setStore}
                                    states={states}
                                    cities={cities}
                                    loadingCities={loadingCities}
                                    searchingCep={searchingCep}
                                    handleZipLookup={handleZipLookup}
                                    disabled={!canManageStore}
                                />
                            )}
                            {activeStoreSubTab === 'contacts' && (
                                <ContactsTab store={store} setStore={setStore} disabled={!canManageStore} />
                            )}
                        </div>

                        {/* Save Button Area */}
                        {canManageStore && (
                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end p-6 md:p-8">
                                <button
                                    type="submit"
                                    disabled={saving || !store.consents.terms_accepted || !store.consents.no_illicit_accepted}
                                    className="flex items-center gap-3 bg-brand-green text-white px-8 py-3 rounded-xl font-bold text-lg hover:brightness-90 shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!store.consents.terms_accepted ? "Aceite os termos para salvar" : ""}
                                >
                                    <Save size={24} />
                                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            )}

            {/* RENDER SUB-PAGES WITH withoutHeader=true */}
            {activeTab === 'commercial' && (
                <div className="animate-fadeIn">
                    <CommercialSettingsPage withoutHeader={true} disabled={!canManageSettings} />
                </div>
            )}

            {activeTab === 'orders' && (
                <div className="animate-fadeIn">
                    <Config withoutHeader={true} disabled={!canManageSettings} />
                </div>
            )}

            {activeTab === 'stock' && (
                <div className="animate-fadeIn">
                    <StockSettingsPage withoutHeader={true} disabled={!canManageSettings} />
                </div>
            )}

            {activeTab === 'delivery' && (
                <div className="animate-fadeIn">
                    <Delivery withoutHeader={true} disabled={!canManageSettings} />
                </div>
            )}

            {activeTab === 'payment' && (
                <div className="animate-fadeIn">
                    <PaymentMethodsPage withoutHeader={true} disabled={!canManageSettings} />
                </div>
            )}

            {activeTab === 'legal' && (
                <div className="space-y-6 animate-fadeIn">
                    {!canManageLegal && (
                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                            Você pode visualizar estes dados, mas não possui permissão para alterá-los.
                        </div>
                    )}

                    {message && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 shadow-sm border ${message.includes('Erro') ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                            {message.includes('Erro') ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                            <span className="font-medium">{message}</span>
                        </div>
                    )}

                    <form onSubmit={handleSave} noValidate className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden p-6 md:p-8">
                        <LegalTab
                            store={store}
                            setStore={setStore}
                            templatePrivacyPolicy={TEMPLATE_PRIVACY_POLICY}
                            templateTermsOfUse={TEMPLATE_TERMS_OF_USE}
                            templateCookiePolicy={TEMPLATE_COOKIE_POLICY}
                            disabled={!canManageLegal}
                        />

                        {/* Save Button Area */}
                        {canManageLegal && (
                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving || !store.consents.terms_accepted || !store.consents.no_illicit_accepted}
                                    className="flex items-center gap-3 bg-brand-green text-white px-8 py-3 rounded-xl font-bold text-lg hover:brightness-90 shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!store.consents.terms_accepted ? "Aceite os termos para salvar" : ""}
                                >
                                    <Save size={24} />
                                    {saving ? 'Salvando...' : 'Salvar Termos'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            )}

            {activeTab === 'system' && (
                <div className="space-y-6 animate-fadeIn">
                    {!canManageSystem && (
                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                            Você pode visualizar estes dados, mas não possui permissão para alterá-los.
                        </div>
                    )}

                    {message && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 shadow-sm border ${message.includes('Erro') ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                            {message.includes('Erro') ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                            <span className="font-medium">{message}</span>
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-6">
                        <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                                <UserCircle className="text-[#21A896]" size={20} /> Configurações de Sistema
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Token do Gateway de SMS</label>
                                    <input
                                        type="text"
                                        value={store.sms_gateway_token || ''}
                                        onChange={(e) => setStore({ ...store, sms_gateway_token: e.target.value })}
                                        placeholder="Insira o token do gateway de SMS"
                                        className="w-full p-4 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-brand-green outline-none transition disabled:opacity-60"
                                        disabled={!canManageSystem}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nova Senha de Estoque (PIN)</label>
                                    <input
                                        type="password"
                                        value={stockPassword}
                                        onChange={(e) => setStockPassword(e.target.value)}
                                        placeholder="Deixe em branco para manter a atual"
                                        className="w-full p-4 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-brand-green outline-none transition disabled:opacity-60"
                                        disabled={!canManageSystem}
                                    />
                                </div>
                            </div>
                        </section>
                        {canManageSystem && (
                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-3 bg-brand-green text-white px-8 py-3 rounded-xl font-bold text-lg hover:brightness-90 shadow-md hover:shadow-lg transition"
                                >
                                    <Save size={24} />
                                    {saving ? 'Salvando...' : 'Salvar Alterações de Sistema'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            )}
        </PageContainer>
    );
}
