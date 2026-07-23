import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, QrCode, Store, Copy, CheckCircle2, Send, ShoppingBag, Trash2 } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';

const DEFAULT_STORE_SLUG = 'gelinharessjn';

export default function Checkout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { items, total, clearCart } = useCartStore();
    const [clientName, setClientName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'retirada'>('pix');
    const [loading, setLoading] = useState(false);

    const storeSlug = useMemo(() => {
        const querySlug = new URLSearchParams(location.search).get('store')?.trim();
        return querySlug || DEFAULT_STORE_SLUG;
    }, [location.search]);

    const storePath = `/s/${encodeURIComponent(storeSlug)}`;

    const handleClearCart = () => {
        if (window.confirm('Deseja realmente limpar seu carrinho?')) {
            clearCart();
            alert('Carrinho limpo com sucesso!');
            navigate(storePath, { replace: true });
        }
    };

    useEffect(() => {
        if (items.length === 0) {
            // O usuário pode voltar manualmente ao cardápio pelo botão abaixo.
        }
    }, [items]);

    const totalValue = total();

    const handleCopyPix = async () => {
        const pixCode = '00020126360014BR.GOV.BCB.PIX011400000000000000520400005303986540528.505802BR5910GELINHARES6008LINHARES62070503***6304';
        try {
            await navigator.clipboard.writeText(pixCode);
            alert('Código Pix Copiado! Agora pague no seu App de banco e anexe o comprovante no WhatsApp.');
        } catch {
            const textArea = document.createElement('textarea');
            textArea.value = pixCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('Código Pix Copiado! Agora pague no seu App de banco e anexe o comprovante no WhatsApp.');
        }
    };

    const finishOrder = () => {
        if (!clientName.trim()) {
            alert('Por favor, informe seu nome para o pedido.');
            return;
        }

        setLoading(true);

        const itemsList = items.map(item => `- ${item.quantity}x ${item.name}`).join('\n');
        const paymentText = paymentMethod === 'pix' ? '✅ PIX ANTECIPADO (Copia e Cola)' : '🏧 PAGAR NA RETIRADA';

        const texto = encodeURIComponent(
            `*NOVO PEDIDO - GeLINHARES*\n` +
            `------------------------------\n` +
            `👤 *Cliente:* ${clientName}\n` +
            `🍦 *Itens:* \n${itemsList}\n` +
            `💰 *Total:* R$ ${totalValue.toFixed(2).replace('.', ',')}\n` +
            `------------------------------\n` +
            `💳 *Pagamento:* ${paymentText}\n\n` +
            (paymentMethod === 'pix' ? '_Estou enviando o comprovante abaixo..._' : '_Vou pagar ao retirar o pedido._')
        );

        window.open(`https://wa.me/5562999944838?text=${texto}`, '_blank');

        setTimeout(() => {
            clearCart();
            navigate(storePath, {
                replace: true,
                state: {
                    orderSubmitted: true,
                    customerName: clientName.trim(),
                },
            });
        }, 1000);
    };

    if (items.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
                <ShoppingBag size={64} className="text-gray-300 mb-4" />
                <p className="text-gray-500 mb-6 font-medium">Seu carrinho está vazio.</p>
                <Link to={storePath} className="bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-green-700 transition uppercase text-sm tracking-wide">
                    Voltar ao Cardápio
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
                <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Finalizar Pedido</h1>
            </header>

            <main className="max-w-2xl mx-auto px-4 mt-6">
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Seu Carrinho</h2>
                        <button
                            onClick={handleClearCart}
                            className="text-[10px] font-bold text-red-500 hover:text-red-600 transition flex items-center gap-1.5 active:scale-95 uppercase tracking-widest"
                            title="Limpar Carrinho"
                        >
                            <Trash2 size={12} className="opacity-70" />
                            Limpar Carrinho
                        </button>
                    </div>
                    <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                        {items.map((item, index) => (
                            <div
                                key={item.id}
                                className={`flex justify-between items-center text-sm ${index !== items.length - 1 ? 'border-b border-gray-50 pb-2 mb-2' : ''}`}
                            >
                                <span className="text-gray-600 font-medium">{item.quantity}x {item.name}</span>
                                <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-4 mb-8">
                    <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 italic">Identificação</h2>
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                        <input
                            type="text"
                            placeholder="Seu Nome"
                            value={clientName}
                            onChange={(event) => setClientName(event.target.value)}
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-400 outline-none text-sm font-medium"
                        />
                    </div>
                </section>

                <section className="space-y-4 mb-8">
                    <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 italic">Forma de Pagamento</h2>
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                        <div className="grid grid-cols-1 gap-3">
                            <label
                                className={`relative flex items-center p-4 rounded-2xl border-2 cursor-pointer transition ${paymentMethod === 'pix' ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}
                                onClick={() => setPaymentMethod('pix')}
                            >
                                <input type="radio" name="pay-method" value="pix" className="hidden" checked={paymentMethod === 'pix'} readOnly />
                                <QrCode className="w-5 h-5 mr-3 text-green-600" />
                                <span className="font-bold text-gray-700 text-sm">Pix Antecipado</span>
                                {paymentMethod === 'pix' && <CheckCircle2 className="w-5 h-5 ml-auto text-green-600" />}
                            </label>

                            <label
                                className={`relative flex items-center p-4 rounded-2xl border-2 cursor-pointer transition ${paymentMethod === 'retirada' ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}
                                onClick={() => setPaymentMethod('retirada')}
                            >
                                <input type="radio" name="pay-method" value="retirada" className="hidden" checked={paymentMethod === 'retirada'} readOnly />
                                <Store className="w-5 h-5 mr-3 text-gray-400" />
                                <span className="font-bold text-gray-700 text-sm">Pagar na Retirada</span>
                                {paymentMethod === 'retirada' && <CheckCircle2 className="w-5 h-5 ml-auto text-green-600" />}
                            </label>
                        </div>

                        {paymentMethod === 'pix' && (
                            <div className="mt-6 pt-6 border-t border-dashed border-gray-200 animate-fade-in">
                                <div className="pix-gradient rounded-3xl p-6 flex flex-col items-center">
                                    <div className="bg-white p-3 rounded-2xl shadow-sm mb-4">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Gelinhares_Pagamento_${totalValue.toFixed(2)}`}
                                            alt="QR Code Pix"
                                            className="w-32 h-32 opacity-80"
                                        />
                                    </div>

                                    <div className="w-full space-y-3 text-center">
                                        <p className="text-[11px] font-bold text-green-800 uppercase tracking-wider leading-tight">
                                            Clique abaixo para copiar a chave <br />e pagar no seu banco
                                        </p>

                                        <div className="relative group">
                                            <input
                                                type="text"
                                                readOnly
                                                value="00020126360014BR.GOV.BCB.PIX011400000000000000520400005303986540528.505802BR5910GELINHARES6008LINHARES62070503***6304"
                                                className="w-full bg-white/60 p-3 pr-12 rounded-xl text-[10px] text-gray-500 border border-green-200 focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCopyPix}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-green-600 text-white rounded-lg active:scale-90 transition"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <p className="text-[10px] text-green-700 italic">
                                            *O comprovante deve ser enviado no próximo passo.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t">
                    <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                        <div>
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Geral</span>
                            <span className="text-2xl font-black text-green-600 italic tracking-tighter">R$ {totalValue.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <button
                            onClick={finishOrder}
                            disabled={loading}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-xl shadow-green-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Enviando...' : 'Enviar para WhatsApp'}
                            {!loading && <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
