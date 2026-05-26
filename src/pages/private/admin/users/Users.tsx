import { useEffect, useMemo, useState } from 'react';
import { useUsersStore } from '@/store/useUsersStore';
import type { UserAdmin, UserFormData, UserRole, UserFilters } from '@/types';
import { UserCard, UserFormModal, UserDetailModal } from '@/components/users';
import { UserInvitesPanel } from '@/components/users/UserInvitesPanel';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useStoreMemberInvites } from '@/hooks/useStoreMemberInvites';
import { hasEffectivePermission } from '@/utils/permissions';
import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import { toast } from 'sonner';
import { Users as UsersIcon, UserCheck, UserX, Shield, Search, Plus, Filter } from 'lucide-react';
import { useStoreMemberSessionSummary } from '@/hooks/security/useStoreMemberSessionSummary';
import { getActiveStoreId } from '@/utils/activeStore';
import { supabase } from '@/lib/supabase';

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
        updateUserStatus,
        deleteUser,
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

    const currentMemberId = activeMembership?.member_id ?? null;
    const operationalStoreId = activeMembership?.store_id ?? activeStoreId ?? null;

    const { permissions } = usePermissions(operationalStoreId);
    const {
        invites,
        loading: loadingInvites,
        saving: savingInvites,
        refresh: refreshInvites,
        cancelInvite,
    } = useStoreMemberInvites(operationalStoreId);
    const canManageUsers = hasEffectivePermission(permissions, 'users.manage');

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

    useEffect(() => {
        fetchUsers();
        fetchStats();
    }, [fetchUsers, fetchStats]);

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

    const handleEditUser = (user: UserAdmin) => {
        if (user.role === 'owner') {
            toast.info('A alteração do proprietário será tratada em uma rotina específica de titularidade.');
            return;
        }

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
        setFormMode('edit');
        setShowFormModal(true);
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

    const handleToggleStatus = async (user: UserAdmin) => {
        const newStatus = user.status === 'active' ? 'inactive' : 'active';

        if (user.id === currentMemberId && newStatus !== 'active') {
            toast.error('Você não pode desativar ou suspender seu próprio usuário.');
            return;
        }

        if (user.role === 'owner' && newStatus !== 'active') {
            toast.error('O proprietário principal não pode ser desativado por esta tela.');
            return;
        }

        await updateUserStatus(user.id, newStatus);
        await refreshSessionSummary();
    };

    const handleDeleteUser = async (user: UserAdmin) => {
        if (user.id === currentMemberId) {
            toast.error('Você não pode desativar seu próprio usuário.');
            return;
        }

        if (user.role === 'owner') {
            toast.error('O proprietário principal não pode ser desativado por esta tela.');
            return;
        }

        if (window.confirm(`Tem certeza que deseja desativar o usuário "${user.full_name}"?`)) {
            await deleteUser(user.id);
            await refreshSessionSummary();
        }
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Não foi possível alterar a função.';
            toast.error(message);
        }
    };


    const handleFilterChange = <K extends keyof UserFilters>(
        key: K,
        value: UserFilters[K]
    ) => {
        setFilters({ [key]: value });
    };

    return (
        <PageContainer
            title="Usuários"
            subtitle="Gerencie os usuários do sistema e suas permissões"
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
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 ${showFilters
                                ? 'border-[#21A896] bg-[#21A896]/10 text-[#21A896]'
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
                            className={`px-4 py-2 rounded-lg bg-[#21A896] text-white font-medium hover:bg-[#1A867A] transition-colors flex items-center gap-2 ${!canManageUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
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
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
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
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
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
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#21A896] mx-auto mb-4"></div>
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
                            className={`px-4 py-2 rounded-lg bg-[#21A896] text-white font-medium hover:bg-[#1A867A] transition-colors ${!canManageUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            Criar Primeiro Usuário
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {usersWithSession.map((user) => (
                        <UserCard
                            key={user.id}
                            user={user}
                            onView={handleViewUser}
                            onEdit={handleEditUser}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDeleteUser}
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
                                <p className="font-bold text-[#21A896]">
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
                                className="rounded-xl bg-[#21A896] px-4 py-2 text-sm font-bold text-white hover:bg-[#1A867A]"
                            >
                                Confirmar alteração
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
