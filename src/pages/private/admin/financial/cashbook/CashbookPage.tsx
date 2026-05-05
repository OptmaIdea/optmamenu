import { useEffect, useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Plus,
    Minus,
    ArrowUpCircle,
    ArrowDownCircle,
    History
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { CashbookService, type CashbookEntry, type CashbookSummary } from '@/services/cashbookService';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatNumberPtBr } from '@/utils/export/formatters';

export default function CashbookPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();
    const [entries, setEntries] = useState<CashbookEntry[]>([]);
    const [summary, setSummary] = useState<CashbookSummary | null>(null);
    const [loading, setLoading] = useState(true);

    async function loadData() {
        if (!storeId) return;
        try {
            setLoading(true);
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
            const now = today.toISOString();

            const [entriesData, summaryData] = await Promise.all([
                CashbookService.listByStore(storeId),
                CashbookService.getSummary(storeId, firstDayOfMonth, now)
            ]);
            setEntries(entriesData);
            setSummary(summaryData);
        } catch (err) {
            console.error('Erro ao carregar dados do livro de caixa:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadData();
        }
    }, [loadingStore, storeId]);

    if (loadingStore || loading) return <LoadingSpinner />;

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                        Livro diário de caixa
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">
                        Gerencie entradas, saídas e lançamentos financeiros simples da loja.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition shadow-sm active:scale-95">
                        <Plus size={18} />
                        Nova Entrada
                    </button>
                    <button className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition shadow-sm active:scale-95">
                        <Minus size={18} />
                        Nova Saída
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                    <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-3">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Entradas</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">
                        R$ {formatNumberPtBr(summary?.total_in || 0)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Este mês</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                    <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
                        <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
                            <TrendingDown size={20} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Saídas</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">
                        R$ {formatNumberPtBr(summary?.total_out || 0)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Este mês</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                    <div className="flex items-center gap-3 text-[#21A896] mb-3">
                        <div className="p-2 bg-[#21A896]/10 rounded-xl">
                            <Wallet size={20} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Saldo Atual</span>
                    </div>
                    <div className={`text-2xl font-black ${((summary?.balance || 0) >= 0) ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>
                        R$ {formatNumberPtBr(summary?.balance || 0)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Total acumulado</p>
                </div>
            </div>

            {/* Entries List */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <History size={18} className="text-gray-400" />
                        <h2 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">Últimos Lançamentos</h2>
                    </div>
                    <button className="text-xs font-black text-[#21A896] hover:underline uppercase tracking-widest">
                        Ver todos
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="px-6 py-4 text-left">Data</th>
                                <th className="px-6 py-4 text-left">Descrição</th>
                                <th className="px-6 py-4 text-left">Tipo</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {entries.length > 0 ? (
                                entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400 font-medium">
                                            {new Date(entry.occurred_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900 dark:text-white tracking-tight">
                                                {entry.type === 'sale' ? (
                                                    <>
                                                        Venda concluída: {entry.description.replace('Venda concluída pelo pedido ', '')}
                                                        {entry.order?.customer_name ? ` para ${entry.order.customer_name}` : ''}
                                                    </>
                                                ) : (
                                                    entry.description
                                                )}
                                            </div>
                                            {entry.payment_method && (
                                                <div className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">{entry.payment_method}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {entry.direction === 'in' ? (
                                                    <ArrowUpCircle size={16} className="text-emerald-500" />
                                                ) : (
                                                    <ArrowDownCircle size={16} className="text-rose-500" />
                                                )}
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${entry.direction === 'in' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                                    {entry.direction === 'in' ? 'Entrada' : 'Saída'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-right font-black tracking-tighter ${entry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {entry.direction === 'in' ? '+' : '-'} R$ {formatNumberPtBr(entry.amount)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-16 text-center text-gray-400 italic">
                                        Nenhum lançamento encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
