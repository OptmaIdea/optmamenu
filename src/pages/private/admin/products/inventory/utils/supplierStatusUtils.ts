import {
    BadgeCheck,
    Ban,
    CircleDashed,
    Clock,
    Power,
    PowerOff,
    ShieldAlert,
    Star,
    XCircle,
} from 'lucide-react';

export type SupplierHomologationStatus =
    | 'not_evaluated'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'blocked'
    | string
    | null
    | undefined;

export function getSupplierHomologationLabel(status?: string | null) {
    switch (String(status ?? 'not_evaluated').toLowerCase()) {
        case 'approved':
            return 'Aprovado';
        case 'pending':
            return 'Em análise';
        case 'rejected':
        case 'reproved':
        case 'reprovado':
            return 'Rejeitado';
        case 'blocked':
        case 'bloqueado':
            return 'Bloqueado na homologação';
        case 'not_evaluated':
        default:
            return 'Não avaliado';
    }
}

export function getSupplierHomologationClassName(status: SupplierHomologationStatus) {
    switch (String(status ?? 'not_evaluated').toLowerCase()) {
        case 'approved':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'pending':
            return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'rejected':
        case 'reproved':
        case 'reprovado':
            return 'bg-red-100 text-red-700 border-red-200';
        case 'blocked':
        case 'bloqueado':
            return 'bg-red-100 text-red-800 border-red-300';
        case 'not_evaluated':
        default:
            return 'bg-gray-100 text-gray-700 border-gray-200';
    }
}

export function getSupplierHomologationIcon(status: SupplierHomologationStatus) {
    switch (String(status ?? 'not_evaluated').toLowerCase()) {
        case 'approved':
            return BadgeCheck;
        case 'pending':
            return Clock;
        case 'rejected':
        case 'reproved':
        case 'reprovado':
            return XCircle;
        case 'blocked':
        case 'bloqueado':
            return ShieldAlert;
        case 'not_evaluated':
        default:
            return CircleDashed;
    }
}

export function isSupplierHomologationRejected(status: SupplierHomologationStatus) {
    return ['rejected', 'reproved', 'reprovado'].includes(
        String(status ?? '').toLowerCase(),
    );
}

export function isSupplierHomologationBlocked(status: SupplierHomologationStatus) {
    return ['blocked', 'bloqueado'].includes(String(status ?? '').toLowerCase());
}

export function isSupplierPurchaseEligible(supplier: {
    active?: boolean | null;
    blocked?: boolean | null;
    homologation_status?: string | null;
}) {
    const homologation = String(
        supplier.homologation_status ?? 'not_evaluated',
    ).toLowerCase();

    return (
        supplier.active !== false &&
        supplier.blocked !== true &&
        !['rejected', 'reproved', 'reprovado', 'blocked', 'bloqueado'].includes(
            homologation,
        )
    );
}

export function getSupplierOperationalBadges(supplier: {
    active?: boolean | null;
    blocked?: boolean | null;
    preferred_supplier?: boolean | null;
    homologation_status?: SupplierHomologationStatus;
}) {
    const badges: Array<{
        key: string;
        label: string;
        title: string;
        icon: any;
        className: string;
    }> = [];

    const HomologationIcon = getSupplierHomologationIcon(supplier.homologation_status);

    badges.push({
        key: 'homologation',
        label: getSupplierHomologationLabel(supplier.homologation_status),
        title: `Homologação: ${getSupplierHomologationLabel(supplier.homologation_status)}`,
        icon: HomologationIcon,
        className: getSupplierHomologationClassName(supplier.homologation_status),
    });

    if (supplier.active === false) {
        badges.push({
            key: 'inactive',
            label: 'Inativo',
            title: 'Fornecedor inativo',
            icon: PowerOff,
            className: 'bg-gray-100 text-gray-700 border-gray-200',
        });
    } else {
        badges.push({
            key: 'active',
            label: 'Ativo',
            title: 'Fornecedor ativo',
            icon: Power,
            className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        });
    }

    if (supplier.blocked === true) {
        badges.push({
            key: 'blocked',
            label: 'Bloqueado operacional',
            title: 'Fornecedor bloqueado operacionalmente',
            icon: Ban,
            className: 'bg-red-100 text-red-700 border-red-200',
        });
    }

    if (supplier.preferred_supplier === true) {
        badges.push({
            key: 'preferred',
            label: 'Preferencial',
            title: 'Fornecedor preferencial',
            icon: Star,
            className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        });
    }

    return badges;
}