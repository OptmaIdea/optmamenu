import { useParams } from 'react-router-dom';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import TransferDetailHeader from './components/TransferDetailHeader';
import TransferItemsTable from './components/TransferItemsTable';
import { useStockTransferDetail } from './hooks/useStockTransferDetail';
import { downloadCsv } from '@/utils/export/csv';
import { formatDateTimePtBr, formatNumberPtBr, formatCurrencyPtBr } from '@/utils/export/formatters';

const getTransferStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'approved':
      return 'Aprovada';
    case 'shipped':
      return 'Enviada';
    case 'received':
      return 'Recebida';
    case 'cancelled':
      return 'Cancelada';
    case 'divergent':
      return 'Divergente';
    default:
      return status ?? '';
  }
};

export default function TransferDetailPage() {
  const { id } = useParams();
  const { data, loading } = useStockTransferDetail(id);

  if (loading) return <LoadingSpinner />;

  if (!data.header) {
    return (
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Transferência não encontrada</h1>
      </div>
    );
  }

  const handleExportCsv = () => {
    const { header: transfer, items } = data;
    if (!transfer || !items) return;

    downloadCsv({
      filename: `transferencia_${transfer.transfer_code || transfer.id}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Código',
        'Origem',
        'Destino',
        'Status',
        'Solicitada em',
        'Produto',
        'Solicitado',
        'Enviado',
        'Recebido',
        'Divergência',
        'Custo unitário',
        'Observações do item',
      ],
      rows: items.map((item) => [
        transfer.transfer_code ?? '',
        transfer.source_location_name ?? '',
        transfer.destination_location_name ?? '',
        getTransferStatusLabel(transfer.status),
        formatDateTimePtBr(transfer.requested_at),
        item.product_name ?? '',
        formatNumberPtBr(item.requested_qty),
        formatNumberPtBr(item.shipped_qty),
        formatNumberPtBr(item.received_qty),
        formatNumberPtBr(item.divergence_qty),
        formatCurrencyPtBr(item.unit_cost ?? 0),
        item.notes ?? '',
      ]),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Exportar itens
        </button>
      </div>
      <TransferDetailHeader header={data.header} />
      <TransferItemsTable items={data.items} />
    </div>
  );
}
