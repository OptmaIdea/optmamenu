import { CreditCard, Banknote, QrCode, X, Landmark } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Order } from '@/types';
import { supabase } from '@/lib/supabase';

export type FinalPaymentMethodCode = 'pix' | 'cash' | 'debit_card' | 'credit_card';

interface OrderPaymentModalProps {
    order: Order | null;
    loading?: boolean;
    onClose: () => void;
    onConfirm: (method: FinalPaymentMethodCode) => Promise<void> | void;
}

interface FinancialAccountOption {
    id: string;
    name: string;
    active: boolean;
}

interface PaymentRouteOption {
    id: string;
    scope?: string | null;
    fulfillment_type: string;
    payment_timing: string;
    payment_method_code: string;
    destination_financial_account_id: string | null;
    allow_override_on_receipt: boolean;
    active: boolean;
    sort_order: number | null;
}

const METHODS: Array<{
    code: FinalPaymentMethodCode;
    label: string;
    description: string;
    icon: typeof QrCode;
}> = [
    { code: 'pix', label: 'PIX', description: 'Pagamento recebido por PIX direto', icon: QrCode },
    { code: 'cash', label: 'Dinheiro', description: 'Pagamento recebido em espécie', icon: Banknote },
    { code: 'debit_card', label: 'Cartão de débito', description: 'Pagamento na maquininha', icon: CreditCard },
    { code: 'credit_card', label: 'Cartão de crédito', description: 'Pagamento na maquininha', icon: CreditCard },
];

function compactCode(value?: string | null) {
    const suffix = String(value || '').split('-').pop();
    return suffix ? `#${suffix}` : '#PEDIDO';
}

function getOrderStoreId(order: Order) {
    return (order as Order & { store_id?: string | null }).store_id || '';
}

function getOrderFulfillment(order: Order) {
    return (order as Order & { fulfillment_type?: string | null }).fulfillment_type === 'delivery' ? 'delivery' : 'pickup';
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeFinalMethod(value: string): FinalPaymentMethodCode | null {
    const code = value.trim().toLowerCase();
    if (['pix', 'pix_direct', 'pix_key', 'pix_manual'].includes(code)) return 'pix';
    if (['cash', 'dinheiro'].includes(code)) return 'cash';
    if (['debit_card', 'debit', 'card_debit'].includes(code)) return 'debit_card';
    if (['credit_card', 'credit', 'card_credit'].includes(code)) return 'credit_card';
    if (code === 'card') return 'debit_card';
    return null;
}

function getInitialPaymentMethod(order: Order): FinalPaymentMethodCode {
    const publicOrder = order as Order & {
        payment_method_code?: string | null;
        payment_method?: string | null;
        promised_payment_method_code?: string | null;
        payment_metadata?: Record<string, unknown> | null;
        commercial_metadata?: Record<string, unknown> | null;
    };
    const metadata = asRecord(publicOrder.payment_metadata);
    const checkout = asRecord(metadata.checkout);
    const commercial = asRecord(publicOrder.commercial_metadata);
    return normalizeFinalMethod(asString(checkout.promised_method_code))
        || normalizeFinalMethod(asString(commercial.promised_payment_method))
        || normalizeFinalMethod(asString(publicOrder.promised_payment_method_code))
        || normalizeFinalMethod(asString(publicOrder.payment_method_code))
        || normalizeFinalMethod(asString(publicOrder.payment_method))
        || 'pix';
}

function getRouteForMethod(routes: PaymentRouteOption[], fulfillmentType: string, method: FinalPaymentMethodCode) {
    const equivalentMethods = method === 'pix'
        ? ['pix', 'pix_direct']
        : method === 'debit_card'
            ? ['debit_card', 'card']
            : method === 'credit_card'
                ? ['credit_card', 'card']
                : [method];

    const candidates = routes
        .filter((route) => route.active)
        .filter((route) => ['public_store', 'any', undefined, null].includes(route.scope))
        .filter((route) => [fulfillmentType, 'any'].includes(route.fulfillment_type))
        .filter((route) => ['pay_on_fulfillment', 'any'].includes(route.payment_timing))
        .filter((route) => [...equivalentMethods, '*'].includes(route.payment_method_code))
        .sort((a, b) => {
            const aScore = (a.fulfillment_type === fulfillmentType ? 0 : 10)
                + (equivalentMethods.includes(a.payment_method_code) ? 0 : 1)
                + (a.sort_order || 0) / 1000;
            const bScore = (b.fulfillment_type === fulfillmentType ? 0 : 10)
                + (equivalentMethods.includes(b.payment_method_code) ? 0 : 1)
                + (b.sort_order || 0) / 1000;
            return aScore - bScore;
        });
    return candidates[0] || null;
}

export default function OrderPaymentModal({ order, loading = false, onClose, onConfirm }: OrderPaymentModalProps) {
    const [selected, setSelected] = useState<FinalPaymentMethodCode>('pix');
    const [accounts, setAccounts] = useState<FinancialAccountOption[]>([]);
    const [routes, setRoutes] = useState<PaymentRouteOption[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [routingLoading, setRoutingLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const storeId = order ? getOrderStoreId(order) : '';
    const fulfillmentType = order ? getOrderFulfillment(order) : 'pickup';
    const route = useMemo(() => getRouteForMethod(routes, fulfillmentType, selected), [fulfillmentType, routes, selected]);
    const selectedAccount = accounts.find((account) => account.id === selectedAccountId) || null;
    const routeAccount = accounts.find((account) => account.id === route?.destination_financial_account_id) || null;
    const canOverrideAccount = route?.allow_override_on_receipt !== false;

    useEffect(() => {
        if (order) setSelected(getInitialPaymentMethod(order));
    }, [order?.id]);

    useEffect(() => {
        if (!order || !storeId) {
            setAccounts([]);
            setRoutes([]);
            return;
        }

        let cancelled = false;
        async function loadRouting() {
            setRoutingLoading(true);
            try {
                const [accountsResult, routesResult] = await Promise.all([
                    supabase
                        .from('store_financial_accounts')
                        .select('id, name, active')
                        .eq('store_id', storeId)
                        .eq('active', true)
                        .order('sort_order', { ascending: true })
                        .order('name', { ascending: true }),
                    supabase
                        .from('store_order_payment_account_routes')
                        .select('id, scope, fulfillment_type, payment_timing, payment_method_code, destination_financial_account_id, allow_override_on_receipt, active, sort_order')
                        .eq('store_id', storeId)
                        .eq('scope', 'public_store')
                        .eq('active', true)
                        .order('sort_order', { ascending: true }),
                ]);

                if (accountsResult.error) throw accountsResult.error;
                if (routesResult.error) throw routesResult.error;
                if (!cancelled) {
                    setAccounts((accountsResult.data || []) as FinancialAccountOption[]);
                    setRoutes((routesResult.data || []) as PaymentRouteOption[]);
                }
            } catch (error) {
                console.error('Erro ao carregar rotas de recebimento:', error);
                if (!cancelled) {
                    setAccounts([]);
                    setRoutes([]);
                }
            } finally {
                if (!cancelled) setRoutingLoading(false);
            }
        }

        void loadRouting();
        return () => { cancelled = true; };
    }, [order, storeId]);

    useEffect(() => {
        const nextRoute = getRouteForMethod(routes, fulfillmentType, selected);
        const routeAccountId = nextRoute?.destination_financial_account_id || '';
        setSelectedAccountId((current) => {
            if (nextRoute?.allow_override_on_receipt && accounts.some((account) => account.id === current)) return current;
            return routeAccountId || accounts[0]?.id || '';
        });
    }, [accounts, fulfillmentType, routes, selected]);

    if (!order) return null;
    const orderCode = (order as Order & { order_code?: string }).order_code || order.id;
    const isWorking = loading || submitting;

    async function confirmWithAccount() {
        if (!order) return;
        if (!selectedAccountId) {
            toast.error('Selecione a conta financeira que recebeu o pagamento.');
            return;
        }

        try {
            setSubmitting(true);
            if (storeId) {
                const { data, error } = await supabase.rpc('set_order_payment_finalization_account_safe', {
                    p_order_id: order.id,
                    p_payment_method_code: selected,
                    p_financial_account_id: selectedAccountId,
                });
                if (error) throw error;
                if (data?.ok === false) throw new Error(data?.error || 'Não foi possível registrar a conta de recebimento.');
            }
            await onConfirm(selected);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível confirmar o pagamento.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/55 p-3 pt-4 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-gray-850 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-brand-green">Finalizar pedido</p>
                        <h2 className="mt-1 text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Confirme o pagamento</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {compactCode(orderCode)} · {order.customer_name || 'Cliente'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} disabled={isWorking} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <X size={20} />
                    </button>
                </div>

                <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2">
                    {METHODS.map((method) => {
                        const Icon = method.icon;
                        const active = selected === method.code;
                        return (
                            <button
                                key={method.code}
                                type="button"
                                onClick={() => setSelected(method.code)}
                                disabled={isWorking}
                                className={`rounded-2xl border-2 p-4 text-left transition ${active
                                    ? 'border-brand-green bg-brand-green/5'
                                    : 'border-gray-200 hover:border-brand-green/40 dark:border-gray-700'
                                }`}
                            >
                                <Icon size={22} className={active ? 'text-brand-green' : 'text-gray-400'} />
                                <span className="mt-3 block font-black text-gray-900 dark:text-white">{method.label}</span>
                                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{method.description}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm dark:bg-gray-800 sm:mt-6">
                    <div className="flex justify-between gap-4">
                        <span className="text-gray-500">Total a registrar</span>
                        <strong className="text-lg text-gray-900 dark:text-white">
                            {Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
                    <div className="flex items-start gap-3">
                        <Landmark size={18} className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="font-black">Conta que receberá o valor</p>
                            <p className="mt-1 text-xs font-semibold opacity-85">
                                Padrão da rota: {routeAccount?.name || 'não definido'}{canOverrideAccount ? ' · pode alterar nesta baixa' : ' · travado pela regra'}.
                            </p>
                            <select
                                value={selectedAccountId}
                                disabled={isWorking || routingLoading || !canOverrideAccount}
                                onChange={(event) => setSelectedAccountId(event.target.value)}
                                className="mt-3 w-full rounded-xl border border-teal-200 bg-white px-3 py-3 text-base font-bold text-gray-900 outline-none disabled:cursor-not-allowed disabled:opacity-70 dark:border-teal-800 dark:bg-gray-950 dark:text-white sm:py-2 sm:text-sm"
                            >
                                <option value="">Selecione uma conta</option>
                                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                            </select>
                            {selectedAccount && <p className="mt-2 text-xs font-bold opacity-90">Selecionada: {selectedAccount.name}</p>}
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 -mx-5 mt-5 flex flex-col-reverse gap-3 border-t border-gray-100 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-850 sm:static sm:mx-0 sm:mt-6 sm:flex-row sm:justify-end sm:border-t-0 sm:bg-transparent sm:p-0 sm:dark:bg-transparent">
                    <button type="button" onClick={onClose} disabled={isWorking} className="rounded-xl border border-gray-200 px-5 py-3 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300">
                        Voltar
                    </button>
                    <button type="button" onClick={() => void confirmWithAccount()} disabled={isWorking || !selectedAccountId} className="rounded-xl bg-green-600 px-6 py-3 font-black text-white hover:bg-green-700 disabled:opacity-60">
                        {isWorking ? 'Finalizando...' : 'Confirmar pagamento e finalizar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
