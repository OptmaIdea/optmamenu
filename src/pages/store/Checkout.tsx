import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    ImageOff,
    Minus,
    Plus,
    Send,
    ShoppingBag,
    Store,
    Trash2,
    Wallet,
} from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
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
    const { items, total, clearCart, updateQuantity, removeFromCart } = useCartStore();

    const [step, setStep] = useState<CheckoutStep>('cart');
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
                <Link to={storePath} className="bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-green-700 transition text-sm">
                    Ver cardápio
                </Link>
            </div>
        );
    }

    if (step === 'cart') {
        return (
            <div className="min-h-screen bg-slate-50 pb-28 font-sans text-slate-900">
                <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
                        <Link to={storePath} className="rounded-full p-2 transition hover:bg-slate-100" aria-label="Voltar ao cardápio">
                            <ArrowLeft className="h-6 w-6" />
                        </Link>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl font-black tracking-tight">Seu carrinho</h1>
                            <p className="text-sm text-slate-500">{totalUnits} {totalUnits === 1 ? 'item' : 'itens'}</p>
                        </div>
                        <button type="button" onClick={handleClearCart} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">
                            <Trash2 size={16} /> Limpar
                        </button>
                    </div>
                </header>

                <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                    <section className="space-y-4">
                        {items.map((item) => {
                            const imageUrl = getItemImage(item);
                            const originalUnitPrice = Number(item.originalPrice || item.price || 0);
                            const appliedUnitPrice = Number(item.price || 0);
                            const lineBaseTotal = originalUnitPrice * item.quantity;
                            const lineTotal = appliedUnitPrice * item.quantity;
                            const lineDiscount = Math.max(0, lineBaseTotal - lineTotal);

                            return (
                                <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                                    <div className="flex gap-4 p-4 sm:p-5">
                                        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 sm:h-28 sm:w-28">
                                            {imageUrl ? (
                                                <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <ImageOff className="h-8 w-8 text-slate-300" aria-hidden="true" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h2 className="text-base font-black leading-tight text-slate-900 sm:text-lg">{item.name}</h2>
                                                    <p className="mt-1 text-sm text-slate-500">R$ {formatBRL(appliedUnitPrice)} cada</p>
                                                </div>
                                                <p className="shrink-0 text-base font-black text-slate-900 sm:text-lg">R$ {formatBRL(lineTotal)}</p>
                                            </div>

                                            {lineDiscount > 0.009 && (
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                                    <span className="text-slate-400 line-through">R$ {formatBRL(lineBaseTotal)}</span>
                                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-700">
                                                        Economize R$ {formatBRL(lineDiscount)}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                                <div className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => changeQuantity(item.id, item.quantity, -1)}
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-red-600"
                                                        aria-label={`Diminuir quantidade de ${item.name}`}
                                                    >
                                                        <Minus size={16} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        inputMode="numeric"
                                                        value={item.quantity}
                                                        onFocus={(event) => event.currentTarget.select()}
                                                        onChange={(event) => setDirectQuantity(item.id, event.target.value)}
                                                        className="h-9 w-12 appearance-none bg-transparent text-center text-sm font-black outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                        aria-label={`Quantidade de ${item.name}`}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => changeQuantity(item.id, item.quantity, 1)}
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-emerald-700"
                                                        aria-label={`Aumentar quantidade de ${item.name}`}
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>

                                                <button type="button" onClick={() => removeFromCart(item.id)} className="text-sm font-bold text-red-600 hover:text-red-700">
                                                    Remover
                                                </button>
                                            </div>

                                            <button type="button" className="mt-3 text-left text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                                                + Adicionar observação
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}

                        <Link to={storePath} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-100">
                            <Plus size={18} /> Adicionar mais itens
                        </Link>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:hidden">
                            <p className="text-sm font-black text-slate-900">Entrega e retirada</p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-500">
                                As condições, taxas e mínimos serão calculados na próxima etapa.
                            </p>
                        </div>
                    </section>

                    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
                        <h2 className="text-lg font-black">Resumo do pedido</h2>
                        <div className="mt-5 space-y-3 text-sm">
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                                <span>Subtotal</span>
                                <span>R$ {formatBRL(baseSubtotal)}</span>
                            </div>
                            {discountTotal > 0.009 && (
                                <div className="flex items-center justify-between gap-4 font-bold text-emerald-700">
                                    <span>Descontos</span>
                                    <span>- R$ {formatBRL(discountTotal)}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                                <span>Entrega</span>
                                <span>A calcular</span>
                            </div>
                            <div className="border-t border-slate-200 pt-4">
                                <div className="flex items-end justify-between gap-4">
                                    <span className="font-bold text-slate-700">Total parcial</span>
                                    <span className="text-2xl font-black text-emerald-700">R$ {formatBRL(totalValue)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 hidden rounded-2xl bg-slate-50 p-4 lg:block">
                            <p className="text-sm font-black">Próxima etapa</p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-500">
                                Escolha como deseja receber e confira seus dados antes do pagamento.
                            </p>
                        </div>

                        <button type="button" onClick={goToDetails} className="mt-5 flex w-full items-center justify-between rounded-2xl bg-emerald-600 px-5 py-4 text-left font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 active:scale-[0.99]">
                            <span>
                                <span className="block text-xs font-semibold text-emerald-100">Continuar</span>
                                <span className="block">R$ {formatBRL(totalValue)}</span>
                            </span>
                            <ChevronRight size={22} />
                        </button>
                    </aside>
                </main>

                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
                    <button type="button" onClick={goToDetails} className="mx-auto flex min-h-16 w-full max-w-2xl items-center justify-between rounded-2xl bg-emerald-600 px-5 py-3 text-left font-black text-white shadow-xl">
                        <span>
                            <span className="block text-xs font-semibold text-emerald-100">Continuar para recebimento</span>
                            <span className="block text-lg">R$ {formatBRL(totalValue)}</span>
                        </span>
                        <ChevronRight size={22} />
                    </button>
                </div>
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
