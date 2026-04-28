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

import { supabase } from '@/lib/supabase';
import {
    stockService,
    type PurchaseSuggestionRow,
} from '@/services/stockService';
import {
    formatCurrencyPtBr,
    formatNumberPtBr,
} from '@/utils/export/formatters';

import { usePurchaseSuggestions } from '../hooks/usePurchaseSuggestions';
import { PurchaseQuotationPreviewModal } from './PurchaseQuotationPreviewModal';

type EligibleSupplierOption = {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    secondary_phone?: string | null;

    commercial_phone?: string | null;
    commercial_whatsapp?: string | null;
    commercial_email?: string | null;

    financial_phone?: string | null;
    financial_email?: string | null;

    fiscal_phone?: string | null;
    fiscal_email?: string | null;

    metadata?: Record<string, unknown> | null;

    active: boolean;
    blocked: boolean;
    homologation_status: string | null;
};

type PurchaseSuggestionsPanelProps = {
    storeId: string | null;
    onDraftCreated?: (purchaseDocumentId: string) => Promise<void> | void;
};


function getSuggestionKey(row: PurchaseSuggestionRow) {
    return row.product_id;
}

function getSupplierPhoneForQuotation(supplier?: EligibleSupplierOption | null) {
    if (!supplier) return null;

    const metadata = supplier.metadata as
        | {
            whatsapp?: string | null;
            phone?: string | null;
            commercial_whatsapp?: string | null;
            commercial_phone?: string | null;
        }
        | undefined;

    return (
        supplier.commercial_whatsapp ||
        supplier.commercial_phone ||
        supplier.phone ||
        supplier.secondary_phone ||
        supplier.financial_phone ||
        supplier.fiscal_phone ||
        metadata?.commercial_whatsapp ||
        metadata?.commercial_phone ||
        metadata?.whatsapp ||
        metadata?.phone ||
        null
    );
}

function getSupplierEmailForQuotation(supplier?: EligibleSupplierOption | null) {
    if (!supplier) return null;

    const metadata = supplier.metadata as
        | {
            email?: string | null;
            commercial_email?: string | null;
            financial_email?: string | null;
            fiscal_email?: string | null;
        }
        | undefined;

    return (
        supplier.commercial_email ||
        supplier.email ||
        supplier.financial_email ||
        supplier.fiscal_email ||
        metadata?.commercial_email ||
        metadata?.email ||
        metadata?.financial_email ||
        metadata?.fiscal_email ||
        null
    );
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

    const [eligibleSuppliers, setEligibleSuppliers] = useState<EligibleSupplierOption[]>([]);
    const [supplierBySuggestion, setSupplierBySuggestion] = useState<Record<string, string>>({});

    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [unitCosts, setUnitCosts] = useState<Record<string, number>>({});

    const [quotationPreview, setQuotationPreview] = useState<{
        supplierId: string;
        supplierName: string;
        supplierPhone?: string | null;
        supplierEmail?: string | null;
        items: {
            productId: string;
            productName: string;
            quantity: number;
            unitCost?: number | null;
        }[];
    } | null>(null);

    useEffect(() => {
        async function loadEligibleSuppliers() {
            if (!storeId) return;

            const { data, error } = await supabase
                .from('suppliers')
                .select(`
                    id,
                    name,
                    phone,
                    email,
                    secondary_phone,
                    commercial_phone,
                    commercial_whatsapp,
                    commercial_email,
                    financial_phone,
                    financial_email,
                    fiscal_phone,
                    fiscal_email,
                    metadata,
                    active,
                    blocked,
                    homologation_status
                    `)
                .eq('store_id', storeId)
                .eq('active', true)
                .eq('blocked', false)
                .eq('homologation_status', 'approved')
                .order('name', { ascending: true });

            if (error) {
                console.error('Erro ao carregar fornecedores elegíveis:', error);
                toast.error('Não foi possível carregar fornecedores para compra.');
                return;
            }

            setEligibleSuppliers(data ?? []);
        }

        loadEligibleSuppliers();
    }, [storeId]);

    useEffect(() => {
        if (!suggestions.length) return;

        setSupplierBySuggestion((current) => {
            const next = { ...current };

            suggestions.forEach((row) => {
                const key = getSuggestionKey(row);

                if (!next[key] && row.suggested_supplier_id) {
                    next[key] = row.suggested_supplier_id;
                }
            });

            return next;
        });
    }, [suggestions]);

    useEffect(() => {
        setSelected((current) => {
            const next = { ...current };

            suggestions.forEach((row) => {
                const key = getSuggestionKey(row);
                if (next[key] === undefined) {
                    next[key] = true; // start selected by default
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
        const map = new Map<string, PurchaseSuggestionRow[]>();

        suggestions.forEach((row) => {
            const chosenSupplierId = supplierBySuggestion[getSuggestionKey(row)];

            if (!chosenSupplierId) {
                const key = 'without_supplier';
                map.set(key, [...(map.get(key) ?? []), row]);
                return;
            }

            map.set(chosenSupplierId, [...(map.get(chosenSupplierId) ?? []), row]);
        });

        return Array.from(map.entries()).map(([supplierId, rows]) => {
            const supplier =
                eligibleSuppliers.find((item) => item.id === supplierId) ?? null;

            return {
                supplierId,
                supplierName:
                    supplierId === 'without_supplier'
                        ? 'Produtos pendentes de fornecedor'
                        : supplier?.name ?? 'Fornecedor selecionado',
                rows,
                canCreateDraft: supplierId !== 'without_supplier',
            };
        });
    }, [suggestions, supplierBySuggestion, eligibleSuppliers]);

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

    const handleCreateDraftForGroup = async (group: {
        supplierId: string;
        supplierName: string;
        rows: PurchaseSuggestionRow[];
        canCreateDraft: boolean;
    }) => {
        if (!group.canCreateDraft || group.supplierId === 'without_supplier') {
            toast.error('Escolha um fornecedor antes de criar o rascunho.');
            return;
        }

        const selectedRows = group.rows.filter((row) =>
            selected[getSuggestionKey(row)]
        );

        if (!selectedRows.length) {
            toast.error('Selecione ao menos um produto.');
            return;
        }

        try {
            setCreatingGroup(group.supplierId);

            const result = await stockService.createPurchaseDocumentDraftBatch({
                supplierId: group.supplierId,
                items: selectedRows.map((row) => ({
                    productId: row.product_id,
                    quantity: quantities[getSuggestionKey(row)] ?? row.suggested_purchase_qty ?? 1,
                    unitCost: unitCosts[getSuggestionKey(row)] ?? row.suggested_unit_cost ?? 0,
                })),
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

    function handleOpenQuotationForGroup(group: {
        supplierId: string;
        supplierName: string;
        rows: PurchaseSuggestionRow[];
        canCreateDraft: boolean;
    }) {
        if (!group.canCreateDraft || group.supplierId === 'without_supplier') {
            toast.error('Escolha um fornecedor antes de gerar a cotação.');
            return;
        }

        const selectedRows = group.rows.filter((row) =>
            selected[getSuggestionKey(row)],
        );

        if (!selectedRows.length) {
            toast.error('Selecione ao menos um produto para cotação.');
            return;
        }

        const supplier = eligibleSuppliers.find(
            (item) => item.id === group.supplierId,
        );

        setQuotationPreview({
            supplierId: group.supplierId,
            supplierName: group.supplierName,
            supplierPhone: getSupplierPhoneForQuotation(supplier),
            supplierEmail: getSupplierEmailForQuotation(supplier),
            items: selectedRows.map((row) => {
                const key = getSuggestionKey(row);

                return {
                    productId: row.product_id,
                    productName: row.product_name,
                    quantity: Number(quantities[key] ?? row.suggested_purchase_qty ?? 0),
                    unitCost: Number(unitCosts[key] ?? row.suggested_unit_cost ?? 0),
                };
            }),
        });
    }

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
                            const selectedCount = group.rows.filter(
                                (row) => selected[getSuggestionKey(row)],
                            ).length;

                            const groupTotal = group.rows.reduce((sum, row) => {
                                const key = getSuggestionKey(row);
                                if (!selected[key]) return sum;

                                const qty = Number(quantities[key] ?? row.suggested_purchase_qty ?? 0);
                                const cost = Number(unitCosts[key] ?? row.suggested_unit_cost ?? 0);

                                return sum + qty * cost;
                            }, 0);

                            const canCreate = group.canCreateDraft && selectedCount > 0;

                            return (
                                <div
                                    key={group.supplierId}
                                    className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-gray-900"
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <PackageSearch size={16} className="text-emerald-700 dark:text-emerald-300" />

                                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                                    {group.supplierName}
                                                </h3>
                                            </div>

                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                {selectedCount} de {group.rows.length} produto(s) selecionado(s) · estimado {formatCurrencyPtBr(groupTotal)}
                                            </p>
                                        </div>

                                        {group.canCreateDraft ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenQuotationForGroup(group)}
                                                    disabled={!canCreate}
                                                    className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Gerar cotação
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={!canCreate || creatingGroup === group.supplierId}
                                                    onClick={() => void handleCreateDraftForGroup(group)}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <FilePlus2 size={16} />
                                                    {creatingGroup === group.supplierId
                                                        ? 'Criando...'
                                                        : 'Criar rascunho'}
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-medium text-amber-600">
                                                Escolha um fornecedor em cada item para liberar a criação do rascunho.
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4 overflow-x-auto">
                                        <table className="min-w-[1060px] w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                                    <th className="py-2 pr-3">Sel.</th>
                                                    <th className="py-2 pr-3">Produto</th>
                                                    <th className="py-2 pr-3">Fornecedor</th>
                                                    <th className="py-2 pr-3">Disponível</th>
                                                    <th className="py-2 pr-3">Comprar</th>
                                                    <th className="py-2 pr-3">Custo</th>
                                                    <th className="py-2 pr-3">Total</th>
                                                    <th className="py-2 pr-3">Motivo</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {group.rows.map((row) => {
                                                    const key = getSuggestionKey(row);
                                                    const qty = Number(quantities[key] ?? row.suggested_purchase_qty ?? 0);
                                                    const cost = Number(unitCosts[key] ?? row.suggested_unit_cost ?? 0);

                                                    const selectedSupplierId = supplierBySuggestion[key] ?? '';
                                                    const suggestedSupplierId = row.suggested_supplier_id ?? '';
                                                    const supplierWasChanged =
                                                        suggestedSupplierId &&
                                                        selectedSupplierId &&
                                                        selectedSupplierId !== suggestedSupplierId;

                                                    const hasChosenSupplier = Boolean(selectedSupplierId);

                                                    return (
                                                        <tr
                                                            key={row.product_id}
                                                            className="border-t border-gray-100 dark:border-gray-800"
                                                        >
                                                            <td className="py-2 pr-3 align-top pt-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={Boolean(selected[key])}
                                                                    disabled={!hasChosenSupplier}
                                                                    onChange={(event) =>
                                                                        setSelected((current) => ({
                                                                            ...current,
                                                                            [key]: event.target.checked,
                                                                        }))
                                                                    }
                                                                />
                                                            </td>

                                                            <td className="py-2 pr-3 align-top pt-3 font-medium text-gray-900 dark:text-gray-100">
                                                                {row.product_name}
                                                            </td>

                                                            <td className="py-2 pr-3 align-top pt-2">
                                                                <div className="space-y-1 w-48">
                                                                    <select
                                                                        value={selectedSupplierId}
                                                                        onChange={(event) => {
                                                                            setSupplierBySuggestion((current) => ({
                                                                                ...current,
                                                                                [key]: event.target.value,
                                                                            }));
                                                                        }}
                                                                        className="w-full rounded-lg border px-2 py-1 text-xs"
                                                                    >
                                                                        <option value="">Selecionar fornecedor</option>
                                                                        {eligibleSuppliers.map((supplier) => (
                                                                            <option key={supplier.id} value={supplier.id}>
                                                                                {supplier.name}
                                                                            </option>
                                                                        ))}
                                                                    </select>

                                                                    {row.suggested_supplier_name ? (
                                                                        <p className="text-[11px] text-slate-500">
                                                                            Sugerido: {row.suggested_supplier_name}
                                                                        </p>
                                                                    ) : (
                                                                        <p className="text-[11px] text-amber-600">
                                                                            Sem histórico: escolha um fornecedor aprovado.
                                                                        </p>
                                                                    )}

                                                                    {supplierWasChanged && (
                                                                        <div className="flex items-center gap-1 mt-1">
                                                                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
                                                                                Alterado
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {!hasChosenSupplier && (
                                                                        <p className="text-[11px] text-red-500">
                                                                            Escolha um fornecedor para incluir este item.
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            <td className="py-2 pr-3 align-top pt-3">
                                                                {formatNumberPtBr(row.available)}
                                                                {Number(row.in_transit_in ?? 0) > 0 && (
                                                                    <span className="text-xs text-gray-400 ml-1">
                                                                        (+{formatNumberPtBr(row.in_transit_in)})
                                                                    </span>
                                                                )}
                                                            </td>

                                                            <td className="py-2 pr-3 align-top pt-2">
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

                                                            <td className="py-2 pr-3 align-top pt-2">
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

                                                            <td className="py-2 pr-3 align-top pt-3 font-semibold">
                                                                {formatCurrencyPtBr(qty * cost)}
                                                            </td>

                                                            <td className="py-2 pr-3 align-top pt-3 text-xs text-gray-500">
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

            <PurchaseQuotationPreviewModal
                open={Boolean(quotationPreview)}
                supplierName={quotationPreview?.supplierName ?? ''}
                supplierPhone={quotationPreview?.supplierPhone}
                supplierEmail={quotationPreview?.supplierEmail}
                items={quotationPreview?.items ?? []}
                onClose={() => setQuotationPreview(null)}
            />
        </section>
    );
}