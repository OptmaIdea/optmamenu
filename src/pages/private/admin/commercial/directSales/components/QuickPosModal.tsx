import { useState, useMemo } from 'react';
import { X, Search, ShoppingCart, Info, CheckCircle2 } from 'lucide-react';
import type { CustomerListItem } from '@/services/customers360Service';
import QuickPosProductCard, { type ProductOption } from './QuickPosProductCard';
import QuickPosCartSheet from './QuickPosCartSheet';
import type { PaymentMethodOption } from '../DirectSalesPage';

interface CartLine {
  productId: string;
  quantity: number;
  originalUnitPrice: number;
  unitPrice: number;
  manualDiscount: number;
  pricingSource: string;
  priceRule: any;
}

interface QuickPosModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductOption[];
  customers: CustomerListItem[];
  paymentMethods: PaymentMethodOption[];
  cart: CartLine[];
  totals: {
    grossSubtotal: number;
    quantityDiscount: number;
    additionalDiscount: number;
    total: number;
  };
  selectedCustomerId: string;
  customerName: string;
  customerPhone: string;
  paymentMethodCode: string;
  submitting: boolean;
  lastOrderCode: string | null;
  onAddProduct: (productId: string) => void;
  onChangeQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onEditAdditionalDiscount: (index: number) => void;
  onZerarAdditionalDiscount: (index: number) => void;
  onSelectCustomer: (customerId: string) => void;
  onChangeCustomerName: (name: string) => void;
  onChangeCustomerPhone: (phone: string) => void;
  onChangePaymentMethod: (code: string) => void;
  onSubmitSale: () => Promise<void>;
  formatCurrency: (value: number) => string;
}

type ModeType = 'balcao' | 'mesa' | 'retirada';
type SortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'category_asc';

const getProductCategoryName = (product: ProductOption) =>
  (product as any).categories?.name || 'Sem categoria';

const normalizeSearch = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export default function QuickPosModal({
  isOpen,
  onClose,
  products,
  customers,
  paymentMethods,
  cart,
  totals,
  selectedCustomerId,
  customerName,
  customerPhone,
  paymentMethodCode,
  submitting,
  lastOrderCode,
  onAddProduct,
  onChangeQuantity,
  onRemoveItem,
  onEditAdditionalDiscount,
  onZerarAdditionalDiscount,
  onSelectCustomer,
  onChangeCustomerName,
  onChangeCustomerPhone,
  onChangePaymentMethod,
  onSubmitSale,
  formatCurrency,
}: QuickPosModalProps) {
  const [activeMode, setActiveMode] = useState<ModeType>('balcao');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  const [isCartOpen, setIsCartOpen] = useState(false);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Extract categories dynamically
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const name = getProductCategoryName(p);
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const search = normalizeSearch(searchQuery);

    return products
      .filter((product) => {
        const categoryName = getProductCategoryName(product);
        const matchesSearch =
          !search || normalizeSearch(`${product.name} ${categoryName}`).includes(search);
        const matchesCategory = selectedCategory === 'all' || categoryName === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortOption === 'name_desc') {
          return b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' });
        }
        if (sortOption === 'price_asc') {
          return Number(a.price || 0) - Number(b.price || 0);
        }
        if (sortOption === 'price_desc') {
          return Number(b.price || 0) - Number(a.price || 0);
        }
        if (sortOption === 'category_asc') {
          const catA = getProductCategoryName(a);
          const catB = getProductCategoryName(b);
          const comp = catA.localeCompare(catB, 'pt-BR', { sensitivity: 'base' });
          if (comp !== 0) return comp;
        }
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
  }, [products, searchQuery, selectedCategory, sortOption]);

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Cart quantity map for product cards
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => {
      map.set(item.productId, item.quantity);
    });
    return map;
  }, [cart]);

  const handleModeChange = (mode: ModeType) => {
    if (mode !== 'balcao') {
      // Mesa & Retirada are placeholders for now (show "Em breve" style or ignore)
      return;
    }
    setActiveMode(mode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F8F6F2] dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100">
      {/* Top Navbar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-xs dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Fechar PDV Rápido"
          >
            <X size={20} />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
              PDV Rápido
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Modo Balcão Operacional
            </p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
          <button
            onClick={() => handleModeChange('balcao')}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
              activeMode === 'balcao'
                ? 'bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Balcão
          </button>
          <div className="relative group">
            <button
              disabled
              className="rounded-md px-3 py-1 text-xs font-semibold text-gray-400 cursor-not-allowed flex items-center gap-1"
            >
              Mesa <span className="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 px-1 rounded">breve</span>
            </button>
          </div>
          <button
            disabled
            className="rounded-md px-3 py-1 text-xs font-semibold text-gray-400 cursor-not-allowed flex items-center gap-1"
          >
            Retirada <span className="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 px-1 rounded">breve</span>
          </button>
        </div>

        {/* Cart Toggle button on Header (Desktop/Tablet) */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-[#19A999]/10 text-[#19A999] hover:bg-[#19A999]/20 transition"
          aria-label="Abrir Carrinho"
        >
          <ShoppingCart size={20} />
          {cartItemsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F1613A] px-1 text-[10px] font-bold text-white">
              {cartItemsCount}
            </span>
          )}
        </button>
      </header>

      {/* Filter and Category Area */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute top-2.5 left-3 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por produto ou categoria..."
              className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pr-4 pl-10 text-sm focus:border-[#19A999] focus:bg-white focus:ring-1 focus:ring-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>

          {/* Sort selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Ordenar por:</span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="name_asc">Nome A-Z</option>
              <option value="name_desc">Nome Z-A</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
              <option value="category_asc">Categoria</option>
            </select>
          </div>
        </div>

        {/* Categories Chips */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              selectedCategory === 'all'
                ? 'bg-[#19A999] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                selectedCategory === cat
                  ? 'bg-[#19A999] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main product area */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {lastOrderCode && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={20} />
            <span>
              Venda concluída com sucesso! Pedido gerado:{' '}
              <strong className="font-mono">{lastOrderCode}</strong>
            </span>
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
            <Info size={36} className="mb-2 text-gray-400" />
            <p className="text-sm">Nenhum produto correspondente aos filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredProducts.map((product) => (
              <QuickPosProductCard
                key={product.id}
                product={product}
                quantityInCart={cartQuantities.get(product.id) || 0}
                onAdd={onAddProduct}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar (visible when items in cart) */}
      {cartItemsCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between rounded-xl bg-gray-900 p-4 shadow-lg text-white md:left-auto md:right-4 md:w-80">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
              <ShoppingCart size={18} />
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F1613A] px-1 text-[9px] font-bold text-white">
                {cartItemsCount}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Total acumulado</p>
              <p className="text-sm font-bold text-[#19A999]">{formatCurrency(totals.total)}</p>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="rounded-lg bg-[#19A999] px-4 py-2 text-xs font-semibold hover:bg-[#14887B] transition"
          >
            Ver Carrinho
          </button>
        </div>
      )}

      {/* Cart Sidebar Sheet */}
      <QuickPosCartSheet
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        productMap={productMap}
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        customerName={customerName}
        customerPhone={customerPhone}
        paymentMethodCode={paymentMethodCode}
        paymentMethods={paymentMethods}
        submitting={submitting}
        totals={totals}
        onChangeQuantity={onChangeQuantity}
        onRemoveItem={onRemoveItem}
        onEditAdditionalDiscount={onEditAdditionalDiscount}
        onZerarAdditionalDiscount={onZerarAdditionalDiscount}
        onSelectCustomer={onSelectCustomer}
        onChangeCustomerName={onChangeCustomerName}
        onChangeCustomerPhone={onChangeCustomerPhone}
        onChangePaymentMethod={onChangePaymentMethod}
        onSubmitSale={async () => {
          await onSubmitSale();
          // Keep screen ready, show last order code, don't close unless they press close
        }}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
