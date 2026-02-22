import type { Product } from '@/pages/private/admin/products/products/types/product.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSuccess: () => void;
}

/**
 * PR-3 placeholder.
 * This module is intentionally kept minimal to avoid TypeScript compilation errors
 * when it's not in use. The project continues to use AdminProductEditModal.
 */
export default function ProductFormModal(_props: Props) {
  return null;
}
