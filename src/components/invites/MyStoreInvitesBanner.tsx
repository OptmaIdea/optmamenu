// src/components/invites/MyStoreInvitesBanner.tsx

import { toast } from 'sonner';
import { Building2, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useMyStoreInvites } from '@/hooks/useMyStoreInvites';
import type { MyPendingStoreInvite } from '@/types/myStoreInvites';

function formatRole(role: string): string {
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

function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

interface InviteCardProps {
    invite: MyPendingStoreInvite;
    accepting: boolean;
    onAccept: (storeId: string) => Promise<void>;
}

function InviteCard({ invite, accepting, onAccept }: InviteCardProps) {
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-900/50 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Building2 className="h-5 w-5" />
                </div>

                <div>
                    <p className="font-bold text-gray-900 dark:text-white">
                        Convite para {invite.store_name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Papel: <span className="font-semibold">{formatRole(invite.role)}</span>
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Clock size={13} />
                        Expira em {formatDate(invite.expires_at)}
                    </p>
                    {invite.invited_by_email && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Convidado por: {invite.invited_by_email}
                        </p>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={() => onAccept(invite.store_id)}
                disabled={accepting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#21A896] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1A867A] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {accepting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                    <CheckCircle2 className="h-4 w-4" />
                )}
                Aceitar convite
            </button>
        </div>
    );
}

export function MyStoreInvitesBanner() {
    const {
        invites,
        loading,
        accepting,
        error,
        refresh,
        acceptInvite,
    } = useMyStoreInvites();

    if (!loading && invites.length === 0 && !error) {
        return null;
    }

    const handleAccept = async (storeId: string) => {
        try {
            await acceptInvite(storeId);
            toast.success('Convite aceito com sucesso. Atualizando acesso...');

            window.setTimeout(() => {
                window.location.reload();
            }, 700);
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : 'Não foi possível aceitar o convite.';

            toast.error(message);
        }
    };

    return (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                        Convites pendentes
                    </h3>
                    <p className="text-sm text-amber-800/80 dark:text-amber-300/80">
                        Você foi convidado para acessar uma ou mais lojas.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/30"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {error && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="rounded-xl bg-white/80 p-4 text-sm text-amber-800 dark:bg-gray-900/60 dark:text-amber-300">
                    Carregando convites...
                </div>
            ) : (
                <div className="space-y-3">
                    {invites.map((invite) => (
                        <InviteCard
                            key={invite.invite_id}
                            invite={invite}
                            accepting={accepting}
                            onAccept={handleAccept}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}