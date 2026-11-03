// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoreHubPortal } from './StoreHubPortal';
import { PublicStorefrontService } from '@/services/publicStorefrontService';

vi.mock('@/services/publicStorefrontService', () => ({
    PublicStorefrontService: {
        getPublicLoyaltyProgramBySlug: vi.fn(async () => ({
            ok: true,
            program: { name: 'Gelipontos', points_per_currency: 0 },
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
});
