import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  CheckCircle2,
  Eye,
  FileText,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import AlertBanner from '@/components/common/AlertBanner';
import StatsCard from '@/components/common/StatsCard';

import type { Supplier } from '@/pages/private/admin/products/suppliers/types/supplier.types';
import { useInventory } from '@/pages/private/admin/products/inventory/hooks/useInventory';

type PurchaseDocumentStatus = 'draft' | 'confirmed' | 'canceled' | 'cancelled';

type PurchaseDocument = {
  id: string;
  store_id: string;
  supplier_id: string | null;
  status: PurchaseDocumentStatus;
  issue_date: string | null;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
  total_amount: number | null;
};

type PurchaseDocumentItemInput = {
  id?: string;
  product_id: string;
  quantity: number;
  unit_cost: number | null;
};

type StoreLike = { id: string };

type InventoryProductLike = {
  id: string;
  name: string;
  active?: boolean | null;
  discontinued?: boolean | null;
  is_discontinued?: boolean | null;
};

const getCurrentStore = async (): Promise<StoreLike | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: storeData, error } = await supabase.rpc('get_user_store_by_id', {
    p_user_id: user.id,
  });

  if (error || !storeData) return null;

  const store = Array.isArray(storeData) ? storeData[0] : storeData;
  if (!store?.id) return null;

  return { id: store.id };
};

const money = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export default function PurchaseDocumentsPage() {
  const { products: inventoryProducts } = useInventory();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [documents, setDocuments] = useState<PurchaseDocument[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);

  const [draftOpen, setDraftOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingReadOnly, setEditingReadOnly] = useState(false);

  const [draftSupplierId, setDraftSupplierId] = useState<string>('');
  const [draftIssueDate, setDraftIssueDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [draftInvoiceNumber, setDraftInvoiceNumber] = useState<string>('');
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [draftItems, setDraftItems] = useState<PurchaseDocumentItemInput[]>([
    { product_id: '', quantity: 1, unit_cost: null },
  ]);

  const products = useMemo(() => {
    return ((inventoryProducts ?? []) as InventoryProductLike[]).filter(
      (p) =>
        p.active !== false &&
        p.discontinued !== true &&
        p.is_discontinued !== true,
    );
  }, [inventoryProducts]);

  const supplierName = useCallback(
    (id: string | null) => {
      if (!id) return '—';
      return suppliers.find((s) => s.id === id)?.name ?? '—';
    },
    [suppliers],
  );

  const stats = useMemo(() => {
    const drafts = documents.filter((d) => d.status === 'draft').length;
    const confirmed = documents.filter((d) => d.status === 'confirmed').length;
    const totalConfirmed = documents
      .filter((d) => d.status === 'confirmed')
      .reduce((sum, d) => sum + (d.total_amount ?? 0), 0);

    return { drafts, confirmed, totalConfirmed };
  }, [documents]);

  const canSaveDraft = useMemo(() => {
    if (!storeId) return false;
    return draftItems.some((i) => i.product_id && i.quantity > 0);
  }, [draftItems, storeId]);

  const currentDraftTotal = useMemo(() => {
    return draftItems.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const unit = Number(item.unit_cost || 0);
      return sum + qty * unit;
    }, 0);
  }, [draftItems]);

  const resetDraft = useCallback(() => {
    setEditingDocId(null);
    setEditingReadOnly(false);
    setDraftSupplierId('');
    setDraftIssueDate(new Date().toISOString().slice(0, 10));
    setDraftInvoiceNumber('');
    setDraftNotes('');
    setDraftItems([{ product_id: '', quantity: 1, unit_cost: null }]);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const store = await getCurrentStore();
      if (!store) throw new Error('Loja não encontrada');

      setStoreId(store.id);

      const [{ data: sData, error: sErr }, { data: dData, error: dErr }] =
        await Promise.all([
          supabase
            .from('suppliers')
            .select('*')
            .eq('store_id', store.id)
            .order('name', { ascending: true }),
          supabase
            .from('purchase_documents')
            .select('*')
            .eq('store_id', store.id)
            .order('created_at', { ascending: false }),
        ]);

      if (sErr) throw sErr;
      if (dErr) throw dErr;

      setSuppliers((sData ?? []) as Supplier[]);
      setDocuments((dData ?? []) as PurchaseDocument[]);
    } catch (e: unknown) {
      console.error('Error loading purchase documents:', e);
      const message =
        e instanceof Error ? e.message : 'Erro ao carregar documentos';
      setPageError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const addDraftItem = useCallback(() => {
    setDraftItems((prev) => [
      ...prev,
      { product_id: '', quantity: 1, unit_cost: null },
    ]);
  }, []);

  const removeDraftItem = useCallback((idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateDraftItem = useCallback(
    (idx: number, patch: Partial<PurchaseDocumentItemInput>) => {
      setDraftItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
      );
    },
    [],
  );

  const openNewDraft = useCallback(() => {
    resetDraft();
    setDraftOpen(true);
  }, [resetDraft]);

  const openDocument = useCallback(
    async (doc: PurchaseDocument, readOnly = false) => {
      try {
        setSaving(true);
        setPageError(null);

        const { data: itemsData, error: itemsErr } = await supabase
          .from('purchase_document_items')
          .select(
            'id,purchase_document_id,store_id,product_id,quantity,unit_cost,total_cost',
          )
          .eq('purchase_document_id', doc.id)
          .order('id', { ascending: true });

        if (itemsErr) throw itemsErr;

        setEditingDocId(doc.id);
        setEditingReadOnly(doc.status === 'confirmed' || readOnly);
        setDraftSupplierId(doc.supplier_id ?? '');
        setDraftIssueDate(
          doc.issue_date ?? new Date().toISOString().slice(0, 10),
        );
        setDraftInvoiceNumber(doc.invoice_number ?? '');
        setDraftNotes(doc.notes ?? '');
        setDraftItems(
          (
            (itemsData ?? []) as Array<{
              id: string;
              purchase_document_id: string;
              store_id: string;
              product_id: string;
              quantity: number;
              unit_cost: number | null;
              total_cost: number | null;
            }>
          ).map((item) => ({
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
          })),
        );

        setDraftOpen(true);
      } catch (e: unknown) {
        console.error('Error opening purchase document:', e);
        const message =
          e instanceof Error ? e.message : 'Erro ao abrir documento';
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const createOrUpdateDraft = useCallback(async () => {
    if (!storeId) return;

    if (!canSaveDraft) {
      toast.error('Adicione ao menos 1 item válido');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        store_id: storeId,
        supplier_id: draftSupplierId || null,
        status: 'draft' as const,
        issue_date: draftIssueDate || null,
        invoice_number: draftInvoiceNumber.trim() || null,
        notes: draftNotes.trim() || null,
        total_amount: currentDraftTotal,
      };

      let docId = editingDocId;

      if (docId) {
        const { error: updateErr } = await supabase
          .from('purchase_documents')
          .update(payload)
          .eq('id', docId);

        if (updateErr) throw updateErr;

        const { error: delErr } = await supabase
          .from('purchase_document_items')
          .delete()
          .eq('purchase_document_id', docId);

        if (delErr) throw delErr;
      } else {
        const { data: doc, error: createErr } = await supabase
          .from('purchase_documents')
          .insert(payload)
          .select('id')
          .single();

        if (createErr) throw createErr;
        docId = doc.id as string;
      }

      const itemsPayload = draftItems
        .filter((i) => i.product_id && i.quantity > 0)
        .map((i) => ({
          store_id: storeId,
          purchase_document_id: docId,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
        }));

      const { error: itemsErr } = await supabase
        .from('purchase_document_items')
        .insert(itemsPayload);

      if (itemsErr) throw itemsErr;

      toast.success(editingDocId ? 'Documento atualizado' : 'Documento criado');

      setDraftOpen(false);
      resetDraft();
      await fetchAll();
    } catch (e: unknown) {
      console.error('Error saving purchase document:', e);
      const message =
        e instanceof Error ? e.message : 'Erro ao salvar documento';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [
    storeId,
    canSaveDraft,
    draftSupplierId,
    draftIssueDate,
    draftInvoiceNumber,
    draftNotes,
    currentDraftTotal,
    editingDocId,
    draftItems,
    fetchAll,
    resetDraft,
  ]);

  const confirmDocument = useCallback(
    async (docId: string) => {
      const confirmed = window.confirm(
        'Confirmar esta entrada lançará o estoque e não poderá ser desfeito automaticamente.\n\nDeseja continuar?',
      );

      if (!confirmed) return;

      setSaving(true);
      try {
        const { data: document, error: documentErr } = await supabase
          .from('purchase_documents')
          .select('*')
          .eq('id', docId)
          .maybeSingle();

        if (documentErr) throw documentErr;
        if (!document) throw new Error('Documento não encontrado');

        if (document.status === 'confirmed') {
          toast.success('Documento já estava confirmado');
          await fetchAll();
          return;
        }

        const { error } = await supabase.rpc('confirm_purchase_document', {
          p_document_id: docId,
        });

        if (error) throw error;

        toast.success('Entrada confirmada e lançada no estoque');
        setDraftOpen(false);
        resetDraft();
        await fetchAll();
      } catch (e: unknown) {
        console.error('Error confirming purchase document:', e);
        const message =
          e instanceof Error ? e.message : 'Erro ao confirmar documento';
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [fetchAll, resetDraft],
  );

  const deleteDraft = useCallback(
    async (docId: string) => {
      const confirmed = window.confirm(
        'Excluir este rascunho é uma operação irreversível.\n\nDeseja continuar?',
      );

      if (!confirmed) return;

      setSaving(true);
      try {
        const { error: iErr } = await supabase
          .from('purchase_document_items')
          .delete()
          .eq('purchase_document_id', docId);

        if (iErr) throw iErr;

        const { error: dErr } = await supabase
          .from('purchase_documents')
          .delete()
          .eq('id', docId);

        if (dErr) throw dErr;

        toast.success('Documento removido');

        if (editingDocId === docId) {
          setDraftOpen(false);
          resetDraft();
        }

        await fetchAll();
      } catch (e: unknown) {
        console.error('Error deleting document:', e);
        const message =
          e instanceof Error ? e.message : 'Erro ao remover documento';
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [editingDocId, fetchAll, resetDraft],
  );

  return (
    <PageContainer title="Entradas (Documentos de Compra)">
      {pageError ? (
        <AlertBanner type="error" title="Atenção" message={pageError} />
      ) : null}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatsCard
              title="Rascunhos"
              value={stats.drafts}
              icon={<FileText className="h-5 w-5" />}
            />
            <StatsCard
              title="Confirmados"
              value={stats.confirmed}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatsCard
              title="Total confirmado"
              value={money(stats.totalConfirmed)}
              icon={<Save className="h-5 w-5" />}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Crie um documento para lançar vários itens de uma única nota/romaneio.
            </div>

            <button
              className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
              onClick={openNewDraft}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Novo documento
            </button>
          </div>

          {draftOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingReadOnly
                      ? 'Documento confirmado (somente leitura)'
                      : editingDocId
                        ? 'Editar documento'
                        : 'Nova entrada por documento'}
                  </h2>
                  <button
                    className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    onClick={() => setDraftOpen(false)}
                    type="button"
                  >
                    Fechar
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-gray-700 dark:text-gray-200">
                      Fornecedor
                    </label>
                    <select
                      className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      value={draftSupplierId}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setDraftSupplierId(e.target.value)
                      }
                      disabled={editingReadOnly}
                    >
                      <option value="">(Sem fornecedor)</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-gray-700 dark:text-gray-200">
                      Data
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      value={draftIssueDate}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setDraftIssueDate(e.target.value)
                      }
                      disabled={editingReadOnly}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-gray-700 dark:text-gray-200">
                      Nº Nota / Documento
                    </label>
                    <input
                      className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      value={draftInvoiceNumber}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setDraftInvoiceNumber(e.target.value)
                      }
                      placeholder="Ex: 12345"
                      disabled={editingReadOnly}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-gray-700 dark:text-gray-200">
                      Observações
                    </label>
                    <input
                      className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      value={draftNotes}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setDraftNotes(e.target.value)
                      }
                      placeholder="Opcional"
                      disabled={editingReadOnly}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Itens
                    </div>

                    {!editingReadOnly ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                        onClick={addDraftItem}
                        type="button"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar item
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {draftItems.map((it, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 gap-2 rounded-2xl border border-gray-200 p-3 dark:border-gray-800 md:grid-cols-12"
                      >
                        <div className="md:col-span-6">
                          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-300">
                            Produto
                          </label>
                          <select
                            className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                            value={it.product_id}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                              updateDraftItem(idx, { product_id: e.target.value })
                            }
                            disabled={editingReadOnly}
                          >
                            <option value="">Selecione...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-300">
                            Qtd
                          </label>
                          <input
                            type="number"
                            min={1}
                            className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                            value={it.quantity}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              updateDraftItem(idx, {
                                quantity: Number(e.target.value || 0),
                              })
                            }
                            disabled={editingReadOnly}
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-300">
                            Custo unitário (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                            value={it.unit_cost ?? ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              updateDraftItem(idx, {
                                unit_cost:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                            disabled={editingReadOnly}
                          />
                        </div>

                        <div className="md:col-span-1 flex items-end justify-end">
                          {!editingReadOnly ? (
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                              onClick={() => removeDraftItem(idx)}
                              title="Remover"
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Total do documento:{' '}
                    <span className="font-semibold">{money(currentDraftTotal)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!editingReadOnly ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
                        onClick={() => void createOrUpdateDraft()}
                        disabled={saving || !canSaveDraft}
                        type="button"
                      >
                        <Save className="h-4 w-4" />
                        {editingDocId ? 'Salvar alterações' : 'Salvar rascunho'}
                      </button>
                    ) : null}

                    {editingDocId && !editingReadOnly ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
                        onClick={() => void confirmDocument(editingDocId)}
                        disabled={saving}
                        type="button"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Confirmar
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="grid grid-cols-12 gap-2 border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <div className="col-span-4">Fornecedor</div>
              <div className="col-span-2">Documento</div>
              <div className="col-span-2">Emissão</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {documents.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300">
                  Nenhum documento criado ainda.
                </div>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                    <div className="col-span-4 min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {supplierName(doc.supplier_id)}
                      </div>
                    </div>

                    <div className="col-span-2 text-sm text-gray-700 dark:text-gray-300">
                      {doc.invoice_number || '—'}
                    </div>

                    <div className="col-span-2 text-sm text-gray-700 dark:text-gray-300">
                      {doc.issue_date || '—'}
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${doc.status === 'confirmed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                          }`}
                      >
                        {doc.status === 'confirmed' ? 'Confirmado' : 'Rascunho'}
                      </span>
                    </div>

                    <div className="col-span-1 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {money(doc.total_amount)}
                    </div>

                    <div className="col-span-2 flex justify-end gap-2">
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                        onClick={() => void openDocument(doc, true)}
                        title="Visualizar"
                        type="button"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {doc.status === 'draft' ? (
                        <>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                            onClick={() => void openDocument(doc, false)}
                            title="Editar"
                            type="button"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-green-600 text-white hover:opacity-90 disabled:opacity-60"
                            onClick={() => void confirmDocument(doc.id)}
                            disabled={saving}
                            title="Confirmar"
                            type="button"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>

                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white hover:opacity-90 disabled:opacity-60"
                            onClick={() => void deleteDraft(doc.id)}
                            disabled={saving}
                            title="Excluir"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
            <div className="font-medium text-gray-900 dark:text-white">
              Como usar
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Clique em <b>Novo documento</b> e preencha fornecedor, nota e itens.
              </li>
              <li>
                Salve o documento como <b>rascunho</b>.
              </li>
              <li>
                Revise em <b>Visualizar</b> ou <b>Editar</b>.
              </li>
              <li>
                Clique em <b>Confirmar</b> para lançar no estoque.
              </li>
            </ol>
          </div>
        </div>
      )}
    </PageContainer>
  );
}