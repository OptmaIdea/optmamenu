import type { FinancialAccountBalance, FinancialPaymentMethod } from '@/services/financialAccountsService';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  accounts: FinancialAccountBalance[];
  paymentMethods: FinancialPaymentMethod[];
  refundAccountId: string;
  refundPaymentMethodCode: string;
  onChange: (next: { refundAccountId: string; refundPaymentMethodCode: string }) => void;
}

function accountAcceptsMethod(account: FinancialAccountBalance, method?: FinancialPaymentMethod) {
  if (!method) return true;
  const accepted = account.accepted_payment_methods || [];
  return accepted.length === 0 || accepted.includes(method.code) || accepted.includes(method.base_code);
}

export default function SaleRefundFinanceFields({
  accounts,
  paymentMethods,
  refundAccountId,
  refundPaymentMethodCode,
  onChange,
}: Props) {
  const selectedMethod = paymentMethods.find((method) => method.code === refundPaymentMethodCode);
  const compatibleAccounts = accounts.filter((account) => accountAcceptsMethod(account, selectedMethod));

  function selectMethod(code: string) {
    const method = paymentMethods.find((item) => item.code === code);
    const candidates = accounts.filter((account) => accountAcceptsMethod(account, method));
    const currentStillValid = candidates.some((account) => account.id === refundAccountId);
    const preferred = candidates.find((account) => account.id === method?.preferred_financial_account_id);
    onChange({
      refundPaymentMethodCode: code,
      refundAccountId: currentStillValid ? refundAccountId : preferred?.id || candidates[0]?.id || '',
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Forma efetiva da devolução</span>
        <select
          value={refundPaymentMethodCode}
          onChange={(event) => selectMethod(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">Selecione a forma</option>
          {paymentMethods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}
        </select>
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Pode ser diferente do recebimento original, por exemplo cartão recebido e devolução em PIX ou dinheiro.
        </p>
      </label>

      <label className="block">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Conta de onde sairá o estorno</span>
        <select
          value={refundAccountId}
          onChange={(event) => onChange({ refundAccountId: event.target.value, refundPaymentMethodCode })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">Selecione uma conta compatível</option>
          {compatibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · saldo {currency.format(account.balance)}</option>)}
        </select>
        {refundPaymentMethodCode && compatibleAccounts.length === 0 && (
          <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-300">Nenhuma conta ativa aceita esta forma de devolução.</p>
        )}
      </label>
    </div>
  );
}
