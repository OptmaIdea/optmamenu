import { useEffect, useState } from 'react';
import {
  getProductOperationalOccurrences,
  type ProductPurchaseReceiptIssue,
  type ProductPhysicalDiscrepancy,
} from '../services/productOperationalOccurrencesService';

/** Consulta somente quando o histórico do produto está visível. Não modifica os registros. */
export function useProductOperationalOccurrences(
  storeId: string | null | undefined,
  productId: string | undefined,
  enabled: boolean,
) {
  const [purchaseIssues, setPurchaseIssues] = useState<ProductPurchaseReceiptIssue[]>([]);
  const [physicalDiscrepancies, setPhysicalDiscrepancies] = useState<ProductPhysicalDiscrepancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !storeId || !productId) {
      setPurchaseIssues([]);
      setPhysicalDiscrepancies([]);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setPurchaseIssues([]);
    setPhysicalDiscrepancies([]);
    setError(null);
    void getProductOperationalOccurrences(storeId, productId)
      .then((result) => {
        if (!active) return;
        setPurchaseIssues(result.purchaseIssues);
        setPhysicalDiscrepancies(result.physicalDiscrepancies);
      })
      .catch((cause) => {
        if (!active) return;
        console.error('Falha ao consultar ocorrências do produto:', cause);
        setError('Não foi possível carregar as divergências de compras e estoque. Os demais movimentos continuam disponíveis.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [enabled, productId, storeId]);

  return { purchaseIssues, physicalDiscrepancies, loading, error };
}
