import { useEffect, useState } from 'react';
import { useUsersStore } from '@/store/useUsersStore';
import type { UserAdmin, UserFormData, UserRole, UserFilters } from '@/types';
import { UserCard, UserFormModal, UserDetailModal } from '@/components/users';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import { toast } from 'sonner';
import { Users as UsersIcon, UserCheck, UserX, Shield, Search, Plus, Filter } from 'lucide-react';

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

    const currentMemberId = securityContext?.primary_membership?.member_id ?? null;

    const [searchTerm, setSearchTerm] = useState('');
    const [showFormModal, setShowFormModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserAdmin | null>(null);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [showFilters, setShowFilters] = useState(false);

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
        setSelectedUser(user);
        setShowDetailModal(true);
    };

    const handleEditUser = (user: UserAdmin) => {
        if (user.role === 'owner') {
            toast.info('A alteração do proprietário será tratada em uma rotina específica de titularidade.');
            return;
        }

        setSelectedUser(user);
        setFormMode('edit');
        setShowFormModal(true);
    };

    const handleCreateUser = () => {
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
        }
    };

    const handleFormSubmit = async (data: UserFormData) => {
        if (formMode === 'create') {
            await createUser(data);
            return;
        }

        if (selectedUser) {
            await updateUser(selectedUser.id, data);
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
                            className="px-4 py-2 rounded-lg bg-[#21A896] text-white font-medium hover:bg-[#1A867A] transition-colors flex items-center gap-2"
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
                            className="px-4 py-2 rounded-lg bg-[#21A896] text-white font-medium hover:bg-[#1A867A] transition-colors"
                        >
                            Criar Primeiro Usuário
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {users.map((user) => (
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
            />
        </PageContainer>
    );
}
