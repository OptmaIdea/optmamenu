import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle2,
    ImageOff,
    Minus,
    Plus,
    Send,
    ShoppingBag,
    Store,
    Trash2,
    Wallet,
} from 'lucide-react';
import type { Product } from '@/types';
import { useCartStore } from '@/store/useCartStore';
import { ProductModal } from '@/pages/store/ProductModal';
import { PublicOrderService } from '@/services/publicOrderService';
import { buildWhatsappUrl, canOpenWhatsapp } from '@/utils/whatsapp';
import { formatBRL } from '@/utils/pricing';

const DEFAULT_STORE_SLUG = 'gelinharessjn';

type PaymentChoice = 'pending';
type CheckoutStep = 'cart' | 'details';

function compactOrderCode(orderCode: string) {
    const suffix = orderCode.split('-').pop();
    return suffix ? `#${suffix}` : orderCode;
}

function getItemImage(item: {
    images?: string[] | null;
    image_url?: string | null;
}) {
    if (Array.isArray(item.images) && item.images.length > 0) {
        return item.images.find(Boolean) || null;
    }

    return item.image_url || null;
}

export default function Checkout() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        items,
        total,
        clearCart,
        updateQuantity,
        removeFromCart,
        addToCart,
        categoryRules,
    } = useCartStore();

    const [step, setStep] = useState<CheckoutStep>('cart');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>('pending');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const storeSlug = useMemo(() => {
        const querySlug = new URLSearchParams(location.search).get('store')?.trim();
        return querySlug || DEFAULT_STORE_SLUG;
    }, [location.search]);

    const storePath = `/s/${encodeURIComponent(storeSlug)}`;
    const totalValue = total();
    const baseSubtotal = items.reduce(
        (sum, item) => sum + Number(item.originalPrice || item.price || 0) * item.quantity,
        0,
    );
    const discountTotal = Math.max(0, baseSubtotal - totalValue);
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

    const discountOpportunity = useMemo(() => {
        const candidates: Array<{ missing: number; text: string }> = [];
        const processedGroups = new Set<string>();
        const processedCategories = new Set<string>();

        items.forEach((item) => {
            if (!item.category_id || !item.use_category_pricing) return;

            const categoryRule = categoryRules[item.category_id];
            if (!categoryRule) return;

            if (categoryRule.pricingGroup) {
                const groupId = categoryRule.pricingGroup.id;
                if (processedGroups.has(groupId)) return;
                processedGroups.add(groupId);

                const groupQuantity = items.reduce((sum, cartItem) => {
                    if (!cartItem.category_id || !cartItem.use_category_pricing) return sum;
                    const cartItemRule = categoryRules[cartItem.category_id];
                    return cartItemRule?.pricingGroup?.id === groupId
                        ? sum + cartItem.quantity
                        : sum;
                }, 0);

                const nextRule = [...categoryRule.pricingGroup.rules]
                    .sort((a, b) => a.min - b.min)
                    .find((rule) => rule.min > groupQuantity);

                if (nextRule) {
                    const missing = nextRule.min - groupQuantity;
                    candidates.push({
                        missing,
                        text: `Adicione mais ${missing} ${missing === 1 ? 'item elegível' : 'itens elegíveis'} para alcançar a próxima faixa de preço.`,
                    });
                }
                return;
            }

            if (categoryRule.type !== 'category_volume') return;

            const key = categoryRule.volumeScope === 'per_product'
                ? `product:${item.id}`
                : `category:${item.category_id}`;
            if (processedCategories.has(key)) return;
            processedCategories.add(key);

            const pricingQuantity = categoryRule.volumeScope === 'per_product'
                ? item.quantity
                : items.reduce((sum, cartItem) => (
                    cartItem.category_id === item.category_id && cartItem.use_category_pricing
                        ? sum + cartItem.quantity
                        : sum
                ), 0);

            const nextRule = [...categoryRule.rules]
                .sort((a, b) => a.min - b.min)
                .find((rule) => rule.min > pricingQuantity);

            if (nextRule) {
                const missing = nextRule.min - pricingQuantity;
                candidates.push({
                    missing,
                    text: `Adicione mais ${missing} ${missing === 1 ? 'unidade elegível' : 'unidades elegíveis'} para alcançar a próxima faixa de preço.`,
                });
            }
        });

        return candidates.sort((a, b) => a.missing - b.missing)[0]?.text || null;
    }, [categoryRules, items]);

    const handleClearCart = () => {
        if (!window.confirm('Deseja realmente limpar seu carrinho?')) return;
        clearCart();
        navigate(storePath, { replace: true });
    };

    const changeQuantity = (productId: string, currentQuantity: number, delta: number) => {
        const nextQuantity = currentQuantity + delta;
        if (nextQuantity <= 0) {
            removeFromCart(productId);
            return;
        }
        updateQuantity(productId, nextQuantity);
    };

    const setDirectQuantity = (productId: string, rawValue: string) => {
        const parsed = Math.trunc(Number(rawValue));
        if (!Number.isFinite(parsed)) return;
        updateQuantity(productId, Math.max(1, parsed));
    };

    const openProduct = (product: Product) => {
        setSelectedProduct(product);
        setIsProductModalOpen(true);
    };

    const closeProduct = () => {
        setIsProductModalOpen(false);
    };

    const goToDetails = () => {
        setError(null);
        setStep('details');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const returnToCart = () => {
        setError(null);
        setStep('cart');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const finishOrder = async () => {
        if (!clientName.trim()) {
            setError('Informe seu nome para continuar.');
            return;
        }

        const phoneDigits = clientPhone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            setError('Informe um WhatsApp válido com DDD.');
            return;
        }

        if (items.length === 0) {
            setError('Seu carrinho está vazio.');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const result = await PublicOrderService.createPublicOrder({
                slug: storeSlug,
                customer_name: clientName.trim(),
                customer_phone: phoneDigits,
                fulfillment_type: 'pickup',
                sales_channel: 'public_store',
                payment_method_code: paymentMethod,
                delivery_method_code: 'pickup',
                items: items.map((item) => ({
                    product_id: item.id,
                    quantity: item.quantity,
                })),
                delivery_address: {},
                table_code: null,
                notes: null,
            });

            if (!result.ok || !result.order) {
                const labels: Record<string, string> = {
                    insufficient_stock: `Estoque insuficiente para ${result.product_name || 'um dos itens'}.`,
                    product_unavailable: 'Um dos produtos não está mais disponível.',
                    payment_method_disabled: 'Forma de pagamento indisponível.',
                    delivery_method_disabled: 'Forma de retirada indisponível.',
                    invalid_customer_phone: 'WhatsApp inválido.',
                    empty_cart: 'Carrinho vazio.',
                };
                setError(labels[result.error || ''] || result.message || 'Não foi possível criar o pedido.');
                return;
            }

            const trackingUrl = `${window.location.origin}/p/${encodeURIComponent(result.order.public_order_token)}`;
            const catalogUrl = `${window.location.origin}${storePath}`;
            const firstName = clientName.trim().split(/\s+/)[0] || 'Cliente';
            const message = [
                `Olá! Acabei de fazer o pedido nº *${compactOrderCode(result.order.order_code)}* pelo catálogo.`,
                '',
                `Meu nome é *${firstName}*.`,
                '',
                'Acompanhar pedido:',
                trackingUrl,
                '',
                'Catálogo:',
                catalogUrl,
            ].join('\n');

            const whatsappUrl = result.whatsapp?.digits && canOpenWhatsapp(result.whatsapp.digits)
                ? buildWhatsappUrl(result.whatsapp.digits, message)
                : result.whatsapp?.url;

            clearCart();

            navigate(storePath, {
                replace: true,
                state: {
                    orderSuccess: {
                        order_code: result.order.order_code,
                        total: Number(result.order.total || 0),
                        whatsapp_url: whatsappUrl,
                        public_order_token: result.order.public_order_token,
                        tracking_url: trackingUrl,
                    },
                },
            });

            if (whatsappUrl) {
                window.setTimeout(() => {
                    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                }, 150);
            }
        } catch (err) {
            console.error('Erro ao finalizar pedido público:', err);
            setError('Não foi possível finalizar o pedido agora. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    if (items.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
                <ShoppingBag size={64} className="text-gray-300 mb-4" />
                <h1 className="text-xl font-black text-gray-800">Seu carrinho está vazio</h1>
                <p className="mt-2 text-center text-gray-500 mb-6">Adicione produtos do cardápio para continuar.</p>
                <Link to={storePath} className="bg-emerald-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-emerald-700 transition text-sm">
                    Ver cardápio
                </Link>
            </div>
        );
    }

    if (step === 'cart') {
        return (
            <div className="min-h-screen bg-white pb-32 font-sans text-slate-950">
                <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
                    <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
                        <Link to={storePath} className="rounded-full p-2 transition hover:bg-slate-100" aria-label="Voltar ao cardápio">
                            <ArrowLeft className="h-7 w-7" />
                        </Link>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl font-black tracking-tight">Seu carrinho</h1>
                            <p className="text-base text-slate-500">{totalUnits} {totalUnits === 1 ? 'item' : 'itens'}</p>
                        </div>
                        <button type="button" onClick={handleClearCart} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-base font-bold text-red-600 transition hover:bg-red-50">
                            <Trash2 size={18} /> Limpar
                        </button>
                    </div>
                </header>

                <main className="mx-auto max-w-3xl px-4 py-5">
                    <section className="divide-y divide-slate-100">
                        {items.map((item) => {
                            const imageUrl = getItemImage(item);
                            const originalUnitPrice = Number(item.originalPrice || item.price || 0);
                            const appliedUnitPrice = Number(item.price || 0);
                            const lineBaseTotal = originalUnitPrice * item.quantity;
                            const lineTotal = appliedUnitPrice * item.quantity;
                            const lineDiscount = Math.max(0, lineBaseTotal - lineTotal);

                            return (
                                <article key={item.id} className="py-5 first:pt-1">
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => openProduct(item)}
                                            className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-left transition active:scale-[0.98]"
                                            aria-label={`Ver detalhes de ${item.name}`}
                                        >
                                            {imageUrl ? (
                                                <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <ImageOff className="h-8 w-8 text-slate-300" aria-hidden="true" />
                                            )}
                                        </button>

                                        <div className="min-w-0 flex-1">
                                            <button type="button" onClick={() => openProduct(item)} className="block w-full text-left">
                                                <h2 className="line-clamp-2 text-lg font-bold leading-snug text-slate-950">{item.name}</h2>
                                            </button>

                                            <div className="mt-2 flex items-end justify-between gap-3">
                                                <div>
                                                    <p className="text-xl font-black text-emerald-700">R$ {formatBRL(lineTotal)}</p>
                                                    {lineDiscount > 0.009 && (
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                                                            <span className="text-slate-400 line-through">R$ {formatBRL(lineBaseTotal)}</span>
                                                            <span className="font-bold text-emerald-700">Economizou R$ {formatBRL(lineDiscount)}</span>
                                                        </div>
                                                    )}
                                                    {lineDiscount <= 0.009 && (
                                                        <p className="mt-1 text-sm text-slate-500">R$ {formatBRL(appliedUnitPrice)} cada</p>
                                                    )}
                                                </div>

                                                <div className="inline-flex h-11 items-center rounded-full border border-slate-300 bg-white px-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => changeQuantity(item.id, item.quantity, -1)}
                                                        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-950 transition hover:bg-slate-100"
                                                        aria-label={`Diminuir quantidade de ${item.name}`}
                                                    >
                                                        <Minus size={18} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        inputMode="numeric"
                                                        value={item.quantity}
                                                        onFocus={(event) => event.currentTarget.select()}
                                                        onChange={(event) => setDirectQuantity(item.id, event.target.value)}
                                                        className="h-9 w-10 appearance-none bg-transparent text-center text-base font-black outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                        aria-label={`Quantidade de ${item.name}`}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => changeQuantity(item.id, item.quantity, 1)}
                                                        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-950 transition hover:bg-slate-100"
                                                        aria-label={`Aumentar quantidade de ${item.name}`}
                                                    >
                                                        <Plus size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                                <button type="button" className="text-left text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                                                    + Adicionar observação
                                                </button>
                                                <button type="button" onClick={() => removeFromCart(item.id)} className="text-sm font-bold text-red-600 hover:text-red-700">
                                                    Remover
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    <Link to={storePath} className="mt-2 flex items-center justify-center gap-2 border-y border-slate-100 py-5 text-base font-black text-emerald-700 transition hover:bg-emerald-50">
                        <Plus size={20} /> Adicionar mais itens
                    </Link>

                    <section className="py-5">
                        <h2 className="text-base font-black text-slate-950">Compre mais e aumente seu desconto</h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">
                            Os preços são recalculados automaticamente conforme as quantidades e os grupos de produtos do carrinho.
                        </p>
                        {discountOpportunity && (
                            <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold leading-relaxed text-emerald-800">
                                {discountOpportunity}
                            </p>
                        )}
                    </section>
                </main>

                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
                    <div className="mx-auto flex max-w-3xl items-center gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-2xl font-black tracking-tight text-slate-950">R$ {formatBRL(totalValue)}</p>
                            {discountTotal > 0.009 && (
                                <p className="mt-0.5 text-sm font-bold text-emerald-700">Economizou R$ {formatBRL(discountTotal)}</p>
                            )}
                            {discountOpportunity && (
                                <p className="mt-0.5 truncate text-xs text-slate-500">Compre mais para ampliar o desconto</p>
                            )}
                        </div>
                        <button type="button" onClick={goToDetails} className="flex min-h-14 shrink-0 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 text-lg font-black text-white transition hover:bg-emerald-700 active:scale-[0.99]">
                            Continuar
                            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-sm font-black text-emerald-700">
                                {totalUnits}
                            </span>
                        </button>
                    </div>
                </div>

                <ProductModal
                    product={selectedProduct}
                    isOpen={isProductModalOpen}
                    onClose={closeProduct}
                    onAddToCart={(product, quantity) => addToCart(product, quantity)}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32 font-sans">
            <header className="bg-white p-4 sticky top-0 z-40 border-b flex items-center gap-4">
                <button type="button" onClick={returnToCart} className="p-2 hover:bg-gray-100 rounded-full transition" aria-label="Voltar ao carrinho">
                    <ArrowLeft className="w-6 h-6 text-gray-700" />
                </button>
                <div>
                    <h1 className="text-xl font-black text-gray-800 tracking-tight">Como deseja continuar?</h1>
                    <p className="text-sm text-gray-500">Identificação e pagamento</p>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
                <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Identificação</h2>
                    <input
                        type="text"
                        placeholder="Seu nome"
                        value={clientName}
                        onChange={(event) => setClientName(event.target.value)}
                        className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <input
                        type="tel"
                        inputMode="tel"
                        placeholder="WhatsApp com DDD"
                        value={clientPhone}
                        onChange={(event) => setClientPhone(event.target.value)}
                        className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-green-400"
                    />
                </section>

                <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-3">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pagamento</h2>
                    <button type="button" disabled className="w-full flex items-center p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 opacity-70 cursor-not-allowed">
                        <Wallet className="w-5 h-5 mr-3 text-gray-400" />
                        <span className="text-left">
                            <span className="block font-bold text-gray-600">Pagar aqui</span>
                            <span className="block text-xs text-gray-400">PIX e cartão serão habilitados quando a integração online estiver configurada.</span>
                        </span>
                    </button>
                    <button type="button" onClick={() => setPaymentMethod('pending')} className={`w-full flex items-center p-4 rounded-2xl border-2 ${paymentMethod === 'pending' ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}>
                        <Store className="w-5 h-5 mr-3 text-gray-500" />
                        <span className="text-left">
                            <span className="block font-bold text-gray-700">Pagar na retirada</span>
                            <span className="block text-xs text-gray-500">A forma real será informada ao finalizar: PIX, dinheiro ou cartão.</span>
                        </span>
                        {paymentMethod === 'pending' && <CheckCircle2 className="w-5 h-5 ml-auto text-green-600" />}
                    </button>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Resumo</p>
                            <p className="mt-1 text-sm text-slate-500">{totalUnits} {totalUnits === 1 ? 'item' : 'itens'} no pedido</p>
                        </div>
                        <button type="button" onClick={returnToCart} className="text-sm font-bold text-emerald-700">Editar carrinho</button>
                    </div>
                </section>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}
            </main>

            <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/90 backdrop-blur-md border-t">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                    <div>
                        <span className="block text-xs font-bold text-gray-400 uppercase">Total</span>
                        <span className="text-2xl font-black text-green-600">R$ {formatBRL(totalValue)}</span>
                    </div>
                    <button type="button" onClick={finishOrder} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 disabled:opacity-60">
                        {loading ? 'Criando pedido...' : 'Finalizar pelo WhatsApp'}
                        {!loading && <Send className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
