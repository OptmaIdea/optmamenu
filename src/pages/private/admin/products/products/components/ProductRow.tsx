import { AlertCircle, AlertTriangle, ArrowUp, CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import type { Product } from '../types/product.types';
import ProductThumb from '@/pages/private/admin/products/products/components/ProductThumb';

interface ProductRowProps {
  product: Product;
  onActionClick: (productId: string) => void;
  deletingId: string | null;
}

export default function ProductRow({ product, onActionClick, deletingId }: ProductRowProps) {
  // Determine stock status
  const getInventoryStatus = (p: Product) => {
    if (!p.active) return 'inactive';
    if (p.stock_quantity === 0) return 'zero';
    if (p.stock_quantity <= p.min_stock) return 'low';
    if (p.stock_quantity > p.max_stock) return 'high';
    return 'normal';
  };[{
    "resource": "/d:/optmamenusys/src/pages/private/admin/products/products/hooks/useModals.ts",
    "owner": "typescript",
    "code": "6133",
    "severity": 4,
    "message": "'inactiveProducts' is declared but its value is never read.",
    "source": "ts",
    "startLineNumber": 29,
    "startColumn": 15,
    "endLineNumber": 29,
    "endColumn": 31,
    "tags": [
      1
    ],
    "origin": "extHost1"
  }]

  const stockStatus = getInventoryStatus(product);

  // Row background based on status
  let rowBgClass = '';
  if (!product.active) {
    rowBgClass = 'bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/80 dark:hover:bg-gray-700/50';
  } else if (stockStatus === 'zero') {
    rowBgClass = 'bg-red-50/80 dark:bg-red-950/20 hover:bg-red-100/80 dark:hover:bg-red-900/30';
  } else if (stockStatus === 'low') {
    rowBgClass = 'bg-yellow-50/80 dark:bg-yellow-950/20 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30';
  } else if (stockStatus === 'high') {
    rowBgClass = 'bg-purple-50/80 dark:bg-purple-950/20 hover:bg-purple-100/80 dark:hover:bg-purple-900/30';
  } else {
    rowBgClass = 'hover:bg-gray-50 dark:hover:bg-gray-700/30';
  }

  // Format price
  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(product.price);

  return (
    <tr className={`transition-colors ${rowBgClass}`}>
      {/* Product column - sticky on mobile */}
      <td
        className="
    px-4 py-2.5
    sticky left-0 z-30            /* ← z-30 para ficar acima de outros elementos */
    bg-inherit                   /* ← herda a cor de fundo da linha */
    before:content-['']          /* ← borda direita simulada */
    before:absolute before:top-0 before:right-0 before:h-full before:w-px
    before:bg-gray-200 dark:before:bg-gray-700
    md:static md:before:hidden   /* ← desliga no desktop */
  "
      >
        <div className="flex items-center gap-3">
          <ProductThumb product={product} />
          <div className="min-w-0">
            <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
              {product.name}
            </div>
            {/*             {product.description && (
              <div className="text-xs text-gray-500 truncate max-w-[200px]">
                {product.description}
              </div>
            )} */}
            {product.category?.name && (
              <div className="text-xs text-gray-400 italic mt-0.5 truncate max-w-[200px]">
                {product.category.name}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Stock column */}
      <td className="px-4 py-2.5 ">
        <div className="flex items-center gap-1.5 justify-center sm:justify-start">
          {!product.active ? (
            <span className="font-medium text-gray-500 dark:text-gray-400">-</span>
          ) : (
            <>
              <span className="font-medium text-gray-900 dark:text-white">
                {product.stock_quantity ?? 0}
              </span>
              {stockStatus === 'zero' && (
                <AlertCircle
                  size={16}
                  className="text-red-600 dark:text-red-400"
                  aria-label="Estoque zerado"
                />
              )}
              {stockStatus === 'low' && (
                <AlertTriangle
                  size={16}
                  className="text-yellow-600 dark:text-yellow-400"
                  aria-label="Estoque baixo"
                />
              )}
              {stockStatus === 'high' && (
                <ArrowUp
                  size={16}
                  className="text-purple-600 dark:text-purple-400"
                  aria-label="Excesso de estoque"
                />
              )}
            </>
          )}
        </div>
      </td>

      {/* Price column */}
      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
        {formattedPrice}
      </td>

      {/* Status column */}
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-center sm:justify-start">
          {product.active ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle
                size={16}
                className="text-green-600 dark:text-green-400"
                aria-label="Ativo"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                ativo
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <XCircle
                size={16}
                className="text-gray-400 dark:text-gray-500"
                aria-label="Inativo"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                inativo
              </span>
            </div>
          )}
        </div>
      </td>

      {/* Actions column */}
      <td className="px-4 py-2.5 text-right">
        <button
          onClick={() => onActionClick(product.id)}
          disabled={deletingId === product.id}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Ações do produto"
        >
          {deletingId === product.id ? (
            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <MoreVertical size={16} />
          )}
        </button>
      </td>
    </tr>
  );
}