/**
 * Utilitário central para humanização de códigos de documentos, pedidos,
 * transferências, compras, cotações, caixa e status técnicos no OptmaMenu.
 */

export type DocumentReferenceOptions = {
  fallbackLabel?: string;
  suffixLength?: number;
  includePrefixLabel?: boolean;
};

const PREFIX_LABEL_MAP: Record<string, string> = {
  PED: 'PED',
  TRF: 'TRF',
  CXA: 'CXA',
  ENT: 'ENTR',
  ENTR: 'ENTR',
  COT: 'COT',
  PUR: 'COMP',
  CMP: 'COMP',
  DOC: 'COMP',
  DEV: 'DEV',
  AJU: 'AJU',
  EST: 'EST',
  RES: 'RES',
  REC: 'REC',
  NF: 'NFE',
  NFE: 'NFE',
};

const TECHNICAL_STATUS_MAP: Record<string, string> = {
  completed: 'Concluído',
  pending: 'Pendente',
  inventory_count_corrected: 'Contagem de estoque corrigida',
  waiting_stock_count: 'Aguardando contagem',
  under_review: 'Em análise',
  resolved: 'Resolvida',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  confirmed: 'Confirmado',
  in_transit: 'Em trânsito',
  accepted: 'Aceito',
  draft: 'Rascunho',
  active: 'Ativo',
  voided: 'Anulado',
  open: 'Aberto',
  closed: 'Fechado',
  shipped: 'Enviado',
  received: 'Recebido',
  divergent: 'Divergente',
};

/**
 * Retorna o rótulo descritivo do tipo de documento baseado no prefixo (ex: PED -> PED, TRF -> TRF).
 */
export function getDocumentTypeLabel(value?: string | null): string {
  if (!value) return 'Documento';

  const clean = value.trim().toUpperCase();
  const firstPart = clean.split('-')[0];

  if (firstPart && PREFIX_LABEL_MAP[firstPart]) {
    return PREFIX_LABEL_MAP[firstPart];
  }

  return 'Documento';
}

/**
 * Converte um código longo/completo em uma referência curta humanizada.
 * 
 * Exemplos:
 * - PED-20260725-004413-5930 -> PED#5930
 * - TRF-20260724-013302-550 -> TRF#550
 * - CXA-20260725-004413-19DC -> CXA#19DC
 * - ENT-20260724-123456-AB12 -> ENTR#AB12
 * - COT-20260724-123456-CD34 -> COT#CD34
 * - UUID 5e84f407-64bf-4a75-8b24-06daab7a40c5 -> #7A40C5
 */
export function getShortDocumentReference(
  value?: string | null,
  options?: DocumentReferenceOptions
): string {
  if (!value || typeof value !== 'string') {
    return options?.fallbackLabel || '—';
  }

  const raw = value.trim();
  if (!raw) return options?.fallbackLabel || '—';

  const includePrefixLabel = options?.includePrefixLabel ?? true;

  // Verifica se possui padrão com hífens (ex: PED-20260725-004413-5930 ou TRF-20260724-013302-550)
  if (raw.includes('-')) {
    const parts = raw.split('-');
    const prefix = parts[0].toUpperCase();
    const typeLabel = PREFIX_LABEL_MAP[prefix];

    if (typeLabel) {
      const suffix = parts[parts.length - 1];
      const cleanSuffix = suffix.toUpperCase();

      if (includePrefixLabel) {
        return `${typeLabel}#${cleanSuffix}`;
      }
      return `#${cleanSuffix}`;
    }
  }

  // Se tiver um tamanho de sufixo explícito ou fallback para códigos/UUIDs sem hífen com prefixo conhecido
  const targetLength = options?.suffixLength || 6;
  const cleanRaw = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (cleanRaw.length <= targetLength) {
    return `#${cleanRaw}`;
  }

  const suffix = cleanRaw.slice(-targetLength);
  const fallbackType = options?.fallbackLabel ? `${options.fallbackLabel} ` : '';

  return `${fallbackType}#${suffix}`;
}

/**
 * Retorna o título acessível / tooltip completo com o código original.
 */
export function getDocumentReferenceTitle(value?: string | null): string {
  if (!value) return '';
  return value.trim();
}

/**
 * Traduz valores técnicos de status para exibição humanizada ao usuário.
 */
export function humanizeTechnicalStatus(value?: string | null): string {
  if (!value) return '—';
  const lower = value.trim().toLowerCase();
  return TECHNICAL_STATUS_MAP[lower] || value;
}

/**
 * Procura e substitui no meio de qualquer texto livre códigos longos por suas versões curtas.
 * Exemplo: "Venda concluída pelo pedido PED-20260725-004413-5930" -> "Venda concluída pelo pedido PED#5930"
 */
export function humanizeTextReferences(text?: string | null): string {
  if (!text || typeof text !== 'string') return text ?? '';

  const codeRegex = /\b(PED|TRF|CXA|ENT|ENTR|COT|PUR|CMP|DOC|DEV|AJU|EST|RES|REC|NF|NFE)-[A-Za-z0-9\-]+\b/gi;

  return text.replace(codeRegex, (match) => {
    return getShortDocumentReference(match);
  });
}
