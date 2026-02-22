import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Loader2, Save, Shield, Smartphone, Globe, Instagram, Facebook, Star, Gift, AlertTriangle, LogOut, Key, Settings, MapPin, Clock } from 'lucide-react';
import OrderHistory from '@/pages/private/admin/commercial/orders/OrderHistory';
import LoyaltyPoints from '@/components/LoyaltyPoints';
import { CustomerService } from '@/services/customerService';
import { NotificationService } from '@/services/notificationService';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { timezoneUtils } from '@/utils/timezoneUtils';

interface Address {
    id?: string;
    zip_code: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    is_default: boolean;
}

interface IBGEState {
    id: number;
    sigla: string;
    nome: string;
}

interface IBGECity {
    id: number;
    nome: string;
}

import type { StoreConfig } from '@/types';

interface CustomerProfileProps {
    onClose: () => void;
    storeConfig?: StoreConfig;
    storeId?: string;
    initialTab?: 'data' | 'address' | 'privacy' | 'social' | 'history' | 'loyalty';
    onUpdate?: () => void;
}

export default function CustomerProfile({ onClose, storeConfig, storeId, initialTab = 'data', onUpdate }: CustomerProfileProps) {
    const { customer, login } = useCustomerAuth();
    const [activeTab, setActiveTab] = useState<'data' | 'address' | 'privacy' | 'social' | 'history' | 'loyalty'>(initialTab);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);




    // Data Form
    const [formData, setFormData] = useState({
        full_name: customer?.full_name || '',
        cpf: customer?.cpf || '',
        email: customer?.email || '',
        birth_date: customer?.birth_date || '',
        phone: customer?.phone || ''
    });

    // Address State
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [addressForm, setAddressForm] = useState<Address>({
        zip_code: '', street: '', number: '', complement: '', district: '', city: '', state: '', is_default: false
    });
    const [searchingCep, setSearchingCep] = useState(false);

    // IBGE Locations
    const [states, setStates] = useState<IBGEState[]>([]);
    const [cities, setCities] = useState<IBGECity[]>([]);
    const [loadingCities, setLoadingCities] = useState(false);

    useEffect(() => {
        fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
            .then(res => res.json())
            .then(setStates)
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (addressForm.state && addressForm.state.length === 2) {
            setLoadingCities(true);
            fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${addressForm.state}/municipios`)
                .then(res => res.json())
                .then(data => {
                    setCities(data);
                    setLoadingCities(false);
                })
                .catch(() => setLoadingCities(false));
        } else {
            setCities([]);
        }
    }, [addressForm.state]);

    useEffect(() => {
        if (customer?.id) fetchAddresses();
    }, [customer?.id]);

    // Profile Completeness Check
    const isProfileComplete = React.useMemo(() => {
        if (!customer) return false;
        // Check Name
        if (!customer.full_name || customer.full_name.trim().length < 3) return false;

        // Check CPF (if > 18)
        if (!customer.birth_date) return false;
        const [y, m, d] = customer.birth_date.split('-').map(Number);
        const birthDate = new Date(y, m - 1, d);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age >= 18 && (!customer.cpf || customer.cpf.length < 11)) return false;

        // Check Address
        if (addresses.length === 0) return false;

        return true;
    }, [customer, addresses]);


    const fetchAddresses = async () => {
        if (!customer?.id) return;
        try {
            const data = await CustomerService.getAddresses(customer.id);
            setAddresses(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveData = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (!customer?.id) return;
            await CustomerService.updateProfile(customer.id, formData);
            // Update local store
            login({ ...customer, ...formData });
            if (storeId) {
                await NotificationService.sendProfileUpdate(customer.id, storeId);
            }
            alert('Dados atualizados com sucesso!');
        } catch (err: any) {
            alert(err.message || 'Erro ao atualizar dados.');
        } finally {
            setLoading(false);
        }
    };

    const handleZipLookup = async () => {
        const cep = addressForm.zip_code.replace(/\D/g, '');
        if (cep.length !== 8) return alert('CEP inválido');

        setSearchingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (data.erro) throw new Error('CEP não encontrado');

            setAddressForm(prev => ({
                ...prev,
                street: data.logradouro,
                district: data.bairro,
                city: data.localidade,
                state: data.uf
            }));
        } catch (_) {
            alert('CEP não encontrado');
        } finally {
            setSearchingCep(false);
        }
    };

    const handleSaveAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (!customer?.id) return;

            const payload = { ...addressForm, customer_id: customer.id };

            if (editingAddressId) {
                await CustomerService.updateAddress(editingAddressId, payload);
            } else {
                if (addresses.length >= 3) {
                    alert('Você já atingiu o limite máximo de 3 endereços.');
                    setLoading(false);
                    return;
                }
                await CustomerService.addAddress(payload);
            }

            await fetchAddresses();
            if (storeId) {
                await NotificationService.sendAddressUpdate(customer.id, storeId, editingAddressId ? 'update' : 'add');
            }
            if (onUpdate) onUpdate();
            setShowAddressForm(false);
            resetAddressForm();
        } catch (_) {
            alert('Erro ao salvar endereço.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAddress = async (id: string) => {
        if (!confirm('Excluir endereço?')) return;
        try {
            await CustomerService.deleteAddress(id);
            await fetchAddresses();
            if (storeId && customer?.id) {
                await NotificationService.sendAddressUpdate(customer.id, storeId, 'delete');
            }
            if (onUpdate) onUpdate();
        } catch (_) { alert('Erro ao excluir'); }
    };

    const resetAddressForm = () => {
        setAddressForm({ zip_code: '', street: '', number: '', complement: '', district: '', city: '', state: '', is_default: false });
        setEditingAddressId(null);
    };

    // Consent Handling
    const handleMarketingConsent = async (checked: boolean) => {
        if (!customer?.id) return;
        try {
            // Optimistic update
            login({ ...customer, marketing_consent: checked });

            // Log to DB
            await CustomerService.logConsent(customer.id, 'marketing_whatsapp', checked ? 'granted' : 'revoked');

            // Here you would also update the customer record if needed, but for now we log it.
            // Actually, we should update the customer record too.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await CustomerService.updateProfile(customer.id, { marketing_consent: checked } as any);

        } catch (err) {
            console.error(err);
            // Revert on error would be ideal
        }
    };

    const handleLoyaltyOptIn = async (checked: boolean) => {
        if (!customer?.id) return;
        try {
            // Optimistic update
            login({ ...customer, loyalty_opt_in: checked });

            // Log to DB
            await CustomerService.logConsent(customer.id, 'loyalty_program', checked ? 'granted' : 'revoked');

            // Update customer record
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await CustomerService.updateProfile(customer.id, { loyalty_opt_in: checked } as any);

            // Add Notification
            if (storeId) {
                if (checked) {
                    const bonus = storeConfig?.loyalty_active ? (storeConfig as any).join_bonus_points || 0 : 0;
                    await NotificationService.sendLoyaltyJoin(customer.id, storeId, bonus);
                    alert('🎉 Parabéns! Você agora faz parte do nosso Clube de Pontos!');
                } else {
                    await NotificationService.sendLoyaltyExit(customer.id, storeId);
                }
            }

        } catch (err) {
            console.error(err);
            alert('Erro ao atualizar preferência de fidelidade.');
            // Revert logic would go here
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full h-full md:w-full md:max-w-5xl md:h-[85vh] rounded-none md:rounded-2xl shadow-2xl relative flex flex-col md:flex-row overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition z-50 focus:outline-none focus:ring-2 focus:ring-brand-green"
                >
                    <X size={20} />
                </button>

                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 bg-gray-50 dark:bg-slate-800/50 p-4 pt-16 md:pt-4 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 flex flex-row md:flex-col gap-2 overflow-x-auto shrink-0 md:overflow-y-auto items-center md:items-stretch">
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === 'data' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <Settings size={18} /> Meus Dados
                    </button>
                    <button
                        onClick={() => setActiveTab('address')}
                        className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === 'address' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <MapPin size={18} /> Endereços
                    </button>

                    <button
                        onClick={() => setActiveTab('loyalty')}
                        className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === 'loyalty' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <Gift size={18} /> Fidelidade
                    </button>

                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === 'history' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <Clock size={18} /> Pedidos
                    </button>

                    <button
                        onClick={() => setActiveTab('social')}
                        className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === 'social' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <Globe size={18} /> Siga-nos
                    </button>

                    <button
                        onClick={() => setActiveTab('privacy')}
                        className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === 'privacy' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <Shield size={18} /> Privacidade
                    </button>
                </div>


                <div className="flex-1 p-6 pb-24 md:pb-6 overflow-y-auto bg-white dark:bg-slate-900">
                    {activeTab === 'data' && (
                        <form onSubmit={handleSaveData} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">CPF</label>
                                    {/* Security: Lock CPF if already set */}
                                    {customer?.cpf ? (
                                        <div className="w-full p-3 bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed flex items-center justify-between">
                                            <span>{customer.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</span>
                                            <span title="Alteração bloqueada por segurança"><Shield size={14} /></span>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                            value={formData.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                            onChange={e => {
                                                const raw = e.target.value.replace(/\D/g, '');
                                                if (raw.length <= 11) setFormData({ ...formData, cpf: raw });
                                            }}
                                            placeholder="000.000.000-00"
                                            maxLength={14}
                                        />
                                    )}
                                    {customer?.cpf && <p className="text-[10px] text-gray-400 mt-1">Para alterar, contate o suporte.</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nascimento</label>
                                    {/* Security: Lock birth date if already set */}
                                    {customer?.birth_date ? (
                                        <div className="w-full p-3 bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed flex items-center justify-between">
                                            <span>{timezoneUtils.formatBrazilDate(customer.birth_date)}</span>
                                            <span title="Alteração bloqueada por segurança"><Shield size={14} /></span>
                                        </div>
                                    ) : (
                                        <input
                                            type="date"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                            value={formData.birth_date}
                                            onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                                        />
                                    )}
                                    {customer?.birth_date && <p className="text-[10px] text-gray-400 mt-1">Para alterar, contate o suporte.</p>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">E-mail</label>
                                <input
                                    type="email"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Celular/WhatsApp</label>
                                {/* Security: Lock phone if already set */}
                                {customer?.phone ? (
                                    <div className="w-full p-3 bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed flex items-center justify-between">
                                        <span>{customer.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                                        <span title="Alteração bloqueada por segurança"><Shield size={14} /></span>
                                    </div>
                                ) : (
                                    <input
                                        type="tel"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                        value={formData.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')} // Simple mask for display if full
                                        onChange={e => {
                                            const raw = e.target.value.replace(/\D/g, '');
                                            if (raw.length <= 11) setFormData({ ...formData, phone: raw });
                                        }}
                                        placeholder="(DDD) 99999-9999"
                                        maxLength={15} // (11) 99999-9999 is 15 chars
                                    />
                                )}
                                {customer?.phone && <p className="text-[10px] text-gray-400 mt-1">Para alterar, contate o suporte.</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-brand-green text-white py-3 rounded-xl font-bold hover:brightness-90 transition flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Salvar Alterações</>}
                            </button>
                        </form>
                    )}

                    {activeTab === 'address' && (
                        <div>
                            {!showAddressForm ? (
                                <div className="space-y-4">
                                    <button
                                        onClick={() => { resetAddressForm(); setShowAddressForm(true); }}
                                        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:border-brand-green hover:text-brand-green transition flex items-center justify-center gap-2"
                                    >
                                        <Plus size={20} /> Adicionar Novo Endereço
                                    </button>

                                    {addresses.map(addr => (
                                        <div key={addr.id} className={`p-4 rounded-xl border ${addr.is_default ? 'border-brand-green bg-green-50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700'} relative transition-all`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-bold text-gray-800 dark:text-white uppercase tracking-tighter italic">{addr.street}, {addr.number}</p>
                                                        {addr.is_default && <span className="text-[10px] bg-brand-green text-white px-2 py-0.5 rounded-full font-bold">PADRÃO</span>}
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{addr.district} - {addr.city}/{addr.state}</p>
                                                    <p className="text-xs text-gray-400">{addr.zip_code}</p>
                                                    {addr.complement && <p className="text-xs text-gray-500 mt-1 italic opacity-75">Ref: {addr.complement}</p>}

                                                    {!addr.is_default && (
                                                        <button
                                                            onClick={async () => {
                                                                if (!customer?.id) return;
                                                                await CustomerService.updateAddress(addr.id!, { is_default: true });
                                                                await fetchAddresses();
                                                                if (onUpdate) onUpdate();
                                                                if (storeId) await NotificationService.sendAddressUpdate(customer.id, storeId, 'update');
                                                            }}
                                                            className="mt-3 text-[10px] font-bold text-brand-green uppercase hover:underline flex items-center gap-1"
                                                        >
                                                            Definir como padrão
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1 ml-4 justify-center">
                                                    <button
                                                        onClick={() => { setAddressForm(addr); setEditingAddressId(addr.id!); setShowAddressForm(true); }}
                                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAddress(addr.id!)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <form onSubmit={handleSaveAddress} className="space-y-3">
                                    <div className="flex gap-2">
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">CEP</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                                    value={addressForm.zip_code}
                                                    onChange={e => setAddressForm({ ...addressForm, zip_code: e.target.value })}
                                                    onBlur={handleZipLookup}
                                                    placeholder="00000-000"
                                                />
                                                {searchingCep && <Loader2 size={16} className="absolute right-2 top-3 animate-spin text-gray-400" />}
                                            </div>
                                        </div>
                                        <div className="w-2/3">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Rua</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                                value={addressForm.street}
                                                onChange={e => setAddressForm({ ...addressForm, street: e.target.value })}
                                                placeholder="Logradouro"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Número</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                                value={addressForm.number}
                                                onChange={e => setAddressForm({ ...addressForm, number: e.target.value })}
                                            />
                                        </div>
                                        <div className="w-2/3">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Complemento</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                                value={addressForm.complement}
                                                onChange={e => setAddressForm({ ...addressForm, complement: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Bairro</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800"
                                                value={addressForm.district}
                                                onChange={e => setAddressForm({ ...addressForm, district: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">UF</label>
                                            <select
                                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800 appearance-none"
                                                value={addressForm.state}
                                                onChange={e => setAddressForm({ ...addressForm, state: e.target.value, city: '' })}
                                            >
                                                <option value="">UF</option>
                                                {states.map(uf => (
                                                    <option key={uf.id} value={uf.sigla}>{uf.sigla}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-2/3">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                                Cidade
                                                {loadingCities && <Loader2 size={10} className="animate-spin" />}
                                            </label>
                                            <select
                                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-green text-gray-900 dark:text-white bg-white dark:bg-slate-800 appearance-none disabled:opacity-50"
                                                value={addressForm.city}
                                                onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                                                disabled={!addressForm.state || loadingCities}
                                            >
                                                <option value="">Selecione...</option>
                                                {cities.map(city => (
                                                    <option key={city.id} value={city.nome}>{city.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-2 py-2">
                                        <input
                                            type="checkbox"
                                            checked={addressForm.is_default}
                                            onChange={e => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                                            className="accent-brand-green w-4 h-4"
                                        />
                                        <span className="text-sm text-gray-700">Definir como endereço padrão</span>
                                    </label>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddressForm(false)}
                                            className="flex-1 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 bg-brand-green text-white py-2 rounded-lg font-bold hover:brightness-90 transition flex items-center justify-center gap-2"
                                        >
                                            {loading ? <Loader2 className="animate-spin" /> : 'Salvar Endereço'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {activeTab === 'privacy' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2"><Shield size={18} /> Privacidade e Dados</h3>
                                <p className="text-sm text-blue-600 dark:text-blue-300 mb-4">
                                    Nós valorizamos sua privacidade. Aqui você pode controlar suas preferências de comunicação e acessar nossos termos.
                                </p>
                                <div className="space-y-2">
                                    <a href="#" className="block text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline">📄 Termos de Uso</a>
                                    <a href="#" className="block text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline">🔐 Política de Privacidade</a>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Smartphone size={18} /> Comunicação</h3>
                                <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                                    <input
                                        type="checkbox"
                                        className="mt-1 w-5 h-5 accent-brand-green"
                                        checked={customer?.marketing_consent || false}
                                        onChange={(e) => handleMarketingConsent(e.target.checked)}
                                    />
                                    <div>
                                        <span className="font-bold text-gray-800 dark:text-white block">Receber Ofertas e Novidades</span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            Autorizo o envio de mensagens promocionais via WhatsApp e SMS.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'social' && (
                        <div className="space-y-4">
                            <div className="text-center mb-6">
                                <h3 className="font-bold text-xl text-gray-800">Siga-nos!</h3>
                                <p className="text-gray-500 text-sm">Fique por dentro das novidades nas nossas redes sociais.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {storeConfig?.social_links?.instagram && (
                                    <a href={`https://${storeConfig.social_links.instagram.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-pink-50 text-pink-600 rounded-2xl hover:bg-pink-100 transition gap-2">
                                        <Instagram size={32} />
                                        <span className="font-bold">Instagram</span>
                                    </a>
                                )}

                                {storeConfig?.social_links?.facebook && (
                                    <a href={`https://${storeConfig.social_links.facebook.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition gap-2">
                                        <Facebook size={32} />
                                        <span className="font-bold">Facebook</span>
                                    </a>
                                )}

                                {storeConfig?.social_links?.tiktok && (
                                    <a href={`https://${storeConfig.social_links.tiktok.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-gray-900 text-white rounded-2xl hover:bg-gray-800 transition gap-2">
                                        <span className="text-2xl font-bold">♪</span>
                                        <span className="font-bold">TikTok</span>
                                    </a>
                                )}

                                {storeConfig?.social_links?.twitter && (
                                    <a href={`https://${storeConfig.social_links.twitter.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-black text-white rounded-2xl hover:bg-gray-800 transition gap-2">
                                        <span className="text-2xl font-bold">𝕏</span>
                                        <span className="font-bold">X</span>
                                    </a>
                                )}

                                {storeConfig?.social_links?.website && (
                                    <a href={`https://${storeConfig.social_links.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-gray-50 text-gray-600 rounded-2xl hover:bg-gray-100 transition gap-2">
                                        <Globe size={32} />
                                        <span className="font-bold">Site</span>
                                    </a>
                                )}

                                {(storeConfig?.social_links?.google_reviews || storeConfig?.contact_map_link) && (
                                    <a href={storeConfig?.social_links?.google_reviews || storeConfig?.contact_map_link} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-yellow-50 text-yellow-600 rounded-2xl hover:bg-yellow-100 transition gap-2">
                                        <Star size={32} />
                                        <span className="font-bold text-center">Avalie-nos no Google</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && <OrderHistory />}

                    {activeTab === 'loyalty' && (
                        !isProfileComplete ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
                                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Complete seu Cadastro</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                                    Para participar do nosso Programa de Fidelidade e acumular pontos, precisamos que você complete seu cadastro com <strong>Nome Completo</strong>, <strong>CPF</strong> (para maiores de 18 anos) e tenha pelo menos um <strong>Endereço</strong> cadastrado.
                                </p>
                                <button
                                    onClick={() => setActiveTab('data')}
                                    className="bg-brand-green text-white px-6 py-3 rounded-xl font-bold hover:brightness-110 transition shadow-lg shadow-brand-green/20"
                                >
                                    Completar Meus Dados
                                </button>
                            </div>
                        ) : !customer?.loyalty_opt_in ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
                                <div className="w-16 h-16 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mb-4">
                                    <Gift size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Participe do Clube de Pontos</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                                    Acumule pontos em cada pedido e troque por recompensas exclusivas!
                                </p>
                                <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition border border-gray-100 dark:border-gray-700 mb-4 select-none">
                                    <input
                                        type="checkbox"
                                        className="w-6 h-6 accent-brand-green"
                                        checked={customer?.loyalty_opt_in || false}
                                        onChange={(e) => handleLoyaltyOptIn(e.target.checked)}
                                    />
                                    <span className="font-bold text-gray-800 dark:text-white">Quero participar e pontuar!</span>
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-fadeIn">
                                <LoyaltyPoints />

                                <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                                    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">Configurações de Fidelidade</h4>
                                    <button
                                        onClick={() => {
                                            if (window.confirm('Tem certeza? Você perderá acesso a benefícios exclusivos e seus pontos poderão ser expirados.')) {
                                                handleLoyaltyOptIn(false);
                                            }
                                        }}
                                        className="text-red-500 text-sm font-bold hover:underline flex items-center gap-2"
                                    >
                                        <LogOut size={14} /> Sair do Clube de Pontos
                                    </button>
                                </div>
                            </div>
                        )
                    )}

                    {/* NEW PRIVACY TAB CONTENT */}
                    {activeTab === 'privacy' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Privacidade e Segurança</h2>

                                <p className="text-sm text-gray-500">Gerencie seus dados e preferências de conta.</p>
                            </div>

                            {/* Section: Sensitive Data */}
                            <section className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                                    <Key size={20} className="text-yellow-600" /> Alterar Dados Sensíveis
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                                    Para sua segurança, dados como <strong>Data de Nascimento</strong> e <strong>Celular</strong> não podem ser alterados diretamente.
                                    Caso necessite atualizar estas informações, solicite um link seguro para o seu e-mail cadastrado.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => alert('Em breve: Enviaremos um link para seu e-mail.')}
                                    className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    Solicitar Alteração por E-mail
                                </button>
                            </section>

                            {/* Section: Account Deletion */}
                            <section className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-red-800 dark:text-red-400 flex items-center gap-2 mb-4">
                                    <AlertTriangle size={20} /> Excluir Minha Conta
                                </h3>
                                <div className="space-y-4 text-sm text-red-700 dark:text-red-300 mb-6">
                                    <p>
                                        Esta ação é <strong>irreversível</strong>. Ao excluir sua conta:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Seus dados pessoais e de acesso serão removidos.</li>
                                        <li>Seus endereços salvos serão apagados.</li>
                                        <li>Todos os seus pontos no Programa de Fidelidade serão perdidos.</li>
                                        <li>Seu histórico de consentimentos será anonimizado.</li>
                                    </ul>
                                    <p className="font-bold mt-2">
                                        Nota: Seus pedidos realizados serão mantidos em nosso banco de dados para fins fiscais e de controle de estoque.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.')) {
                                            if (window.confirm('Confirmação final: Todos os seus pontos e dados serão perdidos. Deseja continuar?')) {
                                                // Placeholder for CustomerService.deleteAccount and logout/onClose
                                                alert('Funcionalidade de exclusão de conta em desenvolvimento. Sua conta não foi excluída.');
                                                // CustomerService.deleteAccount(customer!.id)
                                                //     .then(() => {
                                                //         alert('Sua conta foi excluída com sucesso.');
                                                //         logout();
                                                //         onClose();
                                                //     })
                                                //     .catch(err => alert('Erro ao excluir conta: ' + err.message));
                                            }
                                        }
                                    }}
                                    className="bg-red-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-red-700 transition flex items-center gap-2 shadow-lg shadow-red-600/20"
                                >
                                    <LogOut size={18} />
                                    Sim, Quero Excluir Minha Conta
                                </button>
                            </section>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
}
