import type { AccountsPayableStatus } from '@/services/accountsPayableService'

export function accountsPayableStatusLabel(status: AccountsPayableStatus) {
  const labels: Record<AccountsPayableStatus, string> = {
    draft: 'Rascunho',
    open: 'Em aberto',
    partially_paid: 'Parcialmente pago',
    paid: 'Pago',
    cancelled: 'Cancelado',
  }
  return labels[status]
}

export function accountsPayableStatusTone(status: AccountsPayableStatus) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-300'
  if (status === 'partially_paid') return 'bg-sky-100 text-sky-800 dark:bg-sky-950/45 dark:text-sky-300'
  if (status === 'cancelled') return 'bg-rose-100 text-rose-800 dark:bg-rose-950/45 dark:text-rose-300'
  if (status === 'draft') return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-300'
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const parsed = new Date(date)
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() !== Number(match[2]) - 1 ||
    parsed.getUTCDate() !== Number(match[3])
  ) return null
  return date
}

function dateOnlyFromDate(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysUntilDate(value: string, now = new Date()) {
  const target = parseDateOnly(value)
  if (target === null) return null
  return Math.round((target - dateOnlyFromDate(now)) / 86_400_000)
}

export function isAccountsPayableOverdue(dueDate?: string | null, openAmount = 0, status?: AccountsPayableStatus) {
  if (!dueDate || openAmount <= 0 || status === 'paid' || status === 'cancelled') return false
  const days = daysUntilDate(dueDate)
  return days !== null && days < 0
}

export function parsePaymentOffsetsInput(value: string) {
  const parts = value
    .split(/[;,/\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (!parts.length) throw new Error('Informe ao menos um vencimento.')

  const offsets = parts.map((item) => Number(item))
  if (offsets.some((offset) => !Number.isInteger(offset) || offset < 0)) {
    throw new Error('Use apenas dias inteiros iguais ou maiores que zero.')
  }
  if (offsets.some((offset, index) => index > 0 && offset <= offsets[index - 1])) {
    throw new Error('Os vencimentos devem estar em ordem crescente, sem repetição.')
  }
  return offsets
}

export function paymentTermScheduleLabel(offsets: number[]) {
  if (offsets.length === 1 && offsets[0] === 0) return 'No mesmo dia'
  return offsets.map((offset) => `${offset}d`).join(' / ')
}

export function parseMoneyBR(value: string) {
  const normalized = value.trim().replace(/\s/g, '')
  if (!normalized) return Number.NaN
  if (normalized.includes(',')) {
    return Number(normalized.replace(/\./g, '').replace(',', '.'))
  }
  return Number(normalized)
}
