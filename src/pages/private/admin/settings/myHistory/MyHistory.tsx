import { useState, useCallback, useEffect } from 'react';
import {
    ClockIcon,
    ShieldAlert,
    Info,
    AlertTriangle,
    Flame,
    CheckCircle2,
    History,
    Inbox,
    RefreshCw,
    ChevronDown,
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import {
    getMyVisibleStoreMemberHistory,
    type MyVisibleHistoryItem,
} from '@/services/myHistoryService';
import { getActiveStoreId } from '@/utils/activeStore';

// ─── Mapeamentos amigáveis ────────────────────────────────────────────────────

const FRIENDLY_TYPE: Record<string, string> = {
    // Sessão / Acesso
    session_login: 'Login realizado',
    session_logout: 'Logout realizado',
    session_expired: 'Sessão expirada',
    password_changed: 'Senha alterada',
    profile_updated: 'Perfil atualizado',
    avatar_updated: 'Foto de perfil atualizada',
    // Ocorrências gerais
    occurrence: 'Ocorrência registrada',
    absence: 'Ausência registrada',
    tardiness: 'Atraso registrado',
    warning: 'Advertência',
    commendation: 'Elogio registrado',
    note: 'Anotação',
    training: 'Treinamento concluído',
    // Permissões
    permission_changed: 'Permissões alteradas',
    role_changed: 'Cargo alterado',
    access_granted: 'Acesso liberado',
    access_revoked: 'Acesso revogado',
    // Pedidos/Estoque
    order_created: 'Pedido criado',
    stock_adjustment: 'Ajuste de estoque',
    // Genérico
    system: 'Evento do sistema',
};

function getFriendlyType(type: string | null | undefined): string {
    if (!type) return 'Evento';
    return FRIENDLY_TYPE[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Gravidade ────────────────────────────────────────────────────────────────

type Severity = MyVisibleHistoryItem['severity'];

const SEVERITY_CONFIG: Record<
    Severity,
    {
        label: string;
        icon: React.ReactNode;
        badgeCls: string;
        borderCls: string;
        iconBgCls: string;
    }
> = {
    info: {
        label: 'Informativo',
        icon: <Info size={14} />,
        badgeCls: 'bg-[#21A896]/10 text-[#21A896] border-[#21A896]/20',
        borderCls: 'border-l-[#21A896]',
        iconBgCls: 'bg-[#21A896]/10 text-[#21A896]',
    },
    low: {
        label: 'Baixa',
        icon: <CheckCircle2 size={14} />,
        badgeCls: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
        borderCls: 'border-l-gray-400',
        iconBgCls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
    },
    medium: {
        label: 'Média',
        icon: <AlertTriangle size={14} />,
        badgeCls: 'bg-[#FBA93C]/10 text-[#FBA93C] border-[#FBA93C]/30',
        borderCls: 'border-l-[#FBA93C]',
        iconBgCls: 'bg-[#FBA93C]/10 text-[#FBA93C]',
    },
    high: {
        label: 'Alta',
        icon: <ShieldAlert size={14} />,
        badgeCls: 'bg-[#F26541]/10 text-[#F26541] border-[#F26541]/30',
        borderCls: 'border-l-[#F26541]',
        iconBgCls: 'bg-[#F26541]/10 text-[#F26541]',
    },
    critical: {
        label: 'Crítica',
        icon: <Flame size={14} />,
        badgeCls: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
        borderCls: 'border-l-red-500',
        iconBgCls: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    },
};

// ─── Formatadores ─────────────────────────────────────────────────────────────

function formatDate(iso?: string | null): string {
    if (!iso) return 'Data não informada';

    const d = new Date(iso);

    if (Number.isNaN(d.getTime())) {
        return 'Data inválida';
    }

    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatTime(iso?: string | null): string {
    if (!iso) return '';

    const d = new Date(iso);

    if (Number.isNaN(d.getTime())) {
        return '';
    }

    return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ─── Card de item ─────────────────────────────────────────────────────────────

function HistoryCard({ item }: { item: MyVisibleHistoryItem }) {
    const [expanded, setExpanded] = useState(false);
    const sev = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.info;
    const hasDescription = !!item.description?.trim();

    return (
        <div
            className={`
                bg-white dark:bg-gray-800
                rounded-2xl shadow-sm
                border border-gray-100 dark:border-gray-700
                border-l-4 ${sev.borderCls}
                transition-all duration-200
                hover:shadow-md hover:-translate-y-[1px]
            `}
        >
            <div className="p-4 sm:p-5">
                {/* Linha superior: data/hora + gravidade */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    {/* Data/Hora */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <ClockIcon size={12} />
                        <span className="font-medium">{formatDate(item.event_at)}</span>
                        {formatTime(item.event_at) && (
                            <>
                                <span>·</span>
                                <span>{formatTime(item.event_at)}</span>
                            </>
                        )}
                    </div>

                    <span className="flex-1" />

                    {/* Tipo amigável */}
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-semibold border border-gray-200 dark:border-gray-600">
                        {item.event_label || getFriendlyType(item.event_type)}
                    </span>

                    {/* Gravidade */}
                    <span
                        className={`
                            inline-flex items-center gap-1
                            text-[11px] font-bold px-2 py-0.5 rounded-full border
                            ${sev.badgeCls}
                        `}
                    >
                        {sev.icon}
                        {sev.label}
                    </span>
                </div>

                {/* Ícone + Título */}
                <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${sev.iconBgCls}`}>
                        {sev.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-snug">
                            {item.title}
                        </p>

                        {hasDescription && (
                            <>
                                {!expanded && (
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                        {item.description}
                                    </p>
                                )}

                                {expanded && (
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                                        {item.description}
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setExpanded((v) => !v)}
                                    className="mt-1.5 flex items-center gap-0.5 text-[11px] text-[#21A896] font-semibold hover:underline transition"
                                >
                                    {expanded ? 'Mostrar menos' : 'Ver mais'}
                                    <ChevronDown
                                        size={12}
                                        className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                                    />
                                </button>
                            </>
                        )}

                        {!hasDescription && (
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 italic">
                                Sem descrição adicional.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MyHistory() {
    const [items, setItems] = useState<MyVisibleHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const storeId = getActiveStoreId();

    const fetchHistory = useCallback(async () => {
        if (!storeId) {
            setLoading(false);
            setError('Nenhuma loja ativa encontrada.');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await getMyVisibleStoreMemberHistory(storeId, 100);
            setItems(data);
        } catch (err: unknown) {
            console.error('Erro ao carregar histórico:', err);
            setError('Não foi possível carregar o histórico. Tente novamente.');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    useRefreshFrame(fetchHistory);

    // Skeleton de carregamento
    if (loading) {
        return (
            <PageContainer
                title="Meu Histórico"
                subtitle="Acompanhe os registros e eventos relacionados ao seu perfil nesta loja."
                category="Configurações"
                icon={<History size={28} className="text-[#21A896]" />}
                flat
            >
                <div className="max-w-3xl mx-auto space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 border-l-4 border-l-gray-200 dark:border-l-gray-600 p-5 animate-pulse"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded-full" />
                                <div className="flex-1" />
                                <div className="h-5 w-24 bg-gray-100 dark:bg-gray-700 rounded-full" />
                                <div className="h-5 w-20 bg-gray-100 dark:bg-gray-700 rounded-full" />
                            </div>
                            <div className="flex gap-3 items-start">
                                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-full" />
                                    <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full" />
                                    <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-700 rounded-full" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer
            title="Meu Histórico"
            subtitle="Acompanhe os registros e eventos relacionados ao seu perfil nesta loja."
            category="Configurações"
            icon={<History size={28} className="text-[#21A896]" />}
            flat
        >
            <div className="max-w-3xl mx-auto">
                {/* Erro */}
                {error && (
                    <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-700 dark:text-red-400">
                        <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">Erro ao carregar histórico</p>
                            <p className="text-sm mt-0.5">{error}</p>
                            <button
                                type="button"
                                onClick={fetchHistory}
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
                            >
                                <RefreshCw size={12} />
                                Tentar novamente
                            </button>
                        </div>
                    </div>
                )}

                {/* Vazio */}
                {!error && items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-[#21A896]/10 flex items-center justify-center">
                            <Inbox size={28} className="text-[#21A896]" />
                        </div>
                        <div>
                            <p className="text-base font-bold text-gray-700 dark:text-gray-200">
                                Nenhum registro encontrado
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                Quando houver eventos registrados para o seu perfil, eles aparecerão aqui.
                            </p>
                        </div>
                    </div>
                )}

                {/* Lista */}
                {!error && items.length > 0 && (
                    <>
                        {/* Contagem */}
                        <div className="flex items-center justify-between mb-5">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-bold text-gray-700 dark:text-gray-200">{items.length}</span>{' '}
                                {items.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <HistoryCard key={item.event_id ?? `history-${idx}`} item={item} />
                            ))}
                        </div>

                        {items.length >= 100 && (
                            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
                                Exibindo os últimos 100 registros.
                            </p>
                        )}
                    </>
                )}
            </div>
        </PageContainer>
    );
}
