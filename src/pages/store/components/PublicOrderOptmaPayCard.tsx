import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, ExternalLink, Landmark, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  PublicOrderService,
  type PublicOptmaPayPaymentState,
} from '@/services/publicOrderService';

function formatCurrency(value?: number | null) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatExpiry(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PublicOrderOptmaPayCard({ token }: { token: string }) {
  const [state, setState] = useState<PublicOptmaPayPaymentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await PublicOrderService.getOptmaPayPaymentState(token);
      setState(result);
      setError(null);
    } catch (cause) {
      console.error('[OPTMAPAY] Falha ao consultar pagamento público:', cause);
      setError('Não foi possível consultar o pagamento agora.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pending = state?.intent?.status && ['created', 'pending', 'authorized'].includes(state.intent.status);
    if (!pending) return;

    const timer = window.setInterval(() => {
      void load();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [load, state?.intent?.status]);

  const paid = state?.paymentStatus === 'paid' || state?.intent?.status === 'paid';
  const expired = state?.intent?.status === 'expired';
  const expiresLabel = useMemo(() => formatExpiry(state?.intent?.expiresAt), [state?.intent?.expiresAt]);

  async function createPayment() {
    setWorking(true);
    setError(null);
    try {
      const result = await PublicOrderService.createOptmaPayPayment(token);
      setState(result);
      if (result.alreadyPaid || result.intent?.status === 'paid') {
        toast.success('Pagamento já confirmado.');
      } else {
        toast.success('PIX Sandbox preparado.');
      }
    } catch (cause) {
      console.error('[OPTMAPAY] Falha ao preparar pagamento:', cause);
      setError('Não foi possível gerar o PIX agora. Seu pedido continua salvo e você pode tentar novamente.');
    } finally {
      setWorking(false);
    }
  }

  async function copyPayload() {
    const payload = state?.intent?.pixPayload;
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Código PIX copiado.');
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-violet-700">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm font-semibold">Consultando pagamento Sandbox...</span>
        </div>
      </section>
    );
  }

  if (!state?.eligible && !state?.intent) return null;

  if (paid) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600" />
          <div>
            <h2 className="text-lg font-black text-emerald-950">Pagamento confirmado</h2>
            <p className="mt-1 text-sm text-emerald-800">
              O OptmaPay Sandbox confirmou este PIX. Nenhum dinheiro real foi movimentado.
            </p>
            {state.intent?.paidAt && (
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                Confirmado em {new Date(state.intent.paidAt).toLocaleString('pt-BR')}.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        {expired ? (
          <XCircle className="mt-0.5 h-7 w-7 shrink-0 text-amber-600" />
        ) : (
          <Landmark className="mt-0.5 h-7 w-7 shrink-0 text-violet-600" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-slate-950">
            {expired ? 'PIX Sandbox expirado' : 'Pagar agora com OptmaPay'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Ambiente de testes. Este pagamento simula o fluxo bancário completo sem movimentar dinheiro real.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {!state?.intent?.pixPayload || expired ? (
        <button
          type="button"
          disabled={working || !state?.eligible}
          onClick={() => void createPayment()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {working ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
          {expired ? 'Gerar novo PIX' : 'Gerar PIX Sandbox'}
        </button>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-500">Valor</p>
              <p className="mt-1 text-xl font-black text-violet-950">{formatCurrency(state.intent.amount)}</p>
            </div>
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-500">Status</p>
              <p className="mt-1 flex items-center gap-2 font-black text-violet-950">
                <Clock3 className="h-4 w-4 text-amber-600" />
                Aguardando pagamento
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-wide text-slate-500">
              Código PIX Sandbox
            </label>
            <textarea
              readOnly
              rows={5}
              value={state.intent.pixPayload}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void copyPayload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white"
            >
              <Copy className="h-4 w-4" />
              Copiar código
            </button>
            <a
              href="https://optmapay.optmaidea.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300 px-4 py-3 text-sm font-black text-violet-700"
            >
              Abrir OptmaPay
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>

          {expiresLabel && (
            <p className="text-xs text-slate-500">
              Esta instrução expira em {expiresLabel}. Enquanto estiver pendente, esta tela verifica a confirmação automaticamente.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
