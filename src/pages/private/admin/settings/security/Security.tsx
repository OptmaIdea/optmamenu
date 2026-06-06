import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import PageContainer from '@/components/common/PageContainer';

import { timezoneUtils } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import {
    Lock, History, Key, AlertCircle, CheckCircle, Save, Loader,
    RefreshCw, Smartphone, Eye, EyeOff, Settings, Filter,
    ShieldCheck, User, Store, BadgeCheck, Shield, X, Plus, Check, Search
} from 'lucide-react';
import type { SecurityLog } from '@/types';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { hasEffectivePermission } from '@/utils/permissions';
import { resolveActiveMembership, getActiveStoreId } from '@/utils/activeStore';
import { useSecurityPermissionsAdmin } from '@/hooks/security/useSecurityPermissionsAdmin';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { useStoreCustomRoles } from '@/hooks/security/useStoreCustomRoles';

type StoreConfig = {
    pin_failed_attempts?: number;
    pin_blocked?: boolean;
    pin_blocked_at?: string | null;
    [key: string]: unknown;
};

type SecurityStore = {
    id: string;
    doc_type: string;
    document: string;
    stock_password_hash?: string;
    token_expiry_seconds?: number;
    max_token_attempts?: number;
    config?: StoreConfig;
};

type SecurityLogDetails = Record<string, unknown>;

function getErrorMessage(error: unknown, fallback = 'Erro inesperado'): string {
    return error instanceof Error ? error.message : fallback;
}

function formatSecurityRole(role: string | null): string {
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

    return role ? labels[role] ?? role : 'Não definido';
}

function formatSecurityStatus(status: string | null): string {
    const labels: Record<string, string> = {
        active: 'Ativo',
        inactive: 'Inativo',
        suspended: 'Suspenso',
        invited: 'Convidado',
    };

    return status ? labels[status] ?? status : 'Não definido';
}

function formatPermissionSource(source?: string | null): string {
    const labels: Record<string, string> = {
        role_template: 'Papel base',
        custom_role: 'Função personalizada',
        individual_override: 'Exceção individual',
        default_denied: 'Bloqueio padrão',
    };

    return source ? labels[source] ?? source : 'Não informado';
}

function formatPermissionModule(module: string): string {
    const labels: Record<string, string> = {
        dashboard: 'Painel',
        reports: 'Relatórios',
        products: 'Produtos',
        stock: 'Estoque',
        purchases: 'Compras',
        suppliers: 'Fornecedores',
        orders: 'Pedidos',
        cashbook: 'Livro diário',
        customers: 'Clientes',
        marketing: 'Marketing',
        loyalty: 'Fidelidade',
        users: 'Usuários',
        security: 'Segurança',
        settings: 'Configurações',
    };

    return labels[module] ?? module;
}

function formatPermissionAction(action: string): string {
    const labels: Record<string, string> = {
        view: 'Ver',
        create: 'Criar',
        update: 'Editar',
        delete: 'Excluir',
        transfer: 'Transferir',
        adjust: 'Ajustar',
        confirm: 'Confirmar',
        cancel: 'Cancelar',
        manage: 'Gerenciar',
        sensitive_view: 'Ver dados sensíveis',
        sensitive_manage: 'Gerenciar dados sensíveis',

        additional_info_view: 'Ver informações adicionais',
        additional_info_manage: 'Gerenciar informações adicionais',
        additional_info_sensitive_view: 'Ver informações adicionais sensíveis',
        additional_info_sensitive_manage: 'Gerenciar informações adicionais sensíveis',
    };

    return labels[action] ?? action;
}

function formatSensitiveRequirement(requirement?: string): string {
    const labels: Record<string, string> = {
        none: 'Nenhuma exigência',
        pin: 'PIN',
        master_password: 'Senha master',
        pin_or_master: 'PIN ou senha master',
        owner_approval: 'Aprovação do proprietário',
        token: 'Token interno',
        pin_and_token: 'PIN + token interno',
    };

    return requirement ? labels[requirement] ?? requirement : 'Não definido';
}

function formatSensitiveReason(reason?: string): string {
    const labels: Record<string, string> = {
        allowed: 'Permitido',
        not_authenticated: 'Usuário não autenticado',
        not_store_member: 'Usuário não vinculado à loja',
        action_rule_not_found: 'Regra não encontrada',
        action_disabled: 'Ação desabilitada',
        insufficient_role: 'Papel insuficiente',
        missing_store_id: 'Loja não definida',
        empty_response: 'Resposta vazia',
    };

    return reason ? labels[reason] ?? reason : 'Não definido';
}

function formatSecurityLogAction(action?: string): string {
    const labels: Record<string, string> = {
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
    };

    if (!action) return 'Ação não identificada';

    return labels[action] ?? action
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStringDetail(
    details: Record<string, unknown> | null | undefined,
    key: string
): string | null {
    const value = details?.[key];
    return typeof value === 'string' && value.trim() ? value : null;
}

function getRecordDetail(
    details: Record<string, unknown> | null | undefined,
    key: string
): Record<string, unknown> {
    const value = details?.[key];
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function formatBooleanPermission(value: unknown): string {
    if (value === true) return 'permitido';
    if (value === false) return 'bloqueado';
    return 'herdado';
}

function formatPermissionLabelFromCode(code: string): string {
    const labels: Record<string, string> = {
        'users.sensitive.view': 'Usuários · Ver dados sensíveis',
        'users.sensitive.manage': 'Usuários · Gerenciar dados sensíveis',
        'users.additional_info.view': 'Usuários · Ver informações adicionais',
        'users.additional_info.manage': 'Usuários · Gerenciar informações adicionais',
        'users.additional_info_sensitive.view': 'Usuários · Ver informações adicionais sensíveis',
        'users.additional_info_sensitive.manage': 'Usuários · Gerenciar informações adicionais sensíveis',
    };

    if (labels[code]) return labels[code];

    const [module, action] = code.split('.');

    if (!module || !action) return code;

    return `${formatPermissionModule(module)} · ${formatPermissionAction(action)}`;
}

function getPermissionChangesSummary(details: Record<string, unknown>): string | null {
    const oldPermissions = getRecordDetail(details, 'old_permissions');
    const newPermissions = getRecordDetail(details, 'new_permissions');

    const codes = Array.from(
        new Set([
            ...Object.keys(oldPermissions),
            ...Object.keys(newPermissions),
        ])
    );

    const changed = codes.filter((code) => {
        return oldPermissions[code] !== newPermissions[code];
    });

    if (!changed.length) return null;

    return changed
        .slice(0, 3)
        .map((code) => {
            const label = formatPermissionLabelFromCode(code);
            const oldValue = formatBooleanPermission(oldPermissions[code]);
            const newValue = formatBooleanPermission(newPermissions[code]);

            return `${label}: ${oldValue} \u2192 ${newValue}`;
        })
        .join(' | ');
}

function formatSecurityLogDetails(log: SecurityLog): string | null {
    const details = log.details ?? {};

    if (log.action === 'store_member_permissions_updated') {
        const targetName =
            getStringDetail(details, 'target_user_name') ||
            getStringDetail(details, 'target_user_email') ||
            getStringDetail(details, 'target_user_id') ||
            'usuário selecionado';

        const targetRole = formatSecurityRole(getStringDetail(details, 'target_role'));

        const changes = getPermissionChangesSummary(details);

        if (changes) {
            return `${targetName} (${targetRole}) · ${changes}`;
        }

        return `${targetName} (${targetRole}) · permissões revisadas`;
    }

    if (log.action === 'store_member_role_changed') {
        const targetName =
            getStringDetail(details, 'target_user_name') ||
            getStringDetail(details, 'target_user_email') ||
            'usuário selecionado';

        const oldRole = formatSecurityRole(getStringDetail(details, 'old_role'));
        const newRole = formatSecurityRole(getStringDetail(details, 'new_role'));

        const cleared = details.clear_individual_overrides === true;

        return `${targetName} · ${oldRole} \u2192 ${newRole}${cleared
            ? ' · permissões individuais limpas'
            : ' · permissões individuais preservadas'
            }`;
    }

    if (log.action === 'store_role_permission_template_updated') {
        const role = formatSecurityRole(getStringDetail(details, 'role'));
        const permissionCode = getStringDetail(details, 'permission_code');
        const oldAllowed = details.old_allowed;
        const newAllowed = details.new_allowed;

        return `${role} · ${permissionCode ? formatPermissionLabelFromCode(permissionCode) : 'permissão'}: ${formatBooleanPermission(oldAllowed)} \u2192 ${formatBooleanPermission(newAllowed)}`;
    }

    if (log.action === 'store_sensitive_action_rule_updated') {
        const actionCode = getStringDetail(details, 'action_code') ?? 'ação sensível';
        const oldRule = getRecordDetail(details, 'old_rule');
        const newRule = getRecordDetail(details, 'new_rule');

        const oldRequirement = typeof oldRule.requirement === 'string'
            ? formatSensitiveRequirement(oldRule.requirement)
            : 'não definido';

        const newRequirement = typeof newRule.requirement === 'string'
            ? formatSensitiveRequirement(newRule.requirement)
            : 'não definido';

        return `${formatSecurityLogAction(actionCode)} · exigência: ${oldRequirement} \u2192 ${newRequirement}`;
    }

    if (log.action === 'session_store_selected') {
        const storeName = getStringDetail(details, 'store_name') || 'loja selecionada';
        const role = formatSecurityRole(getStringDetail(details, 'role'));
        return `${storeName} · acesso como ${role}`;
    }

    if (log.action === 'session_logout') {
        const startedAt = getStringDetail(details, 'session_started_at');
        const elapsed = getStringDetail(details, 'session_elapsed');

        if (elapsed) {
            return `Tempo de sessão: ${elapsed}`;
        }

        if (startedAt) {
            return `Sessão iniciada em ${new Date(startedAt).toLocaleString('pt-BR')}`;
        }

        return 'Usuário encerrou a sessão.';
    }

    const reason = getStringDetail(details, 'reason');
    return reason;
}

function renderRiskBadge(risk: string) {
    const cleanRisk = risk?.toLowerCase();
    if (cleanRisk === 'critical') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
                Crítico
            </span>
        );
    }
    if (cleanRisk === 'high') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-900/50">
                Alto
            </span>
        );
    }
    if (cleanRisk === 'medium') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-900/50">
                Médio
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-900/50">
            Baixo
        </span>
    );
}

const ROLE_PERMISSION_COLUMNS = [
    { role: 'owner', key: 'owner_allowed', label: 'Proprietário' },
    { role: 'admin', key: 'admin_allowed', label: 'Admin' },
    { role: 'manager', key: 'manager_allowed', label: 'Gerente' },
    { role: 'stock_operator', key: 'stock_operator_allowed', label: 'Estoque' },
    { role: 'cashier', key: 'cashier_allowed', label: 'Caixa' },
    { role: 'sales', key: 'sales_allowed', label: 'Vendas' },
    { role: 'staff', key: 'staff_allowed', label: 'Equipe' },
    { role: 'viewer', key: 'viewer_allowed', label: 'Visualizador' },
] as const;

const SENSITIVE_REQUIREMENT_OPTIONS = [
    { value: 'none', label: 'Nenhuma' },
    { value: 'pin', label: 'PIN' },
    { value: 'master_password', label: 'Senha master' },
    { value: 'pin_or_master', label: 'PIN ou senha master' },
    { value: 'owner_approval', label: 'Aprovação do proprietário' },
    { value: 'token', label: 'Token interno' },
    { value: 'pin_and_token', label: 'PIN + token' },
] as const;

const ROLE_OPTIONS = [
    { value: 'owner', label: 'Proprietário' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Gerente' },
    { value: 'stock_operator', label: 'Estoque' },
    { value: 'cashier', label: 'Caixa' },
    { value: 'sales', label: 'Vendas' },
    { value: 'staff', label: 'Equipe' },
    { value: 'viewer', label: 'Visualizador' },
] as const;

export default function Security() {
    const {
        permissionMatrix,
        sensitiveActions: sensitiveActionsMatrix,
        memberPermissionDetail,
        membersForPermissions,
        loading: adminLoading,
        error: adminError,
        refresh: refreshAdmin,
        updateRolePermission,
        updateSensitiveAction,
        fetchMemberPermissionDetail,
        updateMemberPermissions,
        fetchMembersForPermissions,
    } = useSecurityPermissionsAdmin();

    const [activeTab, setActiveTab] = useState('context');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const [selectedMemberId, setSelectedMemberId] = useState('');

    const {
        items: customRoles,
        loading: customRolesLoading,
        saving: customRolesSaving,
        refresh: refreshCustomRoles,
        createCustomRole,
        updateCustomRole,
    } = useStoreCustomRoles(true);

    const [customRoleForm, setCustomRoleForm] = useState<{
        id?: string;
        name: string;
        description: string;
        base_role: string;
        active: boolean;
        permissions: Record<string, boolean>;
        sensitive_actions: Record<string, unknown>;
    } | null>(null);

    const openNewCustomRoleForm = () => {
        setCustomRoleForm({
            name: '',
            description: '',
            base_role: 'stock_operator',
            active: true,
            permissions: {},
            sensitive_actions: {},
        });
    };

    const openEditCustomRoleForm = (role: {
        id: string;
        name: string;
        description: string | null;
        base_role: string;
        active: boolean;
        permissions: Record<string, boolean>;
        sensitive_actions: Record<string, unknown>;
    }) => {
        setCustomRoleForm({
            id: role.id,
            name: role.name,
            description: role.description ?? '',
            base_role: role.base_role,
            active: role.active,
            permissions: role.permissions ?? {},
            sensitive_actions: role.sensitive_actions ?? {},
        });
    };

    const handleToggleCustomRolePermission = (permissionCode: string, allowed: boolean | null) => {
        setCustomRoleForm((current) => {
            if (!current) return current;

            const nextPermissions = { ...current.permissions };

            if (allowed === null) {
                delete nextPermissions[permissionCode];
            } else {
                nextPermissions[permissionCode] = allowed;
            }

            return {
                ...current,
                permissions: nextPermissions,
            };
        });
    };

    const handleSaveCustomRole = async () => {
        if (!customRoleForm) return;

        if (!customRoleForm.name.trim()) {
            toast.error('Informe o nome da função personalizada.');
            return;
        }

        if (customRoleForm.id) {
            await updateCustomRole(customRoleForm, 'Alteração da função personalizada pela tela de segurança.');
        } else {
            await createCustomRole(customRoleForm);
        }

        setCustomRoleForm(null);
        await refreshAdmin();
        await refreshCustomRoles();
    };
    const [memberPermissionOverrides, setMemberPermissionOverrides] = useState<Record<string, boolean>>({});
    const {
        securityContext,
        loading: loadingSecurityContext,
        refresh: refreshSecurityContext,
        isOwner,
        isAdminLike,
        hasPin,
    } = useSecurityContext();

    const activeMembership = resolveActiveMembership(
        securityContext?.memberships,
        securityContext?.primary_membership
    );

    const currentStoreId = activeMembership?.store_id ?? getActiveStoreId();
    const currentStoreName = activeMembership?.store_name ?? 'Loja não selecionada';
    const currentStoreSlug = activeMembership?.store_slug ?? '';
    const currentRole = activeMembership?.role ?? null;

    const selectableMembers = useMemo(() => {
        return membersForPermissions.filter((member) => member.role !== 'owner');
    }, [membersForPermissions]);

    const {
        permissions,
        loading: loadingPermissions,
        permissionsByModule,
        allowedPermissions,
        getActionRequirement,
    } = usePermissions(currentStoreId);
    const canManageSecurity =
        isOwner || hasEffectivePermission(permissions, 'security.manage');

    const [logFilters, setLogFilters] = useState({
        dateFrom: '',
        dateTo: '',
        user: '',
        action: '',
        outcome: ''
    });

    const [permissionSearch, setPermissionSearch] = useState('');

    const filteredMatrix = useMemo(() => {
        if (!permissionSearch.trim()) {
            return permissionMatrix;
        }
        const query = permissionSearch.trim().toLowerCase();
        return permissionMatrix.filter((row) =>
            [row.label, row.description, row.permission_code, row.module, row.action]
                .filter(Boolean)
                .some((val) => String(val).toLowerCase().includes(query))
        );
    }, [permissionMatrix, permissionSearch]);

    const [productDeleteRequirement, setProductDeleteRequirement] = useState<string>('');

    // Store Data
    const [store, setStore] = useState<SecurityStore | null>(null);

    // Password Change State (login)
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [showPassword, setShowPassword] = useState({ new: false, confirm: false });

    // PIN State
    const [pinData, setPinData] = useState('');
    const [showPin, setShowPin] = useState(false);

    // Advanced Settings
    const [tokenExpiry, setTokenExpiry] = useState(15);
    const [maxAttempts, setMaxAttempts] = useState(3);

    // Logs State
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [tableMissing, setTableMissing] = useState(false);

    // Store master password
    const [masterPasswordData, setMasterPasswordData] = useState({
        loginPassword: '',
        newMaster: '',
        confirmMaster: ''
    });
    const [showMasterPassword, setShowMasterPassword] = useState({
        login: false,
        newMaster: false,
        confirmMaster: false
    });

    // PIN auth modal
    const [pinAuthModal, setPinAuthModal] = useState({
        isOpen: false,
        pin: '',
        showPin: false,
        action: null as 'save_pin' | 'unblock' | 'save_advanced' | null,
        error: ''
    });

    // Logs
    const fetchLogs = useCallback(async () => {
        if (!store?.id) return;

        setLoadingLogs(true);
        setTableMissing(false);

        try {
            const { data, error } = await supabase.rpc('get_store_security_logs', {
                p_store_id: store.id,
                p_limit: 200,
                p_date_from: logFilters.dateFrom || null,
                p_date_to: logFilters.dateTo || null,
                p_user: logFilters.user.trim() || null,
                p_action: logFilters.action.trim() || null,
                p_outcome: logFilters.outcome || null
            });

            if (error) {
                console.error('Logs fetch error:', error);
                if (
                    error.code === 'PGRST205' ||
                    error.message?.includes('store_security_logs') ||
                    error.message?.includes('get_store_security_logs')
                ) {
                    setTableMissing(true);
                }
                setLogs([]);
            } else {
                setLogs((data ?? []) as SecurityLog[]);
            }
        } catch (error: unknown) {
            console.error(error);
            setLogs([]);
        } finally {
            setLoadingLogs(false);
        }
    }, [
        store?.id,
        logFilters.dateFrom,
        logFilters.dateTo,
        logFilters.user,
        logFilters.action,
        logFilters.outcome
    ]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (store?.id) {
            fetchLogs();
        }
    }, [store?.id, fetchLogs]);

    useEffect(() => {
        const today = new Date();
        const from = new Date();
        from.setDate(today.getDate() - 6);

        const toInput = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        setLogFilters(prev => ({
            ...prev,
            dateFrom: prev.dateFrom || toInput(from),
            dateTo: prev.dateTo || toInput(today)
        }));
    }, []);

    useEffect(() => {
        setPinData(hasPin ? '******' : '');
    }, [hasPin]);

    useEffect(() => {
        if (!selectedMemberId) {
            setMemberPermissionOverrides({});
            return;
        }

        void fetchMemberPermissionDetail(selectedMemberId).then((rows) => {
            const overrides: Record<string, boolean> = {};

            rows.forEach((row) => {
                if (row.override_value !== null) {
                    overrides[row.permission_code] = row.override_value;
                }
            });

            setMemberPermissionOverrides(overrides);
        });
    }, [selectedMemberId, fetchMemberPermissionDetail]);

    // Initial data
    const fetchInitialData = useCallback(async () => {
        try {
            const activeStoreId = getActiveStoreId();
            if (!activeStoreId) return;

            const { data: adminDataRaw, error: adminError } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: activeStoreId }
            );

            if (adminError) throw adminError;

            const adminStore = Array.isArray(adminDataRaw)
                ? adminDataRaw[0]
                : adminDataRaw;

            const { data: storeSettings, error: storeSettingsError } = await supabase
                .from('stores')
                .select('token_expiry_seconds, max_token_attempts')
                .eq('id', activeStoreId)
                .single();

            if (storeSettingsError) {
                console.error('Erro ao buscar configurações avançadas da loja:', storeSettingsError);
            }

            if (adminStore) {
                const mergedStore = {
                    ...adminStore,
                    id: adminStore.id || activeStoreId,
                    token_expiry_seconds:
                        storeSettings?.token_expiry_seconds ??
                        adminStore.token_expiry_seconds ??
                        15,
                    max_token_attempts:
                        storeSettings?.max_token_attempts ??
                        adminStore.max_token_attempts ??
                        3,
                };

                setStore(mergedStore);
                setTokenExpiry(mergedStore.token_expiry_seconds ?? 15);
                setMaxAttempts(mergedStore.max_token_attempts ?? 3);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleRefresh = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchInitialData(),
                refreshSecurityContext(),
                refreshAdmin(),
                refreshCustomRoles(),
            ]);
            if (store?.id) {
                await fetchLogs();
            }
        } finally {
            setLoading(false);
        }
    }, [fetchInitialData, refreshSecurityContext, refreshAdmin, refreshCustomRoles, store?.id, fetchLogs]);

    useRefreshFrame(handleRefresh);

    const logAction = useCallback(async (
        action: string,
        details: SecurityLogDetails = {},
        outcome: 'success' | 'failure' = 'success'
    ) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!store?.id || !user) return;

            const { error } = await supabase.rpc('insert_security_log', {
                p_store_id: store.id,
                p_user_id: user.id,
                p_user_email: user.email,
                p_action: action,
                p_details: details,
                p_outcome: outcome
            });

            if (error) throw error;
            await fetchLogs();
        } catch (e) {
            console.error('Failed to log security action:', e);
        }
    }, [store?.id, fetchLogs]);

    // Login password
    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (passwordData.new.length < 6) {
            setMessage('Erro: A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (passwordData.new !== passwordData.confirm) {
            setMessage('Erro: As senhas não conferem.');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwordData.new });
            if (error) throw error;

            setMessage('Senha de login alterada com sucesso!');
            setPasswordData({ current: '', new: '', confirm: '' });
            await logAction('Alteração de Senha de Login', {}, 'success');
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error, 'Erro ao alterar senha.');
            setMessage('Erro ao alterar senha: ' + errorMessage);
            await logAction('Alteração de Senha de Login', { error: errorMessage }, 'failure');
        } finally {
            setSaving(false);
        }
    };

    // Store master password
    const handleMasterPasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (!store?.id) {
            setMessage('Erro: Loja não encontrada.');
            return;
        }

        if (masterPasswordData.newMaster.trim().length < 6) {
            setMessage('Erro: A nova senha master deve ter pelo menos 6 caracteres.');
            return;
        }

        if (masterPasswordData.newMaster !== masterPasswordData.confirmMaster) {
            setMessage('Erro: A confirmação da nova senha master não confere.');
            return;
        }

        const confirmed = window.confirm(
            'Deseja redefinir a senha master da loja?\n\nEssa senha será usada em operações sensíveis, como cancelamento de entrada.'
        );
        if (!confirmed) return;

        setSaving(true);
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user?.email) throw new Error('Usuário autenticado sem e-mail.');

            const { error: reauthError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: masterPasswordData.loginPassword
            });

            if (reauthError) {
                throw new Error('Senha do usuário inválida.');
            }

            const { error: rpcError } = await supabase.rpc('reset_store_master_password', {
                p_store_id: store.id,
                p_new_password: masterPasswordData.newMaster
            });

            if (rpcError) throw rpcError;

            await fetchInitialData();

            setMessage('Senha master redefinida com sucesso!');
            setMasterPasswordData({
                loginPassword: '',
                newMaster: '',
                confirmMaster: ''
            });

            await logAction('Redefinição de Senha Master', {}, 'success');
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error, 'Erro ao redefinir senha master.');
            console.error('Master password reset error:', error);
            setMessage('Erro ao redefinir senha master: ' + errorMessage);
            await logAction('Redefinição de Senha Master', { error: errorMessage }, 'failure');
        } finally {
            setSaving(false);
        }
    };

    // PIN validation
    const validateStockPin = (pin: string, document: string): string | null => {
        if (!/^\d{6}$/.test(pin)) return 'O PIN deve ter exatamente 6 dígitos numéricos.';
        if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'O PIN não pode ser uma sequência simples.';
        if (/^(\d)\1+$/.test(pin)) return 'O PIN não pode ter todos os números iguais.';
        const cleanDoc = document?.replace(/\D/g, '') || '';
        if (cleanDoc.includes(pin)) return 'O PIN não pode ser parte do seu CPF/CNPJ.';
        const digits = pin.split('').map(Number);
        let isArithmetic = true;
        const diff = digits[1] - digits[0];
        for (let i = 1; i < digits.length - 1; i++) {
            if (digits[i + 1] - digits[i] !== diff) {
                isArithmetic = false;
                break;
            }
        }
        if (isArithmetic) return 'O PIN não pode ser uma sequência muito simples (progressão aritmética).';
        const p1 = parseInt(pin.substring(0, 2));
        const p2 = parseInt(pin.substring(2, 4));
        const p3 = parseInt(pin.substring(4, 6));
        if ((p2 - p1 === p3 - p2) && (p2 - p1 !== 0)) {
            return 'O PIN contém uma sequência previsível de pares numéricos.';
        }
        if (pin.substring(0, 3) === pin.substring(3, 6)) return 'O PIN não pode repetir a mesma sequência (ex: 123123).';
        if (p1 === p2 && p2 === p3) return 'O PIN não pode repetir os mesmos pares (ex: 101010).';
        return null;
    };

    const savePinDirectly = async () => {
        const wasExistingPin = hasPin;

        const { error } = await supabase.rpc('set_user_pin', {
            p_pin: pinData,
        });

        if (error) throw error;

        setMessage(wasExistingPin ? 'PIN alterado com sucesso!' : 'PIN cadastrado com sucesso!');
        await logAction(wasExistingPin ? 'Alteração de PIN' : 'Criação de PIN', {}, 'success');

        setPinData('******');

        await refreshSecurityContext();
    };

    const handlePinSave = async () => {
        if (!store) return;
        setMessage('');

        if (pinData === '******') {
            toast.info('Nenhuma alteração no PIN.');
            return;
        }

        const pinError = validateStockPin(pinData, store.document);
        if (pinError) {
            setMessage(`Erro no PIN: ${pinError}`);
            return;
        }

        if (!hasPin) {
            setSaving(true);
            try {
                await savePinDirectly();
            } catch (error: unknown) {
                const errorMessage = getErrorMessage(error, 'Erro ao cadastrar PIN.');
                setMessage('Erro ao cadastrar PIN: ' + errorMessage);
                await logAction('Tentativa de Criação de PIN', { error: errorMessage }, 'failure');
            } finally {
                setSaving(false);
            }
            return;
        }

        setPinAuthModal({ isOpen: true, pin: '', showPin: false, action: 'save_pin', error: '' });
    };

    const handleUnblock = () => {
        if (!store) return;
        setPinAuthModal({ isOpen: true, pin: '', showPin: false, action: 'unblock', error: '' });
    };

    const handleAdvancedSave = async () => {
        if (!canManageSecurity) {
            toast.error('Você não tem permissão para alterar configurações de segurança.');
            return;
        }

        if (!hasPin) {
            toast.error('Configure o PIN de segurança antes de alterar configurações avançadas.');
            return;
        }

        if (!store) return;
        setMessage('');
        setPinAuthModal({ isOpen: true, pin: '', showPin: false, action: 'save_advanced', error: '' });
    };

    const verifySecurityPin = async (plainPin: string): Promise<boolean> => {
        if (!hasPin) {
            toast.error('Nenhum PIN cadastrado. Configure um PIN primeiro.');
            return false;
        }

        const { data, error } = await supabase.rpc('validate_user_pin', {
            p_pin: plainPin,
        });

        if (error) {
            console.error('Erro ao validar PIN:', error);
            return false;
        }

        return Boolean(data);
    };

    const handlePinAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setPinAuthModal(prev => ({ ...prev, error: '' }));

        try {
            const isValid = await verifySecurityPin(pinAuthModal.pin);
            if (!isValid) {
                setPinAuthModal(prev => ({ ...prev, error: 'PIN incorreto.' }));
                setSaving(false);
                return;
            }

            if (pinAuthModal.action === 'save_pin') {
                await savePinDirectly();

            } else if (pinAuthModal.action === 'unblock') {
                if (!store) return;
                const newConfig = { ...store.config, pin_failed_attempts: 0, pin_blocked: false, pin_blocked_at: null };
                const { error: updateError } = await supabase
                    .from('stores')
                    .update({ config: newConfig })
                    .eq('id', store.id);
                if (updateError) throw updateError;

                setStore({ ...store, config: newConfig });
                setMessage('PIN desbloqueado com sucesso!');
                await logAction('Desbloqueio de PIN', {}, 'success');

            } else if (pinAuthModal.action === 'save_advanced') {
                if (!store) return;
                const { error: updateError } = await supabase
                    .from('stores')
                    .update({
                        token_expiry_seconds: tokenExpiry,
                        max_token_attempts: maxAttempts
                    })
                    .eq('id', store.id);
                if (updateError) throw updateError;

                setStore({ ...store, token_expiry_seconds: tokenExpiry, max_token_attempts: maxAttempts });
                setMessage('Configurações avançadas salvas com sucesso!');
                await fetchInitialData();
                await logAction(
                    'Alteração de Configurações de Token',
                    { token_expiry: tokenExpiry, max_attempts: maxAttempts },
                    'success'
                );
            }

            setPinAuthModal({ isOpen: false, pin: '', showPin: false, action: null, error: '' });
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error, 'Erro ao executar ação protegida.');
            setMessage('Erro: ' + errorMessage);
            await logAction(
                pinAuthModal.action === 'unblock'
                    ? 'Tentativa de Desbloqueio'
                    : pinAuthModal.action === 'save_pin'
                        ? 'Tentativa de Gravação PIN'
                        : 'Tentativa de Alteração de Configurações',
                { error: errorMessage },
                'failure'
            );
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'context', label: 'Contexto de acesso', icon: ShieldCheck },
        { id: 'logs', label: 'Histórico de atividades', icon: History },
        { id: 'roles', label: 'Permissões por papel', icon: BadgeCheck },
        { id: 'custom_roles', label: 'Funções personalizadas', icon: Shield },
        { id: 'users_perms', label: 'Permissões por usuário', icon: User },
        { id: 'sensitive_actions', label: 'Ações sensíveis', icon: Lock },
        { id: 'pin_token', label: 'PIN e token', icon: Key },
    ];

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const createdAt = log.created_at ? new Date(log.created_at) : null;

            if (logFilters.dateFrom) {
                const from = new Date(`${logFilters.dateFrom}T00:00:00`);
                if (!createdAt || createdAt < from) return false;
            }

            if (logFilters.dateTo) {
                const to = new Date(`${logFilters.dateTo}T23:59:59`);
                if (!createdAt || createdAt > to) return false;
            }

            if (logFilters.user.trim()) {
                const userValue = `${log.user_name || ''} ${log.user_email || ''}`.toLowerCase();
                if (!userValue.includes(logFilters.user.trim().toLowerCase())) return false;
            }

            if (logFilters.action.trim()) {
                const actionValue = `${log.action || ''} ${formatSecurityLogAction(log.action)}`.toLowerCase();
                if (!actionValue.includes(logFilters.action.trim().toLowerCase())) return false;
            }

            if (logFilters.outcome.trim()) {
                if ((log.outcome || '') !== logFilters.outcome) return false;
            }

            return true;
        });
    }, [logs, logFilters]);

    const handleTestSensitiveAction = async () => {
        try {
            const requirement = await getActionRequirement('product_delete');
            setProductDeleteRequirement(JSON.stringify(requirement, null, 2));
        } catch (error: unknown) {
            const message = getErrorMessage(error, 'Erro ao testar ação sensível');
            setProductDeleteRequirement(message);
        }
    };

    const resetLogFilters = () => {
        const today = new Date();
        const from = new Date();
        from.setDate(today.getDate() - 6);

        const toInput = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        setLogFilters({
            dateFrom: toInput(from),
            dateTo: toInput(today),
            user: '',
            action: '',
            outcome: ''
        });
    };

    const handleToggleRolePermission = async (
        permissionCode: string,
        role: string,
        currentAllowed: boolean
    ) => {
        if (!canManageSecurity) {
            toast.error('Você não tem permissão para alterar permissões.');
            return;
        }

        if (role === 'owner') {
            toast.info('O proprietário sempre mantém acesso total.');
            return;
        }

        try {
            await updateRolePermission({
                role,
                permissionCode,
                allowed: !currentAllowed,
                reason: `${!currentAllowed ? 'Liberação' : 'Bloqueio'} da permissão ${permissionCode} para o papel ${formatSecurityRole(role)} pela tela de segurança.`,
            });

            toast.success('Permissão atualizada.');
            await fetchLogs();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Erro ao atualizar permissão.'));
        }
    };

    const handleUpdateSensitiveAction = async (
        row: {
            action_code: string;
            enabled: boolean;
            requirement: string;
            min_role: string;
            token_enabled: boolean;
            token_expiry_seconds: number;
            max_attempts: number;
            require_reason: boolean;
        },
        patch: Partial<{
            enabled: boolean;
            requirement: string;
            min_role: string;
            token_enabled: boolean;
            token_expiry_seconds: number;
            max_attempts: number;
            require_reason: boolean;
        }>
    ) => {
        if (!canManageSecurity) {
            toast.error('Você não tem permissão para alterar ações sensíveis.');
            return;
        }

        const next = {
            enabled: patch.enabled ?? row.enabled,
            requirement: patch.requirement ?? row.requirement,
            minRole: patch.min_role ?? row.min_role,
            tokenEnabled: patch.token_enabled ?? row.token_enabled,
            tokenExpirySeconds: patch.token_expiry_seconds ?? row.token_expiry_seconds,
            maxAttempts: patch.max_attempts ?? row.max_attempts,
            requireReason: patch.require_reason ?? row.require_reason,
        };

        try {
            await updateSensitiveAction({
                actionCode: row.action_code,
                ...next,
                reason: `Alteração da regra ${row.action_code} pela tela de segurança.`,
            });

            toast.success('Regra sensível atualizada.');
            await fetchLogs();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Erro ao atualizar ação sensível.'));
        }
    };

    const getOverrideSelectValue = (permissionCode: string): 'inherit' | 'allow' | 'deny' => {
        if (!(permissionCode in memberPermissionOverrides)) return 'inherit';
        return memberPermissionOverrides[permissionCode] ? 'allow' : 'deny';
    };

    const handleMemberOverrideChange = (
        permissionCode: string,
        value: 'inherit' | 'allow' | 'deny'
    ) => {
        setMemberPermissionOverrides((prev) => {
            const next = { ...prev };

            if (value === 'inherit') {
                delete next[permissionCode];
                return next;
            }

            next[permissionCode] = value === 'allow';
            return next;
        });
    };

    const handleSaveMemberOverrides = async () => {
        if (!selectedMemberId) {
            toast.error('Selecione um usuário.');
            return;
        }

        if (!canManageSecurity) {
            toast.error('Você não tem permissão para alterar permissões individuais.');
            return;
        }

        try {
            await updateMemberPermissions({
                memberId: selectedMemberId,
                permissions: memberPermissionOverrides,
                sensitiveActions: {},
                reason: 'Alteração de permissões individuais pela tela de segurança.',
            });

            toast.success('Permissões individuais salvas.');
            await fetchMembersForPermissions();
            await fetchLogs();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Erro ao salvar permissões individuais.'));
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Loader className="animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <PageContainer
            title="Senhas e Acesso"
            subtitle="Gerencie as configurações de segurança, PIN, senhas master e permissões da equipe."
            category="Configurações"
            icon={<Shield className="text-[#21A896]" size={28} />}
            flat
        >
            {message && (
                <div
                    className={`p-4 rounded-xl mb-6 flex items-center gap-3 shadow-sm border ${message.includes('Erro')
                        ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                        : 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                        }`}
                >
                    {message.includes('Erro') ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                    <span className="font-medium">{message}</span>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id
                                ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-900/10'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 md:p-8">
                    {pinAuthModal.isOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-white dark:bg-gray-900 w-full max-w-md p-6 rounded-2xl shadow-xl animate-zoomIn">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <Lock size={20} className="text-red-500" />
                                    Autorização com PIN de Segurança
                                </h3>
                                <p className="text-gray-500 mb-4">
                                    Digite o PIN de segurança para{' '}
                                    {pinAuthModal.action === 'save_pin'
                                        ? 'alterar/cadastrar o PIN'
                                        : pinAuthModal.action === 'unblock'
                                            ? 'desbloquear o PIN'
                                            : 'salvar as configurações avançadas'}
                                    .
                                </p>

                                <form onSubmit={handlePinAuthSubmit}>
                                    <div className="relative mb-4">
                                        <input
                                            type={pinAuthModal.showPin ? 'text' : 'password'}
                                            placeholder="PIN de 6 dígitos"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white pr-10 font-mono tracking-widest"
                                            value={pinAuthModal.pin}
                                            onChange={e =>
                                                setPinAuthModal({
                                                    ...pinAuthModal,
                                                    pin: e.target.value.replace(/\D/g, '').slice(0, 6)
                                                })
                                            }
                                            maxLength={6}
                                            autoFocus
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPinAuthModal({ ...pinAuthModal, showPin: !pinAuthModal.showPin })
                                            }
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                            tabIndex={-1}
                                        >
                                            {pinAuthModal.showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>

                                    {pinAuthModal.error && (
                                        <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                                            {pinAuthModal.error}
                                        </p>
                                    )}

                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPinAuthModal({
                                                    isOpen: false,
                                                    pin: '',
                                                    showPin: false,
                                                    action: null,
                                                    error: ''
                                                })
                                            }
                                            className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-bold"
                                            disabled={saving}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving || pinAuthModal.pin.length !== 6}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {saving && <Loader size={16} className="animate-spin" />}
                                            Confirmar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* CONTEXTO DE ACESSO */}
                    <div className={activeTab === 'context' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                    Contexto de Segurança do Usuário
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Visualize a Loja ativa / contexto atual, papel, status, PIN e permissões vinculadas ao usuário logado.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={refreshSecurityContext}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                <RefreshCw size={16} className={loadingSecurityContext ? 'animate-spin' : ''} />
                                Atualizar
                            </button>
                        </div>

                        {loadingSecurityContext ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700">
                                <Loader className="animate-spin text-brand-green" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                            <User size={20} />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                            Usuário
                                        </p>
                                        <p className="mt-1 break-all text-sm font-bold text-gray-800 dark:text-white">
                                            {securityContext?.profile?.name || securityContext?.email || 'Usuário'}
                                        </p>
                                        <p className="mt-1 break-all text-xs text-gray-500">
                                            {securityContext?.email || 'E-mail não identificado'}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                            <Store size={20} />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                            Loja ativa / contexto atual
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-gray-800 dark:text-white">
                                            {currentStoreName}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {currentStoreSlug ? `/${currentStoreSlug}` : 'Slug não definido'}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                            Papel atual
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-gray-800 dark:text-white">
                                            {formatSecurityRole(currentRole)}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {formatSecurityStatus(activeMembership?.status ?? null)}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                            <Key size={20} />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                            PIN
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-gray-800 dark:text-white">
                                            {hasPin ? 'Configurado' : 'Não configurado'}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            PIN individual do usuário
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                                        <h4 className="mb-3 flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                            <BadgeCheck size={18} className="text-brand-green" />
                                            Resumo operacional
                                        </h4>

                                        <div className="space-y-2 text-sm">
                                            <InfoLine label="Store ID" value={currentStoreId || 'Não definido'} />
                                            <InfoLine label="É proprietário?" value={isOwner ? 'Sim' : 'Não'} />
                                            <InfoLine label="Perfil administrativo?" value={isAdminLike ? 'Sim' : 'Não'} />
                                            <InfoLine label="Global admin" value={securityContext?.is_global_admin ? 'Sim' : 'Não'} />
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                                        <h4 className="mb-3 flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                            <Lock size={18} className="text-brand-green" />
                                            Ações sensíveis
                                        </h4>

                                        {activeMembership?.sensitive_actions &&
                                            Object.keys(activeMembership.sensitive_actions).length > 0 ? (
                                            <pre className="max-h-44 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                                {JSON.stringify(activeMembership.sensitive_actions, null, 2)}
                                            </pre>
                                        ) : (
                                            <p className="text-sm text-gray-500">
                                                Nenhuma ação sensível específica registrada ainda.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="font-bold text-gray-800 dark:text-white">
                                                Permissões efetivas
                                            </h4>
                                            <p className="text-xs text-gray-500">
                                                Permissões resolvidas a partir do papel atual e possíveis sobrescritas.
                                            </p>
                                        </div>

                                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                            {allowedPermissions.length} permitidas
                                        </span>
                                    </div>

                                    {loadingPermissions ? (
                                        <div className="flex min-h-24 items-center justify-center">
                                            <Loader className="animate-spin text-brand-green" />
                                        </div>
                                    ) : permissions.length === 0 ? (
                                        <p className="text-sm text-gray-500">
                                            Nenhuma permissão carregada.
                                        </p>
                                    ) : (
                                        <div className="space-y-4">
                                            {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
                                                <div key={module} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
                                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                                                        {formatPermissionModule(module)}
                                                    </p>

                                                    <div className="flex flex-wrap gap-2">
                                                        {modulePermissions.map((permission) => (
                                                            <span
                                                                key={permission.permission_code}
                                                                className={
                                                                    permission.allowed
                                                                        ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                                        : 'rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                                                }
                                                                title={permission.description ?? permission.permission_code}
                                                            >
                                                                {permission.allowed ? <Check size={12} className="inline mr-1 align-middle" /> : <X size={12} className="inline mr-1 align-middle" />}
                                                                <span className="align-middle">{formatPermissionAction(permission.action)}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                                    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h4 className="font-bold text-gray-800 dark:text-white">
                                                Teste de ação sensível
                                            </h4>
                                            <p className="text-xs text-gray-500">
                                                Consulta a regra efetiva para exclusão/descontinuação de produto.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleTestSensitiveAction}
                                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                        >
                                            Testar deletar produtos
                                        </button>
                                    </div>

                                    {productDeleteRequirement ? (
                                        <div className="space-y-3">
                                            {(() => {
                                                try {
                                                    const parsed = JSON.parse(productDeleteRequirement) as {
                                                        allowed?: boolean;
                                                        reason?: string;
                                                        requirement?: string;
                                                        min_role?: string;
                                                        current_role?: string;
                                                        token_enabled?: boolean;
                                                        has_pin?: boolean;
                                                    };

                                                    return (
                                                        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                                            <InfoLine
                                                                label="Resultado"
                                                                value={parsed.allowed ? 'Permitido' : 'Bloqueado'}
                                                            />
                                                            <InfoLine
                                                                label="Motivo"
                                                                value={formatSensitiveReason(parsed.reason)}
                                                            />
                                                            <InfoLine
                                                                label="Exigência"
                                                                value={formatSensitiveRequirement(parsed.requirement)}
                                                            />
                                                            <InfoLine
                                                                label="Papel mínimo"
                                                                value={formatSecurityRole(parsed.min_role ?? null)}
                                                            />
                                                            <InfoLine
                                                                label="Papel atual"
                                                                value={formatSecurityRole(parsed.current_role ?? null)}
                                                            />
                                                            <InfoLine
                                                                label="PIN configurado"
                                                                value={parsed.has_pin ? 'Sim' : 'Não'}
                                                            />
                                                        </div>
                                                    );
                                                } catch {
                                                    return null;
                                                }
                                            })()}

                                            <pre className="max-h-60 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                                {productDeleteRequirement}
                                            </pre>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">
                                            Clique para consultar a exigência atual da ação sensível.
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                                    <h4 className="mb-3 font-bold text-gray-800 dark:text-white">
                                        Vínculos e lojas
                                    </h4>

                                    {securityContext?.memberships?.length ? (
                                        <div className="space-y-2">
                                            {securityContext.memberships.map((membership) => (
                                                <div
                                                    key={membership.member_id}
                                                    className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40 md:flex-row md:items-center md:justify-between"
                                                >
                                                    <div>
                                                        <p className="font-bold text-gray-800 dark:text-white">
                                                            {membership.store_name}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            /{membership.store_slug}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        <span className="rounded-full bg-green-100 px-2 py-1 font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                            Papel neste vínculo: {formatSecurityRole(membership.role)}
                                                        </span>
                                                        {membership.status === 'suspended' || membership.access_blocked === true ? (
                                                            <span className="rounded-full bg-orange-100 px-2 py-1 font-bold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                                                                Suspenso
                                                            </span>
                                                        ) : (
                                                            <span className="rounded-full bg-gray-100 px-2 py-1 font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                                {formatSecurityStatus(membership.status)}
                                                            </span>
                                                        )}
                                                        {membership.is_primary_owner && (
                                                            <span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                                Titular
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">
                                            Nenhuma loja vinculada encontrada.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* LOGS */}
                    <div className={activeTab === 'logs' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                Registro de Atividades
                            </h3>
                            <button
                                onClick={fetchLogs}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                                title="Atualizar"
                            >
                                <RefreshCw size={16} className={loadingLogs ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {tableMissing && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl mb-6">
                                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 font-bold mb-2">
                                    <AlertCircle size={20} />
                                    Configuração Necessária
                                </div>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                                    A tabela de logs de segurança ainda não foi criada no banco de dados.
                                    Para ativar o histórico, execute o seguinte comando SQL no seu painel Supabase:
                                </p>
                                <pre className="bg-yellow-100 dark:bg-black/30 p-3 rounded-lg text-xs overflow-x-auto select-all font-mono text-yellow-900 dark:text-yellow-100 border border-yellow-200 dark:border-yellow-800">
                                    {`create table if not exists public.store_security_logs (
  id uuid default gen_random_uuid() primary key,
  store_id uuid,
  user_id uuid,
  user_email text,
  action text not null,
  details jsonb default '{}'::jsonb,
  outcome text check (outcome in ('success', 'failure')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`}
                                </pre>
                            </div>
                        )}



                        <div className="mb-4 flex flex-col gap-3">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                                <input
                                    type="date"
                                    value={logFilters.dateFrom}
                                    onChange={e => setLogFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                                <input
                                    type="date"
                                    value={logFilters.dateTo}
                                    onChange={e => setLogFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                                <input
                                    type="text"
                                    placeholder="Filtrar por usuário"
                                    value={logFilters.user}
                                    onChange={e => setLogFilters(prev => ({ ...prev, user: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                                <input
                                    type="text"
                                    placeholder="Filtrar por ação"
                                    value={logFilters.action}
                                    onChange={e => setLogFilters(prev => ({ ...prev, action: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                                <select
                                    value={logFilters.outcome}
                                    onChange={e => setLogFilters(prev => ({ ...prev, outcome: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                >
                                    <option value="">Todos os resultados</option>
                                    <option value="success">Sucesso</option>
                                    <option value="failure">Falha</option>
                                </select>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={resetLogFilters}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    <Filter size={16} />
                                    Limpar filtros
                                </button>
                            </div>
                        </div>


                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                                    <tr>
                                        <th className="p-3 rounded-l-lg">Data/Hora</th>
                                        <th className="p-3">Usuário</th>
                                        <th className="p-3">Ação</th>
                                        <th className="p-3 rounded-r-lg">Resultado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-400">
                                                {loadingLogs ? 'Carregando...' : 'Nenhuma atividade encontrada para os filtros aplicados.'}
                                                {!loadingLogs && (
                                                    <p className="text-xs mt-2 text-yellow-500">
                                                        Se atividades não aparecem após ações, verifique se a tabela
                                                        {' '}store_security_logs existe no banco de dados.
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="p-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    {timezoneUtils.formatBrazilDateTime(log.created_at)}
                                                </td>
                                                <td className="p-3 font-medium text-gray-700 dark:text-gray-300">
                                                    <div>
                                                        <p className="font-bold text-gray-700 dark:text-gray-300">
                                                            {log.user_name || log.user_email || 'Usuário não identificado'}
                                                        </p>
                                                        {log.user_email && (
                                                            <p className="text-xs text-gray-400">
                                                                {log.user_email}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-gray-800 dark:text-gray-200">
                                                    <div className="max-w-xl">
                                                        <p className="font-bold">
                                                            {formatSecurityLogAction(log.action)}
                                                        </p>

                                                        {formatSecurityLogDetails(log) && (
                                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                                {formatSecurityLogDetails(log)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    {log.outcome === 'success' ? (
                                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                                            Sucesso
                                                        </span>
                                                    ) : (
                                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                                                            Falha
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* PERMISSÕES POR PAPEL */}
                    <div className={activeTab === 'roles' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                    Matriz de Permissões por Papel
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Esta tabela mostra as permissões padrão configuradas no sistema para cada papel.
                                </p>
                            </div>
                            
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar autorização..."
                                        value={permissionSearch}
                                        onChange={(e) => setPermissionSearch(e.target.value)}
                                        className="w-full sm:w-64 rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    />
                                    <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                                </div>

                                <button
                                    type="button"
                                    onClick={refreshAdmin}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    <RefreshCw size={16} className={adminLoading.matrix ? 'animate-spin' : ''} />
                                    Atualizar
                                </button>
                            </div>
                        </div>

                        {adminError && (
                            <div className="p-4 rounded-xl mb-6 bg-red-50 border border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                                <p className="font-semibold">Erro ao carregar matriz de permissões:</p>
                                <p className="text-sm mt-1">{adminError}</p>
                            </div>
                        )}

                        {adminLoading.matrix ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700">
                                <Loader className="animate-spin text-brand-green" />
                            </div>
                        ) : permissionMatrix.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl dark:border-gray-700">
                                Nenhuma permissão configurada ou erro na leitura do banco.
                            </div>
                        ) : (
                            <div className="w-full max-w-[1280px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm">
                                <div className="overflow-auto max-h-[550px] border-collapse relative">
                                    <table className="min-w-[1120px] w-full text-left text-sm whitespace-nowrap border-collapse relative">
                                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 sticky top-0 z-20 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)] dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]">
                                            <tr>
                                                <th className="p-3 bg-gray-50 dark:bg-gray-900">Permissão</th>
                                                <th className="p-3 bg-gray-50 dark:bg-gray-900">Risco</th>
                                                {ROLE_PERMISSION_COLUMNS.map((column) => (
                                                    <th key={column.role} className="p-3 text-center bg-gray-50 dark:bg-gray-900">
                                                        {column.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {filteredMatrix.map((row) => (
                                                <tr key={row.permission_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                    <td className="p-3">
                                                        <div className="font-bold text-gray-800 dark:text-white">
                                                            {row.label}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {row.module}.{row.action} ({row.permission_code})
                                                        </div>
                                                        {row.description && (
                                                            <div className="text-xs text-gray-500 mt-0.5">{row.description}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        {renderRiskBadge(row.risk_level)}
                                                    </td>
                                                    {ROLE_PERMISSION_COLUMNS.map((column) => {
                                                        const allowed = column.role === 'owner' ? true : Boolean(row[column.key]);
                                                        const disabled =
                                                            column.role === 'owner' ||
                                                            !canManageSecurity ||
                                                            adminLoading.saving;

                                                        return (
                                                            <td key={column.role} className="p-3 text-center">
                                                                <button
                                                                    type="button"
                                                                    disabled={disabled}
                                                                    onClick={() =>
                                                                        handleToggleRolePermission(
                                                                            row.permission_code,
                                                                            column.role,
                                                                            allowed
                                                                        )
                                                                    }
                                                                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black transition ${allowed
                                                                        ? 'border-green-200 bg-green-100 text-green-700 hover:bg-green-200 dark:border-green-900/50 dark:bg-green-900/30 dark:text-green-300'
                                                                        : 'border-gray-200 bg-gray-100 text-gray-400 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
                                                                        } ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                                                    title={
                                                                        column.role === 'owner'
                                                                            ? 'Owner sempre tem acesso total'
                                                                            : allowed
                                                                                ? `Remover de ${column.label}`
                                                                                : `Liberar para ${column.label}`
                                                                    }
                                                                >
                                                                    {allowed ? <Check size={14} /> : <X size={14} />}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PERMISSÕES POR USUÁRIO */}
                    <div className={activeTab === 'users_perms' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                    Permissões Individuais por Usuário
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Configure exceções específicas sem alterar o padrão do papel.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveMemberOverrides}
                                disabled={!selectedMemberId || adminLoading.saving || !canManageSecurity}
                                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {adminLoading.saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                                Salvar permissões
                            </button>
                        </div>

                        <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                Usuário/membro
                            </label>

                            <select
                                value={selectedMemberId}
                                onChange={(event) => setSelectedMemberId(event.target.value)}
                                disabled={!canManageSecurity}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            >
                                <option value="">Selecione um membro</option>
                                {selectableMembers.map((member) => (
                                    <option key={member.member_id} value={member.member_id}>
                                        {member.user_name} â€” {formatSecurityRole(member.role)} â€” {member.user_email || 'sem e-mail'}
                                    </option>
                                ))}
                            </select>

                            {selectableMembers.length === 0 && (
                                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                    Nenhum membro editável apareceu no contexto atual. Se necessário, criaremos uma RPC para listar todos os membros da loja.
                                </p>
                            )}
                        </div>

                        {!selectedMemberId ? (
                            <div className="p-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800">
                                    <User size={24} />
                                </div>
                                <h4 className="text-base font-bold text-gray-800 dark:text-white mb-2">
                                    Selecione um usuário
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                    Escolha um membro para visualizar permissões herdadas e configurar exceções individuais.
                                </p>
                            </div>
                        ) : adminLoading.memberDetail ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700">
                                <Loader className="animate-spin text-brand-green" />
                            </div>
                        ) : memberPermissionDetail.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl dark:border-gray-700">
                                Nenhuma permissão encontrada para este membro.
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                                        <tr>
                                            <th className="p-3">Permissão</th>
                                            <th className="p-3">Risco</th>
                                            <th className="p-3 text-center">Papel</th>
                                            <th className="p-3 text-center">Efetivo</th>
                                            <th className="p-3">Override individual</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {memberPermissionDetail.map((row) => (
                                            <tr key={row.permission_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="p-3">
                                                    <div className="font-bold text-gray-800 dark:text-white">
                                                        {row.label}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {formatPermissionModule(row.module)} · {formatPermissionAction(row.action)} · {row.permission_code}
                                                    </div>
                                                    {row.description && (
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            {row.description}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="p-3">
                                                    {renderRiskBadge(row.risk_level)}
                                                </td>

                                                <td className="p-3 text-center">
                                                    <span className={row.role_allowed ? 'text-green-600 font-bold' : 'text-gray-400 font-semibold'}>
                                                        {row.role_allowed ? 'Permitido' : 'Bloqueado'}
                                                    </span>
                                                </td>

                                                <td className="p-3 text-center">
                                                    <span className={row.effective_allowed ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                                                        {row.effective_allowed ? 'Permitido' : 'Bloqueado'}
                                                    </span>
                                                </td>

                                                <td className="p-3">
                                                    <select
                                                        value={getOverrideSelectValue(row.permission_code)}
                                                        disabled={!canManageSecurity || adminLoading.saving}
                                                        onChange={(event) =>
                                                            handleMemberOverrideChange(
                                                                row.permission_code,
                                                                event.target.value as 'inherit' | 'allow' | 'deny'
                                                            )
                                                        }
                                                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                    >
                                                        <option value="inherit">Herdar do papel</option>
                                                        <option value="allow">Liberar para este usuário</option>
                                                        <option value="deny">Bloquear para este usuário</option>
                                                    </select>

                                                    {row.source !== 'role_template' && (
                                                        <p className="mt-1 text-xs text-gray-400">
                                                            Origem atual: {formatPermissionSource(row.source)}
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* AÇÕES SENSÍVEIS */}
                    <div className={activeTab === 'sensitive_actions' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                    Configuração de Ações Sensíveis
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Essas ações exigem autorizações adicionais do operador ou administrador (PIN, Token, Senha Master, aprovação do dono).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={refreshAdmin}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                <RefreshCw size={16} className={adminLoading.sensitiveActions ? 'animate-spin' : ''} />
                                Atualizar
                            </button>
                        </div>

                        {adminError && (
                            <div className="p-4 rounded-xl mb-6 bg-red-50 border border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                                <p className="font-semibold">Erro ao carregar ações sensíveis:</p>
                                <p className="text-sm mt-1">{adminError}</p>
                            </div>
                        )}

                        {adminLoading.sensitiveActions ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700">
                                <Loader className="animate-spin text-brand-green" />
                            </div>
                        ) : sensitiveActionsMatrix.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl dark:border-gray-700">
                                Nenhuma ação sensível configurada ou erro na leitura do banco.
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                                        <tr>
                                            <th className="p-3">Ação Sensível</th>
                                            <th className="p-3">Risco</th>
                                            <th className="p-3">Exigência</th>
                                            <th className="p-3">Papel Mínimo</th>
                                            <th className="p-3 text-center">Habilitado</th>
                                            <th className="p-3 text-center">Token</th>
                                            <th className="p-3">Expiração</th>
                                            <th className="p-3">Tentativas Máx.</th>
                                            <th className="p-3 text-center">Motivo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {sensitiveActionsMatrix.map((row) => (
                                            <tr key={row.action_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="p-3">
                                                    <div className="font-bold text-gray-800 dark:text-white">
                                                        {row.label}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {row.module} ({row.action_code})
                                                    </div>
                                                    {row.description && (
                                                        <div className="text-xs text-gray-500 mt-0.5">{row.description}</div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    {renderRiskBadge(row.risk_level)}
                                                </td>
                                                <td className="p-3">
                                                    <select
                                                        value={row.requirement}
                                                        disabled={!canManageSecurity || adminLoading.saving}
                                                        onChange={(event) =>
                                                            handleUpdateSensitiveAction(row, {
                                                                requirement: event.target.value,
                                                            })
                                                        }
                                                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                    >
                                                        {SENSITIVE_REQUIREMENT_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                <td className="p-3">
                                                    <select
                                                        value={row.min_role}
                                                        disabled={!canManageSecurity || adminLoading.saving}
                                                        onChange={(event) =>
                                                            handleUpdateSensitiveAction(row, {
                                                                min_role: event.target.value,
                                                            })
                                                        }
                                                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                    >
                                                        {ROLE_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.enabled}
                                                        disabled={!canManageSecurity || adminLoading.saving}
                                                        onChange={(event) =>
                                                            handleUpdateSensitiveAction(row, {
                                                                enabled: event.target.checked,
                                                            })
                                                        }
                                                        className="h-4 w-4 accent-green-600"
                                                    />
                                                </td>

                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.token_enabled}
                                                        disabled={!canManageSecurity || adminLoading.saving}
                                                        onChange={(event) =>
                                                            handleUpdateSensitiveAction(row, {
                                                                token_enabled: event.target.checked,
                                                            })
                                                        }
                                                        className="h-4 w-4 accent-green-600"
                                                    />
                                                </td>

                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min={15}
                                                        max={300}
                                                        value={row.token_expiry_seconds}
                                                        disabled={!canManageSecurity || adminLoading.saving}
                                                        onChange={(event) =>
                                                            handleUpdateSensitiveAction(row, {
                                                                token_expiry_seconds: Number(event.target.value),
                                                            })
                                                        }
                                                        className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                    />
                                                </td>

                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={10}
                                                        value={row.max_attempts}
                                                        disabled={!canManageSecurity || adminLoading.saving}
                                                        onChange={(event) =>
                                                            handleUpdateSensitiveAction(row, {
                                                                max_attempts: Number(event.target.value),
                                                            })
                                                        }
                                                        className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                    />
                                                </td>

                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.require_reason}
                                                        disabled={!canManageSecurity || adminLoading.saving}
                                                        onChange={(event) =>
                                                            handleUpdateSensitiveAction(row, {
                                                                require_reason: event.target.checked,
                                                            })
                                                        }
                                                        className="h-4 w-4 accent-green-600"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* PIN E TOKEN */}
                    <div className={activeTab === 'pin_token' ? 'block space-y-8 animate-fadeIn' : 'hidden'}>
                        {/* PIN de Segurança */}
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-6 rounded-xl">
                            <div className="flex flex-col md:flex-row md:items-start gap-4">
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 shrink-0 w-fit">
                                    <Smartphone size={24} />
                                </div>
                                <div className="flex-1 w-full">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                                        PIN de Segurança
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                        Este PIN é utilizado para autorizar funções específicas do sistema que exigem validação em tempo de execução.
                                    </p>

                                    {store?.config?.pin_blocked ? (
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-red-200 dark:border-red-900/50">
                                            <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
                                                <AlertCircle size={20} />
                                                PIN BLOQUEADO
                                            </div>
                                            <p className="text-sm text-gray-500 mb-4">
                                                O acesso foi bloqueado após muitas tentativas incorretas.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleUnblock}
                                                className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition w-full md:w-auto"
                                            >
                                                Desbloquear Agora
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                {store?.stock_password_hash ? 'Alterar PIN Atual' : 'Cadastrar Novo PIN'}
                                            </label>
                                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                                <div className="relative flex-1 w-full">
                                                    <input
                                                        type={showPin ? 'text' : 'password'}
                                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white tracking-[0.5em] text-center font-bold text-xl pr-10"
                                                        value={pinData}
                                                        onChange={e => setPinData(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        onFocus={() => {
                                                            if (pinData === '******') setPinData('');
                                                        }}
                                                        onBlur={() => {
                                                            if (!pinData && store?.stock_password_hash) setPinData('******');
                                                        }}
                                                        placeholder="******"
                                                        maxLength={6}
                                                        inputMode="numeric"
                                                        autoComplete="off"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowPin(!showPin);
                                                            if (pinData.length > 0 && !showPin) {
                                                                logAction('Visualização de PIN', { field: 'pin_input' }, 'success').catch(console.error);
                                                            }
                                                        }}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                                                        title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                                                    >
                                                        {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                <div className="text-xs text-gray-400 md:max-w-xs">
                                                    {store?.stock_password_hash ? (
                                                        <span className="text-yellow-600 dark:text-yellow-500 block mb-1">
                                                            O PIN atual está oculto por segurança. Digite um novo para alterar.
                                                        </span>
                                                    ) : (
                                                        <span className="block mb-1">Defina um PIN de 6 números.</span>
                                                    )}
                                                    <span className="opacity-75">
                                                        * 6 números | Sem sequências | Sem repetições
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                                <button
                                                    onClick={handlePinSave}
                                                    disabled={saving || !pinData || pinData.length !== 6}
                                                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {saving ? 'Salvando...' : 'Salvar PIN'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Alterar Senhas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Senha do Sistema */}
                            <div className="border border-gray-200 dark:border-gray-700 p-6 rounded-xl space-y-4 bg-white dark:bg-gray-800">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <Key size={20} className="text-brand-green" />
                                    Alterar Senha do Sistema
                                </h3>
                                <form onSubmit={handlePasswordChange} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            Nova Senha
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword.new ? 'text' : 'password'}
                                                value={passwordData.new}
                                                onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                                tabIndex={-1}
                                            >
                                                {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            Confirmar Nova Senha
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword.confirm ? 'text' : 'password'}
                                                value={passwordData.confirm}
                                                onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                            >
                                                {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={saving || !passwordData.new}
                                            className="flex items-center gap-2 bg-brand-green text-white px-5 py-2.5 rounded-lg font-bold hover:brightness-90 transition disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700 text-sm"
                                        >
                                            {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                                            Atualizar Senha
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Senha Master da Loja */}
                            <div className="border border-gray-200 dark:border-gray-700 p-6 rounded-xl space-y-4 bg-white dark:bg-gray-800">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <Lock size={20} className="text-purple-600" />
                                        Redefinir Senha Master da Loja
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Usada em operações sensíveis (como cancelamentos de entradas).
                                    </p>
                                </div>
                                <form onSubmit={handleMasterPasswordReset} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            Senha do Usuário
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showMasterPassword.login ? 'text' : 'password'}
                                                value={masterPasswordData.loginPassword}
                                                onChange={e =>
                                                    setMasterPasswordData({
                                                        ...masterPasswordData,
                                                        loginPassword: e.target.value
                                                    })
                                                }
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 text-sm"
                                                placeholder="Digite sua senha de login"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowMasterPassword(prev => ({ ...prev, login: !prev.login }))
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                            >
                                                {showMasterPassword.login ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            Nova Senha Master
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showMasterPassword.newMaster ? 'text' : 'password'}
                                                value={masterPasswordData.newMaster}
                                                onChange={e =>
                                                    setMasterPasswordData({
                                                        ...masterPasswordData,
                                                        newMaster: e.target.value
                                                    })
                                                }
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 text-sm"
                                                placeholder="Mínimo 6 caracteres"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowMasterPassword(prev => ({
                                                        ...prev,
                                                        newMaster: !prev.newMaster
                                                    }))
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                            >
                                                {showMasterPassword.newMaster ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            Confirmar Nova Senha Master
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showMasterPassword.confirmMaster ? 'text' : 'password'}
                                                value={masterPasswordData.confirmMaster}
                                                onChange={e =>
                                                    setMasterPasswordData({
                                                        ...masterPasswordData,
                                                        confirmMaster: e.target.value
                                                    })
                                                }
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 text-sm"
                                                placeholder="Repita a nova senha"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowMasterPassword(prev => ({
                                                        ...prev,
                                                        confirmMaster: !prev.confirmMaster
                                                    }))
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                            >
                                                {showMasterPassword.confirmMaster ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={
                                                saving ||
                                                !masterPasswordData.loginPassword.trim() ||
                                                !masterPasswordData.newMaster.trim() ||
                                                !masterPasswordData.confirmMaster.trim()
                                            }
                                            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-bold transition disabled:opacity-50 text-sm"
                                        >
                                            {saving ? <Loader size={16} className="animate-spin" /> : <Lock size={16} />}
                                            Redefinir Master
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Configurações Avançadas de Token */}
                        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 p-6 rounded-xl">
                            <div className="flex flex-col md:flex-row md:items-start gap-4">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 shrink-0 w-fit">
                                    <Settings size={24} />
                                </div>
                                <div className="flex-1 w-full">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                                        Configurações do Token de Ação Sensível
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                                        Ajuste o tempo de expiração e o número máximo de tentativas do token usado em ações sensíveis da loja.
                                        As alterações exigem o PIN de segurança.
                                    </p>

                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                â³ Tempo de expiração do token
                                            </label>
                                            <span className="text-sm font-mono bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full text-purple-800 dark:text-purple-300">
                                                {tokenExpiry} segundos
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="15"
                                            max="60"
                                            step="1"
                                            value={tokenExpiry}
                                            onChange={(e) => setTokenExpiry(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span>15s</span>
                                            <span>15s (padrão)</span>
                                            <span>60s</span>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                ðŸ” Máximo de tentativas por token
                                            </label>
                                            <span className="text-sm font-mono bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full text-purple-800 dark:text-purple-300">
                                                {maxAttempts} {maxAttempts === 1 ? 'tentativa' : 'tentativas'}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="3"
                                            max="7"
                                            step="1"
                                            value={maxAttempts}
                                            onChange={(e) => setMaxAttempts(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span>3</span>
                                            <span>5</span>
                                            <span>7</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-purple-200 gap-3 dark:border-purple-800/30 flex justify-end">
                                        {!hasPin && (
                                            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                                                Configure o PIN de segurança antes de alterar as configurações avançadas.
                                            </div>
                                        )}
                                        {!canManageSecurity && (
                                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                                Você não tem permissão para alterar configurações de segurança.
                                            </div>
                                        )}
                                        <button
                                            onClick={handleAdvancedSave}
                                            disabled={saving || !hasPin || !canManageSecurity}
                                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Save size={18} />
                                            {saving ? 'Salvando...' : 'Salvar configurações'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FUNÇÕES PERSONALIZADAS */}
                    <div className={activeTab === 'custom_roles' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                    Funções personalizadas
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Crie cargos que herdam de um papel base e ajustam permissões específicas.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={openNewCustomRoleForm}
                                disabled={!canManageSecurity}
                                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus size={16} />
                                Nova função
                            </button>
                        </div>

                        {customRolesLoading ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700">
                                <Loader className="animate-spin text-brand-green" />
                            </div>
                        ) : customRoles.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
                                <Shield className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                                <p className="font-bold text-gray-700 dark:text-gray-200">
                                    Nenhuma função personalizada criada
                                </p>
                                <p className="text-sm text-gray-500">
                                    Crie funções como Supervisor de Estoque, Auxiliar de Compras ou Gerente Financeiro.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {customRoles.map((role) => (
                                    <div
                                        key={role.id}
                                        className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="font-black text-gray-900 dark:text-white">
                                                        {role.name}
                                                    </h4>

                                                    <span
                                                        className={`rounded-full px-2 py-1 text-xs font-bold ${role.active
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
                                                            }`}
                                                    >
                                                        {role.active ? 'Ativa' : 'Inativa'}
                                                    </span>
                                                </div>

                                                <p className="mt-1 text-sm font-bold text-brand-green">
                                                    Base: {formatSecurityRole(role.base_role)}
                                                </p>

                                                {role.description && (
                                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                        {role.description}
                                                    </p>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => openEditCustomRoleForm(role)}
                                                disabled={!canManageSecurity}
                                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                                            >
                                                Editar
                                            </button>
                                        </div>

                                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                            <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/40">
                                                <p className="text-xs text-gray-400">Liberadas</p>
                                                <p className="font-black text-green-600">
                                                    {Object.values(role.permissions ?? {}).filter(Boolean).length}
                                                </p>
                                            </div>

                                            <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/40">
                                                <p className="text-xs text-gray-400">Bloqueadas</p>
                                                <p className="font-black text-red-500">
                                                    {Object.values(role.permissions ?? {}).filter((value) => value === false).length}
                                                </p>
                                            </div>

                                            <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/40">
                                                <p className="text-xs text-gray-400">Ajustes</p>
                                                <p className="font-black text-gray-700 dark:text-gray-200">
                                                    {Object.keys(role.permissions ?? {}).length}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {customRoleForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                                    {customRoleForm.id ? 'Editar função personalizada' : 'Nova função personalizada'}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Defina um papel base e ajuste permissões específicas deste cargo.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setCustomRoleForm(null)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                    Nome da função
                                </span>
                                <input
                                    value={customRoleForm.name}
                                    onChange={(event) =>
                                        setCustomRoleForm((current) =>
                                            current ? { ...current, name: event.target.value } : current
                                        )
                                    }
                                    placeholder="Ex.: Supervisor de Estoque"
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                    Papel base
                                </span>
                                <select
                                    value={customRoleForm.base_role}
                                    onChange={(event) =>
                                        setCustomRoleForm((current) =>
                                            current ? { ...current, base_role: event.target.value } : current
                                        )
                                    }
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                >
                                    {ROLE_OPTIONS.filter((role) => role.value !== 'owner').map((role) => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block md:col-span-2">
                                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                    Descrição
                                </span>
                                <textarea
                                    value={customRoleForm.description}
                                    onChange={(event) =>
                                        setCustomRoleForm((current) =>
                                            current ? { ...current, description: event.target.value } : current
                                        )
                                    }
                                    rows={3}
                                    placeholder="Explique quando este cargo deve ser usado."
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </label>

                            <label className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
                                <input
                                    type="checkbox"
                                    checked={customRoleForm.active}
                                    onChange={(event) =>
                                        setCustomRoleForm((current) =>
                                            current ? { ...current, active: event.target.checked } : current
                                        )
                                    }
                                />
                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                    Função ativa
                                </span>
                            </label>
                        </div>

                        <div className="mt-6">
                            <h4 className="mb-2 font-black text-gray-900 dark:text-white">
                                Ajustes de permissões
                            </h4>
                            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                                â€œHerdarâ€ usa o papel base. â€œLiberarâ€ e â€œBloquearâ€ sobrescrevem apenas nesta função personalizada.
                            </p>

                            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
                                        <tr>
                                            <th className="p-3">Permissão</th>
                                            <th className="p-3">Risco</th>
                                            <th className="p-3">Ajuste da função</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {permissionMatrix.map((permission) => {
                                            const value = customRoleForm.permissions?.[permission.permission_code];

                                            return (
                                                <tr key={permission.permission_code}>
                                                    <td className="p-3">
                                                        <div className="font-bold text-gray-800 dark:text-white">
                                                            {permission.label}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {formatPermissionModule(permission.module)} · {formatPermissionAction(permission.action)} · {permission.permission_code}
                                                        </div>
                                                    </td>

                                                    <td className="p-3">
                                                        {renderRiskBadge(permission.risk_level)}
                                                    </td>

                                                    <td className="p-3">
                                                        <select
                                                            value={
                                                                value === true
                                                                    ? 'allow'
                                                                    : value === false
                                                                        ? 'deny'
                                                                        : 'inherit'
                                                            }
                                                            onChange={(event) => {
                                                                const next = event.target.value;

                                                                handleToggleCustomRolePermission(
                                                                    permission.permission_code,
                                                                    next === 'inherit'
                                                                        ? null
                                                                        : next === 'allow'
                                                                );
                                                            }}
                                                            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                        >
                                                            <option value="inherit">Herdar do papel base</option>
                                                            <option value="allow">Liberar nesta função</option>
                                                            <option value="deny">Bloquear nesta função</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setCustomRoleForm(null)}
                                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveCustomRole}
                                disabled={customRolesSaving}
                                className="rounded-xl bg-brand-green px-4 py-2 text-sm font-bold text-white hover:bg-brand-green/90 disabled:opacity-50"
                            >
                                {customRolesSaving ? 'Salvando...' : 'Salvar função'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );

    function InfoLine({ label, value }: { label: string; value: string }) {
        return (
            <div className="flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/40 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    {label}
                </span>
                <span className="break-all text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {value}
                </span>
            </div>
        );
    }
}
