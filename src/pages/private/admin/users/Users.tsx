import { useEffect, useMemo, useState, useCallback } from 'react';
import { useUsersStore } from '@/store/useUsersStore';
import type { UserAdmin, UserFormData, UserRole, UserFilters } from '@/types';
import { UserCard, UserFormModal, UserDetailModal } from '@/components/users';
import { UserInvitesPanel } from '@/components/users/UserInvitesPanel';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useStoreMemberInvites } from '@/hooks/useStoreMemberInvites';
import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import { toast } from 'sonner';
import { Users as UsersIcon, UserCheck, UserX, Shield, Search, Plus, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useStoreMemberSessionSummary } from '@/hooks/security/useStoreMemberSessionSummary';
import { getActiveStoreId } from '@/utils/activeStore';
import { supabase } from '@/lib/supabase';
import { useStoreCustomRoles } from '@/hooks/security/useStoreCustomRoles';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { useRealtimeListener } from '@/hooks/useRealtimeListener';
import {
    listStoreProfileChangeRequests,
    reviewStoreProfileChangeRequest,
    PROFILE_REQUEST_STATUS_LABELS,
    PROFILE_REQUEST_TYPE_LABELS,
    type ProfileChangeRequest,
    type ProfileChangeRequestStatus,
} from '@/services/securityService';

// Correção 6 — Labels reutilizados do Profile.tsx para exibição no painel admin
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

function formatRoleLabel(role: string): string {
    const labels: Record<string, string> = {
        owner: 'Proprietário',
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

export default function Users() {
    const {
        users,
        loading,
        stats,
        filters,
        total,
        fetchUsers,
        fetchStats,
        createUser,
        updateUser,
        updateUserProfileDetails,
        setFilters,
        resetFilters,
    } = useUsersStore();

    const { securityContext } = useSecurityContext();

    const activeStoreId = getActiveStoreId();

    const activeMembership = useMemo(() => {
        if (!securityContext?.memberships?.length) {
            return securityContext?.primary_membership ?? null;
        }

        if (!activeStoreId) {
            return securityContext.primary_membership ?? null;
        }

        return (
            securityContext.memberships.find(
                (membership) =>
                    membership.store_id === activeStoreId &&
                    membership.status === 'active'
            ) ??
            securityContext.primary_membership ??
            null
        );
    }, [securityContext?.memberships, securityContext?.primary_membership, activeStoreId]);

    const operationalStoreId = activeMembership?.store_id ?? activeStoreId ?? null;

    const { hasPermission } = usePermissions(operationalStoreId);
    const {
        invites,
        loading: loadingInvites,
        saving: savingInvites,
        refresh: refreshInvites,
        cancelInvite,
    } = useStoreMemberInvites(operationalStoreId);
    const canManageUsers = hasPermission('users.manage');
    const canViewOwners = hasPermission('users.owner.view');
    const canViewSensitiveUsers = hasPermission('users.sensitive.view');
    const canManageSensitiveUsers = hasPermission('users.sensitive.manage');
    const canViewProfileRequests = hasPermission('users.profile_requests.view');
    const canReviewProfileRequests =
        hasPermission('users.profile_requests.review') ||
        hasPermission('users.profile_requests.manage');

    const [profileRequests, setProfileRequests] = useState<ProfileChangeRequest[]>([]);
    const [loadingProfileRequests, setLoadingProfileRequests] = useState(false);

    // Filtros, busca e ordenação das solicitações cadastrais de colaboradores
    const [profileRequestSearch, setProfileRequestSearch] = useState('');
    const [profileRequestStatusFilter, setProfileRequestStatusFilter] = useState<'all' | ProfileChangeRequestStatus>('all');
    const [profileRequestDateFrom, setProfileRequestDateFrom] = useState('');
    const [profileRequestDateTo, setProfileRequestDateTo] = useState('');
    const [profileRequestSortOrder, setProfileRequestSortOrder] = useState<string>('created_desc');
    const [profileRequestRequesterFilter, setProfileRequestRequesterFilter] = useState<string>('all');
    const [collapsedRequests, setCollapsedRequests] = useState<Record<string, boolean>>({});

    const uniqueRequesters = useMemo(() => {
        const names = new Set<string>();
        profileRequests.forEach((req) => {
            const displayName = req.profile_name || req.internal_alias || req.user_email || 'Usuário';
            names.add(displayName);
        });
        return Array.from(names).sort();
    }, [profileRequests]);

    const toggleRequestCollapse = (requestId: string) => {
        setCollapsedRequests((prev) => ({
            ...prev,
            [requestId]: !prev[requestId],
        }));
    };

    function getRequestTitle(request: ProfileChangeRequest): string {
        const baseTitle = PROFILE_REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type;

        if (request.request_type === 'additional_info_remove') {
            const itemTitle = request.requested_changes?.title || 'Informação adicional';
            return `Remoção de informação adicional (${itemTitle})`;
        }

        if (request.request_type === 'additional_info_update') {
            let itemTitle = 'Informação adicional';
            const changes = request.requested_changes ?? {};
            const additionalInfoChange = changes.member_additional_info || changes.additional_info;
            if (additionalInfoChange) {
                const infoChange = formatAdditionalInfoChange(additionalInfoChange);
                itemTitle = infoChange.title;
            }
            return `Alteração de informação adicional (${itemTitle})`;
        }

        return baseTitle;
    }

    const [reviewModal, setReviewModal] = useState<{
        isOpen: boolean;
        request: ProfileChangeRequest | null;
        decision: 'approve' | 'reject' | 'cancel' | null;
        adminNotes: string;
        saving: boolean;
    }>({
        isOpen: false,
        request: null,
        decision: null,
        adminNotes: '',
        saving: false,
    });

    const loadProfileRequests = useCallback(async () => {
        if (!operationalStoreId || !canViewProfileRequests) return;

        setLoadingProfileRequests(true);
        try {
            const rows = await listStoreProfileChangeRequests({
                storeId: operationalStoreId,
                status: null, // Buscar todos para filtrar localmente
                requestType: null,
                limit: 100,
                offset: 0,
            });
            setProfileRequests(rows);
        } catch (error) {
            console.error(error);
            toast.error('Não foi possível carregar as solicitações cadastrais.');
        } finally {
            setLoadingProfileRequests(false);
        }
    }, [operationalStoreId, canViewProfileRequests]);

    useEffect(() => {
        void loadProfileRequests();
    }, [loadProfileRequests]);

    const filteredProfileRequests = useMemo(() => {
        return profileRequests
            .filter((req) => {
                // Filtro de status
                if (profileRequestStatusFilter !== 'all' && req.status !== profileRequestStatusFilter) {
                    return false;
                }

                // Filtro de solicitante
                if (profileRequestRequesterFilter !== 'all') {
                    const displayName = req.profile_name || req.internal_alias || req.user_email || 'Usuário';
                    if (displayName !== profileRequestRequesterFilter) {
                        return false;
                    }
                }

                // Filtro de data de início (created_at >= profileRequestDateFrom)
                if (profileRequestDateFrom) {
                    const fromDate = new Date(`${profileRequestDateFrom}T00:00:00`);
                    if (new Date(req.created_at) < fromDate) {
                        return false;
                    }
                }

                // Filtro de data final (created_at <= profileRequestDateTo)
                if (profileRequestDateTo) {
                    const toDate = new Date(`${profileRequestDateTo}T23:59:59`);
                    if (new Date(req.created_at) > toDate) {
                        return false;
                    }
                }

                // Filtro de pesquisa de texto
                if (profileRequestSearch.trim()) {
                    const query = profileRequestSearch.toLowerCase();
                    const reason = (req.reason ?? '').toLowerCase();
                    const typeLabel = (PROFILE_REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type).toLowerCase();
                    const statusLabel = (PROFILE_REQUEST_STATUS_LABELS[req.status] ?? req.status).toLowerCase();
                    const name = (req.profile_name ?? '').toLowerCase();
                    const alias = (req.internal_alias ?? '').toLowerCase();
                    const email = (req.user_email ?? '').toLowerCase();

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
                        !name.includes(query) &&
                        !alias.includes(query) &&
                        !email.includes(query) &&
                        !matchInChanges
                    ) {
                        return false;
                    }
                }

                return true;
            })
            .sort((a, b) => {
                if (profileRequestSortOrder === 'created_desc') {
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                } else if (profileRequestSortOrder === 'created_asc') {
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                } else if (profileRequestSortOrder === 'reviewed_desc') {
                    const aTime = a.reviewed_at ? new Date(a.reviewed_at).getTime() : 0;
                    const bTime = b.reviewed_at ? new Date(b.reviewed_at).getTime() : 0;
                    if (aTime === bTime) {
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    }
                    return bTime - aTime;
                } else if (profileRequestSortOrder === 'reviewed_asc') {
                    const aTime = a.reviewed_at ? new Date(a.reviewed_at).getTime() : Infinity;
                    const bTime = b.reviewed_at ? new Date(b.reviewed_at).getTime() : Infinity;
                    if (aTime === bTime) {
                        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    }
                    return aTime - bTime;
                }
                return 0;
            });
    }, [profileRequests, profileRequestSearch, profileRequestStatusFilter, profileRequestDateFrom, profileRequestDateTo, profileRequestSortOrder, profileRequestRequesterFilter]);

    const {
        items: sessionSummary,
        refresh: refreshSessionSummary,
    } = useStoreMemberSessionSummary();

    const sessionSummaryByMemberId = useMemo(() => {
        return new Map(sessionSummary.map((item) => [item.member_id, item]));
    }, [sessionSummary]);

    const usersWithSession = useMemo(() => {
        return users.map((user) => {
            const summary = sessionSummaryByMemberId.get(user.id);

            if (!summary) return user;

            return {
                ...user,
                last_seen_at: summary.last_seen_at,
                last_session_action: summary.last_session_action,
                last_session_at: summary.last_session_at,
                last_session_details: summary.last_session_details,
            };
        });
    }, [users, sessionSummaryByMemberId]);

    const filteredUsers = useMemo(() => {
        return usersWithSession.filter((user) => {
            if (!canViewOwners && user.role === 'owner') {
                return false;
            }
            return true;
        });
    }, [usersWithSession, canViewOwners]);

    const [searchTerm, setSearchTerm] = useState('');
    const [showFormModal, setShowFormModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserAdmin | null>(null);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [showFilters, setShowFilters] = useState(false);
    const [roleChangeConfirmation, setRoleChangeConfirmation] = useState<{
        user: UserAdmin;
        newRole: string;
        clearOverrides: boolean;
    } | null>(null);

    const {
        items: customRoles,
        saving: customRoleSaving,
        assignCustomRoleToMember,
    } = useStoreCustomRoles(true);

    const [customRoleConfirmation, setCustomRoleConfirmation] = useState<{
        user: UserAdmin;
        customRoleId: string | null;
        clearOverrides: boolean;
    } | null>(null);

    // Correção 7 — handleRefresh também recarrega solicitações cadastrais
    const handleRefresh = useCallback(async () => {
        await Promise.all([
            fetchUsers(),
            fetchStats(),
            refreshInvites(),
            canViewProfileRequests ? loadProfileRequests() : Promise.resolve(),
        ]);
    }, [fetchUsers, fetchStats, refreshInvites, canViewProfileRequests, loadProfileRequests]);

    useEffect(() => {
        handleRefresh();
    }, [handleRefresh]);

    useRefreshFrame(handleRefresh);

    // Correção 7 — listener inclui tabela de solicitações cadastrais
    useRealtimeListener({
        channelName: `users_rt_${operationalStoreId || 'pending'}`,
        tables: [
            {
                table: 'store_members',
                ...(operationalStoreId ? { filter: `store_id=eq.${operationalStoreId}` } : {}),
            },
            {
                table: 'store_member_profile_change_requests',
                ...(operationalStoreId ? { filter: `store_id=eq.${operationalStoreId}` } : {}),
            },
        ],
        onChanged: handleRefresh,
        enabled: !!operationalStoreId,
    });

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm) {
                setFilters({ search: searchTerm, page: 1 });
                fetchUsers({ search: searchTerm, page: 1 });
            } else {
                resetFilters();
                fetchUsers();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, setFilters, fetchUsers, resetFilters]);

    const handleViewUser = (user: UserAdmin) => {
        const summary = sessionSummaryByMemberId.get(user.id);

        setSelectedUser({
            ...user,
            ...(summary
                ? {
                    last_seen_at: summary.last_seen_at,
                    last_session_action: summary.last_session_action,
                    last_session_at: summary.last_session_at,
                    last_session_details: summary.last_session_details,
                }
                : {}),
        });
        setShowDetailModal(true);
    };


    const handleCreateUser = () => {
        if (!canManageUsers) {
            toast.error('Você não tem permissão para gerenciar usuários.');
            return;
        }

        setSelectedUser(null);
        setFormMode('create');
        setShowFormModal(true);
    };

    const handleFormSubmit = async (data: UserFormData) => {
        if (formMode === 'create') {
            await createUser(data);
            await refreshInvites();
            await refreshSessionSummary();

            setSelectedUser(null);
            setShowFormModal(false);

            return;
        }

        if (selectedUser) {
            if (data.role !== selectedUser.role) {
                setRoleChangeConfirmation({
                    user: selectedUser,
                    newRole: data.role,
                    clearOverrides: false,
                });
                setSelectedUser(null);
                setShowFormModal(false);
                return;
            }
            await updateUser(selectedUser.id, data);
            await refreshSessionSummary();
            setSelectedUser(null);
            setShowFormModal(false);
        }
    };

    const handleConfirmRoleChange = async () => {
        if (!roleChangeConfirmation) return;

        const { user, newRole, clearOverrides } = roleChangeConfirmation;

        try {
            await supabase.rpc('change_store_member_role', {
                p_member_id: user.id,
                p_new_role: newRole,
                p_reason: 'Alteração de função pela tela de usuários',
                p_clear_individual_overrides: clearOverrides,
                p_create_occurrence: true,
            });

            toast.success('Função atualizada com sucesso.');

            setRoleChangeConfirmation(null);

            await fetchUsers();
            await refreshSessionSummary();

            const shouldClearCustomRole =
                clearOverrides ||
                (user.custom_role_base_role && user.custom_role_base_role !== newRole);

            setSelectedUser((prev: UserAdmin | null) => {
                if (!prev || prev.id !== user.id) return prev;

                return {
                    ...prev,
                    role: newRole as UserRole,
                    custom_role_id: shouldClearCustomRole ? null : prev.custom_role_id,
                    custom_role_name: shouldClearCustomRole ? null : prev.custom_role_name,
                };
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Não foi possível alterar a função.';
            toast.error(message);
        }
    };

    const getCustomRoleById = (customRoleId: string | null) => {
        if (!customRoleId) return null;

        return customRoles.find((role) => role.id === customRoleId) ?? null;
    };

    const handleConfirmCustomRoleChange = async () => {
        if (!customRoleConfirmation) return;

        const { user, customRoleId, clearOverrides } = customRoleConfirmation;

        const selectedRole = getCustomRoleById(customRoleId);

        const success = await assignCustomRoleToMember({
            memberId: user.id,
            customRoleId,
            clearOverrides,
            reason: selectedRole
                ? `Atribuição da função personalizada ${selectedRole.name} pela tela de usuários.`
                : 'Remoção da função personalizada pela tela de usuários.',
        });

        if (!success) return;

        setCustomRoleConfirmation(null);

        await fetchUsers();
        await refreshSessionSummary();
        window.dispatchEvent(new Event('optmamenu:security-context-refresh'));
    };

    const handleSaveProfileDetails = async (input: Parameters<typeof updateUserProfileDetails>[0]) => {
        const success = await updateUserProfileDetails(input);

        if (!success) return;

        await refreshSessionSummary();
        await fetchUsers();

        const refreshedUser = await useUsersStore.getState().fetchUserById(input.memberId);
        setSelectedUser(refreshedUser);
    };

    const handleOccurrenceSaved = async (input: {
        user: UserAdmin;
        occurrenceType: string;
    }) => {
        if (input.occurrenceType === 'exit') {
            setShowDetailModal(false);
        }

        await fetchUsers();
        await fetchStats();
        await refreshSessionSummary();

        const refreshedUser = await useUsersStore.getState().fetchUserById(input.user.id);
        const fallbackStatus =
            input.occurrenceType === 'exit'
                ? 'inactive'
                : input.occurrenceType === 'suspension'
                    ? 'suspended'
                    : input.occurrenceType === 'admission' ||
                        input.occurrenceType === 'return_from_suspension'
                        ? 'active'
                        : input.user.status;

        setSelectedUser(refreshedUser ?? {
            ...input.user,
            status: fallbackStatus as UserAdmin['status'],
            is_active: fallbackStatus === 'active',
        });

        if (input.occurrenceType === 'exit') {
            toast.success('Desligamento registrado e acesso inativado.');
        } else if (input.occurrenceType === 'suspension') {
            toast.success('Suspensão registrada e acesso suspenso.');
        } else if (input.occurrenceType === 'admission') {
            toast.success('Admissão/retorno registrado e acesso ativado.');
        } else if (input.occurrenceType === 'return_from_suspension') {
            toast.success('Suspensão removida e acesso reativado.');
        } else if (input.occurrenceType === 'role_change') {
            toast.success('Alteração de função registrada.');
        } else {
            toast.success('Ocorrência registrada.');
        }
    };


    const handleFilterChange = <K extends keyof UserFilters>(
        key: K,
        value: UserFilters[K]
    ) => {
        setFilters({ [key]: value });
    };

    const willClearCustomRoleOnRoleChange =
        roleChangeConfirmation?.user.custom_role_base_role &&
        roleChangeConfirmation.user.custom_role_base_role !== roleChangeConfirmation.newRole;

    return (
        <PageContainer
            title="Usuários"
            subtitle="Gerencie os usuários do sistema e suas permissões"
            category="Configurações"
            icon={<UsersIcon size={28} className="text-[#19A999]" />}
            flat
        >
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatsCard
                    title="Total de Usuários"
                    value={stats?.total || 0}
                    icon={<UsersIcon size={24} />}
                    color="blue"
                />
                <StatsCard
                    title="Usuários Ativos"
                    value={stats?.active || 0}
                    icon={<UserCheck size={24} />}
                    color="green"
                />
                <StatsCard
                    title="Usuários Inativos"
                    value={stats?.inactive || 0}
                    icon={<UserX size={24} />}
                    color="blue"
                />
                <StatsCard
                    title="Administradores"
                    value={stats?.admins || 0}
                    icon={<Shield size={24} />}
                    color="purple"
                />
            </div>

            {canManageUsers && (
                <div className="mb-6">
                    <UserInvitesPanel
                        invites={invites}
                        loading={loadingInvites}
                        saving={savingInvites}
                        onRefresh={refreshInvites}
                        onCancel={async (inviteId) => {
                            await cancelInvite(inviteId, 'Cancelado pela tela de usuários');
                        }}
                    />
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                        <Search
                            size={20}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            type="text"
                            placeholder="Buscar por nome, telefone ou CPF..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] focus:border-transparent"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 ${showFilters
                                ? 'border-[#19A999] bg-[#19A999]/10 text-[#19A999]'
                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <Filter size={18} />
                            Filtros
                        </button>
                        <button
                            onClick={handleCreateUser}
                            disabled={!canManageUsers}
                            title={
                                canManageUsers
                                    ? 'Vincular usuário existente'
                                    : 'Você não tem permissão para gerenciar usuários'
                            }
                            className={`px-4 py-2 rounded-lg bg-[#19A999] text-white font-medium hover:bg-[#14887B] transition-colors flex items-center gap-2 ${!canManageUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Plus size={18} />
                            Novo Usuário
                        </button>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Status
                            </label>
                            <select
                                value={filters.status || ''}
                                onChange={(e) =>
                                    handleFilterChange('sort_by', e.target.value as UserFilters['sort_by'])
                                }
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] focus:border-transparent"
                            >
                                <option value="">Todos</option>
                                <option value="active">Ativo</option>
                                <option value="inactive">Inativo</option>
                                <option value="suspended">Suspenso</option>
                                <option value="invited">Convidado</option>
                                <option value="pending">Pendente</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Permissão
                            </label>
                            <select
                                value={filters.role || ''}
                                onChange={(e) =>
                                    handleFilterChange('role', e.target.value as UserRole | undefined)
                                }
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] focus:border-transparent"
                            >
                                <option value="">Todas</option>
                                <option value="owner">Proprietário</option>
                                <option value="admin">Admin</option>
                                <option value="manager">Gerente</option>
                                <option value="stock_operator">Operador de estoque</option>
                                <option value="cashier">Caixa</option>
                                <option value="sales">Vendas</option>
                                <option value="staff">Equipe</option>
                                <option value="viewer">Visualizador</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Ordenar por
                            </label>
                            <select
                                value={filters.sort_by || 'created_at'}
                                onChange={(e) =>
                                    handleFilterChange('sort_by', e.target.value as UserFilters['sort_by'])
                                }
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] focus:border-transparent"
                            >
                                <option value="created_at">Data de Criação</option>
                                <option value="full_name">Nome</option>
                                <option value="email">Email</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Users List */}
            {loading ? (
                <div className="min-h-[40vh] flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#19A999] mx-auto mb-4"></div>
                        <p className="text-gray-600 dark:text-gray-300 font-candara">
                            Carregando usuários...
                        </p>
                    </div>
                </div>
            ) : users.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <UsersIcon size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Nenhum usuário encontrado
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {searchTerm
                            ? 'Tente ajustar os filtros de busca'
                            : 'Comece criando um novo usuário'}
                    </p>
                    {!searchTerm && (
                        <button
                            onClick={handleCreateUser}
                            disabled={!canManageUsers}
                            title={
                                canManageUsers
                                    ? 'Vincular usuário existente'
                                    : 'Você não tem permissão para gerenciar usuários'
                            }
                            className={`px-4 py-2 rounded-lg bg-[#19A999] text-white font-medium hover:bg-[#14887B] transition-colors ${!canManageUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            Criar Primeiro Usuário
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredUsers.map((user) => (
                        <UserCard
                            key={user.id}
                            user={user}
                            onView={handleViewUser}
                            canManageUsers={canManageUsers}
                            canViewSensitiveUserData={canViewSensitiveUsers}
                        />
                    ))}
                </div>
            )}

            {/* Pagination Info */}
            {!loading && users.length > 0 && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <p>
                        Mostrando <span className="font-medium">{users.length}</span> de{' '}
                        <span className="font-medium">{total}</span> usuário(s)
                    </p>
                    {/* TODO: Implementar paginação completa quando necessário */}
                </div>
            )}

            {/* Seção de solicitações cadastrais */}
            {canViewProfileRequests && (
                <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 shadow-sm">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                Solicitações cadastrais
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Analise pedidos de alteração ou remoção feitos pelos colaboradores.
                            </p>
                        </div>

                        <div className="flex gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={loadProfileRequests}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 transition cursor-pointer flex items-center gap-1 bg-white dark:bg-gray-800"
                            >
                                Atualizar
                            </button>
                        </div>
                    </div>

                    {/* Filtros e Busca */}
                    {!loadingProfileRequests && profileRequests.length > 0 && (
                        <div className="mb-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-xs space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                                {/* Campo de busca */}
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Localizar alteração específica (tipo, motivo, valor)..."
                                        value={profileRequestSearch}
                                        onChange={(e) => setProfileRequestSearch(e.target.value)}
                                        className="w-full text-xs pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999]/30 transition"
                                    />
                                    {profileRequestSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setProfileRequestSearch('')}
                                            className="absolute right-3 top-2 text-gray-400 hover:text-[#F1613A] transition cursor-pointer"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Seletor de Status */}
                                <div className="w-full sm:w-48">
                                    <select
                                        value={profileRequestStatusFilter}
                                        onChange={(e) => setProfileRequestStatusFilter(e.target.value as any)}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999]/30 transition"
                                    >
                                        <option value="all">Todos os status</option>
                                        <option value="pending">Pendente</option>
                                        <option value="applied">Aplicada</option>
                                        <option value="rejected">Rejeitada</option>
                                        <option value="cancelled">Cancelada</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                {/* Data De */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                        De (Data de solicitação)
                                    </label>
                                    <input
                                        type="date"
                                        value={profileRequestDateFrom}
                                        onChange={(e) => setProfileRequestDateFrom(e.target.value)}
                                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999]/30 transition"
                                    />
                                </div>

                                {/* Data Até */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                        Até (Data de solicitação)
                                    </label>
                                    <input
                                        type="date"
                                        value={profileRequestDateTo}
                                        onChange={(e) => setProfileRequestDateTo(e.target.value)}
                                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999]/30 transition"
                                    />
                                </div>

                                {/* Solicitante */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                        Solicitante
                                    </label>
                                    <select
                                        value={profileRequestRequesterFilter}
                                        onChange={(e) => setProfileRequestRequesterFilter(e.target.value)}
                                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999]/30 transition"
                                    >
                                        <option value="all">Todos os solicitantes</option>
                                        {uniqueRequesters.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Ordenação */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                        Ordenar por data
                                    </label>
                                    <select
                                        value={profileRequestSortOrder}
                                        onChange={(e) => setProfileRequestSortOrder(e.target.value)}
                                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999]/30 transition"
                                    >
                                        <option value="created_desc">Mais recente primeiro (Criação)</option>
                                        <option value="created_asc">Mais antigo primeiro (Criação)</option>
                                        <option value="reviewed_desc">Mais recente primeiro (Resposta)</option>
                                        <option value="reviewed_asc">Mais antigo primeiro (Resposta)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Botão de limpar filtros se houver filtros ativos */}
                            {(profileRequestSearch || profileRequestStatusFilter !== 'all' || profileRequestDateFrom || profileRequestDateTo || profileRequestRequesterFilter !== 'all' || profileRequestSortOrder !== 'created_desc') && (
                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProfileRequestSearch('');
                                            setProfileRequestStatusFilter('all');
                                            setProfileRequestDateFrom('');
                                            setProfileRequestDateTo('');
                                            setProfileRequestRequesterFilter('all');
                                            setProfileRequestSortOrder('created_desc');
                                        }}
                                        className="text-[11px] font-bold text-gray-500 hover:text-[#F1613A] transition cursor-pointer"
                                    >
                                        Limpar filtros
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {loadingProfileRequests ? (
                        <p className="text-sm text-gray-500">Carregando solicitações...</p>
                    ) : profileRequests.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            Nenhuma solicitação encontrada.
                        </p>
                    ) : filteredProfileRequests.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">
                            Nenhuma solicitação corresponde aos filtros aplicados.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {filteredProfileRequests.map((request) => (
                                <div
                                    key={request.request_id}
                                    className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between font-candara">
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-900 dark:text-white text-base">
                                                {getRequestTitle(request)}
                                            </p>

                                            {collapsedRequests[request.request_id] && (
                                                <>
                                                    <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-gray-300">
                                                        {request.profile_name || request.internal_alias || request.user_email || 'Usuário'}
                                                    </p>

                                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                        <strong>Motivo:</strong> {request.reason}
                                                    </p>

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

                                                    {/* Correção 6 — exibição campo a campo */}
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

                                                    <p className="mt-2 text-xs text-gray-400">
                                                        Criada em {new Date(request.created_at).toLocaleString('pt-BR')}
                                                    </p>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-start gap-2 md:items-end shrink-0">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                                    {PROFILE_REQUEST_STATUS_LABELS[request.status] ?? request.status}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRequestCollapse(request.request_id)}
                                                    className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition cursor-pointer flex items-center justify-center"
                                                    title={collapsedRequests[request.request_id] ? "Recolher" : "Expandir"}
                                                >
                                                    {collapsedRequests[request.request_id] ? (
                                                        <ChevronUp size={14} />
                                                    ) : (
                                                        <ChevronDown size={14} />
                                                    )}
                                                </button>
                                            </div>

                                            {collapsedRequests[request.request_id] && (
                                                <>
                                                    {request.sensitive && (
                                                        <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/40">
                                                            Sensível
                                                        </span>
                                                    )}

                                                    {request.status === 'pending' && canReviewProfileRequests && (
                                                        <div className="mt-2 flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setReviewModal({
                                                                        isOpen: true,
                                                                        request,
                                                                        decision: 'approve',
                                                                        adminNotes: '',
                                                                        saving: false,
                                                                    })
                                                                }
                                                                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer"
                                                            >
                                                                Aprovar
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setReviewModal({
                                                                        isOpen: true,
                                                                        request,
                                                                        decision: 'reject',
                                                                        adminNotes: '',
                                                                        saving: false,
                                                                    })
                                                                }
                                                                className="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer"
                                                            >
                                                                Rejeitar
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Modals */}
            <UserFormModal
                isOpen={showFormModal}
                onClose={() => setShowFormModal(false)}
                onSubmit={handleFormSubmit}
                user={selectedUser}
                mode={formMode}
            />

            <UserDetailModal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                user={selectedUser}
                canManageUsers={canManageUsers}
                canViewSensitiveUserData={canViewSensitiveUsers}
                canManageSensitiveUserData={canManageSensitiveUsers}
                customRoles={customRoles}
                onRequestRoleChange={(user, newRole) => {
                    setRoleChangeConfirmation({
                        user,
                        newRole,
                        clearOverrides: false,
                    });
                }}
                onRequestCustomRoleChange={(user, customRoleId) => {
                    setCustomRoleConfirmation({
                        user,
                        customRoleId,
                        clearOverrides: false,
                    });
                }}
                onSaveProfileDetails={handleSaveProfileDetails}
                onOccurrenceSaved={handleOccurrenceSaved}
                onAvatarUpdated={async (avatarUrl) => {
                    setSelectedUser((current) =>
                        current ? { ...current, avatar_url: avatarUrl, profile_avatar_url: avatarUrl } : current
                    );
                    await fetchUsers();
                    window.dispatchEvent(new Event('optmamenu:security-context-refresh'));
                }}
            />

            {roleChangeConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white">
                            Confirmar mudança de função
                        </h3>

                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            Você está alterando a função de{' '}
                            <strong>{roleChangeConfirmation.user.full_name}</strong>.
                        </p>

                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                            <p>
                                As permissões herdadas passarão a seguir o novo papel.
                                Esta ação será registrada no histórico de segurança e na Vida do Usuário.
                            </p>
                        </div>

                        {willClearCustomRoleOnRoleChange && roleChangeConfirmation && (
                            <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300">
                                <p>
                                    Este usuário possui a função personalizada{' '}
                                    <strong>{roleChangeConfirmation.user.custom_role_name}</strong>, baseada em{' '}
                                    <strong>{formatRoleLabel(roleChangeConfirmation.user.custom_role_base_role || '')}</strong>.
                                    Como o novo papel será{' '}
                                    <strong>{formatRoleLabel(roleChangeConfirmation.newRole)}</strong>, essa função personalizada será removida automaticamente.
                                </p>
                            </div>
                        )}

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-700/50">
                                <p className="text-xs font-bold uppercase text-gray-500">
                                    Função atual
                                </p>
                                <p className="font-bold text-gray-900 dark:text-white">
                                    {formatRoleLabel(roleChangeConfirmation.user.role)}
                                </p>
                            </div>

                            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-700/50">
                                <p className="text-xs font-bold uppercase text-gray-500">
                                    Nova função
                                </p>
                                <p className="font-bold text-[#19A999]">
                                    {formatRoleLabel(roleChangeConfirmation.newRole)}
                                </p>
                            </div>
                        </div>

                        <label className="mt-4 flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                            <input
                                type="checkbox"
                                checked={roleChangeConfirmation.clearOverrides}
                                onChange={(event) =>
                                    setRoleChangeConfirmation((current) =>
                                        current
                                            ? {
                                                ...current,
                                                clearOverrides: event.target.checked,
                                            }
                                            : current
                                    )
                                }
                                className="mt-1"
                            />
                            <span>
                                Limpar permissões individuais deste usuário ao alterar a função.
                                Se desmarcado, as exceções individuais serão preservadas.
                            </span>
                        </label>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setRoleChangeConfirmation(null)}
                                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmRoleChange}
                                className="rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white hover:bg-[#14887B]"
                            >
                                Confirmar alteração
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {customRoleConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white">
                            Confirmar função personalizada
                        </h3>

                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            Você está alterando a função personalizada de{' '}
                            <strong>{customRoleConfirmation.user.full_name}</strong>.
                        </p>

                        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
                            <p>
                                A função personalizada ajusta permissões herdadas do papel base.
                                Esta ação será registrada no histórico de segurança e na Vida do Usuário.
                            </p>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-700/50">
                                <p className="text-xs font-bold uppercase text-gray-500">
                                    Função atual
                                </p>
                                <p className="font-bold text-gray-900 dark:text-white">
                                    {customRoleConfirmation.user.custom_role_name ?? 'Sem função personalizada'}
                                </p>
                            </div>

                            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-700/50">
                                <p className="text-xs font-bold uppercase text-gray-500">
                                    Nova função
                                </p>
                                <p className="font-bold text-[#19A999]">
                                    {getCustomRoleById(customRoleConfirmation.customRoleId)?.name ??
                                        'Sem função personalizada'}
                                </p>
                            </div>
                        </div>

                        <label className="mt-4 flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                            <input
                                type="checkbox"
                                checked={customRoleConfirmation.clearOverrides}
                                onChange={(event) =>
                                    setCustomRoleConfirmation((current) =>
                                        current
                                            ? {
                                                ...current,
                                                clearOverrides: event.target.checked,
                                            }
                                            : current
                                    )
                                }
                                className="mt-1"
                            />
                            <span>
                                Limpar permissões individuais deste usuário.
                                Se desmarcado, exceções individuais serão preservadas e continuarão prevalecendo sobre a função personalizada.
                            </span>
                        </label>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setCustomRoleConfirmation(null)}
                                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmCustomRoleChange}
                                disabled={customRoleSaving}
                                className="rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white hover:bg-[#14887B] disabled:opacity-50"
                            >
                                {customRoleSaving ? 'Salvando...' : 'Confirmar alteração'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {reviewModal.isOpen && reviewModal.request && reviewModal.decision && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white font-candara-bold">
                            {reviewModal.decision === 'approve'
                                ? 'Aprovar solicitação'
                                : reviewModal.decision === 'reject'
                                    ? 'Rejeitar solicitação'
                                    : 'Cancelar solicitação'}
                        </h3>

                        <p className="mt-2 text-sm text-[#19A999] font-candara">
                            {PROFILE_REQUEST_TYPE_LABELS[reviewModal.request.request_type] ??
                                reviewModal.request.request_type}
                        </p>

                        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Motivo do usuário</p>
                            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                                {reviewModal.request.reason}
                            </p>
                        </div>

                        <label className="mt-4 block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Observação do responsável {reviewModal.decision !== 'approve' && <span className="text-red-500">*</span>}
                        </label>

                        <textarea
                            value={reviewModal.adminNotes}
                            onChange={(event) =>
                                setReviewModal((current) => ({
                                    ...current,
                                    adminNotes: event.target.value,
                                }))
                            }
                            rows={4}
                            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#19A999] outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white transition"
                            placeholder={
                                reviewModal.decision === 'approve'
                                    ? 'Observação opcional para aprovação.'
                                    : 'Informe o motivo da rejeição/cancelamento (mínimo de 5 caracteres).'
                            }
                        />

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={reviewModal.saving}
                                onClick={() =>
                                    setReviewModal({
                                        isOpen: false,
                                        request: null,
                                        decision: null,
                                        adminNotes: '',
                                        saving: false,
                                    })
                                }
                                className="rounded-lg px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                            >
                                Fechar
                            </button>

                            <button
                                type="button"
                                disabled={
                                    reviewModal.saving ||
                                    (
                                        reviewModal.decision !== 'approve' &&
                                        reviewModal.adminNotes.trim().length < 5
                                    )
                                }
                                onClick={async () => {
                                    if (!reviewModal.request || !reviewModal.decision) return;

                                    setReviewModal((current) => ({
                                        ...current,
                                        saving: true,
                                    }));

                                    try {
                                        await reviewStoreProfileChangeRequest({
                                            requestId: reviewModal.request.request_id,
                                            decision: reviewModal.decision,
                                            adminNotes: reviewModal.adminNotes.trim() || null,
                                        });

                                        toast.success('Solicitação cadastral processada com sucesso.');

                                        setReviewModal({
                                            isOpen: false,
                                            request: null,
                                            decision: null,
                                            adminNotes: '',
                                            saving: false,
                                        });

                                        await loadProfileRequests();
                                        await fetchUsers();
                                    } catch (error: any) {
                                        console.error(error);
                                        toast.error(
                                            error?.message ||
                                            error?.details ||
                                            'Não foi possível analisar a solicitação.'
                                        );
                                        setReviewModal((current) => ({
                                            ...current,
                                            saving: false,
                                        }));
                                    }
                                }}
                                className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${reviewModal.decision === 'approve'
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : reviewModal.decision === 'reject'
                                            ? 'bg-red-600 hover:bg-red-700'
                                            : 'bg-gray-600 hover:bg-gray-700'
                                    }`}
                            >
                                {reviewModal.saving ? 'Salvando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
