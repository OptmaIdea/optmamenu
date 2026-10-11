import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Copy, CreditCard, ExternalLink, Landmark, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  PublicOrderService,
  type PublicOptmaPayPaymentState,
} from '@/services/publicOrderService';

function formatCardExpiryInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

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
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardReceipt, setCardReceipt] = useState(state?.receipt || null);
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
  const methodCode = String(state?.paymentMethodCode || state?.intent?.methodCode || '');
  const isDebitCard = methodCode === 'debit_card';
  const isCreditCard = methodCode === 'credit_card';
  const isCardPayment = isDebitCard || isCreditCard;
  const cardAuthorized = state?.intent?.status === 'authorized' || Boolean(state?.authorized);
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

  async function chargeCard() {
    if (working || !state?.eligible) return;

    const normalizedNumber = cardNumber.replace(/\D/g, '');
    const normalizedExpiry = expirationDate.trim();
    const normalizedCvv = cvv.trim();
    const normalizedName = cardholderName.trim();

    if (!/^\d{12,19}$/.test(normalizedNumber)) {
      setError('Confira o número do cartão.');
      return;
    }
    if (!normalizedName) {
      setError('Informe o nome impresso no cartão.');
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(normalizedExpiry)) {
      setError('Informe a validade no formato MM/AA.');
      return;
    }
    if (!/^\d{3,4}$/.test(normalizedCvv)) {
      setError('Confira o código de segurança do cartão.');
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const result = await PublicOrderService.chargeOptmaPayCard({
        token,
        cardNumber: normalizedNumber,
        cardholderName: normalizedName,
        expirationDate: normalizedExpiry,
        cvv: normalizedCvv,
        installments: 1,
      });
      setState(result);
      setCardReceipt(result.receipt || null);
      setCardNumber('');
      setCvv('');

      if (result.alreadyPaid || result.paymentStatus === 'paid') {
        toast.success('Pagamento já confirmado.');
      } else if (result.authorized) {
        toast.success('Pagamento autorizado. Aguardando confirmação automática.');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível autorizar este cartão.';
      setError(message);
      setCvv('');
    } finally {
      setWorking(false);
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
              {isCardPayment
                ? 'O OptmaPay Sandbox confirmou o pagamento com cartão. A venda está paga comercialmente; a liquidação ao lojista segue o plano configurado.'
                : 'O OptmaPay Sandbox confirmou este PIX. A reserva permanece protegida até a retirada ou a etapa operacional que fizer a baixa física.'}
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

  if (isCardPayment) {
    const receipt = cardReceipt || state?.receipt || null;
    return (
      <section className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 h-7 w-7 shrink-0 text-violet-600" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-slate-950">
              {isDebitCard ? 'Pagar agora com cartão de débito' : 'Pagar agora com cartão de crédito'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Ambiente OptmaPay Sandbox. Os dados do cartão são usados apenas para esta autorização e não são salvos pelo OptmaMenu.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {cardAuthorized && !paid && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            Pagamento autorizado. Aguardando confirmação automática do OptmaPay.
          </div>
        )}

        {!cardAuthorized && (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">
              Número do cartão Sandbox
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(event) => setCardNumber(event.target.value)}
                placeholder="0000 0000 0000 0000"
                disabled={working}
                className="rounded-xl border border-slate-200 px-3 py-3 font-mono text-base outline-none focus:border-violet-500"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-bold text-slate-700">
              Nome no cartão
              <input
                autoComplete="cc-name"
                value={cardholderName}
                onChange={(event) => setCardholderName(event.target.value)}
                placeholder="NOME DO CLIENTE"
                disabled={working}
                className="rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-violet-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Validade
                <input
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={expirationDate}
                  onChange={(event) => setExpirationDate(formatCardExpiryInput(event.target.value))}
                  placeholder="MM/AA"
                  maxLength={5}
                  disabled={working}
                  className="rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-violet-500"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                CVV
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cvv}
                  onChange={(event) => setCvv(event.target.value)}
                  placeholder="•••"
                  disabled={working}
                  className="rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-violet-500"
                />
              </label>
            </div>

            {isCreditCard && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <strong>Crédito à vista: 1x.</strong> O parcelamento permanece preservado no motor, mas não é exposto nesta primeira homologação até validarmos competência de fatura e liquidação parcela a parcela.
              </div>
            )}

            <button
              type="button"
              disabled={working || !state?.eligible}
              onClick={() => void chargeCard()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {working ? 'Autorizando...' : isDebitCard ? 'Pagar no débito' : 'Pagar no crédito 1x'}
            </button>
          </div>
        )}

        {receipt && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-black text-slate-900">Comprovante de autorização — OptmaPay Sandbox</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <p><span className="text-slate-500">Valor:</span> <strong>{formatCurrency(receipt.amountGross)}</strong></p>
              <p><span className="text-slate-500">Meio:</span> <strong>{isDebitCard ? 'Débito' : 'Crédito'}</strong></p>
              <p><span className="text-slate-500">Cartão:</span> <strong>{receipt.cardBrand || 'OptmaCard'} {receipt.cardMasked || ''}</strong></p>
              <p><span className="text-slate-500">Autorização:</span> <strong>{receipt.authorizationCode || '—'}</strong></p>
              <p><span className="text-slate-500">Taxa:</span> <strong>{formatCurrency(receipt.feeAmount)}</strong></p>
              <p><span className="text-slate-500">Líquido ao lojista:</span> <strong>{formatCurrency(receipt.amountNet)}</strong></p>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">Sandbox — sem movimentação de dinheiro real.</p>
          </div>
        )}
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
