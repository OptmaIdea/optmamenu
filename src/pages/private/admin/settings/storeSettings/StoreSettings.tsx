import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Loader, AlertCircle, CheckCircle, User, Phone, Mail, Building, MapPin, Contact, FileText, UserCircle, SlidersHorizontal, Settings, Truck, WalletCards, Smartphone, MessageCircle } from 'lucide-react';
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
import { getActiveStoreId, setActiveStoreId, resolveActiveMembership } from '@/utils/activeStore';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { LockedHint, PermissionLocked, NO_WRITE_PERMISSION_MESSAGE } from '@/components/security/PermissionLocked';

// Import sub-pages
import CommercialSettingsPage from '@/pages/private/admin/commercial/settings/CommercialSettingsPage';
import Config from '@/pages/private/admin/settings/appearance/Appearance';
import StockSettingsPage from '@/pages/private/admin/stock/settings/StockSettingsPage';
import Delivery from '@/pages/private/admin/delivery/Delivery';
import PaymentMethodsPage from '@/pages/private/admin/commercial/paymentMethods/PaymentMethodsPage';

const SETTINGS_TABS = [
  { id: 'store', label: 'Dados da Loja', icon: Building, permissionView: 'settings.store.view', permissionManage: 'settings.store.manage' },
  { id: 'commercial', label: 'Comercial', icon: Settings, permissionView: 'settings.commercial.view', permissionManage: 'settings.commercial.manage' },
  { id: 'orders', label: 'Pedido Online', icon: Smartphone, permissionView: 'settings.orders.view', permissionManage: 'settings.orders.manage' },
  { id: 'stock', label: 'Estoque', icon: SlidersHorizontal, permissionView: 'settings.stock.view', permissionManage: 'settings.stock.manage' },
  { id: 'delivery', label: 'Entrega', icon: Truck, permissionView: 'settings.delivery.view', permissionManage: 'settings.delivery.manage' },
  { id: 'payment', label: 'Pagamento', icon: WalletCards, permissionView: 'settings.payment.view', permissionManage: 'settings.payment.manage' },
  { id: 'messages', label: 'Mensagens', icon: MessageCircle, permissionView: 'messages.view', permissionManage: 'messages.manage' },
  { id: 'legal', label: 'Documentos e Termos', icon: FileText, permissionView: 'settings.legal.view', permissionManage: 'settings.legal.manage' },
  { id: 'system', label: 'Sistema', icon: UserCircle, permissionView: 'settings.system.view', permissionManage: 'settings.system.manage' },
] as const;

const settingsTabPermissions = {
    store: {
        view: ['settings.store.view'],
        manage: ['settings.store.manage'],
    },
    commercial: {
        view: ['settings.commercial.view'],
        manage: ['settings.commercial.manage'],
    },
    orders: {
        view: ['settings.orders.view'],
        manage: ['settings.orders.manage'],
    },
    stock: {
        view: ['settings.stock.view'],
        manage: ['settings.stock.manage'],
    },
    delivery: {
        view: ['settings.delivery.view'],
        manage: ['settings.delivery.manage'],
    },
    payment: {
        view: ['settings.payment.view'],
        manage: ['settings.payment.manage'],
    },
    messages: {
        view: ['messages.view'],
        manage: ['messages.manage'],
    },
    legal: {
        view: ['settings.legal.view'],
        manage: ['settings.legal.manage'],
    },
    system: {
        view: ['settings.system.view'],
        manage: ['settings.system.manage'],
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

function AccessDenied({ message }: { message: string }) {
    return (
        <PageContainer
            title="Acesso Restrito"
            subtitle="Verificação de privilégios de segurança"
            category="Configurações"
            icon={<AlertCircle className="text-[#DC2626]" size={28} />}
            flat
        >
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm animate-fadeIn font-candara">
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-full text-red-500 mb-4">
                    <AlertCircle size={48} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    Acesso Restrito
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md">
                    {message}
                </p>
            </div>
        </PageContainer>
    );
}


export default function StoreSettings() {
    const { securityContext, loading: loadingSecurityContext } = useSecurityContext();

    const activeStoreIdFromStorage = getActiveStoreId();
    const fallbackStoreId = securityContext?.primary_membership?.store_id ?? null;
    const activeStoreId = activeStoreIdFromStorage ?? fallbackStoreId;

    const { loading: loadingPermissions, allowedPermissions } = usePermissions(activeStoreId);

    const activeMembership = useMemo(() => {
        const memberships = securityContext?.memberships ?? [];

        if (activeStoreId) {
            const membershipForActiveStore = memberships.find(
                (membership) => membership.store_id === activeStoreId
            );

            if (membershipForActiveStore) {
                return membershipForActiveStore;
            }
        }

        return resolveActiveMembership(
            securityContext?.memberships,
            securityContext?.primary_membership
        );
    }, [
        securityContext?.memberships,
        securityContext?.primary_membership,
        activeStoreId,
    ]);

    const isStoreOwner = activeMembership?.role === 'owner';

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const activeTab = searchParams.get('tab') || 'store';
    const [activeStoreSubTab, setActiveStoreSubTab] = useState('corporate');
    const hasExplicitPermission = useCallback((key: string) => {
        if (isStoreOwner) return true;

        if (Array.isArray(allowedPermissions)) {
            return allowedPermissions.includes(key);
        }

        return false;
    }, [isStoreOwner, allowedPermissions]);

    const canAccessSettingsRoot = isStoreOwner || hasExplicitPermission('settings.view');

    const canViewSettingsTab = useCallback((tab: keyof typeof settingsTabPermissions) => {
        if (!canAccessSettingsRoot) return false;
        if (isStoreOwner) return true;

        return settingsTabPermissions[tab].view.some((permission) =>
            hasExplicitPermission(permission)
        );
    }, [canAccessSettingsRoot, isStoreOwner, hasExplicitPermission]);

    const canManageSettingsTab = useCallback((tab: keyof typeof settingsTabPermissions) => {
        if (!canViewSettingsTab(tab)) return false;
        if (isStoreOwner) return true;

        return settingsTabPermissions[tab].manage.some((permission) =>
            hasExplicitPermission(permission)
        );
    }, [canViewSettingsTab, isStoreOwner, hasExplicitPermission]);

    const allowedTabs = useMemo(() => {
        if (loadingSecurityContext || loadingPermissions) return [];

        return SETTINGS_TABS.filter((tab) =>
            canViewSettingsTab(tab.id as keyof typeof settingsTabPermissions)
        );
    }, [canViewSettingsTab, loadingSecurityContext, loadingPermissions]);

    const canManageCurrentTab = useMemo(() => {
        return activeTab ? canManageSettingsTab(activeTab as keyof typeof settingsTabPermissions) : false;
    }, [activeTab, canManageSettingsTab]);
    // const canAccessRequestedTab = useMemo(() => {
    //     const tabKey = activeTab as keyof typeof settingsTabPermissions;
    //     if (!(tabKey in settingsTabPermissions)) return true;
    //     return canViewSettingsTab(tabKey);
    // }, [activeTab, canViewSettingsTab]);

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
        if (loadingSecurityContext || loadingPermissions || !activeMembership) return;

        if (!canAccessSettingsRoot) {
            navigate('/admin/my-profile', { replace: true });
            return;
        }

        const tabKey = activeTab as keyof typeof settingsTabPermissions;

        const requestedAllowed =
            tabKey in settingsTabPermissions &&
            allowedTabs.some((tab) => tab.id === activeTab);

        if (!requestedAllowed) {
            const firstAllowedTab = allowedTabs[0];

            if (firstAllowedTab) {
                navigate(`/admin/settings?tab=${firstAllowedTab.id}`, { replace: true });
            } else {
                navigate('/admin/my-profile', { replace: true });
            }
        }
    }, [
        loadingSecurityContext,
        loadingPermissions,
        activeMembership,
        canAccessSettingsRoot,
        activeTab,
        allowedTabs,
        navigate,
    ]);

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
                .rpc('get_store_settings_center', {
                    p_store_id: activeStoreId
                })
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
            toast.success('Alterações salvas com sucesso.');
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

        if (!canManageCurrentTab) {
            toast.error(NO_WRITE_PERMISSION_MESSAGE);
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

    if (!canAccessSettingsRoot) {
        return (
            <AccessDenied message="Você não tem permissão para acessar Configurações." />
        );
    }

    if (allowedTabs.length === 0) {
        return (
            <AccessDenied message="Você tem acesso à área de Configurações, mas nenhuma aba foi liberada para seu perfil." />
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
                    <LockedHint show={!canManageCurrentTab} />

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
                                {canManageCurrentTab && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                                        <label htmlFor="logo-upload" className="cursor-pointer text-white font-bold text-xs flex flex-col items-center">
                                            <span className="mb-1">Alterar</span>
                                            <FileText size={16} />
                                        </label>
                                    </div>
                                )}
                            </div>
                            {canManageCurrentTab && (
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
                                disabled={!canManageCurrentTab}
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
                                    disabled={!canManageCurrentTab}
                                />
                                {canManageCurrentTab && (
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

                    <PermissionLocked locked={!canManageCurrentTab}>
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
                                <CorporateTab store={store} setStore={setStore} disabled={!canManageCurrentTab} />
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
                                    disabled={!canManageCurrentTab}
                                />
                            )}
                            {activeStoreSubTab === 'contacts' && (
                                <ContactsTab store={store} setStore={setStore} disabled={!canManageCurrentTab} />
                            )}
                        </div>

                        {/* Save Button Area */}
                        {canManageCurrentTab && (
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
                    </PermissionLocked>
                </div>
            )}

            {/* RENDER SUB-PAGES WITH withoutHeader=true */}
            {activeTab === 'commercial' && (
                <div className="animate-fadeIn">
                    <LockedHint show={!canManageCurrentTab} />
                    <PermissionLocked locked={!canManageCurrentTab}>
                        <CommercialSettingsPage withoutHeader={true} disabled={!canManageCurrentTab} />
                    </PermissionLocked>
                </div>
            )}

            {activeTab === 'orders' && (
                <div className="animate-fadeIn">
                    <LockedHint show={!canManageCurrentTab} />
                    <PermissionLocked locked={!canManageCurrentTab}>
                        <Config withoutHeader={true} disabled={!canManageCurrentTab} />
                    </PermissionLocked>
                </div>
            )}

            {activeTab === 'stock' && (
                <div className="animate-fadeIn">
                    <LockedHint show={!canManageCurrentTab} />
                    <PermissionLocked locked={!canManageCurrentTab}>
                        <StockSettingsPage withoutHeader={true} disabled={!canManageCurrentTab} />
                    </PermissionLocked>
                </div>
            )}

            {activeTab === 'delivery' && (
                <div className="animate-fadeIn">
                    <LockedHint show={!canManageCurrentTab} />
                    <PermissionLocked locked={!canManageCurrentTab}>
                        <Delivery withoutHeader={true} disabled={!canManageCurrentTab} />
                    </PermissionLocked>
                </div>
            )}

            {activeTab === 'payment' && (
                <div className="animate-fadeIn">
                    <LockedHint show={!canManageCurrentTab} />
                    <PermissionLocked locked={!canManageCurrentTab}>
                        <PaymentMethodsPage withoutHeader={true} disabled={!canManageCurrentTab} />
                    </PermissionLocked>
                </div>
            )}

            {activeTab === 'messages' && (
                <div className="animate-fadeIn">
                    <LockedHint show={!canManageCurrentTab} />
                    <PermissionLocked locked={!canManageCurrentTab}>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <MessageCircle className="text-[#21A896]" size={22} />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    Configurações de Mensagens
                                </h3>
                            </div>

                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                As configurações de mensagens serão organizadas nesta área. Por enquanto,
                                a central de mensagens continua disponível no menu Comercial.
                            </p>
                        </div>
                    </PermissionLocked>
                </div>
            )}

            {activeTab === 'legal' && (
                <div className="space-y-6 animate-fadeIn">
                    <LockedHint show={!canManageCurrentTab} />

                    {message && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 shadow-sm border ${message.includes('Erro') ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                            {message.includes('Erro') ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                            <span className="font-medium">{message}</span>
                        </div>
                    )}

                    <PermissionLocked locked={!canManageCurrentTab}>
                        <form onSubmit={handleSave} noValidate className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden p-6 md:p-8">
                        <LegalTab
                            store={store}
                            setStore={setStore}
                            templatePrivacyPolicy={TEMPLATE_PRIVACY_POLICY}
                            templateTermsOfUse={TEMPLATE_TERMS_OF_USE}
                            templateCookiePolicy={TEMPLATE_COOKIE_POLICY}
                            disabled={!canManageCurrentTab}
                        />

                        {/* Save Button Area */}
                        {canManageCurrentTab && (
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
                    </PermissionLocked>
                </div>
            )}

            {activeTab === 'system' && (
                <div className="space-y-6 animate-fadeIn">
                    <LockedHint show={!canManageCurrentTab} />

                    {message && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 shadow-sm border ${message.includes('Erro') ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                            {message.includes('Erro') ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                            <span className="font-medium">{message}</span>
                        </div>
                    )}

                    <PermissionLocked locked={!canManageCurrentTab}>
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
                                        disabled={!canManageCurrentTab}
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
                                        disabled={!canManageCurrentTab}
                                    />
                                </div>
                            </div>
                        </section>
                        {canManageCurrentTab && (
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
                    </PermissionLocked>
                </div>
            )}
        </PageContainer>
    );
}
