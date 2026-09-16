import { describe, expect, it } from 'vitest'
import {
  buildPurchaseReceiptProgress,
  purchaseReceiptSummary,
} from './purchaseReceiptUtils'

describe('purchaseReceiptUtils', () => {
  const items = [
    { id: 'item-a', quantity: 5 },
    { id: 'item-b', quantity: 4 },
  ]

  it('soma somente parcelas ativas', () => {
    const receipts = [
      { id: 'r1', status: 'confirmed' as const },
      { id: 'r2', status: 'reversed' as const },
      { id: 'r3', status: 'confirmed' as const },
    ]
    const receiptItems = [
      { receipt_id: 'r1', purchase_document_item_id: 'item-a', accepted_quantity: 2 },
      { receipt_id: 'r2', purchase_document_item_id: 'item-a', accepted_quantity: 2 },
      { receipt_id: 'r3', purchase_document_item_id: 'item-b', accepted_quantity: 1 },
    ]

    const progress = buildPurchaseReceiptProgress(items, receipts, receiptItems)

    expect(progress.get('item-a')).toEqual({ ordered: 5, received: 2, pending: 3, complete: false })
    expect(progress.get('item-b')).toEqual({ ordered: 4, received: 1, pending: 3, complete: false })
  })

  it('marca item e compra como concluídos quando o saldo pendente zera', () => {
    const receipts = [{ id: 'r1', status: 'confirmed' as const }]
    const receiptItems = [
      { receipt_id: 'r1', purchase_document_item_id: 'item-a', accepted_quantity: 5 },
      { receipt_id: 'r1', purchase_document_item_id: 'item-b', accepted_quantity: 4 },
    ]

    const summary = purchaseReceiptSummary(items, receipts, receiptItems)

    expect(summary).toEqual({ ordered: 9, received: 9, pending: 0, complete: true })
  })

  it('não deixa o recebido visual ultrapassar o pedido', () => {
    const receipts = [{ id: 'r1', status: 'confirmed' as const }]
    const receiptItems = [
      { receipt_id: 'r1', purchase_document_item_id: 'item-a', accepted_quantity: 99 },
    ]

    const progress = buildPurchaseReceiptProgress(items, receipts, receiptItems)

    expect(progress.get('item-a')).toEqual({ ordered: 5, received: 5, pending: 0, complete: true })
  })
})
