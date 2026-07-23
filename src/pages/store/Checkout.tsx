import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Send, ShoppingBag, Store, Trash2, Wallet } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { PublicOrderService } from '@/services/publicOrderService';
import { buildWhatsappUrl, canOpenWhatsapp } from '@/utils/whatsapp';

const DEFAULT_STORE_SLUG = 'gelinharessjn';

type PaymentChoice = 'pending';

function compactOrderCode(orderCode: string) {
    const suffix = orderCode.split('-').pop();
    return suffix ? `#${suffix}` : orderCode;
}

export default function Checkout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { items, total, clearCart } = useCartStore();

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

    const handleClearCart = () => {
        if (!window.confirm('Deseja realmente limpar seu carrinho?')) return;
        clearCart();
        navigate(storePath, { replace: true });
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
                <p className="text-gray-500 mb-6 font-medium">Seu carrinho está vazio.</p>
                <Link to={storePath} className="bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-green-700 transition uppercase text-sm tracking-wide">
                    Voltar ao cardápio
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32 font-sans">
            <header className="bg-white p-4 sticky top-0 z-40 border-b flex items-center gap-4">
                <Link to={storePath} className="p-2 hover:bg-gray-100 rounded-full transition">
                    <ArrowLeft className="w-6 h-6 text-gray-700" />
                </Link>
                <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Finalizar pedido</h1>
            </header>

            <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Seu carrinho</h2>
                        <button type="button" onClick={handleClearCart} className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                            <Trash2 size={14} /> Limpar
                        </button>
                    </div>
                    <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                        {items.map((item, index) => (
                            <div key={item.id} className={`flex justify-between items-center text-sm ${index !== items.length - 1 ? 'border-b border-gray-100 pb-3 mb-3' : ''}`}>
                                <span className="text-gray-600 font-medium">{item.quantity}x {item.name}</span>
                                <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                            </div>
                        ))}
                    </div>
                </section>

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
                        <span className="text-2xl font-black text-green-600">R$ {totalValue.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <button type="button" onClick={finishOrder} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-3 disabled:opacity-60">
                        {loading ? 'Criando pedido...' : 'Finalizar pelo WhatsApp'}
                        {!loading && <Send className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
