import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle2,
    Home,
    ImageOff,
    Minus,
    Plus,
    Send,
    ShoppingBag,
    Store,
    Trash2,
    Truck,
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
type CheckoutStep = 'cart' | 'fulfillment' | 'details';

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
        context,
        fulfillmentType,
        setFulfillment,
    } = useCartStore();

    const [step, setStep] = useState<CheckoutStep>('cart');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>('pending');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [city, setCity] = useState('');
    const [stateCode, setStateCode] = useState('');
    const [reference, setReference] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const storeSlug = useMemo(() => {
        const querySlug = new URLSearchParams(location.search).get('store')?.trim();
        return querySlug || context?.canonicalSlug || DEFAULT_STORE_SLUG;
    }, [context?.canonicalSlug, location.search]);

    const storePath = `/s/${encodeURIComponent(storeSlug)}`;
    const totalValue = total();
    const baseSubtotal = items.reduce(
        (sum, item) => sum + Number(item.originalPrice || item.price || 0) * item.quantity,
        0,
    );
    const discountTotal = Math.max(0, baseSubtotal - totalValue);
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
    const isTableContext = context?.type === 'table';
    const selectedFulfillment = isTableContext ? 'table' : (fulfillmentType || 'pickup');

    const hasEligibleDiscountProducts = useMemo(() => (
        items.some((item) => {
            if (!item.category_id || !item.use_category_pricing) return false;
            const categoryRule = categoryRules[item.category_id];
            return Boolean(
                categoryRule?.pricingGroup?.rules?.length
                || categoryRule?.rules?.length,
            );
        })
    ), [categoryRules, items]);

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

    const changeStep = (nextStep: CheckoutStep) => {
        setError(null);
        setStep(nextStep);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const chooseFulfillment = (type: 'pickup' | 'delivery') => {
        setFulfillment(type, type);
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

        if (selectedFulfillment === 'delivery') {
            if (!street.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || !stateCode.trim()) {
                setError('Preencha o endereço completo para continuar com a entrega.');
                return;
            }
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
                fulfillment_type: selectedFulfillment,
                sales_channel: isTableContext ? 'qr_table' : 'public_store',
                payment_method_code: paymentMethod,
                delivery_method_code: selectedFulfillment,
                items: items.map((item) => ({
                    product_id: item.id,
                    quantity: item.quantity,
                })),
                delivery_address: selectedFulfillment === 'delivery'
                    ? {
                        street: street.trim(),
                        number: number.trim(),
                        neighborhood: neighborhood.trim(),
                        city: city.trim(),
                        state: stateCode.trim().toUpperCase(),
                        reference: reference.trim() || undefined,
                    }
                    : {},
                table_code: selectedFulfillment === 'table' ? context?.tableCode || null : null,
                notes: null,
            });

            if (!result.ok || !result.order) {
                const labels: Record<string, string> = {
                    insufficient_stock: `Estoque insuficiente para ${result.product_name || 'um dos itens'}.`,
                    product_unavailable: 'Um dos produtos não está mais disponível.',
                    payment_method_disabled: 'Forma de pagamento indisponível.',
                    delivery_method_disabled: 'Forma de recebimento indisponível.',
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
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                        <p className="text-xl font-black text-emerald-700">R$ {formatBRL(lineTotal)}</p>
                                                        <p className="text-xs font-semibold text-emerald-700">R$ {formatBRL(appliedUnitPrice)} un</p>
                                                    </div>

                                                    {lineDiscount > 0.009 ? (
                                                        <div className="mt-1 text-xs leading-tight">
                                                            <p className="flex flex-wrap items-baseline gap-x-2 text-slate-400 line-through decoration-slate-400">
                                                                <span>R$ {formatBRL(lineBaseTotal)}</span>
                                                                <span>R$ {formatBRL(originalUnitPrice)} un</span>
                                                            </p>
                                                            <p className="mt-1 font-bold text-emerald-700">
                                                                Economizou R$ {formatBRL(lineDiscount)}
                                                            </p>
                                                        </div>
                                                    ) : null}
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

                    {hasEligibleDiscountProducts && (
                        <section className="my-5 rounded-2xl bg-emerald-50 px-4 py-4 text-emerald-900">
                            <h2 className="text-base font-black">Compre mais e aumente seu desconto</h2>
                            <p className="mt-1 text-sm font-medium leading-relaxed text-emerald-800">
                                Comprando mais unidades dos produtos elegíveis o seu desconto aumenta!{' '}
                                <button type="button" className="font-black underline decoration-emerald-400 underline-offset-2">
                                    Saiba mais →
                                </button>
                            </p>
                        </section>
                    )}
                </main>

                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
                    <div className="mx-auto flex max-w-3xl items-center gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-2xl font-black tracking-tight text-slate-950">R$ {formatBRL(totalValue)}</p>
                            {discountTotal > 0.009 && (
                                <p className="mt-0.5 text-sm font-bold text-emerald-700">Economizou R$ {formatBRL(discountTotal)}</p>
                            )}
                        </div>
                        <button type="button" onClick={() => changeStep(isTableContext ? 'details' : 'fulfillment')} className="flex min-h-14 shrink-0 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 text-lg font-black text-white transition hover:bg-emerald-700 active:scale-[0.99]">
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
                    onClose={() => setIsProductModalOpen(false)}
                    onAddToCart={(product, quantity) => addToCart(product, quantity)}
                />
            </div>
        );
    }

    if (step === 'fulfillment') {
        return (
            <div className="min-h-screen bg-white pb-28 font-sans text-slate-950">
                <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
                    <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
                        <button type="button" onClick={() => changeStep('cart')} className="rounded-full p-2 transition hover:bg-slate-100" aria-label="Voltar ao carrinho">
                            <ArrowLeft className="h-7 w-7" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">Como deseja receber?</h1>
                            <p className="text-sm text-slate-500">Escolha uma opção para continuar</p>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-2xl px-4 py-6">
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => chooseFulfillment('pickup')}
                            className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition ${selectedFulfillment === 'pickup' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        >
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800">
                                <Store size={23} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-lg font-black">Retirar na loja</span>
                                <span className="mt-1 block text-sm text-slate-500">Sem taxa de entrega. Confira o tempo de preparo na revisão.</span>
                            </span>
                            {selectedFulfillment === 'pickup' && <CheckCircle2 className="shrink-0 text-emerald-600" />}
                        </button>

                        <button
                            type="button"
                            onClick={() => chooseFulfillment('delivery')}
                            className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition ${selectedFulfillment === 'delivery' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        >
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800">
                                <Truck size={23} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-lg font-black">Receber em casa</span>
                                <span className="mt-1 block text-sm text-slate-500">Informe o endereço na próxima etapa. Taxa e prazo dependem da região.</span>
                            </span>
                            {selectedFulfillment === 'delivery' && <CheckCircle2 className="shrink-0 text-emerald-600" />}
                        </button>
                    </div>

                    <section className="mt-6 rounded-2xl bg-slate-50 p-4">
                        <p className="text-sm font-bold text-slate-900">Seu carrinho está preservado</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">
                            {totalUnits} {totalUnits === 1 ? 'item' : 'itens'} • R$ {formatBRL(totalValue)}
                        </p>
                    </section>
                </main>

                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                    <div className="mx-auto flex max-w-2xl items-center gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-500">Total dos produtos</p>
                            <p className="text-xl font-black">R$ {formatBRL(totalValue)}</p>
                        </div>
                        <button type="button" onClick={() => changeStep('details')} className="min-h-14 rounded-2xl bg-emerald-600 px-8 text-lg font-black text-white transition hover:bg-emerald-700">
                            Continuar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-32 font-sans">
            <header className="sticky top-0 z-40 border-b border-slate-100 bg-white p-4">
                <div className="mx-auto flex max-w-2xl items-center gap-4">
                    <button type="button" onClick={() => changeStep(isTableContext ? 'cart' : 'fulfillment')} className="rounded-full p-2 transition hover:bg-slate-100" aria-label="Voltar">
                        <ArrowLeft className="h-6 w-6 text-slate-700" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-slate-900">
                            {selectedFulfillment === 'delivery' ? 'Dados para entrega' : selectedFulfillment === 'table' ? 'Dados da comanda' : 'Dados para retirada'}
                        </h1>
                        <p className="text-sm text-slate-500">Identificação e pagamento</p>
                    </div>
                </div>
            </header>

            <main className="mx-auto mt-6 max-w-2xl space-y-6 px-4">
                {selectedFulfillment === 'delivery' && (
                    <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <Home className="text-emerald-600" />
                            <div>
                                <h2 className="font-black text-slate-900">Endereço de entrega</h2>
                                <p className="text-sm text-slate-500">Informe onde deseja receber o pedido.</p>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                            <input type="text" placeholder="Rua" value={street} onChange={(event) => setStreet(event.target.value)} className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" />
                            <input type="text" placeholder="Número" value={number} onChange={(event) => setNumber(event.target.value)} className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <input type="text" placeholder="Bairro" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" />
                            <input type="text" placeholder="Cidade" value={city} onChange={(event) => setCity(event.target.value)} className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
                            <input type="text" maxLength={2} placeholder="UF" value={stateCode} onChange={(event) => setStateCode(event.target.value)} className="w-full rounded-2xl bg-slate-50 p-4 uppercase outline-none focus:ring-2 focus:ring-emerald-400" />
                            <input type="text" placeholder="Ponto de referência (opcional)" value={reference} onChange={(event) => setReference(event.target.value)} className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" />
                        </div>
                    </section>
                )}

                <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Seus dados</h2>
                    <input
                        type="text"
                        placeholder="Seu nome"
                        value={clientName}
                        onChange={(event) => setClientName(event.target.value)}
                        className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <input
                        type="tel"
                        inputMode="tel"
                        placeholder="WhatsApp com DDD"
                        value={clientPhone}
                        onChange={(event) => setClientPhone(event.target.value)}
                        className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                </section>

                <section className="space-y-3 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Pagamento</h2>
                    <button type="button" disabled className="flex w-full cursor-not-allowed items-center rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 opacity-70">
                        <Wallet className="mr-3 h-5 w-5 text-slate-400" />
                        <span className="text-left">
                            <span className="block font-bold text-slate-600">Pagar aqui</span>
                            <span className="block text-xs text-slate-400">Pix e cartão online serão habilitados quando a integração estiver configurada.</span>
                        </span>
                    </button>
                    <button type="button" onClick={() => setPaymentMethod('pending')} className={`flex w-full items-center rounded-2xl border-2 p-4 ${paymentMethod === 'pending' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100'}`}>
                        <Store className="mr-3 h-5 w-5 text-slate-500" />
                        <span className="text-left">
                            <span className="block font-bold text-slate-700">Pagar no atendimento</span>
                            <span className="block text-xs text-slate-500">Pix, dinheiro ou cartão serão combinados no fechamento.</span>
                        </span>
                        {paymentMethod === 'pending' && <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-600" />}
                    </button>
                </section>

                <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Pedido</p>
                            <p className="mt-1 text-sm text-slate-500">{totalUnits} {totalUnits === 1 ? 'item' : 'itens'} • {selectedFulfillment === 'delivery' ? 'Entrega' : selectedFulfillment === 'table' ? 'Mesa' : 'Retirada'}</p>
                        </div>
                        <button type="button" onClick={() => changeStep('cart')} className="text-sm font-bold text-emerald-700">Editar carrinho</button>
                    </div>
                </section>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}
            </main>

            <div className="fixed inset-x-0 bottom-0 border-t border-slate-100 bg-white/95 p-4 backdrop-blur-md">
                <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
                    <div>
                        <span className="block text-xs font-bold uppercase text-slate-400">Total</span>
                        <span className="text-2xl font-black text-emerald-600">R$ {formatBRL(totalValue)}</span>
                    </div>
                    <button type="button" onClick={finishOrder} disabled={loading} className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                        {loading ? 'Criando pedido...' : 'Finalizar pelo WhatsApp'}
                        {!loading && <Send className="h-5 w-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
