import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { UserAdmin, UserFilters, UserFormData, UserStats } from '@/types';
import { toast } from 'sonner';

interface UsersState {
    users: UserAdmin[];
    loading: boolean;
    stats: UserStats | null;
    filters: UserFilters;
    total: number;

    // Actions
    fetchUsers: (filters?: UserFilters) => Promise<void>;
    fetchUserById: (id: string) => Promise<UserAdmin | null>;
    createUser: (data: UserFormData) => Promise<UserAdmin | null>;
    updateUser: (id: string, data: Partial<UserFormData>) => Promise<boolean>;
    deleteUser: (id: string) => Promise<boolean>;
    updateUserStatus: (id: string, status: 'active' | 'inactive' | 'suspended') => Promise<boolean>;
    updateUserRole: (id: string, role: 'super_admin' | 'admin' | 'manager' | 'staff' | 'viewer') => Promise<boolean>;
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

export const useUsersStore = create<UsersState>((set, get) => ({
    users: [],
    loading: false,
    stats: null,
    filters: DEFAULT_FILTERS,
    total: 0,

    fetchUsers: async (filters) => {
        const currentFilters = filters || get().filters;
        set({ loading: true });

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            // Buscar profiles com dados de usuários
            let query = supabase
                .from('profiles')
                .select('*', { count: 'exact' });

            // Filtro de busca
            if (currentFilters.search) {
                query = query.or(`full_name.ilike.%${currentFilters.search}%,phone.ilike.%${currentFilters.search}%,cpf.ilike.%${currentFilters.search}%`);
            }

            // Filtro por status
            if (currentFilters.status) {
                query = query.eq('is_active', currentFilters.status === 'active');
            }

            // Filtro por admin
            if (currentFilters.role === 'admin') {
                query = query.eq('is_admin', true);
            } else if (currentFilters.role === 'staff' || currentFilters.role === 'viewer') {
                query = query.eq('is_admin', false);
            }

            // Ordenação
            const orderColumn = currentFilters.sort_by || 'created_at';
            const orderAscending = currentFilters.sort_order === 'asc';
            query = query.order(orderColumn, { ascending: orderAscending });

            // Paginação
            const from = ((currentFilters.page || 1) - 1) * (currentFilters.limit || 20);
            const to = from + (currentFilters.limit || 20) - 1;
            query = query.range(from, to);

            const { data: profiles, error, count } = await query;

            if (error) throw error;

            // Transformar profiles em UserAdmin
            const users: UserAdmin[] = (profiles || []).map((profile) => ({
                id: profile.id,
                email: null, // Email vem de auth.users, não de profiles
                phone: profile.phone,
                full_name: profile.name,
                cpf: profile.cpf,
                avatar_url: null,
                role: profile.is_admin ? 'admin' : 'staff',
                status: profile.is_active ? 'active' : 'inactive',
                is_admin: profile.is_admin || false,
                is_active: profile.is_active ?? true,
                email_verified: false,
                last_sign_in_at: null,
                created_at: profile.created_at,
                updated_at: profile.updated_at,
                internal_notes: profile.internal_notes,
            }));

            set({ users, total: count || 0, loading: false });
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
            toast.error('Erro ao carregar usuários');
            set({ loading: false });
        }
    },

    fetchUserById: async (id) => {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;
            if (!profile) return null;

            // Buscar stores relacionadas
            const { data: stores } = await supabase
                .from('stores')
                .select('id, slug, name, config')
                .eq('user_id', id);

            const user: UserAdmin = {
                id: profile.id,
                email: null,
                phone: profile.phone,
                full_name: profile.name,
                cpf: profile.cpf,
                avatar_url: null,
                role: profile.is_admin ? 'admin' : 'staff',
                status: profile.is_active ? 'active' : 'inactive',
                is_admin: profile.is_admin || false,
                is_active: profile.is_active ?? true,
                email_verified: false,
                last_sign_in_at: null,
                created_at: profile.created_at,
                updated_at: profile.updated_at,
                internal_notes: profile.internal_notes,
                stores: stores?.map(s => ({
                    id: s.id,
                    store_id: s.id,
                    user_id: id,
                    store_name: s.name,
                    store_slug: s.slug,
                    role: profile.is_admin ? 'admin' : 'staff',
                    created_at: profile.created_at,
                    config: s.config,
                })),
            };

            return user;
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            return null;
        }
    },

    createUser: async (data) => {
        try {
            // 1. Criar usuário no auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: data.email,
                password: data.password || 'mudar123',
                email_confirm: true,
                user_metadata: {
                    full_name: data.full_name,
                    phone: data.phone,
                    cpf: data.cpf,
                },
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('Usuário não criado');

            // 2. Criar profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    phone: data.phone,
                    name: data.full_name,
                    cpf: data.cpf,
                    is_admin: data.is_admin,
                    is_active: true,
                    internal_notes: data.internal_notes,
                });

            if (profileError) throw profileError;

            // 3. Associar à loja se fornecido
            if (data.store_id) {
                const { error: storeError } = await supabase
                    .from('stores')
                    .update({ user_id: authData.user.id })
                    .eq('id', data.store_id);

                if (storeError) throw storeError;
            }

            toast.success('Usuário criado com sucesso');

            // Recarregar lista
            get().fetchUsers();

            return {
                id: authData.user.id,
                email: data.email,
                phone: data.phone ?? null,
                full_name: data.full_name,
                cpf: data.cpf ?? null,
                avatar_url: null,
                role: data.role,
                status: 'active' as const,
                is_admin: data.is_admin,
                is_active: true,
                email_verified: false,
                last_sign_in_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                internal_notes: data.internal_notes ?? null,
            };
        } catch (error: any) {
            console.error('Erro ao criar usuário:', error);
            toast.error(error.message || 'Erro ao criar usuário');
            return null;
        }
    },

    updateUser: async (id, data) => {
        try {
            const updateData: any = {};
            
            if (data.full_name !== undefined) updateData.name = data.full_name;
            if (data.phone !== undefined) updateData.phone = data.phone;
            if (data.cpf !== undefined) updateData.cpf = data.cpf;
            if (data.is_admin !== undefined) updateData.is_admin = data.is_admin;
            if (data.internal_notes !== undefined) updateData.internal_notes = data.internal_notes;

            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            // Atualizar email se fornecido
            if (data.email) {
                const { error: emailError } = await supabase.auth.admin.updateUserById(id, {
                    email: data.email,
                });

                if (emailError) {
                    console.warn('Erro ao atualizar email:', emailError);
                }
            }

            toast.success('Usuário atualizado com sucesso');
            get().fetchUsers();
            return true;
        } catch (error: any) {
            console.error('Erro ao atualizar usuário:', error);
            toast.error(error.message || 'Erro ao atualizar usuário');
            return false;
        }
    },

    deleteUser: async (id) => {
        try {
            // Soft delete - apenas desativar
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;

            toast.success('Usuário desativado com sucesso');
            get().fetchUsers();
            return true;
        } catch (error: any) {
            console.error('Erro ao desativar usuário:', error);
            toast.error(error.message || 'Erro ao desativar usuário');
            return false;
        }
    },

    updateUserStatus: async (id, status) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: status === 'active' })
                .eq('id', id);

            if (error) throw error;

            toast.success(`Usuário ${status === 'active' ? 'ativado' : 'desativado'} com sucesso`);
            get().fetchUsers();
            return true;
        } catch (error: any) {
            console.error('Erro ao atualizar status:', error);
            toast.error(error.message || 'Erro ao atualizar status');
            return false;
        }
    },

    updateUserRole: async (id, role) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_admin: role === 'admin' || role === 'super_admin' })
                .eq('id', id);

            if (error) throw error;

            toast.success('Permissão atualizada com sucesso');
            get().fetchUsers();
            return true;
        } catch (error: any) {
            console.error('Erro ao atualizar permissão:', error);
            toast.error(error.message || 'Erro ao atualizar permissão');
            return false;
        }
    },

    fetchStats: async () => {
        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('is_admin, is_active');

            if (error) throw error;

            const stats: UserStats = {
                total: profiles?.length || 0,
                active: profiles?.filter(p => p.is_active).length || 0,
                inactive: profiles?.filter(p => !p.is_active).length || 0,
                admins: profiles?.filter(p => p.is_admin).length || 0,
                pending: 0, // Implementar se necessário
            };

            set({ stats });
        } catch (error) {
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
