import { describe, expect, it } from 'vitest';
import { CUSTOMER_LOYALTY_SECTIONS, getStampCampaignSummary } from './customerLoyaltySections';

describe('customer loyalty workspace', () => {
    it('keeps enrollment and institutional marketing outside the loyalty workspace', () => {
        expect(CUSTOMER_LOYALTY_SECTIONS.map((tab) => tab.id)).toEqual([
            'overview', 'points', 'campaigns', 'rewards', 'vouchers',
        ]);
    });
    it('shows stamp terms only for a valid configured campaign', () => {
        expect(getStampCampaignSummary({
            enable_stamps: true,
            min_order_for_stamp: '13.00',
            stamps_target: 10,
            points_per_stamp_block: 5,
        })).toEqual({ minimumOrderValue: 13, targetPurchases: 10, rewardPoints: 5 });
    });
    it('does not invent campaign progress when disabled or missing configuration', () => {
        expect(getStampCampaignSummary({ enable_stamps: false, min_order_for_stamp: 20, stamps_target: 10, points_per_stamp_block: 50 })).toBeNull();
        expect(getStampCampaignSummary({ enable_stamps: true, stamps_target: 0, points_per_stamp_block: 5 })).toBeNull();
    });
});
