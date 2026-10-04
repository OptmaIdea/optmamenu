import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CustomerAccountPortal } from '@/pages/store/components/CustomerAccountPortal';
import { CustomerAuthPortal } from '@/pages/store/components/CustomerAuthPortal';
import { StorefrontBottomNavigation } from '@/pages/store/components/StorefrontBottomNavigation';
import { StoreHubPortal } from '@/pages/store/components/StoreHubPortal';
import { PublicStorefrontService, type PublicStorefrontStore } from '@/services/publicStorefrontService';
import { AuthService } from '@/services/customerAuth';
import {
    activateCustomerCart,
    configureCustomerCartRetention,
    deactivateCustomerCart,
    prepareCustomerCartForSessionRestore,
    syncCustomerCartCatalog,
    flushCustomerCartServerSync,
} from '@/services/customerCartPersistence';
import { useCartStore } from '@/store/useCartStore';
import { useCustomerAuth } from '@/store/useCustomerAuth';

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

    const isStoreCatalogRoute = Boolean(getStoreSlugFromPath(location.pathname));
    const [publicStore, setPublicStore] = useState<PublicStorefrontStore | null>(null);
    const [storeHubOpen, setStoreHubOpen] = useState(false);

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
        const verification =
            params.get('emailVerificationResult')
            || params.get('emailVerification');
        if (!verification) return;

        if (verification === 'success') {
            toast.success(
                isAuthenticated
                    ? 'E-mail confirmado com sucesso. Atualize seus dados para refletir a confirmação.'
                    : 'E-mail confirmado com sucesso. Você já pode voltar à sua conta.',
            );
        } else if (verification === 'used') {
            toast.info('Este link de confirmação já foi utilizado.');
        } else if (verification === 'expired') {
            toast.error('Este link de confirmação expirou. Solicite um novo e-mail.');
        } else if (verification === 'invalid') {
            toast.error('O link de confirmação de e-mail é inválido.');
        } else {
            toast.error('Não foi possível concluir a confirmação de e-mail. Solicite um novo link.');
        }

        params.delete('emailVerificationResult');
        params.delete('emailVerification');
        const nextSearch = params.toString();
        navigate(
            {
                pathname: location.pathname,
                search: nextSearch ? `?${nextSearch}` : '',
            },
            { replace: true },
        );
    }, [isAuthenticated, location.pathname, location.search, navigate]);

    useEffect(() => {
        if (!sessionRestored) return;

        if (isAuthenticated && customer) {
            activateCustomerCart(customer.id, customer.store_id);
            return;
        }

        deactivateCustomerCart();
    }, [customer, isAuthenticated, sessionRestored]);

    useEffect(() => {
        if (!sessionRestored || !isAuthenticated || !customer) return;

        let active = true;
        let alreadyReported = false;

        const checkSession = async () => {
            if (!active || document.visibilityState !== 'visible') return;
            const alive = await AuthService.checkSessionAlive();
            if (!active || alive !== false || alreadyReported) return;
            alreadyReported = true;
            toast.info('Sua sessão foi encerrada neste dispositivo. Entre novamente para continuar.');
        };

        const intervalId = window.setInterval(() => void checkSession(), 8000);
        window.addEventListener('focus', checkSession);
        document.addEventListener('visibilitychange', checkSession);

        return () => {
            active = false;
            window.clearInterval(intervalId);
            window.removeEventListener('focus', checkSession);
            document.removeEventListener('visibilitychange', checkSession);
        };
    }, [customer?.id, isAuthenticated, sessionRestored]);

    useEffect(() => {
        if (!storeSlug) {
            setPublicStore(null);
            return;
        }

        let active = true;

        void Promise.all([
            PublicStorefrontService.getStorefrontBySlug(storeSlug),
            PublicStorefrontService.getCatalogBySlug(storeSlug),
        ])
            .then(([storefront, catalog]) => {
                if (!active) return;

                setPublicStore(storefront.store || null);

                if (!context?.storeId) return;

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

    const openStoreContact = () => {
        setStoreHubOpen(true);
    };

    const logoutCustomer = async () => {
        await flushCustomerCartServerSync().catch(() => undefined);
        await AuthService.logoutCustomer();
    };

    return (
        <div className={`min-h-screen ${isStoreCatalogRoute ? 'pb-24 md:pb-0' : ''}`}>
            <main className="transition-all duration-300">
                {children}
            </main>

            {sessionRestored && isAuthenticated && customer ? (
                <CustomerAccountPortal hideTrigger={!isCheckoutRoute} />
            ) : (
                <CustomerAuthPortal
                    storeSlug={storeSlug}
                    storeId={context?.storeId || null}
                    hideTrigger={!isCheckoutRoute}
                />
            )}

            {isStoreCatalogRoute && publicStore && (
                <>
                    <StorefrontBottomNavigation
                        storeSlug={storeSlug}
                        storeName={publicStore.name}
                        isAuthenticated={isAuthenticated}
                        checkoutPath={checkoutPath}
                        cartCount={cartCount}
                        cartTotal={cartTotal}
                        cartLabel={isTableContext ? 'Comanda' : 'Carrinho'}
                        onOpenStore={() => setStoreHubOpen(true)}
                        onOpenContact={openStoreContact}
                        onLogout={logoutCustomer}
                    />
                    <StoreHubPortal
                        open={storeHubOpen}
                        onClose={() => setStoreHubOpen(false)}
                        store={publicStore}
                    />
                </>
            )}
        </div>
    );
}
