import { describe, expect, it } from 'vitest'
import {
  addDaysToDateOnly,
  assertPurchasePaymentTerm,
  buildPurchaseInstallmentPreview,
  isValidPaymentOffsets,
  splitPurchaseAmount,
} from './purchasePaymentTerms'

describe('purchasePaymentTerms', () => {
  it('valida prazos crescentes e rejeita duplicados ou negativos', () => {
    expect(isValidPaymentOffsets([0])).toBe(true)
    expect(isValidPaymentOffsets([30, 60, 90])).toBe(true)
    expect(isValidPaymentOffsets([30, 30])).toBe(false)
    expect(isValidPaymentOffsets([-1, 30])).toBe(false)
    expect(isValidPaymentOffsets([])).toBe(false)
  })

  it('divide valores em centavos sem perder o total', () => {
    const installments = splitPurchaseAmount(1000, 3)
    expect(installments).toEqual([333.34, 333.33, 333.33])
    expect(installments.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1000, 2)
  })

  it('mantém 30/60 a partir da data da compra', () => {
    expect(buildPurchaseInstallmentPreview('2026-09-05', 1000, [30, 60])).toEqual([
      { installmentNumber: 1, dueDate: '2026-10-05', amount: 500 },
      { installmentNumber: 2, dueDate: '2026-11-04', amount: 500 },
    ])
  })

  it('gera condição à vista na própria data da compra', () => {
    expect(buildPurchaseInstallmentPreview('2026-09-05', 125, [0])).toEqual([
      { installmentNumber: 1, dueDate: '2026-09-05', amount: 125 },
    ])
  })

  it('faz cálculo de datas sem depender do timezone do navegador', () => {
    expect(addDaysToDateOnly('2026-01-31', 30)).toBe('2026-03-02')
    expect(addDaysToDateOnly('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('valida contrato de condição à vista', () => {
    expect(
      assertPurchasePaymentTerm({
        name: 'À vista',
        payment_mode: 'cash',
        installment_count: 1,
        offset_days: [0],
      }),
    ).toBe(true)
  })

  it('rejeita condição à vista com vencimento futuro', () => {
    expect(() =>
      assertPurchasePaymentTerm({
        name: 'À vista incorreta',
        payment_mode: 'cash',
        installment_count: 1,
        offset_days: [1],
      }),
    ).toThrow('Condição à vista deve ter uma parcela no dia zero.')
  })

  it('rejeita quantidade de parcelas divergente dos prazos', () => {
    expect(() =>
      assertPurchasePaymentTerm({
        name: '30/60',
        payment_mode: 'term',
        installment_count: 3,
        offset_days: [30, 60],
      }),
    ).toThrow('O número de parcelas deve corresponder aos vencimentos configurados.')
  })
})
