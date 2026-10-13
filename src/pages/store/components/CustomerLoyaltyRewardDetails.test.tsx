import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ImageLightbox } from './ImageLightbox';
import { CustomerLoyaltyRewardDetails, rewardKindLabel } from './CustomerLoyaltyRewardDetails';
import type { CustomerLoyaltyReward } from '@/services/customerService';

afterEach(cleanup);

describe('loyalty prize details and product image viewer', () => {
    const prize: CustomerLoyaltyReward = {
        id: 'prize-1',
        title: 'Caneca especial',
        description: 'Uma caneca personalizada de cerâmica.',
        pointsCost: 120,
        type: 'other',
        imageUrl: 'https://example.com/prize.jpg',
        additionalCashCost: 9.5,
        discountPercentage: null,
        discountAmount: null,
        maxDiscountValue: null,
        minOrderValue: null,
        stockQuantity: 4,
        voucherValidityDays: 15,
        offerValidUntil: null,
        productId: null,
        productQuantity: null,
        affordable: true,
    };

    it('explains points plus money without taking points from the customer', () => {
        expect(rewardKindLabel(prize)).toBe('Brinde + dinheiro');
        render(<CustomerLoyaltyRewardDetails reward={prize} availablePoints={150} onClose={vi.fn()} onRedeem={vi.fn()} />);
        expect(screen.getByText('120 pontos')).toBeTruthy();
        expect(screen.getByText(/R\$ 9,50/)).toBeTruthy();
        expect(screen.getByText(/troca com valor adicional aguarda a integração financeira/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Trocar 120 pontos/i })).toBeNull();
    });

    it('allows an eligible standalone prize to request confirmed redemption', () => {
        const onRedeem = vi.fn();
        render(<CustomerLoyaltyRewardDetails reward={{ ...prize, additionalCashCost: 0 }} availablePoints={150} onClose={vi.fn()} onRedeem={onRedeem} />);
        fireEvent.click(screen.getByRole('button', { name: 'Trocar 120 pontos' }));
        expect(onRedeem).toHaveBeenCalledTimes(1);
    });

    it('opens prize image in full screen', () => {
        render(<CustomerLoyaltyRewardDetails reward={prize} availablePoints={40} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Ampliar imagem de Caneca especial/ }));
        expect(screen.getByRole('dialog', { name: /Imagem ampliada: Caneca especial/ })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Fechar imagem ampliada' }));
        expect(screen.queryByRole('dialog', { name: /Imagem ampliada/ })).toBeNull();
    });

    it('navigates multi-photo product galleries and closes with Escape', () => {
        const change = vi.fn();
        const onClose = vi.fn();
        render(<ImageLightbox images={['https://example.com/1.jpg', 'https://example.com/2.jpg']} currentIndex={0} onIndexChange={change} onClose={onClose} alt="Picolé" />);
        fireEvent.click(screen.getByRole('button', { name: 'Próxima imagem' }));
        expect(change).toHaveBeenCalledWith(1);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
