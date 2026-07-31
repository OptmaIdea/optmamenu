import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    FileText,
    ImageOff,
    LocateFixed,
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

type CheckoutView = 'cart' | 'review' | 'fulfillment' | 'customer' | 'payment' | 'cpf' | 'notes';
type PaymentChoice = '' | 'pix_advance' | 'pix_receive' | 'cash' | 'card' | 'payment_link';

interface DeliveryAddressState {
    zipCode: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    complement: string;
    reference: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
}

const EMPTY_ADDRESS: DeliveryAddressState = {
    zipCode: '', street: '', number: '', district: '', city: '', state: '', complement: '', reference: '',
};

function compactOrderCode(orderCode: string) {
    const suffix = orderCode.split('-').pop();
    return suffix ? `#${suffix}` : orderCode;
}

function getItemImage(item: { images?: string[] | null; image_url?: string | null }) {
    if (Array.isArray(item.images) && item.images.length > 0) return item.images.find(Boolean) || null;
    return item.image_url || null;
}

function onlyDigits(value: string) {
    return value.replace(/\D/g, '');
}

function formatCep(value: string) {
    const digits = onlyDigits(value).slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function CheckoutHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
    return (
        <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
                <button type="button" onClick={onBack} className="rounded-full p-2 hover:bg-slate-100" aria-label="Voltar"><ArrowLeft className="h-7 w-7" /></button>
                <div className="min-w-0 flex-1"><h1 className="text-2xl font-black tracking-tight text-slate-950">{title}</h1>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div>
            </div>
        </header>
    );
}

function ReviewRow({ icon, title, description, missing, actionLabel, onClick }: {
    icon: React.ReactNode; title: string; description: string; missing?: boolean; actionLabel?: string; onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} className="flex w-full items-center gap-4 border-b border-slate-100 px-4 py-5 text-left last:border-b-0 hover:bg-slate-50">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${missing ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{icon}</span>
            <span className="min-w-0 flex-1"><span className="block text-base font-black text-slate-950">{title}</span><span className={`mt-0.5 block text-sm leading-relaxed ${missing ? 'font-bold text-red-600' : 'text-slate-500'}`}>{missing ? 'Preencher os dados' : description}</span></span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-slate-600">{actionLabel}<ChevronRight size={18} /></span>
        </button>
    );
}

export default function Checkout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { items, total, clearCart, updateQuantity, removeFromCart, addToCart, categoryRules, fulfillmentType, setFulfillment, context } = useCartStore();

    const [view, setView] = useState<CheckoutView>('cart');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('');
    const [needsChange, setNeedsChange] = useState(false);
    const [changeFor, setChangeFor] = useState('');
    const [cpf, setCpf] = useState('');
    const [notes, setNotes] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressState>(EMPTY_ADDRESS);
    const [cepLoading, setCepLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [addressError, setAddressError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const storeSlug = useMemo(() => new URLSearchParams(location.search).get('store')?.trim() || context?.canonicalSlug || DEFAULT_STORE_SLUG, [context?.canonicalSlug, location.search]);
    const storePath = `/s/${encodeURIComponent(storeSlug)}`;
    const totalValue = total();
    const baseSubtotal = items.reduce((sum, item) => sum + Number(item.originalPrice || item.price || 0) * item.quantity, 0);
    const discountTotal = Math.max(0, baseSubtotal - totalValue);
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
    const isTableContext = context?.type === 'table';
    const effectiveFulfillment = isTableContext ? 'table' : (fulfillmentType || 'pickup');
    const phoneValid = onlyDigits(clientPhone).length >= 10;
    const customerValid = Boolean(clientName.trim()) && phoneValid;
    const numberIsWithoutNumber = ['SN', 'S/N', 'SEM NUMERO', 'SEM NÚMERO'].includes(deliveryAddress.number.trim().toUpperCase());
    const addressValid = effectiveFulfillment !== 'delivery' || (
        onlyDigits(deliveryAddress.zipCode).length === 8
        && Boolean(deliveryAddress.street.trim())
        && Boolean(deliveryAddress.number.trim())
        && Boolean(deliveryAddress.district.trim())
        && Boolean(deliveryAddress.city.trim())
        && deliveryAddress.state.trim().length === 2
        && (!numberIsWithoutNumber || Boolean(deliveryAddress.complement.trim()))
    );
    const paymentValid = Boolean(paymentChoice) && (paymentChoice !== 'cash' || !needsChange || Number(changeFor.replace(',', '.')) >= totalValue);
    const fulfillmentValid = isTableContext || ['pickup', 'delivery'].includes(effectiveFulfillment);
    const checkoutValid = customerValid && addressValid && paymentValid && fulfillmentValid && items.length > 0;

    const hasEligibleDiscountProducts = useMemo(() => items.some((item) => {
        if (!item.category_id || !item.use_category_pricing) return false;
        const categoryRule = categoryRules[item.category_id];
        return Boolean(categoryRule?.pricingGroup?.rules?.length || categoryRule?.rules?.length);
    }), [categoryRules, items]);

    const openProduct = (product: Product) => { setSelectedProduct(product); setIsProductModalOpen(true); };
    const changeQuantity = (id: string, current: number, delta: number) => current + delta <= 0 ? removeFromCart(id) : updateQuantity(id, current + delta);
    const setDirectQuantity = (id: string, raw: string) => { const parsed = Math.trunc(Number(raw)); if (Number.isFinite(parsed)) updateQuantity(id, Math.max(1, parsed)); };
    const goToReview = () => { setError(null); setView('review'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const lookupCep = async () => {
        const cep = onlyDigits(deliveryAddress.zipCode);
        if (cep.length !== 8) { setAddressError('Informe um CEP válido com 8 dígitos.'); return; }
        try {
            setCepLoading(true); setAddressError(null);
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (!response.ok) throw new Error('cep_lookup_failed');
            const data = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
            if (data.erro) { setAddressError('CEP não encontrado. Confira ou preencha o endereço manualmente.'); return; }
            setDeliveryAddress((current) => ({ ...current, street: data.logradouro || current.street, district: data.bairro || current.district, city: data.localidade || current.city, state: data.uf || current.state }));
        } catch {
            setAddressError('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.');
        } finally { setCepLoading(false); }
    };

    const captureLocation = () => {
        if (!navigator.geolocation) { setAddressError('Este navegador não oferece localização. Continue com o endereço manual.'); return; }
        if (!window.isSecureContext) { setAddressError('A localização exige HTTPS. Neste teste em HTTP, continue com o endereço manual.'); return; }
        setLocationLoading(true); setAddressError(null);
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => { setDeliveryAddress((current) => ({ ...current, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy })); setLocationLoading(false); },
            () => { setAddressError('Não foi possível obter sua localização. Confira a permissão do navegador.'); setLocationLoading(false); },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
        );
    };

    const finishOrder = async () => {
        if (!checkoutValid) { setError('Confirme os blocos marcados em vermelho antes de finalizar.'); return; }
        const paymentLabel: Record<Exclude<PaymentChoice, ''>, string> = { pix_advance: 'Pix antecipado', pix_receive: 'Pix no recebimento', cash: 'Dinheiro', card: 'Cartão no recebimento', payment_link: 'Link de pagamento' };
        const paymentNote = paymentChoice ? `Pagamento: ${paymentLabel[paymentChoice]}` : '';
        const changeNote = paymentChoice === 'cash' && needsChange ? `Troco para: R$ ${changeFor}` : '';
        const locationNote = deliveryAddress.latitude && deliveryAddress.longitude ? `Localização: ${deliveryAddress.latitude},${deliveryAddress.longitude} (precisão ${Math.round(deliveryAddress.accuracy || 0)}m)` : '';
        try {
            setLoading(true); setError(null);
            const result = await PublicOrderService.createPublicOrder({
                slug: storeSlug,
                customer_name: clientName.trim(),
                customer_phone: onlyDigits(clientPhone),
                fulfillment_type: effectiveFulfillment,
                sales_channel: isTableContext ? 'qr_table' : 'public_store',
                payment_method_code: 'pending',
                delivery_method_code: effectiveFulfillment === 'delivery' ? 'delivery' : effectiveFulfillment === 'table' ? 'qr_table' : 'pickup',
                items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
                delivery_address: effectiveFulfillment === 'delivery' ? { street: deliveryAddress.street, number: deliveryAddress.number, complement: deliveryAddress.complement, district: deliveryAddress.district, city: deliveryAddress.city, state: deliveryAddress.state, zip_code: onlyDigits(deliveryAddress.zipCode), reference: deliveryAddress.reference } : {},
                table_code: context?.tableCode || null,
                notes: [notes.trim(), cpf.trim() ? `CPF: ${onlyDigits(cpf)}` : '', paymentNote, changeNote, locationNote].filter(Boolean).join('\n') || null,
            });
            if (!result.ok || !result.order) {
                if (['insufficient_stock', 'product_unavailable'].includes(result.error || '')) {
                    setError(`☹️ Que pena… ${result.product_name || 'Um produto que você queria'} não está mais disponível. Volte ao carrinho para revisar os itens.`);
                } else setError(result.message || 'Não foi possível criar o pedido.');
                return;
            }
            const trackingUrl = `${window.location.origin}/p/${encodeURIComponent(result.order.public_order_token)}`;
            const firstName = clientName.trim().split(/\s+/)[0] || 'Cliente';
            const message = [`Olá! Acabei de fazer o pedido nº *${compactOrderCode(result.order.order_code)}* pelo catálogo.`, '', `Meu nome é *${firstName}*.`, '', 'Acompanhar pedido:', trackingUrl].join('\n');
            const whatsappUrl = result.whatsapp?.digits && canOpenWhatsapp(result.whatsapp.digits) ? buildWhatsappUrl(result.whatsapp.digits, message) : result.whatsapp?.url;
            clearCart();
            navigate(storePath, { replace: true, state: { orderSuccess: { order_code: result.order.order_code, total: Number(result.order.total || 0), whatsapp_url: whatsappUrl, public_order_token: result.order.public_order_token, tracking_url: trackingUrl } } });
            if (whatsappUrl) window.setTimeout(() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer'), 150);
        } catch (err) {
            console.error('Erro ao finalizar pedido público:', err);
            setError('Não foi possível finalizar o pedido agora. Tente novamente.');
        } finally { setLoading(false); }
    };

    if (items.length === 0) return <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4"><ShoppingBag size={64} className="mb-4 text-slate-300" /><h1 className="text-xl font-black text-slate-800">Seu carrinho está vazio</h1><p className="mb-6 mt-2 text-center text-slate-500">Adicione produtos do cardápio para continuar.</p><Link to={storePath} className="rounded-full bg-emerald-600 px-8 py-3 text-sm font-bold text-white">Ver cardápio</Link></div>;

    if (view === 'cart') return (
        <div className="min-h-screen bg-white pb-32 text-slate-950">
            <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95"><div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4"><Link to={storePath} className="rounded-full p-2"><ArrowLeft className="h-7 w-7" /></Link><div className="min-w-0 flex-1"><h1 className="text-2xl font-black">Seu carrinho</h1><p className="text-slate-500">{totalUnits} {totalUnits === 1 ? 'item' : 'itens'}</p></div><button type="button" onClick={() => { if (window.confirm('Deseja realmente limpar seu carrinho?')) { clearCart(); navigate(storePath, { replace: true }); } }} className="flex items-center gap-1.5 px-3 py-2 font-bold text-red-600"><Trash2 size={18} /> Limpar</button></div></header>
            <main className="mx-auto max-w-3xl px-4 py-5"><section className="divide-y divide-slate-100">{items.map((item) => { const imageUrl = getItemImage(item); const original = Number(item.originalPrice || item.price || 0); const applied = Number(item.price || 0); const baseLine = original * item.quantity; const line = applied * item.quantity; const saving = Math.max(0, baseLine - line); return <article key={item.id} className="py-5 first:pt-1"><div className="flex gap-4"><button type="button" onClick={() => openProduct(item)} className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">{imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" /> : <ImageOff className="text-slate-300" />}</button><div className="min-w-0 flex-1"><button type="button" onClick={() => openProduct(item)} className="text-left"><h2 className="line-clamp-2 text-lg font-bold">{item.name}</h2></button><div className="mt-2 flex items-end justify-between gap-3"><div><div className="flex flex-wrap items-baseline gap-2"><p className="text-xl font-black text-emerald-700">R$ {formatBRL(line)}</p><p className="text-xs font-semibold text-emerald-700">R$ {formatBRL(applied)} un</p></div>{saving > 0.009 && <div className="mt-1 text-xs"><p className="flex gap-2 text-slate-400 line-through"><span>R$ {formatBRL(baseLine)}</span><span>R$ {formatBRL(original)} un</span></p><p className="mt-1 font-bold text-emerald-700">Economizou R$ {formatBRL(saving)}</p></div>}</div><div className="inline-flex h-11 items-center rounded-full border border-slate-300 px-1"><button type="button" onClick={() => changeQuantity(item.id, item.quantity, -1)} className="h-9 w-9"><Minus size={18} /></button><input type="number" min={1} value={item.quantity} onChange={(e) => setDirectQuantity(item.id, e.target.value)} className="h-9 w-10 text-center font-black outline-none" /><button type="button" onClick={() => changeQuantity(item.id, item.quantity, 1)} className="h-9 w-9"><Plus size={18} /></button></div></div><div className="mt-4 flex justify-between gap-3"><button type="button" className="text-sm font-semibold text-emerald-700">+ Adicionar observação</button><button type="button" onClick={() => removeFromCart(item.id)} className="text-sm font-bold text-red-600">Remover</button></div></div></div></article>; })}</section><Link to={storePath} className="mt-2 flex items-center justify-center gap-2 border-y border-slate-100 py-5 font-black text-emerald-700"><Plus size={20} /> Adicionar mais itens</Link>{hasEligibleDiscountProducts && <section className="my-5 rounded-2xl bg-emerald-50 px-4 py-4 text-emerald-900"><h2 className="font-black">Compre mais e aumente seu desconto</h2><p className="mt-1 text-sm font-medium">Comprando mais unidades dos produtos elegíveis o seu desconto aumenta! <button type="button" className="font-black underline">Saiba mais →</button></p></section>}</main>
            <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white px-4 pb-4 pt-3"><div className="mx-auto flex max-w-3xl items-center gap-4"><div className="flex-1"><p className="text-2xl font-black">R$ {formatBRL(totalValue)}</p>{discountTotal > 0.009 && <p className="text-sm font-bold text-emerald-700">Economizou R$ {formatBRL(discountTotal)}</p>}</div><button type="button" onClick={goToReview} className="flex min-h-14 items-center gap-3 rounded-2xl bg-emerald-600 px-6 text-lg font-black text-white">Continuar <span className="rounded-full bg-white px-2 py-1 text-sm text-emerald-700">{totalUnits}</span></button></div></div><ProductModal product={selectedProduct} isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onAddToCart={(product, quantity) => addToCart(product, quantity)} />
        </div>
    );

    if (view === 'fulfillment') return <div className="min-h-screen bg-slate-50 pb-24"><CheckoutHeader title="Entrega" subtitle="Escolha como deseja receber" onBack={() => setView('review')} /><main className="mx-auto max-w-3xl px-4 py-5"><section className="overflow-hidden rounded-2xl bg-white shadow-sm"><button type="button" onClick={() => { setFulfillment('pickup', 'pickup'); setView('review'); }} className="flex w-full items-center gap-4 border-b px-4 py-5 text-left"><Store /><span className="flex-1"><span className="block font-black">Retirar na loja</span><span className="text-sm text-slate-500">Sem taxa de entrega</span></span>{effectiveFulfillment === 'pickup' && <CheckCircle2 className="text-emerald-600" />}</button><button type="button" onClick={() => setFulfillment('delivery', 'delivery')} className="flex w-full items-center gap-4 px-4 py-5 text-left"><MapPin /><span className="flex-1"><span className="block font-black">Receber em casa</span><span className="text-sm text-slate-500">Informe o endereço para calcular condições</span></span>{effectiveFulfillment === 'delivery' && <CheckCircle2 className="text-emerald-600" />}</button></section>{effectiveFulfillment === 'delivery' && <section className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm"><h2 className="font-black">Endereço de entrega</h2><div className="flex gap-2"><input placeholder="CEP" inputMode="numeric" value={deliveryAddress.zipCode} onChange={(e) => setDeliveryAddress((s) => ({ ...s, zipCode: formatCep(e.target.value) }))} onBlur={() => { if (onlyDigits(deliveryAddress.zipCode).length === 8) void lookupCep(); }} className="min-w-0 flex-1 rounded-xl bg-slate-50 p-4" /><button type="button" onClick={() => void lookupCep()} disabled={cepLoading} className="rounded-xl border px-4 font-bold text-emerald-700">{cepLoading ? 'Buscando…' : 'Buscar'}</button></div><input placeholder="Rua" value={deliveryAddress.street} onChange={(e) => setDeliveryAddress((s) => ({ ...s, street: e.target.value }))} className="w-full rounded-xl bg-slate-50 p-4" /><div className="grid grid-cols-2 gap-3"><input placeholder="Número ou S/N" value={deliveryAddress.number} onChange={(e) => setDeliveryAddress((s) => ({ ...s, number: e.target.value }))} className="rounded-xl bg-slate-50 p-4" /><input placeholder={numberIsWithoutNumber ? 'Complemento obrigatório' : 'Complemento'} value={deliveryAddress.complement} onChange={(e) => setDeliveryAddress((s) => ({ ...s, complement: e.target.value }))} className="rounded-xl bg-slate-50 p-4" /></div><input placeholder="Bairro" value={deliveryAddress.district} onChange={(e) => setDeliveryAddress((s) => ({ ...s, district: e.target.value }))} className="w-full rounded-xl bg-slate-50 p-4" /><div className="grid grid-cols-[2fr_1fr] gap-3"><input placeholder="Cidade" value={deliveryAddress.city} onChange={(e) => setDeliveryAddress((s) => ({ ...s, city: e.target.value }))} className="rounded-xl bg-slate-50 p-4" /><input placeholder="UF" maxLength={2} value={deliveryAddress.state} onChange={(e) => setDeliveryAddress((s) => ({ ...s, state: e.target.value.toUpperCase() }))} className="rounded-xl bg-slate-50 p-4 uppercase" /></div><input placeholder="Ponto de referência" value={deliveryAddress.reference} onChange={(e) => setDeliveryAddress((s) => ({ ...s, reference: e.target.value }))} className="w-full rounded-xl bg-slate-50 p-4" /><button type="button" onClick={captureLocation} disabled={locationLoading} className="flex w-full items-center justify-center gap-2 rounded-xl border p-4 font-bold text-emerald-700"><LocateFixed size={19} />{deliveryAddress.latitude ? 'Localização adicionada' : locationLoading ? 'Obtendo localização…' : 'Usar minha localização atual'}</button>{addressError && <p className="text-sm font-bold text-red-600">{addressError}</p>}<button type="button" onClick={() => { if (!addressValid) { setAddressError('Preencha corretamente CEP, rua, número, bairro, cidade e UF. Para S/N, informe o complemento.'); return; } setAddressError(null); setView('review'); }} className="w-full rounded-2xl bg-emerald-600 p-4 font-black text-white">Salvar endereço</button></section>}</main></div>;

    if (view === 'customer') return <div className="min-h-screen bg-slate-50"><CheckoutHeader title="Seus dados" subtitle="Identificação do pedido" onBack={() => setView('review')} /><main className="mx-auto max-w-3xl px-4 py-5"><section className="space-y-3 rounded-2xl bg-white p-4"><input placeholder="Seu nome" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full rounded-xl bg-slate-50 p-4" /><input type="tel" placeholder="WhatsApp com DDD" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="w-full rounded-xl bg-slate-50 p-4" /><button type="button" onClick={() => setView('review')} className="w-full rounded-2xl bg-emerald-600 p-4 font-black text-white">Salvar dados</button></section></main></div>;

    if (view === 'payment') return <div className="min-h-screen bg-slate-50"><CheckoutHeader title="Pagamento" subtitle="As opções podem depender da entrega" onBack={() => setView('review')} /><main className="mx-auto max-w-3xl px-4 py-5"><section className="overflow-hidden rounded-2xl bg-white">{([['pix_advance','Pix antecipado'],['pix_receive','Pix no recebimento'],['cash','Dinheiro'],['card','Cartão no recebimento'],['payment_link','Link de pagamento']] as Array<[Exclude<PaymentChoice,''>,string]>).map(([code,label]) => <button key={code} type="button" onClick={() => setPaymentChoice(code)} className="flex w-full items-center gap-4 border-b px-4 py-5 text-left last:border-0"><Wallet /><span className="flex-1 font-black">{label}</span>{paymentChoice === code && <CheckCircle2 className="text-emerald-600" />}</button>)}</section>{paymentChoice === 'cash' && <section className="mt-4 space-y-3 rounded-2xl bg-white p-4"><p className="font-black">Precisa de troco?</p><div className="flex gap-3"><button type="button" onClick={() => setNeedsChange(false)} className={`flex-1 rounded-xl border p-3 font-bold ${!needsChange ? 'border-emerald-500 bg-emerald-50' : ''}`}>Não</button><button type="button" onClick={() => setNeedsChange(true)} className={`flex-1 rounded-xl border p-3 font-bold ${needsChange ? 'border-emerald-500 bg-emerald-50' : ''}`}>Sim</button></div>{needsChange && <input inputMode="decimal" placeholder="Troco para R$" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} className="w-full rounded-xl bg-slate-50 p-4" />}</section>}<button type="button" onClick={() => setView('review')} disabled={!paymentValid} className="mt-4 w-full rounded-2xl bg-emerald-600 p-4 font-black text-white disabled:opacity-40">Salvar pagamento</button></main></div>;

    if (view === 'cpf') return <div className="min-h-screen bg-slate-50"><CheckoutHeader title="CPF no documento" subtitle="Campo opcional" onBack={() => setView('review')} /><main className="mx-auto max-w-3xl px-4 py-5"><section className="space-y-3 rounded-2xl bg-white p-4"><input inputMode="numeric" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full rounded-xl bg-slate-50 p-4" /><button type="button" onClick={() => setView('review')} className="w-full rounded-2xl bg-emerald-600 p-4 font-black text-white">Salvar CPF</button></section></main></div>;
    if (view === 'notes') return <div className="min-h-screen bg-slate-50"><CheckoutHeader title="Observações" subtitle="Instruções gerais do pedido" onBack={() => setView('review')} /><main className="mx-auto max-w-3xl px-4 py-5"><section className="space-y-3 rounded-2xl bg-white p-4"><textarea rows={6} placeholder="Ex.: chamar no portão..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl bg-slate-50 p-4" /><button type="button" onClick={() => setView('review')} className="w-full rounded-2xl bg-emerald-600 p-4 font-black text-white">Salvar observações</button></section></main></div>;

    const fulfillmentDescription = effectiveFulfillment === 'delivery' ? (addressValid ? `${deliveryAddress.street}, ${deliveryAddress.number} — ${deliveryAddress.district}` : '') : effectiveFulfillment === 'table' ? `Mesa/comanda ${context?.tableCode || ''}` : 'Retirada na loja';
    const customerDescription = customerValid ? `${clientName} • ${clientPhone}` : '';
    const paymentDescription = paymentChoice ? ({ pix_advance:'Pix antecipado', pix_receive:'Pix no recebimento', cash: needsChange ? `Dinheiro • troco para R$ ${changeFor}` : 'Dinheiro • sem troco', card:'Cartão no recebimento', payment_link:'Link de pagamento' } as Record<Exclude<PaymentChoice,''>,string>)[paymentChoice] : '';

    return <div className="min-h-screen bg-slate-50 pb-32 text-slate-950"><CheckoutHeader title="Finalizar pedido" subtitle="Revise as informações antes de confirmar" onBack={() => setView('cart')} /><main className="mx-auto max-w-3xl space-y-4 px-4 py-5"><section className="overflow-hidden rounded-2xl bg-white shadow-sm"><ReviewRow icon={<MapPin size={21} />} title="Informações da entrega" description={fulfillmentDescription} missing={!fulfillmentValid || !addressValid} actionLabel="Alterar" onClick={() => setView('fulfillment')} /><ReviewRow icon={<UserRound size={21} />} title="Seus dados" description={customerDescription} missing={!customerValid} actionLabel="Alterar" onClick={() => setView('customer')} /><ReviewRow icon={<Wallet size={21} />} title="Pagamento" description={paymentDescription} missing={!paymentValid} actionLabel="Ver tudo" onClick={() => setView('payment')} /></section><section className="overflow-hidden rounded-2xl bg-white shadow-sm"><ReviewRow icon={<ShoppingBag size={21} />} title="Resumo do pedido" description={`${totalUnits} ${totalUnits === 1 ? 'item' : 'itens'} no carrinho`} actionLabel="Editar" onClick={() => setView('cart')} /><ReviewRow icon={<FileText size={21} />} title="CPF no documento" description={cpf.trim() ? `CPF final ${onlyDigits(cpf).slice(-4)}` : 'Não informado'} onClick={() => setView('cpf')} /><ReviewRow icon={<MessageSquareText size={21} />} title="Observações" description={notes.trim() || 'Nenhuma observação adicionada'} onClick={() => setView('notes')} /></section>{discountTotal > 0.009 && <section className="rounded-2xl bg-emerald-50 px-4 py-4"><h2 className="font-black">Economize hoje</h2><p className="mt-1 text-sm font-medium">Você economizou R$ {formatBRL(discountTotal)} com os descontos aplicados.</p></section>}<section className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><ReceiptText size={20} /><h2 className="font-black">Detalhes dos valores</h2></div><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>R$ {formatBRL(baseSubtotal)}</span></div>{discountTotal > 0.009 && <div className="flex justify-between font-bold text-emerald-700"><span>Descontos</span><span>- R$ {formatBRL(discountTotal)}</span></div>}<div className="flex justify-between"><span>Entrega*</span><span>{effectiveFulfillment === 'pickup' || effectiveFulfillment === 'table' ? 'Sem taxa' : 'A calcular'}</span></div><div className="flex justify-between"><span>Taxas*</span><span>A calcular</span></div><div className="flex justify-between border-t pt-3 text-base font-black"><span>Total parcial</span><span>R$ {formatBRL(totalValue)}</span></div></div><p className="mt-4 text-xs leading-relaxed text-slate-500">*Calculado após o preenchimento correto dos dados de entrega e pagamento.</p></section>{error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}</main><div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white px-4 pb-4 pt-3"><div className="mx-auto flex max-w-3xl items-center gap-4"><div className="flex-1"><p className="text-2xl font-black">R$ {formatBRL(totalValue)}</p>{discountTotal > 0.009 && <p className="text-sm font-bold text-emerald-700">Economizou R$ {formatBRL(discountTotal)}</p>}</div><button type="button" onClick={finishOrder} disabled={loading} title={checkoutValid ? 'Finalizar pedido' : 'Confirme os dados obrigatórios'} className={`flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl px-5 font-black text-white sm:flex-none ${checkoutValid ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-300'}`}>{loading ? 'Criando pedido...' : checkoutValid ? 'Finalizar pelo WhatsApp' : 'Confirme os dados'}{!loading && <Send size={19} />}</button></div></div></div>;
}
