import { Plus, Package } from 'lucide-react';

export interface PriceRule {
  min?: number;
  price?: number;
}

export interface ProductOption {
  id: string;
  name: string;
  price: number | null;
  category_id: string | null;
  use_category_pricing?: boolean | null;
  price_rules?: PriceRule[] | null;
  images?: string[] | null;
  categories?: {
    name?: string | null;
    price_rules?: PriceRule[] | null;
  } | null;
}

interface QuickPosProductCardProps {
  product: ProductOption;
  quantityInCart: number;
  onAdd: (productId: string) => void;
  formatCurrency: (value: number) => string;
}

export default function QuickPosProductCard({
  product,
  quantityInCart,
  onAdd,
  formatCurrency,
}: QuickPosProductCardProps) {
  const categoryName = product.categories?.name || 'Sem categoria';
  const hasQtyDiscount =
    (product.price_rules && product.price_rules.length > 0) ||
    (product.use_category_pricing && product.categories?.price_rules && product.categories.price_rules.length > 0);

  const imageUrl = product.images && product.images.length > 0 ? product.images[0] : null;

  return (
    <div
      onClick={() => onAdd(product.id)}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border transition duration-200 cursor-pointer ${
        quantityInCart > 0
          ? 'border-[#19A999] bg-[#19A999]/5 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
      }`}
    >
      {imageUrl ? (
        <div className="w-full h-24 overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
          />
          {quantityInCart > 0 && (
            <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#19A999] px-1 text-[10px] font-bold text-white shadow-md">
              {quantityInCart}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full h-14 bg-gray-50 dark:bg-gray-800/30 flex items-center justify-center text-gray-300 dark:text-gray-600 relative">
          <Package size={20} />
          {quantityInCart > 0 && (
            <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#19A999] px-1 text-[10px] font-bold text-white shadow-md">
              {quantityInCart}
            </span>
          )}
        </div>
      )}

      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
            {categoryName}
          </span>
          <h3 className="line-clamp-2 text-xs font-semibold text-gray-900 group-hover:text-[#19A999] dark:text-white dark:group-hover:text-[#19A999] leading-tight">
            {product.name}
          </h3>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-white block">
              {formatCurrency(Number(product.price || 0))}
            </span>
            {hasQtyDiscount && (
              <span className="text-[9px] font-semibold text-[#7B2D8E] block">
                Atacado disponível
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(product.id);
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition shrink-0 ${
              quantityInCart > 0
                ? 'bg-[#19A999] text-white hover:bg-[#14887B]'
                : 'bg-gray-100 text-gray-600 hover:bg-[#19A999] hover:text-white dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-[#19A999]'
            }`}
            aria-label={`Adicionar ${product.name} ao carrinho`}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
