export type PurchaseReceiptStatus = 'confirmed' | 'reversed'

export type PurchaseReceiptLike = {
  id: string
  status: PurchaseReceiptStatus | string
}

export type PurchaseReceiptItemLike = {
  receipt_id: string
  purchase_document_item_id: string
  accepted_quantity: number | string | null
}

export type PurchaseDocumentItemLike = {
  id: string
  quantity: number | string | null
}

export type PurchaseReceiptProgress = {
  ordered: number
  received: number
  pending: number
  complete: boolean
}

const numeric = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export const buildActiveReceiptIds = (receipts: PurchaseReceiptLike[]) =>
  new Set(receipts.filter((receipt) => receipt.status === 'confirmed').map((receipt) => receipt.id))

export const buildReceivedByItem = (
  receipts: PurchaseReceiptLike[],
  receiptItems: PurchaseReceiptItemLike[]
) => {
  const activeReceiptIds = buildActiveReceiptIds(receipts)
  const received = new Map<string, number>()

  receiptItems.forEach((item) => {
    if (!activeReceiptIds.has(item.receipt_id)) return
    received.set(
      item.purchase_document_item_id,
      (received.get(item.purchase_document_item_id) ?? 0) + numeric(item.accepted_quantity)
    )
  })

  return received
}

export const buildPurchaseReceiptProgress = (
  items: PurchaseDocumentItemLike[],
  receipts: PurchaseReceiptLike[],
  receiptItems: PurchaseReceiptItemLike[]
) => {
  const receivedByItem = buildReceivedByItem(receipts, receiptItems)
  const progress = new Map<string, PurchaseReceiptProgress>()

  items.forEach((item) => {
    const ordered = Math.max(0, numeric(item.quantity))
    const received = Math.min(ordered, Math.max(0, receivedByItem.get(item.id) ?? 0))
    const pending = Math.max(0, ordered - received)
    progress.set(item.id, { ordered, received, pending, complete: pending <= 0 })
  })

  return progress
}

export const purchaseReceiptSummary = (
  items: PurchaseDocumentItemLike[],
  receipts: PurchaseReceiptLike[],
  receiptItems: PurchaseReceiptItemLike[]
) => {
  const progress = buildPurchaseReceiptProgress(items, receipts, receiptItems)
  let ordered = 0
  let received = 0
  let pending = 0

  progress.forEach((item) => {
    ordered += item.ordered
    received += item.received
    pending += item.pending
  })

  return {
    ordered,
    received,
    pending,
    complete: items.length > 0 && pending <= 0,
  }
}
