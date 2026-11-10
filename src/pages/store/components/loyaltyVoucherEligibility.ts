import type { CustomerLoyaltyReward } from '@/services/customerService';

export type LoyaltyVoucherEligibility =
    | { supported: true }
    | { supported: false; reason: string };

/** Keep customer affordances consistent with the server's fulfillment trigger. */
export function loyaltyVoucherEligibility(reward: Pick<CustomerLoyaltyReward,
    'type' | 'additionalCashCost' | 'productId' | 'pointsCost'>): LoyaltyVoucherEligibility {
    if (reward.type === 'discount' || reward.type === 'free_shipping') {
        return { supported: false, reason: 'Descontos e frete grátis estarão disponíveis após a integração com os pedidos.' };
    }
    if (reward.additionalCashCost > 0) {
        return { supported: false, reason: 'A troca com valor adicional aguarda a integração financeira.' };
    }
    if (reward.productId) {
        return { supported: false, reason: 'A troca de itens vinculados ao catálogo aguarda a integração de estoque.' };
    }
    if (reward.type !== 'product' && reward.type !== 'other') {
        return { supported: false, reason: 'Esta modalidade ainda não está disponível para troca.' };
    }
    if (!Number.isInteger(reward.pointsCost) || reward.pointsCost < 1) {
        return { supported: false, reason: 'O custo em pontos precisa ser validado pela loja.' };
    }
    return { supported: true };
}
