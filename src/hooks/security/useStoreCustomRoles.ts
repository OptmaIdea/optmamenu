import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import type { StoreCustomRole, StoreCustomRoleFormData } from '@/types/security';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function useStoreCustomRoles(includeInactive = true) {
    const [items, setItems] = useState<StoreCustomRole[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchCustomRoles = useCallback(async () => {
        const storeId = getActiveStoreId();

        if (!storeId) {
            setItems([]);
            return;
        }

        setLoading(true);

        const { data, error } = await supabase.rpc('list_store_custom_roles', {
            p_store_id: storeId,
            p_include_inactive: includeInactive,
        });

        setLoading(false);

        if (error) {
            toast.error(getErrorMessage(error, 'Erro ao carregar funções personalizadas.'));
            setItems([]);
            return;
        }

        setItems((data ?? []) as StoreCustomRole[]);
    }, [includeInactive]);

    const createCustomRole = useCallback(
        async (form: StoreCustomRoleFormData) => {
            const storeId = getActiveStoreId();

            if (!storeId) {
                toast.error('Loja ativa não encontrada.');
                return null;
            }

            setSaving(true);

            const { data, error } = await supabase.rpc('create_store_custom_role', {
                p_store_id: storeId,
                p_name: form.name,
                p_description: form.description || null,
                p_base_role: form.base_role,
                p_permissions: form.permissions ?? {},
                p_sensitive_actions: form.sensitive_actions ?? {},
            });

            setSaving(false);

            if (error) {
                toast.error(getErrorMessage(error, 'Erro ao criar função personalizada.'));
                return null;
            }

            toast.success('Função personalizada criada.');
            await fetchCustomRoles();

            return Array.isArray(data) ? ((data[0] ?? null) as StoreCustomRole | null) : null;
        },
        [fetchCustomRoles]
    );

    const updateCustomRole = useCallback(
        async (form: StoreCustomRoleFormData, reason = 'Alteração pela tela de segurança.') => {
            if (!form.id) {
                toast.error('Função personalizada não informada.');
                return null;
            }

            setSaving(true);

            const { data, error } = await supabase.rpc('update_store_custom_role', {
                p_custom_role_id: form.id,
                p_name: form.name,
                p_description: form.description || null,
                p_base_role: form.base_role,
                p_active: form.active,
                p_permissions: form.permissions ?? {},
                p_sensitive_actions: form.sensitive_actions ?? {},
                p_reason: reason,
            });

            setSaving(false);

            if (error) {
                toast.error(getErrorMessage(error, 'Erro ao atualizar função personalizada.'));
                return null;
            }

            toast.success('Função personalizada atualizada.');
            await fetchCustomRoles();

            return Array.isArray(data) ? ((data[0] ?? null) as StoreCustomRole | null) : null;
        },
        [fetchCustomRoles]
    );

    const assignCustomRoleToMember = useCallback(
        async (params: {
            memberId: string;
            customRoleId: string | null;
            clearOverrides?: boolean;
            reason?: string;
        }) => {
            setSaving(true);

            const { error } = await supabase.rpc('assign_store_custom_role_to_member', {
                p_member_id: params.memberId,
                p_custom_role_id: params.customRoleId,
                p_reason: params.reason ?? 'Atribuição de função personalizada pela tela de segurança.',
                p_clear_individual_overrides: params.clearOverrides ?? false,
                p_create_occurrence: true,
            });

            setSaving(false);

            if (error) {
                toast.error(getErrorMessage(error, 'Erro ao atribuir função personalizada.'));
                return false;
            }

            toast.success(
                params.customRoleId
                    ? 'Função personalizada atribuída.'
                    : 'Função personalizada removida.'
            );

            await fetchCustomRoles();
            return true;
        },
        [fetchCustomRoles]
    );

    useEffect(() => {
        void fetchCustomRoles();
    }, [fetchCustomRoles]);

    return {
        items,
        loading,
        saving,
        refresh: fetchCustomRoles,
        createCustomRole,
        updateCustomRole,
        assignCustomRoleToMember,
    };
}