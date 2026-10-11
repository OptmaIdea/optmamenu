export type FinancialLabelFallbackMode = 'dash' | 'raw';

function normalizeCode(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

export function humanizeFinancialIdentifier(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const known: Record<string, string> = {
    optmapay: 'OptmaPay',
    asaas: 'Asaas',
    infinitepay: 'InfinitePay',
    pix: 'Pix',
    qr: 'QR',
    api: 'API',
    cvv: 'CVV',
    pos: 'POS',
  };

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => {
      const normalized = part.toLowerCase();
      if (known[normalized]) return known[normalized];
      if (/^\d+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function fallbackLabel(value?: string | null, mode: FinancialLabelFallbackMode = 'dash'): string {
  if (!value) return mode === 'dash' ? '—' : '';
  return mode === 'raw' ? humanizeFinancialIdentifier(value) : '—';
}

const CASHBOOK_ACCOUNT_PLAN_LABELS: Record<string, string> = {
  sale_cash: 'Venda em dinheiro',
  sale_pix: 'Venda via Pix',
  sale_debit: 'Venda no débito',
  sale_credit: 'Venda no crédito',
  pending_payment_received: 'Recebimento pendente',
  closing_replenishment: 'Reposição de divergência',
  change_float_reinforcement: 'Reforço de troco',
  owner_contribution: 'Aporte do proprietário',
  positive_adjustment: 'Ajuste positivo',
  other_income: 'Outras entradas',
  operational_expense: 'Despesa operacional',
  small_purchase: 'Pequena compra',
  other_expense: 'Outras saídas',
  refund: 'Estorno',
  negative_adjustment: 'Ajuste negativo',
  assumed_loss: 'Perda assumida',
  transfer_cash_to_safe: 'Sangria do caixa para a retaguarda',
  transfer_safe_to_cash: 'Retorno da retaguarda para o caixa',
  transfer_cash_to_bank: 'Depósito do caixa no banco',
  transfer_bank_to_cash: 'Saque do banco para o caixa',
  transfer_owner_to_cash: 'Aporte do proprietário para o caixa',
  transfer_cash_to_owner: 'Retirada do caixa pelo proprietário',
  transfer_pix_to_bank: 'Transferência do Pix para o banco',
  transfer_card_to_bank: 'Transferência de cartão para o banco',
  cash_change_exchange: 'Troca de dinheiro para troco',
};

const FINANCIAL_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash_drawer: 'Caixa da loja',
  safe: 'Retaguarda do caixa',
  bank: 'Banco',
  pix_wallet: 'Carteira Pix',
  card_acquirer: 'Maquininha',
  card_receivable: 'Compensação de cartão',
  owner: 'Conta do proprietário',
  other: 'Outra conta',
};

const FINANCIAL_ACCOUNT_CODE_LABELS: Record<string, string> = {
  cash_drawer: 'Caixa físico',
  safe: 'Cofre',
  bank_main: 'Banco principal',
  pix_wallet: 'Carteira Pix',
  card_acquirer: 'Maquininha',
  card_receivable: 'Recebíveis de cartão',
  owner: 'Proprietário',
  optmapay_receivable: 'Compensação OptmaPay',
  optmapay_sandbox: 'OptmaPay',
  asaas_pix: 'Asaas Pix',
  infinitepay: 'InfinitePay',
  clc: 'Caixa Loja Centro',
};

const CASHBOOK_KIND_LABELS: Record<string, string> = {
  income: 'Entrada',
  expense: 'Saída',
  transfer: 'Transferência',
  adjustment: 'Ajuste',
};

const CASHBOOK_DIRECTION_LABELS: Record<string, string> = {
  in: 'Entrada',
  out: 'Saída',
  transfer: 'Transferência',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  card: 'Cartão',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
  pending: 'Pendente',
  other: 'Outro',
  pix_manual_qr: 'Pix por QR Code',
  asaas_pix: 'Asaas Pix',
  payment_link: 'Link de pagamento',
  bank_transfer: 'Transferência bancária',
  voucher: 'Voucher / benefício',
};

const CASHBOOK_ENTRY_TYPE_LABELS: Record<string, string> = {
  sale: 'Venda',
  manual_income: 'Entrada manual',
  manual_expense: 'Saída manual',
  refund: 'Estorno',
  adjustment: 'Ajuste',
  transfer: 'Transferência',
  other: 'Outro',
};

const CASHBOOK_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  completed: 'Concluído',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  active: 'Ativo',
  voided: 'Anulado',
};

export function getCashbookAccountPlanLabel(code?: string | null, mode: FinancialLabelFallbackMode = 'raw'): string {
  const normalized = normalizeCode(code);
  return CASHBOOK_ACCOUNT_PLAN_LABELS[normalized] || fallbackLabel(code, mode);
}

export function getFinancialAccountTypeLabel(type?: string | null, mode: FinancialLabelFallbackMode = 'raw'): string {
  const normalized = normalizeCode(type);
  return FINANCIAL_ACCOUNT_TYPE_LABELS[normalized] || fallbackLabel(type, mode);
}

export function getFinancialAccountCodeLabel(code?: string | null, mode: FinancialLabelFallbackMode = 'raw'): string {
  const normalized = normalizeCode(code);
  return FINANCIAL_ACCOUNT_CODE_LABELS[normalized] || fallbackLabel(code, mode);
}

export function getCashbookKindLabel(kind?: string | null, mode: FinancialLabelFallbackMode = 'raw'): string {
  const normalized = normalizeCode(kind);
  return CASHBOOK_KIND_LABELS[normalized] || fallbackLabel(kind, mode);
}

export function getCashbookDirectionLabel(direction?: string | null, mode: FinancialLabelFallbackMode = 'raw'): string {
  const normalized = normalizeCode(direction);
  return CASHBOOK_DIRECTION_LABELS[normalized] || fallbackLabel(direction, mode);
}

export function getPaymentMethodPtBrLabel(method?: string | null, mode: FinancialLabelFallbackMode = 'raw'): string {
  const normalized = normalizeCode(method);
  return PAYMENT_METHOD_LABELS[normalized] || fallbackLabel(method, mode);
}

export function getCashbookEntryTypeLabel(type?: string | null, mode: FinancialLabelFallbackMode = 'raw'): string {
  const normalized = normalizeCode(type);
  return CASHBOOK_ENTRY_TYPE_LABELS[normalized] || fallbackLabel(type, mode);
}

export function getCashbookStatusLabel(status?: string | null, mode: FinancialLabelFallbackMode = 'raw'): string {
  const normalized = normalizeCode(status);
  return CASHBOOK_STATUS_LABELS[normalized] || fallbackLabel(status, mode);
}

export function getBooleanPtBrLabel(value?: boolean | null): string {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return '—';
}

export function formatFinancialAccountOptionLabel(input: {
  code?: string | null;
  name?: string | null;
  account_type?: string | null;
}): string {
  const name = input.name?.trim();
  const typeLabel = getFinancialAccountTypeLabel(input.account_type, 'dash');
  const codeLabel = getFinancialAccountCodeLabel(input.code, 'dash');

  if (name && typeLabel !== '—') {
    const normalizedName = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const normalizedType = typeLabel
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (normalizedName === normalizedType) return name;
    return `${name} · ${typeLabel}`;
  }
  if (name) return name;
  if (codeLabel !== '—') return codeLabel;
  return 'Conta sem nome';
}

export function formatCashbookCategoryOptionLabel(input: {
  code?: string | null;
  display_code?: string | null;
  name?: string | null;
  kind?: string | null;
}): string {
  const name = input.name?.trim();
  const planLabel = getCashbookAccountPlanLabel(input.code, 'dash');
  const kindLabel = getCashbookKindLabel(input.kind, 'dash');
  const displayCode = input.display_code?.trim();
  const baseName = name || (planLabel !== '—' ? planLabel : 'Categoria sem nome');
  const base = displayCode ? `${displayCode} - ${baseName}` : baseName;

  return kindLabel !== '—' ? `${base} · ${kindLabel}` : base;
}
