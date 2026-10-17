import EmptyTableState from '@/components/common/empty-state/EmptyTableState';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';

type TransferItemsTableRow = {
  id: string;
  product_name: string;
  requested_qty: number;
  shipped_qty: number;
  received_qty: number;
  divergence_qty: number;
  metadata?: Record<string, unknown> | null;
};

type Props = {
  items: TransferItemsTableRow[];
};

const divergenceResolutionLabel: Record<string, string> = {
  loss: 'Perda/Avaria',
  return_to_origin: 'Retornou à origem',
  accepted_shortage: 'Falta aceita',
};

function getMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : null;
}

export default function TransferItemsTable({ items }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h2 className="font-semibold text-gray-900 dark:text-white">Itens</h2>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-4 py-3 text-left">Produto</th>
              <th className="px-4 py-3 text-right">
                <div className="inline-flex w-full items-center justify-end gap-1">Solicitado<InfoTooltip text="Quantidade originalmente pedida para transferência." /></div>
              </th>
              <th className="px-4 py-3 text-right">
                <div className="inline-flex w-full items-center justify-end gap-1">Enviado<InfoTooltip text="Quantidade efetivamente despachada na origem." /></div>
              </th>
              <th className="px-4 py-3 text-right">
                <div className="inline-flex w-full items-center justify-end gap-1">Recebido<InfoTooltip text="Quantidade efetivamente recebida no destino." /></div>
              </th>
              <th className="px-4 py-3 text-right">
                <div className="inline-flex w-full items-center justify-end gap-1">Divergência<InfoTooltip text="Diferença identificada entre o que foi enviado e o que foi recebido." /></div>
              </th>
              <th className="px-4 py-3 text-left">Resolução</th>
              <th className="px-4 py-3 text-left">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const resolution = getMetadataValue(item.metadata, 'divergence_resolution');
              const reason = getMetadataValue(item.metadata, 'divergence_reason');
              return (
                <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3">{item.product_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{item.requested_qty}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{item.shipped_qty}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{item.received_qty}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {item.divergence_qty > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{item.divergence_qty}</span> : item.divergence_qty}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{resolution ? (divergenceResolutionLabel[resolution] ?? resolution) : '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{reason ?? '—'}</td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <EmptyTableState colSpan={7} title="Ainda não há registros para esta operação" description="Adicione itens a esta transferência para acompanhar a movimentação entre locais." />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
