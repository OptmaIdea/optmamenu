import type { UserRole } from '@/types';
import { Shield, User, Eye, Users, Crown } from 'lucide-react';

interface UserRoleBadgeProps {
    role: UserRole;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
}

export function UserRoleBadge({ role, size = 'md', showIcon = true }: UserRoleBadgeProps) {
    const config = {
        super_admin: {
            color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
            icon: Crown,
            label: 'Super Admin',
        },
        admin: {
            color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
            icon: Shield,
            label: 'Admin',
        },
        manager: {
            color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
            icon: Users,
            label: 'Gerente',
        },
        staff: {
            color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
            icon: User,
            label: 'Equipe',
        },
        viewer: {
            color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
            icon: Eye,
            label: 'Visualizador',
        },
    };

    const { color, icon: Icon, label } = config[role];
    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-xs px-2.5 py-1',
        lg: 'text-sm px-3 py-1.5',
    };
    const iconSize = {
        sm: 12,
        md: 14,
        lg: 16,
    };

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${color} ${sizeClasses[size]}`}>
            {showIcon && <Icon size={iconSize[size]} />}
            {label}
        </span>
    );
}
