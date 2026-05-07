import { useCallback } from 'react';
import {
  useSuppliers as _useSuppliers,
} from '@/pages/private/admin/products/suppliers/hooks/useSuppliers';
import type { Supplier, SupplierInput } from '../types/supplier.types';

export function useSuppliers() {
  const {
    suppliers,
    loading,
    saving,
    lastUpdated,
    fetchSuppliers,
    upsertSupplier,
    setSupplierActive,
  } = _useSuppliers();

  const refreshSuppliers = useCallback(() => fetchSuppliers(), [fetchSuppliers]);

  const toggleSupplierActive = useCallback(
    (supplier: Supplier) => setSupplierActive(supplier.id, !supplier.active),
    [setSupplierActive],
  );

  const saveSupplier = useCallback(
    (input: SupplierInput, supplierId?: string) => upsertSupplier(input, supplierId),
    [upsertSupplier],
  );

  return {
    suppliers,
    loading,
    saving,
    lastUpdated,
    refreshSuppliers,
    toggleSupplierActive,
    saveSupplier,
  };
}
