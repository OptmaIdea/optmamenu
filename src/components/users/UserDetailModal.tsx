import type { UserAdmin } from '@/types';
import { UserStatusBadge } from './UserStatusBadge';
import { UserRoleBadge } from './UserRoleBadge';
import { X, Mail, Phone, User, Calendar, Shield, FileText, Store } from 'lucide-react';

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserAdmin | null;
}

export function UserDetailModal({ isOpen, onClose, user }: UserDetailModalProps) {
    if (!isOpen || !user) return null;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const initials = user.full_name
        ? user.full_name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()
        : 'U';

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Detalhes do Usuário
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Profile Header */}
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#21A896] to-[#1A867A] flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                                {initials}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {user.full_name || 'Sem nome'}
                                </h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <UserRoleBadge role={user.role} size="sm" />
                                    <UserStatusBadge status={user.status} size="sm" />
                                </div>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Email */}
                            {user.email && (
                                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <Mail size={18} className="text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            Email
                                        </p>
                                        <p className="text-sm text-gray-900 dark:text-white">
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Telefone */}
                            {user.phone && (
                                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <Phone size={18} className="text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            Telefone
                                        </p>
                                        <p className="text-sm text-gray-900 dark:text-white">
                                            {user.phone}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* CPF */}
                            {user.cpf && (
                                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <User size={18} className="text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            CPF
                                        </p>
                                        <p className="text-sm text-gray-900 dark:text-white">
                                            {user.cpf}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Cargo */}
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <Shield size={18} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        Permissão
                                    </p>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        {user.role === 'super_admin' && 'Super Administrador'}
                                        {user.role === 'admin' && 'Administrador'}
                                        {user.role === 'manager' && 'Gerente'}
                                        {user.role === 'staff' && 'Equipe'}
                                        {user.role === 'viewer' && 'Visualizador'}
                                    </p>
                                </div>
                            </div>

                            {/* Criado em */}
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <Calendar size={18} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        Criado em
                                    </p>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        {formatDate(user.created_at)}
                                    </p>
                                </div>
                            </div>

                            {/* Último acesso */}
                            {user.last_sign_in_at && (
                                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <Calendar size={18} className="text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            Último acesso
                                        </p>
                                        <p className="text-sm text-gray-900 dark:text-white">
                                            {formatDate(user.last_sign_in_at)}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Lojas */}
                        {user.stores && user.stores.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <Store size={16} />
                                    Lojas Vinculadas
                                </h4>
                                <div className="space-y-2">
                                    {user.stores.map((store) => (
                                        <div
                                            key={store.id}
                                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                        >
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {store.store_name}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {store.store_slug}
                                                </p>
                                            </div>
                                            <UserRoleBadge role={store.role} size="sm" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Observações */}
                        {user.internal_notes && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <FileText size={16} />
                                    Observações Internas
                                </h4>
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {user.internal_notes}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-[#21A896]">
                                    {user.is_admin ? 'Sim' : 'Não'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    É Admin
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-[#21A896]">
                                    {user.email_verified ? 'Sim' : 'Não'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Email Verificado
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-[#21A896]">
                                    {user.is_active ? 'Ativo' : 'Inativo'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Status
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
