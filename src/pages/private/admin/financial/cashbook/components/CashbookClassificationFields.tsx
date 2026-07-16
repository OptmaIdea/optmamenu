import type { CashbookDirection } from '@/services/cashbookService';
import { useCashbookClassificationOptions } from '@/hooks/financial/useCashbookClassificationOptions';

interface CashbookClassificationFieldsProps {
    storeId: string | null;
    direction: CashbookDirection;
    paymentMethodCode: string;
    accountPlanCode: string;
    financialAccountCode: string;
    onAccountPlanCodeChange: (value: string) => void;
    onFinancialAccountCodeChange: (value: string) => void;
}

function isPendingPaymentMethod(value?: string | null) {
    return String(value || '').trim().toLowerCase() === 'pending';
}

function requiresDetailedNotes(metadata?: Record<string, unknown> | null) {
    return metadata?.requires_notes === true || metadata?.requires_detailed_notes === true;
}

export default function CashbookClassificationFields({
    storeId,
    direction,
    paymentMethodCode,
    accountPlanCode,
    financialAccountCode,
    onAccountPlanCodeChange,
    onFinancialAccountCodeChange,
}: CashbookClassificationFieldsProps) {
    const {
        loading,
        error,
        categories,
        financialAccounts,
        getDefaultFinancialAccountCode,
    } = useCashbookClassificationOptions(storeId, direction);

    const isPending = isPendingPaymentMethod(paymentMethodCode);
    const suggestedFinancialAccountCode = isPending ? '' : getDefaultFinancialAccountCode(paymentMethodCode);
    const currentFinancialAccountCode = financialAccountCode || suggestedFinancialAccountCode || '';
    const financialAccountRequired = !isPending;
    const selectedCategory = categories.find((option) => option.value === accountPlanCode);
    const selectedCategoryRequiresNotes = requiresDetailedNotes(selectedCategory?.item.metadata);

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-[#19A999]/20 bg-[#19A999]/5 p-3 text-xs font-bold text-gray-700 dark:border-[#19A999]/30 dark:bg-[#19A999]/10 dark:text-gray-200">
                Informe a categoria do Plano de Contas para dizer o motivo do lançamento. A conta financeira indica onde o dinheiro entrou ou saiu.
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                        Categoria <span className="text-rose-500">*</span>
                    </span>
                    <select
                        value={accountPlanCode}
                        onChange={(event) => onAccountPlanCodeChange(event.target.value)}
                        disabled={loading}
                        required
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                        <option value="">Selecionar categoria</option>
                        {categories.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <p className="text-[11px] font-semibold text-gray-400">
                        Obrigatória para entradas e saídas manuais.
                    </p>
                </label>

                <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                        Conta financeira {financialAccountRequired && <span className="text-rose-500">*</span>}
                    </span>
                    <select
                        value={currentFinancialAccountCode}
                        onChange={(event) => onFinancialAccountCodeChange(event.target.value)}
                        disabled={loading || isPending}
                        required={financialAccountRequired}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                        <option value="">{isPending ? 'Sem movimentação financeira imediata' : 'Selecionar conta'}</option>
                        {financialAccounts.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <p className="text-[11px] font-semibold text-gray-400">
                        {isPending
                            ? 'Pagamento pendente não movimenta conta financeira agora.'
                            : currentFinancialAccountCode === suggestedFinancialAccountCode && suggestedFinancialAccountCode
                                ? 'Conta sugerida automaticamente pela forma de pagamento.'
                                : 'Usada para identificar onde o dinheiro entrou ou saiu.'}
                    </p>
                </label>
            </div>

            {selectedCategoryRequiresNotes && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    Esta categoria exige descrição clara e observações detalhadas antes de salvar o lançamento.
                </div>
            )}

            {error && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    {error}
                </div>
            )}
        </div>
    );
}

export function buildManualCashbookClassification(input: {
    direction: CashbookDirection;
    paymentMethodCode?: string | null;
    accountPlanCode?: string | null;
    financialAccountCode?: string | null;
}) {
    const paymentMethod = String(input.paymentMethodCode || '').trim().toLowerCase();
    const selectedAccountCode = input.financialAccountCode || (
        paymentMethod === 'cash' || paymentMethod === 'dinheiro'
            ? 'cash_drawer'
            : paymentMethod === 'pix'
                ? 'pix_wallet'
                : paymentMethod === 'card' || paymentMethod === 'debit_card' || paymentMethod === 'credit_card'
                    ? 'card_receivable'
                    : null
    );

    const affectsCashDrawer = selectedAccountCode ? selectedAccountCode === 'cash_drawer' : null;

    return {
        account_plan_code: input.accountPlanCode || null,
        source_financial_account_code: input.direction === 'out' ? selectedAccountCode : null,
        destination_financial_account_code: input.direction === 'in' ? selectedAccountCode : null,
        affects_cash_drawer: affectsCashDrawer,
        affects_financial_result: true,
        is_transfer: false,
    };
}
