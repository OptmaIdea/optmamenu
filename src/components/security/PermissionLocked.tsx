import type { ReactNode } from 'react';

export const NO_WRITE_PERMISSION_MESSAGE =
    'Você não tem permissão para executar esta alteração.';

type PermissionLockedProps = {
    locked: boolean;
    children: ReactNode;
    className?: string;
};

export function PermissionLocked({
    locked,
    children,
    className = '',
}: PermissionLockedProps) {
    return (
        <div
            title={locked ? NO_WRITE_PERMISSION_MESSAGE : undefined}
            className={`${locked ? 'cursor-not-allowed' : ''} ${className}`}
        >
            {children}
        </div>
    );
}

type LockedHintProps = {
    show: boolean;
};

export function LockedHint({ show }: LockedHintProps) {
    if (!show) return null;

    return (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            Você está visualizando esta área em modo leitura. Alterações estão bloqueadas para o seu perfil.
        </div>
    );
}
