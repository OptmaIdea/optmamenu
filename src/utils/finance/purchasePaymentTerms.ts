export type PurchasePaymentMode = 'cash' | 'term'

export type PurchasePaymentTermLike = {
  id?: string
  code?: string
  name: string
  payment_mode: PurchasePaymentMode
  installment_count: number
  offset_days: number[]
  payment_method_code?: string | null
}

export type PurchaseInstallmentPreview = {
  installmentNumber: number
  dueDate: string
  amount: number
}

const CENTS = 100

function toCents(value: number) {
  if (!Number.isFinite(value)) throw new Error('Valor financeiro inválido.')
  return Math.round(value * CENTS)
}

function fromCents(value: number) {
  return value / CENTS
}

export function isValidPaymentOffsets(offsets: number[]) {
  if (!Array.isArray(offsets) || offsets.length === 0) return false
  return offsets.every((offset, index) => {
    if (!Number.isInteger(offset) || offset < 0) return false
    if (index === 0) return true
    return offset > offsets[index - 1]
  })
}

export function splitPurchaseAmount(total: number, installmentCount: number) {
  if (!Number.isInteger(installmentCount) || installmentCount <= 0) {
    throw new Error('Quantidade de parcelas inválida.')
  }
  const totalCents = toCents(total)
  if (totalCents < 0) throw new Error('O valor total não pode ser negativo.')

  const base = Math.floor(totalCents / installmentCount)
  let remainder = totalCents - base * installmentCount

  return Array.from({ length: installmentCount }, () => {
    const cents = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
    return fromCents(cents)
  })
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Data base inválida.')
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error('Data base inválida.')
  }
  return date
}

function dateOnly(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
}

export function addDaysToDateOnly(baseDate: string, offsetDays: number) {
  if (!Number.isInteger(offsetDays) || offsetDays < 0) throw new Error('Prazo inválido.')
  const date = parseDateOnly(baseDate)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return dateOnly(date)
}

export function buildPurchaseInstallmentPreview(
  baseDate: string,
  total: number,
  offsets: number[],
): PurchaseInstallmentPreview[] {
  if (!isValidPaymentOffsets(offsets)) {
    throw new Error('Os vencimentos devem ser não negativos e crescentes.')
  }
  const amounts = splitPurchaseAmount(total, offsets.length)
  return offsets.map((offset, index) => ({
    installmentNumber: index + 1,
    dueDate: addDaysToDateOnly(baseDate, offset),
    amount: amounts[index],
  }))
}

export function assertPurchasePaymentTerm(term: PurchasePaymentTermLike) {
  if (!term.name.trim()) throw new Error('Informe o nome da condição de pagamento.')
  if (!isValidPaymentOffsets(term.offset_days)) {
    throw new Error('Os vencimentos devem ser não negativos e crescentes.')
  }
  if (term.installment_count !== term.offset_days.length) {
    throw new Error('O número de parcelas deve corresponder aos vencimentos configurados.')
  }
  if (term.payment_mode === 'cash' && (term.installment_count !== 1 || term.offset_days[0] !== 0)) {
    throw new Error('Condição à vista deve ter uma parcela no dia zero.')
  }
  return true
}
