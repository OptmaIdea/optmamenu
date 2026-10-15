import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StorefrontBottomNavigation } from './StorefrontBottomNavigation';

afterEach(cleanup);

describe('StorefrontBottomNavigation — carrinho desktop', () => {
    it('mantém o carrinho acessível diretamente com quantidade e valor', () => {
        render(
            <MemoryRouter initialEntries={['/loja/gelinharessjn']}>
                <StorefrontBottomNavigation
                    storeSlug="gelinharessjn"
                    storeName="Gelinhares"
                    isAuthenticated={false}
                    checkoutPath="/checkout?store=gelinharessjn"
                    cartCount={3}
                    cartTotal={26}
                    onOpenStore={() => undefined}
                    onOpenContact={() => undefined}
                    onLogout={() => undefined}
                />
            </MemoryRouter>,
        );

        const link = screen.getByRole('link', { name: 'Abrir carrinho com 3 itens' });
        expect(link.getAttribute('href')).toBe('/checkout?store=gelinharessjn');
        expect(screen.getByText('3 itens · R$ 26,00')).toBeTruthy();
    });

    it('permite abrir o carrinho mesmo quando está vazio', () => {
        render(
            <MemoryRouter>
                <StorefrontBottomNavigation
                    storeSlug="gelinharessjn"
                    storeName="Gelinhares"
                    isAuthenticated={false}
                    checkoutPath="/checkout?store=gelinharessjn"
                    cartCount={0}
                    cartTotal={0}
                    onOpenStore={() => undefined}
                    onOpenContact={() => undefined}
                    onLogout={() => undefined}
                />
            </MemoryRouter>,
        );
        expect(screen.getByRole('link', { name: 'Abrir carrinho com 0 itens' })).toBeTruthy();
        expect(screen.getByText('Carrinho vazio')).toBeTruthy();
    });
});
