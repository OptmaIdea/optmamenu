import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, Loader2, Upload, XCircle } from 'lucide-react';
import { PublicOrderService, type PublicPaymentProofState } from '@/services/publicOrderService';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : dateTime.format(parsed);
}

export default function PublicOrderPaymentProofCard({ token }: { token: string }) {
  const [state, setState] = useState<PublicPaymentProofState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const next = await PublicOrderService.getPaymentProofState(token);
      setState(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível consultar o pagamento.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const latestRelevant = useMemo(
    () => state?.proofs.find((proof) => ['confirmed', 'submitted', 'rejected'].includes(proof.status)) || null,
    [state?.proofs],
  );
  const paymentConfirmed = state?.payment_status === 'paid' || latestRelevant?.status === 'confirmed';
  const waitingReview = latestRelevant?.status === 'submitted';
  const rejected = latestRelevant?.status === 'rejected';

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Consultando pagamento PIX…</div>
      </section>
    );
  }

  if (!state?.ok || (!state.eligible && !latestRelevant && !paymentConfirmed)) return null;

  async function submit() {
    if (!file) {
      setError('Selecione a imagem ou PDF do comprovante.');
      return;
    }
    try {
      setSending(true);
      setError(null);
      setSuccess(null);
      await PublicOrderService.submitPaymentProof({ token, file, declaredAmount: state?.order_total ?? null });
      setFile(null);
      setSuccess('Comprovante enviado. A loja ainda precisa conferir e confirmar o recebimento.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar o comprovante.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-700"><FileCheck2 className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Pagamento PIX</p>
          <h2 className="mt-0.5 text-lg font-black text-slate-900">
            {paymentConfirmed ? 'Pagamento confirmado' : waitingReview ? 'Comprovante em conferência' : 'Envie o comprovante'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">Valor do pedido: <strong>{currency.format(Number(state.order_total || 0))}</strong></p>
        </div>
      </div>

      {paymentConfirmed && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-black">Recebimento confirmado pela loja.</p><p className="mt-1">Este pedido não será cancelado por falta de pagamento.</p></div>
        </div>
      )}

      {!paymentConfirmed && waitingReview && latestRelevant && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Comprovante recebido em {formatDate(latestRelevant.submitted_at)}.</p>
            <p className="mt-1">O envio do arquivo não confirma o pagamento automaticamente. Aguarde a conferência da loja.</p>
          </div>
        </div>
      )}

      {!paymentConfirmed && rejected && latestRelevant && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-black">O comprovante anterior foi rejeitado.</p>{latestRelevant.decision_notes && <p className="mt-1">Motivo: {latestRelevant.decision_notes}</p>}<p className="mt-1">Você pode enviar um novo comprovante enquanto o pedido estiver ativo.</p></div>
        </div>
      )}

      {!paymentConfirmed && !waitingReview && state.eligible && (
        <div className="mt-5 space-y-3">
          <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
            <span className="font-bold">Imagem ou PDF do comprovante</span>
            <span className="mt-1 block text-xs text-slate-500">JPG, PNG, WebP ou PDF · máximo 8 MB.</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="mt-3 block w-full text-sm"
              onChange={(event) => { setFile(event.target.files?.[0] || null); setError(null); setSuccess(null); }}
              disabled={sending}
            />
          </label>
          {file && <p className="text-xs font-semibold text-slate-600">Selecionado: {file.name}</p>}
          <div className="flex gap-3 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p><strong>Importante:</strong> enviar um comprovante não marca o pedido como pago. A equipe da loja precisa conferir o recebimento e confirmar manualmente.</p>
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!file || sending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {sending ? 'Enviando…' : 'Enviar comprovante'}
          </button>
        </div>
      )}

      {success && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{success}</p>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
    </section>
  );
}
