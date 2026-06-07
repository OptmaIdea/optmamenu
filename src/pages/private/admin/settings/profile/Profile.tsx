import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    Save,
    Loader,
    User,
    Phone,
    Mail,
    MapPin,
    Contact,
    Camera,
    Globe,
    Instagram,
    Facebook,
    Search,
    AlertTriangle,
    Plus,
    Info,
    History,
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import {
    updateMyStoreMemberProfile,
    updateMyProfileDetails,
    completeMyStoreMemberOnboarding,
    createMyProfileChangeRequest,
    listMyProfileChangeRequests,
    PROFILE_REQUEST_STATUS_LABELS,
    PROFILE_REQUEST_TYPE_LABELS,
    type ProfileChangeRequest,
    type ProfileChangeRequestType
} from '@/services/securityService';
import { uploadStoreMemberAvatar } from '@/services/userAvatarService';
import { getActiveStoreId } from '@/utils/activeStore';
import { InfoCard } from '@/components/common/InfoCard';

interface AdditionalInfo {
    id: string;
    title: string;
    text: string;
    sensitive: boolean;
    created_at?: string;
    isNew?: boolean;
}

interface ProfileData {
    name: string;
    internal_alias: string;
    phone: string;
    mobile_phone: string;
    whatsapp_phone: string;
    whatsapp_same_as_mobile: boolean;
    birthdate: string;
    zip_code: string;
    address: string;
    address_number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    instagram_url: string;
    facebook_url: string;
    website_url: string;
    avatar_url: string;
    cpf: string;
    member_email: string;
    additionalInfo: AdditionalInfo[];
}

function generateUUID(): string {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
}

function formatCep(value: string): string {
    const digits = onlyDigits(value).slice(0, 8);

    if (digits.length <= 5) return digits;

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatMobile(value: string): string {
    const digits = onlyDigits(value).slice(0, 11);

    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatLandline(value: string): string {
    const digits = onlyDigits(value).slice(0, 10);

    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

function isValidMobile(value: string): boolean {
    const digits = onlyDigits(value);
    return digits.length === 11 && digits[2] === '9';
}

function isValidLandline(value: string): boolean {
    const digits = onlyDigits(value);
    return digits.length === 0 || digits.length === 10;
}

function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

const getInitials = (name: string) => {
    return name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'U';
};

export default function Profile() {
    const { securityContext, refresh: refreshSecurityContext, loading: loadingSecurity } = useSecurityContext();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [isCpfDisabled, setIsCpfDisabled] = useState(false);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setPortalContainer(document.getElementById('quick-access-actions-portal'));
    }, []);

    const memberships = securityContext?.memberships || [];
    const selectedMembership = securityContext?.primary_membership || securityContext?.memberships?.[0] || null;
    const activeStoreId = selectedMembership?.store_id ?? getActiveStoreId() ?? null;

    const [removalRequestModal, setRemovalRequestModal] = useState<{
        isOpen: boolean;
        item: AdditionalInfo | null;
        reason: string;
        saving: boolean;
    }>({
        isOpen: false,
        item: null,
        reason: '',
        saving: false,
    });

    const [myRequests, setMyRequests] = useState<ProfileChangeRequest[]>([]);
    const [loadingMyRequests, setLoadingMyRequests] = useState(false);

    const [generalRequestModal, setGeneralRequestModal] = useState<{
        isOpen: boolean;
        requestType: ProfileChangeRequestType;
        requestedValue: string;
        reason: string;
        saving: boolean;
    }>({
        isOpen: false,
        requestType: 'name_change',
        requestedValue: '',
        reason: '',
        saving: false,
    });

    const loadMyProfileRequests = useCallback(async () => {
        if (!activeStoreId) return;

        setLoadingMyRequests(true);
        try {
            const rows = await listMyProfileChangeRequests(activeStoreId, 100);
            setMyRequests(rows);
        } catch (error) {
            console.error(error);
            toast.error('Não foi possível carregar suas solicitações cadastrais.');
        } finally {
            setLoadingMyRequests(false);
        }
    }, [activeStoreId]);

    useEffect(() => {
        void loadMyProfileRequests();
    }, [loadMyProfileRequests]);

    const isOwnerSomewhere = memberships.some((m) => m.role === 'owner');
    const isOwnerInCurrentStore = selectedMembership?.role === 'owner';

    const canEditGlobalProfile =
        isOwnerInCurrentStore;
    // depois podemos sofisticar para owner de empresa própria etc.

    const isOnboardingPending =
        selectedMembership?.onboarding_required === true ||
        !selectedMembership?.onboarding_completed_at;

    // States & Cities from IBGE
    const [states, setStates] = useState<IBGEState[]>([]);
    const [cities, setCities] = useState<IBGECity[]>([]);
    const [loadingCities, setLoadingCities] = useState(false);
    const [searchingCep, setSearchingCep] = useState(false);

    const [profile, setProfile] = useState<ProfileData>({
        name: '',
        internal_alias: '',
        phone: '',
        mobile_phone: '',
        whatsapp_phone: '',
        whatsapp_same_as_mobile: false,
        birthdate: '',
        zip_code: '',
        address: '',
        address_number: '',
        complement: '',
        district: '',
        city: '',
        state: '',
        instagram_url: '',
        facebook_url: '',
        website_url: '',
        avatar_url: '',
        cpf: '',
        member_email: '',
        additionalInfo: [],
    });

    useEffect(() => {
        fetchStates();
    }, []);

    useEffect(() => {
        if (!loadingSecurity) {
            fetchUserProfile();
        }
    }, [loadingSecurity]);

    useEffect(() => {
        if (profile.state) {
            fetchCities(profile.state);
        }
    }, [profile.state]);

    const fetchUserProfile = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) throw error;

            // 9.9H.10 — Profile.tsx: correção de carregamento
            const activeStoreId = getActiveStoreId();
            let memberRow: any = null;

            if (activeStoreId && user) {
                const { data } = await supabase
                    .from('store_members')
                    .select(`
                        internal_alias,
                        member_email,
                        member_phone,
                        member_mobile_phone,
                        member_whatsapp_phone,
                        member_avatar_url,
                        member_zip_code,
                        member_address,
                        member_address_number,
                        member_complement,
                        member_district,
                        member_city,
                        member_state,
                        member_additional_info
                    `)
                    .eq('user_id', user.id)
                    .eq('store_id', activeStoreId)
                    .maybeSingle();
                memberRow = data;
            }

            if (profileData) {
                const rawMobile = memberRow?.member_mobile_phone || profileData.mobile_phone || '';
                const rawWhatsapp = memberRow?.member_whatsapp_phone || profileData.whatsapp_phone || '';
                const rawPhone = memberRow?.member_phone || profileData.phone || '';

                const formattedMobile = formatMobile(rawMobile);
                const formattedWhatsapp = formatMobile(rawWhatsapp);
                const formattedPhone = formatLandline(rawPhone);

                const isSame =
                    onlyDigits(rawMobile) &&
                    onlyDigits(rawWhatsapp) &&
                    onlyDigits(rawMobile) === onlyDigits(rawWhatsapp);

                // Processar informações adicionais
                const additionalInfo = memberRow?.member_additional_info ?
                    memberRow.member_additional_info.map((item: any) => ({
                        id: item.id || generateUUID(),
                        title: item.title || '',
                        text: item.text || '',
                        sensitive: Boolean(item.sensitive),
                        created_at: item.created_at || new Date().toISOString(),
                    })) : [];

                setProfile({
                    name: profileData.name || '',
                    cpf: profileData.cpf || '',
                    birthdate: profileData.birthdata || profileData.birthdate || '',

                    internal_alias: memberRow?.internal_alias || '',
                    phone: formattedPhone,
                    mobile_phone: formattedMobile,
                    whatsapp_phone: formattedWhatsapp,
                    whatsapp_same_as_mobile: !!isSame,
                    avatar_url: memberRow?.member_avatar_url || profileData.avatar_url || '',

                    zip_code: formatCep(memberRow?.member_zip_code || profileData.zip_code || ''),
                    address: memberRow?.member_address || profileData.address || '',
                    address_number: memberRow?.member_address_number || profileData.address_number || '',
                    complement: memberRow?.member_complement || profileData.complement || '',
                    district: memberRow?.member_district || profileData.district || '',
                    city: memberRow?.member_city || profileData.city || '',
                    state: memberRow?.member_state || profileData.state || '',

                    instagram_url: profileData.instagram_url || '',
                    facebook_url: profileData.facebook_url || '',
                    website_url: profileData.website_url || '',
                    member_email: memberRow?.member_email || '',
                    additionalInfo,
                });

                // CPF is read-only if it is already pre-filled
                setIsCpfDisabled(!!profileData.cpf);
            }

        } catch (error: any) {
            console.error('Error fetching user profile:', error);
            toast.error('Erro ao carregar dados do perfil.');
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

    const handleZipLookup = async () => {
        const cep = profile.zip_code?.replace(/\D/g, '') || '';
        if (cep.length !== 8) {
            if (cep.length > 0) toast.error('CEP inválido. Digite 8 números.');
            return;
        }

        setSearchingCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) {
                toast.error('CEP não encontrado.');
                return;
            }

            setProfile((prev) => ({
                ...prev,
                address: data.logradouro || '',
                district: data.bairro || '',
                city: data.localidade || '',
                state: data.uf || '',
            }));
            toast.success('Endereço preenchido!');
        } catch (e) {
            console.error('CEP error', e);
            toast.error('Erro ao buscar o CEP.');
        } finally {
            setSearchingCep(false);
        }
    };

    const handleMobileChange = (value: string) => {
        const formatted = formatMobile(value);

        setProfile((current) => ({
            ...current,
            mobile_phone: formatted,
            whatsapp_phone: current.whatsapp_same_as_mobile
                ? formatted
                : current.whatsapp_phone,
        }));
    };

    const handleAddAdditionalInfo = () => {
        setProfile((current) => ({
            ...current,
            additionalInfo: [
                ...current.additionalInfo,
                {
                    id: generateUUID(),
                    title: '',
                    text: '',
                    sensitive: false,
                    created_at: new Date().toISOString(),
                    isNew: true,
                },
            ],
        }));
    };

    const handleRequestRemoveAdditionalInfo = (index: number) => {
        const item = profile.additionalInfo[index];
        setRemovalRequestModal({
            isOpen: true,
            item,
            reason: '',
            saving: false,
        });
    };

    const handleUpdateAdditionalInfo = (index: number, field: keyof AdditionalInfo, value: string | boolean) => {
        setProfile((current) => ({
            ...current,
            additionalInfo: current.additionalInfo.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            ),
        }));
    };

    const handleRemoveAdditionalInfo = (index: number) => {
        setProfile((current) => ({
            ...current,
            additionalInfo: current.additionalInfo.filter((_, i) => i !== index),
        }));
    };

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setSavingAvatar(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');

            // Get primary membership or first member to pass to userAvatarService
            const primaryMembership = securityContext?.primary_membership || securityContext?.memberships?.[0] || null;
            if (!primaryMembership) {
                throw new Error('Nenhum vínculo de loja ativo para upload.');
            }

            const { avatarUrl } = await uploadStoreMemberAvatar({
                memberId: primaryMembership.member_id,
                userId: user.id,
                file,
                reason: 'Alteração de avatar pessoal.',
            });

            setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
            toast.success('Foto de perfil atualizada.');

            // Dispatch refresh event to update sidebar
            await refreshSecurityContext();
            window.dispatchEvent(new CustomEvent('optmamenu:security-context-refresh'));
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            toast.error(error?.message || 'Erro ao fazer upload da foto de perfil.');
        } finally {
            setSavingAvatar(false);
            event.target.value = '';
        }
    };

    const handleSave = async (e?: React.SyntheticEvent) => {
        e?.preventDefault();

        if (!profile.name.trim()) {
            toast.error('O campo "Nome Completo" é obrigatório.');
            return;
        }

        const mobileDigits = onlyDigits(profile.mobile_phone);
        const whatsappDigits = onlyDigits(profile.whatsapp_phone);
        const phoneDigits = onlyDigits(profile.phone);

        if (!isValidMobile(profile.mobile_phone)) {
            toast.error('Informe um celular válido com DDD e 9 dígitos (começando com 9).');
            return;
        }

        if (!isValidMobile(profile.whatsapp_phone)) {
            toast.error('Informe um WhatsApp válido com DDD e 9 dígitos (começando com 9).');
            return;
        }

        if (!isValidLandline(profile.phone)) {
            toast.error('Informe um telefone fixo válido com DDD e 8 dígitos, ou deixe em branco.');
            return;
        }

        if (!profile.member_email.trim()) {
            toast.info('Para receber notificações importantes, preencha o e-mail de contato.');
        } else if (!isValidEmail(profile.member_email)) {
            toast.error('Por favor, informe um e-mail com formato válido (ex: contato@empresa.com).');
            return;
        }

        try {
            setSaving(true);
            const wasOnboardingPending = isOnboardingPending;

            // FIX.2 & 9.9H.10: Salva dados pessoais (profiles) e dados do vínculo (store_members)
            const activeStoreId = getActiveStoreId();

            if (canEditGlobalProfile) {
                // Apenas dados verdadeiramente globais do perfil (tabela profiles).
                // Campos de contato/endereço são gerenciados por store_members abaixo.
                await updateMyProfileDetails({
                    name: profile.name,
                    cpf: profile.cpf || null,
                    birthdate: profile.birthdate || null,
                    instagramUrl: profile.instagram_url || null,
                    facebookUrl: profile.facebook_url || null,
                    websiteUrl: profile.website_url || null,
                });
            }

            if (activeStoreId) {
                // Processar informações adicionais
                const memberAdditionalInfo = profile.additionalInfo
                    .filter((item) => item.title.trim() || item.text.trim())
                    .map((item) => ({
                        id: item.id,
                        title: item.title.trim(),
                        text: item.text.trim(),
                        sensitive: Boolean(item.sensitive),
                        created_at: item.created_at || new Date().toISOString(),
                    }));

                if (isOnboardingPending) {
                    await completeMyStoreMemberOnboarding({
                        storeId: activeStoreId,
                        internalAlias: profile.internal_alias || null,
                        memberEmail: profile.member_email || null,
                        memberPhone: phoneDigits || null,
                        memberMobilePhone: mobileDigits || null,
                        memberWhatsappPhone: whatsappDigits || null,
                        memberZipCode: onlyDigits(profile.zip_code) || null,
                        memberAddress: profile.address || null,
                        memberAddressNumber: profile.address_number || null,
                        memberComplement: profile.complement || null,
                        memberDistrict: profile.district || null,
                        memberCity: profile.city || null,
                        memberState: profile.state || null,
                        memberAdditionalInfo,
                    });
                } else {
                    await updateMyStoreMemberProfile({
                        storeId: activeStoreId,
                        internalAlias: profile.internal_alias || null,
                        memberEmail: profile.member_email || null,
                        memberPhone: phoneDigits || null,
                        memberMobilePhone: mobileDigits || null,
                        memberWhatsappPhone: whatsappDigits || null,
                        memberZipCode: onlyDigits(profile.zip_code) || null,
                        memberAddress: profile.address || null,
                        memberAddressNumber: profile.address_number || null,
                        memberComplement: profile.complement || null,
                        memberDistrict: profile.district || null,
                        memberCity: profile.city || null,
                        memberState: profile.state || null,
                        memberAdditionalInfo,
                    });
                }
            }

            if (wasOnboardingPending) {
                toast.success('Cadastro inicial concluído. Acesso liberado.');
            } else {
                toast.success('Perfil atualizado com sucesso!');
            }

            // Disparar recarga do contexto de segurança e atualizar sidebar/header
            await refreshSecurityContext();
            window.dispatchEvent(new CustomEvent('optmamenu:security-context-refresh'));

            // Se CPF foi preenchido com sucesso, desabilita para novas edições
            if (profile.cpf) {
                setIsCpfDisabled(true);
            }
        } catch (error: any) {
            console.error('Error saving profile:', error);
            toast.error(error?.message || 'Erro ao salvar alterações.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Loader className="animate-spin text-[#21A896]" size={32} />
            </div>
        );
    }

    return (
        <PageContainer
            title="Meus Dados"
            subtitle="Gerencie suas informações pessoais e de contato."
            category="Configurações"
            icon={<User className="text-[#21A896]" size={28} />}
            flat
        >
            {portalContainer && createPortal(
                <>
                    <Link
                        to="/admin/my-history"
                        title="Histórico de alterações no perfil"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition hover:border-[#21A896]/35 shrink-0 shadow-sm cursor-pointer"
                    >
                        <History size={13} />
                        <span>Histórico de alterações</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setGeneralRequestModal({
                            isOpen: true,
                            requestType: 'name_change',
                            requestedValue: '',
                            reason: '',
                            saving: false,
                        })}
                        className="flex items-center gap-2 rounded-lg bg-[#F26541] hover:bg-[#d85535] px-3 py-2 text-sm font-bold text-white shadow-sm transition cursor-pointer"
                    >
                        <Plus size={16} />
                        Solicitar Alteração
                    </button>
                </>,
                portalContainer
            )}
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                }}
                noValidate
                className="max-w-4xl mx-auto space-y-8"
            >
                {/* 9.9K.5 — Aviso de onboarding pendente */}
                {isOnboardingPending && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 text-sm text-amber-800 dark:text-amber-200">
                        Complete seus dados básicos para liberar o acesso às demais áreas da loja.
                    </div>
                )}

                {isOwnerSomewhere && !isOwnerInCurrentStore && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 text-sm text-amber-800 dark:text-amber-200 flex gap-3 items-start shadow-sm">
                        <AlertTriangle className="shrink-0 text-amber-500 mt-0.5" size={18} />
                        <div>
                            <span className="font-bold block mb-1">Apenas dados de vínculo editáveis</span>
                            Estes dados fazem parte do seu cadastro principal no OptmaMenu e são reaproveitados em outras empresas. Para esta loja, você pode personalizar apelido, contatos, avatar e endereço de correspondência.
                        </div>
                    </div>
                )}

                {/* Visual Avatar Block */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative group">
                        <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white dark:border-gray-700 shadow-md bg-[#21A896]/10 flex items-center justify-center">
                            {profile.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt="Avatar"
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-3xl font-black text-[#21A896]">
                                    {getInitials(profile.name)}
                                </span>
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-full transition cursor-pointer">
                                <label htmlFor="avatar-upload" className="cursor-pointer text-white flex flex-col items-center">
                                    <Camera size={18} />
                                    <span className="text-[10px] font-bold mt-1">Alterar</span>
                                </label>
                            </div>
                        </div>

                        {savingAvatar && (
                            <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 rounded-full flex items-center justify-center">
                                <Loader size={20} className="animate-spin text-[#21A896]" />
                            </div>
                        )}

                        <label
                            htmlFor="avatar-upload"
                            className="absolute bottom-0 right-0 bg-[#21A896] text-white p-1.5 rounded-full shadow-md cursor-pointer hover:brightness-110 transition"
                        >
                            <Camera size={14} />
                        </label>
                        <input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarChange}
                            disabled={savingAvatar}
                        />
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Foto de Perfil</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Carregue uma imagem quadrada para seu avatar.
                            <br />Formatos aceitos: JPG, PNG ou WEBP, máx. 2MB.
                        </p>
                    </div>
                </div>

                {/* Identification Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="flex items-center gap-2">
                            <User className="text-[#21A896]" size={20} /> Identificação
                        </span>
                        {(!canEditGlobalProfile || isCpfDisabled) && (
                            <button
                                type="button"
                                onClick={() => setGeneralRequestModal({
                                    isOpen: true,
                                    requestType: 'name_change',
                                    requestedValue: '',
                                    reason: '',
                                    saving: false,
                                })}
                                className="text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-950/50 cursor-pointer"
                            >
                                <Plus size={14} />
                                Solicitar Alteração de Dados
                            </button>
                        )}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Nome Completo <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                value={profile.name}
                                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                required
                                disabled={!canEditGlobalProfile}
                            />
                            {!canEditGlobalProfile && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                                    O nome não pode ser alterado diretamente.{' '}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setGeneralRequestModal({
                                                isOpen: true,
                                                requestType: 'name_change',
                                                requestedValue: '',
                                                reason: '',
                                                saving: false,
                                            })
                                        }
                                        className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline transition cursor-pointer"
                                    >
                                        Solicitar alteração de nome.
                                    </button>
                                </span>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Apelido <span className="text-xs text-gray-400 font-normal">(como prefere ser chamado)</span>
                            </label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.internal_alias}
                                onChange={(e) => setProfile({ ...profile, internal_alias: e.target.value })}
                                placeholder="Ex: Lucas"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CPF</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                value={profile.cpf}
                                onChange={(e) => setProfile({ ...profile, cpf: e.target.value })}
                                disabled={isCpfDisabled || !canEditGlobalProfile}
                                placeholder="000.000.000-00"
                            />
                            {(isCpfDisabled || !canEditGlobalProfile) && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                                    O CPF não pode ser alterado diretamente.{' '}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setGeneralRequestModal({
                                                isOpen: true,
                                                requestType: 'cpf_change',
                                                requestedValue: '',
                                                reason: '',
                                                saving: false,
                                            })
                                        }
                                        className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline transition cursor-pointer"
                                    >
                                        Solicitar alteração de CPF.
                                    </button>
                                </span>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Data de Nascimento</label>
                            <input
                                type="date"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                value={profile.birthdate}
                                onChange={(e) => setProfile({ ...profile, birthdate: e.target.value })}
                                disabled={!canEditGlobalProfile}
                            />
                            {!canEditGlobalProfile && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                                    A data de nascimento não pode ser alterada diretamente.{' '}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setGeneralRequestModal({
                                                isOpen: true,
                                                requestType: 'birthdate_change',
                                                requestedValue: '',
                                                reason: '',
                                                saving: false,
                                            })
                                        }
                                        className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline transition cursor-pointer"
                                    >
                                        Solicitar alteração.
                                    </button>
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Contacts Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                        <Contact className="text-[#21A896]" size={20} /> Contatos e Acesso
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">E-mail de Contato</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                    value={profile.member_email}
                                    onChange={(e) => setProfile({ ...profile, member_email: e.target.value })}
                                    placeholder={securityContext?.email || 'Ex: contato@empresa.com'}
                                />
                                <Mail size={18} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Celular <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                    value={profile.mobile_phone}
                                    onChange={(e) => handleMobileChange(e.target.value)}
                                    placeholder="Ex: (22) 99999-9999"
                                />
                                <Phone size={18} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                    WhatsApp <span className="text-red-500">*</span>
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-[#21A896] focus:ring-[#21A896]"
                                        checked={!!profile.whatsapp_same_as_mobile}
                                        onChange={(event) => {
                                            const checked = event.target.checked;
                                            setProfile((current) => ({
                                                ...current,
                                                whatsapp_same_as_mobile: checked,
                                                whatsapp_phone: checked ? current.mobile_phone : current.whatsapp_phone,
                                            }));
                                        }}
                                    />
                                    WhatsApp é o mesmo número do celular
                                </label>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.whatsapp_phone}
                                    onChange={(event) =>
                                        setProfile((current) => ({
                                            ...current,
                                            whatsapp_phone: formatMobile(event.target.value),
                                        }))
                                    }
                                    disabled={profile.whatsapp_same_as_mobile}
                                    placeholder="Ex: (22) 99999-9999"
                                />
                                <Phone size={18} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Telefone Fixo</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                    value={profile.phone}
                                    onChange={(e) => setProfile((current) => ({ ...current, phone: formatLandline(e.target.value) }))}
                                    placeholder="Ex: (22) 3333-3333"
                                />
                                <Phone size={18} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Address Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                        <MapPin className="text-[#21A896]" size={20} /> Endereço Residencial
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CEP</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                    value={profile.zip_code}
                                    placeholder="00000-000"
                                    onChange={(e) =>
                                        setProfile((current) => ({
                                            ...current,
                                            zip_code: formatCep(e.target.value),
                                        }))
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            handleZipLookup();
                                        }
                                    }}
                                    onBlur={handleZipLookup}
                                />
                                <button
                                    type="button"
                                    onClick={handleZipLookup}
                                    disabled={searchingCep}
                                    className="p-3 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition text-gray-600 dark:text-white disabled:opacity-50"
                                >
                                    {searchingCep ? <Loader size={18} className="animate-spin" /> : <Search size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Endereço (Rua/Avenida)</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.address}
                                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Número</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.address_number}
                                onChange={(e) => setProfile({ ...profile, address_number: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Complemento</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.complement}
                                onChange={(e) => setProfile({ ...profile, complement: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bairro</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.district}
                                onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Estado (UF)</label>
                            <select
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.state}
                                onChange={(e) => setProfile({ ...profile, state: e.target.value, city: '' })}
                            >
                                <option value="">Selecione...</option>
                                {states.map((uf) => (
                                    <option key={uf.id} value={uf.sigla}>
                                        {uf.sigla}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex justify-between">
                                Cidade
                                {loadingCities && (
                                    <span className="text-xs text-[#21A896] flex items-center gap-1">
                                        <Loader size={12} className="animate-spin" /> Carregando...
                                    </span>
                                )}
                            </label>
                            {profile.state ? (
                                <select
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                    value={profile.city}
                                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
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
                                    value={profile.city}
                                    placeholder="Selecione o estado primeiro"
                                    readOnly
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Social Media Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                        <Globe className="text-[#21A896]" size={20} /> Redes Sociais e Canais
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Instagram</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.instagram_url}
                                    onChange={(e) => setProfile({ ...profile, instagram_url: e.target.value })}
                                    placeholder="Ex: @seuusername"
                                    disabled={!canEditGlobalProfile}
                                />
                                <Instagram size={18} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Facebook</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.facebook_url}
                                    onChange={(e) => setProfile({ ...profile, facebook_url: e.target.value })}
                                    placeholder="Ex: facebook.com/perfil"
                                    disabled={!canEditGlobalProfile}
                                />
                                <Facebook size={18} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Site Pessoal</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.website_url}
                                    onChange={(e) => setProfile({ ...profile, website_url: e.target.value })}
                                    placeholder="Ex: www.seusite.com"
                                    disabled={!canEditGlobalProfile}
                                />
                                <Globe size={18} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Info Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                        <Info className="text-[#21A896]" size={20} /> Informações Adicionais
                    </h3>

                    <div className="space-y-4">
                        {profile.additionalInfo.map((item, index) => (
                            <InfoCard
                                key={item.id || index}
                                item={item}
                                index={index}
                                onUpdate={handleUpdateAdditionalInfo}
                                onRemove={handleRemoveAdditionalInfo}
                                onRemoveRequest={handleRequestRemoveAdditionalInfo}
                            />
                        ))}

                        <button
                            type="button"
                            onClick={handleAddAdditionalInfo}
                            className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-[#21A896] hover:text-[#21A896] transition-colors"
                        >
                            <Plus size={18} />
                            Adicionar Informação
                        </button>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                    <button
                        type="button"
                        onClick={() => handleSave()}
                        disabled={saving}
                        className="flex items-center gap-3 bg-[#21A896] text-white px-8 py-3 rounded-xl font-bold text-lg hover:brightness-95 shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={24} />
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </form>

            {/* Minhas solicitações cadastrais */}
            <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 max-w-4xl mx-auto shadow-sm">
                <div className="mb-4 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Minhas solicitações cadastrais
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Acompanhe pedidos de alteração ou remoção enviados para análise.
                        </p>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => setGeneralRequestModal({
                                isOpen: true,
                                requestType: 'name_change',
                                requestedValue: '',
                                reason: '',
                                saving: false,
                            })}
                            className="rounded-lg bg-[#21A896] hover:bg-[#1A867A] px-3 py-2 text-sm font-bold text-white transition shrink-0 cursor-pointer"
                        >
                            Nova Solicitação
                        </button>
                        <button
                            type="button"
                            onClick={loadMyProfileRequests}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 transition shrink-0"
                        >
                            Atualizar
                        </button>
                    </div>
                </div>

                {loadingMyRequests ? (
                    <p className="text-sm text-gray-500">Carregando solicitações...</p>
                ) : myRequests.length === 0 ? (
                    <p className="text-sm text-gray-500">
                        Nenhuma solicitação cadastral registrada.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {myRequests.map((request) => (
                            <div
                                key={request.request_id}
                                className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
                            >
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">
                                            {PROFILE_REQUEST_TYPE_LABELS[request.request_type] ??
                                                request.request_type}
                                        </p>

                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            {request.reason}
                                        </p>

                                        {request.admin_notes && (
                                            <p className="mt-2 rounded-lg bg-white p-2 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                                <strong>Retorno:</strong> {request.admin_notes}
                                            </p>
                                        )}
                                    </div>

                                    <span className="inline-flex w-fit rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                        {PROFILE_REQUEST_STATUS_LABELS[request.status] ?? request.status}
                                    </span>
                                </div>

                                <p className="mt-2 text-xs text-gray-400">
                                    Criada em {new Date(request.created_at).toLocaleString('pt-BR')}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Modal de solicitação de remoção */}
            {removalRequestModal.isOpen && removalRequestModal.item && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Solicitar remoção de informação adicional
                        </h3>

                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-candara">
                            Essa solicitação será enviada para análise do responsável pela loja.
                        </p>

                        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Informação</p>
                            <p className="mt-1 font-bold text-gray-900 dark:text-white">
                                {removalRequestModal.item.title}
                            </p>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                {removalRequestModal.item.text}
                            </p>

                            {removalRequestModal.item.sensitive && (
                                <span className="mt-2 inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/40">
                                    Sensível
                                </span>
                            )}
                        </div>

                        <label className="mt-4 block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Motivo da solicitação <span className="text-red-500">*</span>
                        </label>

                        <textarea
                            value={removalRequestModal.reason}
                            onChange={(event) =>
                                setRemovalRequestModal((current) => ({
                                    ...current,
                                    reason: event.target.value,
                                }))
                            }
                            rows={4}
                            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#21A896] outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white transition"
                            placeholder="Explique por que essa informação deve ser removida (mínimo de 5 caracteres)."
                        />

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={removalRequestModal.saving}
                                onClick={() =>
                                    setRemovalRequestModal({
                                        isOpen: false,
                                        item: null,
                                        reason: '',
                                        saving: false,
                                    })
                                }
                                className="rounded-lg px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                disabled={
                                    removalRequestModal.saving ||
                                    removalRequestModal.reason.trim().length < 5
                                }
                                onClick={async () => {
                                    if (!removalRequestModal.item) return;

                                    const memberId = selectedMembership?.member_id;

                                    if (!memberId) {
                                        toast.error('Não foi possível identificar o vínculo ativo do usuário.');
                                        return;
                                    }

                                    setRemovalRequestModal((current) => ({
                                        ...current,
                                        saving: true,
                                    }));

                                    try {
                                        await createMyProfileChangeRequest({
                                            memberId,
                                            requestType: 'additional_info_remove',
                                            requestedChanges: {
                                                item_id: removalRequestModal.item.id,
                                                title: removalRequestModal.item.title,
                                                text: removalRequestModal.item.text,
                                            },
                                            reason: removalRequestModal.reason.trim(),
                                            sensitive: removalRequestModal.item.sensitive === true,
                                            metadata: {
                                                source: 'my_profile_additional_info_remove',
                                                active_store_id: selectedMembership?.store_id,
                                                active_store_name: selectedMembership?.store_name,
                                            },
                                        });

                                        toast.success('Solicitação de remoção enviada para análise.');

                                        setRemovalRequestModal({
                                            isOpen: false,
                                            item: null,
                                            reason: '',
                                            saving: false,
                                        });

                                        await loadMyProfileRequests();
                                    } catch (error) {
                                        console.error(error);
                                        toast.error('Não foi possível enviar a solicitação.');
                                        setRemovalRequestModal((current) => ({
                                            ...current,
                                            saving: false,
                                        }));
                                    }
                                }}
                                className="rounded-lg bg-[#F26541] hover:bg-[#d85535] px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {removalRequestModal.saving ? 'Enviando...' : 'Enviar solicitação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de solicitação cadastral geral */}
            {generalRequestModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Nova solicitação cadastral
                        </h3>

                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-candara">
                            Solicite a alteração ou atualização de seus dados cadastrais.
                        </p>

                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Tipo de alteração <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={generalRequestModal.requestType}
                                    onChange={(event) =>
                                        setGeneralRequestModal((current) => ({
                                            ...current,
                                            requestType: event.target.value as ProfileChangeRequestType,
                                        }))
                                    }
                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] outline-none"
                                >
                                    <option value="name_change">Alteração de nome</option>
                                    <option value="cpf_change">Alteração de CPF</option>
                                    <option value="birthdate_change">Alteração de data de nascimento</option>
                                    <option value="contact_update">Alteração de contato</option>
                                    <option value="address_update">Alteração de endereço</option>
                                    <option value="additional_info_update">Alteração de informação adicional</option>
                                    <option value="other">Outra solicitação</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Descreva os novos dados <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={generalRequestModal.requestedValue}
                                    onChange={(event) =>
                                        setGeneralRequestModal((current) => ({
                                            ...current,
                                            requestedValue: event.target.value,
                                        }))
                                    }
                                    rows={3}
                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#21A896] outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white transition"
                                    placeholder="Ex: Nome correto: José Silva de Souza / WhatsApp: (22) 99999-9999"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Motivo da solicitação <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={generalRequestModal.reason}
                                    onChange={(event) =>
                                        setGeneralRequestModal((current) => ({
                                            ...current,
                                            reason: event.target.value,
                                        }))
                                    }
                                    rows={3}
                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#21A896] outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white transition"
                                    placeholder="Explique por que essa alteração é necessária (mínimo de 5 caracteres)."
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={generalRequestModal.saving}
                                onClick={() =>
                                    setGeneralRequestModal({
                                        isOpen: false,
                                        requestType: 'name_change',
                                        requestedValue: '',
                                        reason: '',
                                        saving: false,
                                    })
                                }
                                className="rounded-lg px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                disabled={
                                    generalRequestModal.saving ||
                                    generalRequestModal.requestedValue.trim().length === 0 ||
                                    generalRequestModal.reason.trim().length < 5
                                }
                                onClick={async () => {
                                    const memberId = selectedMembership?.member_id;

                                    if (!memberId) {
                                        toast.error('Não foi possível identificar o vínculo ativo do usuário.');
                                        return;
                                    }

                                    setGeneralRequestModal((current) => ({
                                        ...current,
                                        saving: true,
                                    }));

                                    try {
                                        await createMyProfileChangeRequest({
                                            memberId,
                                            requestType: generalRequestModal.requestType,
                                            requestedChanges: {
                                                requested_value: generalRequestModal.requestedValue.trim(),
                                            },
                                            reason: generalRequestModal.reason.trim(),
                                            sensitive: ['cpf_change', 'birthdate_change'].includes(generalRequestModal.requestType),
                                            metadata: {
                                                source: 'my_profile_general_request',
                                                active_store_id: selectedMembership?.store_id,
                                                active_store_name: selectedMembership?.store_name,
                                            },
                                        });

                                        toast.success('Solicitação cadastral enviada para análise.');

                                        setGeneralRequestModal({
                                            isOpen: false,
                                            requestType: 'name_change',
                                            requestedValue: '',
                                            reason: '',
                                            saving: false,
                                        });

                                        await loadMyProfileRequests();
                                    } catch (error) {
                                        console.error(error);
                                        toast.error('Não foi possível enviar a solicitação.');
                                        setGeneralRequestModal((current) => ({
                                            ...current,
                                            saving: false,
                                        }));
                                    }
                                }}
                                className="rounded-lg bg-[#F26541] hover:bg-[#d85535] px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {generalRequestModal.saving ? 'Enviando...' : 'Enviar solicitação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}