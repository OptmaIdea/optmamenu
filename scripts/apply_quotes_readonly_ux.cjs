#!/usr/bin/env node
/*
 * Aplica UX/guards de leitura para Cotações de compra.
 *
 * Uso:
 *   node scripts/apply_quotes_readonly_ux.cjs
 *
 * Escopo:
 * - PurchaseDocumentsPage passa quotes.view / quotes.manage para painéis filhos.
 * - PurchaseQuotationsPanel fica visível só quando renderizado por quotes.view e bloqueia edição/conversão sem quotes.manage.
 * - PurchaseSuggestionsPanel bloqueia geração/salvamento de cotações sem quotes.manage.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const purchaseDocumentsPath = path.join(root, 'src/pages/private/admin/products/inventory/PurchaseDocumentsPage.tsx');
const suggestionsPath = path.join(root, 'src/pages/private/admin/products/inventory/components/PurchaseSuggestionsPanel.tsx');
const quotationsPath = path.join(root, 'src/pages/private/admin/products/inventory/components/PurchaseQuotationsPanel.tsx');

function fail(message) {
  console.error(`\n[quotes-readonly-ux] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[quotes-readonly-ux] Aviso: ${message}`);
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

let purchases = read(purchaseDocumentsPath);
let suggestions = read(suggestionsPath);
let quotations = read(quotationsPath);
let purchasesChanged = false;
let suggestionsChanged = false;
let quotationsChanged = false;

// PurchaseDocumentsPage: novas permissões.
{
  const search = `  const canCreatePurchase = hasPermission('purchases.create');
  const canConfirmPurchase = hasPermission('purchases.confirm');
  const canCancelPurchase = hasPermission('purchases.cancel');`;
  const replacement = `  const canCreatePurchase = hasPermission('purchases.create');
  const canConfirmPurchase = hasPermission('purchases.confirm');
  const canCancelPurchase = hasPermission('purchases.cancel');
  const canViewQuotations = hasPermission('quotes.view');
  const canManageQuotations = hasPermission('quotes.manage');`;
  const result = replaceOnce(purchases, search, replacement, 'permissões quotes em PurchaseDocumentsPage', `const canViewQuotations = hasPermission('quotes.view');`);
  purchases = result.source;
  purchasesChanged = purchasesChanged || result.changed;
}

// PurchaseDocumentsPage: passar manage para sugestões.
{
  const search = `          <PurchaseSuggestionsPanel
            storeId={storeId}
            canCreatePurchase={canCreatePurchase}
            onDraftCreated={async (purchaseDocumentId) => {`;
  const replacement = `          <PurchaseSuggestionsPanel
            storeId={storeId}
            canCreatePurchase={canCreatePurchase}
            canManageQuotations={canManageQuotations}
            onDraftCreated={async (purchaseDocumentId) => {`;
  const result = replaceOnce(purchases, search, replacement, 'prop canManageQuotations em PurchaseSuggestionsPanel', `canManageQuotations={canManageQuotations}`);
  purchases = result.source;
  purchasesChanged = purchasesChanged || result.changed;
}

// PurchaseDocumentsPage: renderizar cotações apenas com quotes.view e passar manage.
{
  const search = `          {storeId && <PurchaseQuotationsPanel storeId={storeId} />}`;
  const replacement = `          {storeId && canViewQuotations ? (
            <PurchaseQuotationsPanel
              storeId={storeId}
              canManageQuotations={canManageQuotations}
            />
          ) : null}`;
  const result = replaceOnce(purchases, search, replacement, 'render condicional PurchaseQuotationsPanel', `canViewQuotations ? (`);
  purchases = result.source;
  purchasesChanged = purchasesChanged || result.changed;
}

// PurchaseSuggestionsPanel: prop type.
{
  const search = `type PurchaseSuggestionsPanelProps = {
    storeId: string | null;
    canCreatePurchase?: boolean;
    onDraftCreated?: (purchaseDocumentId: string) => Promise<void> | void;
};`;
  const replacement = `type PurchaseSuggestionsPanelProps = {
    storeId: string | null;
    canCreatePurchase?: boolean;
    canManageQuotations?: boolean;
    onDraftCreated?: (purchaseDocumentId: string) => Promise<void> | void;
};`;
  const result = replaceOnce(suggestions, search, replacement, 'prop type canManageQuotations em sugestões', `canManageQuotations?: boolean;`);
  suggestions = result.source;
  suggestionsChanged = suggestionsChanged || result.changed;
}

// PurchaseSuggestionsPanel: destructuring default.
{
  const search = `export function PurchaseSuggestionsPanel({
    storeId,
    canCreatePurchase = true,
    onDraftCreated,
}: PurchaseSuggestionsPanelProps) {`;
  const replacement = `export function PurchaseSuggestionsPanel({
    storeId,
    canCreatePurchase = true,
    canManageQuotations = true,
    onDraftCreated,
}: PurchaseSuggestionsPanelProps) {`;
  const result = replaceOnce(suggestions, search, replacement, 'destructuring canManageQuotations em sugestões', `canManageQuotations = true`);
  suggestions = result.source;
  suggestionsChanged = suggestionsChanged || result.changed;
}

// PurchaseSuggestionsPanel: guard abrir cotação.
{
  const search = `    function handleOpenQuotationForGroup(group: {
        supplierId: string;
        supplierName: string;
        rows: PurchaseSuggestionRow[];
        canCreateDraft: boolean;
    }) {
        if (!group.canCreateDraft || group.supplierId === 'without_supplier') {`;
  const replacement = `    function handleOpenQuotationForGroup(group: {
        supplierId: string;
        supplierName: string;
        rows: PurchaseSuggestionRow[];
        canCreateDraft: boolean;
    }) {
        if (!canManageQuotations) {
            toast.error('Você não tem permissão para gerar cotações.');
            return;
        }

        if (!group.canCreateDraft || group.supplierId === 'without_supplier') {`;
  const result = replaceOnce(suggestions, search, replacement, 'guard abrir cotação por sugestão', `Você não tem permissão para gerar cotações.`);
  suggestions = result.source;
  suggestionsChanged = suggestionsChanged || result.changed;
}

// PurchaseSuggestionsPanel: guard salvar cotação.
{
  const search = `    async function handleSaveQuotation(payload: {
        messageSubject: string;
        messageBody: string;
        sentChannel: 'whatsapp' | 'email' | 'pdf' | 'manual' | 'other' | null;
    }) {
        if (!quotationPreview) return;

        try {`;
  const replacement = `    async function handleSaveQuotation(payload: {
        messageSubject: string;
        messageBody: string;
        sentChannel: 'whatsapp' | 'email' | 'pdf' | 'manual' | 'other' | null;
    }) {
        if (!quotationPreview) return;

        if (!canManageQuotations) {
            toast.error('Você não tem permissão para salvar cotações.');
            return;
        }

        try {`;
  const result = replaceOnce(suggestions, search, replacement, 'guard salvar cotação por sugestão', `Você não tem permissão para salvar cotações.`);
  suggestions = result.source;
  suggestionsChanged = suggestionsChanged || result.changed;
}

// PurchaseSuggestionsPanel: desabilitar botões que chamam handleOpenQuotationForGroup quando sem manage.
suggestions = suggestions.replace(/disabled=\{!group\.canCreateDraft \|\| creatingGroup === group\.supplierId\}/g, `disabled={!canManageQuotations || !group.canCreateDraft || creatingGroup === group.supplierId}`);
suggestions = suggestions.replace(/disabled=\{savingQuotation\}/g, `disabled={!canManageQuotations || savingQuotation}`);
if (suggestions.includes('!canManageQuotations ||')) suggestionsChanged = true;

// PurchaseQuotationsPanel: prop type.
{
  const search = `type PurchaseQuotationsPanelProps = {
  storeId: string;
};`;
  const replacement = `type PurchaseQuotationsPanelProps = {
  storeId: string;
  canManageQuotations?: boolean;
};`;
  const result = replaceOnce(quotations, search, replacement, 'prop type canManageQuotations em cotações', `canManageQuotations?: boolean;`);
  quotations = result.source;
  quotationsChanged = quotationsChanged || result.changed;
}

// PurchaseQuotationsPanel: destructuring default.
{
  const search = `export function PurchaseQuotationsPanel({ storeId }: PurchaseQuotationsPanelProps) {`;
  const replacement = `export function PurchaseQuotationsPanel({
  storeId,
  canManageQuotations = true,
}: PurchaseQuotationsPanelProps) {`;
  const result = replaceOnce(quotations, search, replacement, 'destructuring canManageQuotations em cotações', `canManageQuotations = true`);
  quotations = result.source;
  quotationsChanged = quotationsChanged || result.changed;
}

// PurchaseQuotationsPanel: guards internos.
{
  const search = `  async function handleSaveResponse() {
    if (!detailDraft) return;

    try {`;
  const replacement = `  async function handleSaveResponse() {
    if (!detailDraft) return;

    if (!canManageQuotations) {
      toast.error('Você não tem permissão para alterar cotações.');
      return;
    }

    try {`;
  const result = replaceOnce(quotations, search, replacement, 'guard salvar resposta cotação', `Você não tem permissão para alterar cotações.`);
  quotations = result.source;
  quotationsChanged = quotationsChanged || result.changed;
}

{
  const search = `  async function handleConvertToDraft() {
    if (!detailDraft) return;

    try {`;
  const replacement = `  async function handleConvertToDraft() {
    if (!detailDraft) return;

    if (!canManageQuotations) {
      toast.error('Você não tem permissão para converter cotações.');
      return;
    }

    try {`;
  const result = replaceOnce(quotations, search, replacement, 'guard converter cotação detalhe', `Você não tem permissão para converter cotações.`);
  quotations = result.source;
  quotationsChanged = quotationsChanged || result.changed;
}

{
  const search = `  async function handleConvertToDraftFromList(quotationId: string) {
    const confirmed = window.confirm(`;
  const replacement = `  async function handleConvertToDraftFromList(quotationId: string) {
    if (!canManageQuotations) {
      toast.error('Você não tem permissão para converter cotações.');
      return;
    }

    const confirmed = window.confirm(`;
  const result = replaceOnce(quotations, search, replacement, 'guard converter cotação lista', `async function handleConvertToDraftFromList(quotationId: string) {
    if (!canManageQuotations) {`);
  quotations = result.source;
  quotationsChanged = quotationsChanged || result.changed;
}

// PurchaseQuotationsPanel: UI de edição/conversão bloqueada sem manage.
quotations = quotations.replace(/disabled=\{detail\.status === 'converted'\}/g, `disabled={!canManageQuotations || detail.status === 'converted'}`);
quotations = quotations.replace(/\{quotation\.status === 'approved' && \(/g, `{canManageQuotations && quotation.status === 'approved' && (`);
quotations = quotations.replace(/\{detail\.status !== 'converted' && \(/g, `{canManageQuotations && detail.status !== 'converted' && (`);
if (quotations.includes('canManageQuotations && quotation.status') || quotations.includes('!canManageQuotations || detail.status')) {
  quotationsChanged = true;
}

write(purchaseDocumentsPath, purchases, purchasesChanged);
write(suggestionsPath, suggestions, suggestionsChanged);
write(quotationsPath, quotations, quotationsChanged);

if (purchasesChanged || suggestionsChanged || quotationsChanged) {
  console.log('[quotes-readonly-ux] Cotações ajustadas para modo leitura e permissões granulares.');
} else {
  console.log('[quotes-readonly-ux] Nenhuma alteração necessária; ajustes já parecem aplicados.');
}
