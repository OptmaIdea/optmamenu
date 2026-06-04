import React from 'react';
import type { UserAdmin } from '@/types';
import type { StoreCustomRole } from '@/types/security';
import { UserStatusBadge } from './UserStatusBadge';
import { UserRoleBadge } from './UserRoleBadge';
import {
    Mail,
    Phone,
    Calendar,
    MoreVertical,
    UserSearch,
    Trash2,
    Ban,
    CheckCircle,
    Clock,
    LogIn,
    LogOut,
} from 'lucide-react';

interface UserCardProps {
    user: UserAdmin;
    onView?: (user: UserAdmin) => void;
    onEdit?: (user: UserAdmin) => void;
    onToggleStatus?: (user: UserAdmin) => void;
    onDelete?: (user: UserAdmin) => void;
    showActions?: boolean;
    canManageUsers?: boolean;
    canViewSensitiveUserData?: boolean;
    customRoles?: StoreCustomRole[];
    customRoleSaving?: boolean;
    onSelectCustomRole?: (user: UserAdmin, customRoleId: string | null) => void;
}

const formatRoleLabel = (role: string | null | undefined) => {
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
};

function getInitials(name?: string | null): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function UserCard({
    user,
    onView,
    onToggleStatus,
    onDelete,
    showActions = true,
    canViewSensitiveUserData = false,
}: UserCardProps) {
    const [showMenu, setShowMenu] = React.useState(false);
    const isProtectedOwner = user.role === 'owner';

    const displayName =
        user.profile_name ||
        user.internal_alias ||
        user.email ||
        'Usuário';

    const displayAvatar =
        user.member_avatar_url ||
        user.profile_avatar_url ||
        null;

    const displayPhone =
        user.member_whatsapp_phone ||
        user.member_mobile_phone ||
        user.profile_whatsapp_phone ||
        user.profile_mobile_phone ||
        user.profile_phone;

    const initials = getInitials(displayName);

    const handleAction = (action: () => void) => {
        action();
        setShowMenu(false);
    };

    const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!onView) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onView(user);
        }
    };

    const lastAccessAt = user.last_session_at || user.last_seen_at;

    const lastSessionLabel =
        user.last_session_action === 'session_logout'
            ? 'Última saída'
            : user.last_session_action === 'session_store_selected'
                ? 'Última entrada'
                : 'Último acesso';

    const LastSessionIcon =
        user.last_session_action === 'session_logout'
            ? LogOut
            : user.last_session_action === 'session_store_selected'
                ? LogIn
                : Clock;

    return (
        <div
            role={onView ? 'button' : undefined}
            tabIndex={onView ? 0 : undefined}
            onClick={() => onView?.(user)}
            onKeyDown={handleCardKeyDown}
            className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow ${onView ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#21A896]' : ''
                }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-linear-to-br from-[#21A896] to-[#1A867A] flex items-center justify-center text-white font-bold text-lg shrink-0">
                        {displayAvatar ? (
                            <img
                                src={displayAvatar}
                                alt={displayName}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span>{initials}</span>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                {displayName}
                            </h3>
                            <UserRoleBadge role={user.role} size="sm" />
                            <UserStatusBadge status={user.status} size="sm" />
                        </div>
                        {user.internal_alias && user.internal_alias !== displayName && (
                            <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                Apelido interno: {user.internal_alias}
                            </p>
                        )}
                        {user.department && (
                            <p className="mt-1 text-xs font-bold text-[#21A896]">
                                Setor: {user.department}
                            </p>
                        )}
                        {user.custom_role_name && (
                            <p className="mt-1 text-xs font-bold text-[#21A896]">
                                {user.custom_role_name}
                                {user.custom_role_base_role
                                    ? ` · base: ${formatRoleLabel(user.custom_role_base_role)}`
                                    : ''}
                            </p>
                        )}

                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                            {user.email && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <Mail size={14} className="shrink-0" />
                                    <span className="truncate">{user.email}</span>
                                </div>
                            )}
                            {displayPhone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <Phone size={14} className="shrink-0" />
                                    <span>{displayPhone}</span>
                                </div>
                            )}
                            {canViewSensitiveUserData && user.cpf && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">CPF:</span>
                                    <span>{user.cpf}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Calendar size={14} className="shrink-0" />
                                <span>
                                    Criado em{' '}
                                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                            {lastAccessAt && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <LastSessionIcon size={14} className="shrink-0" />
                                    <span>
                                        {lastSessionLabel}:{' '}
                                        {new Date(lastAccessAt).toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            )}
                            {!lastAccessAt && (
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Clock size={14} className="shrink-0" />
                                    <span>Sem acesso registrado</span>
                                </div>
                            )}
                        </div>

                        {canViewSensitiveUserData && user.internal_notes && (
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                                <span className="font-medium">Observações:</span>{' '}
                                {user.internal_notes}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Menu */}
                {showActions && (onToggleStatus || onDelete) && (
                    <div className="relative" onClick={(event) => event.stopPropagation()}>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <MoreVertical size={18} className="text-gray-500" />
                        </button>

                        {showMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowMenu(false)}
                                />
                                <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                                    {onView && (
                                        <button
                                            onClick={() => handleAction(() => onView(user))}
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            <UserSearch size={16} />
                                            Detalhes do usuário
                                        </button>
                                    )}
                                    {onToggleStatus && (
                                        <button
                                            onClick={() =>
                                                handleAction(() => {
                                                    if (!isProtectedOwner) {
                                                        onToggleStatus(user);
                                                    }
                                                })
                                            }
                                            disabled={isProtectedOwner}
                                            className={`w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${isProtectedOwner
                                                ? 'opacity-50 cursor-not-allowed'
                                                : ''
                                                }`}
                                        >
                                            {user.status === 'active' ? (
                                                <>
                                                    <Ban size={14} />
                                                    Suspender temporariamente
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle size={14} />
                                                    Reativar acesso
                                                </>
                                            )}
                                        </button>
                                    )}
                                    {onDelete && user.status === 'invited' && !user.accepted_at && (
                                        <button
                                            onClick={() =>
                                                handleAction(() => {
                                                    if (!isProtectedOwner) {
                                                        onDelete(user);
                                                    }
                                                })
                                            }
                                            disabled={isProtectedOwner}
                                            className={`w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 ${isProtectedOwner
                                                ? 'opacity-50 cursor-not-allowed'
                                                : ''
                                                }`}
                                        >
                                            <Trash2 size={14} />
                                            Cancelar convite
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
