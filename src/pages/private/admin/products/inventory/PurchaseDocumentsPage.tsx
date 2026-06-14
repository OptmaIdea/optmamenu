import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  formatDateOnlyPtBr,
  formatDateTimeForExportPtBr,
  getLocalDateInputValue,
} from '@/utils/dateTime';
import {
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  XCircle,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { PurchaseQuotationsPanel } from './components/PurchaseQuotationsPanel';
import { supabase } from '@/lib/supabase';
import { stockService } from '@/services/stockService';
import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import AlertBanner from '@/components/common/AlertBanner';
import StatsCard from '@/components/common/StatsCard';
import { buildCsv, downloadCsv, formatCsvNumberBR } from '@/utils/csv';

import type { Supplier } from '@/pages/private/admin/products/suppliers/types/supplier.types';
import { isSupplierPurchaseEligible } from './utils/supplierStatusUtils';
import { useInventory } from '@/pages/private/admin/products/inventory/hooks/useInventory';
import { PurchaseSuggestionsPanel } from '@/pages/private/admin/products/inventory/components/PurchaseSuggestionsPanel';
import OperationalTimeline from './components/OperationalTimeline';
import { useOperationalTimeline } from './hooks/useOperationalTimeline';
import { getActiveStoreId } from '@/utils/activeStore';
import { usePermissions } from '@/hooks/usePermissions';

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
  cancelled_at?: string | null;
  cancel_reason?: string | null;
};

type PurchaseDocumentItemInput = {
  id?: string;
  product_id: string;
  quantity: number;
  unit_cost: number | null;
};

type PurchaseDocumentItemRow = {
  id: string;
  purchase_document_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
};

/* type StoreLike = { id: string }; */

type InventoryProductLike = {
  id: string;
  name: string;
  active?: boolean | null;
  discontinued?: boolean | null;
  is_discontinued?: boolean | null;
  last_entry_unit_cost?: number | null;
};

const money = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
};

const shortId = (value?: string | null) => {
  if (!value) return '—';
  return value.slice(0, 8);
};

const formatDatePtBr = (value?: string | null) => formatDateOnlyPtBr(value, '');

/* const formatDateTimePtBr = (value?: string | null) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}; */

const getPurchaseDocumentStatusLabel = (status?: string | null) => {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'confirmed':
      return 'Confirmado';
    case 'cancelled':
    case 'canceled':
      return 'Cancelado';
    default:
      return status || 'Não informado';
  }
};

export default function PurchaseDocumentsPage() {
  const navigate = useNavigate();

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.getElementById('quick-access-actions-portal'));
  }, []);

  const { products: inventoryProducts } = useInventory();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const eligibleSuppliers = useMemo(() => suppliers.filter(isSupplierPurchaseEligible), [suppliers]);
  const [documents, setDocuments] = useState<PurchaseDocument[]>([]);
  const [documentItems, setDocumentItems] = useState<PurchaseDocumentItemRow[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);

  const [draftOpen, setDraftOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingReadOnly, setEditingReadOnly] = useState(false);

  const [draftSupplierId, setDraftSupplierId] = useState<string>('');
  const [draftIssueDate, setDraftIssueDate] = useState<string>(() =>
    getLocalDateInputValue(),
  );
  const [draftInvoiceNumber, setDraftInvoiceNumber] = useState<string>('');
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [draftItems, setDraftItems] = useState<PurchaseDocumentItemInput[]>([
    { product_id: '', quantity: 1, unit_cost: null },
  ]);

  const [editingStatus, setEditingStatus] = useState<PurchaseDocumentStatus | null>(null);
  const [autoOpenedDocId, setAutoOpenedDocId] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PurchaseDocument | null>(null);
  const [cancelReason, setCancelReason] = useState('');


  const activeStoreId = getActiveStoreId();
  const { hasPermission } = usePermissions(activeStoreId);
  const canCreatePurchase = hasPermission('purchases.create');
  const canConfirmPurchase = hasPermission('purchases.confirm');
  const canCancelPurchase = hasPermission('purchases.cancel');

  const {
    events: purchaseDocumentTimelineEvents,
    loading: loadingPurchaseDocumentTimeline,
    refetch: refetchPurchaseDocumentTimeline,
  } = useOperationalTimeline({
    enabled: Boolean(draftOpen && editingDocId),
    storeId,
    entityType: 'purchase_document',
    relatedPurchaseDocumentId: editingDocId,
    limit: 30,
  });

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    supplierId: searchParams.get('supplier_id') || '',
    productId: searchParams.get('product_id') || '',
    invoiceNumber: '',
  });

  const products = useMemo(() => {
    return ((inventoryProducts ?? []) as InventoryProductLike[]).filter(
      (p) =>
        p.active !== false &&
        p.discontinued !== true &&
        p.is_discontinued !== true,
    );
  }, [inventoryProducts]);

  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const itemsByDocument = useMemo(() => {
    const map = new Map<string, PurchaseDocumentItemRow[]>();

    documentItems.forEach((item) => {
      const current = map.get(item.purchase_document_id) ?? [];
      current.push(item);
      map.set(item.purchase_document_id, current);
    });

    return map;
  }, [documentItems]);

  const productName = useCallback(
    (id: string | null) => {
      if (!id) return '—';
      return productMap.get(id)?.name ?? '—';
    },
    [productMap],
  );

  const supplierName = useCallback(
    (id: string | null) => {
      if (!id) return '—';
      return suppliers.find((s) => s.id === id)?.name ?? '—';
    },
    [suppliers],
  );

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const issueDate = doc.issue_date ? new Date(`${doc.issue_date}T00:00:00`) : null;

      if (filters.dateFrom) {
        const from = new Date(`${filters.dateFrom}T00:00:00`);
        if (!issueDate || issueDate < from) return false;
      }

      if (filters.dateTo) {
        const to = new Date(`${filters.dateTo}T23:59:59`);
        if (!issueDate || issueDate > to) return false;
      }

      if (filters.status.trim()) {
        if ((doc.status || '') !== filters.status) return false;
      }

      if (filters.supplierId.trim()) {
        if ((doc.supplier_id || '') !== filters.supplierId) return false;
      }

      if (filters.productId.trim()) {
        const docItems = itemsByDocument.get(doc.id) ?? [];
        const hasProduct = docItems.some((item) => item.product_id === filters.productId);
        if (!hasProduct) return false;
      }

      if (filters.invoiceNumber.trim()) {
        const invoice = (doc.invoice_number || '').toLowerCase();
        if (!invoice.includes(filters.invoiceNumber.trim().toLowerCase())) return false;
      }

      return true;
    });
  }, [documents, filters, itemsByDocument]);

  const exportFilteredDocumentsCsv = useCallback(() => {
    if (!filteredDocuments.length) return;

    const rows = filteredDocuments.map((doc) => {
      const docItems = itemsByDocument.get(doc.id) ?? [];
      const productSummary = docItems
        .map((item) => `${productName(item.product_id)} x ${formatCsvNumberBR(item.quantity ?? 0, 0)}`)
        .join(' | ');

      return {
        'Nº interno': shortId(doc.id),
        'Documento/Nota': doc.invoice_number?.trim() || shortId(doc.id),
        'Emissão': formatDatePtBr(doc.issue_date),
        'Status': getPurchaseDocumentStatusLabel(doc.status),
        'Fornecedor': supplierName(doc.supplier_id),
        'Produto filtrado': filters.productId ? productName(filters.productId) : '',
        'Itens': productSummary,
        'Total (R$)': formatCsvNumberBR(doc.total_amount ?? 0),
        'Criado em': formatDateTimeForExportPtBr(doc.created_at),
        'Cancelado em': formatDateTimeForExportPtBr(doc.cancelled_at),
        'Motivo do cancelamento': doc.cancel_reason ?? '',
        'Observações': doc.notes ?? '',
      };
    });

    const csv = buildCsv(rows, [
      'Nº interno',
      'Documento/Nota',
      'Emissão',
      'Status',
      'Fornecedor',
      'Produto filtrado',
      'Itens',
      'Total (R$)',
      'Criado em',
      'Cancelado em',
      'Motivo do cancelamento',
      'Observações',
    ]);

    const dateSuffix = getLocalDateInputValue();
    downloadCsv(`compras_e_entradas_${dateSuffix}.csv`, csv);
  }, [filteredDocuments, itemsByDocument, filters.productId, productName, supplierName]);

  const stats = useMemo(() => {
    const drafts = filteredDocuments.filter((d) => d.status === 'draft').length;
    const confirmed = filteredDocuments.filter((d) => d.status === 'confirmed').length;
    const totalConfirmed = filteredDocuments
      .filter((d) => d.status === 'confirmed')
      .reduce((sum, d) => sum + (d.total_amount ?? 0), 0);

    return { drafts, confirmed, totalConfirmed };
  }, [filteredDocuments]);

  const resetFilters = useCallback(() => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      status: '',
      supplierId: '',
      productId: '',
      invoiceNumber: '',
    });

    const next = new URLSearchParams(searchParams);
    next.delete('supplier_id');
    next.delete('product_id');
    next.delete('open');
    setSearchParams(next, { replace: true });
    setAutoOpenedDocId(null);
  }, [searchParams, setSearchParams]);

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
    setEditingStatus(null);
    setDraftSupplierId('');
    setDraftIssueDate(getLocalDateInputValue());
    setDraftInvoiceNumber('');
    setDraftNotes('');
    setDraftItems([{ product_id: '', quantity: 1, unit_cost: null }]);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const activeStoreId = getActiveStoreId();
      if (!activeStoreId) throw new Error('Loja não encontrada');

      setStoreId(activeStoreId);

      const [
        { data: sData, error: sErr },
        { data: dData, error: dErr },
        { data: iData, error: iErr },
      ] = await Promise.all([
        supabase
          .from('suppliers')
          .select('id, name, active, blocked, homologation_status')
          .eq('store_id', activeStoreId)
          .eq('active', true)
          .eq('blocked', false)
          .eq('homologation_status', 'approved')
          .order('name', { ascending: true }),
        supabase
          .from('purchase_documents')
          .select('*')
          .eq('store_id', activeStoreId)
          .order('created_at', { ascending: false }),
        supabase
          .from('purchase_document_items')
          .select('id, purchase_document_id, product_id, quantity, unit_cost, total_cost')
          .eq('store_id', activeStoreId),
      ]);

      if (sErr) throw sErr;
      if (dErr) throw dErr;
      if (iErr) throw iErr;

      setSuppliers((sData ?? []) as Supplier[]);
      setDocuments((dData ?? []) as PurchaseDocument[]);
      setDocumentItems((iData ?? []) as PurchaseDocumentItemRow[]);
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

  const openCancelModal = useCallback((doc: PurchaseDocument) => {
    setCancelTarget(doc);
    setCancelReason('');
    setCancelOpen(true);
  }, []);

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
        setEditingStatus(doc.status);
        setEditingReadOnly(doc.status === 'confirmed' || doc.status === 'cancelled' || readOnly);
        setDraftSupplierId(doc.supplier_id ?? '');
        setDraftIssueDate(
          doc.issue_date ?? getLocalDateInputValue(),
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
        const message = getErrorMessage(e, 'Erro ao abrir documento');
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || loading) return;
    if (autoOpenedDocId === openId) return;

    const target = documents.find((doc) => doc.id === openId);
    if (!target) return;

    setAutoOpenedDocId(openId);
    void openDocument(target, true);
  }, [autoOpenedDocId, documents, loading, openDocument, searchParams]);

  useEffect(() => {
    const supplierIdFromUrl = searchParams.get('supplier_id') || '';
    const productIdFromUrl = searchParams.get('product_id') || '';

    setFilters((prev) =>
      prev.supplierId === supplierIdFromUrl && prev.productId === productIdFromUrl
        ? prev
        : { ...prev, supplierId: supplierIdFromUrl, productId: productIdFromUrl },
    );
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const currentSupplierId = next.get('supplier_id') || '';
    const currentProductId = next.get('product_id') || '';

    let changed = false;

    if (filters.supplierId !== currentSupplierId) {
      if (filters.supplierId) next.set('supplier_id', filters.supplierId);
      else next.delete('supplier_id');
      changed = true;
    }

    if (filters.productId !== currentProductId) {
      if (filters.productId) next.set('product_id', filters.productId);
      else next.delete('product_id');
      changed = true;
    }

    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [filters.supplierId, filters.productId, searchParams, setSearchParams]);

  const createOrUpdateDraft = useCallback(async () => {
    if (!canCreatePurchase) {
      toast.error('Você não tem permissão para editar compras.');
      return;
    }

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
        const { data: updated, error: updateErr } = await supabase
          .from('purchase_documents')
          .update(payload)
          .eq('id', docId)
          .eq('store_id', storeId)
          .select('id')
          .maybeSingle();

        if (updateErr) throw updateErr;
        if (!updated) throw new Error('Alteração não aplicada. Verifique suas permissões.');
        const { error: delErr } = await supabase
          .from('purchase_document_items')
          .delete()
          .eq('purchase_document_id', docId);

        if (delErr) throw delErr;
      } else {
        const result = await stockService.createPurchaseDocumentDraftBatch({
          supplierId: draftSupplierId,
          notes: draftNotes.trim() || null,
          items: draftItems
            .filter((i) => i.product_id && i.quantity > 0)
            .map((i) => ({
              productId: i.product_id,
              quantity: i.quantity,
              unitCost: i.unit_cost ?? 0,
            })),
        });

        docId = result.purchase_document_id;
      }

      if (editingDocId) {
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
      }

      toast.success(editingDocId ? 'Documento atualizado' : 'Documento criado');

      setDraftOpen(false);
      resetDraft();
      await fetchAll();
      await refetchPurchaseDocumentTimeline();
    } catch (e: unknown) {
      console.error('Error saving purchase document:', e);
      const message = getErrorMessage(e, 'Erro ao salvar documento');
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
    refetchPurchaseDocumentTimeline,
    canCreatePurchase,
  ]);

  const confirmDocument = useCallback(
    async (docId: string) => {
      if (!canConfirmPurchase) {
        toast.error('Você não tem permissão para confirmar compras.');
        return;
      }

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
        await refetchPurchaseDocumentTimeline();
      } catch (e: unknown) {
        console.error('Error confirming purchase document:', e);
        const message = getErrorMessage(e, 'Erro ao confirmar documento');
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [fetchAll, resetDraft, refetchPurchaseDocumentTimeline],
  );

  const cancelConfirmedDocument = useCallback(async () => {
    if (!cancelTarget) return;

    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      toast.error('Informe um motivo com pelo menos 3 caracteres');
      return;
    }

    const confirmed = window.confirm(
      'Cancelar esta entrada irá gerar movimentação inversa, ajustar o estoque e manter trilha de auditoria.\n\nDeseja continuar?',
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc('cancel_purchase_document', {
        p_document_id: cancelTarget.id,
        p_reason: cancelReason.trim(),
      });

      if (error) throw error;

      toast.success('Entrada cancelada com sucesso');
      setCancelOpen(false);
      setCancelTarget(null);
      setCancelReason('');
      setDraftOpen(false);
      resetDraft();
      await fetchAll();
      await refetchPurchaseDocumentTimeline();
    } catch (e: unknown) {
      console.error('Error cancelling purchase document:', e);
      const message = getErrorMessage(e, 'Erro ao cancelar documento');
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [cancelReason, cancelTarget, fetchAll, resetDraft, refetchPurchaseDocumentTimeline]);

  const deleteDraft = useCallback(
    async (docId: string) => {
      const confirmed = window.confirm(
        'Excluir este rascunho é uma operação irreversível.\n\nSe ele tiver sido criado a partir de uma cotação, o vínculo será desfeito e a cotação voltará ao status anterior.\n\nDeseja continuar?',
      );

      if (!confirmed) return;

      setSaving(true);
      try {
        const { error } = await supabase.rpc('delete_purchase_document_draft', {
          p_document_id: docId,
        });

        if (error) throw error;

        toast.success('Rascunho removido');

        if (editingDocId === docId) {
          setDraftOpen(false);
          resetDraft();
        }

        await fetchAll();
        await refetchPurchaseDocumentTimeline();
      } catch (e: unknown) {
        console.error('Error deleting document:', e);
        const message = getErrorMessage(e, 'Erro ao remover documento');
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [editingDocId, fetchAll, resetDraft, refetchPurchaseDocumentTimeline],
  );

  return (
    <>
      {portalContainer && createPortal(
        <button
          type="button"
          onClick={() => navigate('/admin/stock/purchase-insights')}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm cursor-pointer shrink-0"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Dashboard de compras</span>
        </button>,
        portalContainer
      )}

      <PageContainer
        title="Compras e Entradas"
        subtitle="Crie rascunhos de compra por sugestão, revise documentos e confirme entradas no estoque"
        category="Produtos"
        icon={<History size={28} className="text-[#21A896]" />}
        onRefresh={fetchAll}
        flat
      >
      {pageError ? (
        <AlertBanner type="error" title="Atenção" message={pageError} />
      ) : null}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-6">
          <PurchaseSuggestionsPanel
            storeId={storeId}
            onDraftCreated={async (purchaseDocumentId) => {
              await fetchAll();

              const next = new URLSearchParams(searchParams);
              next.set('open', purchaseDocumentId);
              next.delete('supplier_id');
              next.delete('product_id');

              setSearchParams(next, { replace: false });
              setAutoOpenedDocId(null);
            }}
          />

          {storeId && <PurchaseQuotationsPanel storeId={storeId} />}

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

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Crie um documento para lançar vários itens de uma única nota/romaneio.
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canCreatePurchase && (
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
                    onClick={openNewDraft}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Novo documento
                  </button>
                )}

                <button
                  type="button"
                  onClick={exportFilteredDocumentsCsv}
                  disabled={!filteredDocuments.length}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </button>

                {searchParams.get('supplier_id') || searchParams.get('product_id') ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.delete('supplier_id');
                      next.delete('product_id');
                      next.delete('open');
                      setSearchParams(next, { replace: true });
                      setAutoOpenedDocId(null);
                      setFilters((prev) => ({ ...prev, supplierId: '', productId: '' }));
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <XCircle className="h-4 w-4" />
                    Limpar filtros de contexto
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    Filtros
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Combine data, status, fornecedor, produto e documento.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <XCircle className="h-4 w-4" />
                  Limpar filtros
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                    Data final
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  >
                    <option value="">Todos</option>
                    <option value="draft">Rascunho</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                    Fornecedor
                  </label>
                  <select
                    value={filters.supplierId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, supplierId: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  >
                    <option value="">Todos</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                    Produto
                  </label>
                  <select
                    value={filters.productId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, productId: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  >
                    <option value="">Todos</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                    Documento / Nota
                  </label>
                  <input
                    type="text"
                    value={filters.invoiceNumber}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, invoiceNumber: e.target.value }))
                    }
                    placeholder="Ex: 12345"
                    className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>
              </div>
            </div>
          </div>

          {searchParams.get('supplier_id') ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
              Exibindo entradas do fornecedor <b>{supplierName(searchParams.get('supplier_id'))}</b>.
            </div>
          ) : null}

          {searchParams.get('product_id') ? (
            <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-200">
              Exibindo entradas do produto <b>{productName(searchParams.get('product_id'))}</b>.
            </div>
          ) : null}

          {draftOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900">
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
                      {eligibleSuppliers.map((s) => (
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

                {editingDocId ? (
                  <OperationalTimeline
                    compact
                    className="mt-4"
                    title="Andamento da compra"
                    description="Histórico operacional desta compra, incluindo criação, confirmação, aplicação ao estoque, cancelamento e exclusão de rascunho."
                    emptyTitle="Nenhum andamento registrado"
                    emptyDescription="Os eventos desta compra aparecerão aqui conforme o fluxo for executado."
                    events={purchaseDocumentTimelineEvents}
                    loading={loadingPurchaseDocumentTimeline}
                    onRefresh={() => void refetchPurchaseDocumentTimeline()}
                  />
                ) : null}

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
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                              const selectedProductId = e.target.value;
                              const selectedProduct = productMap.get(selectedProductId);

                              updateDraftItem(idx, {
                                product_id: selectedProductId,
                                unit_cost:
                                  selectedProduct?.last_entry_unit_cost != null
                                    ? Number(selectedProduct.last_entry_unit_cost)
                                    : draftItems[idx]?.unit_cost ?? null,
                              });
                            }}
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

                    {editingDocId && !editingReadOnly && canConfirmPurchase ? (
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

                    {editingDocId && editingStatus === 'confirmed' && canCancelPurchase ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
                        onClick={() => openCancelModal({
                          id: editingDocId,
                          store_id: storeId ?? '',
                          supplier_id: draftSupplierId || null,
                          status: 'confirmed',
                          issue_date: draftIssueDate || null,
                          invoice_number: draftInvoiceNumber || null,
                          notes: draftNotes || null,
                          created_at: '',
                          total_amount: currentDraftTotal,
                          cancelled_at: null,
                          cancel_reason: null,
                        })}
                        disabled={saving}
                        type="button"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancelar entrada
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {cancelOpen && cancelTarget ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Cancelar entrada confirmada
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Documento {cancelTarget.invoice_number || cancelTarget.id}. Esta operação irá gerar movimentação inversa e manter trilha de auditoria.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    onClick={() => setCancelOpen(false)}
                  >
                    Fechar
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-sm text-gray-700 dark:text-gray-200">
                      Motivo do cancelamento
                    </label>
                    <textarea
                      value={cancelReason}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCancelReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      placeholder="Descreva o motivo do cancelamento"
                    />
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    Esta operação não apaga o documento. Ela cria a movimentação inversa, ajusta o estoque e marca a entrada como cancelada.
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                    onClick={() => setCancelOpen(false)}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
                    onClick={() => void cancelConfirmedDocument()}
                    disabled={saving}
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Confirmar cancelamento
                  </button>
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
              {filteredDocuments.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300">
                  {documents.length === 0
                    ? 'Nenhum documento cadastrado ainda.'
                    : 'Nenhum documento encontrado com os filtros atuais.'}
                </div>
              ) : (
                filteredDocuments.map((doc) => (
                  <div key={doc.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                    <div className="col-span-4 min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {supplierName(doc.supplier_id)}
                      </div>
                    </div>

                    <div className="col-span-2 text-sm text-gray-700 dark:text-gray-300">
                      <div>{doc.invoice_number || '—'}</div>
                      {filters.productId ? (
                        <div className="mt-0.5 text-xs text-purple-600 dark:text-purple-300">
                          Produto filtrado: {productName(filters.productId)}
                        </div>
                      ) : null}
                    </div>

                    <div className="col-span-2 text-sm text-gray-700 dark:text-gray-300">
                      {formatDatePtBr(doc.issue_date) || '—'}
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${doc.status === 'confirmed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : doc.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                          }`}
                      >
                        {doc.status === 'confirmed' ? 'Confirmado' : doc.status === 'cancelled' ? 'Cancelado' : 'Rascunho'}
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
                          {canCreatePurchase && (
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                              onClick={() => void openDocument(doc, false)}
                              title="Editar"
                              type="button"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}

                          {canConfirmPurchase && (
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-green-600 text-white hover:opacity-90 disabled:opacity-60"
                              onClick={() => void confirmDocument(doc.id)}
                              disabled={saving}
                              title="Confirmar"
                              type="button"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}

                          {canCancelPurchase && (
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white hover:opacity-90 disabled:opacity-60"
                              onClick={() => void deleteDraft(doc.id)}
                              disabled={saving}
                              title="Excluir rascunho"
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      ) : doc.status === 'confirmed' ? (
                        canCancelPurchase ? (
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white hover:opacity-90 disabled:opacity-60"
                            onClick={() => openCancelModal(doc)}
                            disabled={saving}
                            title="Cancelar entrada"
                            type="button"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        ) : null
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
    </>
  );
}
