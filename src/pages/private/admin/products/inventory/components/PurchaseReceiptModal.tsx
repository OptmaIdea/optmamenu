import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, History, RotateCcw, X } from 'lucide-react'
import {
  buildPurchaseReceiptProgress,
  type PurchaseReceiptItemLike,
  type PurchaseReceiptLike,
} from '../utils/purchaseReceiptUtils'

type StockLocation = {
  id: string
  name: string
  code: string
  is_default: boolean
}

export type PurchaseReceiptDocumentItem = {
  id: string
  product_id: string
  quantity: number
  unit_cost: number | null
}

export type PurchaseReceiptRow = PurchaseReceiptLike & {
  receipt_code: string
  purchase_document_id: string
  purchase_document_code: string | null
  invoice_number: string | null
  store_id: string
  supplier_id: string
  location_id: string
  location_name: string
  reported_quantity_total: number
  accepted_quantity_total: number
  divergence_count: number
  notes: string | null
  received_by: string
  received_at: string
  reversed_at: string | null
  reversed_by: string | null
  reversal_reason: string | null
}

export type PurchaseReceiptItemRow = PurchaseReceiptItemLike & {
  id: string
  purchase_document_id: string
  product_id: string
  ordered_quantity: number
  previously_received_quantity: number
  reported_quantity: number
  accepted_quantity: number
  pending_after_quantity: number
  shortage_quantity: number
  damaged_quantity: number
  wrong_item_quantity: number
  excess_quantity: number
  divergence_note: string | null
  unit_cost: number
}

export type PurchaseReceiptSubmitItem = {
  purchase_document_item_id: string
  received_quantity: number
  accepted_quantity: number
  shortage_quantity: number
  damaged_quantity: number
  wrong_item_quantity: number
  excess_quantity: number
  note: string | null
}

type ReceiptFormItem = {
  received: number
  accepted: number
  shortage: number
  damaged: number
  wrong: number
  excess: number
  note: string
}

type Props = {
  open: boolean
  documentId: string
  documentCode: string
  supplierName: string
  items: PurchaseReceiptDocumentItem[]
  receipts: PurchaseReceiptRow[]
  receiptItems: PurchaseReceiptItemRow[]
  stockLocations: StockLocation[]
  productName: (productId: string) => string
  actorName: (userId: string | null) => string
  canReceive: boolean
  canReverse: boolean
  saving: boolean
  onClose: () => void
  onReceive: (payload: {
    locationId: string
    notes: string | null
    items: PurchaseReceiptSubmitItem[]
  }) => Promise<void>
  onReverse: (receiptId: string, reason: string) => Promise<void>
}

const numeric = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatQty = (value: number | string | null | undefined) =>
  numeric(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

const emptyFormItem = (): ReceiptFormItem => ({
  received: 0,
  accepted: 0,
  shortage: 0,
  damaged: 0,
  wrong: 0,
  excess: 0,
  note: '',
})

export default function PurchaseReceiptModal({
  open,
  documentId,
  documentCode,
  supplierName,
  items,
  receipts,
  receiptItems,
  stockLocations,
  productName,
  actorName,
  canReceive,
  canReverse,
  saving,
  onClose,
  onReceive,
  onReverse,
}: Props) {
  const [locationId, setLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [formItems, setFormItems] = useState<Record<string, ReceiptFormItem>>({})
  const [reverseReceiptId, setReverseReceiptId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')

  const progress = useMemo(
    () => buildPurchaseReceiptProgress(items, receipts, receiptItems),
    [items, receiptItems, receipts]
  )

  const pendingItems = useMemo(
    () => items.filter((item) => (progress.get(item.id)?.pending ?? numeric(item.quantity)) > 0),
    [items, progress]
  )

  const receiptItemsByReceipt = useMemo(() => {
    const map = new Map<string, PurchaseReceiptItemRow[]>()
    receiptItems.forEach((item) => {
      const list = map.get(item.receipt_id) ?? []
      list.push(item)
      map.set(item.receipt_id, list)
    })
    return map
  }, [receiptItems])

  useEffect(() => {
    if (!open) return
    setLocationId(
      stockLocations.find((location) => location.is_default)?.id || stockLocations[0]?.id || ''
    )
    setNotes('')
    setReverseReceiptId(null)
    setReverseReason('')
    setFormItems(Object.fromEntries(items.map((item) => [item.id, emptyFormItem()])))
  }, [documentId, items, open, stockLocations])

  const updateItem = (itemId: string, patch: Partial<ReceiptFormItem>) => {
    setFormItems((current) => ({
      ...current,
      [itemId]: { ...(current[itemId] ?? emptyFormItem()), ...patch },
    }))
  }

  const fillPending = (itemId: string) => {
    const pending = progress.get(itemId)?.pending ?? 0
    updateItem(itemId, { received: pending, accepted: pending })
  }

  const hasPayload = pendingItems.some((item) => {
    const value = formItems[item.id] ?? emptyFormItem()
    return (
      value.received > 0 ||
      value.accepted > 0 ||
      value.shortage > 0 ||
      value.damaged > 0 ||
      value.wrong > 0 ||
      value.excess > 0 ||
      value.note.trim().length > 0
    )
  })

  const submit = async () => {
    if (!locationId || !hasPayload || saving) return
    const payload = pendingItems
      .map((item) => {
        const value = formItems[item.id] ?? emptyFormItem()
        return {
          purchase_document_item_id: item.id,
          received_quantity: Math.max(0, numeric(value.received)),
          accepted_quantity: Math.max(0, numeric(value.accepted)),
          shortage_quantity: Math.max(0, numeric(value.shortage)),
          damaged_quantity: Math.max(0, numeric(value.damaged)),
          wrong_item_quantity: Math.max(0, numeric(value.wrong)),
          excess_quantity: Math.max(0, numeric(value.excess)),
          note: value.note.trim() || null,
        }
      })
      .filter(
        (item) =>
          item.received_quantity > 0 ||
          item.accepted_quantity > 0 ||
          item.shortage_quantity > 0 ||
          item.damaged_quantity > 0 ||
          item.wrong_item_quantity > 0 ||
          item.excess_quantity > 0 ||
          Boolean(item.note)
      )

    await onReceive({ locationId, notes: notes.trim() || null, items: payload })
  }

  const requestReverse = (receiptId: string) => {
    setReverseReceiptId(receiptId)
    setReverseReason('')
  }

  const confirmReverse = async () => {
    if (!reverseReceiptId || reverseReason.trim().length < 3 || saving) return
    await onReverse(reverseReceiptId, reverseReason.trim())
    setReverseReceiptId(null)
    setReverseReason('')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-[2px] sm:p-4">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-300 bg-white shadow-2xl ring-1 ring-black/10 dark:border-slate-500 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.85)] dark:ring-2 dark:ring-teal-400/20">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Recebimento da compra
            </h2>
            <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
              {documentCode} · {supplierName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Fechar recebimento"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {canReceive && pendingItems.length > 0 ? (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-700/60 dark:bg-emerald-950/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Local de estoque que recebe esta parcela
                  </label>
                  <select
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-white lg:max-w-xl"
                  >
                    <option value="">Selecione o local</option>
                    {stockLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name} ({location.code}){location.is_default ? ' · padrão' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-200">
                  Apenas a quantidade <b>aceita</b> entra no estoque.
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {pendingItems.map((item) => {
                  const itemProgress = progress.get(item.id)
                  const pending = itemProgress?.pending ?? numeric(item.quantity)
                  const value = formItems[item.id] ?? emptyFormItem()
                  const acceptedInvalid = value.accepted > pending || value.accepted > value.received

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-semibold text-slate-950 dark:text-white">
                            {productName(item.product_id)}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <span>Pedida: <b>{formatQty(itemProgress?.ordered)}</b></span>
                            <span>Já recebida: <b>{formatQty(itemProgress?.received)}</b></span>
                            <span>Pendente: <b>{formatQty(pending)}</b></span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => fillPending(item.id)}
                          className="self-start rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                        >
                          Preencher saldo pendente
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                        <label className="text-xs text-slate-600 dark:text-slate-300">
                          Recebida agora
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={value.received || ''}
                            onChange={(event) => updateItem(item.id, { received: Number(event.target.value || 0) })}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                          />
                        </label>
                        <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                          Aceita no estoque
                          <input
                            type="number"
                            min={0}
                            max={pending}
                            step={1}
                            value={value.accepted || ''}
                            onChange={(event) => updateItem(item.id, { accepted: Number(event.target.value || 0) })}
                            className={`mt-1 w-full rounded-lg border bg-white p-2 text-sm text-slate-950 dark:bg-slate-900 dark:text-white ${
                              acceptedInvalid
                                ? 'border-rose-500 ring-1 ring-rose-400'
                                : 'border-emerald-300 dark:border-emerald-700'
                            }`}
                          />
                        </label>
                        <label className="text-xs text-slate-600 dark:text-slate-300">
                          Falta
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={value.shortage || ''}
                            onChange={(event) => updateItem(item.id, { shortage: Number(event.target.value || 0) })}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                          />
                        </label>
                        <label className="text-xs text-slate-600 dark:text-slate-300">
                          Avaria
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={value.damaged || ''}
                            onChange={(event) => updateItem(item.id, { damaged: Number(event.target.value || 0) })}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                          />
                        </label>
                        <label className="text-xs text-slate-600 dark:text-slate-300">
                          Item incorreto
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={value.wrong || ''}
                            onChange={(event) => updateItem(item.id, { wrong: Number(event.target.value || 0) })}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                          />
                        </label>
                        <label className="text-xs text-slate-600 dark:text-slate-300">
                          Excesso
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={value.excess || ''}
                            onChange={(event) => updateItem(item.id, { excess: Number(event.target.value || 0) })}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                          />
                        </label>
                      </div>

                      <label className="mt-2 block text-xs text-slate-600 dark:text-slate-300">
                        Observação / divergência do item
                        <input
                          type="text"
                          value={value.note}
                          onChange={(event) => updateItem(item.id, { note: event.target.value })}
                          placeholder="Ex.: embalagem rasgada, sabor diferente, lote divergente"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        />
                      </label>

                      {acceptedInvalid ? (
                        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="h-4 w-4" />
                          A quantidade aceita não pode superar o saldo pendente nem a quantidade recebida agora.
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <label className="mt-4 block text-sm font-medium text-slate-800 dark:text-slate-100">
                Observações da parcela
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  placeholder="Opcional"
                />
              </label>

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={
                    saving ||
                    !locationId ||
                    !hasPayload ||
                    pendingItems.some((item) => {
                      const value = formItems[item.id] ?? emptyFormItem()
                      const pending = progress.get(item.id)?.pending ?? 0
                      return value.accepted > pending || value.accepted > value.received
                    })
                  }
                  onClick={() => void submit()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Registrar parcela
                </button>
              </div>
            </section>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              {pendingItems.length === 0
                ? 'Todos os itens desta compra já foram recebidos. Novas quantidades estão bloqueadas.'
                : 'Você não possui permissão para registrar recebimentos nesta compra.'}
            </div>
          )}

          <section>
            <div className="mb-3 flex items-center gap-2">
              <History className="h-5 w-5 text-teal-600 dark:text-teal-300" />
              <div>
                <h3 className="font-semibold text-slate-950 dark:text-white">Histórico de parcelas</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Registro imutável de local, usuário, horário, itens, divergências e eventuais reversões.
                </p>
              </div>
            </div>

            {receipts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Nenhuma parcela registrada ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map((receipt) => {
                  const currentItems = receiptItemsByReceipt.get(receipt.id) ?? []
                  const reversed = receipt.status === 'reversed'
                  const reversing = reverseReceiptId === receipt.id
                  return (
                    <article
                      key={receipt.id}
                      className={`rounded-2xl border p-4 ${
                        reversed
                          ? 'border-rose-200 bg-rose-50/60 dark:border-rose-800/70 dark:bg-rose-950/20'
                          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-950 dark:text-white">
                              {receipt.receipt_code}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                reversed
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                              }`}
                            >
                              {reversed ? 'Revertida' : 'Ativa'}
                            </span>
                            {receipt.divergence_count > 0 ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                                {receipt.divergence_count} divergência(s)
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {receipt.location_name} · {formatDateTime(receipt.received_at)} · {actorName(receipt.received_by)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Informada: {formatQty(receipt.reported_quantity_total)} · Aceita no estoque: {formatQty(receipt.accepted_quantity_total)}
                          </div>
                          {receipt.notes ? (
                            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{receipt.notes}</p>
                          ) : null}
                        </div>

                        {!reversed && canReverse ? (
                          <button
                            type="button"
                            onClick={() => requestReverse(receipt.id)}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950/40"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Reverter parcela
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {currentItems.map((item) => {
                          const hasDivergence =
                            numeric(item.shortage_quantity) > 0 ||
                            numeric(item.damaged_quantity) > 0 ||
                            numeric(item.wrong_item_quantity) > 0 ||
                            numeric(item.excess_quantity) > 0 ||
                            Boolean(item.divergence_note)
                          return (
                            <div
                              key={item.id}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <div className="font-semibold text-slate-950 dark:text-white">
                                {productName(item.product_id)}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                <span>Pedida: {formatQty(item.ordered_quantity)}</span>
                                <span>Já recebida: {formatQty(item.previously_received_quantity)}</span>
                                <span>Recebida agora: {formatQty(item.reported_quantity)}</span>
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                  Aceita: {formatQty(item.accepted_quantity)}
                                </span>
                                <span>Pendente após: {formatQty(item.pending_after_quantity)}</span>
                              </div>
                              {hasDivergence ? (
                                <div className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                                  Falta {formatQty(item.shortage_quantity)} · Avaria {formatQty(item.damaged_quantity)} · Item incorreto {formatQty(item.wrong_item_quantity)} · Excesso {formatQty(item.excess_quantity)}
                                  {item.divergence_note ? ` · ${item.divergence_note}` : ''}
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>

                      {reversed ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-white/70 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-200">
                          Revertida em {formatDateTime(receipt.reversed_at)} por {actorName(receipt.reversed_by)}. Motivo: {receipt.reversal_reason || '—'}
                        </div>
                      ) : null}

                      {reversing ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/30">
                          <label className="text-xs font-semibold text-rose-900 dark:text-rose-100">
                            Motivo da reversão
                            <textarea
                              rows={2}
                              value={reverseReason}
                              onChange={(event) => setReverseReason(event.target.value)}
                              className="mt-1 w-full rounded-lg border border-rose-300 bg-white p-2 text-sm text-slate-950 dark:border-rose-700 dark:bg-slate-950 dark:text-white"
                              placeholder="Obrigatório. O histórico será preservado."
                            />
                          </label>
                          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setReverseReceiptId(null)
                                setReverseReason('')
                              }}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600"
                            >
                              Voltar
                            </button>
                            <button
                              type="button"
                              disabled={saving || reverseReason.trim().length < 3}
                              onClick={() => void confirmReverse()}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Confirmar reversão auditável
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
