type AnyRecord = Record<string, unknown>;

export type ProductMovementNarrativeInput = {
  id?: string;
  type?: string | null;
  source?: string | null;
  source_id?: string | null;
  transfer_id?: string | null;
  transfer_code?: string | null;
  quantity?: number | string | null;
  previous_stock?: number | string | null;
  new_stock?: number | string | null;
  reason?: string | null;
  reason_code?: string | null;
  created_at?: string | null;

  location_name?: string | null;
  location_code?: string | null;

  from_location_name?: string | null;
  from_location_code?: string | null;

  to_location_name?: string | null;
  to_location_code?: string | null;

  supplier_name?: string | null;
  purchase_document_number?: string | null;

  divergence_qty?: number | string | null;
  divergence_resolution?: string | null;
  divergence_reason?: string | null;

  metadata?: AnyRecord | null;
};

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function getMetadataText(
  metadata: AnyRecord | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];

  if (typeof value !== 'string') return null;

  const text = value.trim();

  return text.length > 0 ? text : null;
}

export function isPurchaseDocumentCancelMovement(movement: ProductMovementNarrativeInput) {
  const source = String(movement.source ?? '').toLowerCase();
  const reasonCode = String(movement.reason_code ?? '').toLowerCase();
  const metadataOrigin = String(movement.metadata?.origin ?? '').toLowerCase();

  return (
    source === 'purchase_document_cancel' ||
    reasonCode === 'purchase_document_cancelled' ||
    metadataOrigin === 'purchase_document_cancel'
  );
}

export function shortReference(value?: string | null, fallback = '—') {
  const text = String(value ?? '').trim();

  if (!text) return fallback;
  if (text.startsWith('TRF-') || text.startsWith('ENT-') || text.startsWith('COT-')) {
    return text;
  }
  if (text.length > 8) return text.slice(0, 8);

  return text;
}

export function getMovementOriginLabel(movement: ProductMovementNarrativeInput) {
  const source = String(movement.source ?? '').toLowerCase();

  if (isPurchaseDocumentCancelMovement(movement)) {
    return asText(
      movement.from_location_name ??
      movement.location_name ??
      getMetadataText(movement.metadata, 'from_location_name') ??
      getMetadataText(movement.metadata, 'location_name'),
      'Local não identificado',
    );
  }

  if (source === 'purchase_document') {
    return asText(movement.supplier_name, 'Fornecedor não informado');
  }

  if (source === 'stock_transfer') {
    return asText(movement.from_location_name, 'Origem não identificada');
  }

  return asText(movement.from_location_name ?? movement.location_name, '—');
}

export function getMovementDestinationLabel(movement: ProductMovementNarrativeInput) {
  const source = String(movement.source ?? '').toLowerCase();

  if (isPurchaseDocumentCancelMovement(movement)) {
    return asText(
      getMetadataText(movement.metadata, 'destination_label'),
      'Cancelamento da compra',
    );
  }

  if (source === 'purchase_document') {
    return asText(movement.location_name ?? movement.to_location_name, 'Local de entrada não identificado');
  }

  if (source === 'stock_transfer') {
    return asText(movement.to_location_name, 'Destino não identificado');
  }

  return asText(movement.to_location_name ?? movement.location_name, '—');
}

export function getMovementOperationLabel(movement: ProductMovementNarrativeInput) {
  const type = String(movement.type ?? '').toLowerCase();
  const source = String(movement.source ?? '').toLowerCase();

  if (isPurchaseDocumentCancelMovement(movement)) {
    return 'Compra cancelada';
  }

  if (source === 'physical_count_adjustment') {
    return 'Ajuste por contagem física';
  }

  if (source === 'manual_adjustment' && type === 'clearance') {
    return 'Baixa manual de estoque';
  }

  if (source === 'manual_adjustment' && type === 'entry') {
    return 'Entrada manual de estoque';
  }

  if (source === 'manual_adjustment' && type === 'exit') {
    return 'Saída manual de estoque';
  }

  if (source === 'stock_transfer' && type === 'exit') {
    return 'Transferência enviada';
  }

  if (source === 'stock_transfer' && type === 'entry') {
    return 'Transferência recebida';
  }

  if (source === 'purchase_document' && type === 'entry') {
    return 'Compra confirmada';
  }

  if (type === 'clearance') {
    return 'Baixa / Perda';
  }

  if (type === 'entry') {
    return 'Entrada de estoque';
  }

  if (type === 'exit') {
    return 'Saída de estoque';
  }

  if (type === 'reservation') {
    return 'Reserva de estoque';
  }

  if (type === 'confirmation') {
    return 'Confirmação de reserva';
  }

  if (type === 'cancellation') {
    return 'Cancelamento / Estorno';
  }

  return 'Movimentação de estoque';
}

export function getMovementDirectionLabel(movement: ProductMovementNarrativeInput) {
  const type = String(movement.type ?? '').toLowerCase();

  if (isPurchaseDocumentCancelMovement(movement)) return 'Cancelamento';

  if (type === 'entry') return 'Entrada';
  if (type === 'exit') return 'Saída';
  if (type === 'clearance') return 'Baixa';
  if (type === 'reservation') return 'Reserva';
  if (type === 'confirmation') return 'Confirmação';
  if (type === 'cancellation') return 'Cancelamento';

  return 'Movimento';
}

export function getMovementReferenceLabel(movement: ProductMovementNarrativeInput) {
  const source = String(movement.source ?? '').toLowerCase();

  if (isPurchaseDocumentCancelMovement(movement)) {
    return (
      getMetadataText(movement.metadata, 'document_code') ??
      getMetadataText(movement.metadata, 'reference') ??
      movement.purchase_document_number ??
      shortReference(movement.source_id, 'Compra')
    );
  }

  if (source === 'physical_count_adjustment') {
    return 'Contagem física';
  }

  if (source === 'manual_adjustment') {
    return 'Ajuste manual';
  }

  if (source === 'stock_transfer') {
    if (movement.transfer_code) return movement.transfer_code;
    return shortReference(
      movement.transfer_id ?? movement.source_id,
      'Transferência',
    );
  }

  if (source === 'purchase_document') {
    const metadata = movement.metadata ?? {};
    const documentCode =
      typeof metadata.document_code === 'string' ? metadata.document_code : null;
    const invoiceNumber =
      typeof metadata.invoice_number === 'string' ? metadata.invoice_number : null;

    if (documentCode) return documentCode;
    if (movement.purchase_document_number) return movement.purchase_document_number;
    if (invoiceNumber) return invoiceNumber;

    return shortReference(
      movement.source_id,
      'Documento de compra',
    );
  }

  return shortReference(movement.source_id, 'Sem referência');
}

export function getMovementHumanDescription(movement: ProductMovementNarrativeInput) {
  const type = String(movement.type ?? '').toLowerCase();
  const source = String(movement.source ?? '').toLowerCase();
  const qty = Math.abs(asNumber(movement.quantity));

  const location = asText(movement.location_name, 'Local não identificado');
  const fromLocation = asText(movement.from_location_name, 'origem não identificada');
  const toLocation = asText(movement.to_location_name, 'destino não identificado');

  if (isPurchaseDocumentCancelMovement(movement)) {
    const origin = asText(
      movement.from_location_name ??
      movement.location_name ??
      getMetadataText(movement.metadata, 'from_location_name') ??
      getMetadataText(movement.metadata, 'location_name'),
      'Local não identificado',
    );
    const reference = getMovementReferenceLabel(movement);

    return `${origin} teve saída de ${qty} un. por cancelamento da compra ${reference}.`;
  }

  if (source === 'physical_count_adjustment') {
    const signedQty = asNumber(movement.quantity);
    const formattedQty = signedQty > 0 ? `+${signedQty}` : String(signedQty);
    const previous = asNumber(movement.previous_stock);
    const next = asNumber(movement.new_stock);

    return `${location} ajustado por contagem física: de ${previous} para ${next}. Diferença: ${formattedQty} un.`;
  }

  if (source === 'manual_adjustment' && type === 'clearance') {
    return `${location} teve baixa manual de ${qty} un. no estoque.`;
  }

  if (source === 'manual_adjustment' && type === 'entry') {
    return `${location} recebeu entrada manual de ${qty} un. no estoque.`;
  }

  if (source === 'manual_adjustment' && type === 'exit') {
    return `${location} teve saída manual de ${qty} un. no estoque.`;
  }

  if (source === 'stock_transfer' && type === 'exit') {
    return `${location} enviou ${qty} un. para ${toLocation}.`;
  }

  if (source === 'stock_transfer' && type === 'entry') {
    return `${location} recebeu ${qty} un. vindas de ${fromLocation}.`;
  }

  if (source === 'purchase_document' && type === 'entry') {
    const supplier = asText(movement.supplier_name, 'fornecedor não informado');
    const destination = asText(
      movement.location_name ?? movement.to_location_name,
      'local de entrada não identificado',
    );

    return `${destination} recebeu ${qty} un. por compra confirmada de ${supplier}.`;
  }

  if (type === 'clearance') {
    return `${location} teve baixa de ${qty} un. no estoque.`;
  }

  if (type === 'entry') {
    return `${location} recebeu ${qty} un. no estoque.`;
  }

  if (type === 'exit') {
    return `${location} teve saída de ${qty} un. do estoque.`;
  }

  return `${location} teve movimentação de ${qty} un.`;
}

export function getMovementStockPath(movement: ProductMovementNarrativeInput) {
  const previous = asNumber(movement.previous_stock);
  const next = asNumber(movement.new_stock);

  return `${previous} → ${next}`;
}

export function getMovementTone(movement: ProductMovementNarrativeInput) {
  const type = String(movement.type ?? '').toLowerCase();
  const source = String(movement.source ?? '').toLowerCase();

  if (isPurchaseDocumentCancelMovement(movement)) return 'purchase_cancel';
  if (source === 'physical_count_adjustment') return 'neutral';
  if (source === 'manual_adjustment' && type === 'clearance') return 'danger';
  if (source === 'manual_adjustment') return 'neutral';
  if (type === 'clearance') return 'danger';
  if (source === 'stock_transfer') return 'transfer';
  if (source === 'purchase_document') return 'purchase';
  if (type === 'entry') return 'entry';
  if (type === 'exit') return 'exit';

  return 'neutral';
}

export function getMovementToneClass(movement: ProductMovementNarrativeInput) {
  const tone = getMovementTone(movement);

  switch (tone) {
    case 'purchase_cancel':
      return 'border-purple-300 bg-purple-50 text-purple-950 dark:border-purple-700 dark:bg-purple-950/30 dark:text-purple-100';
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'transfer':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'purchase':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'entry':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'exit':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

export function getTransferDivergenceResolutionLabel(value?: string | null) {
  switch (String(value ?? '').toLowerCase()) {
    case 'loss':
      return 'Perda/Avaria';
    case 'return_to_origin':
      return 'Retorno para origem';
    case 'accepted_shortage':
      return 'Falta aceita no destino';
    default:
      return 'Divergência não classificada';
  }
}

export function getTransferDivergenceReasonLabel(value?: string | null) {
  switch (String(value ?? '').toLowerCase()) {
    case 'damage':
      return 'Avaria';
    case 'melting':
      return 'Derretimento';
    case 'separation_error':
      return 'Erro de separação';
    case 'transport_issue':
      return 'Problema no transporte';
    case 'freezer_capacity':
      return 'Sem espaço no freezer';
    case 'other':
      return 'Outro';
    default:
      return value ? String(value) : 'Não informado';
  }
}
