/**
 * Sections of the customer's "Minha fidelidade" workspace.
 * Institutional content stays in Loja; enrollment and consent stay in Minha conta.
 */
export const CUSTOMER_LOYALTY_SECTIONS = [
    { id: 'overview', label: 'Resumo' },
    { id: 'points', label: 'Pontos' },
    { id: 'campaigns', label: 'Campanhas' },
    { id: 'rewards', label: 'Prêmios' },
    { id: 'vouchers', label: 'Vouchers' },
] as const;

export type CustomerLoyaltySection = (typeof CUSTOMER_LOYALTY_SECTIONS)[number]['id'];

export interface StampCampaignSettings {
    enable_stamps?: boolean | null;
    min_order_for_stamp?: number | string | null;
    stamps_target?: number | null;
    points_per_stamp_block?: number | null;
}

export interface StampCampaignSummary {
    minimumOrderValue: number;
    targetPurchases: number;
    rewardPoints: number;
}

/** Only returns a configured campaign. No progress or bonus is inferred here. */
export function getStampCampaignSummary(settings?: StampCampaignSettings | null): StampCampaignSummary | null {
    if (!settings?.enable_stamps) return null;
    const minimumOrderValue = Number(settings.min_order_for_stamp);
    const targetPurchases = Number(settings.stamps_target);
    const rewardPoints = Number(settings.points_per_stamp_block);
    if (!Number.isFinite(minimumOrderValue) || minimumOrderValue < 0
        || !Number.isInteger(targetPurchases) || targetPurchases <= 0
        || !Number.isInteger(rewardPoints) || rewardPoints <= 0) return null;
    return { minimumOrderValue, targetPurchases, rewardPoints };
}
