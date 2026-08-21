import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ONLINE_ORDER_SETTINGS,
  normalizeOnlineOrderSettings,
} from '@/services/onlineOrderSettingsService';

describe('homologation baseline: storefront online stock policy', () => {
  it('keeps the launch defaults conservative and explicit', () => {
    expect(DEFAULT_ONLINE_ORDER_SETTINGS.online_stock_local_reserve_default).toBe(0);
    expect(DEFAULT_ONLINE_ORDER_SETTINGS.online_stock_limit_default).toBeNull();
    expect(DEFAULT_ONLINE_ORDER_SETTINGS.online_stock_low_threshold).toBe(5);
    expect(DEFAULT_ONLINE_ORDER_SETTINGS.online_stock_show_exact).toBe(false);
    expect(DEFAULT_ONLINE_ORDER_SETTINGS.online_stock_publish_products_by_default).toBe(true);
  });

  it('normalizes negative stock policy values without allowing negative availability settings', () => {
    const normalized = normalizeOnlineOrderSettings({
      online_stock_local_reserve_default: -8,
      online_stock_limit_default: -3,
      online_stock_low_threshold: -2,
    });

    expect(normalized.online_stock_local_reserve_default).toBe(0);
    expect(normalized.online_stock_limit_default).toBe(0);
    expect(normalized.online_stock_low_threshold).toBe(0);
  });

  it('keeps a missing or blank online limit as unlimited instead of coercing it to zero', () => {
    expect(normalizeOnlineOrderSettings({ online_stock_limit_default: null }).online_stock_limit_default).toBeNull();

    const legacyBlankValue = normalizeOnlineOrderSettings({
      online_stock_limit_default: '' as unknown as number,
    });

    expect(legacyBlankValue.online_stock_limit_default).toBeNull();
  });

  it('coerces truthy/falsey persisted values to booleans consistently', () => {
    const normalized = normalizeOnlineOrderSettings({
      online_stock_show_exact: 1 as unknown as boolean,
      online_stock_publish_products_by_default: 0 as unknown as boolean,
    });

    expect(normalized.online_stock_show_exact).toBe(true);
    expect(normalized.online_stock_publish_products_by_default).toBe(false);
  });
});
