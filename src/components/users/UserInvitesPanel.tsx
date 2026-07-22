import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Mail, RefreshCw, XCircle, UserPlus, Search, X } from 'lucide-react';
import type { StoreMemberInvite } from '@/types/storeMemberInvites';
import type { StoreMemberRole } from '@/types/security';

interface UserInvitesPanelProps {
    invites: StoreMemberInvite[];
    loading?: boolean;
    saving?: boolean;
    onRefresh: () => void;
    onCancel: (inviteId: string) => Promise<void>;
    onInviteUser?: () => void;
}

function formatRole(role: Exclude<StoreMemberRole, 'owner'>): string {
    const labels: Record<string, string> = {
        admin: 'Administrador',
        manager: 'Gerente',
        stock_operator: 'Operador de estoque',
        cashier: 'Caixa',
        sales: 'Vendas',
        viewer: 'Visualizador',
        staff: 'Equipe',
    };

    return labels[role] ?? role;
}

function formatStatus(status: string): string {
    const labels: Record<string, string> = {
        pending: 'Pendente',
        accepted: 'Aceito',
        cancelled: 'Cancelado',
        expired: 'Expirado',
    };

    return labels[status] ?? status;
}

function getStatusBadgeStyle(status: string): string {
    switch (status) {
        case 'pending':
            return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50';
        case 'accepted':
            return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50';
        case 'cancelled':
            return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/50';
        case 'expired':
            return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300';
    }
}

function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function UserInvitesPanel({
    invites,
    loading = false,
    saving = false,
    onRefresh,
    onCancel,
    onInviteUser,
}: UserInvitesPanelProps) {
    const [searchEmail, setSearchEmail] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const filteredInvites = useMemo(() => {
        return invites.filter((invite) => {
            const matchesEmail =
                searchEmail.trim() === '' ||
                invite.email.toLowerCase().includes(searchEmail.toLowerCase().trim());

            const matchesStatus = statusFilter === 'all' || invite.status === statusFilter;

            return matchesEmail && matchesStatus;
        });
    }, [invites, searchEmail, statusFilter]);

    if (invites.length === 0) {
        return (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800 shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#19A999]/10 text-[#19A999]">
                    <Mail size={24} />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white font-candara-bold">
                    Nenhum convite enviado
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto font-candara">
                    Não há convites de novos usuários cadastrados para este estabelecimento.
                </p>
                {onInviteUser && (
                    <button
                        type="button"
                        onClick={onInviteUser}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#14887B] shadow-xs cursor-pointer"
                    >
                        <UserPlus size={16} />
                        Enviar Novo Convite
                    </button>
                )}
            </div>
        );
    }

    const handleCancel = async (invite: StoreMemberInvite) => {
        const confirmed = window.confirm(
            `Cancelar convite para "${invite.email}"?`
        );

        if (!confirmed) return;

        try {
            await onCancel(invite.invite_id);
            toast.success('Convite cancelado com sucesso.');
        } catch {
            toast.error('Não foi possível cancelar o convite.');
        }
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 shadow-sm space-y-4">
            {/* Header com título e botão de atualizar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white font-candara-bold">
                        <Mail size={18} className="text-[#19A999]" />
                        <span>Convites Enviados</span>
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 font-candara">
                        Gerencie os convites para novos membros do estabelecimento ({invites.length} ao total).
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-60 cursor-pointer"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Barra de Filtro e Busca */}
            <div className="flex flex-col sm:flex-row gap-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                {/* Busca por E-mail */}
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por e-mail do convidado..."
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        className="w-full text-xs pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999]/30 transition"
                    />
                    {searchEmail && (
                        <button
                            type="button"
                            onClick={() => setSearchEmail('')}
                            className="absolute right-3 top-2 text-gray-400 hover:text-[#F1613A] transition cursor-pointer"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Filtro por Status */}
                <div className="w-full sm:w-52">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999]/30 transition"
                    >
                        <option value="all">Todos os status</option>
                        <option value="pending">Pendentes</option>
                        <option value="accepted">Aceitos</option>
                        <option value="cancelled">Cancelados</option>
                        <option value="expired">Expirados</option>
                    </select>
                </div>

                {/* Limpar Filtros */}
                {(searchEmail || statusFilter !== 'all') && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchEmail('');
                            setStatusFilter('all');
                        }}
                        className="text-xs font-bold text-gray-500 hover:text-[#F1613A] transition cursor-pointer self-center px-2 py-1"
                    >
                        Limpar
                    </button>
                )}
            </div>

            {/* Lista de Convites */}
            {filteredInvites.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400 font-candara">
                    Nenhum convite encontrado com os filtros aplicados.
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filteredInvites.map((invite) => (
                        <div
                            key={invite.invite_id}
                            className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 shadow-xs dark:border-gray-700/60 dark:bg-gray-900/40 sm:flex-row sm:items-center sm:justify-between transition hover:border-gray-200 dark:hover:border-gray-700"
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-xl bg-[#19A999]/10 p-2 text-[#19A999] dark:bg-[#19A999]/20">
                                    <Mail size={16} />
                                </div>

                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white font-candara-bold">
                                        {invite.email}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-candara">
                                        <span>Papel: <strong className="text-gray-700 dark:text-gray-300">{formatRole(invite.role)}</strong></span>
                                        <span>·</span>
                                        <span>Enviado em: <strong>{formatDate(invite.invited_at || invite.created_at)}</strong></span>
                                        <span>·</span>
                                        <span>Expira em: <strong>{formatDate(invite.expires_at)}</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border ${getStatusBadgeStyle(invite.status)}`}>
                                    {formatStatus(invite.status)}
                                </span>

                                {invite.status === 'pending' && (
                                    <button
                                        type="button"
                                        onClick={() => handleCancel(invite)}
                                        disabled={saving}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition disabled:opacity-60 cursor-pointer"
                                        title="Cancelar convite"
                                    >
                                        <XCircle size={15} />
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}