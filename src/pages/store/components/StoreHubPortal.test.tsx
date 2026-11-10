// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoreHubPortal } from './StoreHubPortal';
import { PublicStorefrontService } from '@/services/publicStorefrontService';

vi.mock('@/services/publicStorefrontService', () => ({
    PublicStorefrontService: {
        getPublicLoyaltyProgramBySlug: vi.fn(async (slug: string) => ({
            ok: true,
            program: { name: slug === 'gelinharessjn' ? 'Gelipontos' : 'Outro programa', points_per_currency: 0 },
            rewards: [{ id: 'reward-1', title: 'Picolé de prêmio', points_cost: 100 }],
        })),
    },
}));

describe('fidelidade na área institucional', () => {
    it('consulta e apresenta o programa público sem exigir visual_config.loyalty_active', async () => {
        render(
            <StoreHubPortal
                open
                onClose={vi.fn()}
                store={{ id: 'store-1', slug: 'gelinharessjn', name: 'Gelinhares' }}
                isAuthenticated={false}
            />,
        );

        expect(await screen.findByText('Gelipontos')).toBeTruthy();
        expect(screen.getByText('Picolé de prêmio')).toBeTruthy();
        expect(PublicStorefrontService.getPublicLoyaltyProgramBySlug).toHaveBeenCalledWith('gelinharessjn');
    });

    it('não mostra fidelidade da loja anterior após troca de slug', async () => {
        const { rerender } = render(
            <StoreHubPortal open onClose={vi.fn()} store={{ id: 'a', slug: 'gelinharessjn', name: 'Gelinhares' }} />,
        );
        expect(await screen.findByText('Gelipontos')).toBeTruthy();

        rerender(
            <StoreHubPortal open onClose={vi.fn()} store={{ id: 'b', slug: 'outra-loja', name: 'Outra loja' }} />,
        );

        expect(screen.queryByText('Gelipontos')).toBeNull();
        expect(await screen.findByText('Outro programa')).toBeTruthy();
    });
});


describe('redes sociais institucionais por loja', () => {
    const socialLinks = {
        twitter: 'https://twitter.com/perfil_legado',
        youtube: 'https://www.youtube.com/@canalgelinhares',
        tiktok: 'https://www.tiktok.com/@lojagelinhares',
        instagram: 'https://instagram.com/lojagelinhares',
        facebook: 'https://facebook.com/lojagelinhares',
        website: 'https://gelinhares.example.com',
        google_reviews: 'https://maps.app.goo.gl/Abc123',
    };

    it('exibe as cinco redes e o Site/Avaliações para visitante e cliente autenticado com segurança', () => {
        const store = {
            id: 'a', slug: 'gelinharessjn', name: 'Gelinhares',
            visual_config: { social_links: socialLinks },
        };
        const { rerender } = render(<StoreHubPortal open onClose={vi.fn()} store={store} isAuthenticated={false} />);
        for (const label of ['X', 'YouTube', 'TikTok', 'Instagram', 'Facebook', 'Site', 'Google Avaliações']) {
            const anchor = screen.getByRole('link', { name: 'Abrir ' + label + ' da Gelinhares em nova guia' });
            expect(anchor.getAttribute('href')).toMatch(/^https:\/\//);
            expect(anchor.getAttribute('target')).toBe('_blank');
            expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
        }
        expect(screen.getByRole('link', { name: 'Abrir X da Gelinhares em nova guia' }).getAttribute('href'))
            .toBe(socialLinks.twitter);

        rerender(<StoreHubPortal open onClose={vi.fn()} store={store} isAuthenticated />);
        expect(screen.getByRole('link', { name: 'Abrir YouTube da Gelinhares em nova guia' }).getAttribute('href'))
            .toBe(socialLinks.youtube);
    });

    it('oculta links inválidos, vazios e removidos; troca de slug não reaproveita dados anteriores', () => {
        const { rerender } = render(
            <StoreHubPortal
                open onClose={vi.fn()}
                store={{ id: 'a', slug: 'gelinharessjn', name: 'Gelinhares',
                    visual_config: { social_links: { instagram: 'https://instagram.com/perfilgelinhares',
                        youtube: 'javascript:alert(1)', tiktok: 'https://tiktok.com.evil.example/@foo' } } }}
            />,
        );
        expect(screen.getByRole('link', { name: 'Abrir Instagram da Gelinhares em nova guia' })).toBeTruthy();
        expect(screen.queryByRole('link', { name: /Abrir YouTube/ })).toBeNull();
        expect(screen.queryByRole('link', { name: /Abrir TikTok/ })).toBeNull();

        rerender(
            <StoreHubPortal
                open onClose={vi.fn()}
                store={{ id: 'b', slug: 'outra-loja', name: 'Outra loja',
                    visual_config: { social_links: { tiktok: 'https://tiktok.com/@outraloja', instagram: '' } } }}
            />,
        );
        expect(screen.queryByRole('link', { name: /Abrir Instagram/ })).toBeNull();
        expect(screen.getByRole('link', { name: 'Abrir TikTok da Outra loja em nova guia' })).toBeTruthy();

        rerender(
            <StoreHubPortal
                open onClose={vi.fn()}
                store={{ id: 'b', slug: 'outra-loja', name: 'Outra loja', visual_config: { social_links: {} } }}
            />,
        );
        expect(screen.queryByText('Acompanhe a loja')).toBeNull();
    });
});
