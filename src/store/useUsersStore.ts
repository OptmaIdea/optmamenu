import { create } from 'zustand';
import { toast } from 'sonner';
import type { UserAdmin, UserFilters, UserFormData, UserRole, UserStats } from '@/types';
import type { StoreMemberAdmin, StoreMemberRole, StoreMemberStatus } from '@/types/security';
import {
    getCurrentUserSecurityContext,
    getStoreMembers,
    updateStoreMemberRole,
    updateStoreMemberStatus,
} from '@/services/securityService';
import { createStoreMemberInvite } from '@/services/storeMemberInviteService';
import { getActiveStoreId } from '@/utils/activeStore';

interface UsersState {
    users: UserAdmin[];
    loading: boolean;
    stats: UserStats | null;
    filters: UserFilters;
    total: number;

    fetchUsers: (filters?: UserFilters) => Promise<void>;
    fetchUserById: (id: string) => Promise<UserAdmin | null>;
    createUser: (data: UserFormData) => Promise<UserAdmin | null>;
    updateUser: (id: string, data: Partial<UserFormData>) => Promise<boolean>;
    deleteUser: (id: string) => Promise<boolean>;
    updateUserStatus: (id: string, status: 'active' | 'inactive' | 'suspended') => Promise<boolean>;
    updateUserRole: (id: string, role: UserRole) => Promise<boolean>;
    fetchStats: () => Promise<void>;
    setFilters: (filters: Partial<UserFilters>) => void;
    resetFilters: () => void;
}

const DEFAULT_FILTERS: UserFilters = {
    search: '',
    page: 1,
    limit: 20,
    sort_by: 'created_at',
    sort_order: 'desc',
};

const STORE_ROLE_TO_USER_ROLE: Record<StoreMemberRole, UserRole> = {
    owner: 'owner',
    admin: 'admin',
    manager: 'manager',
    stock_operator: 'stock_operator',
    cashier: 'cashier',
    sales: 'sales',
    viewer: 'viewer',
    staff: 'staff',
};

const USER_ROLE_TO_STORE_ROLE: Partial<Record<UserRole, StoreMemberRole>> = {
    owner: 'owner',
    admin: 'admin',
    manager: 'manager',
    stock_operator: 'stock_operator',
    cashier: 'cashier',
    sales: 'sales',
    viewer: 'viewer',
    staff: 'staff',
};

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function mapStoreMemberToUserAdmin(member: StoreMemberAdmin): UserAdmin {
    const role = STORE_ROLE_TO_USER_ROLE[member.role] ?? 'staff';
    const isActive = member.status === 'active';

    return {
        id: member.member_id,
        email: member.user_email,
        phone: member.profile_phone,
        full_name: member.profile_name || member.user_email || 'Usuário sem nome',
        cpf: null,
        avatar_url: null,
        role,
        status: member.status === 'invited' ? 'invited' : member.status,
        is_admin: role === 'owner' || role === 'admin' || role === 'manager',
        is_active: isActive,
        email_verified: false,
        last_sign_in_at: member.last_seen_at,
        created_at: member.created_at,
        updated_at: member.updated_at,
        internal_notes: null,
        stores: [
            {
                id: member.member_id,
                store_id: member.store_id,
                user_id: member.user_id,
                store_name: '',
                store_slug: '',
                role,
                created_at: member.created_at,
                config: {
                    permissions: member.permissions,
                    sensitive_actions: member.sensitive_actions,
                },
            },
        ],
    };
}

function applyFilters(users: UserAdmin[], filters: UserFilters): UserAdmin[] {
    let filteredUsers = [...users];

    if (filters.search?.trim()) {
        const search = filters.search.trim().toLowerCase();

        filteredUsers = filteredUsers.filter((user) =>
            [
                user.full_name,
                user.email,
                user.phone,
                user.cpf,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(search))
        );
    }

    if (filters.status) {
        filteredUsers = filteredUsers.filter((user) => user.status === filters.status);
    }

    if (filters.role) {
        filteredUsers = filteredUsers.filter((user) => user.role === filters.role);
    }

    const sortBy = filters.sort_by ?? 'created_at';
    const sortOrder = filters.sort_order ?? 'desc';

    filteredUsers.sort((a, b) => {
        const aValue = String(a[sortBy] ?? '').toLowerCase();
        const bValue = String(b[sortBy] ?? '').toLowerCase();

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit;

    return filteredUsers.slice(from, to);
}

function buildStats(users: UserAdmin[]): UserStats {
    return {
        total: users.length,
        active: users.filter((user) => user.status === 'active').length,
        inactive: users.filter((user) => user.status === 'inactive').length,
        admins: users.filter((user) =>
            user.role === 'owner' ||
            user.role === 'admin' ||
            user.role === 'manager' ||
            user.role === 'super_admin'
        ).length,
        pending: users.filter((user) => user.status === 'pending' || user.status === 'invited').length,
    };
}

async function getCurrentOperationalStoreId(): Promise<string> {
    const context = await getCurrentUserSecurityContext();

    if (!context.authenticated) {
        throw new Error('Usuário não autenticado.');
    }

    const activeStoreId = getActiveStoreId();

    if (activeStoreId) {
        const hasMembership = context.memberships.some(
            (membership) =>
                membership.store_id === activeStoreId &&
                membership.status === 'active'
        );

        if (hasMembership) {
            return activeStoreId;
        }
    }

    const fallbackStoreId = context.primary_membership?.store_id;

    if (!fallbackStoreId) {
        throw new Error('Nenhuma loja ativa encontrada para o usuário atual.');
    }

    return fallbackStoreId;
}

async function fetchAllUsersForCurrentStore(): Promise<UserAdmin[]> {
    const storeId = await getCurrentOperationalStoreId();
    const members = await getStoreMembers(storeId);

    return members.map(mapStoreMemberToUserAdmin);
}

export const useUsersStore = create<UsersState>((set, get) => ({
    users: [],
    loading: false,
    stats: null,
    filters: DEFAULT_FILTERS,
    total: 0,

    fetchUsers: async (filters) => {
        const currentFilters = {
            ...get().filters,
            ...(filters ?? {}),
        };

        set({ loading: true });

        try {
            const allUsers = await fetchAllUsersForCurrentStore();
            const filteredUsers = applyFilters(allUsers, currentFilters);

            set({
                users: filteredUsers,
                total: allUsers.length,
                stats: buildStats(allUsers),
                filters: currentFilters,
                loading: false,
            });
        } catch (error: unknown) {
            console.error('Erro ao buscar usuários da loja:', error);
            toast.error(getErrorMessage(error, 'Erro ao carregar usuários'));
            set({
                users: [],
                total: 0,
                loading: false,
            });
        }
    },

    fetchUserById: async (id) => {
        try {
            const allUsers = await fetchAllUsersForCurrentStore();
            return allUsers.find((user) => user.id === id) ?? null;
        } catch (error: unknown) {
            console.error('Erro ao buscar usuário:', error);
            return null;
        }
    },

    createUser: async (data) => {
        try {
            const storeId = await getCurrentOperationalStoreId();

            const role = USER_ROLE_TO_STORE_ROLE[data.role];

            if (!role || role === 'owner') {
                throw new Error('Papel inválido para novo membro.');
            }

            await createStoreMemberInvite({
                storeId,
                email: data.email,
                role: role as Exclude<StoreMemberRole, 'owner'>,
                expiresInDays: 3,
            });

            toast.success('Convite criado. Aguardando aceite do usuário.');

            await get().fetchUsers();

            return null;
        } catch (error: unknown) {
            console.error('Erro ao vincular/convidar usuário:', error);

            const message =
                error instanceof Error
                    ? error.message
                    : 'Erro ao vincular ou convidar usuário';

            toast.error(message);
            return null;
        }
    },

    updateUser: async (id, data) => {
        try {
            if (data.role) {
                const role = USER_ROLE_TO_STORE_ROLE[data.role];

                if (!role || role === 'owner') {
                    throw new Error('Papel inválido para atualização.');
                }

                await updateStoreMemberRole({
                    memberId: id,
                    role: role as Exclude<StoreMemberRole, 'owner'>,
                    reason: 'Atualização pela tela de usuários',
                });
            }

            toast.success('Usuário atualizado com sucesso');
            await get().fetchUsers();
            return true;
        } catch (error: unknown) {
            console.error('Erro ao atualizar usuário:', error);
            toast.error(getErrorMessage(error, 'Erro ao atualizar usuário'));
            return false;
        }
    },

    deleteUser: async (id) => {
        try {
            await updateStoreMemberStatus({
                memberId: id,
                status: 'inactive',
                reason: 'Desativação pela tela de usuários',
            });

            toast.success('Usuário desativado com sucesso');
            await get().fetchUsers();
            return true;
        } catch (error: unknown) {
            console.error('Erro ao desativar usuário:', error);
            toast.error(getErrorMessage(error, 'Erro ao desativar usuário'));
            return false;
        }
    },

    updateUserStatus: async (id, status) => {
        try {
            await updateStoreMemberStatus({
                memberId: id,
                status: status as StoreMemberStatus,
                reason: 'Alteração de status pela tela de usuários',
            });

            toast.success(`Usuário ${status === 'active' ? 'ativado' : 'desativado'} com sucesso`);
            await get().fetchUsers();
            return true;
        } catch (error: unknown) {
            console.error('Erro ao atualizar status:', error);
            toast.error(getErrorMessage(error, 'Erro ao atualizar status'));
            return false;
        }
    },

    updateUserRole: async (id, role) => {
        try {
            const storeRole = USER_ROLE_TO_STORE_ROLE[role];

            if (!storeRole || storeRole === 'owner') {
                throw new Error('Papel inválido para atualização.');
            }

            await updateStoreMemberRole({
                memberId: id,
                role: storeRole as Exclude<StoreMemberRole, 'owner'>,
                reason: 'Alteração de papel pela tela de usuários',
            });

            toast.success('Permissão atualizada com sucesso');
            await get().fetchUsers();
            return true;
        } catch (error: unknown) {
            console.error('Erro ao atualizar permissão:', error);
            toast.error(getErrorMessage(error, 'Erro ao atualizar permissão'));
            return false;
        }
    },

    fetchStats: async () => {
        try {
            const allUsers = await fetchAllUsersForCurrentStore();
            set({ stats: buildStats(allUsers) });
        } catch (error: unknown) {
            console.error('Erro ao buscar estatísticas:', error);
        }
    },

    setFilters: (filters) => {
        set((state) => ({
            filters: { ...state.filters, ...filters },
        }));
    },

    resetFilters: () => {
        set({ filters: DEFAULT_FILTERS });
    },
}));
