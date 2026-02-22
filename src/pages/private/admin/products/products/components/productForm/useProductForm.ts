import type { Product } from '@/pages/private/admin/products/products/types/product.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useProductFormRHF = (_product?: Product | null): any => {
  return {
    control: undefined,
    handleSubmit: (fn: any) => fn,
    reset: () => undefined,
  };
};
