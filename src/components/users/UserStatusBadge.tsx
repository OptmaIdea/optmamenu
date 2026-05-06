import type { UserStatus } from '@/types';

interface UserStatusBadgeProps {
    status: UserStatus;
    size?: 'sm' | 'md' | 'lg';
}

export function UserStatusBadge({ status, size = 'md' }: UserStatusBadgeProps) {
    const config = {
        active: {
            color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            dot: 'bg-green-500',
            label: 'Ativo',
        },
        inactive: {
            color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
            dot: 'bg-gray-500',
            label: 'Inativo',
        },
        suspended: {
            color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            dot: 'bg-red-500',
            label: 'Suspenso',
        },
        invited: {
            color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            dot: 'bg-yellow-500',
            label: 'Convidado',
        },
        pending: {
            color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            dot: 'bg-yellow-500',
            label: 'Pendente',
        },
    };

    const { color, dot, label } = config[status];

    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-xs px-2.5 py-1',
        lg: 'text-sm px-3 py-1.5',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${color} ${sizeClasses[size]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {label}
        </span>
    );
}