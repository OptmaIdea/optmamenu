import { create } from 'zustand';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { UserAdmin, UserFilters, UserFormData, UserRole, UserStats } from '@/types';
import type { StoreMemberAdmin, StoreMemberRole, StoreMemberStatus } from '@/types/security';
import {
    getCurrentUserSecurityContext,
    getStoreMembers,
    updateStoreMemberStatus,
    updateStoreMemberProfileDetails,
    type UpdateStoreMemberProfileDetailsInput,
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
    updateUserStatus: (
        id: string,
        status: 'active' | 'inactive' | 'suspended',
        reason?: string
    ) => Promise<boolean>;
    updateUserRole: (id: string, role: UserRole) => Promise<boolean>;
    updateUserProfileDetails: (
        input: UpdateStoreMemberProfileDetailsInput
    ) => Promise<boolean>;
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
        user_id: member.user_id,
        email: member.user_email,
        email_for_store: member.member_email ?? member.user_email ?? null,
        phone: member.member_phone ?? member.profile_phone ?? null,
        mobile_phone: member.member_mobile_phone ?? member.profile_mobile_phone ?? null,
        whatsapp_phone: member.member_whatsapp_phone ?? member.profile_whatsapp_phone ?? null,
        full_name: member.profile_name || member.user_email || 'Usuário sem nome',
        cpf: member.profile_cpf ?? null,
        birthdate: member.profile_birthdate ?? null,

        zip_code: member.member_zip_code ?? member.profile_zip_code ?? null,
        address: member.member_address ?? member.profile_address ?? null,
        address_number: member.member_address_number ?? member.profile_address_number ?? null,
        complement: member.member_complement ?? member.profile_complement ?? null,
        district: member.member_district ?? member.profile_district ?? null,
        city: member.member_city ?? member.profile_city ?? null,
        state: member.member_state ?? member.profile_state ?? null,

        instagram_url: member.profile_instagram_url ?? null,
        facebook_url: member.profile_facebook_url ?? null,
        website_url: member.profile_website_url ?? null,

        internal_alias: member.internal_alias ?? null,
        department: member.department ?? null,

        avatar_url: member.member_avatar_url ?? member.profile_avatar_url ?? null,
        profile_avatar_url: member.profile_avatar_url ?? null,
        role,
        status: member.status === 'invited' ? 'invited' : member.status,

        custom_role_id: member.custom_role_id ?? null,
        custom_role_name: member.custom_role_name ?? null,
        custom_role_base_role: member.custom_role_base_role ?? null,
        accepted_at: member.accepted_at ?? null,

        is_admin: role === 'owner' || role === 'admin' || role === 'manager',
        is_active: isActive,
        email_verified: false,
        last_sign_in_at: member.last_seen_at,
        created_at: member.created_at,
        updated_at: member.updated_at,
        internal_notes: member.internal_notes ?? null,

        started_at: member.started_at ?? null,
        ended_at: member.ended_at ?? null,
        exit_reason: member.exit_reason ?? null,
        status_reason: member.status_reason ?? null,

        member_email: member.member_email ?? null,
        member_phone: member.member_phone ?? null,
        member_mobile_phone: member.member_mobile_phone ?? null,
        member_whatsapp_phone: member.member_whatsapp_phone ?? null,
        member_avatar_url: member.member_avatar_url ?? null,
        member_zip_code: member.member_zip_code ?? null,
        member_address: member.member_address ?? null,
        member_address_number: member.member_address_number ?? null,
        member_complement: member.member_complement ?? null,
        member_district: member.member_district ?? null,
        member_city: member.member_city ?? null,
        member_state: member.member_state ?? null,
        additional_info: member.member_additional_info ?? [],

        profile_name: member.profile_name ?? null,
        profile_phone: member.profile_phone ?? null,
        profile_mobile_phone: member.profile_mobile_phone ?? null,
        profile_whatsapp_phone: member.profile_whatsapp_phone ?? null,

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
                user.internal_alias,
                user.email,
                user.phone,
                user.mobile_phone,
                user.whatsapp_phone,
                user.cpf,
                user.department,
                user.city,
                user.district,
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

                const { error } = await supabase.rpc('change_store_member_role', {
                    p_member_id: id,
                    p_new_role: role,
                    p_reason: 'Alteração de função pela tela de usuários',
                    p_clear_individual_overrides: false,
                    p_create_occurrence: true,
                });

                if (error) throw error;
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

    updateUserStatus: async (id, status, reason) => {
        try {
            await updateStoreMemberStatus({
                memberId: id,
                status: status as StoreMemberStatus,
                reason: reason ?? 'Alteração de status pela tela de usuários',
            });

            const statusLabel =
                status === 'active'
                    ? 'reativado'
                    : status === 'suspended'
                        ? 'suspenso'
                        : 'inativado';

            toast.success(`Usuário ${statusLabel} com sucesso`);
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

            const { error } = await supabase.rpc('change_store_member_role', {
                p_member_id: id,
                p_new_role: storeRole,
                p_reason: 'Alteração de função pela tela de usuários',
                p_clear_individual_overrides: false,
                p_create_occurrence: true,
            });

            if (error) throw error;

            toast.success('Função atualizada com sucesso.');
            await get().fetchUsers();
            return true;
        } catch (error: unknown) {
            console.error('Erro ao atualizar permissão:', error);
            toast.error(getErrorMessage(error, 'Erro ao atualizar permissão'));
            return false;
        }
    },

    updateUserProfileDetails: async (input) => {
        try {
            await updateStoreMemberProfileDetails(input);

            toast.success('Dados do usuário atualizados com sucesso.');

            await get().fetchUsers();

            return true;
        } catch (error: unknown) {
            console.error('Erro ao atualizar dados complementares:', error);

            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Erro ao atualizar dados do usuário.'
            );

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
