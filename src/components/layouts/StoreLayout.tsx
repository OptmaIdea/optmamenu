import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';

function getStoreSlugFromPath(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;

    const [prefix, slug] = segments;
    if (['s', 'loja', 'cardapio', 'q', 'mesa'].includes(prefix) && slug) {
        return slug;
    }

    return null;
}

export function StoreLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const { items } = useCartStore();
    const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);
    const storeSlug = getStoreSlugFromPath(location.pathname);
    const checkoutPath = storeSlug
        ? `/checkout?store=${encodeURIComponent(storeSlug)}`
        : '/checkout';

    return (
        <div className="min-h-screen">
            {/* StoreLayout now only provides the floating actions (Cart)
                The specific store header and content width are handled by the page components */}

            {/* Main Content Area */}
            <main className="transition-all duration-300">
                {children}
            </main>

            {/* Floating Action Buttons */}
            <div className="fixed bottom-6 right-4 z-40 flex flex-col gap-4 items-end">
                {/* Cart FAB */}
                <Link
                    to={checkoutPath}
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
                <p>© {new Date().getFullYear()} <a href="https://www.optmaidea.com.br/" target="_blank" rel="noopener noreferrer" className="hover:underline">OptmaIdea</a>. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
}
