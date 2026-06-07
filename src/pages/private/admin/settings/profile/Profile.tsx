import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
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
    X,
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import {
    updateMyStoreMemberProfile,
    updateMyProfileDetails,
    completeMyStoreMemberOnboarding,
    createMyProfileChangeRequest,
    cancelMyProfileChangeRequest,
    listMyProfileChangeRequests,
    PROFILE_REQUEST_STATUS_LABELS,
    PROFILE_REQUEST_TYPE_LABELS,
    type ProfileChangeRequest,
    type ProfileChangeRequestType,
    type ProfileChangeRequestStatus,
    type ProposedChangeValue
} from '@/services/securityService';
import { uploadStoreMemberAvatar } from '@/services/userAvatarService';
import { getActiveStoreId } from '@/utils/activeStore';
import { InfoCard } from '@/components/common/InfoCard';

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

function formatAdditionalInfoChange(change: any): {
  title: string;
  oldText: string;
  newText: string;
  oldSensitive: string;
  newSensitive: string;
} {
  const itemId = change?.item_id;

  const oldArray = Array.isArray(change?.old) ? change.old : [];
  const newArray = Array.isArray(change?.new) ? change.new : [];

  const oldItem = oldArray.find((item: any) => item?.id === itemId);
  const newItem = newArray.find((item: any) => item?.id === itemId);

  return {
    title:
      change?.item_label ||
      newItem?.title ||
      oldItem?.title ||
      'Informação adicional',
    oldText: oldItem?.text || 'Não informado',
    newText: newItem?.text || 'Não informado',
    oldSensitive: oldItem?.sensitive ? 'Sim' : 'Não',
    newSensitive: newItem?.sensitive ? 'Sim' : 'Não',
  };
}

export default function Profile() {
    const { securityContext, refresh: refreshSecurityContext, loading: loadingSecurity } = useSecurityContext();
    const navigate = useNavigate();
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

    // Filtros e ordenação para as solicitações cadastrais
    const [requestSearch, setRequestSearch] = useState('');
    const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | ProfileChangeRequestStatus>('all');
    const [requestDateFrom, setRequestDateFrom] = useState('');
    const [requestDateTo, setRequestDateTo] = useState('');
    const [requestSortOrder, setRequestSortOrder] = useState<'desc' | 'asc'>('desc');

    const filteredRequests = useMemo(() => {
        return myRequests
            .filter((req) => {
                // Filtro de status
                if (requestStatusFilter !== 'all' && req.status !== requestStatusFilter) {
                    return false;
                }

                // Filtro de data de início (created_at >= requestDateFrom)
                if (requestDateFrom) {
                    const fromDate = new Date(`${requestDateFrom}T00:00:00`);
                    if (new Date(req.created_at) < fromDate) {
                        return false;
                    }
                }

                // Filtro de data final (created_at <= requestDateTo)
                if (requestDateTo) {
                    const toDate = new Date(`${requestDateTo}T23:59:59`);
                    if (new Date(req.created_at) > toDate) {
                        return false;
                    }
                }

                // Filtro de pesquisa de texto
                if (requestSearch.trim()) {
                    const query = requestSearch.toLowerCase();
                    const reason = (req.reason ?? '').toLowerCase();
                    const typeLabel = (PROFILE_REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type).toLowerCase();
                    const statusLabel = (PROFILE_REQUEST_STATUS_LABELS[req.status] ?? req.status).toLowerCase();
                    
                    // Buscar também nas alterações solicitadas se houver
                    let matchInChanges = false;
                    if (req.requested_changes) {
                        const changesStr = JSON.stringify(req.requested_changes).toLowerCase();
                        if (changesStr.includes(query)) {
                            matchInChanges = true;
                        }
                    }

                    if (
                        !reason.includes(query) &&
                        !typeLabel.includes(query) &&
                        !statusLabel.includes(query) &&
                        !matchInChanges
                    ) {
                        return false;
                    }
                }

                return true;
            })
            .sort((a, b) => {
                const aDate = new Date(a.created_at).getTime();
                const bDate = new Date(b.created_at).getTime();
                return requestSortOrder === 'desc' ? bDate - aDate : aDate - bDate;
            });
    }, [myRequests, requestSearch, requestStatusFilter, requestDateFrom, requestDateTo, requestSortOrder]);

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

            // Correção 1b — usa selectedMembership (loja ativa correta)
            const primaryMembership = selectedMembership;
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
                    {canRequestProfileChanges && (
                        <button
                            type="button"
                            onClick={() => openProfileRequestModal('address_update')}
                            className="flex items-center gap-2 rounded-lg bg-[#F26541] hover:bg-[#d85535] px-3 py-2 text-sm font-bold text-white shadow-sm transition cursor-pointer"
                        >
                            <Plus size={16} />
                            Solicitar Alteração
                        </button>
                    )}
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
                {activeRequests.length > 0 && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="font-bold">Alteração cadastral em andamento</p>
                                <p className="mt-1">
                                    Existe solicitação pendente ou aguardando conferência. Acompanhe os detalhes em Meu Histórico.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => navigate('/admin/my-history')}
                                className="w-fit rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700"
                            >
                                Ver histórico
                            </button>
                        </div>
                    </div>
                )}

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
                        {canRequestProfileChanges && !canEditGlobalProfile && (
                            <button
                                type="button"
                                onClick={() => openProfileRequestModal('name_change')}
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
                                        onClick={() => openProfileRequestModal('name_change')}
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
                                disabled={!canEditGlobalProfile}
                                placeholder="000.000.000-00"
                            />
                            {!canEditGlobalProfile && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                                    O CPF não pode ser alterado diretamente.{' '}
                                    {canRequestProfileChanges && (
                                        <button
                                            type="button"
                                            onClick={() => openProfileRequestModal('cpf_change')}
                                            className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline transition cursor-pointer"
                                        >
                                            Solicitar alteração de CPF.
                                        </button>
                                    )}
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
                                        onClick={() => openProfileRequestModal('birthdate_change')}
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
                                onRemoveRequest={canRequestProfileChanges ? handleRequestRemoveAdditionalInfo : undefined}
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

            {/* Correção 2 — Minhas solicitações cadastrais: só para não-owner */}
            {canRequestProfileChanges && (
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
                                onClick={() => openProfileRequestModal('address_update')}
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

                    {/* Filtros e Busca */}
                    {!loadingMyRequests && myRequests.length > 0 && (
                        <div className="mb-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-xs space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                                {/* Campo de busca */}
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Localizar alteração específica (tipo, motivo, valor)..."
                                        value={requestSearch}
                                        onChange={(e) => setRequestSearch(e.target.value)}
                                        className="w-full text-xs pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                                    />
                                    {requestSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setRequestSearch('')}
                                            className="absolute right-3 top-2 text-gray-400 hover:text-[#F26541] transition cursor-pointer"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                
                                {/* Seletor de Status */}
                                <div className="w-full sm:w-48">
                                    <select
                                        value={requestStatusFilter}
                                        onChange={(e) => setRequestStatusFilter(e.target.value as any)}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                                    >
                                        <option value="all">Todos os status</option>
                                        <option value="pending">Pendente</option>
                                        <option value="applied">Aplicada</option>
                                        <option value="rejected">Rejeitada</option>
                                        <option value="cancelled">Cancelada</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Data De */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                        De (Data de solicitação)
                                    </label>
                                    <input
                                        type="date"
                                        value={requestDateFrom}
                                        onChange={(e) => setRequestDateFrom(e.target.value)}
                                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                                    />
                                </div>

                                {/* Data Até */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                        Até (Data de solicitação)
                                    </label>
                                    <input
                                        type="date"
                                        value={requestDateTo}
                                        onChange={(e) => setRequestDateTo(e.target.value)}
                                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                                    />
                                </div>

                                {/* Ordenação */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                        Ordenar por data
                                    </label>
                                    <select
                                        value={requestSortOrder}
                                        onChange={(e) => setRequestSortOrder(e.target.value as 'desc' | 'asc')}
                                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                                    >
                                        <option value="desc">Mais recente primeiro</option>
                                        <option value="asc">Mais antigo primeiro</option>
                                    </select>
                                </div>
                            </div>

                            {/* Botão de limpar filtros se houver filtros ativos */}
                            {(requestSearch || requestStatusFilter !== 'all' || requestDateFrom || requestDateTo || requestSortOrder !== 'desc') && (
                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRequestSearch('');
                                            setRequestStatusFilter('all');
                                            setRequestDateFrom('');
                                            setRequestDateTo('');
                                            setRequestSortOrder('desc');
                                        }}
                                        className="text-[11px] font-bold text-gray-500 hover:text-[#F26541] transition cursor-pointer"
                                    >
                                        Limpar filtros
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {loadingMyRequests ? (
                        <p className="text-sm text-gray-500">Carregando solicitações...</p>
                    ) : myRequests.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            Nenhuma solicitação cadastral registrada.
                        </p>
                    ) : filteredRequests.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">
                            Nenhuma solicitação cadastral corresponde aos filtros aplicados.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {filteredRequests.map((request) => (
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

                                            {request.request_type === 'additional_info_remove' && (
                                                <div className="mt-3 rounded-lg bg-white p-3 text-sm dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                                        Item solicitado para remoção
                                                    </p>
                                                    <p className="mt-1 font-bold text-gray-900 dark:text-white">
                                                        {String(request.requested_changes?.title ?? 'Sem título')}
                                                    </p>
                                                    <p className="text-gray-600 dark:text-gray-300">
                                                        {String(request.requested_changes?.text ?? '')}
                                                    </p>
                                                </div>
                                            )}

                                            {request.request_type !== 'additional_info_remove' && Object.keys(request.requested_changes ?? {}).length > 0 && (
                                                <div className="mt-3 rounded-lg bg-white p-3 text-sm dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                                        Alterações solicitadas
                                                    </p>

                                                    <div className="mt-2 space-y-2">
                                                        {Object.entries(request.requested_changes ?? {}).map(([field, rawChange]) => {
                                                            const change = rawChange as any;

                                                            if (field === 'member_additional_info' || field === 'additional_info') {
                                                                const infoChange = formatAdditionalInfoChange(change);

                                                                return (
                                                                    <div key={field} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                                                                        <p className="text-xs font-bold text-gray-500">
                                                                            {infoChange.title}
                                                                        </p>

                                                                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                                                            <p>
                                                                                <strong>Atual:</strong> {infoChange.oldText}
                                                                            </p>
                                                                            <p>
                                                                                <strong>Novo:</strong> {infoChange.newText}
                                                                            </p>
                                                                            <p>
                                                                                <strong>Sensível:</strong> {infoChange.oldSensitive} → {infoChange.newSensitive}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            // Pular campos legados sem estrutura {old, new}
                                                            if (typeof change !== 'object' || change === null || !('new' in change)) {
                                                                return (
                                                                    <div key={field} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
                                                                        <p className="text-xs font-bold text-gray-500">{FIELD_LABELS[field] || field}</p>
                                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{formatChangeValue(change)}</p>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <div key={field} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
                                                                    <p className="text-xs font-bold text-gray-500">
                                                                        {change.label || FIELD_LABELS[field] || field}
                                                                    </p>
                                                                    <p className="text-xs text-gray-400">
                                                                        Atual: {formatChangeValue(change.old)}
                                                                    </p>
                                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                                        Novo: {formatChangeValue(change.new)}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-start gap-2 md:items-end shrink-0">
                                            <span className="inline-flex w-fit rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                                {PROFILE_REQUEST_STATUS_LABELS[request.status] ?? request.status}
                                            </span>

                                            {/* Correção 8 — cancelar pelo solicitante */}
                                            {request.status === 'pending' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancelMyRequest(request)}
                                                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30 cursor-pointer"
                                                >
                                                    Cancelar solicitação
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <p className="mt-2 text-xs text-gray-400">
                                        Criada em {new Date(request.created_at).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

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
                                                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] outline-none"
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
                                                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] outline-none"
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
                                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] outline-none"
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
                                                            className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#21A896] dark:hover:border-[#21A896] bg-gray-50 dark:bg-gray-800/50 cursor-pointer transition flex justify-between items-center"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-800 dark:text-white">{item.title}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Valor: {item.text}</p>
                                                                <p className="text-[10px] text-gray-400 mt-0.5">Sensível: {item.sensitive ? 'Sim' : 'Não'}</p>
                                                            </div>
                                                            <span className="text-[#21A896] text-xs font-bold font-candara-bold">Selecionar &rarr;</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-[#21A896]">Editando: {generalRequestModal.selectedAdditionalInfo.title}</span>
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
                                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] outline-none"
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
                                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] outline-none min-h-[80px]"
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
                                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#21A896] outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white transition"
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
                                    className="rounded-lg bg-[#F26541] hover:bg-[#d85535] px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
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