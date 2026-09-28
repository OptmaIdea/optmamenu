import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function formatCountdown(value: number | null) {
  if (value == null) return '—';
  const seconds = Math.max(0, value);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

export default function PublicOrderOptmaPayCard({ token }: { token: string }) {
  const [state, setState] = useState<PublicOptmaPayPaymentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const rotatingIntentRef = useRef<string | null>(null);

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

  const paid = state?.paymentStatus === 'paid' || state?.intent?.status === 'paid';
  const expired = state?.intent?.status === 'expired';
  const autoRotationIndex = Number(state?.intent?.autoRotationIndex || 0);
  const manualRegenerationRequired = Boolean(
    state?.manualRegenerationRequired || (expired && autoRotationIndex >= 2),
  );
  const expiresLabel = useMemo(() => formatExpiry(state?.intent?.expiresAt), [state?.intent?.expiresAt]);

  useEffect(() => {
    if (!state?.intent?.expiresAt || paid) {
      setRemainingSeconds(null);
      return;
    }

    const update = () => {
      const expiresAt = new Date(state.intent?.expiresAt || '').getTime();
      if (!Number.isFinite(expiresAt)) {
        setRemainingSeconds(null);
        return;
      }
      setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [paid, state?.intent?.expiresAt]);

  useEffect(() => {
    const pending = state?.intent?.status && ['created', 'pending', 'authorized'].includes(state.intent.status);
    if (!pending || paid) return;

    const timer = window.setInterval(() => {
      void load();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [load, paid, state?.intent?.status]);

  useEffect(() => {
    if (remainingSeconds !== 0 || paid) return;
    void load();
  }, [load, paid, remainingSeconds]);

  const requestPayment = useCallback(async (
    mode: 'initial' | 'automatic' | 'manual',
    options?: { silent?: boolean },
  ) => {
    setWorking(true);
    setError(null);
    try {
      const result = await PublicOrderService.createOptmaPayPayment(token, mode);
      setState(result);

      if (result.alreadyPaid || result.intent?.status === 'paid') {
        toast.success('Pagamento já confirmado.');
        return;
      }

      if (result.manualRegenerationRequired) {
        if (!options?.silent) {
          toast.info('As duas atualizações automáticas foram usadas. Gere um novo código para continuar.');
        }
        return;
      }

      if (mode === 'automatic') {
        const index = Number(result.intent?.autoRotationIndex || 0);
        toast.success(`Código PIX atualizado automaticamente (${index}/2).`);
      } else if (mode === 'manual') {
        toast.success('Novo ciclo PIX gerado. O código é válido por 15 minutos.');
      } else if (!options?.silent) {
        toast.success('PIX Sandbox preparado.');
      }
    } catch (cause) {
      console.error('[OPTMAPAY] Falha ao preparar pagamento:', cause);
      setError(
        mode === 'automatic'
          ? 'A atualização automática do código não pôde ser concluída. Você pode tentar novamente.'
          : 'Não foi possível gerar o PIX agora. Seu pedido continua salvo e você pode tentar novamente.',
      );
    } finally {
      setWorking(false);
    }
  }, [token]);

  useEffect(() => {
    const intent = state?.intent;
    if (
      !intent ||
      intent.status !== 'expired' ||
      paid ||
      manualRegenerationRequired ||
      !state?.eligible ||
      working
    ) {
      return;
    }

    if (rotatingIntentRef.current === intent.id) return;
    rotatingIntentRef.current = intent.id;
    void requestPayment('automatic', { silent: true });
  }, [manualRegenerationRequired, paid, requestPayment, state, working]);

  async function copyPayload() {
    const payload = state?.intent?.pixPayload;
    if (!payload || expired) return;
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
              O OptmaPay Sandbox confirmou este PIX. A reserva permanece protegida até a retirada ou a etapa operacional que fizer a baixa física.
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

  const isAutoRefreshing = expired && !manualRegenerationRequired && working;
  const shouldShowManualButton = !state?.intent?.pixPayload || manualRegenerationRequired;
  const canRetryAuto = expired && !manualRegenerationRequired && Boolean(error);

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
            {manualRegenerationRequired
              ? 'Gerar novo código PIX'
              : isAutoRefreshing
                ? 'Atualizando código PIX'
                : expired
                  ? 'Código PIX expirado'
                  : 'Pagar agora com OptmaPay'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Cada código é válido por 15 minutos. O sistema faz até duas atualizações automáticas; depois disso, um novo ciclo deve ser gerado manualmente.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {isAutoRefreshing && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-800">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Gerando automaticamente o próximo código PIX...
        </div>
      )}

      {shouldShowManualButton && !isAutoRefreshing && (
        <button
          type="button"
          disabled={working || !state?.eligible}
          onClick={() => void requestPayment(state?.intent ? 'manual' : 'initial')}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {working ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
          {state?.intent ? 'Gerar novo código PIX' : 'Gerar PIX Sandbox'}
        </button>
      )}

      {canRetryAuto && (
        <button
          type="button"
          disabled={working}
          onClick={() => {
            rotatingIntentRef.current = null;
            void requestPayment('automatic');
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-violet-300 px-4 py-2 text-sm font-black text-violet-800 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar atualização novamente
        </button>
      )}

      {state?.intent?.pixPayload && !expired && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-500">Valor</p>
              <p className="mt-1 text-xl font-black text-violet-950">{formatCurrency(state.intent.amount)}</p>
            </div>
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-500">Validade</p>
              <p className="mt-1 flex items-center gap-2 font-black text-violet-950">
                <Clock3 className="h-4 w-4 text-amber-600" />
                {formatCountdown(remainingSeconds)}
              </p>
            </div>
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-500">Atualizações</p>
              <p className="mt-1 font-black text-violet-950">{autoRotationIndex}/2 automáticas</p>
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
              Código atual válido até {expiresLabel}. Se não houver pagamento, ele será atualizado automaticamente enquanto houver atualização disponível.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
