// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StoreLayout } from './StoreLayout';
import { PublicStorefrontService } from '@/services/publicStorefrontService';
import { syncCustomerCartCatalog } from '@/services/customerCartPersistence';

const testState = vi.hoisted(() => ({
    cart: {
        items: [{ id: 'item-a', quantity: 4, price: 12 }],
        context: { storeId: 'id-a', requestedSlug: 'loja-a', canonicalSlug: 'loja-a', type: 'remote' },
    },
}));

vi.mock('@/store/useCartStore', () => ({
    useCartStore: (selector: (state: typeof testState.cart) => unknown) => selector(testState.cart),
}));
vi.mock('@/store/useCustomerAuth', () => ({
    useCustomerAuth: (selector: (state: Record<string, unknown>) => unknown) =>
        selector({ customer: null, isAuthenticated: false, sessionRestored: true }),
}));
vi.mock('@/services/publicStorefrontService', () => ({
    PublicStorefrontService: {
        getStorefrontBySlug: vi.fn(async (slug: string) => ({
            ok: true,
            store: { id: slug === 'loja-b' ? 'id-b' : 'id-a', slug, name: slug === 'loja-b' ? 'Loja B' : 'Loja A' },
        })),
        getCatalogBySlug: vi.fn(async () => ({ ok: true, categories: [] })),
    },
}));
vi.mock('@/services/customerCartPersistence', () => ({
    activateCustomerCart: vi.fn(),
    configureCustomerCartRetention: vi.fn(),
    deactivateCustomerCart: vi.fn(),
    prepareCustomerCartForSessionRestore: vi.fn(),
    syncCustomerCartCatalog: vi.fn(),
    flushCustomerCartServerSync: vi.fn(async () => undefined),
}));
vi.mock('@/services/customerAuth', () => ({
    AuthService: { logoutCustomer: vi.fn(async () => undefined) },
}));
vi.mock('@/pages/store/components/CustomerAccountPortal', () => ({
    CustomerAccountPortal: () => null,
}));
vi.mock('@/pages/store/components/CustomerAuthPortal', () => ({
    CustomerAuthPortal: ({ storeSlug, storeId }: { storeSlug: string | null; storeId: string | null }) =>
        <div data-testid="auth-scope">{storeSlug || 'none'}:{storeId || 'none'}</div>,
}));
vi.mock('@/pages/store/components/StorefrontBottomNavigation', () => ({
    StorefrontBottomNavigation: ({ storeName, cartCount }: { storeName: string; cartCount: number }) =>
        <div data-testid="store-nav">{storeName}:{cartCount}</div>,
}));
vi.mock('@/pages/store/components/StoreHubPortal', () => ({
    StoreHubPortal: ({ store }: { store: { name: string } }) =>
        <div data-testid="store-hub">{store.name}</div>,
}));

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn(() => ({
            matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        })),
    });
    window.scrollTo = vi.fn();
});

describe('StoreLayout — troca de loja sem vazamento do carrinho persistido', () => {
    it('carrega a loja da URL B e não renderiza carrinho ou identidade da loja A', async () => {
        render(
            <MemoryRouter initialEntries={['/s/loja-b']}>
                <StoreLayout><p>Catálogo</p></StoreLayout>
            </MemoryRouter>,
        );
        await waitFor(() =>
            expect(PublicStorefrontService.getStorefrontBySlug).toHaveBeenCalledWith('loja-b'));
        await waitFor(() => expect(screen.getByTestId('auth-scope').textContent).toBe('loja-b:none'));
        expect(screen.queryByTestId('store-nav')).toBeNull();
        expect(screen.queryByTestId('store-hub')).toBeNull();
        expect(syncCustomerCartCatalog).not.toHaveBeenCalled();
    });

    it('mantém carrinho e identidade quando o contexto pertence à loja da URL', async () => {
        render(
            <MemoryRouter initialEntries={['/s/loja-a']}>
                <StoreLayout><p>Catálogo</p></StoreLayout>
            </MemoryRouter>,
        );
        expect((await screen.findByTestId('store-nav')).textContent).toBe('Loja A:4');
        expect(screen.getByTestId('auth-scope').textContent).toBe('loja-a:id-a');
        await waitFor(() => expect(syncCustomerCartCatalog).toHaveBeenCalledWith('id-a', []));
    });
});
