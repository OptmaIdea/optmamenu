import { X, Trash2, User, CreditCard, ChevronRight } from 'lucide-react';
import type { CustomerListItem } from '@/services/customers360Service';
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

interface ProductOption {
  id: string;
  name: string;
  price: number | null;
  category_id: string | null;
  use_category_pricing?: boolean | null;
}

interface QuickPosCartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartLine[];
  productMap: Map<string, ProductOption>;
  customers: CustomerListItem[];
  selectedCustomerId: string;
  customerName: string;
  customerPhone: string;
  paymentMethodCode: string;
  paymentMethods: PaymentMethodOption[];
  submitting: boolean;
  totals: {
    grossSubtotal: number;
    quantityDiscount: number;
    additionalDiscount: number;
    total: number;
  };
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

export default function QuickPosCartSheet({
  isOpen,
  onClose,
  cart,
  productMap,
  customers,
  selectedCustomerId,
  customerName,
  customerPhone,
  paymentMethodCode,
  paymentMethods,
  submitting,
  totals,
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
}: QuickPosCartSheetProps) {
  if (!isOpen) return null;

  const handleQuantityClick = (index: number) => {
    const item = cart[index];
    if (!item) return;

    const product = productMap.get(item.productId);
    const productName = product?.name || 'o produto';

    const response = window.prompt(`Digite a nova quantidade para ${productName}:`, String(item.quantity));
    if (response === null) return;

    const nextQty = parseInt(response, 10);
    if (Number.isNaN(nextQty) || nextQty < 0) {
      alert('Por favor, digite um número inteiro maior ou igual a 0.');
      return;
    }

    if (nextQty === 0) {
      const confirmRemove = window.confirm(`Deseja realmente remover "${productName}" do carrinho?`);
      if (confirmRemove) {
        onRemoveItem(index);
      }
      return;
    }

    const delta = nextQty - item.quantity;
    if (delta !== 0) {
      onChangeQuantity(index, delta);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      {/* Background overlay click closes on mobile if wanted, or just button */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="flex h-full w-full flex-col bg-[#F8F6F2] shadow-xl md:max-w-md dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Carrinho</h2>
            <span className="rounded-full bg-[#19A999]/10 px-2.5 py-0.5 text-xs font-semibold text-[#19A999]">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} {cart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Voltar para produtos"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Cart Items */}
          <div className="space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum item no carrinho.</p>
                <button
                  onClick={onClose}
                  className="mt-3 text-xs font-semibold text-[#19A999] hover:underline"
                >
                  Adicionar produtos
                </button>
              </div>
            ) : (
              cart.map((item, index) => {
                const product = productMap.get(item.productId);
                const hasUnitDiscount = item.unitPrice !== item.originalUnitPrice;
                const lineTotal = Math.max(item.quantity * item.unitPrice - item.manualDiscount, 0);

                return (
                  <div
                    key={item.productId}
                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-950"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {product?.name || 'Produto carregando...'}
                        </h4>
                        <div className="mt-1 space-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                          <div>
                            Unitário:{' '}
                            {hasUnitDiscount ? (
                              <>
                                <span className="line-through text-gray-400">
                                  {formatCurrency(item.originalUnitPrice)}
                                </span>{' '}
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {formatCurrency(item.unitPrice)}
                                </span>
                              </>
                            ) : (
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(item.unitPrice)}
                              </span>
                            )}
                          </div>
                          {item.manualDiscount > 0 && (
                            <div className="text-amber-600 dark:text-amber-400">
                              Desconto adicional: -{formatCurrency(item.manualDiscount)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(lineTotal)}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-900">
                      {/* Quantity Controls */}
                      <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() => onChangeQuantity(index, -1)}
                          className="px-2.5 py-1 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900"
                        >
                          −
                        </button>
                        <span
                          onClick={() => handleQuantityClick(index)}
                          className="min-w-[28px] text-center text-xs font-bold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1.5 py-0.5"
                          title="Clique para digitar a quantidade"
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeQuantity(index, 1)}
                          className="px-2.5 py-1 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900"
                        >
                          +
                        </button>
                      </div>

                      {/* Action Links */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onEditAdditionalDiscount(index)}
                          className="text-[11px] font-semibold text-[#19A999] hover:underline"
                        >
                          Desc.
                        </button>
                        {item.manualDiscount > 0 && (
                          <button
                            type="button"
                            onClick={() => onZerarAdditionalDiscount(index)}
                            className="text-[11px] font-semibold text-amber-600 hover:underline"
                          >
                            Zerar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemoveItem(index)}
                          className="text-red-500 hover:text-red-600 dark:text-red-400"
                          aria-label="Remover item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Client Selection */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <User size={14} className="text-[#19A999]" />
              <span>Cliente</span>
            </div>

            <label className="block">
              <select
                value={selectedCustomerId}
                onChange={(e) => onSelectCustomer(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              >
                <option value="">Cliente de balcão (Padrão)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || 'Sem nome'}{c.phone ? ` — ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </label>

            {!selectedCustomerId && (
              <div className="rounded-lg bg-gray-50 p-2.5 text-[11px] leading-relaxed text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                Vendas de balcão não exigem telefone e ficam vinculadas ao cliente operacional padrão.
              </div>
            )}

            {/* Editable name & phone if balcão */}
            <div className="space-y-2">
              <input
                value={customerName}
                onChange={(e) => onChangeCustomerName(e.target.value)}
                readOnly={Boolean(selectedCustomerId)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm read-only:bg-gray-100 read-only:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Nome do cliente (opcional)"
              />
              <input
                value={customerPhone}
                onChange={(e) => onChangeCustomerPhone(e.target.value)}
                readOnly={Boolean(selectedCustomerId)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm read-only:bg-gray-100 read-only:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Telefone do cliente (opcional)"
              />
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <CreditCard size={14} className="text-[#19A999]" />
              <span>Forma de Pagamento</span>
            </div>

            <select
              value={paymentMethodCode}
              onChange={(e) => onChangePaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#19A999] focus:ring-1 focus:ring-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="pending">A combinar / Pagamento posterior</option>
              {paymentMethods.map((method) => (
                <option key={method.code} value={method.code}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer with breakdown & checkout */}
        <div className="border-t border-gray-200 bg-white p-4 space-y-3 dark:border-gray-800 dark:bg-gray-950">
          <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Subtotal bruto</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {formatCurrency(totals.grossSubtotal)}
              </span>
            </div>
            {totals.quantityDiscount > 0 && (
              <div className="flex justify-between text-[#7B2D8E]">
                <span>Desconto por quantidade</span>
                <span className="font-semibold">
                  -{formatCurrency(totals.quantityDiscount)}
                </span>
              </div>
            )}
            {totals.additionalDiscount > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>Desconto adicional</span>
                <span className="font-semibold">
                  -{formatCurrency(totals.additionalDiscount)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900 dark:border-gray-800 dark:text-white">
              <span>Total final</span>
              <span className="text-[#19A999]">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSubmitSale}
            disabled={submitting || cart.length === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#19A999] py-3.5 text-sm font-semibold text-white transition hover:bg-[#14887B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Concluindo venda...' : 'Concluir Venda'}
            {!submitting && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
