import { describe, expect, it } from 'vitest'
import {
  accountsPayableStatusLabel,
  daysUntilDate,
  isAccountsPayableOverdue,
  parseMoneyBR,
  parsePaymentOffsetsInput,
  paymentTermScheduleLabel,
} from './accountsPayableViewUtils'

describe('accountsPayableViewUtils', () => {
  it('traduz os estados financeiros principais', () => {
    expect(accountsPayableStatusLabel('open')).toBe('Em aberto')
    expect(accountsPayableStatusLabel('partially_paid')).toBe('Parcialmente pago')
    expect(accountsPayableStatusLabel('paid')).toBe('Pago')
  })

  it('interpreta modelos 30/60 e separadores equivalentes', () => {
    expect(parsePaymentOffsetsInput('30/60')).toEqual([30, 60])
    expect(parsePaymentOffsetsInput('30, 60, 90')).toEqual([30, 60, 90])
  })

  it('rejeita vencimentos repetidos ou fora de ordem', () => {
    expect(() => parsePaymentOffsetsInput('30/30')).toThrow(/ordem crescente/)
    expect(() => parsePaymentOffsetsInput('60/30')).toThrow(/ordem crescente/)
  })

  it('marca somente obrigação aberta e vencida como atrasada', () => {
    const now = new Date(2026, 8, 5, 12, 0, 0)
    expect(daysUntilDate('2026-09-04', now)).toBe(-1)
    expect(isAccountsPayableOverdue('2026-09-04', 10, 'open')).toBe(true)
    expect(isAccountsPayableOverdue('2026-09-04', 0, 'open')).toBe(false)
    expect(isAccountsPayableOverdue('2026-09-04', 10, 'paid')).toBe(false)
  })

  it('formata agenda e aceita moeda pt-BR', () => {
    expect(paymentTermScheduleLabel([0])).toBe('No mesmo dia')
    expect(paymentTermScheduleLabel([30, 60, 90])).toBe('30d / 60d / 90d')
    expect(parseMoneyBR('1.234,56')).toBe(1234.56)
    expect(parseMoneyBR('125.50')).toBe(125.5)
  })
})
