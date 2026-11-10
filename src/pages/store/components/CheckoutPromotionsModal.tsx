import { BadgePercent, CheckCircle2, X } from 'lucide-react';
import { useMemo } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { formatBRL } from '@/utils/pricing';

interface CheckoutPromotionsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type PromotionSummary = {
    id: string;
    kind: 'group' | 'category';
    title: string;
    categoryNames: string[];
    quantity: number;
    rules: Array<{ min: number; price: number }>;
};

export function CheckoutPromotionsModal({ isOpen, onClose }: CheckoutPromotionsModalProps) {
    const items = useCartStore((state) => state.items);
    const categoryRules = useCartStore((state) => state.categoryRules);

    const promotions = useMemo(() => {
        const summaries = new Map<string, PromotionSummary>();

        items.forEach((item) => {
            if (!item.category_id || !item.use_category_pricing) return;
            const categoryRule = categoryRules[item.category_id];
            if (!categoryRule) return;

            if (categoryRule.pricingGroup?.rules?.length) {
                const key = `group:${categoryRule.pricingGroup.id}`;
                const existing = summaries.get(key);
                const rules = categoryRule.pricingGroup.rules
                    .filter((rule) => Number(rule.min) > 1)
                    .map((rule) => ({ min: Number(rule.min), price: Number(rule.price) }))
                    .sort((left, right) => left.min - right.min);

                summaries.set(key, {
                    id: key,
                    kind: 'group',
                    title: categoryRule.pricingGroup.name || 'Promoção combinada entre categorias',
                    categoryNames: categoryRule.pricingGroup.categoryNames || [categoryRule.categoryName],
                    quantity: (existing?.quantity || 0) + item.quantity,
                    rules,
                });
                return;
            }

            if (categoryRule.rules?.length) {
                const key = `category:${item.category_id}`;
                const existing = summaries.get(key);
                const rules = categoryRule.rules
                    .filter((rule) => Number(rule.min) > 1)
                    .map((rule) => ({ min: Number(rule.min), price: Number(rule.price) }))
                    .sort((left, right) => left.min - right.min);

                summaries.set(key, {
                    id: key,
                    kind: 'category',
                    title: categoryRule.categoryName || 'Promoção da categoria',
                    categoryNames: [categoryRule.categoryName].filter(Boolean),
                    quantity: (existing?.quantity || 0) + item.quantity,
                    rules,
                });
            }
        });

        return [...summaries.values()].filter((summary) => summary.rules.length > 0);
    }, [categoryRules, items]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
            <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar promoções" />

            <section className="safe-area-bottom relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
                <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <BadgePercent className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-black text-slate-950">Promoções do seu carrinho</h2>
                        <p className="mt-1 text-sm leading-5 text-slate-500">
                            Veja quais categorias somam juntas e quanto falta para alcançar cada faixa de preço.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-700" aria-label="Fechar">
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6">
                    {promotions.length === 0 ? (
                        <div className="rounded-2xl bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
                            Nenhuma promoção por quantidade está ativa para os itens atuais.
                        </div>
                    ) : promotions.map((promotion) => {
                        const nextRule = promotion.rules.find((rule) => rule.min > promotion.quantity);
                        const bestReached = [...promotion.rules].reverse().find((rule) => promotion.quantity >= rule.min);

                        return (
                            <article key={promotion.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                                            {promotion.kind === 'group' ? 'Promoção combinada entre categorias' : 'Promoção da categoria'}
                                        </p>
                                        <h3 className="mt-1 text-lg font-black text-slate-950">{promotion.title}</h3>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                                        {promotion.quantity} {promotion.quantity === 1 ? 'item' : 'itens'}
                                    </span>
                                </div>

                                <div className="mt-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                        {promotion.kind === 'group' ? 'Categorias que somam juntas' : 'Categoria participante'}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {promotion.categoryNames.map((categoryName) => (
                                            <span key={categoryName} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                                                {categoryName}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-4 space-y-2">
                                    {promotion.rules.map((rule) => {
                                        const reached = promotion.quantity >= rule.min;
                                        return (
                                            <div key={`${promotion.id}-${rule.min}-${rule.price}`} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${reached ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-slate-200 text-slate-600'}`}>
                                                <span className="flex items-center gap-2 font-bold">
                                                    {reached && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                                                    A partir de {rule.min} itens
                                                </span>
                                                <span className="font-black">R$ {formatBRL(rule.price)} cada</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {nextRule ? (
                                    <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold leading-5 text-amber-900">
                                        Adicione mais {nextRule.min - promotion.quantity} {nextRule.min - promotion.quantity === 1 ? 'item' : 'itens'} das categorias participantes para chegar a R$ {formatBRL(nextRule.price)} cada.
                                    </p>
                                ) : bestReached ? (
                                    <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                                        Melhor faixa publicada alcançada: R$ {formatBRL(bestReached.price)} cada.
                                    </p>
                                ) : null}
                            </article>
                        );
                    })}

                    <p className="px-2 text-xs leading-5 text-slate-500">
                        Os valores exibidos são uma prévia. O sistema confirma novamente preços, regras e disponibilidade antes de concluir o pedido.
                    </p>
                </div>
            </section>
        </div>
    );
}
