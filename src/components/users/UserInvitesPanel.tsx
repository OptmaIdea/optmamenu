import { toast } from 'sonner';
import { Clock, Mail, RefreshCw, XCircle } from 'lucide-react';
import type { StoreMemberInvite } from '@/types/storeMemberInvites';
import type { StoreMemberRole } from '@/types/security';

interface UserInvitesPanelProps {
    invites: StoreMemberInvite[];
    loading?: boolean;
    saving?: boolean;
    onRefresh: () => void;
    onCancel: (inviteId: string) => Promise<void>;
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
}: UserInvitesPanelProps) {
    const pendingInvites = invites.filter((invite) => invite.status === 'pending');

    if (invites.length === 0) {
        return null;
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                        <Clock size={16} />
                        Convites de usuários
                    </h3>
                    <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
                        {pendingInvites.length} convite(s) pendente(s) aguardando aceite.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/30"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            <div className="space-y-2">
                {invites.map((invite) => (
                    <div
                        key={invite.invite_id}
                        className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                <Mail size={16} />
                            </div>

                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                    {invite.email}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Papel: {formatRole(invite.role)} · Status: {formatStatus(invite.status)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Expira em: {formatDate(invite.expires_at)}
                                </p>
                            </div>
                        </div>

                        {invite.status === 'pending' && (
                            <button
                                type="button"
                                onClick={() => handleCancel(invite)}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                                <XCircle size={15} />
                                Cancelar
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}