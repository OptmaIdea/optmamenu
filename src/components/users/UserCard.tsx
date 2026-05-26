import React from 'react';
import type { UserAdmin } from '@/types';
import { UserStatusBadge } from './UserStatusBadge';
import { UserRoleBadge } from './UserRoleBadge';
import {
    Mail,
    Phone,
    Calendar,
    MoreVertical,
    Edit2,
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
}

export function UserCard({
    user,
    onView,
    onEdit,
    onToggleStatus,
    onDelete,
    showActions = true,
}: UserCardProps) {
    const [showMenu, setShowMenu] = React.useState(false);
    const isProtectedOwner = user.role === 'owner';

    const initials = user.full_name
        ? user.full_name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()
        : 'U';

    const handleAction = (action: () => void) => {
        action();
        setShowMenu(false);
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#21A896] to-[#1A867A] flex items-center justify-center text-white font-bold text-lg shrink-0">
                        {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                {user.full_name || 'Sem nome'}
                            </h3>
                            <UserRoleBadge role={user.role} size="sm" />
                            <UserStatusBadge status={user.status} size="sm" />
                        </div>

                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                            {user.email && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <Mail size={14} className="shrink-0" />
                                    <span className="truncate">{user.email}</span>
                                </div>
                            )}
                            {user.phone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <Phone size={14} className="shrink-0" />
                                    <span>{user.phone}</span>
                                </div>
                            )}
                            {user.cpf && (
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

                        {user.internal_notes && (
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                                <span className="font-medium">Observações:</span>{' '}
                                {user.internal_notes}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Menu */}
                {showActions && (
                    <div className="relative">
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
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                                    {onView && (
                                        <button
                                            onClick={() => handleAction(() => onView(user))}
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            <Edit2 size={14} />
                                            Ver detalhes
                                        </button>
                                    )}
                                    {onEdit && (
                                        <button
                                            onClick={() =>
                                                handleAction(() => {
                                                    if (!isProtectedOwner) {
                                                        onEdit(user);
                                                    }
                                                })
                                            }
                                            disabled={isProtectedOwner}
                                            className={`w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                                                isProtectedOwner
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : ''
                                            }`}
                                        >
                                            <Edit2 size={14} />
                                            Editar
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
                                            className={`w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                                                isProtectedOwner
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : ''
                                            }`}
                                        >
                                            {user.status === 'active' ? (
                                                <>
                                                    <Ban size={14} />
                                                    Desativar
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle size={14} />
                                                    Ativar
                                                </>
                                            )}
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button
                                            onClick={() =>
                                                handleAction(() => {
                                                    if (!isProtectedOwner) {
                                                        onDelete(user);
                                                    }
                                                })
                                            }
                                            disabled={isProtectedOwner}
                                            className={`w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 ${
                                                isProtectedOwner
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : ''
                                            }`}
                                        >
                                            <Trash2 size={14} />
                                            Excluir
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
