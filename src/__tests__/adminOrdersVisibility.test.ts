import { describe, expect, it } from 'vitest';
import { CURRENT_ORDER_STATUSES, isCurrentOrderStatus } from '@/utils/adminOrderVisibility';

describe('admin order visibility', () => {
    it('treats all in-progress statuses as current, including delivery in progress', () => {
        for (const status of CURRENT_ORDER_STATUSES) {
            expect(isCurrentOrderStatus(status)).toBe(true);
        }
    });

    it('keeps completed and cancelled orders in history, not current list', () => {
        for (const status of ['completed', 'cancelled', 'expired_auto', 'unknown']) {
            expect(isCurrentOrderStatus(status)).toBe(false);
        }
    });

    it('matches the count of currently visible orders', () => {
        const statuses = ['reserved', 'reserved', 'completed', 'cancelled', 'out_for_delivery'];
        expect(statuses.filter(isCurrentOrderStatus)).toHaveLength(3);
    });
});
