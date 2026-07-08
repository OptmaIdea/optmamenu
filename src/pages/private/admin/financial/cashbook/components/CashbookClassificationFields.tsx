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

    const suggestedFinancialAccountCode = getDefaultFinancialAccountCode(paymentMethodCode);
    const currentFinancialAccountCode = financialAccountCode || suggestedFinancialAccountCode || '';

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Categoria</span>
                    <select
                        value={accountPlanCode}
                        onChange={(event) => onAccountPlanCodeChange(event.target.value)}
                        disabled={loading}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                        <option value="">Selecionar categoria</option>
                        {categories.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Conta financeira</span>
                    <select
                        value={currentFinancialAccountCode}
                        onChange={(event) => onFinancialAccountCodeChange(event.target.value)}
                        disabled={loading}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#19A999] disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                        <option value="">Selecionar conta</option>
                        {financialAccounts.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

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
