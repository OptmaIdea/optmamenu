import { useEffect, useMemo, useState } from 'react';
import {
    BadgeDollarSign,
    BarChart3,
    CalendarDays,
    Coins,
    CreditCard,
    Loader2,
    Package,
    ShoppingBag,
    TrendingDown,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import PageContainer from '@/components/common/PageContainer';
import {
    CommercialDashboardService,
    type CommercialDashboardData,
} from '@/services/commercialDashboardService';

function formatCurrency(value: unknown) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function formatNumber(value: unknown) {
    return Number(value || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

function formatDateTime(value?: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleString('pt-BR');
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'reserved':
            return 'Novo / pendente';
        case 'confirmed':
            return 'Em preparo';
        case 'completed':
            return 'Entregue / pronto';
        case 'cancelled':
            return 'Cancelado';
        default:
            return status;
    }
}

function getChannelLabel(channel?: string | null) {
    switch (channel) {
        case 'public_store':
            return 'Loja pública';
        case 'whatsapp':
            return 'WhatsApp';
        case 'admin':
            return 'Admin';
        case 'qr_table':
            return 'Mesa / QR';
        case 'direct_sale':
            return 'Venda direta';
        default:
            return channel || 'Não informado';
    }
}

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function monthStartIsoDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function CommercialDashboardPage() {
    const navigate = useNavigate();
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [data, setData] = useState<CommercialDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [startDate, setStartDate] = useState(monthStartIsoDate());
    const [endDate, setEndDate] = useState(todayIsoDate());

    async function loadDashboard() {
        if (!storeId) return;

        try {
            setLoading(true);
            setError(null);

            const result = await CommercialDashboardService.getDashboard({
                storeId,
                startDate,
                endDate,
            });

            setData(result);
        } catch (err: unknown) {
            console.error('Erro ao carregar dashboard comercial:', err);
            setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard comercial.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadDashboard();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingStore, storeId]);

    const statusTotal = useMemo(() => {
        return (data?.orders_by_status || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
    }, [data]);

    if (loadingStore || loading) {
        return (
            <div className="p-6">
                <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <Loader2 className="animate-spin" size={20} />
                        Carregando dashboard comercial...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <PageContainer
            title="Dashboard comercial"
            subtitle="Visão inicial de vendas, pedidos, caixa, clientes, produtos e fidelidade."
            category="Comercial"
            icon={<BarChart3 size={28} className="text-[#21A896]" />}
            onRefresh={loadDashboard}
            action={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                        Início
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="mt-1 block rounded-xl border border-gray-250 dark:border-gray-700 px-3 py-1.5 text-xs font-bold dark:bg-gray-800 dark:text-white outline-none"
                        />
                    </label>

                    <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                        Fim
                        <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="mt-1 block rounded-xl border border-gray-250 dark:border-gray-700 px-3 py-1.5 text-xs font-bold dark:bg-gray-800 dark:text-white outline-none"
                        />
                    </label>
                </div>
            }
            flat
        >

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-emerald-600">
                        <BadgeDollarSign size={18} />
                        <p className="text-xs font-bold uppercase">Vendas hoje</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {formatCurrency(data?.summary.today_sales)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        {data?.summary.today_completed_orders || 0} pedidos concluídos hoje
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-blue-600">
                        <CalendarDays size={18} />
                        <p className="text-xs font-bold uppercase">Vendas no mês</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {formatCurrency(data?.summary.month_sales)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        {data?.summary.month_completed_orders || 0} pedidos concluídos
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-amber-600">
                        <ShoppingBag size={18} />
                        <p className="text-xs font-bold uppercase">Ticket médio</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {formatCurrency(data?.summary.period_average_ticket)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        no período selecionado
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-purple-600">
                        <Users size={18} />
                        <p className="text-xs font-bold uppercase">Clientes</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {data?.customers.total_customers || 0}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        {data?.customers.new_customers_period || 0} novos no período
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-emerald-600">
                        <TrendingUp size={18} />
                        <p className="text-xs font-bold uppercase">Entradas no caixa</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-emerald-600">
                        {formatCurrency(data?.cashbook.period_entries)}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-red-600">
                        <TrendingDown size={18} />
                        <p className="text-xs font-bold uppercase">Saídas no caixa</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-red-600">
                        {formatCurrency(data?.cashbook.period_outputs)}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-gray-600">
                        <CreditCard size={18} />
                        <p className="text-xs font-bold uppercase">Saldo do período</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {formatCurrency(data?.cashbook.period_balance)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">
                        Pedidos por status
                    </h2>

                    <div className="mt-4 space-y-3">
                        {(data?.orders_by_status || []).map((item) => {
                            const percent = statusTotal > 0 ? (Number(item.count) / statusTotal) * 100 : 0;

                            return (
                                <div key={item.status}>
                                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                        <span className="font-bold text-gray-700 dark:text-gray-200">
                                            {getStatusLabel(item.status)}
                                        </span>
                                        <span className="text-gray-500">
                                            {item.count} pedidos
                                        </span>
                                    </div>

                                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                        <div
                                            className="h-full rounded-full bg-emerald-500"
                                            style={{ width: `${Math.min(percent, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {(data?.orders_by_status || []).length === 0 && (
                            <p className="text-sm text-gray-500">
                                Nenhum pedido no período.
                            </p>
                        )}
                    </div>
                </section>

                <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">
                        Canais de venda
                    </h2>

                    <div className="mt-4 space-y-3">
                        {(data?.sales_by_channel || []).map((item) => (
                            <div
                                key={item.sales_channel}
                                className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
                            >
                                <div>
                                    <p className="font-black text-gray-900 dark:text-white">
                                        {getChannelLabel(item.sales_channel)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {item.count} pedidos
                                    </p>
                                </div>

                                <p className="font-black text-emerald-600">
                                    {formatCurrency(item.total)}
                                </p>
                            </div>
                        ))}

                        {(data?.sales_by_channel || []).length === 0 && (
                            <p className="text-sm text-gray-500">
                                Nenhum canal no período.
                            </p>
                        )}
                    </div>
                </section>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2">
                        <Package size={18} className="text-emerald-600" />
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            Top produtos vendidos
                        </h2>
                    </div>

                    <div className="mt-4 space-y-3">
                        {(data?.top_products || []).map((item) => (
                            <div
                                key={`${item.product_id}-${item.product_name}`}
                                className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
                            >
                                <div>
                                    <p className="font-black text-gray-900 dark:text-white">
                                        {item.product_name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatNumber(item.quantity)} un.
                                    </p>
                                </div>

                                <p className="font-black text-gray-900 dark:text-white">
                                    {formatCurrency(item.total)}
                                </p>
                            </div>
                        ))}

                        {(data?.top_products || []).length === 0 && (
                            <p className="text-sm text-gray-500">
                                Nenhum produto vendido no período.
                            </p>
                        )}
                    </div>
                </section>

                <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2">
                        <Coins size={18} className="text-amber-600" />
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            Fidelidade
                        </h2>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/30">
                            <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-200">
                                Pontos emitidos
                            </p>
                            <p className="mt-2 text-xl font-black text-amber-700 dark:text-amber-100">
                                {formatNumber(data?.loyalty.period_points_issued)}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950">
                            <p className="text-xs font-bold uppercase text-gray-500">
                                Movimentações
                            </p>
                            <p className="mt-2 text-xl font-black text-gray-900 dark:text-white">
                                {formatNumber(data?.loyalty.period_transactions)}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                            <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-200">
                                Clientes com pontos
                            </p>
                            <p className="mt-2 text-xl font-black text-emerald-700 dark:text-emerald-100">
                                {formatNumber(data?.loyalty.active_customers_with_points)}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/admin/loyalty/advanced')}
                        className="mt-4 inline-flex items-center justify-center rounded-2xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        Ver fidelidade avançada
                    </button>
                </section>
            </div>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">
                        Pedidos recentes
                    </h2>

                    <button
                        type="button"
                        onClick={() => navigate('/admin/orders')}
                        className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        Ver pedidos
                    </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                            <thead className="bg-gray-50 dark:bg-gray-950">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                                        Pedido
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                                        Cliente
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                                        Criado em
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-black uppercase text-gray-500">
                                        Total
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                                {(data?.recent_orders || []).map((order) => (
                                    <tr key={order.id}>
                                        <td className="px-4 py-3 font-black text-gray-900 dark:text-white">
                                            {order.order_code || order.id.slice(0, 8)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-gray-700 dark:text-gray-200">
                                                {order.customer_name || 'Cliente'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {order.customer_phone || '—'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                            {getStatusLabel(order.status)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {formatDateTime(order.created_at)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-gray-900 dark:text-white">
                                            {formatCurrency(order.total)}
                                        </td>
                                    </tr>
                                ))}

                                {(data?.recent_orders || []).length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-8 text-center text-sm text-gray-500"
                                        >
                                            Nenhum pedido recente.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </PageContainer>
    );
}