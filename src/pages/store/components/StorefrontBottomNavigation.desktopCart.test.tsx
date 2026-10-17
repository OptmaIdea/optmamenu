import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StorefrontBottomNavigation } from './StorefrontBottomNavigation';

afterEach(cleanup);

describe('Navegação pública — carrinho no rodapé mobile', () => {
    const props = {
        storeSlug: 'gelinharessjn',
        storeName: 'Gelinhares',
        isAuthenticated: false,
        checkoutPath: '/checkout?store=gelinharessjn',
        cartCount: 3,
        cartTotal: 26,
        onOpenStore: () => undefined,
        onOpenContact: () => undefined,
        onLogout: () => undefined,
    };

    it('mantém o link do carrinho no rodapé mobile e no menu, sem botão flutuante desktop', () => {
        render(<MemoryRouter><StorefrontBottomNavigation {...props} /></MemoryRouter>);
        expect(screen.getByRole('link', { name: 'Abrir carrinho' }).getAttribute('href')).toBe(props.checkoutPath);
        expect(screen.queryByRole('link', { name: 'Abrir carrinho com 3 itens' })).toBeNull();
    });
});
