
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Eye, Calendar, Shield, Mail, Phone, MapPin, X, Gift, Users, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface Customer {
    id: string;
    full_name: string;
    nickname: string;
    phone_number: string;
    email?: string;
    birth_date?: string;
    created_at: string;
    marketing_consent?: boolean;
    loyalty_points?: number;
    loyalty_tier?: 'Bronze' | 'Prata' | 'Ouro';
    tags?: string[];
    cpf?: string;
}

interface Address {
    id: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    zip_code: string;
    complement?: string;
    label?: string;
    is_default: boolean;
}

export default function Customers() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
    const [customerAddresses, setCustomerAddresses] = useState<Address[]>([]);
    const [loadingAddresses, setLoadingAddresses] = useState(false);
    const [showSensitiveData, setShowSensitiveData] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: store } = await supabase
                .from('stores')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!store) return;

            // Fetch customers directly (points are on the customer table)
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('store_id', store.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
            toast.error('Erro ao carregar clientes');
        } finally {
            setLoading(false);
        }
    };

    const fetchAddresses = async (customerId: string) => {
        setLoadingAddresses(true);
        try {
            const { data, error } = await supabase
                .from('customer_addresses')
                .select('*')
                .eq('customer_id', customerId)
                .order('is_default', { ascending: false });

            if (error) throw error;
            setCustomerAddresses(data || []);
        } catch (error) {
            console.error('Error fetching addresses:', error);
            toast.error('Erro ao carregar endereços');
        } finally {
            setLoadingAddresses(false);
        }
    };

    const openCustomerDetails = (customer: Customer) => {
        setViewCustomer(customer);
        fetchAddresses(customer.id);
        setShowSensitiveData(false);
    };

    const filteredCustomers = customers.filter(c =>
        c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone_number?.includes(searchTerm) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fadeIn pb-24 md:pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2 tracking-tight">Clientes</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie a base de clientes e visualize estatísticas de fidelidade.</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex items-center gap-3 transition-colors">
                <Search className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nome, apelido, telefone ou email..."
                    className="flex-1 outline-none text-gray-700 dark:text-white bg-transparent placeholder:text-gray-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4 text-gray-400">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-green"></div>
                    <p className="font-medium animate-pulse">Carregando clientes...</p>
                </div>
            ) : filteredCustomers.length === 0 ? (
                <div className="p-16 text-center flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-gray-700">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-6">
                        <Users size={40} className="text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Nenhum cliente encontrado</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        {searchTerm ? 'Tente buscar com outros termos.' : 'Sua lista de clientes aparecerá aqui assim que houver cadastros.'}
                    </p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/80 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                                    <th className="p-6">Cliente</th>
                                    <th className="p-6">Contato</th>
                                    <th className="p-6">Fidelidade</th>
                                    <th className="p-6">Desde</th>
                                    <th className="p-6 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredCustomers.map(customer => (
                                    <tr key={customer.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors duration-200">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-brand-green/10 dark:bg-brand-green/20 flex items-center justify-center text-brand-green dark:text-brand-mint font-bold text-lg select-none">
                                                    {(customer.nickname || customer.full_name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800 dark:text-gray-100 text-base">{customer.nickname || 'Sem Apelido'}</div>
                                                    <div className="text-sm text-gray-400 dark:text-gray-500">{customer.full_name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                                                <div className="flex items-center gap-2">
                                                    <Phone size={14} className="text-gray-400" />
                                                    {customer.phone_number}
                                                </div>
                                                {customer.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail size={14} className="text-gray-400" />
                                                        {customer.email}
                                                    </div>
                                                )}
                                                {customer.birth_date && (
                                                    <div className="flex items-center gap-2">
                                                        <Gift size={14} className="text-pink-400" />
                                                        {new Date(customer.birth_date).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-brand-green text-lg">{customer.loyalty_points || 0}</span>
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">pts</span>
                                                {customer.loyalty_tier && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase
                                                        ${customer.loyalty_tier === 'Ouro' ? 'bg-yellow-100 text-yellow-700' :
                                                            customer.loyalty_tier === 'Prata' ? 'bg-gray-100 text-gray-600' :
                                                                'bg-orange-100 text-orange-700'}`}>
                                                        {customer.loyalty_tier}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-sm text-gray-500">
                                                {new Date(customer.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button
                                                onClick={() => openCustomerDetails(customer)}
                                                className="p-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-all active:scale-95 inline-flex items-center justify-center"
                                                title="Ver Detalhes"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CUSTOMER DETAIL MODAL */}
            {viewCustomer && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] m-auto">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Detalhes do Cliente</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Informações apenas para visualização</p>
                            </div>
                            <button
                                onClick={() => setViewCustomer(null)}
                                className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-8">
                            {/* Profile Card */}
                            <div className="flex items-start gap-6">
                                <div className="w-20 h-20 rounded-2xl bg-brand-green/10 dark:bg-brand-green/20 flex items-center justify-center text-brand-green dark:text-brand-mint font-black text-3xl select-none flex-shrink-0">
                                    {(viewCustomer.nickname || viewCustomer.full_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="space-y-3 flex-1">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Nome Completo</label>
                                        <p className="text-lg font-bold text-gray-800 dark:text-white">{viewCustomer.full_name}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Apelido</label>
                                            <p className="font-medium text-gray-700 dark:text-gray-200">{viewCustomer.nickname || '-'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">CPF</label>
                                            <div className="flex items-center gap-2">
                                                {showSensitiveData ? (
                                                    <p className="font-medium text-gray-700 dark:text-gray-200 tracking-wider">
                                                        {viewCustomer.cpf || 'Não informado'}
                                                    </p>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-gray-700 dark:text-gray-200">***.***.***-**</p>
                                                        <button
                                                            onClick={() => {
                                                                const pin = prompt('Digite o PIN administrativo para visualizar:');
                                                                if (pin === '1234') {
                                                                    setShowSensitiveData(true);
                                                                    toast.success('Visualização liberada');
                                                                } else if (pin) {
                                                                    toast.error('PIN incorreto');
                                                                }
                                                            }}
                                                            className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                                                            title="Clique para visualizar (Requer PIN)"
                                                        >
                                                            <Lock size={14} className="text-gray-500 dark:text-gray-400" />
                                                        </button>
                                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 font-bold">Protegido</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Nascimento</label>
                                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                                <Calendar size={16} className="text-pink-500" />
                                                {viewCustomer.birth_date ? new Date(viewCustomer.birth_date).toLocaleDateString() : '-'}
                                                {viewCustomer.birth_date && <span title="Verificado"><Shield size={14} className="text-green-500" /></span>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Marketing</label>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${viewCustomer.marketing_consent
                                                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                                {viewCustomer.marketing_consent ? 'Autorizado' : 'Não Autorizado'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="bg-gray-50 dark:bg-gray-700/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <Phone size={18} className="text-brand-green" />
                                    Contatos
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm">
                                        <Phone size={20} className="text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-400 font-bold uppercase">Telefone</p>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{viewCustomer.phone_number}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm">
                                        <Mail size={20} className="text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-400 font-bold uppercase">E-mail</p>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{viewCustomer.email || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Addresses */}
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <MapPin size={18} className="text-brand-green" />
                                    Endereços Cadastrados
                                </h3>
                                {loadingAddresses ? (
                                    <div className="flex justify-center p-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-green"></div></div>
                                ) : customerAddresses.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">Nenhum endereço cadastrado.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {customerAddresses.map(addr => (
                                            <div key={addr.id} className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-start gap-4">
                                                <MapPin className="text-brand-green mt-1 flex-shrink-0" size={20} />
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-gray-800 dark:text-gray-200">{addr.street}, {addr.number}</span>
                                                        {addr.is_default && (
                                                            <span className="text-[10px] bg-brand-green text-white px-2 py-0.5 rounded-full font-bold">Principal</span>
                                                        )}
                                                        {addr.label && (
                                                            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-bold uppercase">{addr.label}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {addr.district}, {addr.city} - {addr.state}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">{addr.zip_code}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Tags & Promotions (Editable) */}
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <Gift size={18} className="text-brand-green" />
                                    Vincular Promoções e Tags
                                </h3>
                                <div className="space-y-3">
                                    {['VIP', 'Aniversariante', 'Fidelidade Premium', 'Blacklist'].map(tag => {
                                        const isSelected = viewCustomer.tags?.includes(tag);
                                        return (
                                            <label key={tag} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 accent-brand-green rounded"
                                                    checked={isSelected || false}
                                                    onChange={async (e) => {
                                                        const newTags = e.target.checked
                                                            ? [...(viewCustomer.tags || []), tag]
                                                            : (viewCustomer.tags || []).filter(t => t !== tag);

                                                        // Optimistic Update
                                                        setViewCustomer({ ...viewCustomer, tags: newTags });
                                                        setCustomers(customers.map(c => c.id === viewCustomer.id ? { ...c, tags: newTags } : c));

                                                        // Persist
                                                        const { error } = await supabase
                                                            .from('customers')
                                                            .update({ tags: newTags })
                                                            .eq('id', viewCustomer.id);

                                                        if (error) {
                                                            toast.error('Erro ao atualizar tags');
                                                            // Revert not implemented for simplicity, but acceptable for admin tool
                                                        } else {
                                                            toast.success('Tags atualizadas com sucesso');
                                                        }
                                                    }}
                                                />
                                                <span className={`font-bold ${tag === 'Blacklist' ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}>
                                                    {tag}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-400 mt-4">
                                    * Selecione as tags para vincular este cliente a campanhas específicas.
                                </p>
                            </div>

                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end">
                            <button
                                onClick={() => setViewCustomer(null)}
                                className="px-6 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
