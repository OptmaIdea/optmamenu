import { useState } from 'react';
import { ArrowLeft, Loader2, Save, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { Customers360Service } from '@/services/customers360Service';

function parseTags(value: string) {
    return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

export default function CustomerFormPage() {
    const navigate = useNavigate();
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [cpf, setCpf] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [tags, setTags] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [loyaltyOptIn, setLoyaltyOptIn] = useState(true);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!storeId) return;

        try {
            setSaving(true);
            setError(null);

            const result = await Customers360Service.createAdminCustomer({
                storeId,
                fullName,
                phone,
                email,
                cpf,
                birthDate: birthDate || null,
                tags: parseTags(tags),
                internalNotes,
                marketingConsent,
                loyaltyOptIn,
            });

            if (!result.ok) {
                setError(result.message || result.error || 'Não foi possível criar o cliente.');
                return;
            }

            navigate(result.customer_id ? `/admin/customers/${result.customer_id}` : '/admin/customers');
        } catch (err: unknown) {
            console.error('Erro ao criar cliente:', err);
            const message = err instanceof Error ? err.message : 'Erro ao criar cliente.';
            setError(message);
        } finally {
            setSaving(false);
        }
    }

    if (loadingStore) {
        return (
            <div className="p-6">
                <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <Loader2 className="animate-spin" size={20} />
                        Carregando loja...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <button
                    type="button"
                    onClick={() => navigate('/admin/customers')}
                    className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                    <ArrowLeft size={16} />
                    Voltar
                </button>

                <div className="mt-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <UserPlus size={24} />
                    </div>

                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                            Novo cliente
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Cadastro manual, editável pelo lojista.
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error}
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
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
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
                            required
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
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
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
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
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
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
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            Tags
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

                <div className="mt-6 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Salvar cliente
                    </button>
                </div>
            </form>
        </div>
    );
}