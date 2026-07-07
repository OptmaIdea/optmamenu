import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CashbookService } from '@/services/cashbookService';

describe('CashbookService.assertCashDrawerCanCoverOutflow', () => {
    let getCashDrawerBalanceSpy: any;

    beforeEach(() => {
        getCashDrawerBalanceSpy = vi.spyOn(CashbookService, 'getCashDrawerBalance');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should do nothing if it is not a cash drawer outflow', async () => {
        const input = {
            store_id: 'store-1',
            type: 'manual_expense' as const,
            direction: 'in' as const, // Not an outflow
            amount: 100,
            description: 'Test entry',
            payment_method_code: 'cash',
        };
        const metadata = {
            affects_cash_drawer: true,
            source_financial_account_code: 'cash_drawer',
        };

        await expect(CashbookService.assertCashDrawerCanCoverOutflow(input, metadata)).resolves.not.toThrow();
        expect(getCashDrawerBalanceSpy).not.toHaveBeenCalled();
    });

    it('should resolve successfully if balance is sufficient', async () => {
        getCashDrawerBalanceSpy.mockResolvedValue(150);

        const input = {
            store_id: 'store-1',
            type: 'manual_expense' as const,
            direction: 'out' as const,
            amount: 100,
            description: 'Test outflow',
            payment_method_code: 'cash',
        };
        const metadata = {
            affects_cash_drawer: true,
            source_financial_account_code: 'cash_drawer',
        };

        await expect(CashbookService.assertCashDrawerCanCoverOutflow(input, metadata)).resolves.not.toThrow();
        expect(getCashDrawerBalanceSpy).toHaveBeenCalledWith('store-1');
    });

    it('should throw error with positive but insufficient balance', async () => {
        getCashDrawerBalanceSpy.mockResolvedValue(40);

        const input = {
            store_id: 'store-1',
            type: 'manual_expense' as const,
            direction: 'out' as const,
            amount: 100,
            description: 'Test outflow',
            payment_method_code: 'cash',
        };
        const metadata = {
            affects_cash_drawer: true,
            source_financial_account_code: 'cash_drawer',
        };

        await expect(CashbookService.assertCashDrawerCanCoverOutflow(input, metadata)).rejects.toThrow(
            /Saldo insuficiente no caixa físico\. Saldo disponível para saída: .*40,00/
        );
    });

    it('should throw error with negative balance and format message correctly', async () => {
        getCashDrawerBalanceSpy.mockResolvedValue(-62.47);

        const input = {
            store_id: 'store-1',
            type: 'manual_expense' as const,
            direction: 'out' as const,
            amount: 50,
            description: 'Test outflow',
            payment_method_code: 'cash',
        };
        const metadata = {
            affects_cash_drawer: true,
            source_financial_account_code: 'cash_drawer',
        };

        await expect(CashbookService.assertCashDrawerCanCoverOutflow(input, metadata)).rejects.toThrow(
            /Saldo insuficiente no caixa físico\. Saldo disponível para saída: .*0,00.* caixa físico já está negativo em .*62,47/
        );
    });
});
