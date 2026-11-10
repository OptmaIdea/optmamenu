import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Loader2, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
    LoyaltyAdvancedService,
    type LoyaltyAdminTransaction,
    type LoyaltyCustomer,
} from '@/services/loyaltyAdvancedService';

type Props = {
    storeId: string;
    programId: string;
};

export default function ActiveCustomers({ storeId, programId }: Props) {
    const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
    const [transactions, setTransactions] = useState<LoyaltyAdminTransaction[]>([]);
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [points, setPoints] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Mantido na assinatura para compatibilidade com a tela antiga; a RPC resolve
    // o programa ativo pelo vínculo seguro da loja.
    void programId;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [nextCustomers, nextTransactions] = await Promise.all([
                LoyaltyAdvancedService.getCustomers(storeId, search, 100),
                LoyaltyAdvancedService.getTransactions(storeId, selectedId || null, 200),
            ]);
            setCustomers(nextCustomers);
            setTransactions(nextTransactions);
        } catch (error) {
            console.error('[LOYALTY_LEGACY_SAFE] load failed', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao carregar participantes.');
        } finally {
            setLoading(false);
        }
    }, [storeId, search, selectedId]);

    useEffect(() => {
        void load();
    }, [load]);

    const selected = useMemo(
        () => customers.find((customer) => customer.id === selectedId) || null,
        [customers, selectedId],
    );

    async function submitAdjustment() {
        if (!selectedId) return;
        const delta = Math.trunc(Number(points));
        if (!Number.isFinite(delta) || delta === 0 || reason.trim().length < 3) {
            toast.error('Informe pontos diferentes de zero e um motivo com pelo menos 3 caracteres.');
            return;
        }
        setSaving(true);
        try {
            await LoyaltyAdvancedService.adjustPoints(storeId, selectedId, delta, reason.trim());
            setPoints('');
            setReason('');
            toast.success('Ajuste registrado no extrato.');
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao ajustar pontos.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2">
                <Users className="text-brand-green" size={20} />
                <div>
                    <h3 className="font-black text-gray-900 dark:text-white">Participantes</h3>
                    <p className="text-xs text-gray-500">Compatibilidade legada usando apenas RPCs seguras.</p>
                </div>
            </div>

            <form
                className="relative"
                onSubmit={(event) => {
                    event.preventDefault();
                    void load();
                }}
            >
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                    placeholder="Buscar por nome, apelido ou telefone"
                />
            </form>

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand-green" /></div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
                    <div className="space-y-2">
                        {customers.map((customer) => (
                            <button
                                key={customer.id}
                                type="button"
                                onClick={() => setSelectedId(customer.id)}
                                className={
                                    'w-full rounded-xl border p-3 text-left transition dark:border-gray-700 ' +
                                    (selectedId === customer.id ? 'border-brand-green bg-green-50/50 dark:bg-green-950/20' : 'border-gray-100')
                                }
                            >
                                <div className="font-bold text-gray-900 dark:text-white">
                                    {customer.full_name || customer.nickname || customer.phone || 'Cliente'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {customer.phone_e164 || customer.phone || '—'} · {customer.loyalty_points || 0} pontos
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                        {selected ? (
                            <>
                                <h4 className="font-black text-gray-900 dark:text-white">
                                    {selected.full_name || selected.nickname || selected.phone || 'Cliente'}
                                </h4>
                                <p className="mt-1 text-sm text-gray-500">Saldo: {selected.loyalty_points || 0} pontos</p>
                                <div className="mt-4 space-y-3">
                                    <input
                                        type="number"
                                        value={points}
                                        onChange={(event) => setPoints(event.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                                        placeholder="+ crédito / - estorno"
                                    />
                                    <textarea
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                                        placeholder="Motivo obrigatório"
                                    />
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => void submitAdjustment()}
                                        className="w-full rounded-xl bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                                    >
                                        {saving ? 'Registrando...' : 'Registrar ajuste'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-gray-500">Selecione um participante.</p>
                        )}
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-3 flex items-center gap-2 font-black text-gray-900 dark:text-white">
                    <History size={18} /> Extrato
                </div>
                <div className="space-y-2">
                    {transactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                            <div>
                                <div className="font-bold text-gray-900 dark:text-white">{transaction.description || transaction.type}</div>
                                <div className="text-xs text-gray-500">{new Date(transaction.created_at).toLocaleString('pt-BR')}</div>
                            </div>
                            <div className={transaction.points >= 0 ? 'font-black text-green-600' : 'font-black text-red-600'}>
                                {transaction.points > 0 ? '+' : ''}{transaction.points}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
