import { useEffect, useMemo, useState } from 'react';
import {
    CreditCard,
    Eye,
    EyeOff,
    Gift,
    KeyRound,
    Loader2,
    LogOut,
    MapPin,
    PackageCheck,
    Pencil,
    Plus,
    Save,
    ShieldCheck,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import { AuthService } from '@/services/customerAuth';
import { CustomerService } from '@/services/customerService';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { formatBRL } from '@/utils/pricing';

interface CustomerAddress {
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

interface CustomerOrderSummary {
    id: string;
    order_code?: string | null;
    status?: string | null;
    total?: number | string | null;
    created_at?: string | null;
    fulfillment_type?: string | null;
}

type AccountTab = 'profile' | 'addresses' | 'orders' | 'loyalty' | 'security';

const EMPTY_ADDRESS: CustomerAddress = {
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
    is_default: false,
};

function normalizeOrder(order: Record<string, unknown>): CustomerOrderSummary {
    return {
        id: String(order.id ?? ''),
        order_code: order.order_code ? String(order.order_code) : null,
        status: order.status ? String(order.status) : null,
        total: typeof order.total === 'number' || typeof order.total === 'string' ? order.total : null,
        created_at: order.created_at ? String(order.created_at) : null,
        fulfillment_type: order.fulfillment_type ? String(order.fulfillment_type) : null,
    };
}

function orderStatusLabel(status?: string | null) {
    switch (status) {
        case 'reserved': return 'Reservado';
        case 'confirmed': return 'Confirmado';
        case 'ready': return 'Pronto';
        case 'out_for_delivery': return 'Saiu para entrega';
        case 'completed': return 'Concluído';
        case 'cancelled': return 'Cancelado';
        default: return status || 'Em andamento';
    }
}

function PasswordField({
    label,
    value,
    onChange,
    placeholder,
    autoComplete,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    autoComplete: string;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">{label}</label>
            <div className="relative">
                <input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete={autoComplete}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-3 pr-12 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder={placeholder}
                />
                <button
                    type="button"
                    onClick={() => setVisible((current) => !current)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-emerald-600"
                    aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                    title={visible ? 'Ocultar senha' : 'Mostrar senha'}
                >
                    {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
            </div>
        </div>
    );
}

export function CustomerAccountPortal() {
    const customer = useCustomerAuth((state) => state.customer);
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<AccountTab>('profile');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [fullName, setFullName] = useState(customer?.full_name || '');
    const [email, setEmail] = useState(customer?.email || '');

    const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
    const [addressForm, setAddressForm] = useState<CustomerAddress>(EMPTY_ADDRESS);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [showAddressForm, setShowAddressForm] = useState(false);

    const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const displayName = useMemo(
        () => customer?.nickname || customer?.full_name || 'cliente',
        [customer?.full_name, customer?.nickname],
    );

    useEffect(() => {
        setFullName(customer?.full_name || '');
        setEmail(customer?.email || '');
    }, [customer?.email, customer?.full_name]);

    const clearFeedback = () => {
        setMessage('');
        setError('');
    };

    const loadAddresses = async () => {
        if (!customer) return;
        const data = await CustomerService.getAddresses(customer.id);
        setAddresses(data.map((item) => ({
            id: item.id,
            zip_code: item.zip_code,
            street: item.street,
            number: item.number,
            complement: item.complement,
            district: item.district,
            city: item.city,
            state: item.state,
            is_default: item.is_default,
        })));
    };

    const loadOrders = async () => {
        const data = await CustomerService.getOrders();
        setOrders((data as Record<string, unknown>[]).map(normalizeOrder));
    };

    useEffect(() => {
        if (!open || !customer) return;
        let active = true;
        setLoading(true);
        clearFeedback();

        void Promise.all([loadAddresses(), loadOrders()])
            .catch((loadError) => {
                if (!active) return;
                setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar sua conta.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [open, customer?.id]);

    if (!customer) return null;

    const logout = async () => {
        setLoading(true);
        try {
            await AuthService.logoutCustomer();
            setOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        clearFeedback();
        if (!fullName.trim()) {
            setError('Informe seu nome.');
            return;
        }
        setLoading(true);
        try {
            await CustomerService.updateProfile(customer.id, {
                full_name: fullName.trim(),
                email: email.trim() || undefined,
            });
            await AuthService.restoreSession();
            setMessage('Dados atualizados com sucesso.');
        } catch (profileError) {
            setError(profileError instanceof Error ? profileError.message : 'Não foi possível atualizar seus dados.');
        } finally {
            setLoading(false);
        }
    };

    const resetAddressForm = () => {
        setAddressForm(EMPTY_ADDRESS);
        setEditingAddressId(null);
        setShowAddressForm(false);
    };

    const saveAddress = async () => {
        clearFeedback();
        setLoading(true);
        try {
            if (editingAddressId) {
                await CustomerService.updateAddress(editingAddressId, addressForm);
            } else {
                await CustomerService.addAddress({ ...addressForm, customer_id: customer.id });
            }
            await loadAddresses();
            resetAddressForm();
            setMessage(editingAddressId ? 'Endereço atualizado.' : 'Endereço adicionado.');
        } catch (addressError) {
            setError(addressError instanceof Error ? addressError.message : 'Não foi possível salvar o endereço.');
        } finally {
            setLoading(false);
        }
    };

    const editAddress = (address: CustomerAddress) => {
        clearFeedback();
        setAddressForm({ ...address });
        setEditingAddressId(address.id || null);
        setShowAddressForm(true);
    };

    const deleteAddress = async (id?: string) => {
        if (!id) return;
        clearFeedback();
        setLoading(true);
        try {
            await CustomerService.deleteAddress(id);
            await loadAddresses();
            setMessage('Endereço excluído.');
        } catch (addressError) {
            setError(addressError instanceof Error ? addressError.message : 'Não foi possível excluir o endereço.');
        } finally {
            setLoading(false);
        }
    };

    const makeDefault = async (address: CustomerAddress) => {
        if (!address.id) return;
        clearFeedback();
        setLoading(true);
        try {
            await CustomerService.updateAddress(address.id, { is_default: true });
            await loadAddresses();
            setMessage('Endereço padrão atualizado.');
        } catch (addressError) {
            setError(addressError instanceof Error ? addressError.message : 'Não foi possível atualizar o endereço padrão.');
        } finally {
            setLoading(false);
        }
    };

    const savePassword = async () => {
        clearFeedback();
        if (newPassword.length < 8 || newPassword.length > 72 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            setError('A senha deve ter de 8 a 72 caracteres, com pelo menos uma letra e um número.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        try {
            await AuthService.setPassword(newPassword);
            setNewPassword('');
            setConfirmPassword('');
            setMessage('Senha atualizada com sucesso.');
        } catch (passwordError) {
            setError(passwordError instanceof Error ? passwordError.message : 'Não foi possível atualizar a senha.');
        } finally {
            setLoading(false);
        }
    };

    const tabs: Array<{ id: AccountTab; label: string; icon: typeof UserRound }> = [
        { id: 'profile', label: 'Meus dados', icon: UserRound },
        { id: 'addresses', label: 'Endereços', icon: MapPin },
        { id: 'orders', label: 'Pedidos', icon: PackageCheck },
        { id: 'loyalty', label: 'Pontos e cartões', icon: Gift },
        { id: 'security', label: 'Segurança', icon: KeyRound },
    ];

    return (
        <>
            <div className="fixed bottom-28 left-4 z-[65] sm:bottom-5">
                <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-white p-1 pl-2 shadow-xl dark:border-emerald-900 dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="flex min-h-9 items-center gap-2 rounded-full px-2 text-left"
                        aria-label="Abrir minha conta"
                        title="Abrir minha conta"
                    >
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span className="max-w-36 truncate text-xs font-black text-slate-800 dark:text-white">Olá, {displayName}</span>
                    </button>
                    <button
                        type="button"
                        onClick={logout}
                        disabled={loading}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/40 dark:text-red-300"
                        aria-label="Sair da conta"
                        title="Sair da conta"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {open && (
                <div className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
                    <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[90vh] sm:max-w-4xl sm:rounded-3xl">
                        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Minha conta</p>
                                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">{displayName}</h2>
                                <p className="text-xs text-slate-500">{customer.phone}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                aria-label="Fechar minha conta"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </header>

                        <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 px-3 py-3 dark:border-slate-800 sm:px-6">
                            {tabs.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => { setTab(id); clearFeedback(); }}
                                    className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition ${tab === id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                                >
                                    <Icon className="h-4 w-4" /> {label}
                                </button>
                            ))}
                        </nav>

                        <div className="flex-1 overflow-y-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
                            {loading && (
                                <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-100 p-3 text-sm font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Atualizando sua conta...
                                </div>
                            )}
                            {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
                            {message && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div>}

                            {tab === 'profile' && (
                                <div className="mx-auto max-w-xl space-y-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Nome completo</label>
                                        <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">E-mail</label>
                                        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="voce@exemplo.com" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Celular confirmado</label>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{customer.phone}</div>
                                        <p className="mt-1 text-xs text-slate-500">A troca de telefone exige nova confirmação por SMS.</p>
                                    </div>
                                    <button type="button" onClick={saveProfile} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                                        <Save className="h-4 w-4" /> Salvar dados
                                    </button>
                                </div>
                            )}

                            {tab === 'addresses' && (
                                <div className="mx-auto max-w-2xl space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="font-black text-slate-900 dark:text-white">Endereços salvos</h3>
                                            <p className="text-xs text-slate-500">Você pode manter até 3 endereços.</p>
                                        </div>
                                        {!showAddressForm && addresses.length < 3 && (
                                            <button type="button" onClick={() => { setEditingAddressId(null); setAddressForm(EMPTY_ADDRESS); setShowAddressForm(true); clearFeedback(); }} className="flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white">
                                                <Plus className="h-4 w-4" /> Adicionar
                                            </button>
                                        )}
                                    </div>

                                    {showAddressForm && (
                                        <div className="space-y-3 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/10">
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <input value={addressForm.zip_code} onChange={(event) => setAddressForm({ ...addressForm, zip_code: event.target.value })} placeholder="CEP" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.state} onChange={(event) => setAddressForm({ ...addressForm, state: event.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" maxLength={2} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.street} onChange={(event) => setAddressForm({ ...addressForm, street: event.target.value })} placeholder="Rua / avenida" className="rounded-2xl border border-slate-200 bg-white p-3 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.number} onChange={(event) => setAddressForm({ ...addressForm, number: event.target.value })} placeholder="Número" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.complement} onChange={(event) => setAddressForm({ ...addressForm, complement: event.target.value })} placeholder="Complemento" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.district} onChange={(event) => setAddressForm({ ...addressForm, district: event.target.value })} placeholder="Bairro" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                                <input value={addressForm.city} onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })} placeholder="Cidade" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                                            </div>
                                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                                                <input type="checkbox" checked={addressForm.is_default} onChange={(event) => setAddressForm({ ...addressForm, is_default: event.target.checked })} /> Endereço padrão
                                            </label>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={resetAddressForm} className="flex-1 rounded-2xl border border-slate-200 py-3 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
                                                <button type="button" onClick={saveAddress} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Salvar</button>
                                            </div>
                                        </div>
                                    )}

                                    {!showAddressForm && addresses.length === 0 && (
                                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Nenhum endereço salvo ainda.</div>
                                    )}

                                    {!showAddressForm && addresses.map((address) => (
                                        <div key={address.id || `${address.street}-${address.number}`} className={`rounded-3xl border p-4 ${address.is_default ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-black text-slate-900 dark:text-white">{address.street}, {address.number}</p>
                                                        {address.is_default && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">PADRÃO</span>}
                                                    </div>
                                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{address.district} · {address.city}/{address.state}</p>
                                                    <p className="text-xs text-slate-500">CEP {address.zip_code}{address.complement ? ` · ${address.complement}` : ''}</p>
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    <button type="button" onClick={() => editAddress(address)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Editar endereço"><Pencil className="h-4 w-4" /></button>
                                                    <button type="button" onClick={() => deleteAddress(address.id)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300" aria-label="Excluir endereço"><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            </div>
                                            {!address.is_default && <button type="button" onClick={() => makeDefault(address)} className="mt-3 text-xs font-black text-emerald-700 hover:underline dark:text-emerald-400">Definir como padrão</button>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {tab === 'orders' && (
                                <div className="mx-auto max-w-2xl space-y-3">
                                    {orders.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Ainda não há pedidos vinculados a esta conta.</div>
                                    ) : orders.map((order) => (
                                        <div key={order.id} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-black text-slate-900 dark:text-white">{order.order_code || `Pedido ${order.id.slice(0, 8)}`}</p>
                                                    <p className="mt-1 text-xs text-slate-500">{order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : ''}</p>
                                                    <p className="mt-1 text-xs font-bold text-slate-500">{orderStatusLabel(order.status)}{order.fulfillment_type ? ` · ${order.fulfillment_type}` : ''}</p>
                                                </div>
                                                <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">R$ {formatBRL(Number(order.total || 0))}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {tab === 'loyalty' && (
                                <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
                                    <section className="rounded-3xl bg-emerald-600 p-5 text-white shadow-lg">
                                        <Gift className="h-7 w-7" />
                                        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-100">Saldo de pontos</p>
                                        <p className="mt-1 text-4xl font-black">{customer.loyalty_points || 0}</p>
                                        <p className="mt-2 text-sm font-semibold text-emerald-100">Nível {customer.loyalty_tier || 'Bronze'}</p>
                                    </section>
                                    <section className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                                        <CreditCard className="h-7 w-7 text-slate-500" />
                                        <h3 className="mt-5 font-black text-slate-900 dark:text-white">Cartões salvos</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-500">Nenhum cartão salvo. Quando a tokenização de pagamentos for habilitada, aparecerão aqui somente dados seguros, como bandeira e últimos 4 dígitos. O OptmaMenu não armazenará número completo nem CVV.</p>
                                    </section>
                                </div>
                            )}

                            {tab === 'security' && (
                                <div className="mx-auto max-w-xl space-y-4">
                                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
                                        Sua conta da loja é protegida pelo telefone confirmado por SMS e pela senha criada por você. Dependendo da política de segurança, uma alteração sensível pode pedir nova confirmação por SMS.
                                    </div>
                                    <PasswordField label="Nova senha" value={newPassword} onChange={setNewPassword} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" />
                                    <PasswordField label="Repita a nova senha" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repita a nova senha" autoComplete="new-password" />
                                    <button type="button" onClick={savePassword} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                                        <KeyRound className="h-4 w-4" /> Alterar senha
                                    </button>
                                    <button type="button" onClick={logout} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 py-3 font-black text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/20">
                                        <LogOut className="h-4 w-4" /> Sair da conta
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
