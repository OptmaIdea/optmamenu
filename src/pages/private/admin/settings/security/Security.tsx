import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import PageContainer from '@/components/common/PageContainer';

import { timezoneUtils } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import {
    Lock, History, Key, AlertCircle, CheckCircle, Save, Loader,
    RefreshCw, Smartphone, Eye, EyeOff, Settings, Filter,
    ShieldCheck, User, Store, BadgeCheck, Shield, X, Plus, Check, Search, Clock,
    ChevronDown, ChevronUp, Grid3X3
} from 'lucide-react';
import type { SecurityLog } from '@/types';
import type { StorePermissionMatrixRow, StoreCustomRole } from '@/types/security';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { hasEffectivePermission } from '@/utils/permissions';
import { resolveActiveMembership, getActiveStoreId } from '@/utils/activeStore';
import { useSecurityPermissionsAdmin } from '@/hooks/security/useSecurityPermissionsAdmin';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { useStoreCustomRoles } from '@/hooks/security/useStoreCustomRoles';
import { notifyPermissionsChanged } from '@/utils/permissionEvents';

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

function normalizeRoleCode(role: string) {
    const normalized = String(role || '').trim().toLowerCase();

    const map: Record<string, string> = {
        proprietario: 'owner',
        administrador: 'admin',
        gerente: 'manager',
        estoque: 'stock_operator',
        'operador de estoque': 'stock_operator',
        caixa: 'cashier',
        vendas: 'sales',
        equipe: 'staff',
        visualizador: 'viewer',
    };

    return map[normalized] ?? normalized;
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
    if (!action) return 'Ação';
    const labels: Record<string, string> = {
        view: 'Visualizar',
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

        profile_requests_view: 'Ver solicitações cadastrais',
        profile_requests_review: 'Analisar solicitações cadastrais',
        profile_requests_manage: 'Gerenciar solicitações cadastrais',

        owner_view: 'Ver dados do proprietário',
        owner_manage: 'Gerenciar dados do proprietário',
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
        session_disconnected: 'Usuário desconectado',
        session_login_test: 'Teste de login/sessão',
    };

    if (!action) return 'Ação não identificada';

    return labels[action] ?? action
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

const ACTION_LABELS: Record<string, string> = {
    session_store_selected: 'Loja acessada',
    session_disconnected: 'Sessão encerrada',
    session_login: 'Login realizado',
    login: 'Login realizado',
    logout: 'Logout realizado',
    idle_timeout: 'Sessão encerrada por inatividade',
    store_idle_timeout_settings_updated: 'Configuração de inatividade alterada',
    store_role_permission_template_updated: 'Permissão por papel alterada',
    role_permission_updated: 'Permissão por papel alterada',
};

const SECURITY_ACTION_LABELS: Record<string, string> = {
    store_role_permissions_bulk_updated: 'Permissões por papel atualizadas',
    store_role_permission_updated: 'Permissão por papel atualizada',
    member_permissions_updated: 'Permissões do usuário atualizadas',
    custom_role_created: 'Função personalizada criada',
    custom_role_updated: 'Função personalizada atualizada',
    custom_role_deactivated: 'Função personalizada desativada',
};

function formatSecurityDetail(detail?: string | null) {
    if (!detail) return '';

    return detail
        .replace('Acesso bloqueado para', 'Acesso bloqueado:')
        .replace('Acesso liberado para', 'Acesso liberado:')
        .replace('dashboard.view', 'Dashboard')
        .replace('dashboard.activity.view', 'Atividades recentes')
        .replace('dashboard.alerts.view', 'Alertas')
        .replace('commercial.dashboard.view', 'Dashboard comercial')
        .replace('settings.hours.view', 'Horários')
        .replace('security.view', 'Senhas e Acesso')
        .replace('security.logs.view', 'Histórico de atividades')
        .replace('security.context.view', 'Contexto de acesso');
}

function getActionLabel(action: string | null | undefined): string {
    if (!action) return 'Ação desconhecida';
    return ACTION_LABELS[action] ?? SECURITY_ACTION_LABELS[action] ?? formatSecurityLogAction(action);
}

function getDisplayAction(item: { action?: string | null; display_action?: string | null }) {
    if (
        item.display_action &&
        item.display_action !== item.action &&
        !item.display_action.includes('_')
    ) {
        return item.display_action;
    }

    return getActionLabel(item.action || '');
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

        'users.profile_requests.view': 'Usuários · Ver solicitações cadastrais',
        'users.profile_requests.review': 'Usuários · Analisar solicitações cadastrais',
        'users.profile_requests.manage': 'Usuários · Gerenciar solicitações cadastrais',

        'security.sessions.view': 'Segurança · Ver sessões e inatividade',
        'security.sessions.manage': 'Segurança · Gerenciar sessões e inatividade',
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

    if (log.action === 'session_disconnected') {
        const reason = getStringDetail(details, 'reason');
        return reason || 'Conexão encerrada automaticamente.';
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



export type PermissionMacroGroup = 'settings' | 'security' | 'operational';

export type PermissionGroupDefinition = {
    id: string;
    macroGroup: PermissionMacroGroup;
    label: string;
    description: string;
    icon?: React.ElementType;
    prefixes: string[];
};

export const PERMISSION_GROUP_DEFINITIONS: PermissionGroupDefinition[] = [
    // CONFIGURAÇÕES
    {
        id: 'settings_general',
        macroGroup: 'settings',
        label: 'Acesso geral',
        description: 'Primeiro libere o acesso geral às configurações. Depois escolha as abas e ações.',
        prefixes: ['settings.view', 'settings.manage'],
    },
    {
        id: 'settings_store',
        macroGroup: 'settings',
        label: 'Dados da Loja',
        description: 'Dados cadastrais, endereço, contatos e identidade visual da loja.',
        prefixes: ['settings.store.'],
    },
    {
        id: 'settings_commercial',
        macroGroup: 'settings',
        label: 'Comercial',
        description: 'Regras comerciais, canais e preferências comerciais.',
        prefixes: ['settings.commercial.'],
    },
    {
        id: 'settings_orders',
        macroGroup: 'settings',
        label: 'Pedido Online',
        description: 'Loja pública, pedido mínimo, canais e regras de pedido.',
        prefixes: ['settings.orders.'],
    },
    {
        id: 'settings_appearance',
        macroGroup: 'settings',
        label: 'Aparência da Loja',
        description: 'Cores, logo, banner, textos institucionais, contatos públicos e redes sociais da loja pública.',
        prefixes: ['settings.appearance.'],
    },
    {
        id: 'settings_hours',
        macroGroup: 'settings',
        label: 'Horários',
        description: 'Configuração dos horários de funcionamento da loja.',
        prefixes: ['settings.hours.'],
    },
    {
        id: 'settings_stock',
        macroGroup: 'settings',
        label: 'Estoque',
        description: 'Regras de estoque global, mínimo, máximo e distribuição por locais.',
        prefixes: ['settings.stock.'],
    },
    {
        id: 'settings_delivery',
        macroGroup: 'settings',
        label: 'Entrega',
        description: 'Formas, taxas e regras de entrega.',
        prefixes: ['settings.delivery.'],
    },
    {
        id: 'settings_payment',
        macroGroup: 'settings',
        label: 'Pagamento',
        description: 'Formas e regras de pagamento.',
        prefixes: ['settings.payment.'],
    },
    {
        id: 'settings_messages',
        macroGroup: 'settings',
        label: 'Mensagens',
        description: 'Configurações de mensagens, modelos, canais e preferências de comunicação.',
        prefixes: ['settings.messages.'],
    },
    {
        id: 'settings_legal',
        macroGroup: 'settings',
        label: 'Documentos e Termos',
        description: 'Termos de uso, política de privacidade, cookies e dados de DPO.',
        prefixes: ['settings.legal.'],
    },
    {
        id: 'settings_system',
        macroGroup: 'settings',
        label: 'Sistema',
        description: 'Configurações técnicas e avançadas.',
        prefixes: ['settings.system.'],
    },

    // SEGURAN!A
    {
        id: 'security_general',
        macroGroup: 'security',
        label: 'Senhas e Acesso',
        description: 'Controla o acesso geral ao módulo de Segurança. Sem esta permissão, nenhuma aba de segurança pode ser acessada.',
        prefixes: ['security.view'],
    },
    {
        id: 'security_context',
        macroGroup: 'security',
        label: 'Contexto de acesso',
        description: 'Informações do vínculo, loja ativa, perfil e contexto de acesso.',
        prefixes: ['security.context.'],
    },
    {
        id: 'security_logs',
        macroGroup: 'security',
        label: 'Histórico de atividades',
        description: 'Logs gerais de auditoria e segurança da loja.',
        prefixes: ['security.logs.'],
    },
    {
        id: 'security_roles',
        macroGroup: 'security',
        label: 'Permissões por papel',
        description: 'Matriz padrão de permissões dos papéis/cargos.',
        prefixes: ['security.roles.'],
    },
    {
        id: 'security_custom_roles',
        macroGroup: 'security',
        label: 'Funções personalizadas',
        description: 'Criação e manutenção de funções personalizadas.',
        prefixes: ['security.custom_roles.'],
    },
    {
        id: 'security_user_permissions',
        macroGroup: 'security',
        label: 'Permissões por usuário',
        description: 'Exceções individuais aplicadas a membros específicos.',
        prefixes: ['security.user_permissions.'],
    },
    {
        id: 'security_sensitive_actions',
        macroGroup: 'security',
        label: 'Ações sensíveis',
        description: 'Regras para ações que exigem PIN, senha master, token ou aprovação.',
        prefixes: ['security.sensitive_actions.'],
    },
    {
        id: 'security_pin_token',
        macroGroup: 'security',
        label: 'PIN e Token',
        description: 'Configurações de PIN, token e limites de tentativa.',
        prefixes: ['security.pin_token.'],
    },
    {
        id: 'security_sessions',
        macroGroup: 'security',
        label: 'Sessões e inatividade',
        description: 'Tempo ocioso, encerramento automático e sessões.',
        prefixes: ['security.sessions.'],
    },

    // OPERACIONAL
    {
        id: 'dashboard',
        macroGroup: 'operational',
        label: 'Dashboard',
        description: 'Painéis e visão geral da operação.',
        prefixes: ['dashboard.'],
    },
    {
        id: 'commercial',
        macroGroup: 'operational',
        label: 'Comercial',
        description: 'Área comercial, pedidos, clientes, fidelidade e campanhas.',
        prefixes: ['commercial.', 'orders.', 'customers.', 'loyalty.', 'marketing.'],
    },
    {
        id: 'financial',
        macroGroup: 'operational',
        label: 'Financeiro',
        description: 'Livro diário, pagamentos e movimentações financeiras.',
        prefixes: ['financial.', 'cashbook.'],
    },
    {
        id: 'products',
        macroGroup: 'operational',
        label: 'Produtos e Estoque',
        description: 'Produtos, categorias, estoque, compras, transferências e fornecedores.',
        prefixes: ['products.', 'categories.', 'stock.', 'purchases.', 'transfers.', 'suppliers.'],
    },
    {
        id: 'users',
        macroGroup: 'operational',
        label: 'Usuários e Equipe',
        description: 'Usuários, membros, vínculos e gestão da equipe.',
        prefixes: ['users.'],
    },
    {
        id: 'support',
        macroGroup: 'operational',
        label: 'Suporte',
        description: 'Termos legais, FAQ, documentação e conteúdos de apoio.',
        prefixes: ['support.'],
    },
    {
        id: 'reports',
        macroGroup: 'operational',
        label: 'Relatórios',
        description: 'Relatórios, exportações e análises.',
        prefixes: ['reports.'],
    },
];

export const PERMISSION_MACRO_GROUPS: Record<
    PermissionMacroGroup,
    {
        label: string;
        description: string;
    }
> = {
    settings: {
        label: 'Configurações',
        description: 'Dados da loja, regras comerciais, pedido online, entrega, pagamento e sistema.',
    },
    security: {
        label: 'Segurança',
        description: 'Senhas, acesso, logs, permissões, PIN, token e ações sensíveis.',
    },
    operational: {
        label: 'Operacional',
        description: 'Dashboard, comercial, financeiro, produtos, estoque, usuários, suporte e relatórios.',
    },
};

export function getPermissionGroupDefinition(permissionCode: string) {
    const code = String(permissionCode || '');

    const exactMatch = PERMISSION_GROUP_DEFINITIONS.find((group) =>
        group.prefixes.some((prefix) => prefix === code)
    );

    if (exactMatch) return exactMatch;

    const prefixMatch = PERMISSION_GROUP_DEFINITIONS.find((group) =>
        group.prefixes.some((prefix) => {
            if (prefix.endsWith('.')) {
                return code.startsWith(prefix);
            }

            return code === prefix;
        })
    );

    if (prefixMatch) return prefixMatch;

    return {
        id: 'operational_other',
        macroGroup: 'operational' as const,
        label: 'Outros módulos',
        description: 'Permissões operacionais ainda não classificadas.',
        prefixes: [],
    };
}

export type PermissionMatrixItem = StorePermissionMatrixRow;

export function getGroupedRolePermissions(permissionMatrix: PermissionMatrixItem[]) {
    const macroGroups = new Map<
        PermissionMacroGroup,
        Map<string, {
            definition: PermissionGroupDefinition;
            permissions: PermissionMatrixItem[];
        }>
    >();

    permissionMatrix.forEach((permission) => {
        const definition = getPermissionGroupDefinition(permission.permission_code);
        const macroGroup = definition.macroGroup;

        if (!macroGroups.has(macroGroup)) {
            macroGroups.set(macroGroup, new Map());
        }

        const groupMap = macroGroups.get(macroGroup)!;

        if (!groupMap.has(definition.id)) {
            groupMap.set(definition.id, {
                definition,
                permissions: [],
            });
        }

        groupMap.get(definition.id)!.permissions.push(permission);
    });

    const macroOrder: PermissionMacroGroup[] = ['settings', 'security', 'operational'];

    return macroOrder
        .map((macroGroup) => {
            const groupMap = macroGroups.get(macroGroup);

            const groups = Array.from(groupMap?.values() ?? [])
                .map((group) => ({
                    ...group,
                    permissions: group.permissions.sort((a, b) => {
                        const aLabel = String(a.label ?? a.permission_code);
                        const bLabel = String(b.label ?? b.permission_code);

                        return aLabel.localeCompare(bLabel, 'pt-BR', {
                            sensitivity: 'base',
                            numeric: true,
                        });
                    }),
                }))
                .sort((a, b) => {
                    if (a.definition.id === 'settings_general' || a.definition.id === 'security_general') return -1;
                    if (b.definition.id === 'settings_general' || b.definition.id === 'security_general') return 1;

                    return String(a.definition.label).localeCompare(
                        String(b.definition.label),
                        'pt-BR',
                        { sensitivity: 'base', numeric: true }
                    );
                });

            return {
                id: macroGroup,
                ...PERMISSION_MACRO_GROUPS[macroGroup],
                groups,
            };
        })
        .filter((macroGroup) => macroGroup.groups.length > 0);
}

export function getPermissionSection(permissionCode: string) {
    const parts = String(permissionCode || '').split('.');

    if (parts.length >= 3) {
        return parts[1];
    }

    return 'root';
}

export function getRoleAllowedFromPermission(
    permission: PermissionMatrixItem,
    role: string
) {
    const normalizedRole = normalizeRoleCode(role);

    if (normalizedRole === 'owner') return true;

    const column = `${normalizedRole}_allowed` as keyof PermissionMatrixItem;

    return Boolean(permission[column]);
}

export function getRolePermissionAllowed(
    permissionMatrix: PermissionMatrixItem[],
    role: string,
    permissionCode: string
) {
    const normalizedRole = normalizeRoleCode(role);

    if (normalizedRole === 'owner') return true;

    const row = permissionMatrix.find(
        (item) => item.permission_code === permissionCode
    );

    if (!row) return false;

    return getRoleAllowedFromPermission(row, normalizedRole);
}

export function getPermissionActionLabel(permission: PermissionMatrixItem) {
    const code = permission.permission_code;

    if (code.endsWith('.view')) return 'Visualizar';
    if (code.endsWith('.manage')) return 'Gerenciar';
    if (code.endsWith('.create')) return 'Criar';
    if (code.endsWith('.confirm')) return 'Confirmar';
    if (code.endsWith('.cancel')) return 'Cancelar';
    if (code.endsWith('.adjust')) return 'Ajustar';
    if (code.endsWith('.export')) return 'Exportar';

    return permission.label ?? code;
}

export function groupPermissionsByItem(permissions: PermissionMatrixItem[]) {
    const map = new Map<
        string,
        {
            itemKey: string;
            itemLabel: string;
            permissions: PermissionMatrixItem[];
        }
    >();

    permissions.forEach((permission) => {
        const itemKey =
            permission.item_key ||
            permission.module ||
            permission.permission_code.split('.')[0];

        const itemLabel =
            permission.item_label ||
            permission.label ||
            itemKey;

        if (!map.has(itemKey)) {
            map.set(itemKey, {
                itemKey,
                itemLabel,
                permissions: [],
            });
        }

        map.get(itemKey)!.permissions.push(permission);
    });

    return Array.from(map.values()).map((item) => ({
        ...item,
        permissions: item.permissions.sort((a, b) => {
            const order = ['access', 'view', 'manage', 'create', 'confirm', 'cancel', 'adjust', 'export'];

            return (
                order.indexOf(a.action_key || '') -
                order.indexOf(b.action_key || '')
            );
        }),
    }));
}

interface PermissionRoleGroupCardProps {
    group: {
        definition: PermissionGroupDefinition;
        permissions: PermissionMatrixItem[];
    };
    selectedRoleFilter: string;
    onTogglePermission: (permissionCode: string, role: string, currentAllowed: boolean) => void;
    canToggleRolePermission: (role: string, permissionCode: string) => boolean;
}

export function PermissionRoleGroupCard({
    group,
    selectedRoleFilter,
    onTogglePermission,
    canToggleRolePermission,
}: PermissionRoleGroupCardProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const definition = group.definition;

    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-start h-fit">
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="cursor-pointer flex items-start justify-between gap-4 select-none"
            >
                <div>
                    <h5 className="font-bold text-gray-805 dark:text-white text-base">
                        {definition.label}
                    </h5>
                    {definition.description && !isCollapsed && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {definition.description}
                        </p>
                    )}
                </div>
                <span className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </span>
            </div>

            {!isCollapsed && (
                <div className="space-y-3 pt-3 mt-3 border-t border-gray-50 dark:border-gray-700/50">
                    {group.permissions.map((permission) => {
                        const code = permission.permission_code;
                        const allowed = selectedRoleFilter === 'owner' ? true : Boolean(permission[`${selectedRoleFilter}_allowed` as keyof PermissionMatrixItem]);
                        const canToggle = canToggleRolePermission(selectedRoleFilter, code);
                        const disabled = !canToggle;

                        return (
                            <div key={code} className="flex items-center justify-between py-1.5 border-b border-dashed border-gray-50 dark:border-gray-700 last:border-b-0">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-bold ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                                            {getPermissionActionLabel(permission)}
                                        </span>
                                        {permission.risk_level && renderRiskBadge(permission.risk_level)}
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {code}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => onTogglePermission(code, selectedRoleFilter, allowed)}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-sm ${allowed
                                        ? 'border-green-250 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                                        : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-850 dark:text-gray-500'
                                        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                >
                                    {allowed ? (
                                        <>
                                            <Check size={14} className="text-green-600" />
                                            <span>permitido</span>
                                        </>
                                    ) : (
                                        <>
                                            <X size={14} className="text-red-500" />
                                            <span>bloqueado</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const VALID_TAB_IDS = [
    'context',
    'logs',
    'roles',
    'custom_roles',
    'user_permissions',
    'sensitive_actions',
    'pin_token',
    'session_inactive',
];

const securityTabPermissions = {
    context: {
        view: ['security.context.view'],
        manage: ['security.context.manage'],
    },
    logs: {
        view: ['security.logs.view'],
        manage: ['security.logs.manage'],
    },
    roles: {
        view: ['security.roles.view'],
        manage: ['security.roles.manage'],
    },
    custom_roles: {
        view: ['security.custom_roles.view'],
        manage: ['security.custom_roles.manage'],
    },
    user_permissions: {
        view: ['security.user_permissions.view'],
        manage: ['security.user_permissions.manage'],
    },
    sensitive_actions: {
        view: ['security.sensitive_actions.view'],
        manage: ['security.sensitive_actions.manage'],
    },
    pin_token: {
        view: ['security.pin_token.view'],
        manage: ['security.pin_token.manage'],
    },
    session_inactive: {
        view: ['security.sessions.view'],
        manage: ['security.sessions.manage'],
    },
} as const;


const SENSITIVE_REQUIREMENT_OPTIONS = [
    { value: 'none', label: 'Nenhuma' },
    { value: 'pin', label: 'PIN' },
    { value: 'master_password', label: 'Senha master' },
    { value: 'pin_or_master', label: 'PIN ou senha master' },
    { value: 'owner_approval', label: 'Aprovação do proprietário' },
    { value: 'token', label: 'Token interno' },
    { value: 'pin_and_token', label: 'PIN + token' },
] as const;

export type IndividualPermissionState = 'inherit' | 'allow' | 'deny';

export type RoleCode =
    | 'owner'
    | 'admin'
    | 'manager'
    | 'stock_operator'
    | 'cashier'
    | 'sales'
    | 'staff'
    | 'viewer';

export const ROLE_OPTIONS: Array<{
    code: RoleCode;
    value: RoleCode;
    label: string;
}> = [
        { code: 'owner', value: 'owner', label: 'Proprietário' },
        { code: 'admin', value: 'admin', label: 'Admin' },
        { code: 'manager', value: 'manager', label: 'Gerente' },
        { code: 'stock_operator', value: 'stock_operator', label: 'Estoque' },
        { code: 'cashier', value: 'cashier', label: 'Caixa' },
        { code: 'sales', value: 'sales', label: 'Vendas' },
        { code: 'staff', value: 'staff', label: 'Equipe' },
        { code: 'viewer', value: 'viewer', label: 'Visualizador' },
    ];

export const ROLE_PERMISSION_TREE = [
    {
        id: 'settings',
        label: 'Configurações',
        icon: Settings,
        groups: [
            {
                id: 'settings_general',
                label: 'Geral',
                accessPermission: 'settings.view',
                permissions: ['settings.view', 'settings.manage'],
            },
            {
                id: 'settings_appearance',
                label: 'Aparência da Loja',
                accessPermission: 'settings.appearance.view',
                permissions: [
                    'settings.appearance.view',
                    'settings.appearance.manage',
                ],
            },
            {
                id: 'settings_commercial',
                label: 'Comercial',
                accessPermission: 'settings.commercial.view',
                permissions: ['settings.commercial.view', 'settings.commercial.manage'],
            },
            {
                id: 'settings_store',
                label: 'Dados da Loja',
                accessPermission: 'settings.store.view',
                permissions: ['settings.store.view', 'settings.store.manage'],
            },
            {
                id: 'settings_legal',
                label: 'Documentos e Termos',
                accessPermission: 'settings.legal.view',
                permissions: ['settings.legal.view', 'settings.legal.manage'],
            },
            {
                id: 'settings_delivery',
                label: 'Entrega',
                accessPermission: 'settings.delivery.view',
                permissions: ['settings.delivery.view', 'settings.delivery.manage'],
            },
            {
                id: 'settings_stock',
                label: 'Estoque',
                accessPermission: 'settings.stock.view',
                permissions: ['settings.stock.view', 'settings.stock.manage'],
            },
            {
                id: 'settings_hours',
                label: 'Horários',
                accessPermission: 'settings.hours.view',
                permissions: ['settings.hours.view', 'settings.hours.manage'],
            },
            {
                id: 'settings_messages',
                label: 'Mensagens',
                accessPermission: 'settings.messages.view',
                permissions: [
                    'settings.messages.view',
                    'settings.messages.manage',
                ],
            },
            {
                id: 'settings_payment',
                label: 'Pagamento',
                accessPermission: 'settings.payment.view',
                permissions: ['settings.payment.view', 'settings.payment.manage'],
            },
            {
                id: 'settings_orders',
                label: 'Pedido Online',
                accessPermission: 'settings.orders.view',
                permissions: ['settings.orders.view', 'settings.orders.manage'],
            },
            {
                id: 'settings_system',
                label: 'Sistema',
                accessPermission: 'settings.system.view',
                permissions: ['settings.system.view', 'settings.system.manage'],
            },
        ],
    },

    {
        id: 'security',
        label: 'Segurança',
        icon: Shield,
        groups: [
            {
                id: 'security_general',
                label: 'Senhas e Acesso',
                accessPermission: 'security.view',
                permissions: ['security.view'],
            },
            {
                id: 'security_sensitive_actions',
                label: 'Ações sensíveis',
                accessPermission: 'security.sensitive_actions.view',
                permissions: ['security.sensitive_actions.view', 'security.sensitive_actions.manage'],
            },
            {
                id: 'security_context',
                label: 'Contexto de acesso',
                accessPermission: 'security.context.view',
                permissions: ['security.context.view', 'security.context.manage'],
            },
            {
                id: 'security_custom_roles',
                label: 'Funções personalizadas',
                accessPermission: 'security.custom_roles.view',
                permissions: ['security.custom_roles.view', 'security.custom_roles.manage'],
            },
            {
                id: 'security_logs',
                label: 'Histórico de atividades',
                accessPermission: 'security.logs.view',
                permissions: ['security.logs.view', 'security.logs.manage'],
            },
            {
                id: 'security_roles',
                label: 'Permissões por papel',
                accessPermission: 'security.roles.view',
                permissions: ['security.roles.view', 'security.roles.manage'],
            },
            {
                id: 'security_user_permissions',
                label: 'Permissões por usuário',
                accessPermission: 'security.user_permissions.view',
                permissions: ['security.user_permissions.view', 'security.user_permissions.manage'],
            },
            {
                id: 'security_pin_token',
                label: 'PIN e Token',
                accessPermission: 'security.pin_token.view',
                permissions: ['security.pin_token.view', 'security.pin_token.manage'],
            },
            {
                id: 'security_sessions',
                label: 'Sessões e inatividade',
                accessPermission: 'security.sessions.view',
                permissions: ['security.sessions.view', 'security.sessions.manage'],
            },
        ],
    },

    {
        id: 'operational',
        label: 'Operacional',
        icon: Grid3X3,
        groups: [
            {
                id: 'commercial',
                label: 'Comercial',
                accessPermission: 'commercial.view',
                permissions: [
                    'commercial.view',
                    'orders.view',
                    'orders.manage',
                    'orders.cancel',
                    'customers.view',
                    'customers.manage',
                    'loyalty.view',
                    'loyalty.manage',
                    'marketing.view',
                    'marketing.manage',
                    'messages.view',
                    'messages.manage',
                ],
            },
            {
                id: 'dashboard',
                label: 'Dashboard',
                accessPermission: 'dashboard.view',
                permissions: [
                    'dashboard.view',
                    'dashboard.activity.view',
                    'dashboard.alerts.view',
                    'reports.view',
                    // 'reports.export',
                ],
            },
            {
                id: 'financial',
                label: 'Financeiro',
                accessPermission: 'financial.view',
                permissions: [
                    'financial.view',
                    'financial.manage',
                    'cashbook.view',
                    'cashbook.create',
                    'cashbook.cancel',
                ],
            },
            {
                id: 'products',
                label: 'Produtos e Estoque',
                accessPermission: 'products.manage',
                permissions: [
                    'products.view',
                    'products.manage',
                    'categories.view',
                    'categories.manage',
                    'stock.view',
                    'stock.manage',
                    'stock.adjust',
                    'purchases.view',
                    'purchases.create',
                    'purchases.confirm',
                    'purchases.cancel',
                    'quotes.view',
                    'quotes.manage',
                    'transfers.view',
                    'transfers.create',
                    'transfers.confirm',
                    'transfers.cancel',
                    'suppliers.view',
                    'suppliers.manage',
                ],
            },
            {
                id: 'support',
                label: 'Suporte',
                accessPermission: 'support.view',
                permissions: [
                    'support.view',
                    'support.manage',
                ],
            },
            {
                id: 'users_team',
                label: 'Usuários e Equipe',
                accessPermission: 'users.view',
                permissions: [
                    'users.view',
                    'users.manage',
                    'users.owner.view',
                    'users.sensitive.view',
                    'users.sensitive.manage',
                    'users.additional_info.view',
                    'users.additional_info.manage',
                    'users.additional_info_sensitive.view',
                    'users.additional_info_sensitive.manage',
                    'users.profile_requests.view',
                    'users.profile_requests.review',
                    'users.profile_requests.manage',
                ],
            },
            /*             {
                            id: 'reports',
                            label: 'Relatórios',
                            accessPermission: 'reports.view',
                            permissions: [
                                'reports.view',
                                // 'reports.export',
                            ],
                        }, */
        ],
    },
] as const;

const ROLE_FILTER_OPTIONS = [
    { value: 'all', label: 'Todos os papéis' },
    { value: 'admin', label: 'Administrador' },
    { value: 'manager', label: 'Gerente' },
    { value: 'stock_operator', label: 'Estoque' },
    { value: 'cashier', label: 'Caixa' },
    { value: 'sales', label: 'Vendas' },
    { value: 'staff', label: 'Equipe' },
    { value: 'viewer', label: 'Visualizador' },
];

function AccessDenied({ message }: { message: string }) {
    return (
        <PageContainer
            title="Acesso Restrito"
            subtitle="Verificação de privilégios de segurança"
            category="Segurança"
            icon={<AlertCircle className="text-[#DC2626]" size={28} />}
            flat
        >
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm animate-fadeIn font-candara">
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-full text-red-500 mb-4">
                    <AlertCircle size={48} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    Acesso Restrito
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md">
                    {message}
                </p>
            </div>
        </PageContainer>
    );
}

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
}

function Switch({ checked, onCheckedChange, disabled }: SwitchProps) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation();
                onCheckedChange(!checked);
            }}
            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-205 ease-in-out focus:outline-none ${checked
                ? 'bg-green-600'
                : 'bg-gray-200 dark:bg-gray-700'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-205 ease-in-out ${checked ? 'translate-x-3' : 'translate-x-0'
                    }`}
            />
        </button>
    );
}

export default function Security() {
    const {
        securityContext,
        loading: loadingSecurityContext,
        refresh: refreshSecurityContext,
        isAdminLike,
        hasPin,
    } = useSecurityContext();

    const activeMembership = useMemo(() => {
        const activeStoreId = getActiveStoreId();
        const memberships = securityContext?.memberships ?? [];

        if (activeStoreId) {
            const membershipForActiveStore = memberships.find(
                (membership) => membership.store_id === activeStoreId
            );

            if (membershipForActiveStore) {
                return membershipForActiveStore;
            }
        }

        return resolveActiveMembership(
            securityContext?.memberships,
            securityContext?.primary_membership
        );
    }, [
        securityContext?.memberships,
        securityContext?.primary_membership,
    ]);

    const currentStoreId = activeMembership?.store_id ?? getActiveStoreId();
    const currentStoreName = activeMembership?.store_name ?? 'Loja não selecionada';
    const currentStoreSlug = activeMembership?.store_slug ?? '';
    const currentRole = activeMembership?.role ?? null;
    const isStoreOwner = currentRole === 'owner';
    /* const isOwner = isStoreOwner; */
    const [roleFilter, setRoleFilter] = useState('all');
    const [selectedRole, setSelectedRole] = useState<RoleCode>('admin');
    const [selectedMacroGroup, setSelectedMacroGroup] = useState<'settings' | 'security' | 'operational'>('settings');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('settings_general');

    const [expandedMacroGroups, setExpandedMacroGroups] = useState<Record<string, boolean>>({
        settings: false,
        security: false,
        operational: false,
    });

    useEffect(() => {
        if (roleFilter !== 'all') {
            setSelectedRole(roleFilter as RoleCode);
        }
    }, [roleFilter]);



    const {
        permissions,
        loading: loadingPermissions,
        permissionsByModule,
        allowedPermissions,
        getActionRequirement,
        refresh: refreshPermissions,
    } = usePermissions(currentStoreId);

    const hasPermission = useCallback((key: string) => {
        return hasEffectivePermission(permissions, key);
    }, [permissions]);

    const hasExplicitPermission = useCallback((key: string) => {
        if (isStoreOwner) return true;

        if (Array.isArray(allowedPermissions)) {
            return allowedPermissions.includes(key);
        }

        return false;
    }, [isStoreOwner, allowedPermissions]);

    const canAccessSecurityRoot = isStoreOwner || hasExplicitPermission('security.view');
    const canViewSecurityTab = useCallback((tab: keyof typeof securityTabPermissions) => {
        if (!canAccessSecurityRoot) return false;
        if (isStoreOwner) return true;

        return securityTabPermissions[tab].view.some((permission) =>
            hasExplicitPermission(permission)
        );
    }, [canAccessSecurityRoot, isStoreOwner, hasExplicitPermission]);

    const canManageSecurityTab = useCallback((tab: keyof typeof securityTabPermissions) => {
        if (!canViewSecurityTab(tab)) return false;
        if (isStoreOwner) return true;

        return (
            hasPermission('security.manage') ||
            securityTabPermissions[tab].manage.some((permission) =>
                hasPermission(permission)
            )
        );
    }, [canViewSecurityTab, isStoreOwner, hasPermission]);





    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTabState] = useState(
        tabFromUrl && VALID_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'context'
    );

    const canManageCustomRoles = useMemo(() => canManageSecurityTab('custom_roles'), [canManageSecurityTab]);
    const canManageRoles = useMemo(() => canManageSecurityTab('roles'), [canManageSecurityTab]);
    const canManageUserPermissions = useMemo(() => canManageSecurityTab('user_permissions'), [canManageSecurityTab]);
    const canManageSensitiveActions = useMemo(() => canManageSecurityTab('sensitive_actions'), [canManageSecurityTab]);
    const canManagePinToken = useMemo(() => canManageSecurityTab('pin_token'), [canManageSecurityTab]);
    const canManageSessions = useMemo(() => canManageSecurityTab('session_inactive'), [canManageSecurityTab]);

    const canManageSecurity = useMemo(() => {
        return activeTab ? canManageSecurityTab(activeTab as keyof typeof securityTabPermissions) : false;
    }, [activeTab, canManageSecurityTab]);

    const canViewCustomRoles = useMemo(() => {
        return canViewSecurityTab('custom_roles');
    }, [canViewSecurityTab]);

    const canViewRolesTab = canViewSecurityTab('roles');
    const canViewSensitiveActionsTab = canViewSecurityTab('sensitive_actions');
    const canViewUserPermissionsTab = canViewSecurityTab('user_permissions');

    const isRolesTabActive = activeTab === 'roles';
    const isCustomRolesTabActive = activeTab === 'custom_roles';
    const isSensitiveActionsTabActive = activeTab === 'sensitive_actions';
    const isUserPermissionsTabActive = activeTab === 'user_permissions';

    const {
        permissionMatrix,
        sensitiveActions: sensitiveActionsMatrix,
        memberPermissionDetail,
        membersForPermissions,
        loading: adminLoading,
        error: adminError,
        refresh: refreshAdmin,
        updateRolePermissionsBulk,
        updateSensitiveAction,
        fetchMemberPermissionDetail,
    } = useSecurityPermissionsAdmin({
        enabled:
            (isRolesTabActive && canViewRolesTab) ||
            (isCustomRolesTabActive && canViewCustomRoles) ||
            (isSensitiveActionsTabActive && canViewSensitiveActionsTab) ||
            (isUserPermissionsTabActive && canViewUserPermissionsTab),
        matrix:
            (isRolesTabActive && canViewRolesTab) ||
            (isCustomRolesTabActive && canViewCustomRoles),
        sensitiveActions: isSensitiveActionsTabActive && canViewSensitiveActionsTab,
        members: isUserPermissionsTabActive && canViewUserPermissionsTab,
    });

    const isRoleAllowed = useCallback((role: string, permissionCode: string) => {
        return getRolePermissionAllowed(permissionMatrix, role, permissionCode);
    }, [permissionMatrix]);

    const {
        items: customRolesFromHook,
        loading: customRolesLoading,
        refresh: refreshCustomRoles,
    } = useStoreCustomRoles(canViewCustomRoles);

    const [customRoles, setCustomRoles] = useState<StoreCustomRole[]>([]);
    const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string | null>(null);
    const [selectedCustomRoleGroupId, setSelectedCustomRoleGroupId] = useState<string>('settings_general');

    const [selectedUserGroupId, setSelectedUserGroupId] = useState<string>('settings_general');
    const [selectedUserMacroGroup, setSelectedUserMacroGroup] = useState<'settings' | 'security' | 'operational'>('settings');

    const selectedCustomRole = useMemo(() => {
        return customRoles.find((role) => role.id === selectedCustomRoleId) ?? null;
    }, [customRoles, selectedCustomRoleId]);

    useEffect(() => {
        if (customRolesFromHook) {
            setCustomRoles(customRolesFromHook);
            if (!selectedCustomRoleId && customRolesFromHook.length > 0) {
                setSelectedCustomRoleId(customRolesFromHook[0].id);
            }
        }
    }, [customRolesFromHook]);

    function isCustomRoleAllowed(permissionCode: string) {
        if (!selectedCustomRole) return false;
        return Boolean(selectedCustomRole.permissions?.[permissionCode]);
    }

    /*
    function updateCustomRolePermissionLocal(permissionCode: string, allowed: boolean) {
        if (!selectedCustomRole) return;
        setCustomRoles((current) =>
            current.map((role) => {
                if (role.id !== selectedCustomRole.id) return role;
                return {
                    ...role,
                    permissions: {
                        ...role.permissions,
                        [permissionCode]: allowed,
                    },
                };
            })
        );
    }
    */

    function handleToggleCustomRolePermissionCascade(
        permissionCode: string,
        nextAllowed: boolean,
        currentGroupPermissions: StorePermissionMatrixRow[]
    ) {
        if (!selectedCustomRole) return;
        const changes = buildRolePermissionCascadeChanges(
            permissionCode,
            nextAllowed,
            currentGroupPermissions
        );
        setCustomRoles((current) =>
            current.map((role) => {
                if (role.id !== selectedCustomRole.id) return role;
                const nextPermissions = { ...role.permissions };
                changes.forEach((change) => {
                    nextPermissions[change.permission_code] = change.allowed;
                });
                return {
                    ...role,
                    permissions: nextPermissions,
                };
            })
        );
    }

    function handleToggleCustomRoleMenuAccess(
        group: { permissions: readonly string[] },
        nextAllowed: boolean
    ) {
        if (!selectedCustomRole) return;
        const changes = group.permissions.map((permissionCode) => ({
            permission_code: permissionCode,
            allowed: nextAllowed,
        }));
        setCustomRoles((current) =>
            current.map((role) => {
                if (role.id !== selectedCustomRole.id) return role;
                const nextPermissions = { ...role.permissions };
                changes.forEach((change) => {
                    nextPermissions[change.permission_code] = change.allowed;
                });
                return {
                    ...role,
                    permissions: nextPermissions,
                };
            })
        );
    }

    async function saveSelectedCustomRole(reason?: string) {
        if (!selectedCustomRole) return;
        if (!canManageCustomRoles) {
            toast.error('Você não tem permissão para alterar funções personalizadas.');
            return;
        }
        setSaving(true);
        const { error } = await supabase.rpc('update_store_custom_role', {
            p_custom_role_id: selectedCustomRole.id,
            p_name: selectedCustomRole.name,
            p_description: selectedCustomRole.description || null,
            p_base_role: selectedCustomRole.base_role,
            p_active: selectedCustomRole.active,
            p_permissions: selectedCustomRole.permissions ?? {},
            p_sensitive_actions: selectedCustomRole.sensitive_actions ?? {},
            p_reason: reason ?? 'Atualização de permissões da função personalizada',
        });
        setSaving(false);
        if (error) {
            console.error(error);
            toast.error('Não foi possível salvar a função personalizada.');
            return;
        }
        toast.success('Função personalizada salva com sucesso.');
        notifyPermissionsChanged(currentStoreId, 'custom_role_update');
        await refreshCustomRoles();
    }

    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const setActiveTab = useCallback(
        (next: string) => {
            setActiveTabState(next);
            setSearchParams(
                (prev) => {
                    const params = new URLSearchParams(prev);
                    if (next === 'context') {
                        params.delete('tab');
                    } else {
                        params.set('tab', next);
                    }
                    return params;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );



    const [selectedMemberId, setSelectedMemberId] = useState('');


    const [isCreateCustomRoleOpen, setIsCreateCustomRoleOpen] = useState(false);
    const [newCustomRoleName, setNewCustomRoleName] = useState('');
    const [newCustomRoleDescription, setNewCustomRoleDescription] = useState('');
    const [newCustomRoleBaseRole, setNewCustomRoleBaseRole] = useState<RoleCode>('stock_operator');

    const handleCreateCustomRoleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManageCustomRoles) {
            toast.error('Você não tem permissão para alterar funções personalizadas.');
            return;
        }
        if (!newCustomRoleName.trim()) {
            toast.error('Informe o nome da função.');
            return;
        }
        setSaving(true);
        const { data, error } = await supabase.rpc('create_store_custom_role', {
            p_store_id: currentStoreId,
            p_name: newCustomRoleName.trim(),
            p_description: newCustomRoleDescription.trim() || null,
            p_base_role: newCustomRoleBaseRole,
            p_permissions: null,
            p_sensitive_actions: {},
        });
        setSaving(false);
        if (error) {
            console.error(error);
            toast.error('Não foi possível criar a função personalizada.');
            return;
        }
        toast.success('Função personalizada criada com sucesso.');
        notifyPermissionsChanged(currentStoreId, 'custom_role_update');
        setIsCreateCustomRoleOpen(false);
        setNewCustomRoleName('');
        setNewCustomRoleDescription('');
        setNewCustomRoleBaseRole('stock_operator');

        await refreshCustomRoles();

        const createdRole = Array.isArray(data) ? data[0] : data;
        if (createdRole && createdRole.id) {
            setSelectedCustomRoleId(createdRole.id);
        }
    };
    const [selectedMemberPermissions, setSelectedMemberPermissions] = useState<Record<string, boolean>>({});
    const selectedMember = useMemo(() => {
        return membersForPermissions.find((m) => m.member_id === selectedMemberId) ?? null;
    }, [membersForPermissions, selectedMemberId]);

    const selectableMembers = useMemo(() => {
        return membersForPermissions.filter((member) => member.role !== 'owner');
    }, [membersForPermissions]);

    const [logFilters, setLogFilters] = useState({
        dateFrom: '',
        dateTo: '',
        user: '',
        action: '',
        outcome: ''
    });

    const [permissionSearch, setPermissionSearch] = useState('');
    const [userPermissionSearch, setUserPermissionSearch] = useState('');







    const canToggleRolePermission = useCallback((role: string, permissionCode: string) => {
        const normalizedRole = normalizeRoleCode(role);

        if (normalizedRole === 'owner') return false;

        if (!canManageSecurityTab('roles')) return false;

        // Raiz sempre precisa ser editável para quem gerencia a matriz.
        if (
            permissionCode === 'settings.view' ||
            permissionCode === 'security.view' ||
            permissionCode === 'security.manage'
        ) {
            return true;
        }

        if (permissionCode.startsWith('settings.')) {
            const section = getPermissionSection(permissionCode);

            const rootViewAllowed = getRolePermissionAllowed(
                permissionMatrix,
                normalizedRole,
                'settings.view'
            );

            const sectionViewAllowed = getRolePermissionAllowed(
                permissionMatrix,
                normalizedRole,
                `settings.${section}.view`
            );

            if (!rootViewAllowed) return false;

            if (permissionCode.endsWith('.view')) {
                return true;
            }

            if (permissionCode.endsWith('.manage')) {
                return sectionViewAllowed;
            }
        }

        if (permissionCode.startsWith('security.')) {
            const section = getPermissionSection(permissionCode);

            const rootViewAllowed = getRolePermissionAllowed(permissionMatrix, normalizedRole, 'security.view');
            const rootManageAllowed = getRolePermissionAllowed(permissionMatrix, normalizedRole, 'security.manage');
            const sectionViewAllowed = getRolePermissionAllowed(
                permissionMatrix,
                normalizedRole,
                `security.${section}.view`
            );

            if (!rootViewAllowed) return false;

            if (permissionCode.endsWith('.view')) return true;

            if (permissionCode.endsWith('.manage')) {
                return rootManageAllowed && sectionViewAllowed;
            }
        }

        if (permissionCode.startsWith('messages.')) {
            const rootSettingsViewAllowed = getRolePermissionAllowed(
                permissionMatrix,
                normalizedRole,
                'settings.view'
            );

            const messagesViewAllowed = getRolePermissionAllowed(
                permissionMatrix,
                normalizedRole,
                'messages.view'
            );

            if (!rootSettingsViewAllowed) return false;

            if (permissionCode.endsWith('.view')) {
                return true;
            }

            if (permissionCode.endsWith('.manage')) {
                return messagesViewAllowed;
            }
        }

        // Operacional: regra simples.
        const module = permissionCode.split('.')[0];
        const action = permissionCode.split('.')[1];

        if (action === 'view') return true;

        const moduleViewPermission = `${module}.view`;
        const moduleViewAllowed = getRolePermissionAllowed(
            permissionMatrix,
            normalizedRole,
            moduleViewPermission
        );

        return moduleViewAllowed;
    }, [permissionMatrix, canManageSecurityTab]);





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
    const [idleTimeoutEnabled, setIdleTimeoutEnabled] = useState(true);
    const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(30);

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
            const { data, error } = await supabase.rpc('get_store_security_activity_logs', {
                p_store_id: store.id,
                p_start_date: logFilters.dateFrom || null,
                p_end_date: logFilters.dateTo || null,
                p_user_filter: logFilters.user.trim() || null,
                p_action_filter: logFilters.action.trim() || null,
                p_outcome: logFilters.outcome === 'all' || !logFilters.outcome ? null : logFilters.outcome
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
        if (store?.id && canViewSecurityTab('logs') && activeTab === 'logs') {
            fetchLogs();
        }
    }, [store?.id, canViewSecurityTab, activeTab, fetchLogs]);

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
        if (!canManageSecurityTab('user_permissions')) return;
        if (!selectedMemberId) {
            setSelectedMemberPermissions({});
            return;
        }

        void fetchMemberPermissionDetail(selectedMemberId).then((rows) => {
            const overrides: Record<string, boolean> = {};

            rows.forEach((row) => {
                if (row.override_value !== null) {
                    overrides[row.permission_code] = row.override_value;
                }
            });

            setSelectedMemberPermissions(overrides);
        });
    }, [selectedMemberId, fetchMemberPermissionDetail, canManageSecurityTab]);

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

            const { data: storeConfig, error: storeConfigError } = await supabase
                .from('stores')
                .select('token_expiry_seconds, max_token_attempts')
                .eq('id', activeStoreId)
                .single();

            if (storeConfigError) {
                console.error('Erro ao buscar configurações avançadas da loja:', storeConfigError);
            }

            const { data: idleConfigData, error: idleConfigError } = await supabase.rpc(
                'get_store_security_settings',
                {
                    p_store_id: activeStoreId,
                }
            );

            let idleConfig = null;
            if (idleConfigError) {
                console.error('Erro ao buscar configurações de inatividade:', idleConfigError);
            } else {
                idleConfig = Array.isArray(idleConfigData)
                    ? idleConfigData[0]
                    : idleConfigData;
            }

            if (adminStore) {
                const mergedStore = {
                    ...adminStore,
                    id: adminStore.id || activeStoreId,
                    token_expiry_seconds:
                        storeConfig?.token_expiry_seconds ??
                        adminStore.token_expiry_seconds ??
                        15,
                    max_token_attempts:
                        storeConfig?.max_token_attempts ??
                        adminStore.max_token_attempts ??
                        3,
                    idle_timeout_enabled:
                        idleConfig?.idle_timeout_enabled ??
                        adminStore.idle_timeout_enabled ??
                        true,
                    idle_timeout_minutes:
                        idleConfig?.idle_timeout_minutes ??
                        adminStore.idle_timeout_minutes ??
                        30,
                };

                setStore(mergedStore);
                setTokenExpiry(mergedStore.token_expiry_seconds ?? 15);
                setMaxAttempts(mergedStore.max_token_attempts ?? 3);
                setIdleTimeoutEnabled(mergedStore.idle_timeout_enabled);
                setIdleTimeoutMinutes(mergedStore.idle_timeout_minutes);
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

    const handleSaveIdleTimeout = async () => {
        if (!store?.id) {
            toast.error('Loja ativa não encontrada.');
            return;
        }

        if (!canManageSessions) {
            toast.error('Você não tem permissão para alterar sessões e inatividade.');
            return;
        }

        setSaving(true);
        try {
            const { data, error: updateError } = await supabase.rpc(
                'update_store_idle_timeout_settings',
                {
                    p_store_id: store.id,
                    p_idle_timeout_enabled: idleTimeoutEnabled,
                    p_idle_timeout_minutes: idleTimeoutMinutes,
                }
            );

            if (updateError) throw updateError;

            const updated = Array.isArray(data) ? data[0] : data;

            setIdleTimeoutEnabled(updated?.idle_timeout_enabled ?? idleTimeoutEnabled);
            setIdleTimeoutMinutes(updated?.idle_timeout_minutes ?? idleTimeoutMinutes);

            toast.success('Configuração de sessão atualizada com sucesso.');
            await logAction(
                'store_idle_timeout_settings_updated',
                { enabled: idleTimeoutEnabled, minutes: idleTimeoutMinutes },
                'success'
            );
            await fetchInitialData();
        } catch (err: unknown) {
            console.error(err);
            const errMsg = getErrorMessage(err, 'Erro ao salvar configuração.');
            toast.error('Erro ao salvar: ' + errMsg);
        } finally {
            setSaving(false);
        }
    };

    const tabs = useMemo(() => [
        { id: 'context', label: 'Contexto de acesso', icon: ShieldCheck, canAccess: canViewSecurityTab('context') },
        { id: 'logs', label: 'Histórico de atividades', icon: History, canAccess: canViewSecurityTab('logs') },
        { id: 'roles', label: 'Permissões por papel', icon: BadgeCheck, canAccess: canViewSecurityTab('roles') },
        { id: 'custom_roles', label: 'Funções personalizadas', icon: Shield, canAccess: canViewSecurityTab('custom_roles') },
        { id: 'user_permissions', label: 'Permissões por usuário', icon: User, canAccess: canViewSecurityTab('user_permissions') },
        { id: 'sensitive_actions', label: 'Ações sensíveis', icon: Lock, canAccess: canViewSecurityTab('sensitive_actions') },
        { id: 'pin_token', label: 'PIN e token', icon: Key, canAccess: canViewSecurityTab('pin_token') },
        { id: 'session_inactive', label: 'Sessão e inatividade', icon: Clock, canAccess: canViewSecurityTab('session_inactive') },
    ], [canViewSecurityTab]);

    const allowedTabs = useMemo(() => {
        if (loadingSecurityContext || loadingPermissions) return [];
        if (!canAccessSecurityRoot) return [];

        return tabs.filter((tab) => tab.canAccess);
    }, [
        tabs,
        loadingSecurityContext,
        loadingPermissions,
        canAccessSecurityRoot,
    ]);

    useEffect(() => {
        if (loadingSecurityContext || loadingPermissions) return;

        if (!canAccessSecurityRoot) {
            navigate('/admin/my-profile', { replace: true });
            return;
        }

        const requestedTab =
            tabFromUrl && VALID_TAB_IDS.includes(tabFromUrl)
                ? tabFromUrl
                : null;

        const firstAllowedTab = allowedTabs[0];

        if (!firstAllowedTab) {
            navigate('/admin/my-profile', { replace: true });
            return;
        }

        if (!requestedTab) {
            setActiveTabState(firstAllowedTab.id);
            setSearchParams({ tab: firstAllowedTab.id }, { replace: true });
            return;
        }

        const canOpenRequestedTab = allowedTabs.some((tab) => tab.id === requestedTab);

        if (!canOpenRequestedTab) {
            setActiveTabState(firstAllowedTab.id);
            setSearchParams({ tab: firstAllowedTab.id }, { replace: true });
            return;
        }

        if (requestedTab !== activeTab) {
            setActiveTabState(requestedTab);
        }
    }, [
        loadingSecurityContext,
        loadingPermissions,
        canAccessSecurityRoot,
        tabFromUrl,
        allowedTabs,
        activeTab,
        navigate,
        setSearchParams,
    ]);

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
                const actionValue = `${log.action || ''} ${log.display_action || ''} ${formatSecurityLogAction(log.action)}`.toLowerCase();
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


    function buildRolePermissionCascadeChanges(
        permissionCode: string,
        nextAllowed: boolean,
        currentGroupPermissions: StorePermissionMatrixRow[]
    ) {
        const changes: Array<{
            permission_code: string;
            allowed: boolean;
        }> = [];

        const permission = permissionMatrix.find(
            (item) => item.permission_code === permissionCode
        );

        if (!permission) return changes;

        const isAccessPermission = permission.action_key === 'access';
        const isRootView =
            permissionCode === 'settings.view' ||
            permissionCode === 'security.view';

        const isRootManage =
            permissionCode === 'security.manage';

        changes.push({
            permission_code: permissionCode,
            allowed: nextAllowed,
        });

        // Acessar bloqueado: desliga tudo do grupo.
        if (isAccessPermission && !nextAllowed) {
            currentGroupPermissions.forEach((item) => {
                changes.push({
                    permission_code: item.permission_code,
                    allowed: false,
                });
            });
        }

        // Acessar permitido: liga permissões de visualização/acesso do grupo.
        if (isAccessPermission && nextAllowed) {
            currentGroupPermissions.forEach((item) => {
                if (
                    item.action_key === 'access' ||
                    item.action_key === 'view'
                ) {
                    changes.push({
                        permission_code: item.permission_code,
                        allowed: true,
                    });
                }
            });
        }

        // Ver geral bloqueado: desliga tudo do macrogrupo.
        if (isRootView && !nextAllowed) {
            const isSettingsRoot = permissionCode === 'settings.view';

            permissionMatrix
                .filter((item) =>
                    isSettingsRoot
                        ? item.permission_code.startsWith('settings.') ||
                        item.permission_code.startsWith('messages.')
                        : item.permission_code.startsWith('security.')
                )
                .forEach((item) => {
                    changes.push({
                        permission_code: item.permission_code,
                        allowed: false,
                    });
                });
        }

        // Ver geral permitido: liga todos os views daquele macrogrupo.
        if (isRootView && nextAllowed) {
            const isSettingsRoot = permissionCode === 'settings.view';

            permissionMatrix
                .filter((item) =>
                    (
                        isSettingsRoot
                            ? item.permission_code.startsWith('settings.') ||
                            item.permission_code.startsWith('messages.')
                            : item.permission_code.startsWith('security.')
                    ) &&
                    (item.action_key === 'view' || item.action_key === 'access')
                )
                .forEach((item) => {
                    changes.push({
                        permission_code: item.permission_code,
                        allowed: true,
                    });
                });
        }

        // Gerenciar geral bloqueado: desliga todos os manages do macrogrupo.
        if (isRootManage && !nextAllowed) {
            const prefix = permissionCode.startsWith('settings.')
                ? 'settings.'
                : 'security.';

            permissionMatrix
                .filter((item) =>
                    item.permission_code.startsWith(prefix) &&
                    item.action_key === 'manage'
                )
                .forEach((item) => {
                    changes.push({
                        permission_code: item.permission_code,
                        allowed: false,
                    });
                });
        }

        // Gerenciar geral permitido: liga todos os manages do macrogrupo.
        if (isRootManage && nextAllowed) {
            const prefix = permissionCode.startsWith('settings.')
                ? 'settings.'
                : 'security.';

            permissionMatrix
                .filter((item) =>
                    item.permission_code.startsWith(prefix) &&
                    item.action_key === 'manage'
                )
                .forEach((item) => {
                    changes.push({
                        permission_code: item.permission_code,
                        allowed: true,
                    });
                });
        }

        return Array.from(
            new Map(changes.map((item) => [item.permission_code, item])).values()
        );
    }

    async function handleToggleRolePermissionCascade(
        permissionCode: string,
        nextAllowed: boolean,
        currentGroupPermissions: StorePermissionMatrixRow[]
    ) {
        const normalizedRole = normalizeRoleCode(selectedRole);

        if (!canManageRoles) {
            toast.error('Você não tem permissão para alterar permissões por papel.');
            return;
        }

        if (normalizedRole === 'owner') {
            toast.info('O proprietário sempre possui acesso total.');
            return;
        }

        try {
            const changes = buildRolePermissionCascadeChanges(
                permissionCode,
                nextAllowed,
                currentGroupPermissions
            );

            await updateRolePermissionsBulk({
                role: selectedRole,
                changes,
                reason: `Alteração em cascata da permissão ${permissionCode} para o papel ${formatSecurityRole(selectedRole)} pela tela de segurança.`,
            });

            toast.success('Permissões atualizadas com sucesso.');
            await refreshPermissions();
            await refreshAdmin();
            await fetchLogs();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Erro ao atualizar permissões em lote.'));
        }
    }

    async function handleToggleMenuAccess(
        group: {
            accessPermission: string;
            permissions: readonly string[];
        },
        nextAllowed: boolean
    ) {
        if (!canManageRoles) {
            toast.error('Você não tem permissão para alterar permissões por papel.');
            return;
        }

        const normalizedRole = normalizeRoleCode(selectedRole);
        if (normalizedRole === 'owner') {
            toast.info('O proprietário sempre possui acesso total.');
            return;
        }

        try {
            const changes = group.permissions.map((permissionCode) => ({
                permission_code: permissionCode,
                allowed: nextAllowed,
            }));

            await updateRolePermissionsBulk({
                role: selectedRole,
                changes,
                reason: nextAllowed
                    ? `Acesso liberado para ${group.accessPermission}`
                    : `Acesso bloqueado para ${group.accessPermission}`,
            });

            await refreshPermissions();
            await refreshAdmin();

            toast.success(
                nextAllowed
                    ? 'Acesso liberado com sucesso.'
                    : 'Acesso bloqueado com sucesso.'
            );
            await fetchLogs();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Erro ao atualizar acesso ao menu.'));
        }
    }

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
        if (!canManageSensitiveActions) {
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

    const getIndividualPermissionState = (
        permissions: Record<string, boolean>,
        permissionCode: string
    ): IndividualPermissionState => {
        if (!(permissionCode in permissions)) {
            return 'inherit';
        }
        return permissions[permissionCode] ? 'allow' : 'deny';
    };

    const setIndividualPermissionState = (
        permissionCode: string,
        state: IndividualPermissionState
    ) => {
        setSelectedMemberPermissions((current) => {
            const next = { ...current };

            if (state === 'inherit') {
                delete next[permissionCode];
            } else if (state === 'allow') {
                next[permissionCode] = true;
            } else if (state === 'deny') {
                next[permissionCode] = false;
            }

            return next;
        });
    };

    const getPermissionSourceLabel = (source: string) => {
        switch (source) {
            case 'member_override':
                return 'Exceção individual';
            case 'custom_role':
                return 'Função personalizada';
            case 'role':
                return 'Papel base';
            case 'owner':
                return 'Proprietário';
            default:
                return 'Padrão';
        }
    };

    const saveSelectedMemberPermissions = async () => {
        if (!selectedMember) return;
        if (!canManageUserPermissions) {
            toast.error('Você não tem permissão para alterar permissões por usuário.');
            return;
        }
        setSaving(true);

        const { error } = await supabase.rpc('update_store_member_permissions', {
            p_member_id: selectedMember.member_id,
            p_permissions: selectedMemberPermissions,
            p_sensitive_actions: selectedMember.sensitive_actions ?? {},
            p_reason: 'Atualização de permissões individuais',
        });

        setSaving(false);

        if (error) {
            console.error(error);
            toast.error('Não foi possível salvar as permissões do usuário.');
            return;
        }

        toast.success('Permissões individuais salvas com sucesso.');

        const selectedId = selectedMember.member_id;
        notifyPermissionsChanged(currentStoreId, 'member_permissions_update');
        await refreshAdmin();
        setSelectedMemberId(selectedId);
        await fetchMemberPermissionDetail(selectedId);
        await refreshPermissions();
    };

    // [CORREÇÃO 3] Bloqueia tela apenas no carregamento inicial (loading/loadingPermissions).
    // Refreshes silenciosos (refreshing) não chegam aqui — preservam o conteúdo visível.
    if (loading || loadingPermissions || loadingSecurityContext) {
        return (
            <div className="p-8 flex justify-center">
                <Loader className="animate-spin text-brand-green" />
            </div>
        );
    }

    if (!canAccessSecurityRoot) {
        return (
            <AccessDenied message="Você não tem permissão para acessar Senhas e Acesso." />
        );
    }

    const showInitialMatrixLoading = adminLoading.matrix && permissionMatrix.length === 0;
    const showMatrixRefreshing = adminLoading.matrixRefreshing && permissionMatrix.length > 0;

    return (
        <PageContainer
            title="Senhas e Acesso"
            subtitle="Gerencie as configurações de segurança, PIN, senhas master e permissões da equipe."
            category="Segurança"
            icon={<Shield className="text-[#19A999]" size={28} />}
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
                    {allowedTabs.map(tab => (
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
                                            <InfoLine label="Store ID" value={currentStoreId ? currentStoreId.slice(0, 6) + '••••••••••••' : 'Não definido'} />
                                            <InfoLine label="É proprietário?" value={isStoreOwner ? 'Sim' : 'Não'} />
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
                                                        <p className="font-bold text-gray-700 dark:text-gray-300" title={log.user_email || undefined}>
                                                            {log.user_name || 'Usuário'}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-gray-800 dark:text-gray-200">
                                                    <div className="max-w-xl">
                                                        <p className="font-bold">
                                                            {getDisplayAction(log)}
                                                        </p>

                                                        {formatSecurityLogDetails(log) && (
                                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                                {formatSecurityDetail(formatSecurityLogDetails(log))}
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

                    {/* PERMISS"ES POR PAPEL */}
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
                                {/* Filtro por papel */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        Filtrar papel:
                                    </span>
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white font-bold"
                                    >
                                        {ROLE_FILTER_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar autorização..."
                                        value={permissionSearch}
                                        onChange={(e) => setPermissionSearch(e.target.value)}
                                        className="w-full sm:w-64 rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-900 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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

                        {showInitialMatrixLoading ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700">
                                <Loader className="animate-spin text-brand-green" />
                            </div>
                        ) : permissionMatrix.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl dark:border-gray-700">
                                Nenhuma permissão configurada ou erro na leitura do banco.
                            </div>
                        ) : (
                            <>
                                {showMatrixRefreshing && (
                                    <div className="mb-3 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 animate-pulse">
                                        <Loader size={12} className="animate-spin text-[#19A999]" />
                                        <span>Atualizando permissões em segundo plano...</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                    {/* Painel 1: Grupos de Permissão (Col 4) */}
                                    <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-start min-h-[500px]">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-base font-bold text-gray-800 dark:text-white">
                                                Grupos de Permissões
                                            </h4>
                                        </div>

                                        {/* Busca interna do grupo */}
                                        <div className="relative mb-4">
                                            <input
                                                type="text"
                                                placeholder="Pesquisar permissões..."
                                                value={permissionSearch}
                                                onChange={(e) => setPermissionSearch(e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pl-9 text-xs text-gray-900 outline-none transition focus:border-[#19A999] dark:border-gray-650 dark:bg-gray-900 dark:text-white"
                                            />
                                            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                                            {permissionSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPermissionSearch('')}
                                                    className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500 transition"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Lista de Macro Grupos */}
                                        <div className="space-y-4 overflow-y-auto max-h-[450px] pr-1 scrollbar-thin">
                                            {ROLE_PERMISSION_TREE.map((macro) => {
                                                const isMacroCollapsed = !expandedMacroGroups[macro.id];

                                                // Filtra os grupos baseado na busca
                                                const filteredGroups = macro.groups.filter((g) => {
                                                    if (!permissionSearch.trim()) return true;
                                                    const search = permissionSearch.toLowerCase().trim();
                                                    return (
                                                        g.label.toLowerCase().includes(search) ||
                                                        g.permissions.some((p) => p.toLowerCase().includes(search))
                                                    );
                                                });

                                                if (filteredGroups.length === 0) return null;

                                                return (
                                                    <div key={macro.id} className="space-y-1">
                                                        <div
                                                            onClick={() =>
                                                                setExpandedMacroGroups((prev) => ({
                                                                    ...prev,
                                                                    [macro.id]: !prev[macro.id],
                                                                }))
                                                            }
                                                            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {macro.icon && <macro.icon size={14} />}
                                                                <span>{macro.label}</span>
                                                            </div>
                                                            <span>
                                                                {isMacroCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                                            </span>
                                                        </div>

                                                        {!isMacroCollapsed && (
                                                            <div className="pl-2 space-y-1 mt-1">
                                                                {filteredGroups.map((group) => {
                                                                    const isSelected = selectedGroupId === group.id;

                                                                    // Permissão de Visualização
                                                                    const hasView = group.accessPermission;
                                                                    const viewDisabled = hasView
                                                                        ? !canToggleRolePermission(selectedRole, hasView)
                                                                        : true;

                                                                    return (
                                                                        <div
                                                                            key={group.id}
                                                                            onClick={() => {
                                                                                setSelectedGroupId(group.id);
                                                                                setSelectedMacroGroup(macro.id as any);
                                                                            }}
                                                                            className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${isSelected
                                                                                ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                                                                                : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                                                                }`}
                                                                        >
                                                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-250 truncate pr-2">
                                                                                {group.label}
                                                                            </span>

                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                {hasView && (
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">Acessar</span>
                                                                                        <Switch
                                                                                            checked={isRoleAllowed(selectedRole, group.accessPermission)}
                                                                                            onCheckedChange={(checked) =>
                                                                                                handleToggleMenuAccess(group, checked)
                                                                                            }
                                                                                            disabled={viewDisabled}
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Painel 2: Detalhes do Grupo Selecionado (Col 5) */}
                                    <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-start min-h-[500px]">
                                        {(() => {
                                            const macroDef = ROLE_PERMISSION_TREE.find((m) => m.id === selectedMacroGroup);
                                            const groupDef = macroDef?.groups.find((g) => g.id === selectedGroupId);

                                            if (!groupDef) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center flex-1 text-center p-6 text-gray-400">
                                                        <Grid3X3 size={32} className="mb-2 opacity-50" />
                                                        <p className="text-xs">Selecione um grupo de permissões na coluna à esquerda.</p>
                                                    </div>
                                                );
                                            }

                                            const selectedGroupAccessAllowed = isRoleAllowed(selectedRole, groupDef.accessPermission);

                                            if (!selectedGroupAccessAllowed) {
                                                return (
                                                    <div className="rounded-xl border border-dashed border-gray-250 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center flex-1 text-center">
                                                        <Lock size={32} className="mb-2 opacity-50 text-gray-400" />
                                                        <p>Libere <strong>Acessar</strong> para configurar os itens deste menu.</p>
                                                    </div>
                                                );
                                            }

                                            // Encontra todas as linhas da matriz que pertencem a este grupo selecionado (groupDef.id)
                                            const groupRows = permissionMatrix.filter((row) =>
                                                row.group_key === groupDef.id ||
                                                (groupDef.permissions as readonly string[]).includes(row.permission_code)
                                            );

                                            // Encontra a linha de acesso padrão (action_key === 'access')
                                            const accessRow = groupRows.find((row) => row.action_key === 'access');

                                            // Filtra as linhas detalhadas baseado na busca (se aplicável), desconsiderando a de acesso
                                            const searchFilteredRows = groupRows.filter((row) => {
                                                if (row.action_key === 'access') return false; // Fica fixa no topo se presente
                                                if (!permissionSearch.trim()) return true;
                                                const search = permissionSearch.toLowerCase().trim();

                                                const label = row.label || '';
                                                const itemLabel = row.item_label || '';
                                                const actionLabel = row.action_label || '';
                                                const code = row.permission_code;

                                                return (
                                                    code.toLowerCase().includes(search) ||
                                                    label.toLowerCase().includes(search) ||
                                                    itemLabel.toLowerCase().includes(search) ||
                                                    actionLabel.toLowerCase().includes(search)
                                                );
                                            });

                                            const items = groupPermissionsByItem(searchFilteredRows);

                                            return (
                                                <>
                                                    <div className="border-b pb-3 mb-4">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                            {macroDef?.label}
                                                        </span>
                                                        <h4 className="text-base font-bold text-gray-800 dark:text-white mt-0.5">
                                                            {groupDef.label}
                                                        </h4>
                                                    </div>

                                                    <div className="space-y-4 overflow-y-auto max-h-[420px] pr-1 scrollbar-thin flex-1">
                                                        {/* Item de acesso no topo se presente */}
                                                        {accessRow && (() => {
                                                            const code = accessRow.permission_code;
                                                            const allowed = selectedRole === 'owner' ? true : Boolean(accessRow[`${selectedRole}_allowed` as keyof StorePermissionMatrixRow]);
                                                            const canToggle = canToggleRolePermission(selectedRole, code);
                                                            const disabled = !canToggle;

                                                            return (
                                                                <div className="flex items-center justify-between p-3 rounded-xl bg-green-50/50 dark:bg-green-950/10 border border-green-100/50 dark:border-green-900/20 mb-2">
                                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                                        <span className={`text-xs font-bold ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-green-800 dark:text-green-300'}`}>
                                                                            Acessar {groupDef.label}
                                                                        </span>
                                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate" title={code}>
                                                                            {code}
                                                                        </span>
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        disabled={disabled}
                                                                        onClick={() => handleToggleRolePermissionCascade(code, !allowed, groupRows)}
                                                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-205 ease-in-out focus:outline-none ${allowed
                                                                            ? 'bg-green-600'
                                                                            : 'bg-gray-200 dark:bg-gray-700'
                                                                            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                    >
                                                                        <span
                                                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-205 ease-in-out ${allowed ? 'translate-x-4' : 'translate-x-0'
                                                                                }`}
                                                                        />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })()}

                                                        {items.length === 0 && !accessRow ? (
                                                            <p className="text-xs text-gray-400 text-center py-4">Nenhuma permissão corresponde à busca.</p>
                                                        ) : (
                                                            items.map((item) => {
                                                                return (
                                                                    <div key={item.itemKey} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-2">
                                                                        <h5 className="text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 pb-1">
                                                                            {item.itemLabel}
                                                                        </h5>
                                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                                            {item.permissions.map((row) => {
                                                                                const code = row.permission_code;
                                                                                const columnKey = `${selectedRole}_allowed` as keyof StorePermissionMatrixRow;
                                                                                const allowed = selectedRole === 'owner' ? true : Boolean(row[columnKey]);

                                                                                const matchingViewPermissionCode = code.endsWith('.manage')
                                                                                    ? code.replace(/\.manage$/, '.view')
                                                                                    : null;

                                                                                const matchingViewRow = matchingViewPermissionCode
                                                                                    ? permissionMatrix.find((permission) => permission.permission_code === matchingViewPermissionCode)
                                                                                    : null;

                                                                                const matchingViewAllowed = matchingViewRow
                                                                                    ? selectedRole === 'owner'
                                                                                        ? true
                                                                                        : Boolean(matchingViewRow[columnKey])
                                                                                    : true;

                                                                                const canToggle = canToggleRolePermission(selectedRole, code);
                                                                                const isBaseDisabled = !canToggle;

                                                                                const manageDisabled =
                                                                                    code.endsWith('.manage') &&
                                                                                    !matchingViewAllowed;

                                                                                const disabled = isBaseDisabled || manageDisabled;
                                                                                const actionLabelText = row.action_label || getPermissionActionLabel(row);

                                                                                return (
                                                                                    <button
                                                                                        key={code}
                                                                                        type="button"
                                                                                        disabled={disabled}
                                                                                        onClick={() => handleToggleRolePermissionCascade(code, !allowed, groupRows)}
                                                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition shadow-sm ${allowed
                                                                                            ? 'border-green-250 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                                                                                            : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-850 dark:text-gray-500'
                                                                                            } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                                                                        title={code}
                                                                                    >
                                                                                        {allowed ? (
                                                                                            <Check size={12} className="text-green-600" />
                                                                                        ) : (
                                                                                            <X size={12} className="text-red-500" />
                                                                                        )}
                                                                                        <span>{actionLabelText}</span>
                                                                                        {manageDisabled && !isBaseDisabled && (
                                                                                            <span className="text-[10px] text-amber-500 dark:text-amber-400 italic ml-1">
                                                                                                (Requer "Acessar")
                                                                                            </span>
                                                                                        )}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    {/* Painel 3: Papéis da Equipe (Col 3) */}
                                    <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-between min-h-[500px]">
                                        <div className="space-y-4">
                                            <h4 className="text-base font-bold text-gray-800 dark:text-white">
                                                Papéis / Funções
                                            </h4>

                                            <div className="space-y-2">
                                                {ROLE_OPTIONS.map((role) => {
                                                    const isSelected = selectedRole === role.code;

                                                    // Resolve um ícone simples para o papel
                                                    let RoleIcon = User;
                                                    if (role.code === 'owner') RoleIcon = Shield;
                                                    if (role.code === 'admin') RoleIcon = ShieldCheck;
                                                    if (role.code === 'viewer') RoleIcon = Eye;

                                                    return (
                                                        <div
                                                            key={role.code}
                                                            onClick={() => {
                                                                setSelectedRole(role.code);
                                                                setRoleFilter(role.code);
                                                            }}
                                                            className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${isSelected
                                                                ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-300'
                                                                : 'border-gray-100 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-700 dark:text-gray-300'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <RoleIcon size={16} className={isSelected ? 'text-green-600' : 'text-gray-400'} />
                                                                <span className="text-xs font-bold">
                                                                    {role.label}
                                                                </span>
                                                            </div>
                                                            <Save size={14} className="opacity-0 group-hover:opacity-100 text-gray-400" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Botão de Salvar Alterações visual */}
                                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-4">
                                            <button
                                                type="button"
                                                disabled={adminLoading.saving}
                                                onClick={async () => {
                                                    toast.success('Configurações de permissões salvas com sucesso!');
                                                    await refreshAdmin();
                                                }}
                                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {adminLoading.saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                                                {adminLoading.saving ? 'Salvando...' : 'Salvar Alterações'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* PERMISS"ES POR USUÁRIO */}
                    <div className={activeTab === 'user_permissions' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                    Permissões por usuário
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Configure exceções individuais por colaborador (herdar, permitir ou bloquear).
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Coluna 1: Menus (Macro grupos e grupos) */}
                            <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-start min-h-[500px]">
                                <h4 className="text-base font-bold text-gray-800 dark:text-white mb-4">
                                    Menus
                                </h4>

                                <div className="relative mb-4">
                                    <input
                                        type="text"
                                        placeholder="Pesquisar permissões..."
                                        value={userPermissionSearch}
                                        onChange={(e) => setUserPermissionSearch(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pl-9 text-xs text-gray-900 outline-none transition focus:border-[#19A999] dark:border-gray-650 dark:bg-gray-900 dark:text-white"
                                    />
                                    <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                                    {userPermissionSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setUserPermissionSearch('')}
                                            className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500 transition"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-4 overflow-y-auto max-h-[450px] pr-1 scrollbar-thin">
                                    {ROLE_PERMISSION_TREE.map((macro) => {
                                        const isMacroCollapsed = !expandedMacroGroups[macro.id];

                                        const filteredGroups = macro.groups.filter((g) => {
                                            if (!userPermissionSearch.trim()) return true;
                                            const search = userPermissionSearch.toLowerCase().trim();
                                            return (
                                                g.label.toLowerCase().includes(search) ||
                                                g.permissions.some((p) => p.toLowerCase().includes(search))
                                            );
                                        });

                                        if (filteredGroups.length === 0) return null;

                                        return (
                                            <div key={macro.id} className="space-y-1">
                                                <div
                                                    onClick={() =>
                                                        setExpandedMacroGroups((prev) => ({
                                                            ...prev,
                                                            [macro.id]: !prev[macro.id],
                                                        }))
                                                    }
                                                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {macro.icon && <macro.icon size={14} />}
                                                        <span>{macro.label}</span>
                                                    </div>
                                                    <span>
                                                        {isMacroCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                                    </span>
                                                </div>

                                                {!isMacroCollapsed && (
                                                    <div className="pl-2 space-y-1 mt-1">
                                                        {filteredGroups.map((group) => {
                                                            const isSelected = selectedUserGroupId === group.id;

                                                            return (
                                                                <div
                                                                    key={group.id}
                                                                    onClick={() => {
                                                                        setSelectedUserGroupId(group.id);
                                                                        setSelectedUserMacroGroup(macro.id as any);
                                                                    }}
                                                                    className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${isSelected
                                                                        ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                                                                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                                                        }`}
                                                                >
                                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-255 truncate pr-2 font-candara">
                                                                        {group.label}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Coluna 2: Permissões do Menu Selecionado */}
                            <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-start min-h-[500px]">
                                <h4 className="text-base font-bold text-gray-800 dark:text-white mb-4">
                                    Permissões do menu selecionado
                                </h4>

                                {!selectedMemberId ? (
                                    <div className="flex flex-col items-center justify-center flex-1 text-center p-6 text-gray-400">
                                        <User size={32} className="mb-2 opacity-50" />
                                        <p className="text-xs">Selecione um colaborador na coluna da direita para configurar exceções.</p>
                                    </div>
                                ) : (
                                    (() => {
                                        const macroDef = ROLE_PERMISSION_TREE.find((m) => m.id === selectedUserMacroGroup);
                                        const groupDef = macroDef?.groups.find((g) => g.id === selectedUserGroupId);

                                        if (!groupDef) {
                                            return (
                                                <div className="flex flex-col items-center justify-center flex-1 text-center p-6 text-gray-400">
                                                    <Grid3X3 size={32} className="mb-2 opacity-50" />
                                                    <p className="text-xs">Selecione um grupo de permissões na coluna à esquerda.</p>
                                                </div>
                                            );
                                        }

                                        // Filtrar permissões do colaborador para este grupo
                                        const groupRows = memberPermissionDetail.filter((row) => {
                                            if (userPermissionSearch.trim()) {
                                                const search = userPermissionSearch.toLowerCase().trim();
                                                const matchesSearch = row.permission_code.toLowerCase().includes(search) ||
                                                    row.label.toLowerCase().includes(search);
                                                if (!matchesSearch) return false;
                                            }

                                            const definition = getPermissionGroupDefinition(row.permission_code);
                                            return definition.id === groupDef.id;
                                        });

                                        if (groupRows.length === 0) {
                                            return (
                                                <div className="flex flex-col items-center justify-center flex-1 text-center p-6 text-gray-400">
                                                    <p className="text-xs">Nenhuma permissão encontrada para este grupo.</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-4 overflow-y-auto max-h-[420px] pr-1 scrollbar-thin flex-1">
                                                <div className="border-b pb-3 mb-4">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                        {macroDef?.label}
                                                    </span>
                                                    <h4 className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">
                                                        {groupDef.label}
                                                    </h4>
                                                </div>

                                                <div className="space-y-4">
                                                    {groupRows.map((row) => {
                                                        const code = row.permission_code;
                                                        const overrideValue = getIndividualPermissionState(selectedMemberPermissions, code);
                                                        const effectiveValue = row.effective_allowed;
                                                        const sourceLabel = getPermissionSourceLabel(row.source);
                                                        const itemDisabled = !canManageUserPermissions || adminLoading.saving;

                                                        return (
                                                            <div key={code} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-105 dark:border-gray-850 space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-xs font-bold text-gray-850 dark:text-gray-200">
                                                                            {row.label || code}
                                                                        </span>
                                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[240px]" title={code}>
                                                                            {code}
                                                                        </span>
                                                                    </div>
                                                                    {row.risk_level && renderRiskBadge(row.risk_level)}
                                                                </div>

                                                                <div className="text-xs space-y-1 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-450">Efetivo:</span>
                                                                        <span className={`font-bold ${effectiveValue ? 'text-green-600' : 'text-red-500'}`}>
                                                                            {effectiveValue ? 'Permitido' : 'Bloqueado'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-455">Origem:</span>
                                                                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                                                                            {sourceLabel}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between gap-4 pt-1">
                                                                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                                                                        Exceção individual
                                                                    </span>
                                                                    <select
                                                                        value={overrideValue}
                                                                        disabled={itemDisabled}
                                                                        onChange={(event) =>
                                                                            setIndividualPermissionState(
                                                                                code,
                                                                                event.target.value as 'inherit' | 'allow' | 'deny'
                                                                            )
                                                                        }
                                                                        className="rounded-lg border border-gray-205 bg-white px-2 py-1 text-xs font-semibold dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:border-[#19A999]"
                                                                    >
                                                                        <option value="inherit">Herdar</option>
                                                                        <option value="allow">Permitir</option>
                                                                        <option value="deny">Bloquear</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>

                            {/* Coluna 3: Colaboradores */}
                            <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-between min-h-[500px]">
                                <div className="space-y-4">
                                    <h4 className="text-base font-bold text-gray-800 dark:text-white">
                                        Colaboradores
                                    </h4>

                                    <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1 scrollbar-thin">
                                        {selectableMembers.map((member) => {
                                            const isSelected = selectedMemberId === member.member_id;
                                            const name = member.user_name || member.user_email || 'Colaborador';
                                            const initials = name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

                                            return (
                                                <div
                                                    key={member.member_id}
                                                    onClick={() => {
                                                        setSelectedMemberId(member.member_id);
                                                    }}
                                                    className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${isSelected
                                                        ? 'border-green-600 bg-green-50/30 dark:bg-green-950/20 text-green-700 dark:text-green-300'
                                                        : 'border-gray-100 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-700 dark:text-gray-300'
                                                        }`}
                                                >
                                                    {/* Avatar */}
                                                    {member.avatar_url || member.profile_avatar_url ? (
                                                        <img
                                                            src={member.avatar_url || member.profile_avatar_url || ''}
                                                            alt={name}
                                                            className={`h-8 w-8 shrink-0 rounded-full object-cover border ${isSelected
                                                                ? 'border-green-500'
                                                                : 'border-gray-200 dark:border-gray-700'
                                                                }`}
                                                        />
                                                    ) : (
                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSelected
                                                            ? 'bg-green-200 text-green-850 dark:bg-green-800 dark:text-green-100'
                                                            : 'bg-gray-100 text-gray-650 dark:bg-gray-700 dark:text-gray-300'
                                                            }`}>
                                                            {initials}
                                                        </div>
                                                    )}

                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <p className="text-xs font-bold truncate">
                                                            {name}
                                                        </p>
                                                        <div className="text-[10px] space-y-0.5 text-gray-505 dark:text-gray-400">
                                                            <p>
                                                                Base: <strong className="font-semibold">{formatSecurityRole(member.role)}</strong>
                                                            </p>
                                                            {member.custom_role_name && (
                                                                <p className="text-purple-650 dark:text-purple-300">
                                                                    Função: <strong className="font-semibold">{member.custom_role_name}</strong>
                                                                </p>
                                                            )}
                                                            <p>
                                                                Status: <span className={`font-semibold ${member.status === 'active' ? 'text-green-650' : 'text-amber-600'
                                                                    }`}>{formatSecurityStatus(member.status)}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {selectedMemberId && canManageSecurity && (
                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-4">
                                        <button
                                            type="button"
                                            disabled={adminLoading.saving}
                                            onClick={saveSelectedMemberPermissions}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {adminLoading.saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                                            {adminLoading.saving ? 'Salvando...' : 'Salvar Permissões'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* A!"ES SENSÍVEIS */}
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
                                                        disabled={!canManageSensitiveActions || adminLoading.saving}
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
                                                        disabled={!canManageSensitiveActions || adminLoading.saving}
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
                                                        disabled={!canManageSensitiveActions || adminLoading.saving}
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
                                                        disabled={!canManageSensitiveActions || adminLoading.saving}
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
                                                        disabled={!canManageSensitiveActions || adminLoading.saving}
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
                                                        disabled={!canManageSensitiveActions || adminLoading.saving}
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
                                                        disabled={!canManageSensitiveActions || adminLoading.saving}
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
                                            {canManageSecurity && (
                                                <button
                                                    type="button"
                                                    onClick={handleUnblock}
                                                    className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition w-full md:w-auto"
                                                >
                                                    Desbloquear Agora
                                                </button>
                                            )}
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
                                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white tracking-[0.5em] text-center font-bold text-xl pr-10 disabled:opacity-60"
                                                        value={pinData}
                                                        onChange={e => setPinData(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        disabled={!canManageSecurity}
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
                                                        disabled={!canManageSecurity}
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
                                            {canManageSecurity && (
                                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                                    <button
                                                        onClick={handlePinSave}
                                                        disabled={saving || !pinData || pinData.length !== 6}
                                                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {saving ? 'Salvando...' : 'Salvar PIN'}
                                                    </button>
                                                </div>
                                            )}
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
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 disabled:opacity-60"
                                                disabled={!canManageSecurity}
                                                required
                                            />
                                            <button
                                                type="button"
                                                disabled={!canManageSecurity}
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
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 disabled:opacity-60"
                                                disabled={!canManageSecurity}
                                                required
                                            />
                                            <button
                                                type="button"
                                                disabled={!canManageSecurity}
                                                onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                            >
                                                {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {canManageSecurity && (
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
                                    )}
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
                                                disabled={!canManageSecurity}
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 text-sm disabled:opacity-60"
                                                placeholder="Digite sua senha de login"
                                                required
                                            />
                                            <button
                                                type="button"
                                                disabled={!canManageSecurity}
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
                                                disabled={!canManageSecurity}
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 text-sm disabled:opacity-60"
                                                placeholder="Mínimo 6 caracteres"
                                                required
                                            />
                                            <button
                                                type="button"
                                                disabled={!canManageSecurity}
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
                                                disabled={!canManageSecurity}
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 text-sm disabled:opacity-60"
                                                placeholder="Repita a nova senha"
                                                required
                                            />
                                            <button
                                                type="button"
                                                disabled={!canManageSecurity}
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

                                    {canManagePinToken && (
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
                                    )}
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
                                                â ³ Tempo de expiração do token
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
                                            disabled={!canManageSecurity}
                                            onChange={(e) => setTokenExpiry(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600 disabled:opacity-50"
                                        />
                                        <div className="flex justify-between text-xs text-gray-555 mt-1">
                                            <span>15s</span>
                                            <span>15s (padrão)</span>
                                            <span>60s</span>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                ðŸ⬝  Máximo de tentativas por token
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
                                            disabled={!canManageSecurity}
                                            onChange={(e) => setMaxAttempts(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600 disabled:opacity-50"
                                        />
                                        <div className="flex justify-between text-xs text-gray-555 mt-1">
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
                                        {canManageSecurity && (
                                            <button
                                                onClick={handleAdvancedSave}
                                                disabled={saving || !hasPin}
                                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Save size={18} />
                                                {saving ? 'Salvando...' : 'Salvar configurações'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SESSÒO E INATIVIDADE */}
                    <div className={activeTab === 'session_inactive' ? 'block space-y-6 animate-fadeIn' : 'hidden'}>
                        <div className="bg-[#19A999]/5 dark:bg-[#19A999]/10 border border-[#19A999]/20 p-6 rounded-xl">
                            <div className="flex flex-col md:flex-row md:items-start gap-4">
                                <div className="p-3 bg-[#19A999]/10 rounded-full text-[#19A999] shrink-0 w-fit">
                                    <Clock size={24} />
                                </div>
                                <div className="flex-1 w-full">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                                        Configuração de Sessão e Inatividade
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                                        Gerencie as diretrizes de tempo limite de sessão e desconexão automática do painel administrativo por inatividade.
                                    </p>

                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-6">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="mt-1 rounded border-gray-300 dark:border-gray-600 text-[#19A999] focus:ring-[#19A999] outline-none h-4 w-4"
                                                checked={idleTimeoutEnabled}
                                                disabled={!canManageSessions}
                                                onChange={(e) => setIdleTimeoutEnabled(e.target.checked)}
                                            />
                                            <div>
                                                <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">
                                                    Encerrar sessão por inatividade
                                                </span>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                                    Ao marcar esta opção, o sistema irá desconectar usuários ociosos de forma automática.
                                                </p>
                                            </div>
                                        </label>

                                        {idleTimeoutEnabled && (
                                            <div className="space-y-3 pt-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="font-bold text-gray-700 dark:text-gray-300">
                                                        Tempo de inatividade:
                                                    </span>
                                                    <span className="text-[#19A999] font-bold">
                                                        {idleTimeoutMinutes} minutos
                                                    </span>
                                                </div>

                                                <div className="relative pt-1">
                                                    <input
                                                        type="range"
                                                        min={15}
                                                        max={45}
                                                        step={5}
                                                        value={idleTimeoutMinutes}
                                                        disabled={!canManageSessions}
                                                        onChange={(event) => setIdleTimeoutMinutes(Number(event.target.value))}
                                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#19A999]"
                                                    />
                                                    <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 px-1 mt-1">
                                                        <span>15 min</span>
                                                        <span>20 min</span>
                                                        <span>25 min</span>
                                                        <span>30 min (padrão)</span>
                                                        <span>35 min</span>
                                                        <span>40 min</span>
                                                        <span>45 min</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            {canManageSessions && (
                                                <button
                                                    type="button"
                                                    disabled={saving}
                                                    onClick={handleSaveIdleTimeout}
                                                    className="bg-[#F1613A] hover:bg-[#d85535] text-white font-bold py-2.5 px-5 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 text-sm cursor-pointer shadow-sm"
                                                >
                                                    {saving ? 'Salvando...' : 'Salvar configuração'}
                                                </button>
                                            )}
                                            {!canManageSessions && (
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Você pode visualizar esta configuração, mas não tem permissão para alterá-la.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FUN!"ES PERSONALIZADAS */}
                    <div className={activeTab === 'custom_roles' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                    Funções personalizadas
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Crie cargos que herdam de um papel base e ajustam permissões específicas da loja.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <button
                                    type="button"
                                    onClick={refreshCustomRoles}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    <RefreshCw size={16} className={customRolesLoading ? 'animate-spin' : ''} />
                                    Atualizar
                                </button>
                            </div>
                        </div>

                        {customRolesLoading && customRoles.length === 0 ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700">
                                <Loader className="animate-spin text-brand-green" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                {/* Painel 1: Grupos de Permissão (Col 4) */}
                                <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-start min-h-[500px]">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-base font-bold text-gray-800 dark:text-white">
                                            Grupos de Permissões
                                        </h4>
                                    </div>

                                    {/* Lista de Macro Grupos */}
                                    <div className="space-y-4 overflow-y-auto max-h-[450px] pr-1 scrollbar-thin">
                                        {ROLE_PERMISSION_TREE.map((macro) => {
                                            const isMacroCollapsed = !expandedMacroGroups[macro.id];

                                            return (
                                                <div key={macro.id} className="space-y-1">
                                                    <div
                                                        onClick={() =>
                                                            setExpandedMacroGroups((prev) => ({
                                                                ...prev,
                                                                [macro.id]: !prev[macro.id],
                                                            }))
                                                        }
                                                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {macro.icon && <macro.icon size={14} />}
                                                            <span>{macro.label}</span>
                                                        </div>
                                                        <span>
                                                            {isMacroCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                                        </span>
                                                    </div>

                                                    {!isMacroCollapsed && (
                                                        <div className="pl-2 space-y-1 mt-1">
                                                            {macro.groups.map((group) => {
                                                                const isSelected = selectedCustomRoleGroupId === group.id;
                                                                const hasView = group.accessPermission;
                                                                const viewDisabled = !canManageCustomRoles || !selectedCustomRole;

                                                                return (
                                                                    <div
                                                                        key={group.id}
                                                                        onClick={() => {
                                                                            setSelectedCustomRoleGroupId(group.id);
                                                                            setSelectedMacroGroup(macro.id as any);
                                                                        }}
                                                                        className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${isSelected
                                                                            ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                                                                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                                                            }`}
                                                                    >
                                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-250 truncate pr-2">
                                                                            {group.label}
                                                                        </span>

                                                                        <div className="flex items-center gap-2 shrink-0">
                                                                            {hasView && (
                                                                                <div className="flex items-center gap-1">
                                                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">Acessar</span>
                                                                                    <Switch
                                                                                        checked={isCustomRoleAllowed(group.accessPermission)}
                                                                                        onCheckedChange={(checked) =>
                                                                                            handleToggleCustomRoleMenuAccess(group, checked)
                                                                                        }
                                                                                        disabled={viewDisabled}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Painel 2: Detalhes do Grupo Selecionado (Col 5) */}
                                <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-start min-h-[500px]">
                                    {(() => {
                                        const macroDef = ROLE_PERMISSION_TREE.find((m) => m.id === selectedMacroGroup);
                                        const groupDef = macroDef?.groups.find((g) => g.id === selectedCustomRoleGroupId);

                                        if (!selectedCustomRole) {
                                            return (
                                                <div className="flex flex-col items-center justify-center flex-1 text-center p-6 text-gray-400">
                                                    <Shield size={32} className="mb-2 opacity-50 text-gray-400" />
                                                    <p className="text-xs">Selecione uma função personalizada na coluna à direita para configurar.</p>
                                                </div>
                                            );
                                        }

                                        if (!groupDef) {
                                            return (
                                                <div className="flex flex-col items-center justify-center flex-1 text-center p-6 text-gray-400">
                                                    <Grid3X3 size={32} className="mb-2 opacity-50" />
                                                    <p className="text-xs">Selecione um grupo de permissões na coluna à esquerda.</p>
                                                </div>
                                            );
                                        }

                                        const selectedGroupAccessAllowed = isCustomRoleAllowed(groupDef.accessPermission);

                                        if (!selectedGroupAccessAllowed) {
                                            return (
                                                <div className="rounded-xl border border-dashed border-gray-250 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center flex-1 text-center">
                                                    <Lock size={32} className="mb-2 opacity-50 text-gray-400" />
                                                    <p>Libere <strong>Acessar</strong> para configurar os itens deste menu.</p>
                                                </div>
                                            );
                                        }

                                        const groupRows = permissionMatrix.filter((row) =>
                                            row.group_key === groupDef.id ||
                                            (groupDef.permissions as readonly string[]).includes(row.permission_code)
                                        );

                                        const accessRow = groupRows.find((row) => row.action_key === 'access');

                                        const searchFilteredRows = groupRows.filter((row) => {
                                            if (row.action_key === 'access') return false;
                                            return true;
                                        });

                                        const items = groupPermissionsByItem(searchFilteredRows);

                                        return (
                                            <>
                                                <div className="border-b pb-3 mb-4">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                        {macroDef?.label}
                                                    </span>
                                                    <h4 className="text-base font-bold text-gray-800 dark:text-white mt-0.5">
                                                        {groupDef.label}
                                                    </h4>
                                                </div>

                                                <div className="space-y-4 overflow-y-auto max-h-[420px] pr-1 scrollbar-thin flex-1">
                                                    {accessRow && (() => {
                                                        const code = accessRow.permission_code;
                                                        const allowed = isCustomRoleAllowed(code);
                                                        const disabled = !canManageCustomRoles;

                                                        return (
                                                            <div className="flex items-center justify-between p-3 rounded-xl bg-green-50/50 dark:bg-green-950/10 border border-green-100/50 dark:border-green-900/20 mb-2">
                                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                                    <span className={`text-xs font-bold ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-green-800 dark:text-green-300'}`}>
                                                                        Acessar {groupDef.label}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate" title={code}>
                                                                        {code}
                                                                    </span>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    disabled={disabled}
                                                                    onClick={() => handleToggleCustomRolePermissionCascade(code, !allowed, groupRows)}
                                                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-205 ease-in-out focus:outline-none ${allowed
                                                                        ? 'bg-green-600'
                                                                        : 'bg-gray-200 dark:bg-gray-700'
                                                                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    <span
                                                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-205 ease-in-out ${allowed ? 'translate-x-4' : 'translate-x-0'
                                                                            }`}
                                                                    />
                                                                </button>
                                                            </div>
                                                        );
                                                    })()}

                                                    {items.length === 0 && !accessRow ? (
                                                        <p className="text-xs text-gray-400 text-center py-4">Nenhuma permissão encontrada.</p>
                                                    ) : (
                                                        items.map((item) => {
                                                            return (
                                                                <div key={item.itemKey} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-2">
                                                                    <h5 className="text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 pb-1">
                                                                        {item.itemLabel}
                                                                    </h5>
                                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                                        {item.permissions.map((row) => {
                                                                            const code = row.permission_code;
                                                                            const allowed = isCustomRoleAllowed(code);
                                                                            const disabled = !canManageCustomRoles;
                                                                            const actionLabelText = row.action_label || getPermissionActionLabel(row);

                                                                            return (
                                                                                <button
                                                                                    key={code}
                                                                                    type="button"
                                                                                    disabled={disabled}
                                                                                    onClick={() => handleToggleCustomRolePermissionCascade(code, !allowed, groupRows)}
                                                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition shadow-sm ${allowed
                                                                                        ? 'border-green-250 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                                                                                        : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-850 dark:text-gray-500'
                                                                                        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                                                                    title={code}
                                                                                >
                                                                                    {allowed ? (
                                                                                        <Check size={12} className="text-green-600" />
                                                                                    ) : (
                                                                                        <X size={12} className="text-red-500" />
                                                                                    )}
                                                                                    <span>{actionLabelText}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Painel 3: Funções Personalizadas (Col 3) */}
                                <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-between min-h-[500px]">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-base font-bold text-gray-800 dark:text-white">
                                                Funções
                                            </h4>
                                            {canManageCustomRoles && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCreateCustomRoleOpen(true)}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-green-600 hover:text-green-700 dark:text-green-400"
                                                >
                                                    <Plus size={14} />
                                                    Nova
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
                                            {customRoles.map((role) => {
                                                const isSelected = selectedCustomRoleId === role.id;

                                                return (
                                                    <div
                                                        key={role.id}
                                                        onClick={() => setSelectedCustomRoleId(role.id)}
                                                        className={`flex flex-col p-3 rounded-xl border transition cursor-pointer select-none ${isSelected
                                                            ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-300'
                                                            : 'border-gray-100 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-700 dark:text-gray-300'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold truncate max-w-[80%]">
                                                                {role.name}
                                                            </span>
                                                            {!role.active && (
                                                                <span className="text-[9px] font-bold text-red-500 uppercase">Inativa</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 mt-1">
                                                            Base: {formatSecurityRole(role.base_role)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {selectedCustomRole && (
                                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 space-y-3">
                                                <h5 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                    Detalhes da Função
                                                </h5>

                                                <div className="space-y-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                                                            Nome
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={selectedCustomRole.name}
                                                            disabled={!canManageCustomRoles}
                                                            onChange={(e) =>
                                                                setCustomRoles((current) =>
                                                                    current.map((r) =>
                                                                        r.id === selectedCustomRole.id
                                                                            ? { ...r, name: e.target.value }
                                                                            : r
                                                                    )
                                                                )
                                                            }
                                                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                                                            Descrição
                                                        </label>
                                                        <textarea
                                                            value={selectedCustomRole.description || ''}
                                                            disabled={!canManageCustomRoles}
                                                            onChange={(e) =>
                                                                setCustomRoles((current) =>
                                                                    current.map((r) =>
                                                                        r.id === selectedCustomRole.id
                                                                            ? { ...r, description: e.target.value }
                                                                            : r
                                                                    )
                                                                )
                                                            }
                                                            rows={2}
                                                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white resize-none"
                                                        />
                                                    </div>

                                                    <label className="flex items-center gap-2 cursor-pointer text-xs pt-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCustomRole.active}
                                                            disabled={!canManageCustomRoles}
                                                            onChange={(e) =>
                                                                setCustomRoles((current) =>
                                                                    current.map((r) =>
                                                                        r.id === selectedCustomRole.id
                                                                            ? { ...r, active: e.target.checked }
                                                                            : r
                                                                    )
                                                                )
                                                            }
                                                            className="h-3.5 w-3.5 accent-green-600 rounded"
                                                        />
                                                        <span className="font-bold text-gray-700 dark:text-gray-300">
                                                            Função ativa
                                                        </span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Botão de Salvar Alterações */}
                                    {selectedCustomRole && canManageCustomRoles && (
                                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-4">
                                            <button
                                                type="button"
                                                disabled={saving}
                                                onClick={() => saveSelectedCustomRole()}
                                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                                                {saving ? 'Salvando...' : 'Salvar Função'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Modal de Nova Função Personalizada */}
            {isCreateCustomRoleOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800 animate-zoomIn">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Nova função personalizada
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsCreateCustomRoleOpen(false)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCustomRoleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">
                                    Nome da função
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newCustomRoleName}
                                    onChange={(e) => setNewCustomRoleName(e.target.value)}
                                    placeholder="Ex.: Supervisor de Estoque"
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">
                                    Papel base
                                </label>
                                <select
                                    value={newCustomRoleBaseRole}
                                    onChange={(e) => setNewCustomRoleBaseRole(e.target.value as RoleCode)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                >
                                    {ROLE_OPTIONS.filter((role) => role.value !== 'owner').map((role) => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">
                                    Descrição (opcional)
                                </label>
                                <textarea
                                    value={newCustomRoleDescription}
                                    onChange={(e) => setNewCustomRoleDescription(e.target.value)}
                                    placeholder="Explique quando este cargo deve ser usado."
                                    rows={3}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateCustomRoleOpen(false)}
                                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-650 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
                                >
                                    Criar Função
                                </button>
                            </div>
                        </form>
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
