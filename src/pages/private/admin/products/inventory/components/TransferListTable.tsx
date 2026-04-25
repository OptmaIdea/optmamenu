import { useNavigate } from 'react-router-dom';
import type { StockTransferSummaryRow } from '@/services/stockService';
import TransferStatusBadge from './TransferStatusBadge';
import EmptyTableState from '@/components/common/empty-state/EmptyTableState';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';

type Props = {
  rows: StockTransferSummaryRow[];
  onClearFilters?: () => void;
};

export default function TransferListTable({ rows, onClearFilters }: Props) {
  const navigate = useNavigate();



  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl">
      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
        <table className="min-w-[1050px] w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="text-left px-4 py-3">Código</th>
              <th className="text-left px-4 py-3">Origem</th>
              <th className="text-left px-4 py-3">Destino</th>
              <th className="text-left px-4 py-3">
                <div className="inline-flex items-center gap-1">
                  Status
                  <InfoTooltip text="Mostra a etapa atual da transferência, como rascunho, enviada, recebida ou divergente." />
                </div>
              </th>
              <th className="text-left px-4 py-3">Solicitado</th>
              <th className="text-left px-4 py-3">Enviado</th>
              <th className="text-left px-4 py-3">Recebido</th>
              <th className="text-left px-4 py-3">
                <div className="inline-flex items-center gap-1">
                  Divergência
                  <InfoTooltip text="Transferência divergente indica diferença entre o que foi enviado e o que foi recebido." />
                </div>
              </th>
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Abrir</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => navigate(`/admin/transfers/${row.id}`)}
                className="border-t border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                <td className="px-4 py-3 font-medium">{row.transfer_code ?? '—'}</td>
                <td className="px-4 py-3">{row.source_location_name}</td>
                <td className="px-4 py-3">{row.destination_location_name}</td>
                <td className="px-4 py-3">
                  <TransferStatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3">{row.total_requested_qty}</td>
                <td className="px-4 py-3">{row.total_shipped_qty}</td>
                <td className="px-4 py-3">{row.total_received_qty}</td>
                <td className={`px-4 py-3 font-semibold ${row.total_divergence_qty > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                  {row.total_divergence_qty > 0 ? `⚠ ${row.total_divergence_qty}` : row.total_divergence_qty}
                </td>
                <td className="px-4 py-3">
                  {new Date(row.created_at).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/transfers/${row.id}`);
                    }}
                    className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs sm:text-sm font-medium bg-[#21A896]/10 text-[#21A896] hover:bg-[#21A896]/20 transition"
                  >
                    Detalhe
                  </button>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <EmptyTableState
                colSpan={10}
                title="Nenhuma transferência encontrada"
                description="Os filtros atuais não retornaram resultados. Limpe os filtros ou ajuste o período, status e locais."
                action={
                  onClearFilters && (
                    <button
                      type="button"
                      onClick={onClearFilters}
                      className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                    >
                      Limpar filtros
                    </button>
                  )
                }
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
