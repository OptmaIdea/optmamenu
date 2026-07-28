import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  CheckCircle,
  XCircle,
  Archive,
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
  const onHand = Number(product.display_on_hand ?? 0);
  const reserved = Number(product.display_reserved ?? 0);
  const available = Number(product.display_available ?? 0);

  const getInventoryStatus = (p: Product) => {
    if (p.is_discontinued || !p.active) return 'inactive';
    if (p.global_status === 'global_stockout') return 'zero';
    if (p.global_status === 'global_critical') return 'low';
    if (p.global_status === 'global_attention') return 'attention';
    if (p.global_status === 'global_excess') return 'high';
    return 'normal';
  };

  const stockStatus = getInventoryStatus(product);

  let rowBgClass = '';
  if (product.is_discontinued) {
    rowBgClass =
      'bg-gray-100/70 dark:bg-gray-800/40 opacity-80 hover:bg-gray-100 dark:hover:bg-gray-800/60';
  } else if (!product.active) {
    rowBgClass =
      'bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/80 dark:hover:bg-gray-700/50';
  } else if (stockStatus === 'zero') {
    rowBgClass =
      'bg-red-50/80 dark:bg-red-950/20 hover:bg-red-100/80 dark:hover:bg-red-900/30';
  } else if (stockStatus === 'low') {
    rowBgClass =
      'bg-yellow-50/80 dark:bg-yellow-950/20 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30';
  } else if (stockStatus === 'attention') {
    rowBgClass =
      'bg-amber-50/80 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-900/30';
  } else if (stockStatus === 'high') {
    rowBgClass =
      'bg-purple-50/80 dark:bg-purple-950/20 hover:bg-purple-100/80 dark:hover:bg-purple-900/30';
  } else {
    rowBgClass = 'hover:bg-gray-50 dark:hover:bg-gray-700/30';
  }

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(product.price);

  // Badge de ação gerencial
  const actionMeta = (() => {
    if (product.is_discontinued) {
      return {
        label: 'Descontinuado',
        className: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      };
    }
    switch (product.recommended_action) {
      case 'buy':
        return {
          label: 'Comprar',
          className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        };
      case 'transfer':
      case 'transfer_or_redistribute':
        return {
          label: 'Transferir',
          className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        };
      case 'monitor':
        return {
          label: 'Monitorar',
          className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        };
      case 'review_excess':
        return {
          label: 'Revisar excesso',
          className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
        };
      default:
        return {
          label: 'OK',
          className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        };
    }
  })();

  return (
    <tr className={`transition-colors ${rowBgClass}`}>
      <td
        className="w-[320px] max-w-[320px] px-4 py-2.5"
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
          {product.is_discontinued || !product.active ? (
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
                    aria-label="Estoque crítico"
                  />
                )}
                {stockStatus === 'attention' && (
                  <AlertTriangle
                    size={16}
                    className="text-amber-500 dark:text-amber-400"
                    aria-label="Atenção no estoque"
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

      {/* Coluna Ação Gerencial */}
      <td className="px-4 py-2.5">
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${actionMeta.className}`}
          >
            {actionMeta.label}
          </span>

          {!product.is_discontinued && (product.location_stockout_count ?? 0) > 0 && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {product.location_stockout_count} local(is) sem estoque
            </span>
          )}

          {!product.is_discontinued && (product.possible_source_locations ?? 0) > 0 &&
            (product.recommended_action === 'transfer' ||
              product.recommended_action === 'transfer_or_redistribute') && (
              <span className="text-[11px] text-blue-600 dark:text-blue-300">
                há origem possível
              </span>
            )}
        </div>
      </td>

      <td className="px-4 py-2.5">
        <div className="flex items-center justify-center sm:justify-start">
          {product.is_discontinued ? (
            <div className="flex items-center gap-1.5">
              <Archive
                size={16}
                className="text-purple-600 dark:text-purple-400"
                aria-label="Descontinuado"
              />
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300 hidden sm:inline">
                descontinuado
              </span>
            </div>
          ) : product.active ? (
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
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
