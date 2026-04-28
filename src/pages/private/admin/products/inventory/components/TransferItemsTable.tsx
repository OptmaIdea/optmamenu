import type { StockTransferDetail } from '@/services/stockService';
import EmptyTableState from '@/components/common/empty-state/EmptyTableState';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';

type Props = {
  items: StockTransferDetail['items'];
};

const divergenceResolutionLabel: Record<string, string> = {
  loss: 'Perda/Avaria',
  return_to_origin: 'Retornou à origem',
  accepted_shortage: 'Falta aceita',
};

export default function TransferItemsTable({ items }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h2 className="font-semibold text-gray-900 dark:text-white">Itens</h2>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="text-left px-4 py-3">Produto</th>
              <th className="text-right px-4 py-3">
                <div className="inline-flex items-center gap-1 justify-end w-full">
                  Solicitado
                  <InfoTooltip text="Quantidade originalmente pedida para transferência." />
                </div>
              </th>
              <th className="text-right px-4 py-3">
                <div className="inline-flex items-center gap-1 justify-end w-full">
                  Enviado
                  <InfoTooltip text="Quantidade efetivamente despachada na origem." />
                </div>
              </th>
              <th className="text-right px-4 py-3">
                <div className="inline-flex items-center gap-1 justify-end w-full">
                  Recebido
                  <InfoTooltip text="Quantidade efetivamente recebida no destino." />
                </div>
              </th>
              <th className="text-right px-4 py-3">
                <div className="inline-flex items-center gap-1 justify-end w-full">
                  Divergência
                  <InfoTooltip text="Diferença identificada entre o que foi enviado e o que foi recebido." />
                </div>
              </th>
              <th className="text-left px-4 py-3">Resolução</th>
              <th className="text-left px-4 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-4 py-3">{item.product_name}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right">{item.requested_qty}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right">{item.shipped_qty}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right">{item.received_qty}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  {item.divergence_qty > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {item.divergence_qty}
                    </span>
                  ) : (
                    item.divergence_qty
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {(item.metadata as any)?.divergence_resolution
                    ? (divergenceResolutionLabel[(item.metadata as any).divergence_resolution] ?? (item.metadata as any).divergence_resolution)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {(item.metadata as any)?.divergence_reason ?? '—'}
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <EmptyTableState
                colSpan={7}
                title="Ainda não há registros para esta operação"
                description="Adicione itens a esta transferência para acompanhar a movimentação entre locais."
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
