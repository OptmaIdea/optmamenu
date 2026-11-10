import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
    GelinharesTestNotice,
    hasAcknowledgedGelinharesTest,
    isGelinharesTestEnvironment,
} from './GelinharesTestNotice';

afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
});

describe('Gelinhares test-only disclaimer', () => {
    it('is restricted to the Gelinhares slug in test or preview environments', () => {
        expect(isGelinharesTestEnvironment('gelinharessjn', 'homologacao.optmamenu.com.br')).toBe(true);
        expect(isGelinharesTestEnvironment('gelinharessjn', 'optmamenu-abc-optmaidea.vercel.app')).toBe(true);
        expect(isGelinharesTestEnvironment('gelinharessjn', 'optmamenu.com.br')).toBe(false);
        expect(isGelinharesTestEnvironment('gelinharessjn', 'www.optmamenu.com.br')).toBe(false);
        expect(isGelinharesTestEnvironment('snacksdicris', 'homologacao.optmamenu.com.br')).toBe(false);
        expect(isGelinharesTestEnvironment('logmytravel', 'homologacao.optmamenu.com.br')).toBe(false);
    });

    it('shows the test warning before the user acknowledges it', () => {
        render(<GelinharesTestNotice slug="gelinharessjn" />);
        expect(screen.getByText(/loja exclusiva de testes e demonstração/i)).toBeTruthy();
        expect(screen.getByText(/Não realize pagamentos reais/i)).toBeTruthy();
        expect(hasAcknowledgedGelinharesTest()).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: /entendi: estou em uma loja de testes/i }));
        expect(hasAcknowledgedGelinharesTest()).toBe(true);
        expect(screen.queryByText(/Aviso de testes reconhecido nesta sessão/i)).toBeNull();
        expect(screen.queryByText(/Não realize pagamentos reais/i)).toBeNull();
        const expand = screen.getByRole('button', { name: /Gelinhares — loja exclusiva de testes e demonstração/i });
        expect(expand.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(expand);
        expect(screen.getByText(/Aviso de testes reconhecido nesta sessão/i)).toBeTruthy();
        fireEvent.click(expand);
        expect(screen.queryByText(/Não realize pagamentos reais/i)).toBeNull();
    });

    it('does not display the warning on another slug', () => {
        render(<GelinharesTestNotice slug="snacksdicris" />);
        expect(screen.queryByText(/loja exclusiva de testes/i)).toBeNull();
    });
});
