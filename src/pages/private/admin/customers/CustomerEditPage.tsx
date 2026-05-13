import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Info,
    Loader2,
    Lock,
    Save,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import {
    Customers360Service,
    type Customer360,
} from '@/services/customers360Service';

function parseTags(value: string) {
    return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function joinTags(tags?: string[] | null) {
    return (tags || []).join(', ');
}

function getErrorMessage(err: unknown, fallback: string) {
    return err instanceof Error ? err.message : fallback;
}

export default function CustomerEditPage() {
    const navigate = useNavigate();
    const { customerId } = useParams();
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [data, setData] = useState<Customer360 | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [cpf, setCpf] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [status, setStatus] = useState('active');
    const [tags, setTags] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [loyaltyOptIn, setLoyaltyOptIn] = useState(true);

    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const customer = data?.customer;

    const isProtected = useMemo(() => {
        if (!customer) return false;

        return (
            customer.data_ownership === 'customer_owned' ||
            customer.editable_by_store === false
        );
    }, [customer]);

    async function loadCustomer() {
        if (!storeId || !customerId) return;

        try {
            setLoading(true);
            setError(null);
            setMessage(null);

            const result = await Customers360Service.getCustomer360(storeId, customerId);
            setData(result);

            const current = result.customer;

            setFullName(current.full_name || '');
            setPhone(current.phone || '');
            setEmail(current.email || '');
            setCpf(current.cpf || '');
            setBirthDate(current.birth_date || '');
            setStatus(current.status || 'active');
            setTags(joinTags(current.tags));
            setInternalNotes(current.internal_notes || '');
            setMarketingConsent(Boolean(current.marketing_consent));
            setLoyaltyOptIn(Boolean(current.loyalty_opt_in));
        } catch (err: unknown) {
            console.error('Erro ao carregar cliente para edição:', err);
            setError(getErrorMessage(err, 'Erro ao carregar cliente para edição.'));
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

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!storeId || !customerId) return;

        try {
            setSaving(true);
            setError(null);
            setMessage(null);

            const result = await Customers360Service.updateAdminCustomer({
                storeId,
                customerId,
                fullName,
                phone,
                email,
                cpf,
                birthDate: birthDate || null,
                status,
                tags: parseTags(tags),
                internalNotes,
                marketingConsent,
                loyaltyOptIn,
            });

            if (!result.ok) {
                setError(result.message || result.error || 'Não foi possível atualizar o cliente.');
                return;
            }

            if (result.protected_data) {
                setMessage(
                    result.message ||
                    'Cliente protegido atualizado. Dados autodeclarados foram preservados.'
                );
            } else {
                setMessage('Cliente atualizado com sucesso.');
            }

            await loadCustomer();
        } catch (err: unknown) {
            console.error('Erro ao atualizar cliente:', err);
            setError(getErrorMessage(err, 'Erro ao atualizar cliente.'));
        } finally {
            setSaving(false);
        }
    }

    if (loadingStore || loading) {
        return (
            <div className="p-6">
                <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <Loader2 className="animate-spin" size={20} />
                        Carregando cliente...
                    </div>
                </div>
            </div>
        );
    }

    if (error && !customer) {
        return (
            <div className="p-6">
                <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="p-6">
                <div className="rounded-3xl border border-gray-200 bg-white p-6 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                    Cliente não encontrado.
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <button
                    type="button"
                    onClick={() => navigate(`/admin/customers/${customer.id}`)}
                    className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                    <ArrowLeft size={16} />
                    Voltar para Vida do Cliente
                </button>

                <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <UserRound size={28} />
                        </div>

                        <div>
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                                Editar cliente
                            </h1>

                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {customer.full_name || 'Cliente sem nome'} • {customer.phone}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                                {isProtected ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                                        <ShieldCheck size={13} />
                                        Dados autodeclarados protegidos
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                                        <Info size={13} />
                                        Cliente editável pelo lojista
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            {message && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {message}
                </div>
            )}

            {isProtected && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="flex items-start gap-3">
                        <Lock className="mt-0.5 shrink-0" size={18} />

                        <div>
                            <p className="font-black">
                                Este cliente veio da loja pública, WhatsApp ou QR.
                            </p>
                            <p className="mt-1">
                                Nome, telefone, e-mail, CPF e data de nascimento serão preservados.
                                Você pode alterar apenas campos internos, status, tags,
                                observações e preferências operacionais.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            Nome
                        </label>
                        <input
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            disabled={isProtected}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:disabled:bg-gray-800"
                            placeholder="Nome do cliente"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            WhatsApp / telefone
                        </label>
                        <input
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            disabled={isProtected}
                            required
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:disabled:bg-gray-800"
                            placeholder="32999990000"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            E-mail
                        </label>
                        <input
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            disabled={isProtected}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:disabled:bg-gray-800"
                            placeholder="cliente@email.com"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            CPF
                        </label>
                        <input
                            value={cpf}
                            onChange={(event) => setCpf(event.target.value)}
                            disabled={isProtected}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:disabled:bg-gray-800"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            Data de nascimento
                        </label>
                        <input
                            type="date"
                            value={birthDate}
                            onChange={(event) => setBirthDate(event.target.value)}
                            disabled={isProtected}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:disabled:bg-gray-800"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            Status
                        </label>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        >
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                            <option value="deleted_requested">Exclusão solicitada</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            Tags internas
                        </label>
                        <input
                            value={tags}
                            onChange={(event) => setTags(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            placeholder="vip, revendedor, bairro-centro"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Separe por vírgula.
                        </p>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            Observações internas
                        </label>
                        <textarea
                            value={internalNotes}
                            onChange={(event) => setInternalNotes(event.target.value)}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        />
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">
                                    Aceita marketing
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Usado futuramente para campanhas.
                                </p>
                            </div>

                            <input
                                type="checkbox"
                                checked={marketingConsent}
                                onChange={(event) => setMarketingConsent(event.target.checked)}
                                className="h-5 w-5"
                            />
                        </div>
                    </label>

                    <label className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">
                                    Participa da fidelidade
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Permite acumular pontos.
                                </p>
                            </div>

                            <input
                                type="checkbox"
                                checked={loyaltyOptIn}
                                onChange={(event) => setLoyaltyOptIn(event.target.checked)}
                                className="h-5 w-5"
                            />
                        </div>
                    </label>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => navigate(`/admin/customers/${customer.id}`)}
                        className="inline-flex items-center justify-center rounded-2xl border border-gray-200 px-5 py-3 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Salvar alterações
                    </button>
                </div>
            </form>
        </div>
    );
}