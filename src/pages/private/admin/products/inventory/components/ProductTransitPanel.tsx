import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, Truck } from 'lucide-react';
import { formatNumberPtBr } from '@/utils/export/formatters';
import type { ProductTransitSummaryRow } from '../hooks/useProductTransitSummary';

type ProductTransitPanelProps = {
    rows: ProductTransitSummaryRow[];
    loading?: boolean;
    error?: string | null;
};

export function ProductTransitPanel({
    rows,
    loading,
    error,
}: ProductTransitPanelProps) {
    const totalIn = rows.reduce((sum, row) => sum + Number(row.in_transit_in ?? 0), 0);
    const totalOut = rows.reduce((sum, row) => sum + Number(row.in_transit_out ?? 0), 0);

    if (loading) {
        return (
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="h-5 w-56 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="mt-4 h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />
            </section>
        );
    }

    if (error) {
        return (
            <section className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                {error}
            </section>
        );
    }

    if (!rows.length) {
        return null;
    }

    return (
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Truck size={18} className="text-blue-700 dark:text-blue-300" />
                        <h2 className="text-base font-semibold text-blue-900 dark:text-blue-100">
                            Estoque em trânsito
                        </h2>
                    </div>

                    <p className="mt-1 text-sm text-blue-700/80 dark:text-blue-200/80">
                        Mercadorias já enviadas e ainda não recebidas ou resolvidas.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        <ArrowDownToLine size={14} />
                        Entrando: {formatNumberPtBr(totalIn)}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-amber-700 dark:bg-blue-900/40 dark:text-amber-200">
                        <ArrowUpFromLine size={14} />
                        Saindo: {formatNumberPtBr(totalOut)}
                    </span>
                </div>
            </div>

            <div className="mt-4 overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">
                            <th className="py-2 pr-3">Local</th>
                            <th className="py-2 pr-3">Entrando</th>
                            <th className="py-2 pr-3">Saindo</th>
                            <th className="py-2 pr-3">Transferências</th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row) => {
                            const transfers = [
                                ...(row.incoming_transfers ?? []),
                                ...(row.outgoing_transfers ?? []),
                            ];

                            return (
                                <tr
                                    key={`${row.location_id}-${row.product_id}`}
                                    className="border-t border-blue-100 dark:border-blue-900/40"
                                >
                                    <td className="py-2 pr-3 font-medium">
                                        {row.location_name}
                                        <div className="text-xs text-blue-700/70">
                                            {row.location_code || '—'}
                                        </div>
                                    </td>

                                    <td className="py-2 pr-3">
                                        {Number(row.in_transit_in ?? 0) > 0
                                            ? `+${formatNumberPtBr(row.in_transit_in)}`
                                            : '—'}
                                    </td>

                                    <td className="py-2 pr-3">
                                        {Number(row.in_transit_out ?? 0) > 0
                                            ? `-${formatNumberPtBr(row.in_transit_out)}`
                                            : '—'}
                                    </td>

                                    <td className="py-2 pr-3">
                                        <div className="flex flex-wrap gap-2">
                                            {transfers.slice(0, 3).map((transfer: any) => (
                                                <Link
                                                    key={`${row.location_id}-${transfer.transfer_id}`}
                                                    to={`/admin/transfers/${transfer.transfer_id}`}
                                                    className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:underline dark:bg-blue-900/40 dark:text-blue-200"
                                                >
                                                    {transfer.transfer_code} · {formatNumberPtBr(transfer.qty)}
                                                </Link>
                                            ))}

                                            {transfers.length === 0 && (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}