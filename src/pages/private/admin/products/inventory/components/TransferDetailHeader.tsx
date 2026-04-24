import type { StockTransferSummaryRow } from '@/services/stockService';
import TransferStatusBadge from './TransferStatusBadge';

type Props = {
  header: StockTransferSummaryRow;
};

export default function TransferDetailHeader({ header }: Props) {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {header.transfer_code ?? 'Transferência'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {header.source_location_name} → {header.destination_location_name}
          </p>
        </div>
        <TransferStatusBadge status={header.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-500">Solicitado</div>
          <div className="font-semibold">{header.total_requested_qty}</div>
        </div>
        <div>
          <div className="text-gray-500">Enviado</div>
          <div className="font-semibold">{header.total_shipped_qty}</div>
        </div>
        <div>
          <div className="text-gray-500">Recebido</div>
          <div className="font-semibold">{header.total_received_qty}</div>
        </div>
        <div>
          <div className="text-gray-500">Divergência</div>
          <div className="font-semibold">{header.total_divergence_qty}</div>
        </div>
      </div>

      {header.notes && (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">Observação:</span> {header.notes}
        </div>
      )}
    </div>
  );
}
