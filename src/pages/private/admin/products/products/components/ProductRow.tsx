import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  CheckCircle,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import type { Product } from '../types/product.types';
import ProductThumb from '@/pages/private/admin/products/products/components/ProductThumb';

interface ProductRowProps {
  product: Product;
  onActionClick: (productId: string) => void;
  deletingId: string | null;
}

export default function ProductRow({ product, onActionClick, deletingId }: ProductRowProps) {
  const onHand = product.display_on_hand ?? product.stock_quantity ?? 0;
  const reserved = product.display_reserved ?? 0;
  const available = product.display_available ?? product.stock_quantity ?? 0;

  const getInventoryStatus = (p: Product) => {
    const currentAvailable = p.display_available ?? p.stock_quantity ?? 0;
    const currentOnHand = p.display_on_hand ?? p.stock_quantity ?? 0;

    if (!p.active) return 'inactive';
    if (currentAvailable <= 0) return 'zero';
    if (currentAvailable <= p.min_stock) return 'low';
    if (currentOnHand > p.max_stock) return 'high';
    return 'normal';
  };

  const stockStatus = getInventoryStatus(product);

  let rowBgClass = '';
  if (!product.active) {
    rowBgClass =
      'bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/80 dark:hover:bg-gray-700/50';
  } else if (stockStatus === 'zero') {
    rowBgClass =
      'bg-red-50/80 dark:bg-red-950/20 hover:bg-red-100/80 dark:hover:bg-red-900/30';
  } else if (stockStatus === 'low') {
    rowBgClass =
      'bg-yellow-50/80 dark:bg-yellow-950/20 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30';
  } else if (stockStatus === 'high') {
    rowBgClass =
      'bg-purple-50/80 dark:bg-purple-950/20 hover:bg-purple-100/80 dark:hover:bg-purple-900/30';
  } else {
    rowBgClass = 'hover:bg-gray-50 dark:hover:bg-gray-700/30';
  }

  const stickyBgClass = !product.active
    ? 'lg:bg-gray-50 lg:dark:bg-gray-800'
    : stockStatus === 'zero'
    ? 'lg:bg-red-50 lg:dark:bg-red-900/30'
    : stockStatus === 'low'
    ? 'lg:bg-yellow-50 lg:dark:bg-yellow-900/30'
    : stockStatus === 'high'
    ? 'lg:bg-purple-50 lg:dark:bg-purple-900/30'
    : 'lg:bg-white lg:dark:bg-gray-800';

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(product.price);

  return (
    <tr className={`transition-colors ${rowBgClass}`}>
      <td
        className={`
          px-4 py-2.5
          lg:sticky lg:left-0 lg:z-20
          ${stickyBgClass}
          lg:shadow-[6px_0_10px_-10px_rgba(0,0,0,0.25)]
          lg:before:content-['']
          lg:before:absolute lg:before:top-0 lg:before:right-0 lg:before:h-full lg:before:w-px
          lg:before:bg-gray-200 lg:dark:before:bg-gray-700
        `}
      >
        <div className="flex items-center gap-3">
          <ProductThumb product={product} />
          <div className="min-w-0">
            <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
              {product.name}
            </div>
            {product.category?.name && (
              <div className="text-xs text-gray-400 italic mt-0.5 truncate max-w-[200px]">
                {product.category.name}
              </div>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-2.5">
        <div className="flex flex-col items-center sm:items-start">
          {!product.active ? (
            <span className="font-medium text-gray-500 dark:text-gray-400">-</span>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-900 dark:text-white">
                  {available}
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
              </div>

              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Físico {onHand} • Reservado {reserved}
              </span>
            </>
          )}
        </div>
      </td>

      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
        {formattedPrice}
      </td>

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