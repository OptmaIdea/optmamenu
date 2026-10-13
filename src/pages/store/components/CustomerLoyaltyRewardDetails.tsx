import { useState } from 'react';
import { BadgePercent, CalendarDays, Gift, ImageIcon, Package, ShieldCheck, X, ZoomIn } from 'lucide-react';
import type { CustomerLoyaltyReward } from '@/services/customerService';
import { formatBRL } from '@/utils/pricing';
import { ImageLightbox } from './ImageLightbox';

export interface CustomerLoyaltyRewardDetailsProps {
    reward: CustomerLoyaltyReward;
    availablePoints: number;
    onClose: () => void;
}

export function rewardKindLabel(reward: Pick<CustomerLoyaltyReward, 'type' | 'additionalCashCost'>): string {
    if (reward.type === 'discount') return 'Voucher de desconto';
    if (reward.type === 'free_shipping') return 'Entrega grátis';
    if (reward.type === 'other') return reward.additionalCashCost > 0 ? 'Brinde + dinheiro' : 'Brinde ou prêmio';
    return reward.additionalCashCost > 0 ? 'Produto + dinheiro' : 'Produto por pontos';
}

export function CustomerLoyaltyRewardDetails({ reward, availablePoints, onClose }: CustomerLoyaltyRewardDetailsProps) {
    const [showImage, setShowImage] = useState(false);
    const missing = Math.max(0, reward.pointsCost - availablePoints);
    const eligible = missing === 0;
    const expiration = reward.offerValidUntil ? new Date(reward.offerValidUntil) : null;
    const expirationLabel = expiration && !Number.isNaN(expiration.getTime())
        ? expiration.toLocaleDateString('pt-BR') : null;
    const discountLabel = reward.type === 'discount'
        ? reward.discountPercentage && reward.discountPercentage > 0
            ? `${reward.discountPercentage}% de desconto`
            : reward.discountAmount && reward.discountAmount > 0
                ? `R$ ${formatBRL(reward.discountAmount)} de desconto`
                : 'Desconto conforme as condições do prêmio'
        : null;

    return (
        <>
            <div className="fixed inset-0 z-[165] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}>
                <section role="dialog" aria-modal="true" aria-labelledby="loyalty-prize-title" className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-950 sm:max-w-xl sm:rounded-[2rem]">
                    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                        <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Detalhes do prêmio</p>
                        <button type="button" onClick={onClose} aria-label="Fechar detalhes do prêmio" className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><X className="h-5 w-5" /></button>
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <div className="relative flex h-52 items-center justify-center bg-slate-50 p-3 dark:bg-slate-900 sm:h-72">
                            {reward.imageUrl ? (
                                <button type="button" onClick={() => setShowImage(true)} className="group relative flex h-full w-full items-center justify-center" aria-label={`Ampliar imagem de ${reward.title}`}>
                                    <img src={reward.imageUrl} alt={reward.title} className="max-h-full max-w-full object-contain" />
                                    <span className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-2 text-xs font-bold text-white"><ZoomIn className="h-4 w-4" /> Ampliar foto</span>
                                </button>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-slate-400"><ImageIcon className="h-9 w-9" /><span className="text-xs">Prêmio sem foto cadastrada</span></div>
                            )}
                        </div>
                        <div className="space-y-5 p-5 sm:p-6">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">{rewardKindLabel(reward)}</p>
                                <h2 id="loyalty-prize-title" className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{reward.title}</h2>
                                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{reward.description || 'Consulte as condições deste benefício abaixo.'}</p>
                            </div>
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                                <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Para trocar</p>
                                <p className="mt-1 text-2xl font-black text-amber-800 dark:text-amber-200">{reward.pointsCost.toLocaleString('pt-BR')} pontos</p>
                                {reward.additionalCashCost > 0 && <p className="mt-1 text-base font-black text-slate-800 dark:text-slate-200">+ R$ {formatBRL(reward.additionalCashCost)}</p>}
                                <p className={`mt-3 text-xs font-bold ${eligible ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-200'}`}>{eligible ? 'Seu saldo de pontos atende a este prêmio.' : `Faltam ${missing.toLocaleString('pt-BR')} pontos para este prêmio.`}</p>
                            </div>
                            {discountLabel && (
                                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
                                    <BadgePercent className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                                    <div><p className="font-black text-slate-900 dark:text-white">{discountLabel}</p>
                                        {reward.maxDiscountValue != null && reward.maxDiscountValue > 0 && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Limite de desconto: R$ {formatBRL(reward.maxDiscountValue)}</p>}
                                        {reward.minOrderValue != null && reward.minOrderValue > 0 && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Compra mínima para utilizar: R$ {formatBRL(reward.minOrderValue)}</p>}
                                    </div>
                                </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-2">
                                {reward.type === 'product' && (
                                    <div className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><Package className="h-4 w-4 shrink-0 text-emerald-600" /><div className="text-xs text-slate-600 dark:text-slate-300">Quantidade do produto: <strong>{reward.productQuantity || 1}</strong></div></div>
                                )}
                                {reward.stockQuantity != null && <div className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><Gift className="h-4 w-4 shrink-0 text-emerald-600" /><div className="text-xs text-slate-600 dark:text-slate-300">Disponíveis: <strong>{reward.stockQuantity}</strong></div></div>}
                                {expirationLabel && <div className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" /><div className="text-xs text-slate-600 dark:text-slate-300">Oferta válida até <strong>{expirationLabel}</strong></div></div>}
                                {reward.voucherValidityDays != null && <div className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /><div className="text-xs text-slate-600 dark:text-slate-300">Voucher: <strong>{reward.voucherValidityDays} dia(s)</strong> após emissão</div></div>}
                            </div>
                            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-400">Os pontos, a eventual quantia em dinheiro e o benefício serão confirmados durante o resgate. A emissão de vouchers de troca ainda não está disponível nesta etapa.</p>
                        </div>
                    </div>
                    <footer className="safe-area-bottom shrink-0 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                        <button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">Voltar aos prêmios</button>
                    </footer>
                </section>
            </div>
            {showImage && reward.imageUrl && <ImageLightbox images={[reward.imageUrl]} currentIndex={0} onIndexChange={() => undefined} onClose={() => setShowImage(false)} alt={reward.title} />}
        </>
    );
}
