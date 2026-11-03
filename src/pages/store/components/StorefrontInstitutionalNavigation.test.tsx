// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StorefrontBottomNavigation } from './StorefrontBottomNavigation';

describe('navegação institucional da loja pública', () => {
    function renderNavigation() {
        const onOpenStore = vi.fn();
        const onOpenContact = vi.fn();
        render(
            <MemoryRouter initialEntries={['/s/gelinharessjn']}>
                <StorefrontBottomNavigation
                    storeSlug="gelinharessjn"
                    storeName="Gelinhares"
                    isAuthenticated={false}
                    checkoutPath="/checkout?store=gelinharessjn"
                    cartCount={0}
                    cartTotal={0}
                    onOpenStore={onOpenStore}
                    onOpenContact={onOpenContact}
                    onLogout={vi.fn()}
                />
            </MemoryRouter>,
        );
        return { onOpenStore, onOpenContact };
    }

    it('apresenta Início, Carrinho, nome da loja, Perfil/Entrar e Menu nesta ordem', () => {
        renderNavigation();
        const nav = screen.getByRole('navigation', { name: 'Navegação da loja' });
        const items = Array.from(nav.firstElementChild?.children || []).map((item) => item.textContent?.trim());
        expect(items).toEqual(['Início', 'Carrinho', 'Gelinhares', 'Entrar', 'Menu']);
    });

    it('abre o institucional ao tocar no nome da loja', () => {
        const { onOpenStore } = renderNavigation();
        const nav = screen.getByRole('navigation', { name: 'Navegação da loja' });
        fireEvent.click(within(nav).getByRole('button', { name: 'Abrir área da Gelinhares' }));
        expect(onOpenStore).toHaveBeenCalledTimes(1);
    });

    it('preserva um acesso separado para Fale com a loja no Menu', () => {
        const { onOpenContact } = renderNavigation();
        const nav = screen.getByRole('navigation', { name: 'Navegação da loja' });
        fireEvent.click(within(nav).getByRole('button', { name: 'Menu' }));
        fireEvent.click(screen.getByRole('button', { name: 'Fale com a loja' }));
        expect(onOpenContact).toHaveBeenCalledTimes(1);
    });
});
