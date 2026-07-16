#!/usr/bin/env node
/*
 * Aplica ajustes conservadores de UX/guards em Compras e Entradas.
 *
 * Uso:
 *   node scripts/apply_purchases_readonly_ux.cjs
 *
 * Escopo:
 * - Mantém visualização e exportação liberadas via rota purchases.view.
 * - Garante guards internos para criar, confirmar, cancelar e excluir rascunhos.
 * - Propaga canCreatePurchase para PurchaseSuggestionsPanel para impedir rascunho por sugestão sem purchases.create.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const purchasesPath = path.join(root, 'src/pages/private/admin/products/inventory/PurchaseDocumentsPage.tsx');
const suggestionsPath = path.join(root, 'src/pages/private/admin/products/inventory/components/PurchaseSuggestionsPanel.tsx');

function fail(message) {
  console.error(`\n[purchases-readonly-ux] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[purchases-readonly-ux] Aviso: ${message}`);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Arquivo não encontrado: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function write(filePath, source, changed) {
  if (changed) fs.writeFileSync(filePath, source, 'utf8');
}

function replaceOnce(source, search, replacement, label, alreadyNeedle = replacement) {
  if (source.includes(alreadyNeedle)) return { source, changed: false };
  if (!source.includes(search)) {
    warn(`trecho não encontrado para: ${label}; pode já estar aplicado ou variar nesta versão.`);
    return { source, changed: false };
  }
  return { source: source.replace(search, replacement), changed: true };
}

let purchases = read(purchasesPath);
let suggestions = read(suggestionsPath);
let purchasesChanged = false;
let suggestionsChanged = false;

// 1) PurchaseDocumentsPage: guard em openNewDraft.
{
  const search = `  const openNewDraft = useCallback(() => {
    resetDraft();
    setDraftOpen(true);
  }, [resetDraft]);`;
  const replacement = `  const openNewDraft = useCallback(() => {
    if (!canCreatePurchase) {
      toast.error('Você não tem permissão para criar compras.');
      return;
    }

    resetDraft();
    setDraftOpen(true);
  }, [canCreatePurchase, resetDraft]);`;
  const result = replaceOnce(purchases, search, replacement, 'guard openNewDraft', `Você não tem permissão para criar compras.`);
  purchases = result.source;
  purchasesChanged = purchasesChanged || result.changed;
}

// 2) PurchaseDocumentsPage: guard em cancelConfirmedDocument.
{
  const search = `  const cancelConfirmedDocument = useCallback(async () => {
    if (!cancelTarget) return;

    if (!cancelReason.trim() || cancelReason.trim().length < 3) {`;
  const replacement = `  const cancelConfirmedDocument = useCallback(async () => {
    if (!cancelTarget) return;

    if (!canCancelPurchase) {
      toast.error('Você não tem permissão para cancelar compras.');
      return;
    }

    if (!cancelReason.trim() || cancelReason.trim().length < 3) {`;
  const result = replaceOnce(purchases, search, replacement, 'guard cancelConfirmedDocument', `Você não tem permissão para cancelar compras.`);
  purchases = result.source;
  purchasesChanged = purchasesChanged || result.changed;
}

// 3) PurchaseDocumentsPage: atualizar deps de cancelConfirmedDocument.
{
  const search = `  }, [cancelReason, cancelTarget, fetchAll, resetDraft, refetchPurchaseDocumentTimeline]);`;
  const replacement = `  }, [canCancelPurchase, cancelReason, cancelTarget, fetchAll, resetDraft, refetchPurchaseDocumentTimeline]);`;
  const result = replaceOnce(purchases, search, replacement, 'deps cancelConfirmedDocument', `[canCancelPurchase, cancelReason, cancelTarget`);
  purchases = result.source;
  purchasesChanged = purchasesChanged || result.changed;
}

// 4) PurchaseDocumentsPage: guard em deleteDraft.
{
  const search = `  const deleteDraft = useCallback(
    async (docId: string) => {
      const confirmed = window.confirm(`;
  const replacement = `  const deleteDraft = useCallback(
    async (docId: string) => {
      if (!canCancelPurchase) {
        toast.error('Você não tem permissão para excluir rascunhos de compra.');
        return;
      }

      const confirmed = window.confirm(`;
  const result = replaceOnce(purchases, search, replacement, 'guard deleteDraft', `Você não tem permissão para excluir rascunhos de compra.`);
  purchases = result.source;
  purchasesChanged = purchasesChanged || result.changed;
}

// 5) PurchaseDocumentsPage: atualizar deps de deleteDraft.
{
  const search = `    [editingDocId, fetchAll, resetDraft, refetchPurchaseDocumentTimeline],`;
  const replacement = `    [canCancelPurchase, editingDocId, fetchAll, resetDraft, refetchPurchaseDocumentTimeline],`;
  const result = replaceOnce(purchases, search, replacement, 'deps deleteDraft', `[canCancelPurchase, editingDocId`);
  purchases = result.source;
  purchasesChanged = purchasesChanged || result.changed;
}

// 6) PurchaseDocumentsPage: passar canCreatePurchase para sugestões.
{
  const search = `          <PurchaseSuggestionsPanel
            storeId={storeId}
            onDraftCreated={async (purchaseDocumentId) => {`;
  const replacement = `          <PurchaseSuggestionsPanel
            storeId={storeId}
            canCreatePurchase={canCreatePurchase}
            onDraftCreated={async (purchaseDocumentId) => {`;
  const result = replaceOnce(purchases, search, replacement, 'prop canCreatePurchase para PurchaseSuggestionsPanel', `canCreatePurchase={canCreatePurchase}`);
  purchases = result.source;
  purchasesChanged = purchasesChanged || result.changed;
}

// 7) PurchaseSuggestionsPanel: prop type.
{
  const search = `type PurchaseSuggestionsPanelProps = {
    storeId: string | null;
    onDraftCreated?: (purchaseDocumentId: string) => Promise<void> | void;
};`;
  const replacement = `type PurchaseSuggestionsPanelProps = {
    storeId: string | null;
    canCreatePurchase?: boolean;
    onDraftCreated?: (purchaseDocumentId: string) => Promise<void> | void;
};`;
  const result = replaceOnce(suggestions, search, replacement, 'prop type canCreatePurchase', `canCreatePurchase?: boolean;`);
  suggestions = result.source;
  suggestionsChanged = suggestionsChanged || result.changed;
}

// 8) PurchaseSuggestionsPanel: destructuring default.
{
  const search = `export function PurchaseSuggestionsPanel({
    storeId,
    onDraftCreated,
}: PurchaseSuggestionsPanelProps) {`;
  const replacement = `export function PurchaseSuggestionsPanel({
    storeId,
    canCreatePurchase = true,
    onDraftCreated,
}: PurchaseSuggestionsPanelProps) {`;
  const result = replaceOnce(suggestions, search, replacement, 'destructuring canCreatePurchase', `canCreatePurchase = true`);
  suggestions = result.source;
  suggestionsChanged = suggestionsChanged || result.changed;
}

// 9) PurchaseSuggestionsPanel: guard de criar rascunho.
{
  const search = `    const handleCreateDraftForGroup = async (group: {
        supplierId: string;
        supplierName: string;
        rows: PurchaseSuggestionRow[];
        canCreateDraft: boolean;
    }) => {
        if (!group.canCreateDraft || group.supplierId === 'without_supplier') {`;
  const replacement = `    const handleCreateDraftForGroup = async (group: {
        supplierId: string;
        supplierName: string;
        rows: PurchaseSuggestionRow[];
        canCreateDraft: boolean;
    }) => {
        if (!canCreatePurchase) {
            toast.error('Você não tem permissão para criar rascunhos de compra.');
            return;
        }

        if (!group.canCreateDraft || group.supplierId === 'without_supplier') {`;
  const result = replaceOnce(suggestions, search, replacement, 'guard criar rascunho por sugestão', `Você não tem permissão para criar rascunhos de compra.`);
  suggestions = result.source;
  suggestionsChanged = suggestionsChanged || result.changed;
}

// 10) PurchaseSuggestionsPanel: desabilitar controles de seleção/quantidade/custo e botão rascunho quando não pode criar.
suggestions = suggestions.replace(/disabled=\{creatingGroup === group\.supplierId\}/g, `disabled={!canCreatePurchase || creatingGroup === group.supplierId}`);
suggestions = suggestions.replace(/disabled=\{creatingGroup !== null\}/g, `disabled={!canCreatePurchase || creatingGroup !== null}`);
suggestions = suggestions.replace(/disabled=\{!group\.canCreateDraft \|\| creatingGroup === group\.supplierId\}/g, `disabled={!canCreatePurchase || !group.canCreateDraft || creatingGroup === group.supplierId}`);
// Marcar changed se algum padrão esperado agora existe.
if (suggestions.includes('disabled={!canCreatePurchase ||')) suggestionsChanged = true;

write(purchasesPath, purchases, purchasesChanged);
write(suggestionsPath, suggestions, suggestionsChanged);

if (purchasesChanged || suggestionsChanged) {
  console.log('[purchases-readonly-ux] Compras e sugestões atualizadas com UX/guards de leitura.');
} else {
  console.log('[purchases-readonly-ux] Nenhuma alteração necessária; ajustes já parecem aplicados.');
}
