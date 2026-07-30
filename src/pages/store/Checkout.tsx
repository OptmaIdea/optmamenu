import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    FileText,
    ImageOff,
    MapPin,
    MessageSquareText,
    Minus,
    Plus,
    ReceiptText,
    Send,
    ShoppingBag,
    Store,
    Trash2,
    UserRound,
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
type CheckoutView = 'cart' | 'review' | 'fulfillment' | 'customer' | 'payment' | 'cpf' | 'notes';

interface DeliveryAddressState {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    complement: string;
    reference: string;
}

function compactOrderCode(orderCode: string) {
    const suffix = orderCode.split('-').pop();
    return suffix ? `#${suffix}` : orderCode;
}

function getItemImage(item: { images?: string[] | null; image_url?: string | null }) {
    if (Array.isArray(item.images) && item.images.length > 0) {
        return item.images.find(Boolean) || null;
    }
    return item.image_url || null;
}

function CheckoutHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
    return (
        <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
                <button type="button" onClick={onBack} className="rounded-full p-2 transition hover:bg-slate-100" aria-label="Voltar">
                    <ArrowLeft className="h-7 w-7" />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-black tracking-tight text-slate-950">{title}</h1>
                    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                </div>
            </div>
        </header>
    );
}

function ReviewRow({ icon, title, description, actionLabel, onClick }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} className="flex w-full items-center gap-4 border-b border-slate-100 px-4 py-5 text-left last:border-b-0 hover:bg-slate-50">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-base font-black text-slate-950">{title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">{description}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-slate-600">{actionLabel}<ChevronRight size={18} /></span>
        </button>
    );
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
        fulfillmentType,
        setFulfillment,
        context,
    } = useCartStore();

    const [view, setView] = useState<CheckoutView>('cart');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [paymentMethod] = useState<PaymentChoice>('pending');
    const [cpf, setCpf] = useState('');
    const [notes, setNotes] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressState>({ street: '', number: '', neighborhood: '', city: '', state: '', complement: '', reference: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const storeSlug = useMemo(() => {
        const querySlug = new URLSearchParams(location.search).get('store')?.trim();
        return querySlug || context?.canonicalSlug || DEFAULT_STORE_SLUG;
    }, [context?.canonicalSlug, location.search]);

    const storePath = `/s/${encodeURIComponent(storeSlug)}`;
    const totalValue = total();
    const baseSubtotal = items.reduce((sum, item) => sum + Number(item.originalPrice || item.price || 0) * item.quantity, 0);
    const discountTotal = Math.max(0, baseSubtotal - totalValue);
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
    const isTableContext = context?.type === 'table';
    const effectiveFulfillment = isTableContext ? 'table' : (fulfillmentType || 'pickup');

    const hasEligibleDiscountProducts = useMemo(() => (
        items.some((item) => {
            if (!item.category_id || !item.use_category_pricing) return false;
            const categoryRule = categoryRules[item.category_id];
            return Boolean(categoryRule?.pricingGroup?.rules?.length || categoryRule?.rules?.length);
        })
    ), [categoryRules, items]);

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

    const handleClearCart = () => {
        if (!window.confirm('Deseja realmente limpar seu carrinho?')) return;
        clearCart();
        navigate(storePath, { replace: true });
    };

    const goToReview = () => {
        setError(null);
        setView('review');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const finishOrder = async () => {
        if (!clientName.trim()) {
            setError('Confira seus dados antes de finalizar o pedido.');
            setView('customer');
            return;
        }

        const phoneDigits = clientPhone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            setError('Informe um WhatsApp válido com DDD.');
            setView('customer');
            return;
        }

        if (effectiveFulfillment === 'delivery') {
            const { street, number, neighborhood, city, state } = deliveryAddress;
            if (!street.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
                setError('Complete o endereço de entrega antes de finalizar.');
                setView('fulfillment');
                return;
            }
        }

        try {
            setLoading(true);
            setError(null);

            const result = await PublicOrderService.createPublicOrder({
                slug: storeSlug,
                customer_name: clientName.trim(),
                customer_phone: phoneDigits,
                fulfillment_type: effectiveFulfillment,
                sales_channel: isTableContext ? 'qr_table' : 'public_store',
                payment_method_code: paymentMethod,
                delivery_method_code: effectiveFulfillment === 'delivery' ? 'delivery' : effectiveFulfillment === 'table' ? 'qr_table' : 'pickup',
                items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
                delivery_address: effectiveFulfillment === 'delivery' ? deliveryAddress : {},
                table_code: context?.tableCode || null,
                notes: [notes.trim(), cpf.trim() ? `CPF: ${cpf.replace(/\D/g, '')}` : ''].filter(Boolean).join('\n') || null,
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
                setView('review');
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
                window.setTimeout(() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer'), 150);
            }
        } catch (err) {
            console.error('Erro ao finalizar pedido público:', err);
            setError('Não foi possível finalizar o pedido agora. Tente novamente.');
            setView('review');
        } finally {
            setLoading(false);
        }
    };

    if (items.length === 0) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
                <ShoppingBag size={64} className="mb-4 text-slate-300" />
                <h1 className="text-xl font-black text-slate-800">Seu carrinho está vazio</h1>
                <p className="mb-6 mt-2 text-center text-slate-500">Adicione produtos do cardápio para continuar.</p>
                <Link to={storePath} className="rounded-full bg-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-700">Ver cardápio</Link>
            </div>
        );
    }

    if (view === 'cart') {
        return (
            <div className="min-h-screen bg-white pb-32 font-sans text-slate-950">
                <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
                    <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
                        <Link to={storePath} className="rounded-full p-2 transition hover:bg-slate-100" aria-label="Voltar ao cardápio"><ArrowLeft className="h-7 w-7" /></Link>
                        <div className="min-w-0 flex-1"><h1 className="text-2xl font-black tracking-tight">Seu carrinho</h1><p className="text-base text-slate-500">{totalUnits} {totalUnits === 1 ? 'item' : 'itens'}</p></div>
                        <button type="button" onClick={handleClearCart} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-base font-bold text-red-600 hover:bg-red-50"><Trash2 size={18} /> Limpar</button>
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
                                        <button type="button" onClick={() => openProduct(item)} className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 active:scale-[0.98]">
                                            {imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" /> : <ImageOff className="h-8 w-8 text-slate-300" />}
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <button type="button" onClick={() => openProduct(item)} className="block w-full text-left"><h2 className="line-clamp-2 text-lg font-bold leading-snug">{item.name}</h2></button>
                                            <div className="mt-2 flex items-end justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><p className="text-xl font-black text-emerald-700">R$ {formatBRL(lineTotal)}</p><p className="text-xs font-semibold text-emerald-700">R$ {formatBRL(appliedUnitPrice)} un</p></div>
                                                    {lineDiscount > 0.009 && <div className="mt-1 text-xs leading-tight"><p className="flex flex-wrap items-baseline gap-x-2 text-slate-400 line-through decoration-slate-400"><span>R$ {formatBRL(lineBaseTotal)}</span><span>R$ {formatBRL(originalUnitPrice)} un</span></p><p className="mt-1 font-bold text-emerald-700">Economizou R$ {formatBRL(lineDiscount)}</p></div>}
                                                </div>
                                                <div className="inline-flex h-11 items-center rounded-full border border-slate-300 bg-white px-1">
                                                    <button type="button" onClick={() => changeQuantity(item.id, item.quantity, -1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"><Minus size={18} /></button>
                                                    <input type="number" min={1} inputMode="numeric" value={item.quantity} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDirectQuantity(item.id, event.target.value)} className="h-9 w-10 appearance-none bg-transparent text-center text-base font-black outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                                                    <button type="button" onClick={() => changeQuantity(item.id, item.quantity, 1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"><Plus size={18} /></button>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" className="text-sm font-semibold text-emerald-700">+ Adicionar observação</button><button type="button" onClick={() => removeFromCart(item.id)} className="text-sm font-bold text-red-600">Remover</button></div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    <Link to={storePath} className="mt-2 flex items-center justify-center gap-2 border-y border-slate-100 py-5 text-base font-black text-emerald-700 hover:bg-emerald-50"><Plus size={20} /> Adicionar mais itens</Link>

                    {hasEligibleDiscountProducts && <section className="my-5 rounded-2xl bg-emerald-50 px-4 py-4 text-emerald-900"><h2 className="text-base font-black">Compre mais e aumente seu desconto</h2><p className="mt-1 text-sm font-medium leading-relaxed text-emerald-800">Comprando mais unidades dos produtos elegíveis o seu desconto aumenta! <button type="button" className="font-black underline decoration-emerald-400 underline-offset-2">Saiba mais →</button></p></section>}
                </main>

                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
                    <div className="mx-auto flex max-w-3xl items-center gap-4"><div className="min-w-0 flex-1"><p className="text-2xl font-black tracking-tight">R$ {formatBRL(totalValue)}</p>{discountTotal > 0.009 && <p className="mt-0.5 text-sm font-bold text-emerald-700">Economizou R$ {formatBRL(discountTotal)}</p>}</div><button type="button" onClick={goToReview} className="flex min-h-14 shrink-0 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 text-lg font-black text-white hover:bg-emerald-700">Continuar<span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-sm font-black text-emerald-700">{totalUnits}</span></button></div>
                </div>

                <ProductModal product={selectedProduct} isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onAddToCart={(product, quantity) => addToCart(product, quantity)} />
            </div>
        );
    }

    if (view === 'fulfillment') {
        return (
            <div className="min-h-screen bg-slate-50 pb-24">
                <CheckoutHeader title="Entrega" subtitle="Escolha como deseja receber" onBack={() => setView('review')} />
                <main className="mx-auto max-w-3xl px-4 py-5">
                    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                        <button type="button" onClick={() => { setFulfillment('pickup', 'pickup'); setView('review'); }} className="flex w-full items-center gap-4 border-b border-slate-100 px-4 py-5 text-left hover:bg-slate-50"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Store size={21} /></span><span className="flex-1"><span className="block font-black">Retirar na loja</span><span className="mt-0.5 block text-sm text-slate-500">Sem taxa de entrega</span></span>{effectiveFulfillment === 'pickup' && <CheckCircle2 className="text-emerald-600" />}</button>
                        <button type="button" onClick={() => setFulfillment('delivery', 'delivery')} className="flex w-full items-center gap-4 px-4 py-5 text-left hover:bg-slate-50"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><MapPin size={21} /></span><span className="flex-1"><span className="block font-black">Receber em casa</span><span className="mt-0.5 block text-sm text-slate-500">Informe o endereço para calcular condições</span></span>{effectiveFulfillment === 'delivery' && <CheckCircle2 className="text-emerald-600" />}</button>
                    </section>

                    {effectiveFulfillment === 'delivery' && (
                        <section className="mt-5 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                            <h2 className="text-lg font-black">Endereço de entrega</h2>
                            <input placeholder="Rua" value={deliveryAddress.street} onChange={(e) => setDeliveryAddress((s) => ({ ...s, street: e.target.value }))} className="w-full rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" />
                            <div className="grid grid-cols-[1fr_2fr] gap-3"><input placeholder="Número" value={deliveryAddress.number} onChange={(e) => setDeliveryAddress((s) => ({ ...s, number: e.target.value }))} className="rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" /><input placeholder="Complemento" value={deliveryAddress.complement} onChange={(e) => setDeliveryAddress((s) => ({ ...s, complement: e.target.value }))} className="rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" /></div>
                            <input placeholder="Bairro" value={deliveryAddress.neighborhood} onChange={(e) => setDeliveryAddress((s) => ({ ...s, neighborhood: e.target.value }))} className="w-full rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" />
                            <div className="grid grid-cols-[2fr_1fr] gap-3"><input placeholder="Cidade" value={deliveryAddress.city} onChange={(e) => setDeliveryAddress((s) => ({ ...s, city: e.target.value }))} className="rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" /><input placeholder="UF" maxLength={2} value={deliveryAddress.state} onChange={(e) => setDeliveryAddress((s) => ({ ...s, state: e.target.value.toUpperCase() }))} className="rounded-xl bg-slate-50 p-4 uppercase outline-none focus:ring-2 focus:ring-emerald-400" /></div>
                            <input placeholder="Ponto de referência" value={deliveryAddress.reference} onChange={(e) => setDeliveryAddress((s) => ({ ...s, reference: e.target.value }))} className="w-full rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" />
                            <button type="button" onClick={() => setView('review')} className="w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white">Salvar endereço</button>
                        </section>
                    )}
                </main>
            </div>
        );
    }

    if (view === 'customer') {
        return <div className="min-h-screen bg-slate-50 pb-24"><CheckoutHeader title="Seus dados" subtitle="Identificação do pedido" onBack={() => setView('review')} /><main className="mx-auto max-w-3xl px-4 py-5"><section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"><input placeholder="Seu nome" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" /><input type="tel" inputMode="tel" placeholder="WhatsApp com DDD" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="w-full rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" /><button type="button" onClick={() => setView('review')} className="w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white">Salvar dados</button></section></main></div>;
    }

    if (view === 'payment') {
        return <div className="min-h-screen bg-slate-50 pb-24"><CheckoutHeader title="Pagamento" subtitle="Escolha como deseja pagar" onBack={() => setView('review')} /><main className="mx-auto max-w-3xl px-4 py-5"><section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"><button type="button" onClick={() => setView('review')} className="flex w-full items-center gap-4 px-4 py-5 text-left hover:bg-slate-50"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Wallet size={21} /></span><span className="flex-1"><span className="block font-black">Pagar na entrega ou retirada</span><span className="mt-0.5 block text-sm text-slate-500">PIX, dinheiro ou cartão serão informados ao lojista</span></span><CheckCircle2 className="text-emerald-600" /></button></section><p className="mt-4 px-1 text-sm leading-relaxed text-slate-500">Pagamentos online aparecerão aqui quando a loja ativar uma integração compatível.</p></main></div>;
    }

    if (view === 'cpf') {
        return <div className="min-h-screen bg-slate-50 pb-24"><CheckoutHeader title="CPF no documento" subtitle="Campo opcional" onBack={() => setView('review')} /><main className="mx-auto max-w-3xl px-4 py-5"><section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"><input inputMode="numeric" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" /><button type="button" onClick={() => setView('review')} className="w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white">Salvar CPF</button></section></main></div>;
    }

    if (view === 'notes') {
        return <div className="min-h-screen bg-slate-50 pb-24"><CheckoutHeader title="Observações" subtitle="Instruções gerais do pedido" onBack={() => setView('review')} /><main className="mx-auto max-w-3xl px-4 py-5"><section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"><textarea rows={6} placeholder="Ex.: chamar no portão, entregar na recepção..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full resize-none rounded-xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-emerald-400" /><button type="button" onClick={() => setView('review')} className="w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white">Salvar observações</button></section></main></div>;
    }

    const fulfillmentDescription = effectiveFulfillment === 'delivery'
        ? (deliveryAddress.street ? `${deliveryAddress.street}, ${deliveryAddress.number} — ${deliveryAddress.neighborhood}` : 'Informe o endereço de entrega')
        : effectiveFulfillment === 'table'
            ? `Mesa/comanda ${context?.tableCode || ''}`
            : 'Retirada na loja';
    const customerDescription = clientName && clientPhone ? `${clientName} • ${clientPhone}` : 'Informe nome e WhatsApp';

    return (
        <div className="min-h-screen bg-slate-50 pb-32 font-sans text-slate-950">
            <CheckoutHeader title="Finalizar pedido" subtitle="Revise as informações antes de confirmar" onBack={() => setView('cart')} />
            <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
                <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                    <ReviewRow icon={<MapPin size={21} />} title="Informações da entrega" description={fulfillmentDescription} actionLabel="Alterar" onClick={() => setView('fulfillment')} />
                    <ReviewRow icon={<UserRound size={21} />} title="Seus dados" description={customerDescription} actionLabel="Alterar" onClick={() => setView('customer')} />
                    <ReviewRow icon={<Wallet size={21} />} title="Pagamento" description="Pagar na entrega ou retirada" actionLabel="Ver tudo" onClick={() => setView('payment')} />
                </section>

                <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                    <ReviewRow icon={<ShoppingBag size={21} />} title="Resumo do pedido" description={`${totalUnits} ${totalUnits === 1 ? 'item' : 'itens'} no carrinho`} actionLabel="Editar" onClick={() => setView('cart')} />
                    <ReviewRow icon={<FileText size={21} />} title="CPF no documento" description={cpf.trim() ? `CPF final ${cpf.replace(/\D/g, '').slice(-4)}` : 'Não informado'} onClick={() => setView('cpf')} />
                    <ReviewRow icon={<MessageSquareText size={21} />} title="Observações" description={notes.trim() || 'Nenhuma observação adicionada'} onClick={() => setView('notes')} />
                </section>

                {discountTotal > 0.009 && <section className="rounded-2xl bg-emerald-50 px-4 py-4 text-emerald-900"><h2 className="font-black">Economize hoje</h2><p className="mt-1 text-sm font-medium">Você economizou R$ {formatBRL(discountTotal)} com os descontos aplicados ao carrinho.</p></section>}

                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center gap-2"><ReceiptText size={20} className="text-slate-500" /><h2 className="font-black">Detalhes dos valores</h2></div>
                    <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between text-slate-600"><span>Subtotal</span><span>R$ {formatBRL(baseSubtotal)}</span></div>{discountTotal > 0.009 && <div className="flex justify-between font-bold text-emerald-700"><span>Descontos</span><span>- R$ {formatBRL(discountTotal)}</span></div>}<div className="flex justify-between text-slate-600"><span>Entrega</span><span>{effectiveFulfillment === 'delivery' ? 'A calcular' : 'Sem taxa'}</span></div><div className="flex justify-between border-t border-slate-100 pt-3 text-base font-black"><span>Total</span><span>R$ {formatBRL(totalValue)}</span></div></div>
                </section>

                {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
            </main>

            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"><div className="mx-auto flex max-w-3xl items-center gap-4"><div className="min-w-0 flex-1"><p className="text-2xl font-black">R$ {formatBRL(totalValue)}</p>{discountTotal > 0.009 && <p className="text-sm font-bold text-emerald-700">Economizou R$ {formatBRL(discountTotal)}</p>}</div><button type="button" onClick={finishOrder} disabled={loading} className="flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60 sm:flex-none">{loading ? 'Criando pedido...' : 'Finalizar pelo WhatsApp'}{!loading && <Send size={19} />}</button></div></div>
        </div>
    );
}
