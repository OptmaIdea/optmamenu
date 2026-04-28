import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    FilePlus2,
    PackageSearch,
    RefreshCcw,
    ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';

import {
    stockService,
    type PurchaseSuggestionRow,
} from '@/services/stockService';
import {
    formatCurrencyPtBr,
    formatNumberPtBr,
} from '@/utils/export/formatters';

import { usePurchaseSuggestions } from '../hooks/usePurchaseSuggestions';

type PurchaseSuggestionsPanelProps = {
    storeId: string | null;
    onDraftCreated?: (purchaseDocumentId: string) => Promise<void> | void;
};

type GroupedSuggestion = {
    supplierId: string | null;
    supplierName: string;
    supplierBlocked: boolean;
    supplierPreferred: boolean;
    items: PurchaseSuggestionRow[];
};

function getSuggestionKey(row: PurchaseSuggestionRow) {
    return row.product_id;
}

function getSupplierKey(row: PurchaseSuggestionRow) {
    return row.suggested_supplier_id ?? 'no_supplier';
}

export function PurchaseSuggestionsPanel({
    storeId,
    onDraftCreated,
}: PurchaseSuggestionsPanelProps) {
    const {
        suggestions,
        loading,
        error,
        refresh,
    } = usePurchaseSuggestions(storeId);

    const [expanded, setExpanded] = useState(false);
    const [creatingGroup, setCreatingGroup] = useState<string | null>(null);

    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [unitCosts, setUnitCosts] = useState<Record<string, number>>({});

    useEffect(() => {
        setSelected((current) => {
            const next = { ...current };

            suggestions.forEach((row) => {
                const key = getSuggestionKey(row);
                if (next[key] === undefined) {
                    next[key] =
                        Boolean(row.suggested_supplier_id) &&
                        !row.suggested_supplier_blocked;
                }
            });

            return next;
        });

        setQuantities((current) => {
            const next = { ...current };

            suggestions.forEach((row) => {
                const key = getSuggestionKey(row);
                if (next[key] === undefined) {
                    next[key] = Number(row.suggested_purchase_qty ?? 1);
                }
            });

            return next;
        });

        setUnitCosts((current) => {
            const next = { ...current };

            suggestions.forEach((row) => {
                const key = getSuggestionKey(row);
                if (next[key] === undefined) {
                    next[key] = Number(row.suggested_unit_cost ?? 0);
                }
            });

            return next;
        });
    }, [suggestions]);

    const groups = useMemo(() => {
        const map = new Map<string, GroupedSuggestion>();

        suggestions.forEach((row) => {
            const key = getSupplierKey(row);

            const supplierName =
                row.suggested_supplier_trade_name ||
                row.suggested_supplier_name ||
                'Sem fornecedor histórico';

            const current =
                map.get(key) ??
                {
                    supplierId: row.suggested_supplier_id,
                    supplierName,
                    supplierBlocked: Boolean(row.suggested_supplier_blocked),
                    supplierPreferred: Boolean(row.suggested_supplier_preferred),
                    items: [],
                };

            current.items.push(row);
            map.set(key, current);
        });

        return Array.from(map.entries()).map(([key, group]) => ({
            key,
            ...group,
        }));
    }, [suggestions]);

    const totals = useMemo(() => {
        return suggestions.reduce(
            (acc, row) => {
                const key = getSuggestionKey(row);
                const qty = Number(quantities[key] ?? row.suggested_purchase_qty ?? 0);
                const cost = Number(unitCosts[key] ?? row.suggested_unit_cost ?? 0);

                acc.products += 1;
                acc.quantity += qty;
                acc.estimated += qty * cost;

                return acc;
            },
            {
                products: 0,
                quantity: 0,
                estimated: 0,
            },
        );
    }, [quantities, suggestions, unitCosts]);

    const handleCreateDraft = async (group: GroupedSuggestion & { key: string }) => {
        if (!group.supplierId) {
            toast.warning('Este grupo não possui fornecedor histórico. Crie o documento manualmente ou defina um fornecedor.');
            return;
        }

        if (group.supplierBlocked) {
            toast.warning('Fornecedor bloqueado. Revise o cadastro antes de criar uma compra.');
            return;
        }

        const selectedItems = group.items
            .filter((row) => selected[getSuggestionKey(row)])
            .map((row) => {
                const key = getSuggestionKey(row);

                return {
                    productId: row.product_id,
                    quantity: Number(quantities[key] ?? row.suggested_purchase_qty ?? 0),
                    unitCost: Number(unitCosts[key] ?? row.suggested_unit_cost ?? 0),
                };
            })
            .filter((item) => item.quantity > 0 && item.unitCost >= 0);

        if (!selectedItems.length) {
            toast.warning('Selecione ao menos um produto para criar o rascunho.');
            return;
        }

        try {
            setCreatingGroup(group.key);

            const result = await stockService.createPurchaseDocumentDraftBatch({
                supplierId: group.supplierId,
                items: selectedItems,
                notes: 'Rascunho criado a partir da central de sugestões de compra.',
            });

            toast.success(
                `Rascunho de compra criado com ${result.items_count} item(ns).`
            );

            await refresh();
            await onDraftCreated?.(result.purchase_document_id);
        } catch (err: any) {
            console.error('Erro ao criar rascunho de compra:', err);
            toast.error(err?.message ?? 'Não foi possível criar o rascunho de compra.');
        } finally {
            setCreatingGroup(null);
        }
    };

    if (!storeId) return null;

    return (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <ShoppingCart size={18} className="text-emerald-700 dark:text-emerald-300" />
                        <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                            Sugestões de compra
                        </h2>
                    </div>

                    <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-200/80">
                        Produtos abaixo do mínimo global, considerando estoque disponível e entrada em trânsito.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Produtos: {formatNumberPtBr(totals.products)}
                    </span>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Qtde: {formatNumberPtBr(totals.quantity)}
                    </span>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Estimado: {formatCurrencyPtBr(totals.estimated)}
                    </span>

                    <button
                        type="button"
                        onClick={() => void refresh()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
                    >
                        <RefreshCcw size={15} />
                        Atualizar
                    </button>

                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
                    >
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        {expanded ? 'Ocultar' : 'Ver'}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mt-4 space-y-3">
                    {loading && (
                        <div className="rounded-xl bg-white/70 p-4 text-sm text-emerald-800 dark:bg-gray-900/40 dark:text-emerald-200">
                            Carregando sugestões de compra...
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}

                    {!loading && !error && suggestions.length === 0 && (
                        <div className="rounded-xl border border-dashed border-emerald-200 bg-white/70 p-6 text-center text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-gray-900/40 dark:text-emerald-200">
                            Nenhuma sugestão de compra no momento. Os produtos estão acima do mínimo global ou já possuem entrada em trânsito suficiente.
                        </div>
                    )}

                    {!loading &&
                        !error &&
                        groups.map((group) => {
                            const selectedCount = group.items.filter(
                                (row) => selected[getSuggestionKey(row)],
                            ).length;

                            const groupTotal = group.items.reduce((sum, row) => {
                                const key = getSuggestionKey(row);
                                if (!selected[key]) return sum;

                                const qty = Number(quantities[key] ?? row.suggested_purchase_qty ?? 0);
                                const cost = Number(unitCosts[key] ?? row.suggested_unit_cost ?? 0);

                                return sum + qty * cost;
                            }, 0);

                            const canCreate =
                                Boolean(group.supplierId) &&
                                !group.supplierBlocked &&
                                !['rejected', 'reproved', 'reprovado', 'blocked', 'bloqueado'].includes(
                                    String(group.items[0]?.suggested_supplier_homologation_status ?? '').toLowerCase(),
                                ) &&
                                selectedCount > 0;

                            return (
                                <div
                                    key={group.key}
                                    className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-gray-900"
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <PackageSearch size={16} className="text-emerald-700 dark:text-emerald-300" />

                                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                                    {group.supplierName}
                                                </h3>

                                                {group.supplierPreferred && (
                                                    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700">
                                                        Preferencial
                                                    </span>
                                                )}

                                                {group.supplierBlocked && (
                                                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                                        Bloqueado
                                                    </span>
                                                )}

                                                {!group.supplierId && (
                                                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                                        Definir fornecedor manualmente
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                {selectedCount} de {group.items.length} produto(s) selecionado(s) · estimado {formatCurrencyPtBr(groupTotal)}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={!canCreate || creatingGroup === group.key}
                                            onClick={() => void handleCreateDraft(group)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <FilePlus2 size={16} />
                                            {creatingGroup === group.key
                                                ? 'Criando...'
                                                : 'Criar rascunho'}
                                        </button>
                                    </div>

                                    <div className="mt-4 overflow-x-auto">
                                        <table className="min-w-[1060px] w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                                    <th className="py-2 pr-3">Selecionar</th>
                                                    <th className="py-2 pr-3">Produto</th>
                                                    <th className="py-2 pr-3">Disponível</th>
                                                    <th className="py-2 pr-3">Trânsito entrada</th>
                                                    <th className="py-2 pr-3">Projetado</th>
                                                    <th className="py-2 pr-3">Mín/Máx</th>
                                                    <th className="py-2 pr-3">Comprar</th>
                                                    <th className="py-2 pr-3">Custo</th>
                                                    <th className="py-2 pr-3">Total</th>
                                                    <th className="py-2 pr-3">Motivo</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {group.items.map((row) => {
                                                    const key = getSuggestionKey(row);
                                                    const qty = Number(quantities[key] ?? row.suggested_purchase_qty ?? 0);
                                                    const cost = Number(unitCosts[key] ?? row.suggested_unit_cost ?? 0);

                                                    return (
                                                        <tr
                                                            key={row.product_id}
                                                            className="border-t border-gray-100 dark:border-gray-800"
                                                        >
                                                            <td className="py-2 pr-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={Boolean(selected[key])}
                                                                    disabled={!group.supplierId || group.supplierBlocked}
                                                                    onChange={(event) =>
                                                                        setSelected((current) => ({
                                                                            ...current,
                                                                            [key]: event.target.checked,
                                                                        }))
                                                                    }
                                                                />
                                                            </td>

                                                            <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">
                                                                {row.product_name}
                                                            </td>

                                                            <td className="py-2 pr-3">
                                                                {formatNumberPtBr(row.available)}
                                                            </td>

                                                            <td className="py-2 pr-3">
                                                                {Number(row.in_transit_in ?? 0) > 0
                                                                    ? `+${formatNumberPtBr(row.in_transit_in)}`
                                                                    : '—'}
                                                            </td>

                                                            <td className="py-2 pr-3">
                                                                {formatNumberPtBr(row.projected_available)}
                                                            </td>

                                                            <td className="py-2 pr-3">
                                                                {formatNumberPtBr(row.min_stock)} / {formatNumberPtBr(row.max_stock)}
                                                            </td>

                                                            <td className="py-2 pr-3">
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    value={qty}
                                                                    onChange={(event) =>
                                                                        setQuantities((current) => ({
                                                                            ...current,
                                                                            [key]: Math.max(1, Number(event.target.value || 1)),
                                                                        }))
                                                                    }
                                                                    className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
                                                                />
                                                            </td>

                                                            <td className="py-2 pr-3">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    step="0.01"
                                                                    value={cost}
                                                                    onChange={(event) =>
                                                                        setUnitCosts((current) => ({
                                                                            ...current,
                                                                            [key]: Math.max(0, Number(event.target.value || 0)),
                                                                        }))
                                                                    }
                                                                    className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
                                                                />
                                                            </td>

                                                            <td className="py-2 pr-3 font-semibold">
                                                                {formatCurrencyPtBr(qty * cost)}
                                                            </td>

                                                            <td className="py-2 pr-3 text-xs text-gray-500">
                                                                {row.recommendation_reason}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
        </section>
    );
}