import { useState, useEffect, useMemo, useCallback } from 'react';
import { ProductPricingHistoryService } from '../services/productPricingHistoryService';
import {
  calculateSalesPricingSummary,
  calculatePurchaseCostSummary,
  calculateEstimatedMargin,
  getDatesForPreset,
} from '../utils/pricingHistoryCalculations';
import type {
  ProductItemPricingSnapshot,
  ProductPurchaseHistoryItem,
  PricingHistoryPeriodPreset,
  PricingHistoryFiltersState,
} from '../../types/productPricingHistory.types';

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
  const [hasTruncatedData, setHasTruncatedData] = useState(false);
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
      setHasTruncatedData(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [salesRes, purchaseRes] = await Promise.all([
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

      setSnapshots(salesRes.data);
      setPurchases(purchaseRes.data);
      setHasTruncatedData(salesRes.hasTruncatedData || purchaseRes.hasTruncatedData);
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
    hasTruncatedData,
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
