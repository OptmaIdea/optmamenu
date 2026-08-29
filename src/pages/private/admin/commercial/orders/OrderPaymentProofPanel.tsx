import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FileCheck2, Loader2, MessageCircle, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FinancialAccountsService, type FinancialAccountBalance, type FinancialPaymentMethod } from '@/services/financialAccountsService';
import { OrderPaymentProofService, type OrderPaymentProof } from '@/services/orderPaymentProofService';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : dateTime.format(parsed);
}

function accountAcceptsPix(account: FinancialAccountBalance, method?: FinancialPaymentMethod) {
  const accepted = account.accepted_payment_methods || [];
  if (accepted.length === 0) return true;
  if (!method) return accepted.includes('pix');
  return accepted.includes(method.code) || accepted.includes(method.base_code);
}

function statusText(proof: OrderPaymentProof) {
  if (proof.status === 'submitted') return 'Aguardando conferência';
  if (proof.status === 'confirmed') return 'Confirmado';
  if (proof.status === 'rejected') return 'Rejeitado';
  if (proof.status === 'superseded') return 'Substituído';
  if (proof.status === 'expired') return 'Expirado';
  return 'Envio em andamento';
}

export default function OrderPaymentProofPanel({
  storeId,
  orderId,
  orderStatus,
  paymentStatus,
  paymentMethodCode,
  onChanged,
  onPaymentConfirmed,
}: {
  storeId: string;
  orderId: string;
  orderStatus: string;
  paymentStatus?: string | null;
  paymentMethodCode?: string | null;
  onChanged?: () => void | Promise<void>;
  onPaymentConfirmed?: () => void | Promise<void>;
}) {
  const [proofs, setProofs] = useState<OrderPaymentProof[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [accounts, setAccounts] = useState<FinancialAccountBalance[]>([]);
  const [methods, setMethods] = useState<FinancialPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [notes, setNotes] = useState('');

  const paymentMethod = useMemo(
    () => methods.find((method) => method.code === paymentMethodCode),
    [methods, paymentMethodCode],
  );
  const isPix = paymentMethod?.base_code === 'pix' || paymentMethodCode === 'pix' || Boolean(paymentMethodCode?.toLowerCase().includes('pix'));
  const compatibleAccounts = useMemo(
    () => accounts.filter((account) => account.active && accountAcceptsPix(account, paymentMethod)),
    [accounts, paymentMethod],
  );
  const submitted = proofs.find((proof) => proof.status === 'submitted') || null;
  const confirmed = proofs.find((proof) => proof.status === 'confirmed') || null;

  const load = useCallback(async () => {
    if (!storeId || !orderId) return;
    try {
      setLoading(true);
      const [proofResult, balanceResult] = await Promise.all([
        OrderPaymentProofService.getForOrder(storeId, orderId),
        FinancialAccountsService.getBalances(storeId),
      ]);
      setProofs(proofResult.proofs);
      setCanReview(proofResult.canReview);
      setAccounts(balanceResult.accounts);
      setMethods(balanceResult.paymentMethods);

      const method = balanceResult.paymentMethods.find((item) => item.code === paymentMethodCode);
      const candidates = balanceResult.accounts.filter((account) => account.active && accountAcceptsPix(account, method));
      const preferred = candidates.find((account) => account.id === method?.preferred_financial_account_id);
      const clearing = candidates.find((account) => account.is_sales_clearing_default);
      setSelectedAccountId((current) => {
        if (preferred?.id) return preferred.id;
        if (candidates.some((account) => account.id === current)) return current;
        return clearing?.id || candidates[0]?.id || '';
      });
    } catch (error) {
      console.error('Erro ao carregar comprovantes do pedido:', error);
      setProofs([]);
      setCanReview(false);
    } finally {
      setLoading(false);
    }
  }, [orderId, paymentMethodCode, storeId]);

  useEffect(() => { void load(); }, [load]);

  async function confirmExternalPayment() {
    if (!selectedAccountId) {
      toast.error('Selecione a conta financeira que recebeu o PIX.');
      return;
    }

    const confirmedByUser = window.confirm('Confirmar pagamento PIX conferido fora do sistema? Use esta opção quando o comprovante chegou por WhatsApp, e-mail ou conferência bancária.');
    if (!confirmedByUser) return;

    try {
      setSavingId('external');
      const result = await OrderPaymentProofService.confirmExternalPixPayment({
        storeId,
        orderId,
        financialAccountId: selectedAccountId,
        notes,
      });
      toast.success(`Pagamento confirmado${result.cashbook_entry_code ? ` · ${String(result.cashbook_entry_code)}` : ''}.`);
      setNotes('');
      await load();
      await onPaymentConfirmed?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível confirmar o pagamento externo.');
    } finally {
      setSavingId(null);
    }
  }

  async function review(proof: OrderPaymentProof, decision: 'confirm' | 'reject') {
    if (decision === 'confirm' && !selectedAccountId) {
      toast.error('Selecione a conta financeira que recebeu o PIX.');
      return;
    }
    if (decision === 'reject' && notes.trim().length < 3) {
      toast.error('Informe o motivo da rejeição.');
      return;
    }
    try {
      setSavingId(proof.id);
      const result = await OrderPaymentProofService.review({
        storeId,
        proofId: proof.id,
        decision,
        financialAccountId: decision === 'confirm' ? selectedAccountId : null,
        notes,
      });
      toast.success(decision === 'confirm'
        ? `Pagamento confirmado${result.cashbook_entry_code ? ` · ${String(result.cashbook_entry_code)}` : ''}.`
        : 'Comprovante rejeitado. O cliente poderá enviar outro enquanto o pedido estiver ativo.');
      setNotes('');
      await load();
      if (decision === 'confirm') await onPaymentConfirmed?.();
      else await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível revisar o comprovante.');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Consultando pagamento PIX…</div>;
  }
  if (!isPix) return null;

  return (
    <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300"><FileCheck2 size={15} /> Comprovação PIX</p>
          <h4 className="mt-1 font-black text-gray-900 dark:text-white">
            {confirmed ? 'Pagamento antecipado confirmado' : submitted ? 'Comprovante aguardando conferência' : paymentStatus === 'paid' ? 'Pagamento já confirmado' : 'Aguardando comprovante do cliente'}
          </h4>
          <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">O comprovante auxilia a conferência; quando confirmado, o pedido é aceito, a baixa financeira é feita na conta configurada para o PIX e o prazo de reserva é encerrado.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"><RefreshCw size={13} />Atualizar</button>
      </div>

      {proofs.length > 0 && (
        <div className="mt-4 space-y-2">
          {proofs.map((proof) => (
            <div key={proof.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${proof.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : proof.status === 'submitted' ? 'bg-amber-100 text-amber-800' : proof.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>{statusText(proof)}</span>
                    <strong className="text-sm text-gray-900 dark:text-white">{proof.original_file_name || 'Comprovante'}</strong>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Enviado: {formatDate(proof.submitted_at || proof.created_at)}{proof.declared_amount != null ? ` · Valor informado ${currency.format(proof.declared_amount)}` : ''}</p>
                  {proof.decision_notes && <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Observação: {proof.decision_notes}</p>}
                </div>
                {proof.signedUrl && <a href={proof.signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-black text-teal-700 dark:border-gray-700 dark:text-teal-300">Abrir comprovante <ExternalLink size={13} /></a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {proofs.length === 0 && paymentStatus !== 'paid' && ['reserved', 'confirmed', 'ready'].includes(orderStatus) && (
        <p className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">Nenhum comprovante enviado ainda.</p>
      )}

      {!submitted && !confirmed && canReview && paymentStatus !== 'paid' && ['reserved', 'confirmed', 'ready'].includes(orderStatus) && (
        <div className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-gray-900 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Conta que recebeu o PIX</span>
            <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950">
              <option value="">Selecione a conta</option>
              {compatibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · saldo {currency.format(account.balance)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Referência da conferência</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: comprovante recebido por WhatsApp" className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
          </label>
          <div className="md:col-span-2 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            Use esta opção para comprovante enviado por WhatsApp/e-mail ou conferência no extrato. Ela aceita o pedido, encerra o timer e lança a entrada na conta PIX configurada.
          </div>
          <button type="button" disabled={savingId === 'external' || !selectedAccountId} onClick={() => void confirmExternalPayment()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50 md:col-span-2">
            {savingId === 'external' ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}Confirmar PIX recebido fora do sistema
          </button>
        </div>
      )}

      {submitted && canReview && (
        <div className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-gray-900 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Conta que recebeu o PIX</span>
            <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950">
              <option value="">Selecione a conta</option>
              {compatibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · saldo {currency.format(account.balance)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Observação / motivo da rejeição</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional ao confirmar; obrigatório ao rejeitar" className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button type="button" disabled={savingId === submitted.id || !selectedAccountId} onClick={() => void review(submitted, 'confirm')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{savingId === submitted.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Confirmar recebimento</button>
            <button type="button" disabled={savingId === submitted.id || notes.trim().length < 3} onClick={() => void review(submitted, 'reject')} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 disabled:opacity-50"><XCircle size={15} />Rejeitar comprovante</button>
          </div>
        </div>
      )}
    </div>
  );
}
