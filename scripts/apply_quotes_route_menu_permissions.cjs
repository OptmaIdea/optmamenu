#!/usr/bin/env node
/*
 * Ajusta permissões do menu/rota standalone de Cotações.
 *
 * Contexto:
 * - A árvore de permissões já possui quotes.view / quotes.manage.
 * - O menu lateral ainda usava purchases.view para /admin/stock/quotations.
 * - A página standalone precisa validar quotes.view e ocultar ações com quotes.manage.
 *
 * Uso:
 *   node scripts/apply_quotes_route_menu_permissions.cjs
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const layoutPath = path.join(root, 'src/components/layouts/PrivateLayout.tsx');
const quotationsPagePath = path.join(root, 'src/pages/private/admin/products/inventory/PurchaseQuotationsPage.tsx');

function fail(message) {
  console.error(`\n[quotes-route-menu-permissions] ${message}\n`);
  process.exit(1);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Arquivo não encontrado: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function write(filePath, source, changed) {
  if (changed) fs.writeFileSync(filePath, source, 'utf8');
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return { source, changed: false };
  if (!source.includes(search)) fail(`Trecho não encontrado para ${label}.`);
  return { source: source.replace(search, replacement), changed: true };
}

let layout = read(layoutPath);
let page = read(quotationsPagePath);
let layoutChanged = false;
let pageChanged = false;

// 1) Menu lateral: Cotações deve obedecer quotes.view, não purchases.view.
{
  const before = `{ path: '/admin/stock/quotations', icon: FileText, label: 'Cotação', permission: 'purchases.view' }`;
  const after = `{ path: '/admin/stock/quotations', icon: FileText, label: 'Cotação', permission: 'quotes.view' }`;
  const result = replaceRequired(layout, before, after, 'menu Cotação -> quotes.view');
  layout = result.source;
  layoutChanged = layoutChanged || result.changed;
}

// 2) Página standalone: importar usePermissions/hasEffectivePermission/AccessDenied.
{
  const before = `import { getActiveStoreId } from '@/utils/activeStore';`;
  const after = `import { getActiveStoreId } from '@/utils/activeStore';
import { usePermissions } from '@/hooks/usePermissions';
import { hasEffectivePermission } from '@/utils/permissions';`;
  if (!page.includes(`@/hooks/usePermissions`)) {
    const result = replaceRequired(page, before, after, 'imports de permissões');
    page = result.source;
    pageChanged = pageChanged || result.changed;
  }
}

// 3) Página standalone: criar componente local de acesso negado se não houver padrão.
{
  const marker = `function buildQuotationPrintHtml(`;
  const snippet = `function QuotationsAccessDenied() {
    return (
        <PageContainer
            title="Acesso Restrito"
            subtitle="Você não tem permissão para visualizar cotações de compra."
            category="Produtos"
            icon={<XCircle className="text-[#DC2626]" size={28} />}
            flat
        >
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 rounded-full bg-red-50 p-4 text-red-500 dark:bg-red-950/30">
                    <XCircle size={48} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-800 dark:text-white">
                    Acesso restrito
                </h3>
                <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
                    Seu perfil não possui a permissão quotes.view para acessar esta tela.
                </p>
            </div>
        </PageContainer>
    );
}

`;
  if (!page.includes('function QuotationsAccessDenied()')) {
    if (!page.includes(marker)) fail('Ponto para inserir QuotationsAccessDenied não encontrado.');
    page = page.replace(marker, snippet + marker);
    pageChanged = true;
  }
}

// 4) Página standalone: obter permissões e flags logo após storeId.
{
  const before = `    const [storeId, setStoreId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);`;
  const after = `    const [storeId, setStoreId] = useState<string | null>(null);
    const { permissions, loading: loadingPermissions } = usePermissions(storeId ?? null);
    const canViewQuotes = hasEffectivePermission(permissions, 'quotes.view');
    const canManageQuotes = hasEffectivePermission(permissions, 'quotes.manage');
    const [loading, setLoading] = useState(true);`;
  if (!page.includes(`const canViewQuotes = hasEffectivePermission(permissions, 'quotes.view');`)) {
    const result = replaceRequired(page, before, after, 'flags canViewQuotes/canManageQuotes');
    page = result.source;
    pageChanged = pageChanged || result.changed;
  }
}

// 5) Página standalone: bloquear carregamento quando não tem view.
{
  const before = `            if (activeStoreId) {
                await loadQuotations(activeStoreId);
            } else {
                setLoading(false);
            }`;
  const after = `            if (activeStoreId) {
                // O bloqueio visual acontece após o carregamento das permissões.
                await loadQuotations(activeStoreId);
            } else {
                setLoading(false);
            }`;
  if (!page.includes('O bloqueio visual acontece após o carregamento das permissões.')) {
    const result = replaceRequired(page, before, after, 'comentário carregamento permissões');
    page = result.source;
    pageChanged = pageChanged || result.changed;
  }
}

// 6) Página standalone: guard em abrir modal manual.
{
  const search = `setManualQuotationOpen(true)`;
  // troca onClick direto simples quando existir.
  const replacement = `canManageQuotes ? setManualQuotationOpen(true) : toast.error('Você não tem permissão para criar cotações.')`;
  if (page.includes(search) && !page.includes(`Você não tem permissão para criar cotações.`)) {
    page = page.replace(search, replacement);
    pageChanged = true;
  }
}

// 7) Página standalone: guards funcionais nas ações sensíveis.
const guards = [
  {
    name: 'handleSaveResponse',
    search: `    async function handleSaveResponse() {
        if (!detailDraft) return;`,
    replacement: `    async function handleSaveResponse() {
        if (!canManageQuotes) {
            toast.error('Você não tem permissão para gerenciar cotações.');
            return;
        }

        if (!detailDraft) return;`,
  },
  {
    name: 'handleConvertToDraft',
    search: `    async function handleConvertToDraft() {
        if (!detailDraft) return;`,
    replacement: `    async function handleConvertToDraft() {
        if (!canManageQuotes) {
            toast.error('Você não tem permissão para converter cotações.');
            return;
        }

        if (!detailDraft) return;`,
  },
  {
    name: 'handleConvertToDraftFromList',
    search: `    async function handleConvertToDraftFromList(quotationId: string) {
        const confirmed = window.confirm(`,
    replacement: `    async function handleConvertToDraftFromList(quotationId: string) {
        if (!canManageQuotes) {
            toast.error('Você não tem permissão para converter cotações.');
            return;
        }

        const confirmed = window.confirm(`,
  },
  {
    name: 'handleCreateManualQuotation',
    search: `    async function handleCreateManualQuotation() {`,
    replacement: `    async function handleCreateManualQuotation() {
        if (!canManageQuotes) {
            toast.error('Você não tem permissão para criar cotações.');
            return;
        }
`,
  },
];

for (const guard of guards) {
  if (!page.includes(guard.replacement.trim()) && page.includes(guard.search)) {
    page = page.replace(guard.search, guard.replacement);
    pageChanged = true;
  }
}

// 8) Página standalone: campos editáveis e botões sensíveis ficam desabilitados/ocultos sem manage.
page = page.replace(/disabled=\{detail\.status === 'converted'\}/g, `disabled={!canManageQuotes || detail.status === 'converted'}`);
page = page.replace(/\{quotation\.status === 'approved' && \(/g, `{canManageQuotes && quotation.status === 'approved' && (`);
page = page.replace(/\{detail\.status !== 'converted' && \(/g, `{canManageQuotes && detail.status !== 'converted' && (`);

// 9) Botões Nova cotação sensíveis: esconder quando não pode gerenciar.
page = page.replace(/(<button\n\s+type="button"\n\s+onClick=\{\(\) => canManageQuotes \? setManualQuotationOpen\(true\) : toast\.error\('Você não tem permissão para criar cotações\.'\)\}[\s\S]*?Nova cotação\n\s+<\/button>)/g, `{canManageQuotes && (
$1
                            )}`);

// 10) Return guard: depois dos hooks/useMemos e antes do return principal, usar acesso negado.
{
  const marker = `    if (loading) return <LoadingSpinner />;`;
  const replacement = `    if (loading || loadingPermissions) return <LoadingSpinner />;

    if (!canViewQuotes) {
        return <QuotationsAccessDenied />;
    }`;
  if (page.includes(marker) && !page.includes('return <QuotationsAccessDenied />;')) {
    page = page.replace(marker, replacement);
    pageChanged = true;
  }
}

write(layoutPath, layout, layoutChanged);
write(quotationsPagePath, page, pageChanged);

if (layoutChanged || pageChanged) {
  console.log('[quotes-route-menu-permissions] Menu/rota de cotações ajustados para quotes.view/quotes.manage.');
} else {
  console.log('[quotes-route-menu-permissions] Nenhuma alteração necessária; ajustes já parecem aplicados.');
}
