import { useState, useEffect, useMemo, useCallback } from 'react';
import { ProductPricingHistoryService } from '../services/productPricingHistoryService';
import {
  calculateSalesPricingSummary,
  calculatePurchaseCostSummary,
  calculateEstimatedMargin,
} from '../utils/pricingHistoryCalculations';
import type {
  ProductItemPricingSnapshot,
  ProductPurchaseHistoryItem,
  PricingHistoryPeriodPreset,
  PricingHistoryFiltersState,
} from '../../types/productPricingHistory.types';

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDatesForPreset(preset: PricingHistoryPeriodPreset): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const endDate = getLocalDateString(now);

  if (preset === 'today') {
    return { startDate: endDate, endDate };
  }

  if (preset === 'last_7_days') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { startDate: getLocalDateString(start), endDate };
  }

  if (preset === 'last_30_days') {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    return { startDate: getLocalDateString(start), endDate };
  }

  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: getLocalDateString(start), endDate };
  }

  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: getLocalDateString(start), endDate: getLocalDateString(end) };
  }

  return { startDate: endDate, endDate };
}

export function useProductPricingHistory(productId?: string) {
  const [filters, setFilters] = useState<PricingHistoryFiltersState>(() => {
    const initialDates = getDatesForPreset('last_30_days');
    return {
      periodPreset: 'last_30_days',
      startDate: initialDates.startDate,
      endDate: initialDates.endDate,
      salesChannel: 'all',
      pricingSource: 'all',
    };
  });

  const [snapshots, setSnapshots] = useState<ProductItemPricingSnapshot[]>([]);
  const [purchases, setPurchases] = useState<ProductPurchaseHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setPeriodPreset = useCallback((preset: PricingHistoryPeriodPreset) => {
    if (preset === 'custom') {
      setFilters((prev: PricingHistoryFiltersState) => ({ ...prev, periodPreset: 'custom' }));
      return;
    }
    const dates = getDatesForPreset(preset);
    setFilters((prev: PricingHistoryFiltersState) => ({
      ...prev,
      periodPreset: preset,
      startDate: dates.startDate,
      endDate: dates.endDate,
    }));
  }, []);

  const setCustomDates = useCallback((start: string, end: string) => {
    setFilters((prev: PricingHistoryFiltersState) => ({
      ...prev,
      periodPreset: 'custom',
      startDate: start,
      endDate: end,
    }));
  }, []);

  const setSalesChannel = useCallback((channel: string) => {
    setFilters((prev: PricingHistoryFiltersState) => ({ ...prev, salesChannel: channel }));
  }, []);

  const setPricingSource = useCallback((source: string) => {
    setFilters((prev: PricingHistoryFiltersState) => ({ ...prev, pricingSource: source }));
  }, []);

  const refetch = useCallback(async () => {
    if (!productId) {
      setSnapshots([]);
      setPurchases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [salesData, purchaseData] = await Promise.all([
        ProductPricingHistoryService.fetchSalesSnapshots({
          productId,
          startDate: filters.startDate,
          endDate: filters.endDate,
          salesChannel: filters.salesChannel,
          pricingSource: filters.pricingSource,
        }),
        ProductPricingHistoryService.fetchPurchaseHistory({
          productId,
          startDate: filters.startDate,
          endDate: filters.endDate,
        }),
      ]);

      setSnapshots(salesData);
      setPurchases(purchaseData);
    } catch (err: unknown) {
      console.error('Erro ao carregar histórico de preços e compras:', err);
      const msg = err instanceof Error ? err.message : 'Não foi possível carregar os dados históricos.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [productId, filters.startDate, filters.endDate, filters.salesChannel, filters.pricingSource]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Agregados calculados sob demanda
  const { summary: salesSummary, bySource } = useMemo(
    () => calculateSalesPricingSummary(snapshots),
    [snapshots]
  );

  const purchaseSummary = useMemo(
    () => calculatePurchaseCostSummary(purchases),
    [purchases]
  );

  const marginSummary = useMemo(
    () =>
      calculateEstimatedMargin(
        salesSummary.overall_weighted_average_effective_price,
        purchaseSummary.weighted_average_purchase_cost
      ),
    [salesSummary.overall_weighted_average_effective_price, purchaseSummary.weighted_average_purchase_cost]
  );

  return {
    filters,
    snapshots,
    purchases,
    loading,
    error,
    salesSummary,
    bySource,
    purchaseSummary,
    marginSummary,
    setPeriodPreset,
    setCustomDates,
    setSalesChannel,
    setPricingSource,
    refetch,
  };
}
