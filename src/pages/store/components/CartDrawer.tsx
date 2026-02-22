import { X, Minus, Plus, Trash2, ShoppingBag, Send, QrCode, Copy, Loader, User } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

import type { StoreConfig } from '@/types';

interface CartDrawerProps {
    store?: {
        id: string;
        name: string;
        contacts?: {
            whatsapp_business?: string;
        };
        config?: StoreConfig;
    };
    isOrderingAllowed?: boolean; // New Prop
    blockingMessage?: string;    // New Prop
}

export function CartDrawer({ store, isOrderingAllowed = true, blockingMessage }: CartDrawerProps) {
    const {
        items,
        removeFromCart,
        updateQuantity,
        total,
        isCartOpen,
        closeCart,
        clearCart
    } = useCartStore();

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'retirada'>('pix');
    const [copied, setCopied] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

    if (!isCartOpen) return null;

    const cartTotal = total();
    // Use store WhatsApp if available, else fallback to default
    const BUSINESS_WHATSAPP = store?.contacts?.whatsapp_business?.replace(/\D/g, '') || '5532999999999';

    // Formatação simples de telefone BR
    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, "").substring(0, 11);
        if (numbers.length <= 2) return numbers;
        if (numbers.length <= 6) return `(${numbers.substring(0, 2)}) ${numbers.substring(2)}`;
        if (numbers.length <= 10) return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 6)}-${numbers.substring(6)}`;
        return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7)}`;
    };

    const safeClearCart = () => {
        if (typeof clearCart === 'function') {
            clearCart();
        } else {
            console.warn('clearCart not found in store');
        }
    };

    const handleSendOrder = async () => {
        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (!customerName.trim() || phoneDigits.length < 10) {
            alert('⚠️ Preencha seu nome completo e telefone válido (com DDD)');
            return;
        }

        if (!consentAccepted) {
            alert('⚠️ É necessário concordar com o envio de mensagens para continuar.');
            return;
        }

        // New Guard: Check Store Status
        if (!isOrderingAllowed) {
            alert(`⛔ ${blockingMessage || "A loja não está aceitando pedidos no momento."}`);
            return;
        }

        if (!store?.id) {
            alert('Erro: Loja não identificada. Recarregue a página.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Updated to use Inventory Control System RPC
            // This checks stock availability and creates a reservation atomically
            const { data: result, error: rpcError } = await supabase.rpc('create_order_with_reservation', {
                p_store_id: store.id,
                p_customer_name: customerName,
                p_customer_phone: customerPhone,
                p_total: cartTotal,
                p_payment_method: paymentMethod === 'retirada' ? 'pending' : paymentMethod,
                p_items: items.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity,
                    unit_price: item.price
                }))
            });

            if (rpcError) throw rpcError;

            // Handle functional failure (e.g. Insufficient Stock)
            if (!result || !result.success) {
                alert(`⚠️ Problema no pedido: ${result?.message || 'Estoque indisponível para algum item.'}`);
                return;
            }

            const orderId = result.order_id;

            // 3. Send to WhatsApp (re-using ID from RPC)
            const orderIdDisplay = String(orderId).slice(0, 8).toUpperCase();

            const itemsText = items.map(item =>
                `• *${item.quantity}x ${item.name}*\n   (R$ ${item.price.toFixed(2).replace('.', ',')}) = R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}`
            ).join('\n');

            const paymentText = paymentMethod === 'pix' ? "Pix" : "Dinheiro / Cartão na Retirada";

            // Calculate reservation time (Now + Configured Time)
            const reservationMinutes = store?.config?.timer_duration_minutes || 10;
            const reservationDate = new Date();
            reservationDate.setMinutes(reservationDate.getMinutes() + reservationMinutes);
            const reservationTime = reservationDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const warningText = paymentMethod === 'pix'
                ? `⚠️ *Atenção:* Você precisa enviar o comprovante do pix ou retirar seu pedido até ${reservationTime} (Reserva de ${reservationMinutes} min). Após esse horário o pedido poderá ser cancelado.`
                : `⚠️ *Atenção:* Seu pedido ficará reservado até ${reservationTime} (Reserva de ${reservationMinutes} min). Após esse horário o pedido poderá ser cancelado.`;

            const finalWhatsappMessage = `
🔔 *Novo pedido via App - #${orderIdDisplay}*

🛒 *Loja:* ${store.name}
👤 *Cliente:* ${customerName}
📞 *Fone:* ${customerPhone}

📋 *Itens:*
${itemsText}

💰 *Total: R$ ${cartTotal.toFixed(2).replace('.', ',')}*
💳 *Pagamento:* ${paymentText}

${warningText}
------------------------------------
_Agradecemos seu pedido!_
                `.trim();

            const encodedMessage = encodeURIComponent(finalWhatsappMessage);
            const waUrl = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodedMessage}`;

            window.open(waUrl, '_blank');

            safeClearCart();
            closeCart();

        } catch (error: any) {
            console.error('Erro ao processar pedido:', error);
            alert('Houve um erro ao registrar seu pedido: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyPixKey = () => {
        const fakePixKey = "gelinhare@provedor.com.br";
        navigator.clipboard.writeText(fakePixKey).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
            alert('Erro ao copiar. Selecione manualmente: ' + fakePixKey);
        });
    };


    const handleOpenCheckout = () => {
        if (items.length === 0) return;
        setIsCheckoutModalOpen(true);
    };

    const handleFinalize = () => {
        // This replaces the old direct send. Now we validate and send.
        handleSendOrder();
    };

    return (
        <>
            <div className="fixed inset-0 z-[60] flex justify-end animate-fade-in pointer-events-none">
                {/* Backdrop */}
                {isCartOpen && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={closeCart} />
                )}

                <div className={`relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col pt-16 sm:pt-4 pointer-events-auto transform transition-transform duration-300 ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <button
                        onClick={closeCart}
                        className="absolute top-4 left-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-700"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-4 border-b border-gray-100 flex items-center justify-between mt-8 sm:mt-0">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                            <ShoppingBag className="text-green-600" />
                            Seu Carrinho
                        </h2>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={safeClearCart}
                                className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition flex items-center gap-1"
                                title="Limpar Carrinho"
                            >
                                <Trash2 size={14} /> Limpar
                            </button>
                            <span className="text-sm font-medium text-gray-500">{items.length} itens</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                                <ShoppingBag size={48} className="opacity-20" />
                                <p>Seu carrinho está vazio.</p>
                                <button
                                    onClick={closeCart}
                                    className="text-green-600 font-semibold hover:underline"
                                >
                                    Voltar às compras
                                </button>
                            </div>
                        ) : (
                            items.map(item => (
                                <div key={item.id} className="flex gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-gray-100">
                                        <img
                                            src={item.images?.[0] || item.image_url || 'https://placehold.co/100x100?text=Foto'}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Foto'; }}
                                        />
                                    </div>

                                    <div className="flex-1 flex flex-col justify-between py-1">
                                        <div>
                                            <h3 className="font-semibold text-gray-800 line-clamp-1">{item.name}</h3>
                                            <p className="text-green-600 font-bold">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                                                <button
                                                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                                    className="p-1 hover:bg-gray-100 rounded text-gray-600"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="text-sm w-6 text-center font-bold text-gray-700">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    className="p-1 hover:bg-gray-100 rounded text-gray-600"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="text-red-400 p-2 hover:bg-red-50 rounded-full transition-colors"
                                                aria-label="Remover item"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {items.length > 0 && (
                        <div className="p-3 border-t border-gray-100 bg-white space-y-3 safe-area-bottom pb-4">
                            <div className="flex gap-3 items-stretch pt-2">
                                <div className="flex flex-col justify-center px-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
                                    <span className="text-lg font-black text-green-600 whitespace-nowrap">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                                </div>

                                <button
                                    onClick={handleOpenCheckout}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl shadow-lg shadow-green-200 uppercase tracking-wider transition-transform active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span className="text-sm">Finalizar Pedido</span>
                                </button>
                            </div>

                            {!isOrderingAllowed && (
                                <p className="text-xs text-red-500 text-center font-bold bg-red-50 p-2 rounded-lg border border-red-100">
                                    ⛔ {blockingMessage}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* CHECKOUT MODAL POPUP */}
            {isCheckoutModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCheckoutModalOpen(false)}></div>
                    <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 relative z-10 max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsCheckoutModalOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-700"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
                            <User size={24} className="text-brand-green" /> Dados do Cliente
                        </h3>

                        <div className="space-y-4">
                            {/* Customer Info */}
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Seu Nome *</label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Ex: Maria Silva"
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-400 outline-none text-base text-gray-800 font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Telefone * (com DDD)</label>
                                    <input
                                        type="tel"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                                        placeholder="(27) 9 9999-9999"
                                        maxLength={16}
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-400 outline-none text-base text-gray-800 font-medium"
                                    />
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="space-y-1 pt-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Pagamento *</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition h-24 text-center ${paymentMethod === 'pix' ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-200'}`} onClick={() => setPaymentMethod('pix')}>
                                        <input type="radio" name="payment-method" checked={paymentMethod === 'pix'} onChange={() => setPaymentMethod('pix')} className="hidden" />
                                        <QrCode className={`w-6 h-6 mb-2 ${paymentMethod === 'pix' ? 'text-green-600' : 'text-gray-400'}`} />
                                        <span className="font-bold text-gray-700 text-sm">Pix</span>
                                    </label>

                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition h-24 text-center ${paymentMethod === 'retirada' ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-200'}`} onClick={() => setPaymentMethod('retirada')}>
                                        <input type="radio" name="payment-method" checked={paymentMethod === 'retirada'} onChange={() => setPaymentMethod('retirada')} className="hidden" />
                                        <ShoppingBag className={`w-6 h-6 mb-2 ${paymentMethod === 'retirada' ? 'text-green-600' : 'text-gray-400'}`} />
                                        <span className="font-bold text-gray-700 text-sm">Na Entrega</span>
                                    </label>
                                </div>
                            </div>

                            {/* QR Code - Collapsible */}
                            {paymentMethod === 'pix' && (
                                <details className="group bg-green-50 rounded-xl border border-green-100">
                                    <summary className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700 p-3 select-none">
                                        <QrCode size={16} /> <span>Ver QR Code Pix</span> <span className="ml-auto opacity-70">Expandir</span>
                                    </summary>
                                    <div className="p-4 bg-white m-1 rounded-lg text-center animate-fade-in-down border border-green-50">
                                        <div className="bg-white p-2 rounded-lg mb-2 shadow-sm inline-block border border-gray-100">
                                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GELINHARES_PAGAMENTO_${cartTotal.toFixed(2)}`} alt="QR Code" className="w-32 h-32 opacity-90" />
                                        </div>
                                        <div className="relative w-full">
                                            <input type="text" readOnly value="gelinhare@provedor.com.br" className="w-full bg-gray-50 p-3 pr-10 rounded-lg text-xs text-center text-gray-600 border border-gray-200 font-mono" />
                                            <button onClick={copyPixKey} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-green-600 hover:text-green-800 transition">
                                                {copied ? <span className="font-bold">✓</span> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </details>
                            )}

                            {/* Consent Checkbox */}
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 mt-4">
                                <input
                                    type="checkbox"
                                    id="consent-check"
                                    checked={consentAccepted}
                                    onChange={(e) => setConsentAccepted(e.target.checked)}
                                    className="mt-1 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                                />
                                <label htmlFor="consent-check" className="text-xs text-gray-500 cursor-pointer leading-relaxed">
                                    {store?.config?.custom_consent_text || 'Concordo em receber mensagens automáticas via WhatsApp/SMS sobre o andamento do meu pedido e que ao clicar em Enviar, serei redirecionado ao WhatsApp.'}
                                </label>
                            </div>

                            <button
                                onClick={handleFinalize}
                                disabled={isSubmitting || !isOrderingAllowed}
                                className={`w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-xl shadow-lg shadow-green-200 uppercase tracking-wider transition-transform active:scale-95 flex items-center justify-center gap-2 mt-4 text-lg ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''} ${!isOrderingAllowed ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? <Loader className="animate-spin" size={24} /> : <><span className="">Enviar Pedido</span><Send size={24} /></>}
                            </button>

                            {!isOrderingAllowed ? (
                                <p className="text-center text-red-500 text-xs font-bold mt-2">⛔ {blockingMessage}</p>
                            ) : (
                                <p className="text-center text-gray-400 text-[10px] mt-2">
                                    Você vai abrir um aplicativo externo (WhatsApp) e sairá dessa página para enviar seu pedido.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}