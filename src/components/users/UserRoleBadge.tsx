import type { UserRole } from '@/types';
import { Shield, User, Eye, Users, Crown, Package, ShoppingCart, Store } from 'lucide-react';

interface UserRoleBadgeProps {
    role: UserRole;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
}

export function UserRoleBadge({ role, size = 'md', showIcon = true }: UserRoleBadgeProps) {
    const config = {
        owner: {
            color: 'bg-brand-orange/10 text-brand-orange dark:bg-brand-orange/20 dark:text-brand-light border-brand-orange/20 dark:border-brand-orange/30',
            icon: Crown,
            label: 'Proprietário',
        },
        super_admin: {
            color: 'bg-brand-purple/20 text-brand-purple dark:bg-brand-purple/30 dark:text-brand-purple-light border-brand-purple/30 dark:border-brand-purple/40',
            icon: Crown,
            label: 'Super Admin',
        },
        admin: {
            color: 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-brand-purple-light border-brand-purple/20 dark:border-brand-purple/30',
            icon: Shield,
            label: 'Admin',
        },
        manager: {
            color: 'bg-brand-purple-light/10 text-brand-purple-light dark:bg-brand-purple-light/20 dark:text-brand-purple-light border-brand-purple-light/20 dark:border-brand-purple-light/30',
            icon: Users,
            label: 'Gerente',
        },
        stock_operator: {
            color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
            icon: Package,
            label: 'Estoque',
        },
        cashier: {
            color: 'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-brand-green border-brand-green/20 dark:border-brand-green/30',
            icon: Store,
            label: 'Caixa',
        },
        sales: {
            color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
            icon: ShoppingCart,
            label: 'Vendas',
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