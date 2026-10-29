import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { StoreCustomRole, StoreMemberForPermissionsRow } from '@/types/security';

const ROLE_CHOICES = [
    { code: 'admin', label: 'Administrador' },
    { code: 'manager', label: 'Gerente' },
    { code: 'stock_operator', label: 'Operador de estoque' },
    { code: 'cashier', label: 'Caixa' },
    { code: 'sales', label: 'Vendas' },
    { code: 'staff', label: 'Equipe' },
    { code: 'viewer', label: 'Visualizador' },
] as const;

export function MemberAccessAssignment({
    member,
    roles,
    canManage,
    onChanged,
}: {
    member: StoreMemberForPermissionsRow | null;
    roles: StoreCustomRole[];
    canManage: boolean;
    onChanged: () => Promise<void>;
}) {
    const [role, setRole] = useState('staff');
    const [customRoleId, setCustomRoleId] = useState('');
    const [busy, setBusy] = useState(false);
    const [clearOverrides, setClearOverrides] = useState(false);

    useEffect(() => {
        setRole(member?.role || 'staff');
        setCustomRoleId(member?.custom_role_id || '');
        setClearOverrides(false);
    }, [member?.member_id, member?.role, member?.custom_role_id]);

    if (!member) return null;

    const availableRoles = roles.filter((item) => item.active && item.base_role === member.role);
    const validRole = ROLE_CHOICES.some((item) => item.code === role);
    const roleChanged = role !== member.role;
    const customRoleChanged = customRoleId !== (member.custom_role_id || '');

    const applyChange = async (kind: 'base' | 'custom') => {
        if (!canManage || busy) return;
        const label = member.user_name || 'este colaborador';
        const confirmed = window.confirm(kind === 'base'
            ? `Confirmar alteração do papel de ${label} para ${role}? As permissões individuais serão ${clearOverrides ? 'limpas' : 'preservadas'}.`
            : `Confirmar alteração da função personalizada de ${label}? As permissões individuais serão ${clearOverrides ? 'limpas' : 'preservadas'}.`);
        if (!confirmed) return;

        setBusy(true);
        try {
            if (kind === 'base') {
                const { error } = await supabase.rpc('change_store_member_role', {
                    p_member_id: member.member_id,
                    p_new_role: role,
                    p_reason: 'Alteração de papel pela Central de Segurança',
                    p_clear_individual_overrides: clearOverrides,
                    p_create_occurrence: true,
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('assign_store_custom_role_to_member', {
                    p_member_id: member.member_id,
                    p_custom_role_id: customRoleId || null,
                    p_reason: 'Atribuição de função personalizada pela Central de Segurança',
                    p_clear_individual_overrides: clearOverrides,
                    p_create_occurrence: true,
                });
                if (error) throw error;
            }
            toast.success('Função do colaborador atualizada com sucesso.');
            await onChanged();
            setClearOverrides(false);
        } catch (error) {
            console.error('[MemberAccessAssignment] Mudança de função rejeitada:', error);
            toast.error('Não foi possível alterar o papel/função. Verifique as permissões na Central de Segurança.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="mt-4 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700" aria-label="Atribuição de função e papel">
            <h5 className="text-xs font-black uppercase text-gray-600 dark:text-gray-300">Atribuição de acesso</h5>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Somente a Central de Segurança pode alterar papéis e funções. Exceções individuais são preservadas por padrão.
            </p>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-200">
                Papel nativo
                <select value={role} onChange={(e) => { setRole(e.target.value); setCustomRoleId(member.custom_role_id || ''); }}
                    disabled={!canManage || busy} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 disabled:opacity-60">
                    {ROLE_CHOICES.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
                </select>
            </label>
            {canManage && <button type="button" disabled={busy || !validRole || !roleChanged}
                onClick={() => void applyChange('base')}
                className="w-full rounded-lg border border-teal-400 px-3 py-2 text-xs font-bold text-teal-700 disabled:opacity-50 dark:text-teal-300">
                Aplicar mudança de papel
            </button>}
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-200">
                Função personalizada
                <select value={customRoleId} onChange={(e) => setCustomRoleId(e.target.value)}
                    disabled={!canManage || busy || roleChanged} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 disabled:opacity-60">
                    <option value="">Sem função personalizada</option>
                    {availableRoles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
            </label>
            {canManage && <button type="button" disabled={busy || roleChanged || !customRoleChanged}
                onClick={() => void applyChange('custom')}
                className="w-full rounded-lg border border-teal-400 px-3 py-2 text-xs font-bold text-teal-700 disabled:opacity-50 dark:text-teal-300">
                Aplicar função personalizada
            </button>}
            {canManage && <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={clearOverrides} onChange={(e) => setClearOverrides(e.target.checked)} disabled={busy} />
                Limpar exceções individuais ao confirmar (por padrão, elas são mantidas).
            </label>}
        </section>
    );
}
