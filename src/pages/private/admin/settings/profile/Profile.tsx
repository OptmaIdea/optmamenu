import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Save,
    Loader,
    Search,
    AlertCircle,
    CheckCircle,
    User,
    Phone,
    Mail,
    Building,
    MapPin,
    Contact,
    FileText,
    ExternalLink,
} from 'lucide-react';
import bcrypt from 'bcryptjs';

// Define types for our complex state
interface StoreData {
    id?: string;

    // Basic
    name: string;
    slug: string;
    description: string;
    logo_url: string | null;
    sms_gateway_token: string;
    stock_password_hash?: string;

    // Legal
    doc_type: 'PF' | 'PJ';
    document: string;
    legal_name: string;
    fantasy_name: string;
    establishment_type: string;

    // Address
    address: {
        zip_code: string;
        street: string;
        number: string;
        complement: string;
        neighborhood: string;
        city: string;
        state: string;
    };

    // Contacts
    contacts: {
        main_email: string;
        secondary_emails: string;
        phone_responsible: string;
        name_responsible: string;
        whatsapp_business: string;
        whatsapp_contact: string;
        social_media: string;
        website: string;
    };

    // Consents
    consents: {
        terms_accepted: boolean;
        lgpd_accepted: boolean;
        responsibility_accepted: boolean;
        no_illicit_accepted: boolean;
        channels: {
            whatsapp: boolean;
            sms: boolean;
            email: boolean;
        };
    };

    // Configuration
    config?: {
        opening_time?: string;
        closing_time?: string;
        custom_consent_text?: string;
        tolerance_minutes?: number;
        pre_order_minutes?: number;
        pin_failed_attempts?: number;
        pin_blocked?: boolean;
        pin_blocked_at?: string;
    };

    // Legal Texts & DPO
    privacy_policy_text?: string;
    terms_of_use_text?: string;
    cookie_policy_text?: string;
    dpo_email?: string;
    dpo_contact?: string;
}

interface IBGEState {
    id: number;
    sigla: string;
    nome: string;
}

interface IBGECity {
    id: number;
    nome: string;
}

// Helper to get initials
const getInitials = (name: string) => {
    return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

const TEMPLATE_PRIVACY_POLICY = `📄 POLÍTICA DE PRIVACIDADE
Última atualização: [Data atual]

1. Quem somos
[Nome da Loja] ("nós", "nosso") é uma plataforma digital desenvolvida para auxiliar clientes no acesso ao nosso cardápio e realização de pedidos.

2. Dados que coletamos
Coletamos apenas os dados necessários para o funcionamento do serviço:
- Dados obrigatórios: Nome completo e telefone (WhatsApp) para identificação do pedido.
- Endereço de entrega (quando aplicável).
- Histórico de pedidos realizados.

3. Finalidade do tratamento
Seus dados são utilizados exclusivamente para:
- Processar e entregar seus pedidos.
- Entrar em contato sobre o status do pedido via WhatsApp.
- Melhorar nosso atendimento e ofertas.

4. Base legal
O tratamento dos seus dados tem como base a execução de contrato (realização do pedido) e legítimo interesse.

5. Compartilhamento de dados
NÃO vendemos seus dados. Compartilhamos apenas quando necessário para entrega (entregadores parceiros) ou exigido por lei.

6. Seus direitos (LGPD)
Você tem direito a acessar, corrigir e excluir seus dados. Para exercer seus direitos, entre em contato conosco.`;

const TEMPLATE_TERMS_OF_USE = `📄 TERMOS DE USO

Aceitação dos termos
Ao realizar um pedido no [Nome da Loja], você concorda com estes Termos.

Uso permitido
Você pode navegar pelo cardápio e realizar pedidos para consumo próprio.

Uso proibido
É proibido realizar pedidos falsos ou tentar fraudar o sistema de qualquer forma.

Isenção de responsabilidade
Trabalhamos para manter o cardápio atualizado, mas preços e disponibilidade podem mudar sem aviso prévio.`;

const TEMPLATE_COOKIE_POLICY = `📄 POLÍTICA DE COOKIES

O que são cookies?
Pequenos arquivos de texto armazenados no seu dispositivo que ajudam o app a funcionar corretamente.

Cookies que utilizamos:
- Estritamente necessários: Para funcionamento do carrinho e sessão.
- Preferências: Para lembrar suas escolhas (ex: tema escuro, aceitação de cookies).

Gerenciamento
Você pode limpar os cookies manualmente pelas configurações do seu navegador a qualquer momento.`;

export default function Profile() {
    const [activeTab, setActiveTab] = useState('corporate');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [userData, setUserData] = useState<{ id: string; name: string; email: string; phone: string } | null>(
        null
    );

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
            zip_code: '',
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: '',
        },
        contacts: {
            main_email: '',
            secondary_emails: '',
            phone_responsible: '',
            name_responsible: '',
            whatsapp_business: '',
            whatsapp_contact: '',
            social_media: '',
            website: '',
        },
        consents: {
            terms_accepted: false,
            lgpd_accepted: false,
            responsibility_accepted: false,
            no_illicit_accepted: false,
            channels: { whatsapp: true, sms: true, email: true },
        },
        config: {
            opening_time: '',
            closing_time: '',
            custom_consent_text: '',
            tolerance_minutes: 5,
            pre_order_minutes: 20,
        },
        privacy_policy_text: '',
        terms_of_use_text: '',
        cookie_policy_text: '',
        dpo_email: '',
        dpo_contact: '',
    });

    useEffect(() => {
        fetchInitialData();
        fetchStates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Effect to load cities when state changes manually
    useEffect(() => {
        if (store.address.state) {
            fetchCities(store.address.state);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.address.state]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            // 0) Buscar dados adicionais da tabela profiles (se existir)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('name, phone, cpf')
                .eq('id', user.id)
                .maybeSingle();

            // Set User Metadata for Display (prioridade: profiles > auth metadata)
            setUserData({
                id: user.id,
                name: profileData?.name || user.user_metadata.full_name || 'N/A',
                phone: profileData?.phone || user.user_metadata.phone_number || 'N/A',
                email: user.email || 'N/A',
            });

            // 1) Buscar TODOS os dados da loja via RPC (agora retorna todos os campos)
            const { data: storeData, error: storeError } = await supabase.rpc('get_user_store_by_id', {
                p_user_id: user.id,
            });
            if (storeError) throw storeError;

            const store = Array.isArray(storeData) ? storeData[0] : storeData;

            if (store) {
                setStore((prev) => ({
                    ...prev,
                    ...store,
                    id: store.id,
                    address: { ...prev.address, ...(store.address || {}) },
                    contacts: { ...prev.contacts, ...(store.contacts || {}) },
                    consents: {
                        ...prev.consents,
                        ...(store.consents || {}),
                        channels: { ...prev.consents.channels, ...(store.consents?.channels || {}) },
                    },
                    sms_gateway_token: store.sms_gateway_token || '',
                    config: { ...prev.config, ...(store.config || {}) },
                }));
            }
        } catch (error) {
            console.error('Error fetching store:', error);
            setMessage('Erro ao carregar os dados da loja.');
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
            console.error('Error fetching states', e);
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
            console.error('Error fetching cities', e);
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

            setStore((prev) => ({
                ...prev,
                address: {
                    ...prev.address,
                    street: data.logradouro,
                    neighborhood: data.bairro,
                    city: data.localidade,
                    state: data.uf,
                },
            }));
            setMessage('Endereço encontrado!');
        } catch (e) {
            console.error('CEP error', e);
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
            const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file);

            if (uploadError) throw uploadError;

            const {
                data: { publicUrl },
            } = supabase.storage.from('logos').getPublicUrl(filePath);

            setStore((prev) => ({ ...prev, logo_url: publicUrl }));
            setMessage('Logo carregada com sucesso! Não esqueça de salvar.');
        } catch (error: any) {
            setMessage('Erro ao enviar logo: ' + (error?.message || ''));
        } finally {
            setLoading(false);
        }
    };

    const persistStoreData = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');

            // 1) Update User Metadata (Name) if changed
            if (userData && userData.name !== user.user_metadata.full_name) {
                const { error: authError } = await supabase.auth.updateUser({
                    data: { full_name: userData.name },
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
                user_id: user.id,
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

                // Legal
                privacy_policy_text: store.privacy_policy_text,
                terms_of_use_text: store.terms_of_use_text,
                cookie_policy_text: store.cookie_policy_text,
                dpo_email: store.dpo_email,
                dpo_contact: store.dpo_contact,
            };

            const { error } = store.id
                ? await supabase.from('stores').update(payload).eq('id', store.id)
                : await supabase.from('stores').insert([payload]);

            if (error) throw error;

            setMessage('Dados salvos com sucesso!');

            // ✅ Limpar campo de senha após salvar
            setStockPassword('');

            if (!store.id) fetchInitialData();
        } catch (error: any) {
            if (error?.code === '23505' && String(error?.message || '').includes('slug')) {
                setMessage('Erro: Este Link da Loja (slug) já está em uso. Escolha outro.');
            } else {
                setMessage('Erro ao salvar: ' + (error?.message || ''));
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

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
                setActiveTab(req.tab);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

        // Consent validation
        if (!store.consents.terms_accepted || !store.consents.no_illicit_accepted) {
            setMessage('Erro: Você precisa aceitar os termos e declarações legais na aba "Legal & Termos".');
            setActiveTab('legal');
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

    const tabs = [
        { id: 'corporate', label: 'Dados Corporativos', icon: Building },
        { id: 'address', label: 'Endereço', icon: MapPin },
        { id: 'contacts', label: 'Contatos', icon: Contact },
        { id: 'legal', label: 'Legal & Termos', icon: FileText },
    ];

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-black text-gray-800 dark:text-gray-100 mb-2">Dados da Loja</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">Preencha as informações para ativar seu cardápio digital.</p>

            {message && (
                <div
                    className={`p-4 rounded-xl mb-6 flex items-center gap-3 shadow-sm border ${message.includes('Erro')
                            ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                            : 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                        }`}
                >
                    {message.includes('Erro') ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                    <span className="font-medium">{message}</span>
                </div>
            )}

            {/* Logo & Identity Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 flex flex-col md:flex-row items-center gap-8">
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
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                            <label htmlFor="logo-upload" className="cursor-pointer text-white font-bold text-xs flex flex-col items-center">
                                <span className="mb-1">Alterar</span>
                                <FileText size={16} />
                            </label>
                        </div>
                    </div>
                    <label
                        htmlFor="logo-upload"
                        className="absolute bottom-0 right-0 bg-brand-green text-white p-2 rounded-full shadow-md cursor-pointer hover:brightness-110 transition"
                    >
                        <User size={16} />
                    </label>
                    <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>

                <div className="flex-1 text-center md:text-left">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Identidade Visual</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                        Adicione a logo da sua marca. Ela aparecerá no topo do seu cardápio e no cabeçalho.
                        <br />
                        Formato recomendado: JPG ou PNG quadrado, max 2MB.
                    </p>
                </div>
            </div>

            {/* User Metadata Header */}
            <section className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-8">
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
                            className="font-bold text-gray-700 dark:text-gray-200 bg-transparent outline-none w-40"
                            value={userData?.name || ''}
                            onChange={(e) => setUserData((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                            placeholder="Seu Nome"
                        />
                        <span
                            className="text-xs text-brand-green cursor-pointer hover:underline"
                            title="O nome será salvo ao clicar em 'Salvar Alterações'"
                        >
                            Editar
                        </span>
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

            <form onSubmit={handleSave} noValidate className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Tabs Header */}
                <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id
                                    ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-900/10'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-6 md:p-8">
                    {/* 1. DADOS CORPORATIVOS */}
                    <div className={activeTab === 'corporate' ? 'block space-y-6 animate-fadeIn' : 'hidden'}>
                        <div className="flex gap-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="doc_type"
                                    checked={store.doc_type === 'PF'}
                                    onChange={() => setStore({ ...store, doc_type: 'PF' })}
                                    className="accent-brand-green w-5 h-5"
                                />
                                <span className="font-bold text-gray-700 dark:text-gray-200">Pessoa Física</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="doc_type"
                                    checked={store.doc_type === 'PJ'}
                                    onChange={() => setStore({ ...store, doc_type: 'PJ' })}
                                    className="accent-brand-green w-5 h-5"
                                />
                                <span className="font-bold text-gray-700 dark:text-gray-200">Pessoa Jurídica</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    {store.doc_type === 'PF' ? 'Nome Completo' : 'Razão Social'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                    value={store.legal_name || ''}
                                    onChange={(e) => setStore({ ...store, legal_name: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    {store.doc_type === 'PF' ? 'CPF' : 'CNPJ'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                    value={store.document || ''}
                                    placeholder={store.doc_type === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'}
                                    onChange={(e) => setStore({ ...store, document: e.target.value })}
                                    required
                                />
                            </div>

                            {store.doc_type === 'PJ' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nome Fantasia</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                            value={store.fantasy_name || ''}
                                            onChange={(e) => setStore({ ...store, fantasy_name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tipo de Estabelecimento</label>
                                        <select
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                            value={store.establishment_type || ''}
                                            onChange={(e) => setStore({ ...store, establishment_type: e.target.value })}
                                        >
                                            <option value="Matriz">Matriz</option>
                                            <option value="Filial">Filial</option>
                                            <option value="Depósito">Depósito</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Como sua loja aparece para o cliente</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Nome da Loja (Marca Visual) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                        value={store.name || ''}
                                        onChange={(e) => setStore({ ...store, name: e.target.value })}
                                        placeholder="Ex: Gelinhares"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Link da Loja (Slug) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="flex flex-1">
                                            <span className="bg-gray-100 dark:bg-gray-800 border border-r-0 border-gray-300 dark:border-gray-600 p-3 rounded-l-lg text-gray-500 dark:text-gray-400 text-sm flex items-center select-none font-mono tracking-tighter">
                                                {typeof window !== 'undefined' ? window.location.host : ''}/s/
                                            </span>
                                            <input
                                                type="text"
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-r-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition lowercase font-bold"
                                                value={store.slug || ''}
                                                onChange={(e) =>
                                                    setStore({ ...store, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
                                                }
                                                placeholder="sua-loja"
                                                required
                                            />
                                        </div>
                                        {store.slug && (
                                            <a
                                                href={typeof window !== 'undefined' ? `${window.location.origin}/s/${store.slug}` : '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-brand-green/10 text-brand-green border border-brand-green/20 hover:bg-brand-green hover:text-white p-3 rounded-lg transition-colors flex items-center justify-center min-w-[3rem]"
                                                title="Acessar Cardápio"
                                            >
                                                <ExternalLink size={20} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Descrição Curta</label>
                                    <textarea
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none h-24 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                        value={store.description || ''}
                                        onChange={(e) => setStore({ ...store, description: e.target.value })}
                                        placeholder="Ex: O melhor açaí da região, entregue rapidinho!"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. ENDEREÇO */}
                    <div className={activeTab === 'address' ? 'block grid grid-cols-1 md:grid-cols-4 gap-6 animate-fadeIn' : 'hidden'}>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CEP</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                    value={store.address.zip_code || ''}
                                    placeholder="00000-000"
                                    onChange={(e) => setStore({ ...store, address: { ...store.address, zip_code: e.target.value } })}
                                    onBlur={handleZipLookup}
                                />
                                <button
                                    type="button"
                                    onClick={handleZipLookup}
                                    disabled={searchingCep}
                                    className="p-3 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition text-gray-600 dark:text-white disabled:opacity-50"
                                >
                                    {searchingCep ? <Loader size={20} className="animate-spin" /> : <Search size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Logradouro</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.address.street || ''}
                                onChange={(e) => setStore({ ...store, address: { ...store.address, street: e.target.value } })}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Número</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.address.number || ''}
                                onChange={(e) => setStore({ ...store, address: { ...store.address, number: e.target.value } })}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Complemento</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.address.complement || ''}
                                onChange={(e) => setStore({ ...store, address: { ...store.address, complement: e.target.value } })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bairro</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.address.neighborhood || ''}
                                onChange={(e) => setStore({ ...store, address: { ...store.address, neighborhood: e.target.value } })}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Estado (UF)</label>
                            <select
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.address.state || ''}
                                onChange={(e) => setStore({ ...store, address: { ...store.address, state: e.target.value, city: '' } })}
                            >
                                <option value="">Selecione...</option>
                                {states.map((uf) => (
                                    <option key={uf.id} value={uf.sigla}>
                                        {uf.sigla}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex justify-between">
                                Cidade
                                {loadingCities && (
                                    <span className="text-xs text-brand-green flex items-center gap-1">
                                        <Loader size={12} className="animate-spin" /> Carregando...
                                    </span>
                                )}
                            </label>
                            {store.address.state ? (
                                <select
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                    value={store.address.city || ''}
                                    onChange={(e) => setStore({ ...store, address: { ...store.address, city: e.target.value } })}
                                    disabled={loadingCities}
                                >
                                    <option value="">Selecione a cidade...</option>
                                    {cities.map((city) => (
                                        <option key={city.id} value={city.nome}>
                                            {city.nome}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500"
                                    value={store.address.city}
                                    placeholder="Selecione o estado primeiro"
                                    readOnly
                                />
                            )}
                        </div>
                    </div>

                    {/* 3. CONTATOS */}
                    <div className={activeTab === 'contacts' ? 'block grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn' : 'hidden'}>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">E-mail Principal</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-500"
                                    value={store.contacts.main_email}
                                    readOnly
                                />
                                {store.contacts.main_email && (
                                    <a
                                        href={`mailto:${store.contacts.main_email}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute right-3 top-3 text-brand-green hover:text-brand-green/80"
                                        title="Enviar E-mail"
                                    >
                                        <Mail size={20} />
                                    </a>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">E-mails Secundários</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.contacts.secondary_emails}
                                onChange={(e) => setStore({ ...store, contacts: { ...store.contacts, secondary_emails: e.target.value } })}
                                placeholder="Separe por vírgula"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nome do Responsável</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.contacts.name_responsible}
                                onChange={(e) => setStore({ ...store, contacts: { ...store.contacts, name_responsible: e.target.value } })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Celular do Responsável</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.contacts.phone_responsible}
                                onChange={(e) => setStore({ ...store, contacts: { ...store.contacts, phone_responsible: e.target.value } })}
                            />
                        </div>

                        <div className="md:col-span-2 border-t border-gray-100 dark:border-gray-700 mt-2 pt-4">
                            {/* SMS Gateway Integration moved to MessageSettings */}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">WhatsApp Adicional (Atendimento)</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.contacts.whatsapp_contact}
                                onChange={(e) => setStore({ ...store, contacts: { ...store.contacts, whatsapp_contact: e.target.value } })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Site / Rede Social</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.contacts.social_media}
                                onChange={(e) => setStore({ ...store, contacts: { ...store.contacts, social_media: e.target.value } })}
                            />
                        </div>
                    </div>

                    {/* 5. LEGAL & TERMOS */}
                    <div className={activeTab === 'legal' ? 'block animate-fadeIn' : 'hidden'}>
                        {/* DPO Section */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 mb-8">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <User size={20} className="text-blue-600 dark:text-blue-400" />
                                Encarregado de Dados (DPO)
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Informações de contato do responsável pela proteção de dados, exigido pela LGPD.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">E-mail do DPO</label>
                                    <input
                                        type="email"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        value={store.dpo_email || ''}
                                        onChange={(e) => setStore({ ...store, dpo_email: e.target.value })}
                                        placeholder="dpo@suaempresa.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Outro Contato (Telefone/Endereço)</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        value={store.dpo_contact || ''}
                                        onChange={(e) => setStore({ ...store, dpo_contact: e.target.value })}
                                        placeholder="Ex: (11) 99999-9999"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Legal Documents */}
                        <div className="space-y-8">
                            {/* Privacy Policy */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Política de Privacidade</label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setStore({
                                                ...store,
                                                privacy_policy_text: TEMPLATE_PRIVACY_POLICY.replace('[Nome da Loja]', store.name).replace(
                                                    '[Data atual]',
                                                    new Date().toLocaleDateString()
                                                ),
                                            })
                                        }
                                        className="text-xs text-brand-green hover:underline font-bold"
                                    >
                                        Preencher com Modelo Padrão
                                    </button>
                                </div>
                                <textarea
                                    className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none h-64 font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                                    value={store.privacy_policy_text || ''}
                                    onChange={(e) => setStore({ ...store, privacy_policy_text: e.target.value })}
                                    placeholder="# Política de Privacidade..."
                                />
                            </div>

                            {/* Terms of Use */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Termos de Uso</label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setStore({
                                                ...store,
                                                terms_of_use_text: TEMPLATE_TERMS_OF_USE.replace('[Nome da Loja]', store.name),
                                            })
                                        }
                                        className="text-xs text-brand-green hover:underline font-bold"
                                    >
                                        Preencher com Modelo Padrão
                                    </button>
                                </div>
                                <textarea
                                    className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none h-64 font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                                    value={store.terms_of_use_text || ''}
                                    onChange={(e) => setStore({ ...store, terms_of_use_text: e.target.value })}
                                    placeholder="# Termos de Uso..."
                                />
                            </div>

                            {/* Cookie Policy */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Política de Cookies</label>
                                    <button
                                        type="button"
                                        onClick={() => setStore({ ...store, cookie_policy_text: TEMPLATE_COOKIE_POLICY })}
                                        className="text-xs text-brand-green hover:underline font-bold"
                                    >
                                        Preencher com Modelo Padrão
                                    </button>
                                </div>
                                <textarea
                                    className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none h-48 font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                                    value={store.cookie_policy_text || ''}
                                    onChange={(e) => setStore({ ...store, cookie_policy_text: e.target.value })}
                                    placeholder="# Política de Cookies..."
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Consents e Declarações</h3>
                            <div className="space-y-4">
                                <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                    <input
                                        type="checkbox"
                                        className="mt-1 accent-brand-green w-5 h-5"
                                        checked={store.consents.terms_accepted}
                                        onChange={(e) => setStore({ ...store, consents: { ...store.consents, terms_accepted: e.target.checked } })}
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                        Declaro que li e aceito os Termos de Uso e a Política de Privacidade da plataforma.
                                    </span>
                                </label>

                                <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                    <input
                                        type="checkbox"
                                        className="mt-1 accent-brand-green w-5 h-5"
                                        checked={store.consents.responsibility_accepted}
                                        onChange={(e) =>
                                            setStore({ ...store, consents: { ...store.consents, responsibility_accepted: e.target.checked } })
                                        }
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                        Reconheço que sou inteiramente responsável pelas informações cadastradas e pelos produtos vendidos.
                                    </span>
                                </label>

                                <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                    <input
                                        type="checkbox"
                                        className="mt-1 accent-brand-green w-5 h-5"
                                        checked={store.consents.no_illicit_accepted}
                                        onChange={(e) => setStore({ ...store, consents: { ...store.consents, no_illicit_accepted: e.target.checked } })}
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                        Declaro que não utilizarei a plataforma para fins ilícitos e que sou o único responsável pelo conteúdo inserido.
                                    </span>
                                </label>
                            </div>

                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Canais de Comunicação Autorizados:</p>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <input
                                            type="checkbox"
                                            checked={store.consents.channels.whatsapp}
                                            onChange={(e) =>
                                                setStore({
                                                    ...store,
                                                    consents: {
                                                        ...store.consents,
                                                        channels: { ...store.consents.channels, whatsapp: e.target.checked },
                                                    },
                                                })
                                            }
                                            className="accent-brand-green"
                                        />{' '}
                                        WhatsApp
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <input
                                            type="checkbox"
                                            checked={store.consents.channels.sms}
                                            onChange={(e) =>
                                                setStore({
                                                    ...store,
                                                    consents: {
                                                        ...store.consents,
                                                        channels: { ...store.consents.channels, sms: e.target.checked },
                                                    },
                                                })
                                            }
                                            className="accent-brand-green"
                                        />{' '}
                                        SMS
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <input
                                            type="checkbox"
                                            checked={store.consents.channels.email}
                                            onChange={(e) =>
                                                setStore({
                                                    ...store,
                                                    consents: {
                                                        ...store.consents,
                                                        channels: { ...store.consents.channels, email: e.target.checked },
                                                    },
                                                })
                                            }
                                            className="accent-brand-green"
                                        />{' '}
                                        E-mail
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Save Button Area */}
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving || !store.consents.terms_accepted || !store.consents.no_illicit_accepted}
                            className="flex items-center gap-3 bg-brand-green text-white px-8 py-3 rounded-xl font-bold text-lg hover:brightness-90 shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!store.consents.terms_accepted ? 'Aceite os termos para salvar' : ''}
                        >
                            <Save size={24} />
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}