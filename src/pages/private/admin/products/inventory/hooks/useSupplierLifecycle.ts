import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  Supplier360Summary,
  SupplierContactRow,
  SupplierLifecycleData,
  SupplierPriceEvolutionRow,
  SupplierQuotationHistoryRow,
  SupplierPurchaseHistoryRow,
  SupplierRelationshipTimelineRow,
  SupplierSuppliedProductRow,
} from '../types/supplierLifecycle.types';

type UseSupplierLifecycleResult = SupplierLifecycleData & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useSupplierLifecycle(
  supplierId: string | undefined
): UseSupplierLifecycleResult {
  const [summary, setSummary] = useState<Supplier360Summary | null>(null);
  const [purchases, setPurchases] = useState<SupplierPurchaseHistoryRow[]>([]);
  const [products, setProducts] = useState<SupplierSuppliedProductRow[]>([]);
  const [prices, setPrices] = useState<SupplierPriceEvolutionRow[]>([]);
  const [quotations, setQuotations] = useState<SupplierQuotationHistoryRow[]>([]);
  const [timeline, setTimeline] = useState<SupplierRelationshipTimelineRow[]>([]);
  const [contacts, setContacts] = useState<SupplierContactRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supplierId) {
      setSummary(null);
      setPurchases([]);
      setProducts([]);
      setPrices([]);
      setQuotations([]);
      setTimeline([]);
      setContacts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        summaryResult,
        purchasesResult,
        productsResult,
        pricesResult,
        quotationsResult,
        timelineResult,
        contactsResult,
      ] = await Promise.all([
        supabase.rpc('get_supplier_360_summary', {
          p_supplier_id: supplierId,
        }),
        supabase.rpc('get_supplier_purchase_history', {
          p_supplier_id: supplierId,
          p_limit: 100,
        }),
        supabase.rpc('get_supplier_supplied_products', {
          p_supplier_id: supplierId,
          p_limit: 200,
        }),
        supabase.rpc('get_supplier_price_evolution', {
          p_supplier_id: supplierId,
          p_product_id: null,
          p_limit: 300,
        }),
        supabase.rpc('get_supplier_quotation_history', {
          p_supplier_id: supplierId,
          p_limit: 100,
        }),
        supabase.rpc('get_supplier_relationship_timeline', {
          p_supplier_id: supplierId,
          p_limit: 100,
        }),
        supabase.rpc('get_supplier_contacts', {
          p_supplier_id: supplierId,
        }),
      ]);

      const firstError =
        summaryResult.error ||
        purchasesResult.error ||
        productsResult.error ||
        pricesResult.error ||
        quotationsResult.error ||
        timelineResult.error ||
        contactsResult.error;

      if (firstError) {
        throw firstError;
      }

      setSummary((summaryResult.data?.[0] ?? null) as Supplier360Summary | null);
      setPurchases((purchasesResult.data ?? []) as SupplierPurchaseHistoryRow[]);
      setProducts((productsResult.data ?? []) as SupplierSuppliedProductRow[]);
      setPrices((pricesResult.data ?? []) as SupplierPriceEvolutionRow[]);
      setQuotations((quotationsResult.data ?? []) as SupplierQuotationHistoryRow[]);
      setTimeline((timelineResult.data ?? []) as SupplierRelationshipTimelineRow[]);
      setContacts((contactsResult.data ?? []) as SupplierContactRow[]);
    } catch (err: any) {
      console.error('Erro ao carregar Vida do Fornecedor:', err);
      setError(err?.message ?? 'Erro ao carregar Vida do Fornecedor.');
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    summary,
    purchases,
    products,
    prices,
    quotations,
    timeline,
    contacts,
    loading,
    error,
    refresh,
  };
}
