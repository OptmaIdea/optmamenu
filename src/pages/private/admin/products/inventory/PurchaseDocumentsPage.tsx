import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Plus, Save, Trash2, Truck } from 'lucide-react';

import PageContainer from '@/components/common/PageContainer';
import AlertBanner from '@/components/common/AlertBanner';
import StatsCard from '@/components/common/StatsCard';
import { supabase } from '@/lib/supabase';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';

type Supplier = {
  id: string;
  name: string;
  active: boolean;
};

type Product = {
  id: string;
  name: string;
  discontinued: boolean | null;
  is_discontinued: boolean | null;
};

type PurchaseDocumentStatus = 'draft' | 'confirmed' | 'cancelled';

type PurchaseDocumentRow = {
  id: string;
  created_at: string;
  store_id: string;
  supplier_id: string;
  invoice_number: string | null;
  issue_date: string | null;
  total_amount: number | null;
  notes: string | null;
  status: PurchaseDocumentStatus;

  supplier?: { name: string }[] | null;
};

type PurchaseDocumentItemRow = {
  id: string;
  document_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number | null;
};

type LineItemDraft = {
  product_id: string;
  quantity: string; // string para inputs
  unit_cost: string; // string para inputs
};

function toNumber(v: string): number {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function money(v: number | null | undefined): string {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PurchaseDocumentsPage() {
  const { storeId } = useCurrentStore();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [documents, setDocuments] = useState<PurchaseDocumentRow[]>([]);

  // Editor
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { product_id: '', quantity: '1', unit_cost: '0' },
  ]);

  const computedTotal = useMemo(() => {
    return lineItems.reduce((acc, li) => acc + toNumber(li.quantity) * toNumber(li.unit_cost), 0);
  }, [lineItems]);

  const resetEditor = useCallback(() => {
    setEditingId(null);
    setSupplierId('');
    setInvoiceNumber('');
    setIssueDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setLineItems([{ product_id: '', quantity: '1', unit_cost: '0' }]);
  }, []);

  const openNew = useCallback(() => {
    resetEditor();
    setEditorOpen(true);
  }, [resetEditor]);

  const loadAll = useCallback(async () => {
    if (!storeId) return;

    setLoading(true);
    setError(null);

    const [supRes, prodRes, docRes] = await Promise.all([
      supabase.from('suppliers').select('id,name,active').eq('store_id', storeId).order('name', { ascending: true }),
      supabase
        .from('products')
        .select('id,name,discontinued,is_discontinued')
        .eq('store_id', storeId)
        .eq('active', true)
        // safety: exclui descontinuados (independente de qual flag teu banco esteja usando)
        .eq('discontinued', false)
        .eq('is_discontinued', false)
        .order('name', { ascending: true }),
      supabase
        .from('purchase_documents')
        .select(
          'id,created_at,store_id,supplier_id,invoice_number,issue_date,total_amount,notes,status,supplier:suppliers(name)',
        )
        .eq('store_id', storeId)
        .order('created_at', { ascending: false }),
    ]);

    if (supRes.error) setError(supRes.error.message);
    if (prodRes.error) setError(prodRes.error.message);
    if (docRes.error) setError(docRes.error.message);

    setSuppliers((supRes.data as Supplier[]) || []);
    setProducts((prodRes.data as Product[]) || []);
    setDocuments((docRes.data as PurchaseDocumentRow[]) || []);

    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const addLine = useCallback(() => {
    setLineItems((prev) => [...prev, { product_id: '', quantity: '1', unit_cost: '0' }]);
  }, []);

  const removeLine = useCallback((idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateLine = useCallback((idx: number, patch: Partial<LineItemDraft>) => {
    setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, ...patch } : li)));
  }, []);

  const loadForEdit = useCallback(
    async (id: string) => {
      if (!storeId) return;

      setError(null);

      const docRes = await supabase
        .from('purchase_documents')
        .select('id,created_at,store_id,supplier_id,invoice_number,issue_date,total_amount,notes,status')
        .eq('store_id', storeId)
        .eq('id', id)
        .maybeSingle();

      if (docRes.error) {
        setError(docRes.error.message);
        return;
      }
      if (!docRes.data) {
        setError('Documento não encontrado.');
        return;
      }

      const itemsRes = await supabase
        .from('purchase_document_items')
        .select('id,document_id,product_id,quantity,unit_cost,total_cost')
        .eq('document_id', id)
        .order('id', { ascending: true });

      if (itemsRes.error) {
        setError(itemsRes.error.message);
        return;
      }

      const doc = docRes.data as PurchaseDocumentRow;
      const items = (itemsRes.data as PurchaseDocumentItemRow[]) || [];

      setEditingId(doc.id);
      setSupplierId(doc.supplier_id);
      setInvoiceNumber(doc.invoice_number ?? '');
      setIssueDate((doc.issue_date ?? new Date().toISOString().slice(0, 10)) as string);
      setNotes(doc.notes ?? '');
      setLineItems(
        items.length
          ? items.map((it) => ({
            product_id: it.product_id,
            quantity: String(it.quantity ?? 0),
            unit_cost: String(it.unit_cost ?? 0),
          }))
          : [{ product_id: '', quantity: '1', unit_cost: '0' }],
      );

      setEditorOpen(true);
    },
    [storeId],
  );

  const checkInvoiceUnique = useCallback(
    async (pSupplierId: string, pInvoice: string, excludeId?: string | null) => {
      if (!storeId) return true;

      const inv = pInvoice.trim();
      if (!inv) return true;

      let q = supabase
        .from('purchase_documents')
        .select('id')
        .eq('store_id', storeId)
        .eq('supplier_id', pSupplierId)
        .eq('invoice_number', inv)
        .limit(1);

      if (excludeId) q = q.neq('id', excludeId);

      const res = await q;
      if (res.error) return true; // não bloqueia caso falhe o check
      return (res.data ?? []).length === 0;
    },
    [storeId],
  );

  const upsertDraft = useCallback(async () => {
    if (!storeId) return;

    setError(null);

    const sId = supplierId.trim();
    if (!sId) {
      setError('Selecione um fornecedor.');
      return;
    }

    const inv = invoiceNumber.trim();
    if (inv) {
      const ok = await checkInvoiceUnique(sId, inv, editingId);
      if (!ok) {
        setError('Já existe um documento com esse número para este fornecedor.');
        return;
      }
    }

    const normalizedLines = lineItems
      .map((li) => ({
        product_id: li.product_id,
        quantity: toNumber(li.quantity),
        unit_cost: toNumber(li.unit_cost),
      }))
      .filter((li) => li.product_id && li.quantity > 0);

    if (!normalizedLines.length) {
      setError('Adicione pelo menos 1 item com produto e quantidade.');
      return;
    }

    // Header
    let docId = editingId;

    if (!docId) {
      const createRes = await supabase
        .from('purchase_documents')
        .insert({
          store_id: storeId,
          supplier_id: sId,
          invoice_number: inv || null,
          issue_date: issueDate || null,
          notes: notes || null,
          status: 'draft',
        })
        .select('id')
        .single();

      if (createRes.error) {
        setError(createRes.error.message);
        return;
      }
      docId = createRes.data.id as string;
      setEditingId(docId);
    } else {
      const updateRes = await supabase
        .from('purchase_documents')
        .update({
          supplier_id: sId,
          invoice_number: inv || null,
          issue_date: issueDate || null,
          notes: notes || null,
        })
        .eq('store_id', storeId)
        .eq('id', docId);

      if (updateRes.error) {
        setError(updateRes.error.message);
        return;
      }
    }

    // Itens (replace simples por enquanto)
    const delRes = await supabase.from('purchase_document_items').delete().eq('document_id', docId);
    if (delRes.error) {
      setError(delRes.error.message);
      return;
    }

    const insRes = await supabase.from('purchase_document_items').insert(
      normalizedLines.map((li) => ({
        document_id: docId,
        product_id: li.product_id,
        quantity: li.quantity,
        unit_cost: li.unit_cost,
      })),
    );

    if (insRes.error) {
      setError(insRes.error.message);
      return;
    }

    // Total no header
    const total = normalizedLines.reduce((acc, li) => acc + li.quantity * li.unit_cost, 0);
    const totRes = await supabase.from('purchase_documents').update({ total_amount: total }).eq('store_id', storeId).eq('id', docId);

    if (totRes.error) {
      setError(totRes.error.message);
      return;
    }

    await loadAll();
  }, [storeId, supplierId, invoiceNumber, issueDate, notes, lineItems, editingId, checkInvoiceUnique, loadAll]);

  const confirmDocument = useCallback(
    async (id: string) => {
      setError(null);

      const res = await supabase.rpc('confirm_purchase_document', { p_document_id: id });
      if (res.error) {
        setError(res.error.message);
        return;
      }

      await loadAll();
      setEditorOpen(false);
    },
    [loadAll],
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      if (!storeId) return;

      setError(null);

      const delItems = await supabase.from('purchase_document_items').delete().eq('document_id', id);
      if (delItems.error) {
        setError(delItems.error.message);
        return;
      }

      const delDoc = await supabase.from('purchase_documents').delete().eq('store_id', storeId).eq('id', id);
      if (delDoc.error) {
        setError(delDoc.error.message);
        return;
      }

      await loadAll();

      if (editingId === id) {
        setEditorOpen(false);
        resetEditor();
      }
    },
    [storeId, loadAll, editingId, resetEditor],
  );

  const stats = useMemo(() => {
    const drafts = documents.filter((d) => d.status === 'draft').length;
    const confirmed = documents.filter((d) => d.status === 'confirmed').length;
    const totalConfirmed = documents
      .filter((d) => d.status === 'confirmed')
      .reduce((acc, d) => acc + (typeof d.total_amount === 'number' ? d.total_amount : 0), 0);

    return { drafts, confirmed, totalConfirmed };
  }, [documents]);

  return (
    <PageContainer title="Entradas (Documentos de Compra)">
      {error ? <AlertBanner type="error" title="Atenção" message={error} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard title="Rascunhos" value={stats.drafts} icon={<FileText className="h-5 w-5" />} />
        <StatsCard title="Confirmados" value={stats.confirmed} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatsCard title="Total confirmado" value={money(stats.totalConfirmed)} icon={<Truck className="h-5 w-5" />} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          Crie um documento para lançar <span className="font-medium">vários itens</span> de uma única nota/romaneio.
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Novo documento
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
        <div className="grid grid-cols-12 gap-2 border-b bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
          <div className="col-span-3">Fornecedor</div>
          <div className="col-span-2">Documento</div>
          <div className="col-span-2">Emissão</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-1 text-right">Ações</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-slate-600">Carregando…</div>
        ) : documents.length === 0 ? (
          <div className="p-4 text-sm text-slate-600">Nenhum documento ainda.</div>
        ) : (
          <div className="divide-y">
            {documents.map((d) => (
              <div key={d.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-3 truncate">{d.supplier?.[0]?.name ?? '—'}</div>
                <div className="col-span-2 truncate">{d.invoice_number ?? '—'}</div>
                <div className="col-span-2 truncate">{d.issue_date ?? '—'}</div>
                <div className="col-span-2">
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                      d.status === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : d.status === 'draft'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-700',
                    ].join(' ')}
                  >
                    {d.status === 'confirmed' ? 'Confirmado' : d.status === 'draft' ? 'Rascunho' : 'Cancelado'}
                  </span>
                </div>
                <div className="col-span-2 text-right font-medium">{money(d.total_amount)}</div>
                <div className="col-span-1 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void loadForEdit(d.id)}
                    className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50"
                  >
                    Ver
                  </button>

                  {d.status !== 'confirmed' ? (
                    <button
                      type="button"
                      onClick={() => void confirmDocument(d.id)}
                      className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      title="Confirmar (dá entrada no estoque)"
                    >
                      Confirmar
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void deleteDocument(d.id)}
                    className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b p-4">
              <div>
                <div className="text-lg font-semibold">{editingId ? 'Revisar documento' : 'Novo documento'}</div>
                <div className="text-xs text-slate-600">Salve rascunho, revise e depois confirme.</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditorOpen(false);
                  setError(null);
                }}
                className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              <label className="block text-sm">
                <div className="mb-1 text-xs font-semibold text-slate-600">Fornecedor</div>
                <select
                  value={supplierId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSupplierId(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} disabled={!s.active}>
                      {s.name}
                      {!s.active ? ' (inativo)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <div className="mb-1 text-xs font-semibold text-slate-600">Número do documento</div>
                <input
                  value={invoiceNumber}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setInvoiceNumber(e.target.value)}
                  placeholder="Ex: 124"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm">
                <div className="mb-1 text-xs font-semibold text-slate-600">Data de emissão</div>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setIssueDate(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="md:col-span-3 block text-sm">
                <div className="mb-1 text-xs font-semibold text-slate-600">Observações</div>
                <textarea
                  value={notes}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Opcional"
                />
              </label>
            </div>

            <div className="border-t px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Itens</div>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar item
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border">
                <div className="grid grid-cols-12 gap-2 border-b bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                  <div className="col-span-6">Produto</div>
                  <div className="col-span-2">Qtd</div>
                  <div className="col-span-3">Custo unit.</div>
                  <div className="col-span-1 text-right">—</div>
                </div>

                <div className="divide-y">
                  {lineItems.map((li, idx) => (
                    <div key={idx} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                      <div className="col-span-6">
                        <select
                          value={li.product_id}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => updateLine(idx, { product_id: e.target.value })}
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                        >
                          <option value="">Selecione…</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          value={li.quantity}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateLine(idx, { quantity: e.target.value })}
                          inputMode="decimal"
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          value={li.unit_cost}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateLine(idx, { unit_cost: e.target.value })}
                          inputMode="decimal"
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {li.product_id ? (
                        <div className="col-span-12 -mt-1 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <span className="font-medium">Subtotal:</span>
                            {money(toNumber(li.quantity) * toNumber(li.unit_cost))}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Confirmar deve dar entrada no estoque (via RPC no banco).</span>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-600">Total</div>
                  <div className="text-lg font-semibold">{money(computedTotal)}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditorOpen(false);
                    setError(null);
                  }}
                  className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => void upsertDraft()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                >
                  <Save className="h-4 w-4" />
                  Salvar rascunho
                </button>

                {editingId ? (
                  <button
                    type="button"
                    onClick={() => void confirmDocument(editingId)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
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
    </PageContainer>
  );
}