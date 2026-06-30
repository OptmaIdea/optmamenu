import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    MessageSquare,
    Send,
    History,
    Users,
    Search,
    Trash2,
    Loader2,
    Lock,
    X,
    MessageCircle,
    FileText
} from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';

export default function AdminMessages() {
    const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');
    const [loading, setLoading] = useState(false);
    const [fetchingHistory, setFetchingHistory] = useState(false);
    const [fetchingCustomers, setFetchingCustomers] = useState(false);

    // Send form
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [recipientType, setRecipientType] = useState<'all' | 'specific'>('all');
    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
    const [pinCode, setPinCode] = useState('');
    const [showPinModal, setShowPinModal] = useState(false);

    // History & Search
    const [history, setHistory] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [store, setStore] = useState<any>(null);

    useEffect(() => {
        fetchStore();
        if (activeTab === 'history') fetchHistory();
    }, [activeTab]);

    const fetchStore = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Primeiro busca a loja do usuário via RPC
        const { data: storeData, error: storeError } = await supabase.rpc(
            'get_user_store_by_id',
            { p_user_id: user.id }
        );
        if (storeError || !storeData) {
            console.error('Error fetching store:', storeError);
            return;
        }
        const store = Array.isArray(storeData) ? storeData[0] : storeData;
        setStore(store);
    };

    const fetchHistory = async () => {
        if (!store?.id) return;
        setFetchingHistory(true);
        try {
            const { data, error } = await supabase
                .from('store_messages')
                .select('*')
                .eq('store_id', store.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setHistory(data || []);
        } catch (err) {
            toast.error('Erro ao carregar histórico.');
        } finally {
            setFetchingHistory(false);
        }
    };

    const fetchCustomers = async (query: string = '') => {
        if (!store?.id) return;
        setFetchingCustomers(true);
        try {
            let q = supabase
                .from('customers')
                .select('id, nickname, full_name, phone')
                .eq('store_id', store.id)
                .eq('status', 'active');

            if (query) {
                q = q.or(`nickname.ilike.%${query}%,full_name.ilike.%${query}%,phone.ilike.%${query}%`);
            }

            const { data, error } = await q.limit(20);
            if (error) throw error;
            setCustomers(data || []);
        } catch (err) {
            toast.error('Erro ao buscar clientes.');
        } finally {
            setFetchingCustomers(false);
        }
    };

    const handleSearchCustomers = (e: React.FormEvent) => {
        e.preventDefault();
        fetchCustomers(searchQuery);
    };

    const handleSendMessage = async () => {
        if (!store?.id) return;
        if (!title.trim() || !message.trim()) return toast.error('Preencha título e mensagem.');
        if (recipientType === 'specific' && selectedRecipients.length === 0) return toast.error('Selecione pelo menos um destinatário.');

        // PIN check (Using Stock Password / PIN)
        const correctPin = store?.stock_password_hash;

        if (!correctPin) {
            return toast.error('PIN de estoque não configurado. Vá em Segurança para configurar.');
        }

        if (pinCode !== correctPin) {
            setPinCode('');
            return toast.error('PIN incorreto. Ação cancelada.');
        }

        setLoading(true);
        try {
            const { error } = await supabase.rpc('send_admin_message', {
                p_store_id: store.id,
                p_title: title,
                p_message: message,
                p_recipient_ids: recipientType === 'all' ? null : selectedRecipients
            });

            if (error) throw error;

            toast.success('Mensagem enviada com sucesso!');
            setTitle('');
            setMessage('');
            setSelectedRecipients([]);
            setPinCode('');
            setShowPinModal(false);
            setActiveTab('history');
        } catch (err: any) {
            toast.error('Erro ao enviar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteHistory = async (id: string) => {
        if (!confirm('Excluir do histórico? (Isso não apaga as notificações já recebidas pelos clientes)')) return;
        try {
            const { error } = await supabase.from('store_messages').delete().eq('id', id);
            if (error) throw error;
            setHistory(prev => prev.filter(h => h.id !== id));
            toast.success('Histórico removido.');
        } catch (err) {
            toast.error('Erro ao excluir.');
        }
    };

    const toggleRecipient = (id: string) => {
        setSelectedRecipients(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    return (
        <PageContainer
            title="Mensagens"
            subtitle="Comunique-se diretamente com seus clientes."
            category="Comercial"
            icon={<MessageSquare size={28} className="text-[#19A999]" />}
            onRefresh={activeTab === 'history' ? fetchHistory : undefined}
            action={
                <div className="flex bg-gray-150 dark:bg-gray-800 p-1.5 rounded-2xl shadow-inner border border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('send')}
                        className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'send'
                            ? 'bg-white dark:bg-gray-700 text-[#19A999] shadow-sm'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        <Send size={15} /> ENVIAR NOVA
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'history'
                            ? 'bg-white dark:bg-gray-700 text-[#19A999] shadow-sm'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        <History size={15} /> HISTÓRICO
                    </button>
                </div>
            }
            flat
        >

            <div className="grid grid-cols-1 gap-8">
                {activeTab === 'send' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
                        {/* LEFT: Composer */}
                        <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase italic tracking-tight flex items-center gap-2">
                                <FileText size={20} className="text-blue-500" /> Compositor de Mensagem
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Título da Notificação</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: 🎉 Promoção de Hoje!"
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-brand-green outline-none text-gray-800 dark:text-white font-bold transition-all"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        maxLength={40}
                                    />
                                    <div className="flex justify-end mt-1">
                                        <span className="text-[10px] font-bold text-gray-400">{title.length}/40</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Conteúdo da Mensagem</label>
                                    <textarea
                                        placeholder="Digite aqui sua mensagem curta (70 caracteres máx)..."
                                        className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-brand-green outline-none text-gray-800 dark:text-white font-medium resize-none transition-all"
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        maxLength={70}
                                    />
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-[10px] text-gray-400 font-medium italic">Supports emojis ✨🍕🎉</p>
                                        <span className={`text-[10px] font-bold ${message.length >= 65 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {message.length}/70
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowPinModal(true)}
                                className="w-full bg-brand-green text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-green-200 dark:shadow-none hover:brightness-95 transition-all flex items-center justify-center gap-3 uppercase italic tracking-tighter"
                            >
                                <Lock size={20} /> ENVIAR MENSAGEM
                            </button>
                        </section>

                        {/* RIGHT: Recipients */}
                        <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6 flex flex-col">
                            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase italic tracking-tight flex items-center gap-2">
                                <Users size={20} className="text-brand-green" /> Selecionar Destinatários
                            </h2>

                            <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-gray-900 rounded-2xl self-start">
                                <button
                                    onClick={() => setRecipientType('all')}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${recipientType === 'all' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-400'
                                        }`}
                                >
                                    TODOS OS CLIENTES
                                </button>
                                <button
                                    onClick={() => {
                                        setRecipientType('specific');
                                        if (customers.length === 0) fetchCustomers();
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${recipientType === 'specific' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-400'
                                        }`}
                                >
                                    ESPECÍFICOS
                                </button>
                            </div>

                            {recipientType === 'all' ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-brand-green/5 dark:bg-brand-green/10 rounded-2xl border-2 border-dashed border-brand-green/20">
                                    <div className="w-16 h-16 bg-brand-green text-white rounded-full flex items-center justify-center mb-4 shadow-lg">
                                        <Users size={32} />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase italic tracking-tight">Broadcasting para Todos</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">Sua mensagem será enviada para todos os clientes ativos vinculados à sua loja.</p>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col space-y-4">
                                    <form onSubmit={handleSearchCustomers} className="relative">
                                        <input
                                            type="text"
                                            placeholder="Buscar por nome ou celular..."
                                            className="w-full p-3 pl-10 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none text-sm transition-all"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                        <Search size={18} className="absolute left-3 top-3.5 text-gray-400" />
                                        <button type="submit" className="hidden">Buscr</button>
                                    </form>

                                    <div className="flex-1 overflow-y-auto max-h-[300px] border border-gray-50 dark:border-gray-700 rounded-xl divide-y divide-gray-50 dark:divide-gray-700">
                                        {fetchingCustomers ? (
                                            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-brand-green" /></div>
                                        ) : customers.length === 0 ? (
                                            <p className="p-8 text-center text-gray-400 text-xs font-medium">Nenhum cliente encontrado.</p>
                                        ) : (
                                            customers.map(cust => (
                                                <div
                                                    key={cust.id}
                                                    onClick={() => toggleRecipient(cust.id)}
                                                    className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-all"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${selectedRecipients.includes(cust.id) ? 'bg-brand-green text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                                            }`}>
                                                            {cust.nickname?.charAt(0) || cust.full_name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{cust.nickname || cust.full_name}</p>
                                                            <p className="text-[10px] text-gray-400 font-mono italic">{cust.phone}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedRecipients.includes(cust.id) ? 'bg-brand-green border-brand-green text-white' : 'border-gray-200 dark:border-gray-700'
                                                        }`}>
                                                        {selectedRecipients.includes(cust.id) && <Check size={12} />}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="text-xs font-bold text-gray-400 px-1 italic">
                                        {selectedRecipients.length} destinatários selecionados
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 animate-fadeIn min-h-[400px]">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase italic tracking-tight flex items-center gap-2">
                                <History size={20} className="text-orange-500" /> Registro de Envios
                            </h2>
                            {/* Cleanup trigger - Simplified */}
                            <button
                                onClick={async () => {
                                    if (!store?.id) return;
                                    setLoading(true);
                                    try {
                                        const { data, error } = await supabase.rpc('cleanup_old_messages', { p_store_id: store.id });
                                        if (error) throw error;
                                        toast.success(`${data} mensagens antigas removidas do histórico.`);
                                        fetchHistory();
                                    } catch (e) { toast.error('Erro ao limpar.'); }
                                    setLoading(false);
                                }}
                                className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest flex items-center gap-2"
                            >
                                <Trash2 size={14} /> Limpar Expirados
                            </button>
                        </div>

                        {fetchingHistory ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="animate-spin text-brand-green" size={40} />
                                <p className="text-gray-400 font-bold text-sm">Carregando histórico...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 grayscale opacity-50">
                                <MessageCircle size={64} className="mb-4" />
                                <p className="font-bold">Nenhuma mensagem enviada ainda.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700">
                                            <th className="py-4 text-xs font-black text-gray-400 uppercase tracking-widest px-4">Data</th>
                                            <th className="py-4 text-xs font-black text-gray-400 uppercase tracking-widest px-4">Conteúdo</th>
                                            <th className="py-4 text-xs font-black text-gray-400 uppercase tracking-widest px-4 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                        {history.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                                            {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-mono">
                                                            {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div>
                                                        <p className="text-sm font-black text-brand-green uppercase italic tracking-tighter mb-0.5">{item.title}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed max-w-md">{item.message}</p>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    <button
                                                        onClick={() => handleDeleteHistory(item.id)}
                                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* PIN MODAL */}
            {showPinModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative border border-gray-100 dark:border-gray-700 animate-scaleIn">
                        <button
                            onClick={() => setShowPinModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={20} />
                        </button>

                        <div className="p-8 text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center">
                                <Lock size={32} />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-gray-800 dark:text-white uppercase italic tracking-tighter">Confirmar Ação</h3>
                                <p className="text-sm text-gray-500 font-medium leading-relaxed">Insira seu PIN de Administrador para disparar esta mensagem.</p>
                            </div>

                            <input
                                type="password"
                                placeholder="******"
                                className="w-full p-4 text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 border-2 border-brand-green/20 rounded-2xl focus:border-brand-green outline-none text-center text-3xl font-black tracking-[1em] transition-all"
                                value={pinCode}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    if (val.length <= 6) setPinCode(val);
                                }}
                                autoFocus
                                autoComplete="off"
                            />

                            <button
                                onClick={handleSendMessage}
                                disabled={loading || pinCode.length < 6}
                                className="w-full bg-brand-green text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:brightness-95 transition-all disabled:grayscale disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'CONFIRMAR DISPARO 🚀'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}

// Minimal Check Icon for selected list
const Check = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17L4 12" />
    </svg>
);
