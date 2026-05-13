import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Eye,
    Loader2,
    Plus,
    Search,
    ShieldCheck,
    Smartphone,
    UserRound,
    Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import {
    Customers360Service,
    type CustomerListItem,
} from '@/services/customers360Service';

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

function getOwnershipLabel(customer: CustomerListItem) {
    if (customer.data_ownership === 'customer_owned') return 'Protegido';
    if (customer.data_ownership === 'mixed') return 'Misto';
    return 'Editável';
}

function getOwnershipClass(customer: CustomerListItem) {
    if (customer.data_ownership === 'customer_owned') {
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/40';
    }

    if (customer.data_ownership === 'mixed') {
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-900/40';
    }

    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/40';
}

export default function Customers() {
    const navigate = useNavigate();
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [customers, setCustomers] = useState<CustomerListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);

    async function loadCustomers() {
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
    }

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadCustomers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingStore, storeId]);

    const filteredCustomers = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return customers;

        return customers.filter((customer) => {
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
    }, [customers, search]);

    const summary = useMemo(() => {
        const total = customers.length;
        const protectedCustomers = customers.filter(
            (customer) => customer.data_ownership === 'customer_owned'
        ).length;
        const adminCustomers = customers.filter(
            (customer) => customer.source === 'admin'
        ).length;
        const totalSpent = customers.reduce(
            (sum, customer) => sum + Number(customer.total_spent || 0),
            0
        );

        return {
            total,
            protectedCustomers,
            adminCustomers,
            totalSpent,
        };
    }, [customers]);

    if (loadingStore || loading) {
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
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <Users size={14} />
                            Comercial
                        </div>

                        <h1 className="mt-3 text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                            Clientes
                        </h1>

                        <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                            Gerencie clientes diretos, clientes de WhatsApp/loja pública e acompanhe
                            pedidos, pontos, origem e governança dos dados.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/admin/customers/new')}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
                    >
                        <Plus size={18} />
                        Novo cliente
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                        Clientes
                    </p>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {summary.total}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                        Protegidos
                    </p>
                    <p className="mt-2 text-2xl font-black text-amber-600">
                        {summary.protectedCustomers}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                        Cadastrados pelo admin
                    </p>
                    <p className="mt-2 text-2xl font-black text-emerald-600">
                        {summary.adminCustomers}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                        Receita concluída
                    </p>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {formatCurrency(summary.totalSpent)}
                    </p>
                </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-md">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />

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

                <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                            <thead className="bg-gray-50 dark:bg-gray-950">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                                        Cliente
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                                        Origem
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                                        Governança
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                                        Fidelidade
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">
                                        Compras
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-black uppercase text-gray-500">
                                        Ações
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                                {filteredCustomers.map((customer) => (
                                    <tr
                                        key={customer.id}
                                        className="transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                    <UserRound size={17} />
                                                </div>

                                                <div>
                                                    <p className="font-black text-gray-900 dark:text-white">
                                                        {customer.full_name || 'Cliente sem nome'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {customer.phone}
                                                    </p>
                                                    {customer.email && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {customer.email}
                                                        </p>
                                                    )}
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
                                            <span
                                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getOwnershipClass(
                                                    customer
                                                )}`}
                                            >
                                                {getOwnershipLabel(customer)}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3">
                                            <p className="font-black text-gray-900 dark:text-white">
                                                {customer.loyalty_points || 0} pts
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {customer.current_tier_name ||
                                                    customer.loyalty_tier ||
                                                    'Bronze'}
                                            </p>
                                        </td>

                                        <td className="px-4 py-3">
                                            <p className="font-black text-gray-900 dark:text-white">
                                                {customer.total_orders || 0} pedidos
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatCurrency(customer.total_spent || 0)}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Última: {formatDate(customer.last_order_at)}
                                            </p>
                                        </td>

                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/admin/customers/${customer.id}`)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                            >
                                                <Eye size={15} />
                                                Vida do cliente
                                            </button>
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
        </div>
    );
}