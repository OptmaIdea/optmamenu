import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SaleDetailService, type SalePartialReturnQuote } from '@/services/saleDetailService';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  storeId: string;
  orderId: string;
  items: Array<{ orderItemId: string; quantity: number }>;
}

export default function SalePartialReturnQuotePreview({ storeId, orderId, items }: Props) {
  const [quote, setQuote] = useState<SalePartialReturnQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedItems = useMemo(
    () => items.filter((item) => item.quantity > 0),
    [items],
  );
  const requestKey = useMemo(
    () => normalizedItems.map((item) => `${item.orderItemId}:${item.quantity}`).sort().join('|'),
    [normalizedItems],
  );

  useEffect(() => {
    if (!storeId || !orderId || normalizedItems.length === 0) {
      setQuote(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await SaleDetailService.quotePartialReturn(storeId, orderId, normalizedItems);
        if (!cancelled) setQuote(result);
      } catch (caught) {
        if (cancelled) return;
        setQuote(null);
        setError(caught instanceof Error ? caught.message : 'Não foi possível recalcular a devolução.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [orderId, requestKey, storeId]);

  if (normalizedItems.length === 0) {
    return (
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Informe as quantidades devolvidas para recalcular o valor.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <Loader2 size={15} className="animate-spin" /> Recalculando a faixa de preço das unidades que permanecerão na venda…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (!quote) return null;

  const pricingChanged = Math.abs(quote.pricingRecalculationAdjustment) >= 0.005;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-black">Valor recalculado da devolução: {currency.format(quote.refundAmount)}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <p>Valor dos itens selecionados na condição original: <strong>{currency.format(quote.selectedOriginalValue)}</strong></p>
        <p>Itens que permanecerão na venda: <strong>{currency.format(quote.retainedMerchandiseTotal)}</strong></p>
        {pricingChanged && <p>Desconto perdido pela nova quantidade: <strong>{currency.format(quote.pricingRecalculationAdjustment)}</strong></p>}
        <p>Estornos anteriores considerados: <strong>{currency.format(quote.previousRefunded)}</strong></p>
      </div>
      {pricingChanged && (
        <p className="text-xs font-bold">
          A quantidade restante mudou a faixa de preço. O valor devolvido é menor que o valor unitário originalmente promocional dos itens retirados, evitando manter um desconto cuja condição deixou de ser atendida.
        </p>
      )}
    </div>
  );
}
