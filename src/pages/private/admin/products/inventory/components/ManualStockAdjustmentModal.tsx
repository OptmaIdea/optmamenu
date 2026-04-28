import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, PackageMinus, PackagePlus, Scale, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    adjustStockToPhysicalCount,
    createManualStockAdjustment,
    type ManualStockAdjustmentKind,
} from '@/services/stockService';
import { supabase } from '@/lib/supabase';

type Option = {
    value: ManualStockAdjustmentKind;
    label: string;
    description: string;
};

const adjustmentOptions: Option[] = [
    {
        value: 'damage',
        label: 'Baixa por avaria',
        description: 'Produto danificado, derretido, quebrado ou impróprio.',
    },
    {
        value: 'expired',
        label: 'Baixa por vencimento',
        description: 'Produto vencido ou fora do prazo de uso/venda.',
    },
    {
        value: 'breakage',
        label: 'Baixa por quebra',
        description: 'Perda física por quebra ou inutilização.',
    },
    {
        value: 'loss',
        label: 'Baixa por perda',
        description: 'Produto desaparecido, perda operacional ou ajuste negativo.',
    },
    {
        value: 'manual_exit',
        label: 'Saída por correção',
        description: 'Correção manual negativa de inventário.',
    },
    {
        value: 'manual_entry',
        label: 'Entrada por correção',
        description: 'Correção manual positiva de inventário.',
    },
    {
        value: 'physical_count',
        label: 'Ajustar para contagem física',
        description: 'Informe quanto foi contado fisicamente. O sistema calcula a diferença.',
    },
];

type ProductOption = {
    id: string;
    name: string;
};

type LocationOption = {
    id: string;
    name: string;
    code?: string | null;
};

type ManualStockAdjustmentModalProps = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    products: ProductOption[];
    locations: LocationOption[];
};

export function ManualStockAdjustmentModal({
    open,
    onClose,
    onSuccess,
    products,
    locations,
}: ManualStockAdjustmentModalProps) {
    const [productId, setProductId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [adjustmentKind, setAdjustmentKind] =
        useState<ManualStockAdjustmentKind>('damage');
    const [quantity, setQuantity] = useState('1');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [locationBalance, setLocationBalance] = useState<{
        onHand: number;
        reserved: number;
        available: number;
    } | null>(null);

    const selectedOption = useMemo(
        () => adjustmentOptions.find((option) => option.value === adjustmentKind),
        [adjustmentKind],
    );

    const isPhysicalCount = adjustmentKind === 'physical_count';
    const countedQuantity = Number(quantity || 0);
    const safeCountedQuantity = Number.isFinite(countedQuantity) ? countedQuantity : 0;
    const currentOnHand = Number(locationBalance?.onHand ?? 0);
    const physicalCountDiff = safeCountedQuantity - currentOnHand;
    const physicalCountResult =
        physicalCountDiff < 0
            ? 'baixa por ajuste de inventário'
            : physicalCountDiff > 0
                ? 'entrada por ajuste de inventário'
                : 'nenhum movimento será criado';
    const isDecrease = isPhysicalCount ? physicalCountDiff < 0 : adjustmentKind !== 'manual_entry';

    useEffect(() => {
        let cancelled = false;

        async function fetchLocationBalance() {
            if (!open || !isPhysicalCount || !productId || !locationId) {
                setLocationBalance(null);
                return;
            }

            setBalanceLoading(true);
            try {
                const { data, error } = await supabase
                    .from('inventory_location_balances')
                    .select('on_hand, reserved')
                    .eq('product_id', productId)
                    .eq('location_id', locationId)
                    .maybeSingle();

                if (error) throw error;
                if (cancelled) return;

                const onHand = Number(data?.on_hand ?? 0);
                const reserved = Number(data?.reserved ?? 0);
                setLocationBalance({
                    onHand,
                    reserved,
                    available: onHand - reserved,
                });
            } catch (error) {
                console.error('Erro ao buscar saldo do local:', error);
                if (!cancelled) {
                    setLocationBalance({ onHand: 0, reserved: 0, available: 0 });
                }
            } finally {
                if (!cancelled) setBalanceLoading(false);
            }
        }

        void fetchLocationBalance();

        return () => {
            cancelled = true;
        };
    }, [open, isPhysicalCount, productId, locationId]);

    function resetForm() {
        setProductId('');
        setLocationId('');
        setAdjustmentKind('damage');
        setQuantity('1');
        setReason('');
        setNotes('');
        setLocationBalance(null);
    }

    if (!open) return null;

    async function handleSubmit() {
        const numericQuantity = Number(quantity);

        if (!productId) {
            toast.error('Selecione o produto.');
            return;
        }

        if (!locationId) {
            toast.error('Selecione o local de estoque.');
            return;
        }

        if (!Number.isFinite(numericQuantity) || numericQuantity < 0) {
            toast.error('Informe uma quantidade válida.');
            return;
        }

        if (!isPhysicalCount && numericQuantity <= 0) {
            toast.error('Informe uma quantidade maior que zero.');
            return;
        }

        try {
            setSaving(true);

            if (isPhysicalCount) {
                const result = await adjustStockToPhysicalCount({
                    productId,
                    locationId,
                    countedQuantity: numericQuantity,
                    reason: reason.trim() || 'Ajuste por contagem física',
                    notes: notes.trim() || null,
                });

                const first = result[0];

                if (first?.adjustment_quantity === 0) {
                    toast.info(first.message || 'Nenhum ajuste necessário.');
                } else {
                    toast.success('Estoque ajustado pela contagem física.');
                }

                onSuccess();
                onClose();
                resetForm();
                return;
            }

            await createManualStockAdjustment({
                productId,
                locationId,
                adjustmentKind,
                quantity: numericQuantity,
                reason: reason.trim() || selectedOption?.label || undefined,
                notes: notes.trim() || undefined,
            });

            toast.success('Ajuste de estoque registrado.');
            onSuccess();
            onClose();
            resetForm();
        } catch (error) {
            console.error('Erro ao registrar ajuste de estoque:', error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível registrar o ajuste.',
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b p-5">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Registrar ajuste de estoque
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Use para avaria, perda, vencimento, quebra, contagem física ou correção manual.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        <div className="flex gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                                {isPhysicalCount ? (
                                    <>
                                        <strong>Atenção:</strong> informe a quantidade realmente encontrada no local.
                                        O sistema vai ajustar o estoque para esse número, registrando a diferença
                                        como correção de inventário.
                                    </>
                                ) : (
                                    <>
                                        <strong>Atenção:</strong> este ajuste altera o estoque físico do
                                        local selecionado. Para compras e transferências, prefira os
                                        fluxos próprios do sistema.
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1">
                            <span className="text-xs font-semibold uppercase text-slate-500">
                                Produto
                            </span>
                            <select
                                value={productId}
                                onChange={(event) => setProductId(event.target.value)}
                                className="w-full rounded-xl border px-3 py-2 text-sm"
                            >
                                <option value="">Selecione</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {product.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="space-y-1">
                            <span className="text-xs font-semibold uppercase text-slate-500">
                                Local
                            </span>
                            <select
                                value={locationId}
                                onChange={(event) => setLocationId(event.target.value)}
                                className="w-full rounded-xl border px-3 py-2 text-sm"
                            >
                                <option value="">Selecione</option>
                                {locations.map((location) => (
                                    <option key={location.id} value={location.id}>
                                        {location.name}
                                        {location.code ? ` (${location.code})` : ''}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase text-slate-500">
                            Tipo de ajuste
                        </span>
                        <select
                            value={adjustmentKind}
                            onChange={(event) =>
                                setAdjustmentKind(event.target.value as ManualStockAdjustmentKind)
                            }
                            className="w-full rounded-xl border px-3 py-2 text-sm"
                        >
                            {adjustmentOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {selectedOption && (
                            <p className="text-xs text-slate-500">
                                {selectedOption.description}
                            </p>
                        )}
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1">
                            <span className="text-xs font-semibold uppercase text-slate-500">
                                {isPhysicalCount ? 'Contagem física encontrada' : 'Quantidade'}
                            </span>
                            <input
                                value={quantity}
                                onChange={(event) => setQuantity(event.target.value)}
                                type="number"
                                min="0"
                                step="1"
                                className="w-full rounded-xl border px-3 py-2 text-sm"
                            />
                        </label>

                        <div className="rounded-2xl border bg-slate-50 p-4 text-sm">
                            <div className="flex items-center gap-2 font-semibold text-slate-700">
                                {isPhysicalCount ? (
                                    <Scale className="h-4 w-4 text-blue-500" />
                                ) : isDecrease ? (
                                    <PackageMinus className="h-4 w-4 text-red-500" />
                                ) : (
                                    <PackagePlus className="h-4 w-4 text-emerald-500" />
                                )}
                                {isPhysicalCount
                                    ? 'Contagem física'
                                    : isDecrease
                                        ? 'Reduz estoque'
                                        : 'Aumenta estoque'}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                {isPhysicalCount
                                    ? 'A diferença será calculada a partir do saldo atual do local.'
                                    : isDecrease
                                        ? 'A quantidade será registrada como saída/baixa.'
                                        : 'A quantidade será registrada como entrada.'}
                            </p>
                        </div>
                    </div>

                    {isPhysicalCount && (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                            <div className="grid gap-2 md:grid-cols-2">
                                <div>Saldo atual no local: <strong>{balanceLoading ? '...' : currentOnHand}</strong></div>
                                <div>Reservado no local: <strong>{balanceLoading ? '...' : locationBalance?.reserved ?? 0}</strong></div>
                                <div>Disponível no local: <strong>{balanceLoading ? '...' : locationBalance?.available ?? 0}</strong></div>
                                <div>Contagem informada: <strong>{safeCountedQuantity}</strong></div>
                                <div>
                                    Diferença calculada:{' '}
                                    <strong>{physicalCountDiff > 0 ? `+${physicalCountDiff}` : physicalCountDiff}</strong>
                                </div>
                                <div>Resultado: <strong>{physicalCountResult}</strong></div>
                            </div>

                            <div className="mt-3 rounded-xl bg-white/70 p-3 text-xs">
                                {physicalCountDiff < 0 && (
                                    <>Será registrada uma baixa de {Math.abs(physicalCountDiff)} unidade(s).</>
                                )}
                                {physicalCountDiff > 0 && (
                                    <>Será registrada uma entrada de {physicalCountDiff} unidade(s).</>
                                )}
                                {physicalCountDiff === 0 && <>Nenhum movimento será criado.</>}
                            </div>
                        </div>
                    )}

                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase text-slate-500">
                            Motivo
                        </span>
                        <input
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder={selectedOption?.label ?? 'Motivo do ajuste'}
                            className="w-full rounded-xl border px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase text-slate-500">
                            Observação
                        </span>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Ex.: produto derreteu, embalagem rompida, contagem física divergente..."
                            className="min-h-24 w-full rounded-xl border px-3 py-2 text-sm"
                        />
                    </label>
                </div>

                <div className="flex justify-end gap-3 border-t p-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                        {saving ? 'Salvando...' : 'Registrar ajuste'}
                    </button>
                </div>
            </div>
        </div>
    );
}
