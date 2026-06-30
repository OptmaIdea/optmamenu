import { Plus } from 'lucide-react';

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

  return (
    <div
      onClick={() => onAdd(product.id)}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border p-4 transition duration-200 cursor-pointer ${
        quantityInCart > 0
          ? 'border-[#19A999] bg-[#19A999]/5 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
      }`}
    >
      {quantityInCart > 0 && (
        <span className="absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#19A999] px-1.5 text-xs font-bold text-white">
          {quantityInCart}
        </span>
      )}

      <div className="space-y-1 pr-6">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {categoryName}
        </span>
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-[#19A999] dark:text-white dark:group-hover:text-[#19A999]">
          {product.name}
        </h3>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {formatCurrency(Number(product.price || 0))}
          </span>
          {hasQtyDiscount && (
            <span className="ml-1.5 block text-[10px] font-semibold text-[#7B2D8E]">
              Preço atacado disponível
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(product.id);
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
            quantityInCart > 0
              ? 'bg-[#19A999] text-white hover:bg-[#14887B]'
              : 'bg-gray-100 text-gray-600 hover:bg-[#19A999] hover:text-white dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-[#19A999]'
          }`}
          aria-label={`Adicionar ${product.name} ao carrinho`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
