import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Info,
    RefreshCw,
    XCircle,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatDateTimePtBr } from '@/utils/dateTime';
import type { OperationalTimelineEvent } from '../types/operationalTimeline.types';

type OperationalTimelineProps = {
    events: OperationalTimelineEvent[];
    loading?: boolean;
    title?: string;
    description?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    compact?: boolean;
    className?: string;
    onRefresh?: () => void;
};

function getSeverityIcon(severity?: string | null) {
    switch (severity) {
        case 'success':
            return <CheckCircle2 className="h-4 w-4" />;
        case 'warning':
            return <AlertTriangle className="h-4 w-4" />;
        case 'danger':
        case 'critical':
            return <XCircle className="h-4 w-4" />;
        default:
            return <Info className="h-4 w-4" />;
    }
}

function getSeverityClassName(severity?: string | null) {
    switch (severity) {
        case 'success':
            return 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800';
        case 'warning':
            return 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800';
        case 'danger':
        case 'critical':
            return 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800';
        default:
            return 'bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800';
    }
}

function formatTimelineDate(value?: string | null) {
    return formatDateTimePtBr(value, '—');
}

function getEventSubtitle(event: OperationalTimelineEvent) {
    const parts = [
        event.channel_label,
        event.responsible_name ? `Responsável: ${event.responsible_name}` : null,
        event.supplier_name ? `Fornecedor: ${event.supplier_name}` : null,
        event.reference_label ? `Ref.: ${event.reference_label}` : null,
    ].filter(Boolean);

    return parts.join(' · ');
}

export default function OperationalTimeline({
    events,
    loading = false,
    title = 'Linha do tempo operacional',
    description = 'Acompanhe os principais acontecimentos deste processo.',
    emptyTitle = 'Nenhum evento registrado',
    emptyDescription = 'Assim que houver movimentações operacionais, elas aparecerão aqui.',
    compact = false,
    className = '',
    onRefresh,
}: OperationalTimelineProps) {
    return (
        <section className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 ${className}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
                <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
                    {description && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{description}</p>
                    )}
                </div>

                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                )}
            </div>

            <div className={compact ? 'p-4' : 'p-5'}>
                {loading ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                        <LoadingSpinner />
                    </div>
                ) : events.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center dark:border-gray-700">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                            <Clock3 className="h-5 w-5" />
                        </div>
                        <h5 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{emptyTitle}</h5>
                        <p className="mx-auto mt-1 max-w-xl text-xs text-slate-500 dark:text-gray-400">
                            {emptyDescription}
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="absolute left-4 top-2 h-[calc(100%-1rem)] w-px bg-gray-200 dark:bg-gray-800" />

                        <div className="space-y-4">
                            {events.map((event) => {
                                const subtitle = getEventSubtitle(event);

                                return (
                                    <article key={event.id} className="relative flex gap-3">
                                        <div
                                            className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${getSeverityClassName(
                                                event.severity,
                                            )}`}
                                        >
                                            {getSeverityIcon(event.severity)}
                                        </div>

                                        <div className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {event.event_type_label || event.title}
                                                    </h5>

                                                    {event.description && (
                                                        <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                                                            {event.description}
                                                        </p>
                                                    )}

                                                    {subtitle && (
                                                        <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">
                                                            {subtitle}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="text-right text-xs text-slate-500 dark:text-gray-400">
                                                    {formatTimelineDate(event.occurred_at)}
                                                </div>
                                            </div>

                                            {!compact && (
                                                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                                    {event.entity_type_label && (
                                                        <span className="rounded-full bg-white px-2 py-1 font-medium text-slate-600 ring-1 ring-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:ring-gray-700">
                                                            {event.entity_type_label}
                                                        </span>
                                                    )}

                                                    {event.status_label && (
                                                        <span className="rounded-full bg-white px-2 py-1 font-medium text-slate-600 ring-1 ring-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:ring-gray-700">
                                                            {event.status_label}
                                                        </span>
                                                    )}

                                                    {event.severity_label && (
                                                        <span className="rounded-full bg-white px-2 py-1 font-medium text-slate-600 ring-1 ring-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:ring-gray-700">
                                                            {event.severity_label}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}