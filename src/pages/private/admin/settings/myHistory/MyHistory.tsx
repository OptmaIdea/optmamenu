import { useState, useCallback, useEffect, useMemo } from 'react';
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
    Filter,
    X,
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import {
    getMyVisibleActivityLogs,
    type MyVisibleActivityLog,
} from '@/services/myHistoryService';
import { getActiveStoreId } from '@/utils/activeStore';


// ─── Gravidade ────────────────────────────────────────────────────────────────

type Severity = 'info' | 'warning' | 'low' | 'medium' | 'high' | 'critical';

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
    warning: {
        label: 'Atenção',
        icon: <AlertTriangle size={14} />,
        badgeCls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
        borderCls: 'border-l-amber-500',
        iconBgCls: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
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

function formatBoolean(value: unknown) {
    return value === true ? 'Sim' : value === false ? 'Não' : String(value ?? '');
}

function translateRole(role: string) {
    const map: Record<string, string> = {
        owner: 'Proprietário',
        admin: 'Administrador',
        manager: 'Gerente',
        stock: 'Estoque',
        cashier: 'Caixa',
        sales: 'Vendas',
        staff: 'Equipe',
        viewer: 'Visualizador',
    };

    return map[role] ?? role;
}

function formatMyHistoryDetails(log: {
    action?: string | null;
    details?: Record<string, unknown> | null;
}) {
    const action = log.action ?? '';
    const details = log.details ?? {};

    if (action === 'store_idle_timeout_settings_updated') {
        const enabled = details.idle_timeout_enabled;
        const minutes = details.idle_timeout_minutes;

        return [
            `Encerramento por inatividade: ${formatBoolean(enabled)}`,
            minutes ? `Tempo configurado: ${minutes} minutos` : null,
        ]
            .filter(Boolean)
            .join(' • ');
    }

    if (action === 'session_store_selected') {
        const storeName = details.store_name;
        const role = details.role;

        return [
            storeName ? `Loja acessada: ${storeName}` : null,
            role ? `Função: ${translateRole(String(role))}` : null,
        ]
            .filter(Boolean)
            .join(' • ');
    }

    if (action === 'session_disconnected') {
        return (
            String(details.description || '') ||
            'Sessão encerrada automaticamente.'
        );
    }

    if (action === 'store_member_profile_updated_by_self') {
        const changedFields = details.changed_fields;

        if (Array.isArray(changedFields) && changedFields.length > 0) {
            return `Campos atualizados: ${changedFields.join(', ')}.`;
        }

        return 'Dados pessoais atualizados pelo próprio usuário.';
    }

    const message = details.message || details.description;

    if (typeof message === 'string' && message.trim()) {
        return message;
    }

    return 'Registro de atividade do usuário.';
}

function formatDateTimeBR(value: string | Date) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function getActionLabel(action: string | null | undefined): string {
    if (!action) return 'Ação desconhecida';
    const labels: Record<string, string> = {
        store_idle_timeout_settings_updated: 'Configurações de inatividade atualizadas',
        session_store_selected: 'Loja selecionada',
        session_disconnected: 'Sessão desconectada',
        store_member_profile_updated_by_self: 'Perfil atualizado pelo próprio usuário',
        login: 'Login efetuado',
        logout: 'Logout efetuado',
        user_session_event: 'Evento de sessão do usuário',
    };
    return labels[action] ?? action;
}

// ─── Card de item ─────────────────────────────────────────────────────────────

function HistoryCard({ item }: { item: MyVisibleActivityLog }) {
    const [expanded, setExpanded] = useState(false);
    
    // Mapeamento dinâmico de gravidade com base no resultado (outcome)
    const severity = item.outcome === 'failure' ? 'high' : 'info';
    const sev = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;

    // Formatação amigável do campo details
    const descriptionText = useMemo(() => {
        return formatMyHistoryDetails(item);
    }, [item]);

    const hasDescription = !!descriptionText.trim();

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
                        <span className="font-medium">{formatDateTimeBR(item.created_at)}</span>
                    </div>

                    <span className="flex-1" />

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
                            {item.display_action || getActionLabel(item.action)}
                        </p>

                        {hasDescription && (
                            <>
                                {!expanded && (
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                        {descriptionText}
                                    </p>
                                )}

                                {expanded && (
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                                        {descriptionText}
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
    const [items, setItems] = useState<MyVisibleActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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
            const data = await getMyVisibleActivityLogs({
                storeId,
                startDate: dateFrom || null,
                endDate: dateTo || null,
                actionFilter: typeFilter.trim() || null,
                outcomeFilter: outcomeFilter === 'all' ? null : outcomeFilter || null
            });
            setItems(data);
        } catch (err: unknown) {
            console.error('Erro ao carregar histórico:', err);
            setError('Não foi possível carregar o histórico. Tente novamente.');
        } finally {
            setLoading(false);
        }
    }, [storeId, dateFrom, dateTo, typeFilter, outcomeFilter]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    useRefreshFrame(fetchHistory);

    const filteredItems = useMemo(() => {
        return [...items].sort((a, b) => {
            const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
            return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
        });
    }, [items, sortOrder]);

    const hasActiveFilters = !!dateFrom || !!dateTo || !!typeFilter || outcomeFilter !== 'all' || sortOrder !== 'desc';

    const handleClearFilters = () => {
        setDateFrom('');
        setDateTo('');
        setTypeFilter('');
        setOutcomeFilter('all');
        setSortOrder('desc');
    };

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

                {/* Filtros */}
                {!error && items.length > 0 && (
                    <div className="mb-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <Filter size={14} className="text-[#21A896]" />
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                Filtros
                            </span>
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-[#F26541] transition"
                                >
                                    <X size={12} />
                                    Limpar filtros
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                    De
                                </label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    max={dateTo || undefined}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                    Até
                                </label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    min={dateFrom || undefined}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                    Ação
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: login, update"
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                    Resultado
                                </label>
                                <select
                                    value={outcomeFilter}
                                    onChange={(e) => setOutcomeFilter(e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30"
                                >
                                    <option value="all">Todos os resultados</option>
                                    <option value="success">Sucesso</option>
                                    <option value="failure">Falha</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                    Ordenar por data
                                </label>
                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30"
                                >
                                    <option value="desc">Mais recente primeiro</option>
                                    <option value="asc">Mais antigo primeiro</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Vazio (sem itens carregados) */}
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

                {/* Vazio (com filtros sem resultado) */}
                {!error && items.length > 0 && filteredItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            <Inbox size={28} className="text-gray-400" />
                        </div>
                        <div>
                            <p className="text-base font-bold text-gray-700 dark:text-gray-200">
                                Nenhum resultado para os filtros aplicados
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                Ajuste o período ou o tipo para visualizar outros registros.
                            </p>
                        </div>
                    </div>
                )}

                {/* Lista */}
                {!error && filteredItems.length > 0 && (
                    <>
                        {/* Contagem */}
                        <div className="flex items-center justify-between mb-5">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-bold text-gray-700 dark:text-gray-200">
                                    {filteredItems.length}
                                </span>{' '}
                                {filteredItems.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                                {hasActiveFilters && items.length !== filteredItems.length && (
                                    <span className="text-gray-400 dark:text-gray-500">
                                        {' '}
                                        de {items.length}
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {filteredItems.map((item, idx) => (
                                <HistoryCard key={item.id ?? `history-${idx}`} item={item} />
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
