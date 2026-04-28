import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    BadgeCheck,
    History,
    Package,
    Star,
    Truck,
} from 'lucide-react';

import {
    formatCurrencyPtBr,
    formatNumberPtBr,
} from '@/utils/export/formatters';

import type {
    ProductPurchaseCostHistoryRow,
    ProductSupplierSummaryRow,
} from '../types/productSupplierLifecycle.types';

type ProductSupplierCostPanelProps = {
    suppliers: ProductSupplierSummaryRow[];
    costHistory: ProductPurchaseCostHistoryRow[];
    loading?: boolean;
    error?: string | null;
};

export function ProductSupplierCostPanel({
    suppliers,
    costHistory,
    loading,
    error,
}: ProductSupplierCostPanelProps) {
    if (loading) {
        return (
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="h-5 w-64 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {[1, 2, 3].map((item) => (
                        <div
                            key={item}
                            className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700"
                        />
                    ))}
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle size={16} />
                    Não foi possível carregar fornecedores e custos do produto.
                </div>
                <p className="mt-1 text-sm">{error}</p>
            </section>
        );
    }

    if (!suppliers.length && !costHistory.length) {
        return (
            <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                Nenhum histórico de fornecedor ou custo encontrado para este produto.
            </section>
        );
    }

    const mainSupplier = suppliers[0] ?? null;
    const lastCost = costHistory[0] ?? null;

    return (
        <section className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-2">
                    <Truck size={18} className="text-[#21A896]" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Fornecedores e custo de compra
                    </h2>
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Histórico de compra do produto, fornecedores associados e variação de custo.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
                        <p className="text-xs text-gray-500">Último fornecedor</p>
                        {mainSupplier ? (
                            <Link
                                to={`/admin/suppliers/${mainSupplier.supplier_id}/lifecycle`}
                                className="mt-1 block font-semibold text-[#21A896] hover:underline"
                            >
                                {mainSupplier.supplier_trade_name || mainSupplier.supplier_name}
                            </Link>
                        ) : (
                            <p className="mt-1 font-semibold">—</p>
                        )}
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
                        <p className="text-xs text-gray-500">Último custo</p>
                        <p className="mt-1 text-lg font-bold">
                            {formatCurrencyPtBr(lastCost?.unit_cost ?? mainSupplier?.last_unit_cost ?? 0)}
                        </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
                        <p className="text-xs text-gray-500">Custo médio</p>
                        <p className="mt-1 text-lg font-bold">
                            {formatCurrencyPtBr(mainSupplier?.average_unit_cost ?? 0)}
                        </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
                        <p className="text-xs text-gray-500">Fornecedores</p>
                        <p className="mt-1 text-lg font-bold">
                            {formatNumberPtBr(suppliers.length)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-3 flex items-center gap-2">
                    <Package size={17} className="text-[#21A896]" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        Fornecedores do produto
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="py-2 pr-3">Fornecedor</th>
                                <th className="py-2 pr-3">Status</th>
                                <th className="py-2 pr-3">Compras</th>
                                <th className="py-2 pr-3">Quantidade</th>
                                <th className="py-2 pr-3">Custo médio</th>
                                <th className="py-2 pr-3">Menor/Maior</th>
                                <th className="py-2 pr-3">Último custo</th>
                                <th className="py-2 pr-3">Última compra</th>
                            </tr>
                        </thead>

                        <tbody>
                            {suppliers.map((supplier) => (
                                <tr
                                    key={supplier.supplier_id}
                                    className="border-t border-gray-100 dark:border-gray-700"
                                >
                                    <td className="py-2 pr-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                                to={`/admin/suppliers/${supplier.supplier_id}/lifecycle`}
                                                className="font-semibold text-[#21A896] hover:underline"
                                            >
                                                {supplier.supplier_trade_name || supplier.supplier_name}
                                            </Link>

                                            {supplier.preferred_supplier && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                                                    <Star size={11} />
                                                    Preferencial
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="py-2 pr-3">
                                        {supplier.blocked ? (
                                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                                Bloqueado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                                <BadgeCheck size={12} />
                                                Ativo
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-2 pr-3">{formatNumberPtBr(supplier.purchase_count ?? 0)}</td>
                                    <td className="py-2 pr-3">{formatNumberPtBr(supplier.total_quantity ?? 0)}</td>
                                    <td className="py-2 pr-3">{formatCurrencyPtBr(supplier.average_unit_cost ?? 0)}</td>
                                    <td className="py-2 pr-3">
                                        {formatCurrencyPtBr(supplier.min_unit_cost ?? 0)}
                                        {' / '}
                                        {formatCurrencyPtBr(supplier.max_unit_cost ?? 0)}
                                    </td>
                                    <td className="py-2 pr-3">{formatCurrencyPtBr(supplier.last_unit_cost ?? 0)}</td>
                                    <td className="py-2 pr-3">
                                        {supplier.last_purchase_date
                                            ? new Date(supplier.last_purchase_date).toLocaleDateString('pt-BR')
                                            : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-3 flex items-center gap-2">
                    <History size={17} className="text-[#21A896]" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        Histórico de custo
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="py-2 pr-3">Data</th>
                                <th className="py-2 pr-3">Fornecedor</th>
                                <th className="py-2 pr-3">Documento</th>
                                <th className="py-2 pr-3">Custo unitário</th>
                                <th className="py-2 pr-3">Variação</th>
                                <th className="py-2 pr-3">Quantidade</th>
                                <th className="py-2 pr-3">Total</th>
                            </tr>
                        </thead>

                        <tbody>
                            {costHistory.map((row) => {
                                const delta = row.unit_cost_delta ?? 0;
                                const isUp = delta > 0;
                                const isDown = delta < 0;

                                return (
                                    <tr
                                        key={row.id}
                                        className="border-t border-gray-100 dark:border-gray-700"
                                    >
                                        <td className="py-2 pr-3">
                                            {row.issue_date
                                                ? new Date(row.issue_date).toLocaleDateString('pt-BR')
                                                : new Date(row.effective_at).toLocaleDateString('pt-BR')}
                                        </td>

                                        <td className="py-2 pr-3">
                                            <Link
                                                to={`/admin/suppliers/${row.supplier_id}/lifecycle`}
                                                className="font-medium text-[#21A896] hover:underline"
                                            >
                                                {row.supplier_trade_name || row.supplier_name}
                                            </Link>
                                        </td>

                                        <td className="py-2 pr-3">{row.invoice_number || '—'}</td>

                                        <td className="py-2 pr-3 font-semibold">
                                            {formatCurrencyPtBr(row.unit_cost ?? 0)}
                                        </td>

                                        <td className="py-2 pr-3">
                                            {row.unit_cost_delta == null ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${isUp
                                                            ? 'bg-red-100 text-red-700'
                                                            : isDown
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                        }`}
                                                >
                                                    {isUp && <ArrowUp size={12} />}
                                                    {isDown && <ArrowDown size={12} />}
                                                    {formatCurrencyPtBr(delta)}
                                                    {row.unit_cost_delta_percent != null
                                                        ? ` (${formatNumberPtBr(row.unit_cost_delta_percent)}%)`
                                                        : ''}
                                                </span>
                                            )}
                                        </td>

                                        <td className="py-2 pr-3">{formatNumberPtBr(row.quantity ?? 0)}</td>
                                        <td className="py-2 pr-3">{formatCurrencyPtBr(row.total_cost ?? 0)}</td>
                                    </tr>
                                );
                            })}

                            {costHistory.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-gray-500">
                                        Nenhum histórico de custo encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}