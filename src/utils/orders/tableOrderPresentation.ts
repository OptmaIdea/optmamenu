/**
 * A rota pública de QR tem fluxo próprio de atendimento.
 * Estes rótulos não alteram nem inferem o estado de pagamento ou de estoque.
 */
export function isTableOrder(
  fulfillmentType?: string | null,
  salesChannel?: string | null,
): boolean {
  return fulfillmentType === 'qr_table'
    || fulfillmentType === 'dine_in'
    || fulfillmentType === 'table'
    || salesChannel === 'qr_table';
}

export function getTableOrderLabel(tableCode?: string | null): string {
  const code = tableCode?.trim();
  return code ? `Mesa ${code}` : 'Mesa não identificada';
}
