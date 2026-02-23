
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader, Search, Users, Plus, Minus, TrendingUp, AlertCircle, Lock, ArrowLeft, User, Award, CreditCard, FileText, Calendar } from 'lucide-react';
import { toast } from 'sonner';

type TransactionFilter = 'all' | 'credits' | 'debits';

export default function ActiveCustomers({ storeId, programId }: { storeId: string, programId: string }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searching, setSearching] = useState(false);
    const [customers, setCustomers] = useState<any[]>([]);
    const [totalMembers, setTotalMembers] = useState(0);

    // Customer detail view state
    const [viewingCustomer, setViewingCustomer] = useState<any | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('all');
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    // Modal state for add/reverse
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'add' | 'reverse'>('add');
    const [amount, setAmount] = useState(0);
    const [reason, setReason] = useState('');
    const [password, setPassword] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (storeId) {
            fetchStats();
            fetchEnrolledCustomers();
        }
    }, [storeId]);

    const fetchStats = async () => {
        const { count } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .eq('loyalty_opt_in', true);
        setTotalMembers(count || 0);
    };

    const fetchEnrolledCustomers = async () => {
        setSearching(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('store_id', storeId)
                .eq('loyalty_opt_in', true)
                .order('loyalty_points', { ascending: false })
                .limit(50);

            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching enrolled customers:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.length < 3) {
            fetchEnrolledCustomers();
            return;
        }

        setSearching(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('store_id', storeId)
                .eq('loyalty_opt_in', true)
                .or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
                .limit(50);

            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Erro ao buscar clientes');
        } finally {
            setSearching(false);
        }
    };

    const viewCustomerDetail = async (customer: any) => {
        setViewingCustomer(customer);
        setTransactionFilter('all');
        await fetchTransactions(customer.id, 'all');
    };

    const fetchTransactions = async (customerId: string, filter: TransactionFilter) => {
        setLoadingTransactions(true);
        try {
            let query = supabase
                .from('loyalty_transactions')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });

            // Apply filter
            if (filter === 'credits') {
                query = query.gt('points', 0);
            } else if (filter === 'debits') {
                query = query.lt('points', 0);
            }

            const { data, error } = await query;
            if (error) throw error;
            setTransactions(data || []);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoadingTransactions(false);
        }
    };

    const openModal = (type: 'add' | 'reverse') => {
        if (!viewingCustomer) return;
        setModalType(type);
        setAmount(0);
        setReason('');
        setPassword('');
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!viewingCustomer || amount <= 0 || !reason || !password) {
            toast.error('Preencha todos os campos');
            return;
        }

        // Verify stock password via RPC
        const { data: storeData, error: storeError } = await supabase.rpc(
            'get_store_config_admin',
            { p_store_id: storeId }
        );
        if (storeError) {
            toast.error('Erro ao verificar senha');
            return;
        }
        const store = Array.isArray(storeData) ? storeData[0] : storeData;
        if (!store || store.stock_password_hash !== password) {
            toast.error('Senha incorreta');
            return;
        }

        const pointsChange = modalType === 'add' ? amount : -amount;
        const newBalance = (viewingCustomer.loyalty_points || 0) + pointsChange;

        if (newBalance < 0) {
            toast.error('Saldo insuficiente para estorno');
            return;
        }

        if (!confirm(`Confirmar ${modalType === 'add' ? 'adição' : 'estorno'} de ${amount} pontos para ${viewingCustomer.full_name || viewingCustomer.phone}?`)) {
            return;
        }

        setProcessing(true);
        try {
            // 1. Update Customer Points
            const { error: updateError } = await supabase
                .from('customers')
                .update({
                    loyalty_points: newBalance,
                    last_point_activity_at: new Date().toISOString()
                })
                .eq('id', viewingCustomer.id);

            if (updateError) throw updateError;

            // 2. Log Transaction
            const { error: transactionError } = await supabase
                .from('loyalty_transactions')
                .insert({
                    program_id: programId,
                    customer_id: viewingCustomer.id,
                    type: modalType === 'add' ? 'adjustment' : 'reversal',
                    points: pointsChange,
                    description: reason,
                    created_by: (await supabase.auth.getUser()).data.user?.id
                });

            if (transactionError) throw transactionError;

            // 3. Notification
            await supabase.from('customer_notifications').insert({
                customer_id: viewingCustomer.id,
                store_id: storeId,
                title: modalType === 'add' ? '🎁 Você ganhou pontos!' : '⚠️ Pontos estornados',
                message: modalType === 'add'
                    ? `Você recebeu ${amount} pontos. Motivo: ${reason}`
                    : `${amount} pontos foram estornados da sua conta. Motivo: ${reason}`,
                type: modalType === 'add' ? 'success' : 'warning'
            });

            toast.success(modalType === 'add' ? 'Pontos adicionados com sucesso!' : 'Pontos estornados com sucesso!');

            // Refresh customer data and transactions
            const { data: updatedCustomer } = await supabase
                .from('customers')
                .select('*')
                .eq('id', viewingCustomer.id)
                .maybeSingle();

            if (updatedCustomer) {
                setViewingCustomer(updatedCustomer);
            }

            await fetchTransactions(viewingCustomer.id, transactionFilter);
            fetchEnrolledCustomers();
            setShowModal(false);
            setAmount(0);
            setReason('');
            setPassword('');
        } catch (error: any) {
            console.error('Error processing points:', error);
            toast.error('Erro ao processar: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex justify-center items-center gap-2">
                    <Users className="text-brand-green" />
                    Clientes Ativos
                </h2>
                <p className="text-gray-500 text-sm">Gerencie pontos dos participantes do programa</p>

                <div className="mt-4 bg-green-50 dark:bg-green-900/20 py-2 px-4 rounded-full inline-flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-green-600 dark:text-green-400">Total de Membros:</span>
                    <span className="text-lg font-black text-green-700 dark:text-green-300">{totalMembers}</span>
                </div>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => {
                        setSearchTerm(e.target.value);
                        if (e.target.value === '') {
                            fetchEnrolledCustomers();
                        }
                    }}
                    placeholder="Buscar cliente cadastrado no programa..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-green outline-none transition"
                />
                {searching && <Loader className="absolute right-4 top-3.5 animate-spin text-brand-green" size={20} />}
            </form>

            {/* Customer List or Detail View */}
            {!viewingCustomer ? (
                // Customer List
                customers.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-700">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                                {searchTerm ? `${customers.length} resultado(s) encontrado(s)` : `${customers.length} cliente(s) ativo(s)`}
                            </p>
                        </div>

                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {customers.map(customer => (
                                <button
                                    key={customer.id}
                                    onClick={() => viewCustomerDetail(customer)}
                                    className="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition flex items-center justify-between text-left"
                                >
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-800 dark:text-white">{customer.full_name || 'Sem nome'}</p>
                                        <p className="text-xs text-gray-500">{customer.phone}</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <TrendingUp size={14} className="text-brand-green" />
                                            <span className="text-sm font-bold text-brand-green">{customer.loyalty_points || 0} pontos</span>
                                        </div>
                                    </div>
                                    <div className="text-gray-400">
                                        <FileText size={20} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-400">
                        <AlertCircle size={48} className="mx-auto mb-3 opacity-50" />
                        <p>Nenhum cliente cadastrado no programa</p>
                    </div>
                )
            ) : (
                // Customer Detail Card
                <div className="space-y-6">
                    {/* Back Button */}
                    <button
                        onClick={() => setViewingCustomer(null)}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-brand-green transition"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-bold">Voltar para lista</span>
                    </button>

                    {/* Customer Info Card */}
                    <div className="bg-gradient-to-br from-brand-green to-green-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                    <User size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black">{viewingCustomer.full_name || 'Cliente'}</h3>
                                    <p className="text-green-100">{viewingCustomer.phone}</p>
                                    {viewingCustomer.cpf && (
                                        <p className="text-sm text-green-100 mt-1">CPF: {viewingCustomer.cpf}</p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center gap-2 justify-end mb-2">
                                    <Award className="text-yellow-300" size={20} />
                                    <span className="text-sm font-bold text-green-100">Nível {viewingCustomer.loyalty_tier || 'Bronze'}</span>
                                </div>
                                <div className="bg-white/20 px-3 py-1 rounded-full text-xs">
                                    ID: #{viewingCustomer.id.slice(0, 8)}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <div className="bg-white/10 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CreditCard size={18} />
                                    <span className="text-sm text-green-100">Saldo Atual</span>
                                </div>
                                <p className="text-3xl font-black">{viewingCustomer.loyalty_points || 0}</p>
                                <p className="text-xs text-green-100">pontos</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Calendar size={18} />
                                    <span className="text-sm text-green-100">Membro desde</span>
                                </div>
                                <p className="text-lg font-bold">
                                    {viewingCustomer.created_at ? new Date(viewingCustomer.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => openModal('add')}
                                className="flex-1 bg-white text-brand-green px-4 py-3 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2"
                            >
                                <Plus size={18} />
                                Adicionar Pontos
                            </button>
                            <button
                                onClick={() => openModal('reverse')}
                                className="flex-1 bg-red-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-red-600 transition flex items-center justify-center gap-2"
                            >
                                <Minus size={18} />
                                Estornar Pontos
                            </button>
                        </div>
                    </div>

                    {/* Transaction History */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-700">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                            <h4 className="font-bold text-gray-800 dark:text-white mb-3">Histórico de Transações</h4>

                            {/* Filter Tabs */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setTransactionFilter('all');
                                        fetchTransactions(viewingCustomer.id, 'all');
                                    }}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition ${transactionFilter === 'all'
                                        ? 'bg-brand-green text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    Tudo
                                </button>
                                <button
                                    onClick={() => {
                                        setTransactionFilter('credits');
                                        fetchTransactions(viewingCustomer.id, 'credits');
                                    }}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition ${transactionFilter === 'credits'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    Acúmulo
                                </button>
                                <button
                                    onClick={() => {
                                        setTransactionFilter('debits');
                                        fetchTransactions(viewingCustomer.id, 'debits');
                                    }}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition ${transactionFilter === 'debits'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    Resgates e Débitos
                                </button>
                            </div>
                        </div>

                        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
                            {loadingTransactions ? (
                                <div className="p-8 text-center">
                                    <Loader className="animate-spin mx-auto text-brand-green" size={32} />
                                </div>
                            ) : transactions.length > 0 ? (
                                transactions.map(transaction => (
                                    <div key={transaction.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {transaction.points > 0 ? (
                                                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                                            <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                                                            <Minus size={16} className="text-red-600 dark:text-red-400" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-gray-800 dark:text-white text-sm">
                                                            {transaction.type === 'order' && 'Compra'}
                                                            {transaction.type === 'join_bonus' && 'Bônus de Boas-Vindas'}
                                                            {transaction.type === 'birthday_bonus' && 'Bônus de Aniversário'}
                                                            {transaction.type === 'bonus' && 'Bônus Manual'}
                                                            {transaction.type === 'adjustment' && 'Ajuste Manual'}
                                                            {transaction.type === 'redemption' && 'Resgate de Recompensa'}
                                                            {transaction.type === 'reversal' && 'Estorno'}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {new Date(transaction.created_at).toLocaleString('pt-BR')}
                                                        </p>
                                                        {transaction.description && (
                                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{transaction.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-lg font-black ${transaction.points > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {transaction.points > 0 ? '+' : ''}{transaction.points}
                                                </span>
                                                <p className="text-xs text-gray-500">pts</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-gray-400">
                                    <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Nenhuma transação encontrada</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && viewingCustomer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in-up">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
                            {modalType === 'add' ? '➕ Adicionar Pontos' : '➖ Estornar Pontos'}
                        </h3>

                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Cliente</p>
                            <p className="font-bold text-gray-800 dark:text-white">{viewingCustomer.full_name || viewingCustomer.phone}</p>
                            <p className="text-sm text-brand-green font-bold mt-1">Saldo atual: {viewingCustomer.loyalty_points || 0} pts</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Quantidade de Pontos
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={amount || ''}
                                    onChange={e => setAmount(Number(e.target.value))}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-white font-bold text-lg"
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Motivo (Obrigatório)
                                </label>
                                <textarea
                                    required
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-white resize-none"
                                    placeholder={modalType === 'add' ? 'Ex: Compensação de atraso, Cliente VIP...' : 'Ex: Correção de erro, Duplicidade...'}
                                    rows={3}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                    <Lock size={16} />
                                    Senha de Estoque (Obrigatória)
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-white"
                                    placeholder="Digite a senha de estoque"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        setAmount(0);
                                        setReason('');
                                        setPassword('');
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-bold transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={processing || !amount || !reason || !password}
                                    className={`flex-1 px-4 py-3 ${modalType === 'add' ? 'bg-brand-green hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2`}
                                >
                                    {processing ? <Loader className="animate-spin" size={18} /> : modalType === 'add' ? <Plus size={18} /> : <Minus size={18} />}
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
