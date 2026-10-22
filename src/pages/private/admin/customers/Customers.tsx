import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    Eye,
    GitMerge,
    History,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Smartphone,
    Trash2,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import PageContainer from '@/components/common/PageContainer';
import { systemConfirm } from '@/components/common/SystemDialogProvider';
import {
    Customers360Service,
    type CustomerDeletionAuditItem,
    type CustomerDuplicateCandidate,
    type CustomerDuplicateSummary,
    type CustomerListItem,
    type CustomerMergeHistoryItem,
} from '@/services/customers360Service';

type CustomersView = 'customers' | 'duplicates' | 'history';

function formatCurrency(value: unknown) {
    const number = Number(value || 0);

    return number.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function formatDate(value?: string | null) {
    if (!value) return '—';

    return new Date(value).toLocaleDateString('pt-BR');
}

function formatDateTime(value?: string | null) {
    if (!value) return '—';

    return new Date(value).toLocaleString('pt-BR');
}

function getSourceLabel(source?: string | null) {
    switch (source) {
        case 'admin':
            return 'Admin';
        case 'public_store':
            return 'Loja pública';
        case 'whatsapp':
            return 'WhatsApp';
        case 'qr_table':
            return 'QR/Mesa';
        case 'direct_sale':
            return 'Venda direta';
        case 'import':
            return 'Importado';
        default:
            return 'Outro';
    }
}

function getOwnershipLabel(customer: Pick<CustomerListItem, 'data_ownership'> | Pick<CustomerDuplicateSummary, 'data_ownership'>) {
    if (customer.data_ownership === 'customer_owned') return 'Protegido';
    if (customer.data_ownership === 'mixed') return 'Misto';
    return 'Editável';
}

function getOwnershipClass(customer: Pick<CustomerListItem, 'data_ownership'> | Pick<CustomerDuplicateSummary, 'data_ownership'>) {
    if (customer.data_ownership === 'customer_owned') {
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/40';
    }

    if (customer.data_ownership === 'mixed') {
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-900/40';
    }

    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/40';
}

function getMatchReasonLabel(reason: string) {
    switch (reason) {
        case 'phone':
            return 'Telefone';
        case 'cpf':
            return 'CPF';
        case 'email':
            return 'E-mail';
        case 'name_birth_date':
            return 'Nome + nascimento';
        default:
            return reason;
    }
}

function getDeletionStatusLabel(status?: string | null) {
    switch (status) {
        case 'pending':
            return 'Exclusão solicitada';
        case 'processing':
            return 'Exclusão em processamento';
        case 'executed':
            return 'Conta excluída';
        case 'failed':
            return 'Falha no processamento';
        default:
            return status || 'Status não informado';
    }
}

function getDeletionStatusClass(status?: string | null) {
    if (status === 'executed') {
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    }
    if (status === 'failed') {
        return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
    }
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
}

function getDeletionCount(summary: Record<string, unknown> | undefined, key: string) {
    const value = Number(summary?.[key] || 0);
    return Number.isFinite(value) ? value : 0;
}

function getMovedCountLabel(key: string) {
    switch (key) {
        case 'addresses':
            return 'Endereços';
        case 'benefit_rules':
            return 'Benefícios';
        case 'consent_logs':
            return 'Consentimentos';
        case 'contacts':
            return 'Contatos';
        case 'contacts_demoted_to_alternate':
            return 'Contatos convertidos em alternativos';
        case 'legal_profiles':
            return 'Perfis legais';
        case 'notifications':
            return 'Notificações';
        case 'segment_memberships_moved':
            return 'Segmentos';
        case 'vouchers':
            return 'Vouchers';
        case 'loyalty_transactions':
            return 'Movimentos de fidelidade';
        case 'orders':
            return 'Pedidos';
        case 'campaign_recipients':
            return 'Campanhas';
        default:
            return key.replace(/_/g, ' ');
    }
}

function DuplicateCustomerCard({
    customer,
    selected,
    suggested,
    onSelect,
}: {
    customer: CustomerDuplicateSummary;
    selected: boolean;
    suggested: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full rounded-2xl border p-4 text-left transition ${
                selected
                    ? 'border-[#19A999] bg-emerald-50/70 ring-2 ring-[#19A999]/15 dark:bg-emerald-950/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-gray-900 dark:text-white">
                            {customer.full_name || 'Cliente sem nome'}
                        </p>
                        {suggested && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                                Sugerido como principal
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{customer.phone}</p>
                    {customer.email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{customer.email}</p>
                    )}
                </div>

                <div
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                        selected ? 'border-[#19A999] bg-[#19A999] ring-2 ring-white dark:ring-gray-900' : 'border-gray-300 dark:border-gray-600'
                    }`}
                />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className={`rounded-full border px-2.5 py-1 font-bold ${getOwnershipClass(customer)}`}>
                    {getOwnershipLabel(customer)}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {getSourceLabel(customer.source)}
                </span>
                {customer.has_credentials && (
                    <span className="rounded-full bg-purple-50 px-2.5 py-1 font-bold text-purple-700 dark:bg-purple-950/30 dark:text-purple-200">
                        Possui credenciais
                    </span>
                )}
                {customer.phone_verified && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                        Telefone verificado
                    </span>
                )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
                <div>
                    <p className="text-gray-500 dark:text-gray-400">Pedidos</p>
                    <p className="font-black text-gray-900 dark:text-white">{customer.total_orders || 0}</p>
                </div>
                <div>
                    <p className="text-gray-500 dark:text-gray-400">Receita</p>
                    <p className="font-black text-gray-900 dark:text-white">{formatCurrency(customer.total_spent || 0)}</p>
                </div>
            </div>
        </button>
    );
}

export default function Customers() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { storeId, loading: loadingStore } = useCurrentStore();
    const { hasPermission } = usePermissions(storeId ?? null);

    const canViewCustomers = hasPermission('customers.view');
    const canManageCustomers = hasPermission('customers.manage');
    const canViewSensitiveCustomers = hasPermission('customers.sensitive.view');
    const canMergeCustomers = canManageCustomers && canViewSensitiveCustomers;

    const requestedView = searchParams.get('tab');
    const activeView: CustomersView =
        requestedView === 'duplicates' ? 'duplicates' : requestedView === 'history' ? 'history' : 'customers';

    const [customers, setCustomers] = useState<CustomerListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [filterSource, setFilterSource] = useState<string>('all');
    const [filterOwnership, setFilterOwnership] = useState<string>('all');
    const [filterPurchases, setFilterPurchases] = useState<string>('all');

    const [sortField, setSortField] = useState<'full_name' | 'source' | 'data_ownership' | 'loyalty_points' | 'total_spent'>('full_name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const [duplicateCandidates, setDuplicateCandidates] = useState<CustomerDuplicateCandidate[]>([]);
    const [duplicatesLoading, setDuplicatesLoading] = useState(false);
    const [duplicatesLoaded, setDuplicatesLoaded] = useState(false);
    const [duplicatesSensitiveVisible, setDuplicatesSensitiveVisible] = useState(false);
    const [duplicatesError, setDuplicatesError] = useState<string | null>(null);

    const [mergeHistory, setMergeHistory] = useState<CustomerMergeHistoryItem[]>([]);
    const [deletionHistory, setDeletionHistory] = useState<CustomerDeletionAuditItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [deletionProcessingId, setDeletionProcessingId] = useState<string | null>(null);

    const [selectedCandidate, setSelectedCandidate] = useState<CustomerDuplicateCandidate | null>(null);
    const [canonicalCustomerId, setCanonicalCustomerId] = useState<string>('');
    const [mergeReason, setMergeReason] = useState('');
    const [merging, setMerging] = useState(false);
    const [mergeError, setMergeError] = useState<string | null>(null);

    const setActiveView = useCallback(
        (view: CustomersView) => {
            const next = new URLSearchParams(searchParams);
            if (view === 'customers') {
                next.delete('tab');
            } else {
                next.set('tab', view);
            }
            setSearchParams(next, { replace: true });
        },
        [searchParams, setSearchParams]
    );

    const loadCustomers = useCallback(async () => {
        if (!storeId) return;

        try {
            setLoading(true);
            setError(null);

            const data = await Customers360Service.listCustomers(storeId);
            setCustomers(data);
        } catch (err: unknown) {
            console.error('Erro ao carregar clientes:', err);
            const message = err instanceof Error ? err.message : 'Erro ao carregar clientes.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    const loadDuplicates = useCallback(async () => {
        if (!storeId) return;

        try {
            setDuplicatesLoading(true);
            setDuplicatesError(null);

            const data = await Customers360Service.listDuplicateCandidates(storeId, null, 200);
            setDuplicateCandidates(data.candidates);
            setDuplicatesSensitiveVisible(data.sensitiveDataVisible);
            setDuplicatesLoaded(true);
        } catch (err: unknown) {
            console.error('Erro ao analisar duplicidades:', err);
            const message = err instanceof Error ? err.message : 'Erro ao analisar possíveis duplicidades.';
            setDuplicatesError(message);
        } finally {
            setDuplicatesLoading(false);
        }
    }, [storeId]);

    const loadHistory = useCallback(async () => {
        if (!storeId) return;

        try {
            setHistoryLoading(true);
            setHistoryError(null);

            const [mergeEvents, deletionEvents] = await Promise.all([
                Customers360Service.getMergeHistory(storeId, null, 200),
                Customers360Service.getDeletionHistory(storeId, null, 200),
            ]);
            setMergeHistory(mergeEvents);
            setDeletionHistory(deletionEvents);
            setHistoryLoaded(true);
        } catch (err: unknown) {
            console.error('Erro ao carregar histórico de clientes:', err);
            const message = err instanceof Error ? err.message : 'Erro ao carregar histórico de clientes.';
            setHistoryError(message);
        } finally {
            setHistoryLoading(false);
        }
    }, [storeId]);

    const refreshCurrentView = useCallback(async () => {
        if (activeView === 'duplicates') {
            await loadDuplicates();
            return;
        }

        if (activeView === 'history') {
            await loadHistory();
            return;
        }

        await loadCustomers();
    }, [activeView, loadCustomers, loadDuplicates, loadHistory]);

    useRefreshFrame(refreshCurrentView);

    useEffect(() => {
        if (!loadingStore && storeId) {
            void loadCustomers();
        }
    }, [loadingStore, storeId, loadCustomers]);

    useEffect(() => {
        if (!loadingStore && storeId && activeView === 'duplicates' && !duplicatesLoaded) {
            void loadDuplicates();
        }
    }, [activeView, duplicatesLoaded, loadDuplicates, loadingStore, storeId]);

    useEffect(() => {
        if (!loadingStore && storeId && activeView === 'history' && !historyLoaded) {
            void loadHistory();
        }
    }, [activeView, historyLoaded, loadHistory, loadingStore, storeId]);

    function handleSort(field: 'full_name' | 'source' | 'data_ownership' | 'loyalty_points' | 'total_spent') {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            if (field === 'loyalty_points' || field === 'total_spent') {
                setSortDirection('desc');
            } else {
                setSortDirection('asc');
            }
        }
    }

    const renderSortableHeader = (
        field: 'full_name' | 'source' | 'data_ownership' | 'loyalty_points' | 'total_spent',
        label: string
    ) => {
        const isActive = sortField === field;
        return (
            <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                <button
                    type="button"
                    onClick={() => handleSort(field)}
                    className="group inline-flex items-center gap-1.5 text-left font-black uppercase outline-none transition hover:text-gray-900 dark:hover:text-white"
                >
                    {label}
                    <span className={`inline-flex transition ${isActive ? 'text-[#19A999]' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}>
                        {isActive && sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </span>
                </button>
            </th>
        );
    };

    const filteredCustomers = useMemo(() => {
        let result = customers;
        const term = search.trim().toLowerCase();

        if (term) {
            result = result.filter((customer) => {
                const haystack = [
                    customer.full_name,
                    customer.phone,
                    customer.email,
                    customer.current_tier_name,
                    customer.source,
                    customer.tags?.join(' '),
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                return haystack.includes(term);
            });
        }

        if (filterSource !== 'all') {
            result = result.filter((customer) => customer.source === filterSource);
        }

        if (filterOwnership !== 'all') {
            result = result.filter((customer) => customer.data_ownership === filterOwnership);
        }

        if (filterPurchases !== 'all') {
            if (filterPurchases === 'has_purchases') {
                result = result.filter((customer) => (customer.total_orders || 0) > 0);
            } else if (filterPurchases === 'no_purchases') {
                result = result.filter((customer) => (customer.total_orders || 0) === 0);
            } else if (filterPurchases === 'above_100') {
                result = result.filter((customer) => (customer.total_spent || 0) > 100);
            } else if (filterPurchases === 'above_500') {
                result = result.filter((customer) => (customer.total_spent || 0) > 500);
            }
        }

        return [...result].sort((a, b) => {
            let comparison = 0;

            if (sortField === 'full_name') {
                comparison = (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR', { sensitivity: 'base' });
            } else if (sortField === 'source') {
                comparison = getSourceLabel(a.source).localeCompare(getSourceLabel(b.source), 'pt-BR', { sensitivity: 'base' });
            } else if (sortField === 'data_ownership') {
                comparison = getOwnershipLabel(a).localeCompare(getOwnershipLabel(b), 'pt-BR', { sensitivity: 'base' });
            } else if (sortField === 'loyalty_points') {
                comparison = (a.loyalty_points || 0) - (b.loyalty_points || 0);
            } else if (sortField === 'total_spent') {
                comparison = (a.total_spent || 0) - (b.total_spent || 0);
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [customers, search, filterSource, filterOwnership, filterPurchases, sortField, sortDirection]);

    const summary = useMemo(() => {
        const total = customers.length;
        const protectedCustomers = customers.filter((customer) => customer.data_ownership === 'customer_owned').length;
        const adminCustomers = customers.filter((customer) => customer.source === 'admin').length;
        const totalSpent = customers.reduce((sum, customer) => sum + Number(customer.total_spent || 0), 0);

        return {
            total,
            protectedCustomers,
            adminCustomers,
            totalSpent,
        };
    }, [customers]);

    const openMerge = (candidate: CustomerDuplicateCandidate) => {
        setSelectedCandidate(candidate);
        setCanonicalCustomerId(candidate.suggested_canonical_id);
        setMergeReason('');
        setMergeError(null);
    };

    const closeMerge = () => {
        if (merging) return;
        setSelectedCandidate(null);
        setCanonicalCustomerId('');
        setMergeReason('');
        setMergeError(null);
    };

    const handleMerge = async () => {
        if (!storeId || !selectedCandidate) return;

        if (!canMergeCustomers) {
            setMergeError('A fusão exige permissão para gerenciar clientes e visualizar dados sensíveis.');
            return;
        }

        if (mergeReason.trim().length < 8) {
            setMergeError('Informe um motivo claro com pelo menos 8 caracteres.');
            return;
        }

        const duplicateCustomerId =
            selectedCandidate.customer_a.id === canonicalCustomerId
                ? selectedCandidate.customer_b.id
                : selectedCandidate.customer_a.id;

        try {
            setMerging(true);
            setMergeError(null);

            const result = await Customers360Service.mergeCustomers({
                storeId,
                canonicalCustomerId,
                duplicateCustomerId,
                reason: mergeReason.trim(),
            });

            if (!result.ok) {
                throw new Error(result.message || result.error || 'Não foi possível concluir a fusão.');
            }

            toast.success('Clientes fundidos com segurança.');
            setSelectedCandidate(null);
            setCanonicalCustomerId('');
            setMergeReason('');
            setMergeError(null);
            setDuplicatesLoaded(false);
            setHistoryLoaded(false);
            await Promise.all([loadCustomers(), loadDuplicates(), loadHistory()]);
        } catch (err: unknown) {
            console.error('Erro ao fundir clientes:', err);
            const message = err instanceof Error ? err.message : 'Não foi possível concluir a fusão.';
            setMergeError(message);
        } finally {
            setMerging(false);
        }
    };

    const handleDeletionRetry = async (event: CustomerDeletionAuditItem) => {
        if (!storeId || !canManageCustomers || deletionProcessingId) return;

        const confirmed = await systemConfirm({
            title: 'Processar exclusão pendente?',
            description: 'A exclusão é definitiva para os dados pessoais que não precisam ser retidos. O processamento só continuará se não houver pedidos em andamento vinculados ao cliente.',
            confirmLabel: 'Processar exclusão',
            cancelLabel: 'Cancelar',
            tone: 'danger',
        });
        if (!confirmed) return;

        setDeletionProcessingId(event.id);
        try {
            await Customers360Service.processDeletionRequest(storeId, event.customer_id_snapshot);
            toast.success('Exclusão processada e credenciais revogadas.');
            await Promise.all([loadHistory(), loadCustomers()]);
        } catch (processingError) {
            const message = processingError instanceof Error
                ? processingError.message
                : 'Não foi possível processar a exclusão.';
            toast.error(message);
        } finally {
            setDeletionProcessingId(null);
        }
    };

    if (loadingStore || (loading && customers.length === 0)) {
        return (
            <div className="p-6">
                <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <Loader2 className="animate-spin" size={20} />
                        Carregando clientes...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <PageContainer
            title="Clientes"
            subtitle="Gerencie clientes, acompanhe a governança dos dados e trate possíveis cadastros duplicados com rastreabilidade."
            category="Comercial"
            icon={<Users size={28} className="text-[#19A999]" />}
            onRefresh={refreshCurrentView}
            action={
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveView('duplicates')}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                        <GitMerge size={18} />
                        Duplicidades
                        {duplicatesLoaded && duplicateCandidates.length > 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                                {duplicateCandidates.length}
                            </span>
                        )}
                    </button>
                    {canManageCustomers && (
                        <button
                            type="button"
                            onClick={() => navigate('/admin/customers/new')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b8f80]"
                        >
                            <Plus size={18} />
                            Novo cliente
                        </button>
                    )}
                </div>
            }
            flat
        >
            <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <button
                    type="button"
                    onClick={() => setActiveView('customers')}
                    className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                        activeView === 'customers'
                            ? 'bg-[#19A999] text-white'
                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                >
                    Clientes
                </button>
                <button
                    type="button"
                    onClick={() => setActiveView('duplicates')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
                        activeView === 'duplicates'
                            ? 'bg-[#19A999] text-white'
                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                >
                    <GitMerge size={15} />
                    Possíveis duplicidades
                </button>
                <button
                    type="button"
                    onClick={() => setActiveView('history')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
                        activeView === 'history'
                            ? 'bg-[#19A999] text-white'
                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                >
                    <History size={15} />
                    Histórico
                </button>
            </div>

            {activeView === 'customers' && (
                <>
                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Clientes</p>
                            <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{summary.total}</p>
                        </div>

                        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Protegidos</p>
                            <p className="mt-2 text-2xl font-black text-amber-600">{summary.protectedCustomers}</p>
                        </div>

                        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Cadastrados pelo admin</p>
                            <p className="mt-2 text-2xl font-black text-emerald-600">{summary.adminCustomers}</p>
                        </div>

                        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Receita concluída</p>
                            <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(summary.totalSpent)}</p>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative w-full lg:max-w-md">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar por nome, telefone, e-mail, tag..."
                                    className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                                <ShieldCheck size={16} />
                                Clientes da loja pública têm dados protegidos.
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 md:grid-cols-4 dark:border-gray-800">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Origem</span>
                                <select
                                    value={filterSource}
                                    onChange={(event) => setFilterSource(event.target.value)}
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                >
                                    <option value="all">Todas as origens</option>
                                    <option value="admin">Admin</option>
                                    <option value="public_store">Loja pública</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="qr_table">QR/Mesa</option>
                                    <option value="direct_sale">Venda direta</option>
                                    <option value="import">Importado</option>
                                    <option value="other">Outro</option>
                                </select>
                            </label>

                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Governança</span>
                                <select
                                    value={filterOwnership}
                                    onChange={(event) => setFilterOwnership(event.target.value)}
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                >
                                    <option value="all">Todas as governanças</option>
                                    <option value="customer_owned">Protegidos (Cliente)</option>
                                    <option value="mixed">Misto</option>
                                    <option value="store_managed">Editáveis (Loja)</option>
                                </select>
                            </label>

                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Compras</span>
                                <select
                                    value={filterPurchases}
                                    onChange={(event) => setFilterPurchases(event.target.value)}
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                >
                                    <option value="all">Todos os históricos</option>
                                    <option value="has_purchases">Com compras</option>
                                    <option value="no_purchases">Sem compras</option>
                                    <option value="above_100">Compras &gt; R$ 100,00</option>
                                    <option value="above_500">Compras &gt; R$ 500,00</option>
                                </select>
                            </label>

                            <div className="flex items-end">
                                {(filterSource !== 'all' || filterOwnership !== 'all' || filterPurchases !== 'all' || search !== '') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFilterSource('all');
                                            setFilterOwnership('all');
                                            setFilterPurchases('all');
                                            setSearch('');
                                        }}
                                        className="w-full rounded-xl border border-gray-200 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                    >
                                        Limpar filtros
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                                    <thead className="bg-gray-50 dark:bg-gray-950">
                                        <tr>
                                            {renderSortableHeader('full_name', 'Cliente')}
                                            {renderSortableHeader('source', 'Origem')}
                                            {renderSortableHeader('data_ownership', 'Governança')}
                                            {renderSortableHeader('loyalty_points', 'Fidelidade')}
                                            {renderSortableHeader('total_spent', 'Compras')}
                                            <th className="px-4 py-3 text-right text-xs font-black uppercase text-gray-500">Ações</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                                        {filteredCustomers.map((customer) => (
                                            <tr key={customer.id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/60">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                            <UserRound size={17} />
                                                        </div>

                                                        <div>
                                                            <button
                                                      type="button"
                                                      onClick={() => navigate(`/admin/customers/${customer.id}`)}
                                                      className="text-left font-black text-gray-900 underline-offset-4 transition hover:text-[#19A999] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#19A999]/40 dark:text-white dark:hover:text-brand-mint"
                                                      title="Abrir Vida do Cliente"
                                                  >
                                                      {customer.full_name || 'Cliente sem nome'}
                                                  </button>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</p>
                                                            {customer.email && <p className="text-xs text-gray-500 dark:text-gray-400">{customer.email}</p>}
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                                        <Smartphone size={13} />
                                                        {getSourceLabel(customer.source)}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getOwnershipClass(customer)}`}>
                                                        {getOwnershipLabel(customer)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <p className="font-black text-gray-900 dark:text-white">{customer.loyalty_points || 0} pts</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{customer.current_tier_name || customer.loyalty_tier || 'Bronze'}</p>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <p className="font-black text-gray-900 dark:text-white">{customer.total_orders || 0} pedidos</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(customer.total_spent || 0)}</p>
                                                    <p className="text-xs text-gray-400">Última: {formatDate(customer.last_order_at)}</p>
                                                </td>

                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {canViewCustomers && (
                                                            <div className="group relative">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => navigate(`/admin/customers/${customer.id}`)}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                                >
                                                                    <Eye size={15} />
                                                                </button>
                                                                <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-950 px-2.5 py-1 text-[10px] font-bold text-white opacity-0 shadow-md transition duration-200 group-hover:opacity-100 dark:bg-gray-800">
                                                                    Vida do cliente
                                                                </span>
                                                            </div>
                                                        )}

                                                        {canManageCustomers && customer.data_ownership !== 'customer_owned' && customer.editable_by_store !== false && (
                                                            <div className="group relative">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => navigate(`/admin/customers/${customer.id}/edit`)}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                                >
                                                                    <Pencil size={15} />
                                                                </button>
                                                                <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-950 px-2.5 py-1 text-[10px] font-bold text-white opacity-0 shadow-md transition duration-200 group-hover:opacity-100 dark:bg-gray-800">
                                                                    Editar
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {filteredCustomers.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-10 text-center">
                                                    <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                                        <AlertTriangle className="mx-auto mb-2" size={20} />
                                                        Nenhum cliente encontrado.
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeView === 'duplicates' && (
                <div className="space-y-4">
                    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <GitMerge size={20} className="text-[#19A999]" />
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Central de possíveis duplicidades</h2>
                                </div>
                                <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                                    O sistema cruza telefone, CPF, e-mail e nome com data de nascimento. A fusão nunca é automática: o operador escolhe qual cadastro permanece como principal.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => void loadDuplicates()}
                                disabled={duplicatesLoading}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                <RefreshCw size={16} className={duplicatesLoading ? 'animate-spin' : ''} />
                                Reanalisar
                            </button>
                        </div>

                        {!duplicatesSensitiveVisible && (
                            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                                <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-black">Análise em modo protegido</p>
                                    <p className="mt-1 text-xs leading-relaxed">
                                        Sem <strong>customers.sensitive.view</strong>, CPF e data de nascimento não são expostos nem usados como evidência visível. Você ainda pode revisar coincidências permitidas, mas não concluir a fusão.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!canMergeCustomers && (
                            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
                                Para fundir cadastros, o usuário precisa de <strong>customers.manage</strong> e <strong>customers.sensitive.view</strong>. A análise e o histórico continuam disponíveis em leitura.
                            </div>
                        )}
                    </div>

                    {duplicatesError && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                            {duplicatesError}
                        </div>
                    )}

                    {duplicatesLoading && duplicateCandidates.length === 0 ? (
                        <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <Loader2 className="mx-auto animate-spin text-[#19A999]" size={24} />
                            <p className="mt-3 text-sm font-bold text-gray-600 dark:text-gray-300">Analisando identidade dos clientes...</p>
                        </div>
                    ) : duplicateCandidates.length === 0 ? (
                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                            <ShieldCheck className="mx-auto text-emerald-600" size={30} />
                            <p className="mt-3 text-lg font-black text-emerald-900 dark:text-emerald-100">Nenhuma duplicidade candidata encontrada</p>
                            <p className="mx-auto mt-1 max-w-xl text-sm text-emerald-700 dark:text-emerald-200">
                                A base atual não possui pares ativos que atendam aos critérios de coincidência configurados.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {duplicateCandidates.map((candidate) => (
                                <div key={`${candidate.customer_a.id}-${candidate.customer_b.id}`} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                                                    Similaridade {candidate.score}%
                                                </span>
                                                {candidate.match_reasons.map((reason) => (
                                                    <span key={reason} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                                        {getMatchReasonLabel(reason)}
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
                                                <DuplicateCustomerCard
                                                    customer={candidate.customer_a}
                                                    selected={candidate.suggested_canonical_id === candidate.customer_a.id}
                                                    suggested={candidate.suggested_canonical_id === candidate.customer_a.id}
                                                    onSelect={() => undefined}
                                                />
                                                <div className="flex items-center justify-center text-gray-300 dark:text-gray-600">
                                                    <ArrowRight className="rotate-90 lg:rotate-0" size={22} />
                                                </div>
                                                <DuplicateCustomerCard
                                                    customer={candidate.customer_b}
                                                    selected={candidate.suggested_canonical_id === candidate.customer_b.id}
                                                    suggested={candidate.suggested_canonical_id === candidate.customer_b.id}
                                                    onSelect={() => undefined}
                                                />
                                            </div>
                                        </div>

                                        <div className="xl:w-48">
                                            <button
                                                type="button"
                                                onClick={() => openMerge(candidate)}
                                                disabled={!canMergeCustomers}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#F1613A] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#d95331] disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <GitMerge size={16} />
                                                Revisar fusão
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/admin/customers/${candidate.suggested_canonical_id}`)}
                                                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                            >
                                                <Eye size={14} />
                                                Ver principal sugerido
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeView === 'history' && (
                <div className="space-y-6">
                    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <History size={20} className="text-[#19A999]" />
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Histórico de clientes</h2>
                                </div>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Acompanhe exclusões de conta solicitadas pelo titular e fusões administrativas, mantendo a rastreabilidade sem reexpor dados pessoais apagados.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => void loadHistory()}
                                disabled={historyLoading}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                <RefreshCw size={16} className={historyLoading ? 'animate-spin' : ''} />
                                Atualizar
                            </button>
                        </div>
                    </div>

                    {historyError && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                            {historyError}
                        </div>
                    )}

                    {historyLoading && mergeHistory.length === 0 && deletionHistory.length === 0 ? (
                        <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <Loader2 className="mx-auto animate-spin text-[#19A999]" size={24} />
                            <p className="mt-3 text-sm font-bold text-gray-600 dark:text-gray-300">Carregando histórico...</p>
                        </div>
                    ) : (
                        <>
                            <section className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Trash2 size={18} className="text-slate-500" />
                                    <h3 className="font-black text-gray-900 dark:text-white">Solicitações e exclusões de conta</h3>
                                </div>

                                {deletionHistory.length === 0 ? (
                                    <div className="rounded-3xl border border-gray-100 bg-white p-7 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                        <p className="font-black text-gray-900 dark:text-white">Nenhuma solicitação de exclusão registrada</p>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Pedidos feitos pelo portal do cliente aparecerão aqui após a reautenticação forte.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {deletionHistory.map((event) => {
                                            const summary = event.execution_summary || {};
                                            return (
                                                <div key={event.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`rounded-full px-3 py-1 text-xs font-black ${getDeletionStatusClass(event.status)}`}>
                                                                    {getDeletionStatusLabel(event.status)}
                                                                </span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                    Solicitada em {formatDateTime(event.requested_at)}
                                                                </span>
                                                                {event.executed_at && (
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                        · concluída em {formatDateTime(event.executed_at)}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <p className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
                                                                Referência técnica do cadastro: {event.customer_id_snapshot.slice(0, 8)}…
                                                            </p>
                                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                                Origem: {event.request_source === 'customer_portal' ? 'Portal do cliente' : event.request_source || 'Não informada'}
                                                                {event.reauth_method ? ` · confirmação: ${event.reauth_method === 'password+otp' ? 'senha + SMS' : event.reauth_method}` : ''}
                                                            </p>

                                                            {canManageCustomers && ['pending', 'processing'].includes(event.status) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleDeletionRetry(event)}
                                                                    disabled={Boolean(deletionProcessingId)}
                                                                    className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/20"
                                                                >
                                                                    {deletionProcessingId === event.id
                                                                        ? <Loader2 size={15} className="animate-spin" />
                                                                        : <Trash2 size={15} />}
                                                                    {deletionProcessingId === event.id ? 'Processando…' : 'Processar agora'}
                                                                </button>
                                                            )}

                                                            {event.status === 'executed' && (
                                                                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 sm:grid-cols-4 dark:border-gray-800">
                                                                    <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-950">
                                                                        <p className="text-[10px] font-bold uppercase text-gray-500">Cadastros apagados</p>
                                                                        <p className="mt-1 font-black text-gray-900 dark:text-white">{getDeletionCount(summary, 'customer_records_deleted')}</p>
                                                                    </div>
                                                                    <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-950">
                                                                        <p className="text-[10px] font-bold uppercase text-gray-500">Acessos revogados</p>
                                                                        <p className="mt-1 font-black text-gray-900 dark:text-white">{getDeletionCount(summary, 'auth_users_revoked')}</p>
                                                                    </div>
                                                                    <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-950">
                                                                        <p className="text-[10px] font-bold uppercase text-gray-500">Pedidos anonimizados</p>
                                                                        <p className="mt-1 font-black text-gray-900 dark:text-white">{getDeletionCount(summary, 'orders_retained_anonymized')}</p>
                                                                    </div>
                                                                    <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-950">
                                                                        <p className="text-[10px] font-bold uppercase text-gray-500">Lançamentos desvinculados</p>
                                                                        <p className="mt-1 font-black text-gray-900 dark:text-white">{getDeletionCount(summary, 'cashbook_entries_retained_detached')}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            <section className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <GitMerge size={18} className="text-[#19A999]" />
                                    <h3 className="font-black text-gray-900 dark:text-white">Histórico de fusões</h3>
                                </div>

                                {mergeHistory.length === 0 ? (
                                    <div className="rounded-3xl border border-gray-100 bg-white p-7 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                        <p className="font-black text-gray-900 dark:text-white">Nenhuma fusão registrada</p>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Quando uma fusão for concluída, o evento aparecerá aqui com o motivo e os vínculos transferidos.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {mergeHistory.map((event) => (
                                            <div key={event.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                                                                Fusão concluída
                                                            </span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(event.created_at)}</span>
                                                        </div>

                                                        <p className="mt-3 text-sm font-black text-gray-900 dark:text-white">{event.reason}</p>

                                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/admin/customers/${event.canonical_customer_id}`)}
                                                                className="rounded-lg border border-gray-200 px-2.5 py-1 font-bold transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                                            >
                                                                Principal: {event.canonical_customer_id.slice(0, 8)}…
                                                            </button>
                                                            <ArrowRight size={14} className="text-gray-400" />
                                                            <span className="rounded-lg bg-gray-100 px-2.5 py-1 font-bold dark:bg-gray-800">
                                                                Absorvido: {event.duplicate_customer_id.slice(0, 8)}…
                                                            </span>
                                                        </div>

                                                        {event.match_basis?.length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {event.match_basis.map((reason) => (
                                                                    <span key={reason} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                                        {getMatchReasonLabel(reason)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {event.moved_counts && Object.keys(event.moved_counts).length > 0 && (
                                                            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-800">
                                                                {Object.entries(event.moved_counts).map(([key, value]) => (
                                                                    <div key={key} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-950">
                                                                        <p className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">{getMovedCountLabel(key)}</p>
                                                                        <p className="mt-1 font-black text-gray-900 dark:text-white">{Number(value || 0)}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </div>
            )}

            {selectedCandidate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={closeMerge}>
                    <div
                        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-900">
                            <div>
                                <div className="flex items-center gap-2">
                                    <GitMerge className="text-[#F1613A]" size={22} />
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Revisar fusão de clientes</h2>
                                </div>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Escolha o cadastro que permanecerá como principal. O outro será marcado como fundido e seus vínculos serão transferidos.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeMerge}
                                disabled={merging}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-5 p-6">
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-black">Ação crítica e auditada</p>
                                        <p className="mt-1 text-xs leading-relaxed">
                                            A fusão altera referências de pedidos, fidelidade, endereços, contatos e demais vínculos suportados. O banco bloqueia conflitos de identidade, CPF, nascimento, credenciais e perfis legais antes de aplicar qualquer mudança.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <p className="mb-3 text-sm font-black text-gray-900 dark:text-white">1. Qual cadastro deve permanecer?</p>
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <DuplicateCustomerCard
                                        customer={selectedCandidate.customer_a}
                                        selected={canonicalCustomerId === selectedCandidate.customer_a.id}
                                        suggested={selectedCandidate.suggested_canonical_id === selectedCandidate.customer_a.id}
                                        onSelect={() => setCanonicalCustomerId(selectedCandidate.customer_a.id)}
                                    />
                                    <DuplicateCustomerCard
                                        customer={selectedCandidate.customer_b}
                                        selected={canonicalCustomerId === selectedCandidate.customer_b.id}
                                        suggested={selectedCandidate.suggested_canonical_id === selectedCandidate.customer_b.id}
                                        onSelect={() => setCanonicalCustomerId(selectedCandidate.customer_b.id)}
                                    />
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-black text-gray-900 dark:text-white">2. Evidências encontradas</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {selectedCandidate.match_reasons.map((reason) => (
                                        <span key={reason} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                            {getMatchReasonLabel(reason)}
                                        </span>
                                    ))}
                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                                        Similaridade {selectedCandidate.score}%
                                    </span>
                                </div>
                            </div>

                            <label className="block">
                                <span className="text-sm font-black text-gray-900 dark:text-white">3. Motivo da fusão</span>
                                <textarea
                                    value={mergeReason}
                                    onChange={(event) => setMergeReason(event.target.value)}
                                    rows={4}
                                    placeholder="Ex.: Cadastro duplicado criado no checkout; telefone e e-mail pertencem à mesma pessoa."
                                    className="mt-2 w-full resize-y rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#19A999] focus:ring-2 focus:ring-[#19A999]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                                <span className={`mt-1 block text-xs ${mergeReason.trim().length >= 8 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {mergeReason.trim().length}/8 caracteres mínimos
                                </span>
                            </label>

                            {mergeError && (
                                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                                    {mergeError}
                                </div>
                            )}
                        </div>

                        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-6 py-4 sm:flex-row sm:justify-end dark:border-gray-700 dark:bg-gray-900">
                            <button
                                type="button"
                                onClick={closeMerge}
                                disabled={merging}
                                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleMerge()}
                                disabled={merging || !canonicalCustomerId || mergeReason.trim().length < 8 || !canMergeCustomers}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F1613A] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#d95331] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {merging ? <Loader2 size={16} className="animate-spin" /> : <GitMerge size={16} />}
                                Confirmar fusão definitiva
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
