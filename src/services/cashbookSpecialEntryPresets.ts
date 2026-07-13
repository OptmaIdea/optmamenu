export type CashbookSpecialEntryPresetCode =
  | 'owner_contribution'
  | 'owner_withdrawal'
  | 'loan_received'
  | 'loan_principal_payment'
  | 'loan_interest_expense'
  | 'cash_to_bank_deposit'
  | 'cash_drawer_withdrawal'
  | 'change_float_reinforcement'
  | 'pending_payment_received';

export type CashbookSpecialEntryPresetKind = 'income' | 'expense' | 'transfer' | 'adjustment';

export interface CashbookSpecialEntryPreset {
  code: CashbookSpecialEntryPresetCode;
  label: string;
  description: string;
  kind: CashbookSpecialEntryPresetKind;
  direction: 'in' | 'out' | 'transfer';
  accountPlanCode: string;
  defaultPaymentMethod?: string;
  affectsCashDrawer: boolean;
  affectsFinancialResult: boolean;
  isTransfer: boolean;
  metadata: Record<string, unknown>;
}

export const CASHBOOK_SPECIAL_ENTRY_PRESETS: CashbookSpecialEntryPreset[] = [
  {
    code: 'owner_contribution',
    label: 'Aporte do proprietário',
    description: 'Dinheiro colocado pelo proprietário ou sócio no caixa, Pix ou banco da loja. Não é venda.',
    kind: 'adjustment',
    direction: 'in',
    accountPlanCode: 'owner_contribution',
    defaultPaymentMethod: 'cash',
    affectsCashDrawer: true,
    affectsFinancialResult: false,
    isTransfer: false,
    metadata: { special_entry: true, owner_event: 'contribution' },
  },
  {
    code: 'owner_withdrawal',
    label: 'Retirada do proprietário',
    description: 'Retirada de dinheiro pelo proprietário. Não é despesa operacional comum.',
    kind: 'adjustment',
    direction: 'out',
    accountPlanCode: 'owner_withdrawal',
    defaultPaymentMethod: 'cash',
    affectsCashDrawer: true,
    affectsFinancialResult: false,
    isTransfer: false,
    metadata: { special_entry: true, owner_event: 'withdrawal' },
  },
  {
    code: 'loan_received',
    label: 'Empréstimo recebido',
    description: 'Entrada de dinheiro por empréstimo recebido. Não deve inflar faturamento.',
    kind: 'adjustment',
    direction: 'in',
    accountPlanCode: 'loan_received',
    defaultPaymentMethod: 'bank',
    affectsCashDrawer: false,
    affectsFinancialResult: false,
    isTransfer: false,
    metadata: { special_entry: true, loan_event: 'received' },
  },
  {
    code: 'loan_principal_payment',
    label: 'Pagamento de empréstimo',
    description: 'Pagamento do principal da dívida. Não é despesa operacional; juros devem ser lançados separado.',
    kind: 'adjustment',
    direction: 'out',
    accountPlanCode: 'loan_principal_payment',
    defaultPaymentMethod: 'bank',
    affectsCashDrawer: false,
    affectsFinancialResult: false,
    isTransfer: false,
    metadata: { special_entry: true, loan_event: 'principal_payment' },
  },
  {
    code: 'loan_interest_expense',
    label: 'Juros de empréstimo',
    description: 'Juros e encargos financeiros de empréstimos. Isso é despesa financeira.',
    kind: 'expense',
    direction: 'out',
    accountPlanCode: 'loan_interest_expense',
    defaultPaymentMethod: 'bank',
    affectsCashDrawer: false,
    affectsFinancialResult: true,
    isTransfer: false,
    metadata: { special_entry: true, loan_event: 'interest', financial_expense: true },
  },
  {
    code: 'cash_to_bank_deposit',
    label: 'Depósito do caixa no banco',
    description: 'Transferência interna do caixa físico para banco. Não é receita nem despesa.',
    kind: 'transfer',
    direction: 'transfer',
    accountPlanCode: 'transfer_cash_to_bank',
    defaultPaymentMethod: 'cash',
    affectsCashDrawer: true,
    affectsFinancialResult: false,
    isTransfer: true,
    metadata: { special_entry: true, transfer_event: 'cash_to_bank' },
  },
  {
    code: 'cash_drawer_withdrawal',
    label: 'Sangria do caixa',
    description: 'Retirada interna do caixa físico para cofre ou outra conta segura. Não é despesa.',
    kind: 'transfer',
    direction: 'transfer',
    accountPlanCode: 'transfer_cash_to_safe',
    defaultPaymentMethod: 'cash',
    affectsCashDrawer: true,
    affectsFinancialResult: false,
    isTransfer: true,
    metadata: { special_entry: true, transfer_event: 'cash_to_safe', cash_drawer_event: 'withdrawal' },
  },
  {
    code: 'change_float_reinforcement',
    label: 'Reforço de troco',
    description: 'Entrada de dinheiro para reforçar troco no caixa físico. Não é venda.',
    kind: 'adjustment',
    direction: 'in',
    accountPlanCode: 'change_float_reinforcement',
    defaultPaymentMethod: 'cash',
    affectsCashDrawer: true,
    affectsFinancialResult: false,
    isTransfer: false,
    metadata: { special_entry: true, cash_event: 'change_float_reinforcement' },
  },
  {
    code: 'pending_payment_received',
    label: 'Recebimento pendente',
    description: 'Recebimento financeiro posterior de algo que estava em aberto.',
    kind: 'income',
    direction: 'in',
    accountPlanCode: 'pending_payment_received',
    defaultPaymentMethod: 'pix',
    affectsCashDrawer: false,
    affectsFinancialResult: true,
    isTransfer: false,
    metadata: { special_entry: true, pending_payment_event: 'received' },
  },
];

export function getCashbookSpecialEntryPreset(code: CashbookSpecialEntryPresetCode) {
  return CASHBOOK_SPECIAL_ENTRY_PRESETS.find((preset) => preset.code === code) || null;
}
