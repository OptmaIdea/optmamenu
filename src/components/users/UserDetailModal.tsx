import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import type {
    StoreMemberOccurrenceSeverity,
    StoreMemberOccurrenceType,
    UserAdmin,
} from '@/types';
import type { StoreCustomRole } from '@/types/security';
import { UserStatusBadge } from './UserStatusBadge';
import { UserRoleBadge } from './UserRoleBadge';
import {
    X,
    Mail,
    Phone,
    User,
    Calendar,
    Shield,
    Store,
    Briefcase,
    Save,
    Info,
    Plus,
    AlertTriangle,
    Loader,
    Clock,
    LogIn,
    LogOut,
    Activity,
    Filter,
    FileDown,
    Search,
    RefreshCw,
    Printer,
    ArrowUpDown,
} from 'lucide-react';
import { useStoreMemberDetails } from '@/hooks/useStoreMemberDetails';
import { useStoreMemberFullHistory } from '@/hooks/security/useStoreMemberFullHistory';
import {
    createStoreMemberOccurrenceV2,
    getStoreMemberAccessTimeline,
    updateStoreMemberStatus,
    type StoreMemberAccessTimelineItem,
} from '@/services/securityService';
import { uploadStoreMemberAvatar } from '@/services/userAvatarService';

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserAdmin | null;
    canManageUsers?: boolean;
    canViewSensitiveUserData?: boolean;
    canManageSensitiveUserData?: boolean;
    onSaveProfileDetails?: (input: {
        memberId: string;

        profileName?: string | null;
        profilePhone?: string | null;
        profileMobilePhone?: string | null;
        profileWhatsappPhone?: string | null;
        profileCpf?: string | null;
        profileBirthdate?: string | null;

        profileZipCode?: string | null;
        profileAddress?: string | null;
        profileAddressNumber?: string | null;
        profileComplement?: string | null;
        profileDistrict?: string | null;
        profileCity?: string | null;
        profileState?: string | null;

        profileInstagramUrl?: string | null;
        profileFacebookUrl?: string | null;
        profileWebsiteUrl?: string | null;

        internalAlias?: string | null;
        jobTitle?: string | null;
        department?: string | null;
        internalNotes?: string | null;

        reason?: string | null;
    }) => Promise<void>;
    onRequestRoleChange?: (user: UserAdmin, newRole: string) => void;
    onRequestCustomRoleChange?: (user: UserAdmin, customRoleId: string | null) => void;
    onOccurrenceSaved?: (input: {
        user: UserAdmin;
        occurrenceType: OccurrenceFormType;
    }) => Promise<void>;
    customRoles?: StoreCustomRole[];
    onAvatarUpdated?: (avatarUrl: string) => void;
}

type ModalTab =
    | 'overview'
    | 'profile'
    | 'access_role'
    | 'internal'
    | 'history'
    | 'occurrences';



interface InternalFormState {
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    zipCode: string;
    startedAt: string;
    endedAt: string;
    exitReason: string;
}

type OccurrenceFormType = StoreMemberOccurrenceType | 'return_from_suspension';

interface OccurrenceFormState {
    occurrenceType: OccurrenceFormType;
    severity: StoreMemberOccurrenceSeverity;
    title: string;
    description: string;
    occurredAt: string;
    occurredTime: string;
    visibleToMember: boolean;
    newRole: string;
    newCustomRoleId: string;
    clearIndividualOverrides: boolean;
}

type OccurrenceTypeOption = {
    value: OccurrenceFormType;
    label: string;
    severity: StoreMemberOccurrenceSeverity;
    sensitive: boolean;
    requiresDescription: boolean;
    help?: string;
};

const OCCURRENCE_TYPE_OPTIONS = ([
    {
        value: 'admission',
        label: 'Admissão',
        severity: 'critical',
        sensitive: true,
        requiresDescription: true,
        help: 'Inicia ou reativa o acesso do colaborador à loja.',
    },
    {
        value: 'warning',
        label: 'Advertência',
        severity: 'medium',
        sensitive: false,
        requiresDescription: false,
    },
    {
        value: 'role_change',
        label: 'Alteração de função',
        severity: 'medium',
        sensitive: true,
        requiresDescription: true,
        help: 'Registra alteração de papel no sistema e/ou função personalizada.',
    },
    {
        value: 'absence',
        label: 'Ausência',
        severity: 'medium',
        sensitive: false,
        requiresDescription: false,
    },
    {
        value: 'exit',
        label: 'Desligamento',
        severity: 'critical',
        sensitive: true,
        requiresDescription: true,
        help: 'Encerra o vínculo e inativa o acesso do colaborador à loja.',
    },
    {
        value: 'praise',
        label: 'Elogio',
        severity: 'low',
        sensitive: false,
        requiresDescription: false,
    },
    {
        value: 'incident',
        label: 'Incidente',
        severity: 'high',
        sensitive: false,
        requiresDescription: false,
    },
    {
        value: 'note',
        label: 'Observação',
        severity: 'info',
        sensitive: false,
        requiresDescription: false,
    },
    {
        value: 'other',
        label: 'Outro',
        severity: 'info',
        sensitive: false,
        requiresDescription: false,
    },
    {
        value: 'return_from_suspension',
        label: 'Retorno de suspensão',
        severity: 'info',
        sensitive: true,
        requiresDescription: false,
        help: 'Remove a suspensão temporária e libera novamente o acesso à loja.',
    },
    {
        value: 'suspension',
        label: 'Suspensão',
        severity: 'critical',
        sensitive: true,
        requiresDescription: true,
        help: 'Suspende temporariamente o acesso do colaborador à loja.',
    },
    {
        value: 'training',
        label: 'Treinamento',
        severity: 'low',
        sensitive: false,
        requiresDescription: false,
    },
] satisfies OccurrenceTypeOption[]).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

function getStringFromRecord(
    value: Record<string, unknown> | null | undefined,
    key: string
): string {
    const field = value?.[key];
    return typeof field === 'string' ? field : '';
}

function safeInputValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
}

const EMPTY_PROFILE_FORM = {
    profileName: '',
    profileEmail: '',
    profilePhone: '',
    profileMobilePhone: '',
    profileWhatsappPhone: '',
    profileCpf: '',
    profileBirthdate: '',

    profileZipCode: '',
    profileAddress: '',
    profileAddressNumber: '',
    profileComplement: '',
    profileDistrict: '',
    profileCity: '',
    profileState: '',

    profileInstagramUrl: '',
    profileFacebookUrl: '',
    profileWebsiteUrl: '',

    internalAlias: '',
    department: '',
    internalNotes: '',
};

function formatRoleLabel(role: string): string {
    const labels: Record<string, string> = {
        owner: 'Proprietário',
        super_admin: 'Super Administrador',
        admin: 'Administrador',
        manager: 'Gerente',
        stock_operator: 'Operador de estoque',
        cashier: 'Caixa',
        sales: 'Vendas',
        staff: 'Equipe',
        viewer: 'Visualizador',
    };

    return labels[role] ?? role;
}

function formatRoleTextDescription(text: string | null | undefined): string {
    if (!text) return '';

    return text
        .replaceAll('stock_operator', 'Operador de estoque')
        .replaceAll('viewer', 'Visualizador')
        .replaceAll('admin', 'Administrador')
        .replaceAll('manager', 'Gerente')
        .replaceAll('cashier', 'Caixa')
        .replaceAll('sales', 'Vendas')
        .replaceAll('staff', 'Equipe')
        .replaceAll('owner', 'Proprietário');
}

/* function isReactivationOccurrence(
    type: StoreMemberOccurrenceType,
    metadata: Record<string, unknown> | null | undefined
): boolean {
    return type === 'other' && metadata?.event_type === 'reactivation';
} */

function formatOccurrenceType(
    type: StoreMemberOccurrenceType | string | null | undefined,
    metadata?: Record<string, unknown> | null
): string {
    if (!type) return 'Ocorrência';

    if (type === 'other' && metadata?.event_type === 'reactivation') {
        return 'Reativação de acesso';
    }

    if (type === 'other' && metadata?.event_type === 'return_from_suspension') {
        return 'Retorno de suspensão';
    }

    const labels: Record<string, string> = {
        admission: 'Admissão',
        note: 'Observação',
        warning: 'Advertência',
        praise: 'Elogio',
        training: 'Treinamento',
        incident: 'Incidente',
        role_change: 'Alteração de função',
        absence: 'Ausência',
        exit: 'Desligamento',
        suspension: 'Suspensão',
        return_from_suspension: 'Retorno de suspensão',
        other: 'Outro',
    };

    return labels[type] ?? 'Ocorrência';
}

function formatOccurrenceTitle(occurrence: {
    occurrence_type: string;
    title?: string | null;
    metadata?: Record<string, unknown> | null;
}): string {
    const technicalTitles: Record<string, string> = {
        'Store Member Onboarding Completed': 'Primeiro acesso concluído',
        'Store Member Profile Updated By Self': 'Dados atualizados pelo próprio usuário',
    };

    if (occurrence.title && technicalTitles[occurrence.title]) {
        return technicalTitles[occurrence.title];
    }

    if (!occurrence.title) {
        return formatOccurrenceType(occurrence.occurrence_type, occurrence.metadata);
    }

    return occurrence.title;
}

const OCCURRENCE_SEVERITY_LABELS: Record<StoreMemberOccurrenceSeverity, string> = {
    info: 'Informativo',
    warning: 'Atenção',
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    critical: 'Crítica',
};

const OCCURRENCE_SEVERITY_CLASSES: Record<StoreMemberOccurrenceSeverity, string> = {
    info: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    medium: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
    high: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
    critical: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

function formatSeverity(severity: StoreMemberOccurrenceSeverity): string {
    return OCCURRENCE_SEVERITY_LABELS[severity];
}

function buildOccurrenceTimestamp(date?: string, time?: string): string | null {
    if (!date || !time) return null;

    return new Date(`${date}T${time}:00`).toISOString();
}

function getEmptyOccurrenceForm(): OccurrenceFormState {
    return {
        occurrenceType: 'note',
        severity: 'info',
        title: '',
        description: '',
        occurredAt: '',
        occurredTime: '',
        visibleToMember: false,
        newRole: '',
        newCustomRoleId: '',
        clearIndividualOverrides: false,
    };
}

function getAvailableOccurrenceTypes(userStatus: string) {
    return OCCURRENCE_TYPE_OPTIONS.filter((option) => {
        if (option.value === 'admission') {
            return userStatus === 'inactive';
        }

        if (option.value === 'suspension') {
            return userStatus === 'active';
        }

        if (option.value === 'return_from_suspension') {
            return userStatus === 'suspended';
        }

        if (option.value === 'exit') {
            return userStatus === 'active' || userStatus === 'suspended';
        }

        return true;
    });
}

function formatStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, string> = {
        active: 'Ativo',
        inactive: 'Inativo',
        suspended: 'Suspenso',
        invited: 'Convidado',
        pending: 'Pendente',
    };

    return status ? labels[status] ?? status : 'Não informado';
}

export function UserDetailModal({
    isOpen,
    onClose,
    user,
    canManageUsers = false,
    canViewSensitiveUserData = false,
    canManageSensitiveUserData = false,
    onSaveProfileDetails,
    onRequestRoleChange,
    onRequestCustomRoleChange,
    onOccurrenceSaved,
    customRoles = [],
    onAvatarUpdated,
}: UserDetailModalProps) {
    const [activeTab, setActiveTab] = useState<ModalTab>('overview');
    const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
    const [loadedDetailsId, setLoadedDetailsId] = useState<string | null>(null);
    const [savingProfileDetails, setSavingProfileDetails] = useState(false);
    const [savingAvatar, setSavingAvatar] = useState(false);

    const [profileForm, setProfileForm] = useState(EMPTY_PROFILE_FORM);

    const handleCepChange = async (cepValue: string) => {
        const formatted = formatCEP(cepValue);
        setProfileForm((current) => ({ ...current, profileZipCode: formatted }));

        const cleanCep = cepValue.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                if (response.ok) {
                    const data = await response.json();
                    if (!data.erro) {
                        setProfileForm((current) => ({
                            ...current,
                            profileAddress: data.logradouro || '',
                            profileDistrict: data.bairro || '',
                            profileCity: data.localidade || '',
                            profileState: data.uf || '',
                        }));
                        toast.success('Endereço preenchido pelo CEP.');
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar CEP:', error);
            }
        }
    };

    useEffect(() => {
        if (!user) {
            setProfileForm(EMPTY_PROFILE_FORM);
            return;
        }

        setProfileForm({
            profileName: safeInputValue(user.full_name),
            profileEmail: safeInputValue(user.email_for_store || user.email),
            profilePhone: formatPhone(safeInputValue(user.phone)),
            profileMobilePhone: formatPhone(safeInputValue(user.mobile_phone)),
            profileWhatsappPhone: formatPhone(safeInputValue(user.whatsapp_phone)),
            profileCpf: formatCPF(safeInputValue(user.cpf)),
            profileBirthdate: safeInputValue(user.birthdate),

            profileZipCode: formatCEP(safeInputValue(user.zip_code)),
            profileAddress: safeInputValue(user.address),
            profileAddressNumber: safeInputValue(user.address_number),
            profileComplement: safeInputValue(user.complement),
            profileDistrict: safeInputValue(user.district),
            profileCity: safeInputValue(user.city),
            profileState: safeInputValue(user.state),

            profileInstagramUrl: safeInputValue(user.instagram_url),
            profileFacebookUrl: safeInputValue(user.facebook_url),
            profileWebsiteUrl: safeInputValue(user.website_url),

            internalAlias: safeInputValue(user.internal_alias),
            department: safeInputValue(user.department),
            internalNotes: safeInputValue(user.internal_notes),
        });
    }, [user]);

    const {
        details,
        occurrences,
        loading,
        saving,
        error,
        refresh,
        saveDetails,
    } = useStoreMemberDetails(isOpen && user ? user.id : null);

    const {
        items: fullHistoryItems,
        filters: historyFilters,
        loading: historyLoading,
        error: historyError,
        updateFilters: updateHistoryFilters,
        resetFilters: resetHistoryFilters,
        fetchHistory,
    } = useStoreMemberFullHistory(user?.id ?? null, isOpen);

    const [historySortOrder, setHistorySortOrder] = useState<'asc' | 'desc'>('desc');

    const fullHistory = useMemo(() => {
        return [...fullHistoryItems].sort((a, b) => {
            const dateA = new Date(a.event_at).getTime();
            const dateB = new Date(b.event_at).getTime();
            return historySortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
    }, [fullHistoryItems, historySortOrder]);

    const isProtectedOwner = user?.role === 'owner';
    const memberStore = user?.stores?.[0] ?? null;

    const [internalForm, setInternalForm] = useState<InternalFormState>(() =>
        getEmptyInternalForm()
    );

    if (isOpen && user?.id && loadedUserId !== user.id) {
        setLoadedUserId(user.id);
        setLoadedDetailsId(null);
        setActiveTab('overview');
        setInternalForm(getEmptyInternalForm());
    }

    const detailsSyncKey = details?.id ?? 'empty';

    if (isOpen && user?.id && loadedDetailsId !== detailsSyncKey && !loading) {
        setLoadedDetailsId(detailsSyncKey);
        setInternalForm({
            ...getInternalFormFromUser(user),
            ...getInternalFormFromDetails(details),
        });

        setProfileForm((current) => ({
            ...current,
            internalAlias: safeInputValue(details?.nickname || user.internal_alias),
            internalNotes: safeInputValue(details?.internal_notes || user.internal_notes),
        }));
    }



    const [accessTimeline, setAccessTimeline] = useState<StoreMemberAccessTimelineItem[]>([]);
    const [loadingAccessTimeline, setLoadingAccessTimeline] = useState(false);

    const [occurrenceForm, setOccurrenceForm] = useState<OccurrenceFormState>(() =>
        getEmptyOccurrenceForm()
    );

    const loadAccessTimeline = async () => {
        if (!user || !memberStore?.store_id) return;

        try {
            setLoadingAccessTimeline(true);

            const items = await getStoreMemberAccessTimeline(memberStore.store_id, user.id);
            setAccessTimeline(items);
        } catch (error) {
            console.error('Erro ao carregar ciclos de acesso:', error);
        } finally {
            setLoadingAccessTimeline(false);
        }
    };

    useEffect(() => {
        if (isOpen && user) {
            void loadAccessTimeline();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, user?.id, memberStore?.store_id]);

    const initials = getInitials(user?.full_name);

    if (!isOpen || !user) return null;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };



    const formatOptionalDateTime = (dateString: string | null | undefined) => {
        if (!dateString) return 'Sem registro';

        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getSessionActionLabel = (action: string | null | undefined) => {
        const labels: Record<string, string> = {
            session_store_selected: 'Entrada na loja selecionada',
            session_logout: 'Saída do sistema',
            session_login_test: 'Teste de sessão',
        };

        return action ? labels[action] ?? action : 'Sem evento registrado';
    };

    const lastSessionIcon =
        user.last_session_action === 'session_logout'
            ? LogOut
            : user.last_session_action === 'session_store_selected'
                ? LogIn
                : Clock;

    const lastSessionDetails = (user.last_session_details as Record<string, any>) ?? {};
    const lastSessionStoreName =
        typeof lastSessionDetails.store_name === 'string'
            ? lastSessionDetails.store_name
            : null;
    const lastSessionRole =
        typeof lastSessionDetails.role === 'string'
            ? formatRoleLabel(lastSessionDetails.role)
            : null;
    const sessionElapsed =
        typeof lastSessionDetails.session_elapsed === 'string'
            ? lastSessionDetails.session_elapsed
            : null;

    const formatHistoryModule = (module: string) => {
        const labels: Record<string, string> = {
            security: 'Segurança',
            users: 'Usuários',
            audit: 'Auditoria',
            stock: 'Estoque',
            purchases: 'Compras',
            suppliers: 'Fornecedores',
            products: 'Produtos',
        };

        return labels[module] ?? module;
    };

    const formatHistoryOutcome = (outcome: string | null | undefined) => {
        const labels: Record<string, string> = {
            success: 'Sucesso',
            failure: 'Falha',
            info: 'Informativo',
            warning: 'Atenção',
            low: 'Baixa',
            medium: 'Média',
            high: 'Alta',
            critical: 'Crítica',
        };

        return outcome ? labels[outcome] ?? outcome : 'Sem resultado';
    };

    const formatHistorySource = (source: string | null | undefined) => {
        const labels: Record<string, string> = {
            store_security_logs: 'Registro de segurança',
            store_member_occurrences: 'Ocorrência do usuário',
            audit_logs: 'Auditoria operacional',
            stock_movements: 'Movimentação de estoque',
            operational_timeline: 'Linha do tempo operacional',
        };

        return source ? labels[source] ?? source : 'Origem não identificada';
    };

    const formatHistoryActionLabel = (action: string | null | undefined): string => {
        const labels: Record<string, string> = {
            // Segurança / permissões
            store_sensitive_action_rule_updated: 'Regra de ação sensível alterada',
            store_role_permission_template_updated: 'Permissão por papel alterada',
            store_member_permissions_updated: 'Permissões individuais alteradas',
            store_member_role_changed: 'Função do usuário alterada',
            store_member_profile_details_updated: 'Dados do usuário atualizados',
            store_custom_role_assigned: 'Função personalizada atribuída',
            store_custom_role_removed: 'Função personalizada removida',

            security_settings_change: 'Configurações de segurança alteradas',
            security_settings_updated: 'Configurações de segurança alteradas',
            security_context_refreshed: 'Contexto de segurança atualizado',

            user_pin_created: 'PIN cadastrado',
            user_pin_updated: 'PIN alterado',
            user_pin_validated: 'PIN validado',
            user_pin_validation_failed: 'Falha na validação do PIN',
            user_pin_unblocked: 'PIN desbloqueado',

            store_master_password_reset: 'Senha master redefinida',
            login_password_changed: 'Senha de login alterada',

            sensitive_token_created: 'Token de ação sensível criado',
            sensitive_token_validated: 'Token de ação sensível validado',
            sensitive_token_validation_failed: 'Falha na validação do token',

            product_delete: 'Exclusão/descontinuação de produto',
            stock_adjustment: 'Ajuste de estoque',
            purchase_cancel: 'Cancelamento de compra',
            user_role_change: 'Alteração de papel de usuário',
            user_status_change: 'Alteração de status de usuário',
            sensitive_view: 'Ver dados sensíveis',
            sensitive_manage: 'Gerenciar dados sensíveis',

            session_store_selected: 'Entrada na loja selecionada',
            session_logout: 'Saída do sistema',
            session_login_test: 'Teste de login/sessão',

            // Eventos de membro da loja
            store_member_profile_updated_by_self: 'Dados do colaborador atualizados pelo próprio usuário',
            store_member_onboarding_completed: 'Primeiro acesso concluído',
            store_member_admission_registered: 'Admissão registrada',
            store_member_suspension_registered: 'Suspensão registrada',
            store_member_suspension_removed: 'Retorno de suspensão',
            store_member_exit_registered: 'Desligamento registrado',
            store_member_reactivated: 'Acesso reativado',
            store_member_status_updated: 'Status do usuário alterado',
            store_member_inactivated: 'Usuário inativado',
            store_member_suspended: 'Usuário suspenso',
            store_member_role_changed_by_occurrence: 'Alteração de função registrada',
            store_member_avatar_updated: 'Avatar atualizado',
            store_member_custom_role_changed: 'Função personalizada alterada',

            // Sessão / acesso
            login: 'Entrada no sistema',
            logout: 'Saída do sistema',
            selected_store: 'Entrada na loja selecionada',

            // Produtos / estoque
            product_update: 'Produto atualizado',
            product_create: 'Produto criado',

            // Tipos de ocorrência (fallback para eventos de outras fontes)
            admission: 'Admissão',
            suspension: 'Suspensão',
            exit: 'Desligamento',
            role_change: 'Alteração de função',
            training: 'Treinamento',
            warning: 'Advertência',
            praise: 'Elogio',
            absence: 'Ausência',
            incident: 'Incidente',
            note: 'Observação',
            other: 'Outro',
            return_from_suspension: 'Retorno de suspensão',
            reactivation: 'Reativação de acesso',
        };

        if (!action) return 'Ação desconhecida';

        if (labels[action]) return labels[action];

        return action
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const formatHistoryEventLabel = (event: {
        source: string;
        action: string;
        title: string | null;
        metadata: Record<string, unknown> | null;
    }): string => {
        // Occurrence events map directly through formatOccurrenceType
        // (handles admission, suspension, role_change, exit, reactivation, etc.)
        if (event.source === 'store_member_occurrences') {
            return formatOccurrenceType(event.action, event.metadata);
        }

        return formatHistoryActionLabel(event.action || event.title);
    };

    const formatAccessEventLabel = (item: StoreMemberAccessTimelineItem): string => {
        if (
            item.event_type === 'other' &&
            item.metadata?.event_type === 'reactivation' &&
            item.old_status === 'suspended'
        ) {
            return 'Retorno de suspensão';
        }

        if (item.event_type === 'other' && item.metadata?.event_type === 'reactivation') {
            return 'Reativação de acesso';
        }

        if (item.event_type === 'admission') return 'Admissão';
        if (item.event_type === 'suspension') return 'Suspensão';
        if (item.event_type === 'exit') return 'Desligamento';
        if (item.event_type === 'role_change') return 'Alteração de função';

        return item.event_label;
    };

    const getStringMetadata = (
        metadata: Record<string, unknown> | null | undefined,
        key: string
    ): string | null => {
        const value = metadata?.[key];
        return typeof value === 'string' && value.trim() ? value : null;
    };

    const getRecordMetadata = (
        metadata: Record<string, unknown> | null | undefined,
        key: string
    ): Record<string, unknown> => {
        const value = metadata?.[key];

        return value && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
    };

    const formatPermissionLabelFromCode = (code: string) => {
        const labels: Record<string, string> = {
            'dashboard.view': 'Painel · Ver',
            'reports.view': 'Relatórios · Ver',
            'products.view': 'Produtos · Ver',
            'products.create': 'Produtos · Criar',
            'products.update': 'Produtos · Editar',
            'products.delete': 'Produtos · Excluir',
            'stock.view': 'Estoque · Ver',
            'stock.transfer': 'Estoque · Transferir',
            'stock.adjust': 'Estoque · Ajustar',
            'purchases.view': 'Compras · Ver',
            'purchases.create': 'Compras · Criar',
            'purchases.confirm': 'Compras · Confirmar',
            'purchases.cancel': 'Compras · Cancelar',
            'suppliers.view': 'Fornecedores · Ver',
            'suppliers.manage': 'Fornecedores · Gerenciar',
            'orders.view': 'Pedidos · Ver',
            'orders.manage': 'Pedidos · Gerenciar',
            'orders.cancel': 'Pedidos · Cancelar',
            'cashbook.view': 'Livro diário · Ver',
            'cashbook.create': 'Livro diário · Criar',
            'cashbook.cancel': 'Livro diário · Cancelar',
            'clients.view': 'Clientes · Ver',
            'clients.manage': 'Clientes · Gerenciar',
            'marketing.view': 'Marketing · Ver',
            'marketing.manage': 'Marketing · Gerenciar',
            'loyalty.view': 'Fidelidade · Ver',
            'loyalty.manage': 'Fidelidade · Gerenciar',
            'users.view': 'Usuários · Ver',
            'users.manage': 'Usuários · Gerenciar',
            'users.sensitive.view': 'Usuários · Ver dados sensíveis',
            'users.sensitive.manage': 'Usuários · Gerenciar dados sensíveis',
            'security.view': 'Segurança · Ver',
            'security.manage': 'Segurança · Gerenciar',
            'security.sessions.view': 'Segurança · Ver sessões e inatividade',
            'security.sessions.manage': 'Segurança · Gerenciar sessões e inatividade',
            'settings.view': 'Configurações · Ver dados da loja',
            'settings.manage': 'Configurações · Gerenciar dados da loja',
        };

        if (labels[code]) return labels[code];

        const [module, action] = code.split('.');
        if (!module || !action) return code;

        return `${module} · ${action}`;
    };

    const formatPermissionValue = (value: unknown) => {
        if (value === true) return 'permitido';
        if (value === false) return 'bloqueado';
        return 'herdado';
    };

    const getPermissionChangeSummaryFromMetadata = (
        metadata: Record<string, unknown> | null | undefined
    ) => {
        const oldPermissions = getRecordMetadata(metadata, 'old_permissions');
        const newPermissions = getRecordMetadata(metadata, 'new_permissions');

        const codes = Array.from(
            new Set([
                ...Object.keys(oldPermissions),
                ...Object.keys(newPermissions),
            ])
        );

        const changed = codes.filter(
            (code) => oldPermissions[code] !== newPermissions[code]
        );

        if (!changed.length) return null;

        return changed
            .slice(0, 4)
            .map((code) => {
                return `${formatPermissionLabelFromCode(code)}: ${formatPermissionValue(
                    oldPermissions[code]
                )} → ${formatPermissionValue(newPermissions[code])}`;
            })
            .join(' | ');
    };

    const formatHistoryDescription = (event: {
        action: string;
        description: string | null;
        metadata: Record<string, unknown> | null;
    }) => {
        if (event.action === 'store_member_permissions_updated') {
            return (
                getPermissionChangeSummaryFromMetadata(event.metadata) ||
                event.description ||
                'Permissões individuais revisadas.'
            );
        }

        if (event.action === 'store_member_role_changed') {
            const targetName =
                getStringMetadata(event.metadata, 'target_user_name') ||
                getStringMetadata(event.metadata, 'target_user_email') ||
                'Usuário selecionado';

            const oldRole = getStringMetadata(event.metadata, 'old_role');
            const newRole = getStringMetadata(event.metadata, 'new_role');
            const cleared = event.metadata?.clear_individual_overrides === true;

            return `${targetName} · ${oldRole ? formatRoleLabel(oldRole) : 'função anterior'} → ${newRole ? formatRoleLabel(newRole) : 'nova função'
                }${cleared ? ' · permissões individuais limpas' : ' · permissões individuais preservadas'}`;
        }


        if (event.action === 'store_role_permission_template_updated') {
            const role = getStringMetadata(event.metadata, 'role');
            const permissionCode = getStringMetadata(event.metadata, 'permission_code');
            const oldAllowed = event.metadata?.old_allowed;
            const newAllowed = event.metadata?.new_allowed;

            const parts = [
                role ? `Papel: ${formatRoleLabel(role)}` : null,
                permissionCode ? formatPermissionLabelFromCode(permissionCode) : null,
                `${formatPermissionValue(oldAllowed)} → ${formatPermissionValue(newAllowed)}`,
            ].filter(Boolean);

            return parts.join(' · ');
        }

        if (event.action === 'store_sensitive_action_rule_updated') {
            const actionCode = getStringMetadata(event.metadata, 'action_code');
            const oldRule = getRecordMetadata(event.metadata, 'old_rule');
            const newRule = getRecordMetadata(event.metadata, 'new_rule');

            const oldRequirement =
                typeof oldRule.requirement === 'string' ? oldRule.requirement : 'não definido';

            const newRequirement =
                typeof newRule.requirement === 'string' ? newRule.requirement : 'não definido';

            return `${actionCode ?? 'Ação sensível'} · exigência: ${oldRequirement} → ${newRequirement}`;
        }

        if (event.action === 'session_store_selected') {
            const storeName = getStringMetadata(event.metadata, 'store_name');
            const role = getStringMetadata(event.metadata, 'role');

            return `${storeName ?? 'Loja selecionada'} · acesso como ${role ? formatRoleLabel(role) : 'papel não informado'
                }`;
        }

        if (event.action === 'session_logout') {
            const elapsed = getStringMetadata(event.metadata, 'session_elapsed');

            return elapsed
                ? `Tempo de sessão: ${elapsed}`
                : 'Usuário encerrou a sessão.';
        }

        if (event.action === 'store_member_profile_details_updated') {
            const targetName =
                getStringMetadata(event.metadata, 'target_user_name') ||
                getStringMetadata(event.metadata, 'target_user_email') ||
                'Usuário selecionado';

            const reason = getStringMetadata(event.metadata, 'reason');

            return reason
                ? `${targetName} · dados cadastrais e internos atualizados. Motivo: ${reason}`
                : `${targetName} · dados cadastrais e internos atualizados.`;
        }

        if (event.action === 'store_member_profile_updated_by_self') {
            return 'Dados pessoais ou de contato desta loja foram atualizados pelo próprio usuário.';
        }

        if (event.action === 'store_member_onboarding_completed') {
            return 'Primeiro acesso concluído e dados básicos cadastrados.';
        }

        return formatRoleTextDescription(event.description) || 'Evento registrado no histórico.';
    };

    const exportUserHistoryCsv = () => {
        const headers = [
            'Data/Hora',
            'Módulo',
            'Ação',
            'Título',
            'Descrição',
            'Resultado',
            'Entidade',
            'Origem',
        ];

        const rows = fullHistory.map((item) => [
            formatOptionalDateTime(item.event_at),
            formatHistoryModule(item.module),
            formatHistoryActionLabel(item.action),
            formatHistoryEventLabel(item),
            formatHistoryDescription(item),
            formatHistoryOutcome(item.outcome),
            item.entity_type ?? '',
            formatHistorySource(item.source),
        ]);

        const csv = [
            headers.join(';'),
            ...rows.map((row) =>
                row
                    .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                    .join(';')
            ),
        ].join('\n');

        const blob = new Blob([`\uFEFF${csv}`], {
            type: 'text/csv;charset=utf-8;',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `historico-usuario-${user.id}.csv`;
        link.click();

        URL.revokeObjectURL(url);
    };

    const printUserHistoryReport = () => {
        const printWindow = window.open('', '_blank', 'width=1100,height=800');

        if (!printWindow) {
            toast.error('Não foi possível abrir a janela de impressão.');
            return;
        }

        const rows = fullHistory
            .map((event) => {
                return `
                    <tr>
                        <td>${formatOptionalDateTime(event.event_at)}</td>
                        <td>${formatHistoryModule(event.module)}</td>
                        <td>${formatHistoryEventLabel(event)}</td>
                        <td>${formatHistoryDescription(event)}</td>
                        <td>${formatHistoryOutcome(event.outcome)}</td>
                        <td>${formatHistorySource(event.source)}</td>
                    </tr>
                `;
            })
            .join('');

        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Histórico do usuário - ${user.full_name}</title>
                    <style>
                        * {
                            box-sizing: border-box;
                        }

                        body {
                            font-family: Arial, sans-serif;
                            margin: 32px;
                            color: #111827;
                        }

                        header {
                            border-bottom: 2px solid #21A896;
                            padding-bottom: 16px;
                            margin-bottom: 24px;
                        }

                        h1 {
                            margin: 0 0 8px;
                            font-size: 22px;
                        }

                        p {
                            margin: 4px 0;
                            font-size: 13px;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 12px;
                        }

                        th {
                            text-align: left;
                            background: #f3f4f6;
                            border: 1px solid #d1d5db;
                            padding: 8px;
                        }

                        td {
                            vertical-align: top;
                            border: 1px solid #e5e7eb;
                            padding: 8px;
                        }

                        tr:nth-child(even) {
                            background: #f9fafb;
                        }

                        .muted {
                            color: #6b7280;
                        }

                        @media print {
                            body {
                                margin: 16px;
                            }

                            button {
                                display: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <header>
                        <h1>Histórico do usuário</h1>
                        <p><strong>Usuário:</strong> ${user.full_name}</p>
                        <p><strong>E-mail:</strong> ${user.email_for_store ?? user.email ?? 'Não informado'}</p>
                        <p><strong>Papel atual:</strong> ${formatRoleLabel(user.role)}</p>
                        <p><strong>Status:</strong> ${user.status}</p>
                        <p class="muted"><strong>Emitido em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                        <p class="muted">Relatório gerado a partir dos filtros aplicados na tela.</p>
                    </header>

                    <table>
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Módulo</th>
                                <th>Evento</th>
                                <th>Descrição</th>
                                <th>Resultado</th>
                                <th>Origem</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || `
                                <tr>
                                    <td colspan="6">Nenhum evento encontrado para os filtros aplicados.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>

                    <script>
                        window.onload = function () {
                            window.print();
                        };
                    </script>
                </body>
            </html>
        `);

        printWindow.document.close();
    };

    const handleSaveInternalDetails = async () => {
        if (!memberStore) {
            toast.error('Vínculo de loja não encontrado para este usuário.');
            return;
        }

        try {
            await saveDetails({
                storeId: memberStore.store_id,
                memberId: user.id,
                userId: memberStore.user_id,
                nickname: profileForm.internalAlias.trim() || null,
                address: {
                    street: profileForm.profileAddress.trim() || internalForm.street.trim(),
                    number: profileForm.profileAddressNumber.trim() || internalForm.number.trim(),
                    complement: profileForm.profileComplement.trim() || internalForm.complement.trim(),
                    district: profileForm.profileDistrict.trim() || internalForm.district.trim(),
                    city: profileForm.profileCity.trim() || internalForm.city.trim(),
                    state: profileForm.profileState.trim() || internalForm.state.trim(),
                    zip_code: profileForm.profileZipCode.trim() || internalForm.zipCode.trim(),
                },
                startedAt: internalForm.startedAt || null,
                endedAt: internalForm.endedAt || null,
                exitReason: internalForm.exitReason.trim() || null,
                internalNotes: profileForm.internalNotes.trim() || null,
            });

            if (onSaveProfileDetails) {
                await onSaveProfileDetails({
                    memberId: user.id,
                    internalAlias: profileForm.internalAlias,
                    department: profileForm.department,
                    internalNotes: profileForm.internalNotes,
                    jobTitle: null,
                    reason: 'Atualização de dados internos do usuário.',
                });
            }

            toast.success('Dados internos salvos com sucesso.');
        } catch {
            toast.error('Não foi possível salvar os dados internos.');
        }
    };

    const handleAddOccurrence = async () => {
        if (!memberStore) {
            toast.error('Vínculo de loja não encontrado para este usuário.');
            return;
        }

        const occurrenceType = occurrenceForm.occurrenceType;
        const description = occurrenceForm.description.trim();
        const selectedType = OCCURRENCE_TYPE_OPTIONS.find(
            (item) => item.value === occurrenceType
        );

        if (selectedType?.requiresDescription && !description) {
            toast.error(`Informe o motivo/descrição para ${selectedType.label}.`);
            return;
        }

        if (occurrenceType === 'return_from_suspension') {
            try {
                await updateStoreMemberStatus({
                    memberId: user.id,
                    status: 'active',
                    reason: description || 'Retorno de suspensão.',
                });

                await refresh();
                await fetchHistory();
                await loadAccessTimeline();

                setOccurrenceForm(getEmptyOccurrenceForm());

                if (onOccurrenceSaved) {
                    await onOccurrenceSaved({
                        user,
                        occurrenceType,
                    });
                    return;
                }

                toast.success('Suspensão removida e acesso reativado.');
            } catch {
                toast.error('Não foi possível remover a suspensão.');
            }

            return;
        }

        const metadata =
            occurrenceType === 'role_change' || occurrenceType === 'admission'
                ? {
                    new_role: occurrenceForm.newRole || user.role,
                    new_custom_role_id: occurrenceForm.newCustomRoleId || null,
                    clear_individual_overrides: occurrenceForm.clearIndividualOverrides,
                }
                : {};

        try {
            const result = await createStoreMemberOccurrenceV2({
                memberId: user.id,
                occurrenceType,
                severity: selectedType?.severity ?? occurrenceForm.severity,
                title: occurrenceForm.title.trim() || selectedType?.label || null,
                description: description || null,
                occurredAt: buildOccurrenceTimestamp(
                    occurrenceForm.occurredAt,
                    occurrenceForm.occurredTime
                ),
                visibleToMember: occurrenceForm.visibleToMember,
                metadata: {
                    ...metadata,
                    origin: 'user_detail_modal',
                },
            });

            if (!result) return;

            const savedOccurrenceType = occurrenceType;

            await refresh();
            await fetchHistory();
            await loadAccessTimeline();

            setOccurrenceForm(getEmptyOccurrenceForm());

            if (onOccurrenceSaved) {
                await onOccurrenceSaved({
                    user,
                    occurrenceType: savedOccurrenceType,
                });
                return;
            }

            toast.success(
                savedOccurrenceType === 'exit'
                    ? 'Desligamento registrado e acesso inativado.'
                    : savedOccurrenceType === 'suspension'
                        ? 'Suspensão registrada e acesso suspenso.'
                        : savedOccurrenceType === 'admission'
                            ? 'Admissão/retorno registrado e acesso ativado.'
                            : savedOccurrenceType === 'role_change'
                                ? 'Alteração de função registrada.'
                                : 'Ocorrência registrada.'
            );
        } catch {
            toast.error('Não foi possível registrar a ocorrência.');
        }
    };

    const handleSaveProfileDetails = async () => {
        if (!onSaveProfileDetails || !user) {
            toast.error('Rotina de salvamento não disponível.');
            return;
        }

        try {
            setSavingProfileDetails(true);

            await onSaveProfileDetails({
                memberId: user.id,
                internalAlias: profileForm.internalAlias,
                department: profileForm.department,
                internalNotes: profileForm.internalNotes,
                jobTitle: null,
                reason: 'Atualização de dados internos do usuário.',
            });

            toast.success('Dados complementares salvos.');
        } catch (error) {
            console.error('Erro ao salvar dados complementares no modal:', error);

            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível salvar os dados complementares.'
            );
        } finally {
            setSavingProfileDetails(false);
        }
    };

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file || !user) return;

        try {
            setSavingAvatar(true);

            const { avatarUrl } = await uploadStoreMemberAvatar({
                memberId: user.id,
                userId: user.user_id || user.stores?.[0]?.user_id || '',
                file,
                reason: 'Alteração de avatar pela aba Cadastro.',
            });

            toast.success('Avatar atualizado.');

            if (onAvatarUpdated) {
                onAvatarUpdated(avatarUrl);
            }
        } catch (error) {
            console.error('Erro ao atualizar avatar:', error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível atualizar o avatar.'
            );
        } finally {
            setSavingAvatar(false);
            event.target.value = '';
        }
    };

    const tabs: Array<{ id: ModalTab; label: string; icon: typeof User }> = [
        { id: 'overview', label: 'Visão geral', icon: User },
        { id: 'profile', label: 'Cadastro', icon: User },
        { id: 'access_role', label: 'Acesso e função', icon: Shield },
        { id: 'history', label: 'Histórico', icon: Activity },
        ...(canManageUsers
            ? [
                { id: 'internal' as ModalTab, label: 'Dados internos', icon: Briefcase },
                { id: 'occurrences' as ModalTab, label: 'Ocorrências', icon: AlertTriangle },
            ]
            : []),
    ];

    return (
        <>
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Detalhes do Usuário
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    <div className="max-h-[calc(90vh-73px)] overflow-y-auto">
                        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/30">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full overflow-hidden bg-linear-to-br from-[#21A896] to-[#1A867A] text-2xl font-bold text-white">
                                        {user.avatar_url ? (
                                            <img
                                                src={user.avatar_url}
                                                alt={user.full_name || 'Avatar do usuário'}
                                                className="absolute inset-0 h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span>{initials}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {details?.nickname || user.full_name || 'Sem nome'}
                                        </h3>
                                        {details?.nickname && user.full_name && (
                                            <p className="text-sm text-gray-500">
                                                Nome: {user.full_name}
                                            </p>
                                        )}
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <UserRoleBadge role={user.role} size="sm" />
                                            <UserStatusBadge status={user.status} size="sm" />
                                        </div>
                                    </div>
                                </div>

                                {loading && (
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Loader className="h-4 w-4 animate-spin" />
                                        Carregando dados internos...
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;

                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={
                                                isActive
                                                    ? 'inline-flex items-center gap-2 rounded-xl bg-[#21A896] px-3 py-2 text-sm font-bold text-white'
                                                    : 'inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                            }
                                        >
                                            <Icon size={15} />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {error && (
                            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        <div className="space-y-6 p-6">
                            {activeTab === 'overview' && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {user.email_for_store && (
                                        <InfoCard icon={Mail} label="Email" value={user.email_for_store} />
                                    )}

                                    {user.phone && (
                                        <InfoCard icon={Phone} label="Telefone" value={user.phone} />
                                    )}

                                    {user.whatsapp_phone && (
                                        <InfoCard icon={Phone} label="WhatsApp" value={user.whatsapp_phone} />
                                    )}

                                    {user.mobile_phone && !user.whatsapp_phone && (
                                        <InfoCard icon={Phone} label="Celular" value={user.mobile_phone} />
                                    )}

                                    <InfoCard
                                        icon={Shield}
                                        label="Papel no sistema"
                                        value={formatRoleLabel(user.role)}
                                    />

                                    {user.custom_role_name && (
                                        <InfoCard
                                            icon={Shield}
                                            label="Função personalizada"
                                            value={`${user.custom_role_name}${user.custom_role_base_role
                                                ? ` · base: ${formatRoleLabel(user.custom_role_base_role)}`
                                                : ''
                                                }`}
                                        />
                                    )}
                                    {user.department && (
                                        <InfoCard
                                            icon={Briefcase}
                                            label="Setor"
                                            value={user.department}
                                        />
                                    )}

                                    {(user.last_session_at || user.last_seen_at || user.last_sign_in_at) && (
                                        <InfoCard
                                            icon={Clock}
                                            label="Último acesso"
                                            value={formatDate(
                                                user.last_session_at ||
                                                user.last_seen_at ||
                                                user.last_sign_in_at ||
                                                user.created_at
                                            )}
                                        />
                                    )}

                                    <InfoCard
                                        icon={Calendar}
                                        label="Criado em"
                                        value={formatDate(user.created_at)}
                                    />

                                    <InfoCard
                                        icon={Activity}
                                        label="Status"
                                        value={
                                            user.status === 'active'
                                                ? 'Ativo'
                                                : user.status === 'inactive'
                                                    ? 'Inativo'
                                                    : user.status === 'suspended'
                                                        ? 'Suspenso'
                                                        : user.status
                                        }
                                    />
                                </div>
                            )}

                            {activeTab === 'profile' && (
                                <div className="space-y-5">
                                    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                                        <div className="flex items-center gap-4">
                                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#21A896] text-white flex items-center justify-center text-xl font-black">
                                                {savingAvatar && (
                                                    <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center">
                                                        <Loader className="h-6 w-6 animate-spin text-white" />
                                                    </div>
                                                )}
                                                {user.avatar_url ? (
                                                    <img
                                                        src={user.avatar_url}
                                                        alt={user.full_name || 'Avatar do usuário'}
                                                        className="absolute inset-0 h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span>{getInitials(user.full_name || user.email_for_store || user.email)}</span>
                                                )}
                                            </div>

                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">
                                                    Foto/avatar
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    Esta imagem será usada para identificar o colaborador no sistema.
                                                </p>

                                                <label className={`mt-3 inline-flex cursor-pointer items-center rounded-xl bg-[#21A896] px-4 py-2 text-sm font-bold text-white hover:bg-[#188b7c] ${savingAvatar ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                    Alterar foto
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        className="hidden"
                                                        disabled={savingAvatar}
                                                        onChange={handleAvatarChange}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                        <h4 className="mb-4 font-bold text-gray-900 dark:text-white">
                                            Dados de contato
                                        </h4>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <InputField
                                                label="Nome"
                                                value={profileForm.profileName}
                                                disabled
                                                onChange={(value) =>
                                                    setProfileForm((current) => ({ ...current, profileName: value }))
                                                }
                                            />

                                            <InputField
                                                label="E-mail de Contato"
                                                value={profileForm.profileEmail}
                                                disabled
                                                onChange={() => {}}
                                            />

                                            <InputField
                                                label="Apelido"
                                                placeholder="Como prefere ser chamado"
                                                value={profileForm.internalAlias}
                                                onChange={(value) =>
                                                    setProfileForm((current) => ({ ...current, internalAlias: value }))
                                                }
                                            />

                                            <InputField
                                                label="Celular"
                                                value={profileForm.profileMobilePhone}
                                                disabled
                                                onChange={(value) =>
                                                    setProfileForm((current) => ({ ...current, profileMobilePhone: formatPhone(value) }))
                                                }
                                            />

                                            <InputField
                                                label="WhatsApp"
                                                value={profileForm.profileWhatsappPhone}
                                                disabled
                                                onChange={(value) =>
                                                    setProfileForm((current) => ({ ...current, profileWhatsappPhone: formatPhone(value) }))
                                                }
                                            />

                                            <InputField
                                                label="Telefone"
                                                value={profileForm.profilePhone}
                                                disabled
                                                onChange={(value) =>
                                                    setProfileForm((current) => ({ ...current, profilePhone: formatPhone(value) }))
                                                }
                                            />

                                            {canViewSensitiveUserData && (
                                                <>
                                                    <InputField
                                                        label="CPF"
                                                        value={profileForm.profileCpf}
                                                        disabled
                                                        onChange={(value) =>
                                                            setProfileForm((current) => ({ ...current, profileCpf: formatCPF(value) }))
                                                        }
                                                    />

                                                    <InputField
                                                        label="Nascimento"
                                                        type="date"
                                                        value={profileForm.profileBirthdate}
                                                        disabled
                                                        onChange={(value) =>
                                                            setProfileForm((current) => ({ ...current, profileBirthdate: value }))
                                                        }
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {canViewSensitiveUserData && (
                                        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                            <h4 className="mb-4 font-bold text-gray-900 dark:text-white">
                                                Endereço
                                            </h4>

                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                                <InputField
                                                    label="CEP"
                                                    value={profileForm.profileZipCode}
                                                    disabled
                                                    onChange={handleCepChange}
                                                />

                                                <InputField
                                                    label="Endereço"
                                                    value={profileForm.profileAddress}
                                                    disabled
                                                    onChange={(value) =>
                                                        setProfileForm((current) => ({ ...current, profileAddress: value }))
                                                    }
                                                    className="md:col-span-2"
                                                />

                                                <InputField
                                                    label="Número"
                                                    value={profileForm.profileAddressNumber}
                                                    disabled
                                                    onChange={(value) =>
                                                        setProfileForm((current) => ({ ...current, profileAddressNumber: value }))
                                                    }
                                                />

                                                <InputField
                                                    label="Complemento"
                                                    value={profileForm.profileComplement}
                                                    disabled
                                                    onChange={(value) =>
                                                        setProfileForm((current) => ({ ...current, profileComplement: value }))
                                                    }
                                                />

                                                <InputField
                                                    label="Bairro"
                                                    value={profileForm.profileDistrict}
                                                    disabled
                                                    onChange={(value) =>
                                                        setProfileForm((current) => ({ ...current, profileDistrict: value }))
                                                    }
                                                />

                                                <InputField
                                                    label="Cidade"
                                                    value={profileForm.profileCity}
                                                    disabled
                                                    onChange={(value) =>
                                                        setProfileForm((current) => ({ ...current, profileCity: value }))
                                                    }
                                                />

                                                <InputField
                                                    label="Estado"
                                                    value={profileForm.profileState}
                                                    disabled
                                                    onChange={(value) =>
                                                        setProfileForm((current) => ({ ...current, profileState: value }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                        <h4 className="mb-4 font-bold text-gray-900 dark:text-white">
                                            Redes e canais
                                        </h4>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                            <InputField
                                                label="Instagram"
                                                value={profileForm.profileInstagramUrl}
                                                disabled
                                                onChange={(value) =>
                                                    setProfileForm((current) => ({ ...current, profileInstagramUrl: value }))
                                                }
                                            />

                                            <InputField
                                                label="Facebook"
                                                value={profileForm.profileFacebookUrl}
                                                disabled
                                                onChange={(value) =>
                                                    setProfileForm((current) => ({ ...current, profileFacebookUrl: value }))
                                                }
                                            />

                                            <InputField
                                                label="Site"
                                                value={profileForm.profileWebsiteUrl}
                                                disabled
                                                onChange={(value) =>
                                                    setProfileForm((current) => ({ ...current, profileWebsiteUrl: value }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    {user.additional_info && user.additional_info.length > 0 && (
                                        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                                            <h4 className="mb-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Info size={18} className="text-[#21A896]" />
                                                Informações adicionais
                                            </h4>

                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                {user.additional_info.map((item, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-start gap-3 rounded-lg bg-white p-3 border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50"
                                                    >
                                                        <Info size={18} className="mt-0.5 text-gray-400 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                                                <span className="text-xs font-bold uppercase tracking-wide text-gray-500 truncate max-w-full">
                                                                    {item.title}
                                                                </span>
                                                                {item.sensitive && (
                                                                    <span className="inline-flex items-center rounded-md bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-600/10 dark:ring-red-500/20">
                                                                        Sensível
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-900 dark:text-white break-words">
                                                                {item.text}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleSaveProfileDetails}
                                            disabled={!onSaveProfileDetails || savingProfileDetails}
                                            className="rounded-xl bg-[#21A896] px-4 py-2 text-sm font-bold text-white hover:bg-[#1A867A] disabled:opacity-50"
                                        >
                                            {savingProfileDetails ? 'Salvando...' : 'Salvar dados'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'access_role' && (
                                <div className="space-y-5">
                                    <div className="rounded-xl border border-[#21A896]/20 bg-[#21A896]/10 p-3 text-sm text-gray-700 dark:border-[#21A896]/30 dark:bg-[#21A896]/10 dark:text-gray-200">
                                        Papel no sistema define o acesso base. Função personalizada aplica ajustes específicos de permissão compatíveis com esse papel.
                                    </div>

                                    {canManageUsers && (
                                        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                            <h4 className="mb-4 font-bold text-gray-900 dark:text-white">
                                                Configurações de Acesso
                                            </h4>

                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <label className="block">
                                                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                                        Papel no sistema
                                                    </span>
                                                    <select
                                                        value={user.role}
                                                        disabled={isProtectedOwner || !onRequestRoleChange}
                                                        onChange={(event) => {
                                                            const nextRole = event.target.value;
                                                            if (user.role !== nextRole) {
                                                                onRequestRoleChange?.(user, nextRole);
                                                            }
                                                        }}
                                                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                    >
                                                        <option value="viewer">Visualizador</option>
                                                        <option value="staff">Equipe</option>
                                                        <option value="sales">Vendas</option>
                                                        <option value="cashier">Caixa</option>
                                                        <option value="stock_operator">Operador de estoque</option>
                                                        <option value="manager">Gerente</option>
                                                        <option value="admin">Administrador</option>
                                                    </select>
                                                </label>

                                                <label className="block">
                                                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                                        Função personalizada
                                                    </span>
                                                    <select
                                                        value={user.custom_role_id ?? ''}
                                                        disabled={isProtectedOwner || !onRequestCustomRoleChange}
                                                        onChange={(event) => {
                                                            const nextCustomRoleId = event.target.value || null;
                                                            if ((user.custom_role_id ?? null) !== nextCustomRoleId) {
                                                                onRequestCustomRoleChange?.(user, nextCustomRoleId);
                                                            }
                                                        }}
                                                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                    >
                                                        <option value="">Sem função personalizada</option>
                                                        {customRoles
                                                            .filter((role) => role.active && role.base_role === user.role)
                                                            .map((role) => (
                                                                <option key={role.id} value={role.id}>
                                                                    {role.name}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <InfoCard
                                            icon={lastSessionIcon}
                                            label="Último evento de sessão"
                                            value={getSessionActionLabel(user.last_session_action)}
                                        />

                                        <InfoCard
                                            icon={Clock}
                                            label="Quando ocorreu"
                                            value={formatOptionalDateTime(user.last_session_at || user.last_seen_at)}
                                        />

                                        <InfoCard
                                            icon={Activity}
                                            label="Último sinal de atividade"
                                            value={formatOptionalDateTime(user.last_seen_at || user.last_session_at)}
                                        />

                                        <InfoCard
                                            icon={Shield}
                                            label="Papel no último acesso"
                                            value={lastSessionRole || formatRoleLabel(user.role)}
                                        />

                                        {lastSessionStoreName && (
                                            <InfoCard
                                                icon={Store}
                                                label="Loja acessada"
                                                value={lastSessionStoreName}
                                            />
                                        )}

                                        {sessionElapsed && (
                                            <InfoCard
                                                icon={Clock}
                                                label="Tempo da sessão"
                                                value={sessionElapsed}
                                            />
                                        )}
                                    </div>

                                    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                        <h4 className="mb-2 flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                                            <Activity size={18} />
                                            Observações de auditoria
                                        </h4>

                                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                                            <li>
                                                • O último acesso é registrado quando o usuário entra em uma loja
                                                no login multi-loja.
                                            </li>
                                            <li>
                                                • A saída do sistema é registrada quando o usuário clica em sair.
                                            </li>
                                            <li>
                                                • Usuários que permanecem com a aba aberta podem atualizar o último
                                                sinal apenas em eventos específicos do sistema.
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">
                                                    Ciclos de acesso
                                                </h4>
                                                <p className="text-sm text-gray-500">
                                                    Entradas, suspensões, desligamentos, retornos e alterações de função.
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => void loadAccessTimeline()}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                            >
                                                <RefreshCw size={15} />
                                                Atualizar
                                            </button>
                                        </div>

                                        {loadingAccessTimeline ? (
                                            <p className="text-sm text-gray-500">Carregando timeline...</p>
                                        ) : accessTimeline.length === 0 ? (
                                            <p className="text-sm text-gray-500">
                                                Nenhum ciclo de acesso registrado.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {accessTimeline.map((item) => (
                                                    <div
                                                        key={item.event_id}
                                                        className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                                                    >
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <p className="font-bold text-gray-900 dark:text-white">
                                                                    {formatAccessEventLabel(item)}
                                                                </p>
                                                                <p className="text-sm text-gray-500">
                                                                    {formatOptionalDateTime(item.event_at)}
                                                                </p>
                                                            </div>

                                                            {item.resulting_status && (
                                                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                                                                    Status: {formatStatusLabel(item.resulting_status)}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {item.description && (
                                                            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                                                                {item.description}
                                                            </p>
                                                        )}

                                                        {(item.old_role || item.new_role) && (
                                                            <p className="mt-2 text-xs text-gray-500">
                                                                Papel:{' '}
                                                                {item.old_role ? formatRoleLabel(item.old_role) : '-'}
                                                                {' -> '}
                                                                {item.new_role ? formatRoleLabel(item.new_role) : '-'}
                                                            </p>
                                                        )}

                                                        {item.created_by_email && (
                                                            <p className="mt-2 text-xs text-gray-400">
                                                                Registrado por: {item.created_by_email}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {Object.keys(lastSessionDetails).length > 0 && (
                                        <details className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                            <summary className="cursor-pointer text-sm font-bold text-gray-700 dark:text-gray-300">
                                                Ver detalhes técnicos do último evento
                                            </summary>

                                            <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                                                {JSON.stringify(lastSessionDetails, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="space-y-5">
                                    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <h4 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                                                    <Activity size={18} />
                                                    Histórico completo do usuário
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Consulte eventos de segurança, ocorrências e auditorias vinculadas a este membro.
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void fetchHistory()}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                >
                                                    <RefreshCw size={15} />
                                                    Atualizar
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setHistorySortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                >
                                                    <ArrowUpDown size={15} />
                                                    {historySortOrder === 'asc' ? 'Antigos primeiro' : 'Recentes primeiro'}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={exportUserHistoryCsv}
                                                    disabled={fullHistory.length === 0}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-[#21A896] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#1A867A] disabled:opacity-50"
                                                >
                                                    <FileDown size={15} />
                                                    CSV
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={printUserHistoryReport}
                                                    disabled={fullHistory.length === 0}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                >
                                                    <Printer size={15} />
                                                    Imprimir
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                                            <DateField
                                                label="De"
                                                value={historyFilters.dateFrom ?? ''}
                                                onChange={(value) =>
                                                    void updateHistoryFilters({ dateFrom: value || null })
                                                }
                                            />

                                            <DateField
                                                label="Até"
                                                value={historyFilters.dateTo ?? ''}
                                                onChange={(value) =>
                                                    void updateHistoryFilters({ dateTo: value || null })
                                                }
                                            />

                                            <SelectField
                                                label="Módulo"
                                                value={historyFilters.module ?? ''}
                                                options={[
                                                    ['', 'Todos'],
                                                    ['security', 'Segurança'],
                                                    ['users', 'Usuários'],
                                                    ['audit', 'Auditoria'],
                                                ]}
                                                onChange={(value) =>
                                                    void updateHistoryFilters({ module: value || null })
                                                }
                                            />

                                            <SelectField
                                                label="Resultado"
                                                value={historyFilters.outcome ?? ''}
                                                options={[
                                                    ['', 'Todos'],
                                                    ['success', 'Sucesso'],
                                                    ['failure', 'Falha'],
                                                    ['info', 'Informativo'],
                                                    ['low', 'Baixa'],
                                                    ['medium', 'Média'],
                                                    ['high', 'Alta'],
                                                    ['critical', 'Crítica'],
                                                ]}
                                                onChange={(value) =>
                                                    void updateHistoryFilters({ outcome: value || null })
                                                }
                                            />

                                            <label className="block">
                                                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                                    Busca
                                                </span>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={historyFilters.search ?? ''}
                                                        onChange={(event) =>
                                                            void updateHistoryFilters({
                                                                search: event.target.value || null,
                                                            })
                                                        }
                                                        placeholder="Buscar..."
                                                        className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                    />
                                                </div>
                                            </label>
                                        </div>

                                        <div className="mt-3 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => void resetHistoryFilters()}
                                                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                                            >
                                                <Filter size={15} />
                                                Limpar filtros
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                                        Use os filtros para montar um recorte específico do histórico. O botão Imprimir permite gerar uma versão para papel ou salvar como PDF pelo navegador.
                                    </div>

                                    {historyError && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                            {historyError}
                                        </div>
                                    )}

                                    {historyLoading ? (
                                        <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-700">
                                            <Loader className="mx-auto mb-3 h-6 w-6 animate-spin text-[#21A896]" />
                                            <p className="text-sm text-gray-500">Carregando histórico...</p>
                                        </div>
                                    ) : fullHistory.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
                                            <Activity className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                                            <p className="font-bold text-gray-700 dark:text-gray-200">
                                                Nenhum evento encontrado
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Ajuste os filtros ou aguarde novas ações do usuário.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {fullHistory.map((event) => (
                                                <div
                                                    key={`${event.source}-${event.event_id}`}
                                                    className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                                                >
                                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                        <div>
                                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                                                    {formatHistoryModule(event.module)}
                                                                </span>
                                                                <span className="rounded-full bg-[#21A896]/10 px-2 py-1 text-xs font-bold text-[#21A896]">
                                                                    {formatHistoryOutcome(event.outcome)}
                                                                </span>
                                                                <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                                    {formatHistorySource(event.source)}
                                                                </span>
                                                            </div>

                                                            <h5 className="font-bold text-gray-900 dark:text-white">
                                                                {formatHistoryEventLabel(event)}
                                                            </h5>

                                                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                                                                {formatHistoryDescription(event)}
                                                            </p>

                                                        </div>

                                                        <p className="shrink-0 text-xs text-gray-500">
                                                            {formatOptionalDateTime(event.event_at)}
                                                        </p>
                                                    </div>

                                                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                                                        <details className="mt-3">
                                                            <summary className="cursor-pointer text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                                                Ver detalhes técnicos
                                                            </summary>
                                                            <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                                                                {JSON.stringify(event.metadata, null, 2)}
                                                            </pre>
                                                        </details>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'internal' && canManageUsers && (
                                <div className="space-y-5">
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                                        Estes dados são internos da loja e devem ficar restritos ao proprietário,
                                        administrador ou gerente autorizado.
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <TextField
                                            label="Apelido interno"
                                            value={profileForm.internalAlias}
                                            onChange={(value) =>
                                                setProfileForm((current) => ({
                                                    ...current,
                                                    internalAlias: value,
                                                }))
                                            }
                                        />

                                        <TextField
                                            label="Setor"
                                            value={profileForm.department}
                                            onChange={(value) =>
                                                setProfileForm((current) => ({
                                                    ...current,
                                                    department: value,
                                                }))
                                            }
                                        />

                                        <DateField
                                            label="Início das atividades"
                                            value={internalForm.startedAt}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    startedAt: value,
                                                }))
                                            }
                                        />

                                        <DateField
                                            label="Fim das atividades"
                                            value={internalForm.endedAt}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    endedAt: value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <TextAreaField
                                        label="Motivo da saída"
                                        value={internalForm.exitReason}
                                        onChange={(value) =>
                                            setInternalForm((current) => ({
                                                ...current,
                                                exitReason: value,
                                            }))
                                        }
                                    />

                                    {canViewSensitiveUserData && (
                                        <TextAreaField
                                            label="Observações internas"
                                            value={profileForm.internalNotes}
                                            disabled={!canManageSensitiveUserData}
                                            onChange={(value) =>
                                                setProfileForm((current) => ({
                                                    ...current,
                                                    internalNotes: value,
                                                }))
                                            }
                                        />
                                    )}

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleSaveInternalDetails}
                                            disabled={saving}
                                            className="inline-flex items-center gap-2 rounded-xl bg-[#21A896] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1A867A] disabled:opacity-60"
                                        >
                                            {saving ? (
                                                <Loader className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Save size={16} />
                                            )}
                                            Salvar dados internos
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'occurrences' && canManageUsers && (
                                <div className="space-y-5">
                                    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                        <h4 className="mb-3 font-bold text-gray-900 dark:text-white">
                                            Nova ocorrência
                                        </h4>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                            <SelectField
                                                label="Tipo"
                                                value={occurrenceForm.occurrenceType}
                                                options={getAvailableOccurrenceTypes(user.status).map((option) => [
                                                    option.value,
                                                    option.label,
                                                ])}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => {
                                                        const selectedType = OCCURRENCE_TYPE_OPTIONS.find(
                                                            (option) => option.value === value
                                                        );

                                                        return {
                                                            ...current,
                                                            occurrenceType: value as OccurrenceFormType,
                                                            severity: selectedType?.severity ?? current.severity,
                                                            newRole:
                                                                value === 'role_change' || value === 'admission'
                                                                    ? current.newRole || user.role
                                                                    : current.newRole,
                                                        };
                                                    })
                                                }
                                            />

                                            <SelectField
                                                label="Gravidade"
                                                value={occurrenceForm.severity}
                                                options={[
                                                    ['info', 'Informativo'],
                                                    ['low', 'Baixa'],
                                                    ['medium', 'Média'],
                                                    ['high', 'Alta'],
                                                    ['critical', 'Crítica'],
                                                ]}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        severity: value as StoreMemberOccurrenceSeverity,
                                                    }))
                                                }
                                            />

                                            <DateField
                                                label="Data da ocorrência — opcional"
                                                value={occurrenceForm.occurredAt}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        occurredAt: value,
                                                    }))
                                                }
                                            />

                                            <TimeField
                                                label="Hora da ocorrência — opcional"
                                                value={occurrenceForm.occurredTime}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        occurredTime: value,
                                                    }))
                                                }
                                            />
                                        </div>

                                        <div className="mt-4 space-y-4">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Se não informar data e hora, será usado o horário atual do sistema.
                                            </p>

                                            <TextField
                                                label="Título"
                                                value={occurrenceForm.title}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        title: value,
                                                    }))
                                                }
                                            />

                                            <TextAreaField
                                                label="Descrição"
                                                value={occurrenceForm.description}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        description: value,
                                                    }))
                                                }
                                            />

                                            {(occurrenceForm.occurrenceType === 'role_change' ||
                                                occurrenceForm.occurrenceType === 'admission') && (
                                                    <div className="space-y-3">
                                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                                            {occurrenceForm.occurrenceType === 'admission'
                                                                ? 'Defina o papel e a função personalizada que o colaborador terá ao iniciar/retornar.'
                                                                : 'Defina o novo papel e/ou função personalizada do colaborador.'}
                                                        </p>

                                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                            <SelectField
                                                                label="Novo papel no sistema"
                                                                value={occurrenceForm.newRole || user.role}
                                                                options={[
                                                                    ['admin', 'Administrador'],
                                                                    ['manager', 'Gerente'],
                                                                    ['stock_operator', 'Operador de estoque'],
                                                                    ['cashier', 'Caixa'],
                                                                    ['sales', 'Vendas'],
                                                                    ['staff', 'Equipe'],
                                                                    ['viewer', 'Visualizador'],
                                                                ]}
                                                                onChange={(value) =>
                                                                    setOccurrenceForm((current) => ({
                                                                        ...current,
                                                                        newRole: value,
                                                                        newCustomRoleId: '',
                                                                    }))
                                                                }
                                                            />

                                                            <SelectField
                                                                label="Função personalizada"
                                                                value={occurrenceForm.newCustomRoleId}
                                                                options={[
                                                                    ['', 'Sem função personalizada'],
                                                                    ...customRoles
                                                                        .filter(
                                                                            (role) =>
                                                                                role.active &&
                                                                                role.base_role ===
                                                                                (occurrenceForm.newRole || user.role)
                                                                        )
                                                                        .map((role) => [
                                                                            role.id,
                                                                            `${role.name} — base: ${formatRoleLabel(role.base_role)}`,
                                                                        ] as [string, string]),
                                                                ]}
                                                                onChange={(value) =>
                                                                    setOccurrenceForm((current) => ({
                                                                        ...current,
                                                                        newCustomRoleId: value,
                                                                    }))
                                                                }
                                                            />

                                                            <label className="flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300 md:col-span-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={occurrenceForm.clearIndividualOverrides}
                                                                    onChange={(event) =>
                                                                        setOccurrenceForm((current) => ({
                                                                            ...current,
                                                                            clearIndividualOverrides: event.target.checked,
                                                                        }))
                                                                    }
                                                                    className="mt-1"
                                                                />
                                                                <span>
                                                                    Limpar permissões individuais ao aplicar esta alteração.
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}

                                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                <input
                                                    type="checkbox"
                                                    checked={occurrenceForm.visibleToMember}
                                                    onChange={(event) =>
                                                        setOccurrenceForm((current) => ({
                                                            ...current,
                                                            visibleToMember: event.target.checked,
                                                        }))
                                                    }
                                                />
                                                Visível ao membro no futuro
                                            </label>

                                            {occurrenceForm.occurrenceType === 'admission' && (
                                                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100">
                                                    Esta ocorrência irá ativar o acesso do colaborador à loja e iniciar um novo ciclo de vínculo.
                                                </div>
                                            )}

                                            {occurrenceForm.occurrenceType === 'suspension' && (
                                                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-900/40 dark:bg-orange-900/20 dark:text-orange-100">
                                                    Esta ocorrência irá suspender temporariamente o acesso do colaborador. Ao tentar acessar a loja, ele deverá ver um aviso de acesso suspenso.
                                                </div>
                                            )}

                                            {occurrenceForm.occurrenceType === 'return_from_suspension' && (
                                                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100">
                                                    Esta ação remove a suspensão temporária e libera novamente o acesso à loja.
                                                </div>
                                            )}

                                            {occurrenceForm.occurrenceType === 'exit' && (
                                                <div className="flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-100">
                                                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                                                    <div>
                                                        <p className="font-bold">Esta ocorrência irá encerrar o vínculo e inativar o acesso do colaborador à loja.</p>
                                                        <p className="mt-1">
                                                            Ele deixará de visualizar esta loja no próximo login/atualização de sessão.
                                                        </p>
                                                        <p className="mt-1">O histórico será preservado.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {occurrenceForm.occurrenceType === 'role_change' && (
                                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
                                                    Esta ocorrência irá registrar e aplicar uma alteração de papel no sistema e/ou função personalizada.
                                                </div>
                                            )}

                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={handleAddOccurrence}
                                                    disabled={saving}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-[#21A896] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1A867A] disabled:opacity-60"
                                                >
                                                    {saving ? (
                                                        <Loader className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Plus size={16} />
                                                    )}
                                                    {occurrenceForm.occurrenceType === 'exit'
                                                        ? 'Registrar desligamento e inativar acesso'
                                                        : occurrenceForm.occurrenceType === 'suspension'
                                                            ? 'Registrar suspensão e suspender acesso'
                                                            : occurrenceForm.occurrenceType === 'return_from_suspension'
                                                                ? 'Registrar retorno de suspensão'
                                                                : occurrenceForm.occurrenceType === 'admission'
                                                                    ? 'Registrar admissão/retorno e ativar acesso'
                                                                    : 'Registrar ocorrência'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="mb-3 font-bold text-gray-900 dark:text-white">
                                            Histórico de ocorrências
                                        </h4>

                                        {occurrences.length === 0 ? (
                                            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-700/50">
                                                Nenhuma ocorrência registrada.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {occurrences.map((occurrence) => (
                                                    <div
                                                        key={occurrence.id}
                                                        className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                                                    >
                                                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                            <div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                                                        {formatOccurrenceType(
                                                                            occurrence.occurrence_type,
                                                                            occurrence.metadata
                                                                        )}
                                                                    </span>
                                                                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${OCCURRENCE_SEVERITY_CLASSES[occurrence.severity] ?? OCCURRENCE_SEVERITY_CLASSES.info}`}>
                                                                        {formatSeverity(occurrence.severity)}
                                                                    </span>
                                                                    {!occurrence.visible_to_member && (
                                                                        <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                                            Interno
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <h5 className="mt-2 font-bold text-gray-900 dark:text-white">
                                                                    {formatOccurrenceTitle(occurrence)}
                                                                </h5>

                                                                {occurrence.description && (
                                                                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                                                                        {occurrence.description}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <p className="text-xs text-gray-500">
                                                                {formatDate(occurrence.occurred_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function InfoCard({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof User;
    label: string;
    value?: string | null;
}) {
    return (
        <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
            <Icon size={18} className="mt-0.5 text-gray-400" />
            <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {label}
                </p>
                <p className="text-sm text-gray-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
}



function TextField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <input
                type="text"
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
        </label>
    );
}

function DateField({
    label,
    value,
    onChange,
}: {
    label: string;
    value?: string | null;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <input
                type="date"
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
        </label>
    );
}

function TimeField({
    label,
    value,
    onChange,
}: {
    label: string;
    value?: string | null;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <input
                type="time"
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
        </label>
    );
}

function TextAreaField({
    label,
    value,
    disabled = false,
    onChange,
}: {
    label: string;
    value?: string | null;
    disabled?: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <textarea
                value={value ?? ''}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800"
            />
        </label>
    );
}

function getEmptyInternalForm(): InternalFormState {
    return {
        street: '',
        number: '',
        complement: '',
        district: '',
        city: '',
        state: '',
        zipCode: '',
        startedAt: '',
        endedAt: '',
        exitReason: '',
    };
}

function getInternalFormFromDetails(
    details: ReturnType<typeof useStoreMemberDetails>['details']
): InternalFormState {
    if (!details) {
        return getEmptyInternalForm();
    }

    return {
        street: getStringFromRecord(details.address, 'street'),
        number: getStringFromRecord(details.address, 'number'),
        complement: getStringFromRecord(details.address, 'complement'),
        district: getStringFromRecord(details.address, 'district'),
        city: getStringFromRecord(details.address, 'city'),
        state: getStringFromRecord(details.address, 'state'),
        zipCode: getStringFromRecord(details.address, 'zip_code'),
        startedAt: details.started_at ?? '',
        endedAt: details.ended_at ?? '',
        exitReason: details.exit_reason ?? '',
    };
}

function getInitials(fullName: string | null | undefined): string {
    if (!fullName) return 'U';

    return fullName
        .split(' ')
        .map((namePart) => namePart[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value?: string | null;
    options: Array<[string, string]>;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <select
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
                {options.map(([optionValue, optionLabel]) => (
                    <option key={optionValue} value={optionValue}>
                        {optionLabel}
                    </option>
                ))}
            </select>
        </label>
    );
}

function InputField({
    label,
    value,
    onChange,
    type = 'text',
    className = '',
    disabled = false,
    placeholder = '',
}: {
    label: string;
    value?: string | null;
    onChange: (value: string) => void;
    type?: string;
    className?: string;
    disabled?: boolean;
    placeholder?: string;
}) {
    return (
        <label className={`block ${className}`}>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <input
                type={type}
                value={value ?? ''}
                disabled={disabled}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800"
            />
        </label>
    );
}

function formatCPF(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
}

function formatCEP(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
}

function formatPhone(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

function getInternalFormFromUser(user: UserAdmin | null | undefined): InternalFormState {
    if (!user) return getEmptyInternalForm();
    return {
        street: user.address ?? '',
        number: user.address_number ?? '',
        complement: user.complement ?? '',
        district: user.district ?? '',
        city: user.city ?? '',
        state: user.state ?? '',
        zipCode: user.zip_code ?? '',
        startedAt: '',
        endedAt: '',
        exitReason: '',
    };
}
