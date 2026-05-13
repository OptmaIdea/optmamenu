import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BadgeDollarSign,
    CalendarClock,
    ClipboardList,
    Coins,
    Edit3,
    Loader2,
    MapPin,
    ShieldCheck,
    Tags,
    UserRound,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import {
    Customers360Service,
    type Customer360,
} from '@/services/customers360Service';

function formatCurrency(value: unknown) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function formatDateTime(value?: string | null) {
    if (!value) return '—';

    return new Date(value).toLocaleString('pt-BR');
}

function sourceLabel(source?: string | null) {
    switch (source) {
        case 'admin':
            return 'Cadastro administrativo';
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

export default function CustomerLifecyclePage() {
    const navigate = useNavigate();
    const { customerId } = useParams();
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [data, setData] = useState<Customer360 | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function loadCustomer() {
        if (!storeId || !customerId) return;

        try {
            setLoading(true);
            setError(null);

            const result = await Customers360Service.getCustomer360(storeId, customerId);
            setData(result);
        } catch (err: unknown) {
            console.error('Erro ao carregar Vida do Cliente:', err);
            const message = err instanceof Error ? err.message : 'Erro ao carregar Vida do Cliente.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId && customerId) {
            loadCustomer();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingStore, storeId, customerId]);

    const customer = data?.customer;

    const totalCompletedOrders = useMemo(() => {
        return (data?.orders || []).filter((order) => order.status === 'completed').length;
    }, [data]);

    if (loadingStore || loading) {
        return (
            <div className="p-6">
                <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <Loader2 className="animate-spin" size={20} />
                        Carregando Vida do Cliente...
                    </div>
                </div>
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="p-6">
                <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error || 'Cliente não encontrado.'}
                </div>
            </div>
        );
    }

    const isProtected =
        customer.data_ownership === 'customer_owned' || customer.editable_by_store === false;

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <button
                    type="button"
                    onClick={() => navigate('/admin/customers')}
                    className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                    <ArrowLeft size={16} />
                    Voltar para clientes
                </button>

                <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <UserRound size={28} />
                        </div>

                        <div>
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                                {customer.full_name || 'Cliente sem nome'}
                            </h1>

                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {customer.phone}
                                {customer.email ? ` • ${customer.email}` : ''}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                    {sourceLabel(customer.source)}
                                </span>

                                {isProtected ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                                        <ShieldCheck size={13} />
                                        Dados protegidos
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                                        <Edit3 size={13} />
                                        Editável pelo lojista
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate(`/admin/customers/${customer.id}/edit`)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-5 py-3 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <Edit3 size={18} />
                        Editar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-gray-500">
                        <ClipboardList size={17} />
                        <p className="text-xs font-bold uppercase">Pedidos</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {customer.total_orders || data.orders.length}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        {totalCompletedOrders} concluídos
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-gray-500">
                        <BadgeDollarSign size={17} />
                        <p className="text-xs font-bold uppercase">Total gasto</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {formatCurrency(customer.total_spent || 0)}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Coins size={17} />
                        <p className="text-xs font-bold uppercase">Pontos</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-amber-600">
                        {customer.loyalty_points || 0}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        {customer.current_tier_name || customer.loyalty_tier || 'Bronze'}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-gray-500">
                        <CalendarClock size={17} />
                        <p className="text-xs font-bold uppercase">Última compra</p>
                    </div>
                    <p className="mt-2 text-sm font-black text-gray-900 dark:text-white">
                        {formatDateTime(customer.last_order_at)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            Pedidos do cliente
                        </h2>

                        <div className="mt-4 space-y-3">
                            {data.orders.map((order) => (
                                <div
                                    key={order.id}
                                    className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
                                >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-black text-gray-900 dark:text-white">
                                                {order.order_code || order.id.slice(0, 8)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatDateTime(order.created_at)}
                                            </p>
                                        </div>

                                        <div className="text-left sm:text-right">
                                            <p className="font-black text-gray-900 dark:text-white">
                                                {formatCurrency(order.total)}
                                            </p>
                                            <p className="text-xs font-bold uppercase text-gray-500">
                                                {order.status}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {data.orders.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                                    Nenhum pedido encontrado.
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            Histórico de fidelidade
                        </h2>

                        <div className="mt-4 space-y-3">
                            {data.loyalty_transactions.map((transaction) => (
                                <div
                                    key={transaction.id}
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
                                >
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">
                                            {transaction.description || transaction.type}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatDateTime(transaction.created_at)}
                                        </p>
                                    </div>

                                    <p
                                        className={`font-black ${Number(transaction.points) >= 0
                                            ? 'text-emerald-600'
                                            : 'text-red-600'
                                            }`}
                                    >
                                        {Number(transaction.points) >= 0 ? '+' : ''}
                                        {transaction.points} pts
                                    </p>
                                </div>
                            ))}

                            {data.loyalty_transactions.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                                    Nenhuma movimentação de fidelidade.
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                            <Tags size={18} className="text-emerald-600" />
                            <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                Tags
                            </h2>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {(customer.tags || []).map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                >
                                    {tag}
                                </span>
                            ))}

                            {(!customer.tags || customer.tags.length === 0) && (
                                <p className="text-sm text-gray-500">Sem tags cadastradas.</p>
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            Observações internas
                        </h2>

                        <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                            {customer.internal_notes || 'Nenhuma observação interna.'}
                        </p>
                    </section>

                    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                            <MapPin size={18} className="text-emerald-600" />
                            <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                Endereços
                            </h2>
                        </div>

                        <div className="mt-4 space-y-3">
                            {data.addresses.map((address) => (
                                <div
                                    key={address.id}
                                    className="rounded-2xl border border-gray-100 p-4 text-sm dark:border-gray-800"
                                >
                                    <p className="font-bold text-gray-900 dark:text-white">
                                        {address.street}, {address.number}
                                    </p>
                                    <p className="text-gray-500">
                                        {address.district} — {address.city}/{address.state}
                                    </p>
                                </div>
                            ))}

                            {data.addresses.length === 0 && (
                                <p className="text-sm text-gray-500">Nenhum endereço cadastrado.</p>
                            )}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}