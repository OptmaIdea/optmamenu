import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { formatBRL } from '@/utils/pricing';

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
    const items = useCartStore((state) => state.items);
    const context = useCartStore((state) => state.context);
    const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);
    const cartTotal = items.reduce(
        (acc, item) => acc + Number(item.price || 0) * item.quantity,
        0,
    );
    const storeSlug = context?.canonicalSlug || getStoreSlugFromPath(location.pathname);
    const checkoutPath = storeSlug
        ? `/checkout?store=${encodeURIComponent(storeSlug)}`
        : '/checkout';
    const isTableContext = context?.type === 'table';

    return (
        <div className="min-h-screen pb-24 sm:pb-0">
            <main className="transition-all duration-300">
                {children}
            </main>

            {cartCount > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[26rem] sm:px-0 sm:pb-0">
                    <Link
                        to={checkoutPath}
                        className="flex min-h-16 items-center gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-2xl transition hover:bg-emerald-700 active:scale-[0.99]"
                        aria-label={isTableContext ? 'Ver comanda' : 'Ver carrinho'}
                    >
                        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                            <ShoppingCart size={23} aria-hidden="true" />
                            <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-emerald-600 bg-white px-1 text-xs font-black text-emerald-700">
                                {cartCount}
                            </span>
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-emerald-50">
                                {cartCount} {cartCount === 1 ? 'item' : 'itens'}
                            </span>
                            <span className="block truncate text-lg font-black">
                                R$ {formatBRL(cartTotal)}
                            </span>
                        </span>

                        <span className="shrink-0 text-sm font-bold">
                            {isTableContext ? 'Ver comanda' : 'Ver carrinho'}
                        </span>
                    </Link>
                </div>
            )}

            <footer className="hidden sm:block mt-12 text-center text-gray-400 text-sm pb-8">
                <p>© {new Date().getFullYear()} <a href="https://www.optmaidea.com.br/" target="_blank" rel="noopener noreferrer" className="hover:underline">OptmaIdea</a>. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
}
