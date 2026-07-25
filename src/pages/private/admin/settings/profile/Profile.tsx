import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import MyProfileIdentityTab from './components/MyProfileIdentityTab';
import MyProfileAddressTab from './components/MyProfileAddressTab';
import MyProfileAdditionalInfoTab from './components/MyProfileAdditionalInfoTab';
import MyProfileChangeRequestsTab from './components/MyProfileChangeRequestsTab';
import {
    Loader,
    User,
    AlertTriangle,
    Plus,
    History,
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import {
    updateMyStoreMemberProfile,
    updateMyProfileSocialLinks,
    completeMyStoreMemberOnboarding,
    createMyProfileChangeRequest,
    cancelMyProfileChangeRequest,
    listMyProfileChangeRequests,
    type ProfileChangeRequest,
    type ProfileChangeRequestType,
    type ProposedChangeValue
} from '@/services/securityService';
import { uploadStoreMemberAvatar } from '@/services/userAvatarService';
import { getActiveStoreId } from '@/utils/activeStore';


// ── Correção 4 — Labels de campo para o mini formulário estruturado ──
const FIELD_LABELS: Record<string, string> = {
    name: 'Nome completo',
    cpf: 'CPF',
    birthdate: 'Data de nascimento',
    member_email: 'E-mail de contato',
    phone: 'Telefone fixo',
    mobile_phone: 'Celular',
    whatsapp_phone: 'WhatsApp',
    zip_code: 'CEP',
    address: 'Endereço',
    address_number: 'Número',
    complement: 'Complemento',
    district: 'Bairro',
    city: 'Cidade',
    state: 'UF',
    other: 'Descrição',
};

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
    blood_type: string;
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



function isRequestActive(request: ProfileChangeRequest): boolean {
    return ['pending', 'awaiting_member_confirmation', 'correction_requested'].includes(
        request.status
    );
}

function isRecentlyApplied(request: ProfileChangeRequest, days = 7): boolean {
    if (request.status !== 'applied') return false;

    const date = request.applied_at || request.updated_at;
    if (!date) return false;

    const appliedAt = new Date(date).getTime();
    if (Number.isNaN(appliedAt)) return false;

    const maxAge = days * 24 * 60 * 60 * 1000;

    return Date.now() - appliedAt <= maxAge;
}

function hasFieldChange(
    request: ProfileChangeRequest,
    field: string
): boolean {
    return Boolean(
        request.admin_proposed_changes?.[field] ||
        request.applied_changes?.[field]
    );
}

function getLatestRequestForField(
    requests: ProfileChangeRequest[],
    field: string
): ProfileChangeRequest | null {
    return (
        requests
            .filter((request) => hasFieldChange(request, field))
            .sort((a, b) => {
                const da = new Date(a.updated_at || a.created_at).getTime();
                const db = new Date(b.updated_at || b.created_at).getTime();
                return db - da;
            })[0] ?? null
    );
}

function getRequestChangeForField(
    request: ProfileChangeRequest,
    field: string
): ProposedChangeValue | null {
    return (
        request.applied_changes?.[field] ||
        request.admin_proposed_changes?.[field] ||
        null
    );
}

function formatChangeValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'Não informado';

    if (typeof value === 'string') return value;

    return String(value);
}



const MY_PROFILE_TABS = [
  { id: 'identity', label: 'Identificação e acesso' },
  { id: 'address', label: 'Endereços e redes sociais' },
  { id: 'additional', label: 'Informações adicionais' },
  { id: 'changes', label: 'Alterações cadastrais' },
] as const;

type MyProfileTab = typeof MY_PROFILE_TABS[number]['id'];

export default function Profile() {
    const { securityContext, refresh: refreshSecurityContext, loading: loadingSecurity } = useSecurityContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') || 'identity') as MyProfileTab;

    function handleTabChange(tab: MyProfileTab) {
        setSearchParams({ tab });
    }

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setPortalContainer(document.getElementById('quick-access-actions-portal'));
    }, []);

    const memberships = securityContext?.memberships || [];
    const storedActiveStoreId = getActiveStoreId();

    // Correção 1 — prioriza a loja ativa armazenada entre os vínculos do usuário
    const selectedMembership = useMemo(() => {
        if (storedActiveStoreId) {
            const membershipFromActiveStore = memberships.find(
                (membership) =>
                    membership.store_id === storedActiveStoreId &&
                    membership.status === 'active'
            );
            if (membershipFromActiveStore) {
                return membershipFromActiveStore;
            }
        }
        return securityContext?.primary_membership || memberships[0] || null;
    }, [memberships, securityContext?.primary_membership, storedActiveStoreId]);

    const activeStoreId = selectedMembership?.store_id ?? storedActiveStoreId ?? null;
    const activeMemberId = selectedMembership?.member_id ?? null;
    void activeMemberId;

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

    // Correção 3 — formulário estruturado campo a campo
    type GeneralRequestForm = {
        name: string;
        cpf: string;
        birthdate: string;
        member_email: string;
        phone: string;
        mobile_phone: string;
        whatsapp_phone: string;
        zip_code: string;
        address: string;
        address_number: string;
        complement: string;
        district: string;
        city: string;
        state: string;
        title: string;
        text: string;
        other: string;
    };

    const EMPTY_REQUEST_FORM: GeneralRequestForm = {
        name: '',
        cpf: '',
        birthdate: '',
        member_email: '',
        phone: '',
        mobile_phone: '',
        whatsapp_phone: '',
        zip_code: '',
        address: '',
        address_number: '',
        complement: '',
        district: '',
        city: '',
        state: '',
        title: '',
        text: '',
        other: '',
    };

    const [generalRequestModal, setGeneralRequestModal] = useState<{
        isOpen: boolean;
        requestType: ProfileChangeRequestType;
        form: GeneralRequestForm;
        selectedAdditionalInfo: AdditionalInfo | null;
        reason: string;
        sensitive: boolean;
        saving: boolean;
    }>({
        isOpen: false,
        requestType: 'address_update',
        form: EMPTY_REQUEST_FORM,
        selectedAdditionalInfo: null,
        reason: '',
        sensitive: false,
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

    const activeRequests = useMemo(
        () => myRequests.filter(isRequestActive),
        [myRequests]
    );

    const recentAppliedRequests = useMemo(
        () => myRequests.filter((request) => isRecentlyApplied(request, 7)),
        [myRequests]
    );

    // Reservado para badges per-campo (próximo passo).
    void getLatestRequestForField;
    void getRequestChangeForField;
    void formatChangeValue;
    void recentAppliedRequests;

    const isOwnerSomewhere = memberships.some((m) => m.role === 'owner');
    const isOwnerInCurrentStore = selectedMembership?.role === 'owner';
    const canRequestProfileChanges = !isOwnerInCurrentStore;

    const isOnboardingPending =
        selectedMembership?.onboarding_required === true ||
        !selectedMembership?.onboarding_completed_at;

    // Nome completo, CPF, nascimento e tipo sanguíneo são preenchidos diretamente
    // apenas no primeiro acesso. Depois disso, passam pelo fluxo de solicitação.
    const canEditGlobalProfile = isOnboardingPending;

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
        blood_type: '',
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
                    blood_type: profileData.blood_type || '',

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

            // Correção 1b — usa selectedMembership (loja ativa correta)
            const primaryMembership = selectedMembership;
            if (!primaryMembership) {
                throw new Error('Nenhum vínculo de loja ativo para upload.');
            }

            const { avatarUrl } = await uploadStoreMemberAvatar({
                memberId: primaryMembership.member_id,
                userId: user.id,
                file,
                currentAvatarUrl: profile.avatar_url,
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
                        profileName: profile.name,
                        profileCpf: profile.cpf,
                        profileBirthdate: profile.birthdate,
                        profileBloodType: profile.blood_type || null,
                        instagramUrl: profile.instagram_url || null,
                        facebookUrl: profile.facebook_url || null,
                        websiteUrl: profile.website_url || null,
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

                    await updateMyProfileSocialLinks({
                        instagramUrl: profile.instagram_url || null,
                        facebookUrl: profile.facebook_url || null,
                        websiteUrl: profile.website_url || null,
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
        } catch (error: any) {
            console.error('Error saving profile:', error);
            toast.error(error?.message || 'Erro ao salvar alterações.');
        } finally {
            setSaving(false);
        }
    };

    // Correção 3 — helper para abrir o modal com os dados atuais pré-preenchidos
    function openProfileRequestModal(requestType: ProfileChangeRequestType) {
        setGeneralRequestModal({
            isOpen: true,
            requestType,
            form: {
                name: profile.name,
                cpf: profile.cpf,
                birthdate: profile.birthdate,
                member_email: profile.member_email,
                phone: profile.phone,
                mobile_phone: profile.mobile_phone,
                whatsapp_phone: profile.whatsapp_phone,
                zip_code: profile.zip_code,
                address: profile.address,
                address_number: profile.address_number,
                complement: profile.complement,
                district: profile.district,
                city: profile.city,
                state: profile.state,
                title: '',
                text: '',
                other: '',
            },
            selectedAdditionalInfo: null,
            reason: '',
            sensitive: ['cpf_change', 'birthdate_change'].includes(requestType),
            saving: false,
        });
    }

    // Correção 4 — monta requested_changes campo a campo comparando com o perfil atual
    function buildRequestedChanges(
        requestType: ProfileChangeRequestType,
        currentProfile: ProfileData,
        form: {
            name: string; cpf: string; birthdate: string;
            member_email: string; phone: string; mobile_phone: string; whatsapp_phone: string;
            zip_code: string; address: string; address_number: string; complement: string;
            district: string; city: string; state: string; other: string;
        }
    ): Record<string, ProposedChangeValue> {
        const fieldsByType: Record<string, string[]> = {
            name_change: ['name'],
            cpf_change: ['cpf'],
            birthdate_change: ['birthdate'],
            contact_update: ['member_email', 'phone', 'mobile_phone', 'whatsapp_phone'],
            address_update: ['zip_code', 'address', 'address_number', 'complement', 'district', 'city', 'state'],
            other: ['other'],
            additional_info_update: ['other'],
        };

        type ProfileKey = keyof ProfileData | 'other';
        const fieldMap: Record<string, ProfileKey> = {
            name: 'name', cpf: 'cpf', birthdate: 'birthdate',
            member_email: 'member_email', phone: 'phone', mobile_phone: 'mobile_phone', whatsapp_phone: 'whatsapp_phone',
            zip_code: 'zip_code', address: 'address', address_number: 'address_number',
            complement: 'complement', district: 'district', city: 'city', state: 'state',
            other: 'other',
        };

        const fields = fieldsByType[requestType] ?? ['other'];

        return fields.reduce<Record<string, ProposedChangeValue>>((acc, field) => {
            const profileKey = fieldMap[field];
            const oldValue = profileKey === 'other' ? '' : String(currentProfile[profileKey as keyof ProfileData] ?? '');
            const newValue = String(form[field as keyof typeof form] ?? '');

            if (newValue.trim() && newValue.trim() !== oldValue.trim()) {
                acc[field] = {
                    old: oldValue,
                    new: newValue,
                    label: FIELD_LABELS[field] ?? field,
                };
            }
            return acc;
        }, {});
    }

    // Correção 8 — cancelar solicitação pendente pelo próprio solicitante
    const handleCancelMyRequest = async (request: ProfileChangeRequest) => {
        try {
            await cancelMyProfileChangeRequest({ requestId: request.request_id });
            toast.success('Solicitação cancelada.');
            await loadMyProfileRequests();
        } catch (error) {
            console.error(error);
            toast.error('Não foi possível cancelar a solicitação.');
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Loader className="animate-spin text-[#19A999]" size={32} />
            </div>
        );
    }

    return (
        <PageContainer
            title="Meus Dados"
            subtitle="Gerencie suas informações pessoais e de contato."
            category="Configurações"
            icon={<User className="text-[#19A999]" size={28} />}
            flat
        >
            {portalContainer && createPortal(
                <>
                    <button
                        type="button"
                        onClick={() => handleTabChange('changes')}
                        title="Ver solicitações de alterações cadastrais"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition hover:border-[#19A999]/35 shrink-0 shadow-sm cursor-pointer"
                    >
                        <History size={13} />
                        <span>Alterações cadastrais</span>
                    </button>
                    {canRequestProfileChanges && (
                        <button
                            type="button"
                            onClick={() => openProfileRequestModal('address_update')}
                            className="flex items-center gap-2 rounded-lg bg-[#F1613A] hover:bg-[#d85535] px-3 py-2 text-sm font-bold text-white shadow-sm transition cursor-pointer"
                        >
                            <Plus size={16} />
                            Solicitar Alteração
                        </button>
                    )}
                </>,
                portalContainer
            )}
            {activeRequests.length > 0 && (
                <div className="mb-4 max-w-4xl mx-auto rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 animate-fadeIn">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="font-bold">Alteração cadastral em andamento</p>
                            <p className="mt-1">
                                Existe solicitação pendente ou aguardando conferência. Acompanhe os detalhes em Alterações cadastrais.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSearchParams({ tab: 'changes' })}
                            className="w-fit rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"
                        >
                            Ver solicitações
                        </button>
                    </div>
                </div>
            )}

            {/* 9.9K.5 — Aviso de onboarding pendente */}
            {isOnboardingPending && (
                <div className="mb-4 max-w-4xl mx-auto rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 text-sm text-amber-800 dark:text-amber-200">
                    Complete seus dados básicos para liberar o acesso às demais áreas da loja.
                </div>
            )}

            {isOwnerSomewhere && !isOwnerInCurrentStore && (
                <div className="mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 text-sm text-amber-800 dark:text-amber-200 flex gap-3 items-start shadow-sm max-w-4xl mx-auto animate-fadeIn">
                    <AlertTriangle className="shrink-0 text-amber-500 mt-0.5" size={18} />
                    <div>
                        <span className="font-bold block mb-1">Apenas dados de vínculo editáveis</span>
                        Estes dados fazem parte do seu cadastro principal no OptmaMenu e são reaproveitados em outras empresas. Para esta loja, você pode personalizar apelido, contatos, avatar e endereço de correspondência.
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
                <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                    {MY_PROFILE_TABS.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors border-b-2 cursor-pointer ${activeTab === tab.id
                                ? 'border-[#19A999] text-[#19A999] bg-[#19A999]/5 dark:bg-[#19A999]/10'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 md:p-8">
                    {activeTab === 'identity' && (
                        <MyProfileIdentityTab
                            profile={profile}
                            setProfile={setProfile}
                            saving={saving}
                            savingAvatar={savingAvatar}
                            handleAvatarChange={handleAvatarChange}
                            canRequestProfileChanges={canRequestProfileChanges}
                            canEditGlobalProfile={canEditGlobalProfile}
                            openProfileRequestModal={openProfileRequestModal}
                            handleSave={handleSave}
                        />
                    )}
                    {activeTab === 'address' && (
                        <MyProfileAddressTab
                            profile={profile}
                            setProfile={setProfile}
                            saving={saving}
                            states={states}
                            cities={cities}
                            loadingCities={loadingCities}
                            searchingCep={searchingCep}
                            handleZipLookup={handleZipLookup}
                            handleSave={handleSave}
                        />
                    )}
                    {activeTab === 'additional' && (
                        <MyProfileAdditionalInfoTab
                            profile={profile}
                            handleAddAdditionalInfo={handleAddAdditionalInfo}
                            handleUpdateAdditionalInfo={handleUpdateAdditionalInfo}
                            handleRemoveAdditionalInfo={handleRemoveAdditionalInfo}
                            canRequestProfileChanges={canRequestProfileChanges}
                            handleRequestRemoveAdditionalInfo={handleRequestRemoveAdditionalInfo}
                            handleSave={handleSave}
                            saving={saving}
                        />
                    )}
                    {activeTab === 'changes' && (
                        <MyProfileChangeRequestsTab
                            myRequests={myRequests}
                            loadingMyRequests={loadingMyRequests}
                            loadMyProfileRequests={loadMyProfileRequests}
                            openProfileRequestModal={openProfileRequestModal}
                            handleCancelMyRequest={handleCancelMyRequest}
                        />
                    )}
                </div>
            </div>

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
                            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#19A999] outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white transition"
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
                                className="rounded-lg bg-[#F1613A] hover:bg-[#d85535] px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {removalRequestModal.saving ? 'Enviando...' : 'Enviar solicitação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Correções 3/4/5 — Modal de solicitação cadastral estruturado */}
            {generalRequestModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Nova solicitação cadastral
                        </h3>

                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
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
                                            form: {
                                                name: profile.name,
                                                cpf: profile.cpf,
                                                birthdate: profile.birthdate,
                                                member_email: profile.member_email,
                                                phone: profile.phone,
                                                mobile_phone: profile.mobile_phone,
                                                whatsapp_phone: profile.whatsapp_phone,
                                                zip_code: profile.zip_code,
                                                address: profile.address,
                                                address_number: profile.address_number,
                                                complement: profile.complement,
                                                district: profile.district,
                                                city: profile.city,
                                                state: profile.state,
                                                title: '',
                                                text: '',
                                                other: '',
                                            },
                                        }))
                                    }
                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
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

                            {/* Correção 5 — mini formulário para endereço */}
                            {generalRequestModal.requestType === 'address_update' && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {(
                                        [
                                            ['zip_code', 'CEP', profile.zip_code],
                                            ['address', 'Endereço', profile.address],
                                            ['address_number', 'Número', profile.address_number],
                                            ['complement', 'Complemento', profile.complement],
                                            ['district', 'Bairro', profile.district],
                                            ['city', 'Cidade', profile.city],
                                            ['state', 'UF', profile.state],
                                        ] as [string, string, string][]
                                    ).map(([field, label, currentValue]) => (
                                        <div key={field}>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                {label}
                                            </label>
                                            <input
                                                value={String(generalRequestModal.form[field as keyof typeof generalRequestModal.form] ?? '')}
                                                onChange={(event) =>
                                                    setGeneralRequestModal((current) => ({
                                                        ...current,
                                                        form: {
                                                            ...current.form,
                                                            [field]:
                                                                field === 'zip_code'
                                                                    ? formatCep(event.target.value)
                                                                    : event.target.value,
                                                        },
                                                    }))
                                                }
                                                onBlur={field === 'zip_code' ? async () => {
                                                    const cep = onlyDigits(generalRequestModal.form.zip_code);
                                                    if (cep.length !== 8) return;
                                                    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                                                    const data = await response.json();
                                                    if (!data.erro) {
                                                        setGeneralRequestModal((current) => ({
                                                            ...current,
                                                            form: {
                                                                ...current.form,
                                                                address: data.logradouro || current.form.address,
                                                                district: data.bairro || current.form.district,
                                                                city: data.localidade || current.form.city,
                                                                state: data.uf || current.form.state,
                                                            },
                                                        }));
                                                    }
                                                } : undefined}
                                                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                            />
                                            <p className="mt-1 text-[11px] text-gray-400">
                                                Atual: {String(currentValue || 'Não informado')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Correção 5 — mini formulário para contato */}
                            {generalRequestModal.requestType === 'contact_update' && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {(
                                        [
                                            ['member_email', 'E-mail de contato', profile.member_email],
                                            ['mobile_phone', 'Celular', profile.mobile_phone],
                                            ['whatsapp_phone', 'WhatsApp', profile.whatsapp_phone],
                                            ['phone', 'Telefone fixo', profile.phone],
                                        ] as [string, string, string][]
                                    ).map(([field, label, currentValue]) => (
                                        <div key={field}>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                {label}
                                            </label>
                                            <input
                                                value={String(generalRequestModal.form[field as keyof typeof generalRequestModal.form] ?? '')}
                                                onChange={(event) =>
                                                    setGeneralRequestModal((current) => ({
                                                        ...current,
                                                        form: {
                                                            ...current.form,
                                                            [field]:
                                                                field === 'phone'
                                                                    ? formatLandline(event.target.value)
                                                                    : field.includes('phone')
                                                                        ? formatMobile(event.target.value)
                                                                        : event.target.value,
                                                        },
                                                    }))
                                                }
                                                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                            />
                                            <p className="mt-1 text-[11px] text-gray-400">
                                                Atual: {String(currentValue || 'Não informado')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Correção 5 — campos simples (nome, CPF, nascimento, outros) */}
                            {['name_change', 'cpf_change', 'birthdate_change', 'other'].includes(generalRequestModal.requestType) && (() => {
                                const fieldMap: Record<string, { key: keyof typeof generalRequestModal.form; label: string; currentValue: string; type?: string }> = {
                                    name_change: { key: 'name', label: 'Novo nome completo', currentValue: profile.name },
                                    cpf_change: { key: 'cpf', label: 'Novo CPF', currentValue: profile.cpf },
                                    birthdate_change: { key: 'birthdate', label: 'Nova data de nascimento', currentValue: profile.birthdate, type: 'date' },
                                    other: { key: 'other', label: 'Descreva a solicitação', currentValue: '' },
                                };
                                const item = fieldMap[generalRequestModal.requestType];
                                if (!item) return null;
                                return (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                            {item.label} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type={item.type || 'text'}
                                            value={String(generalRequestModal.form[item.key] ?? '')}
                                            onChange={(event) =>
                                                setGeneralRequestModal((current) => ({
                                                    ...current,
                                                    form: { ...current.form, [item.key]: event.target.value },
                                                }))
                                            }
                                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                        />
                                        {item.currentValue && (
                                            <p className="mt-1 text-[11px] text-gray-400">
                                                Atual: {item.currentValue}
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Informações adicionais existentes */}
                            {generalRequestModal.requestType === 'additional_info_update' && (
                                <div className="space-y-4">
                                    {generalRequestModal.selectedAdditionalInfo === null ? (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                Selecione a informação adicional a ser alterada:
                                            </label>
                                            {profile.additionalInfo.length === 0 ? (
                                                <p className="text-sm text-gray-500">Nenhuma informação adicional cadastrada.</p>
                                            ) : (
                                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                                    {profile.additionalInfo.map((item) => (
                                                        <div
                                                            key={item.id}
                                                            onClick={() => {
                                                                setGeneralRequestModal((current) => ({
                                                                    ...current,
                                                                    selectedAdditionalInfo: item,
                                                                    sensitive: item.sensitive,
                                                                    form: {
                                                                        ...current.form,
                                                                        title: item.title,
                                                                        text: item.text,
                                                                    }
                                                                }));
                                                            }}
                                                            className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#19A999] dark:hover:border-[#19A999] bg-gray-50 dark:bg-gray-800/50 cursor-pointer transition flex justify-between items-center"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-800 dark:text-white">{item.title}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Valor: {item.text}</p>
                                                                <p className="text-[10px] text-gray-400 mt-0.5">Sensível: {item.sensitive ? 'Sim' : 'Não'}</p>
                                                            </div>
                                                            <span className="text-[#19A999] text-xs font-bold font-candara-bold">Selecionar &rarr;</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-[#19A999]">Editando: {generalRequestModal.selectedAdditionalInfo.title}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setGeneralRequestModal(current => ({ ...current, selectedAdditionalInfo: null }))}
                                                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-bold"
                                                >
                                                    Alterar item
                                                </button>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Título
                                                </label>
                                                <input
                                                    type="text"
                                                    value={generalRequestModal.form.title}
                                                    onChange={(e) => setGeneralRequestModal(current => ({
                                                        ...current,
                                                        form: { ...current.form, title: e.target.value }
                                                    }))}
                                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                                />
                                                <p className="mt-1 text-[11px] text-gray-400">
                                                    Atual: {generalRequestModal.selectedAdditionalInfo.title}
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Descrição
                                                </label>
                                                <textarea
                                                    value={generalRequestModal.form.text}
                                                    onChange={(e) => setGeneralRequestModal(current => ({
                                                        ...current,
                                                        form: { ...current.form, text: e.target.value }
                                                    }))}
                                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none min-h-[80px]"
                                                />
                                                <p className="mt-1 text-[11px] text-gray-400">
                                                    Atual: {generalRequestModal.selectedAdditionalInfo.text}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Motivo e Sensível: só aparecem para outros tipos OU se for additional_info_update e tiver um item selecionado */}
                            {(generalRequestModal.requestType !== 'additional_info_update' || generalRequestModal.selectedAdditionalInfo !== null) && (
                                <div className="space-y-4 pt-2">
                                    {generalRequestModal.requestType === 'additional_info_update' && generalRequestModal.selectedAdditionalInfo && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Atual sensível: {generalRequestModal.selectedAdditionalInfo.sensitive ? 'Sim' : 'Não'}
                                        </p>
                                    )}

                                    <label className="mt-4 flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={generalRequestModal.sensitive}
                                            onChange={(event) =>
                                                setGeneralRequestModal((current) => ({
                                                    ...current,
                                                    sensitive: event.target.checked,
                                                }))
                                            }
                                            disabled={['cpf_change', 'birthdate_change'].includes(generalRequestModal.requestType)}
                                            className="mt-1"
                                        />

                                        <span>
                                            Marcar esta solicitação como sensível.
                                            <br />
                                            <span className="text-xs text-gray-400">
                                                Use para dados pessoais, familiares, saúde, documentos ou informações que não devem ficar amplamente visíveis.
                                            </span>
                                        </span>
                                    </label>

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
                                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#19A999] outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white transition"
                                            placeholder="Explique por que essa alteração é necessária (mínimo de 5 caracteres)."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={generalRequestModal.saving}
                                onClick={() =>
                                    setGeneralRequestModal({
                                        isOpen: false,
                                        requestType: 'address_update',
                                        form: EMPTY_REQUEST_FORM,
                                        selectedAdditionalInfo: null,
                                        reason: '',
                                        sensitive: false,
                                        saving: false,
                                    })
                                }
                                className="rounded-lg px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                            >
                                Cancelar
                            </button>

                            {(generalRequestModal.requestType !== 'additional_info_update' || generalRequestModal.selectedAdditionalInfo !== null) && (
                                <button
                                    type="button"
                                    disabled={
                                        generalRequestModal.saving ||
                                        generalRequestModal.reason.trim().length < 5
                                    }
                                    onClick={async () => {
                                        const memberId = selectedMembership?.member_id;

                                        if (!memberId) {
                                            toast.error('Não foi possível identificar o vínculo ativo do usuário.');
                                            return;
                                        }

                                        let requestedChanges: any = null;
                                        let isSensitive = generalRequestModal.sensitive;

                                        if (generalRequestModal.requestType === 'additional_info_update') {
                                            if (!generalRequestModal.selectedAdditionalInfo) return;
                                            const nextAdditionalInfo = profile.additionalInfo.map((item) =>
                                                item.id === generalRequestModal.selectedAdditionalInfo!.id
                                                    ? {
                                                        ...item,
                                                        title: generalRequestModal.form.title.trim(),
                                                        text: generalRequestModal.form.text.trim(),
                                                        sensitive: generalRequestModal.sensitive,
                                                      }
                                                    : item
                                            );
                                            requestedChanges = {
                                                member_additional_info: {
                                                    label: 'Informações adicionais',
                                                    old: profile.additionalInfo,
                                                    new: nextAdditionalInfo,
                                                    item_id: generalRequestModal.selectedAdditionalInfo.id,
                                                    item_label: generalRequestModal.selectedAdditionalInfo.title,
                                                }
                                            };
                                            isSensitive = generalRequestModal.sensitive || generalRequestModal.selectedAdditionalInfo.sensitive === true;
                                        } else {
                                            requestedChanges = buildRequestedChanges(
                                                generalRequestModal.requestType,
                                                profile,
                                                generalRequestModal.form
                                            );
                                        }

                                        if (Object.keys(requestedChanges).length === 0) {
                                            toast.info('Informe ao menos uma alteração diferente do dado atual.');
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
                                                requestedChanges,
                                                reason: generalRequestModal.reason.trim(),
                                                sensitive: isSensitive,
                                                metadata: {
                                                    source: generalRequestModal.requestType === 'additional_info_update'
                                                        ? 'my_profile_additional_info_update'
                                                        : 'my_profile_structured_request',
                                                    active_store_id: selectedMembership?.store_id,
                                                    active_store_name: selectedMembership?.store_name,
                                                },
                                            });

                                            toast.success('Solicitação cadastral enviada para análise.');

                                            setGeneralRequestModal({
                                                isOpen: false,
                                                requestType: 'address_update',
                                                form: EMPTY_REQUEST_FORM,
                                                selectedAdditionalInfo: null,
                                                reason: '',
                                                sensitive: false,
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
                                    className="rounded-lg bg-[#F1613A] hover:bg-[#d85535] px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {generalRequestModal.saving ? 'Enviando...' : 'Enviar solicitação'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}