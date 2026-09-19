import { useEffect, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerAccountPortal } from '@/pages/store/components/CustomerAccountPortal';
import { CustomerAuthPortal } from '@/pages/store/components/CustomerAuthPortal';
import { PublicStorefrontService } from '@/services/publicStorefrontService';
import { AuthService } from '@/services/customerAuth';
import {
    activateCustomerCart,
    configureCustomerCartRetention,
    deactivateCustomerCart,
    prepareCustomerCartForSessionRestore,
    syncCustomerCartCatalog,
} from '@/services/customerCartPersistence';
import { useCartStore } from '@/store/useCartStore';
import { useCustomerAuth } from '@/store/useCustomerAuth';
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
    const navigate = useNavigate();
    const items = useCartStore((state) => state.items);
    const context = useCartStore((state) => state.context);
    const customer = useCustomerAuth((state) => state.customer);
    const isAuthenticated = useCustomerAuth((state) => state.isAuthenticated);
    const sessionRestored = useCustomerAuth((state) => state.sessionRestored);
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
    const isCheckoutRoute = location.pathname === '/checkout';

    useLayoutEffect(() => {
        const root = document.documentElement;
        const previousDark = root.classList.contains('dark');

        // A loja pública tem fronteira visual própria. Ela inicia em modo claro para
        // não herdar inadvertidamente o tema do painel administrativo ou do sistema.
        root.classList.remove('dark');
        root.dataset.storefrontTheme = 'light';

        // Se havia um carrinho pertencente a um cliente autenticado, não o exibe
        // até a sessão ser revalidada pelo backend.
        prepareCustomerCartForSessionRestore();

        return () => {
            root.classList.toggle('dark', previousDark);
            delete root.dataset.storefrontTheme;
        };
    }, []);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [location.pathname, location.search]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const verification = params.get('emailVerification');
        if (!verification) return;

        if (verification === 'success') {
            void AuthService.restoreSession()
                .then(() => {
                    toast.success('E-mail confirmado com sucesso. Sua conta foi atualizada.');
                })
                .catch(() => {
                    toast.success('E-mail confirmado. Atualize sua conta se os dados ainda não aparecerem.');
                });
        } else if (verification === 'invalid') {
            toast.error('O link de confirmação de e-mail é inválido.');
        } else {
            toast.error('Não foi possível concluir a confirmação de e-mail. Solicite um novo link.');
        }

        params.delete('emailVerification');
        const nextSearch = params.toString();
        navigate(
            {
                pathname: location.pathname,
                search: nextSearch ? `?${nextSearch}` : '',
            },
            { replace: true },
        );
    }, [location.pathname, location.search, navigate]);

    useEffect(() => {
        if (!sessionRestored) return;

        if (isAuthenticated && customer) {
            activateCustomerCart(customer.id, customer.store_id);
            return;
        }

        deactivateCustomerCart();
    }, [customer, isAuthenticated, sessionRestored]);

    useEffect(() => {
        if (!storeSlug || !context?.storeId) return;

        let active = true;

        void Promise.all([
            PublicStorefrontService.getStorefrontBySlug(storeSlug),
            PublicStorefrontService.getCatalogBySlug(storeSlug),
        ])
            .then(([storefront, catalog]) => {
                if (!active) return;

                configureCustomerCartRetention(
                    context.storeId,
                    storefront.store?.visual_config?.customer_cart_retention_hours,
                );

                const products = (catalog.categories || []).flatMap((category) =>
                    (category.products || []).map((product) => ({
                        ...product,
                        category_id: product.category_id || category.id,
                    })),
                );
                syncCustomerCartCatalog(context.storeId, products);
            })
            .catch((error) => {
                console.error('Não foi possível aplicar a política do carrinho público:', error);
            });

        return () => {
            active = false;
        };
    }, [context?.storeId, storeSlug]);

    return (
        <div className={`min-h-screen ${isCheckoutRoute ? '' : 'pb-24 sm:pb-0'}`}>
            <main className="transition-all duration-300">
                {children}
            </main>

            {sessionRestored && isAuthenticated && customer ? (
                <CustomerAccountPortal />
            ) : (
                <CustomerAuthPortal
                    storeSlug={storeSlug}
                    storeId={context?.storeId || null}
                />
            )}

            {!isCheckoutRoute && cartCount > 0 && (
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
