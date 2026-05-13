import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { CartDrawer } from '@/pages/store/components/CartDrawer';

export function StoreLayout({ children }: { children: React.ReactNode }) {
    const { items } = useCartStore();
    const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

    return (
        <div className="min-h-screen">
            {/* StoreLayout now only provides the floating actions (WhatsApp, Cart) 
                The specific store header and content width are handled by the page components */}

            {/* Main Content Area */}
            <main className="transition-all duration-300">
                {children}
            </main>

            <CartDrawer />

            {/* Floating Action Buttons */}
            <div className="fixed bottom-6 right-4 z-40 flex flex-col gap-4 items-end">
                {/* WhatsApp Button */}
                <a
                    href="https://wa.me/5532999999999"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-green-500 text-white p-3 rounded-full shadow-lg hover:bg-green-600 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center w-12 h-12"
                    aria-label="Fale Conosco no WhatsApp"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
                    </svg>
                </a>

                {/* Cart FAB */}
                <Link
                    to="/checkout"
                    className="bg-orange-500 text-white p-4 rounded-full shadow-2xl hover:bg-orange-600 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center relative"
                    aria-label="Abrir Carrinho"
                >
                    <ShoppingCart size={28} />
                    {cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                            {cartCount}
                        </span>
                    )}
                </Link>
            </div>

            {/* Desktop Footer */}
            <footer className="hidden sm:block mt-12 text-center text-gray-400 text-sm pb-8">
                <p>© 2026 OptmaIdea. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
}