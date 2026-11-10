import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PublicStoreHero } from './PublicStoreHero';

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    })));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('Carrossel administrável da loja', () => {
    const storeName = 'Gelinhares';
    const storeSlug = 'gelinharessjn';

    it('preserva a vitrine demonstrativa antes da primeira configuração', () => {
        render(<PublicStoreHero storeName={storeName} storeSlug={storeSlug} />);
        expect(screen.getByRole('region', { name: /Destaques da Gelinhares/i })).toBeTruthy();
    });

    it('respeita desativação mesmo quando a demonstração está disponível', () => {
        render(<PublicStoreHero storeName={storeName} storeSlug={storeSlug}
            config={{ storefront_carousel_enabled: false }}/>);
        expect(screen.queryByRole('region', { name: /Destaques da Gelinhares/i })).toBeNull();
    });

    it('não reativa a demonstração quando todas as mídias forem despublicadas', () => {
        render(<PublicStoreHero storeName={storeName} storeSlug={storeSlug}
            config={{
                banners: [{ id: 'x', type: 'image', url: 'https://example.com/banner.webp', published: false }],
            }}/>);
        expect(screen.queryByRole('region', { name: /Destaques da Gelinhares/i })).toBeNull();
    });

    it('mostra apenas a mídia autorizada na lista configurada', () => {
        render(<PublicStoreHero storeName={storeName} storeSlug={storeSlug}
            config={{ banners: [
                { id: 'inactive', type: 'image', url: 'https://example.com/not-published.webp', published: false },
                { id: 'active', type: 'image', url: 'https://example.com/published.webp', published: true, alt_text: 'Campanha publicada' },
            ] }}/>);
        expect(screen.getByRole('img', { name: 'Campanha publicada' })).toBeTruthy();
        expect(screen.queryByRole('img', { name: /not-published/i })).toBeNull();
    });
});
