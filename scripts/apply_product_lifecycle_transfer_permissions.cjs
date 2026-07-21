#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const lifecyclePath = path.join(root, 'src/pages/private/admin/products/inventory/ProductLifecyclePage.tsx');
const cardsPath = path.join(root, 'src/pages/private/admin/products/inventory/components/ProductStockManagementCards.tsx');

function fail(message) {
  console.error(`\n[product-lifecycle-transfer-permissions] ${message}\n`);
  process.exit(1);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Arquivo não encontrado: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) fail(`Trecho não encontrado: ${label}`);
  return source.replace(search, replacement);
}

let lifecycle = read(lifecyclePath);
let cards = read(cardsPath);

lifecycle = replaceRequired(
  lifecycle,
  `import { formatDateTimePtBr } from '@/utils/dateTime';`,
  `import { formatDateTimePtBr } from '@/utils/dateTime';\nimport { useCurrentStore } from '@/hooks/store/useCurrentStore';\nimport { usePermissions } from '@/hooks/usePermissions';`,
  'imports de permissões na Vida do Produto',
);

lifecycle = replaceRequired(
  lifecycle,
  `export default function ProductLifecyclePage() {\n  const { id } = useParams();\n  const [product, setProduct] = useState<any>(null);`,
  `export default function ProductLifecyclePage() {\n  const { id } = useParams();\n  const [product, setProduct] = useState<any>(null);\n  const { storeId } = useCurrentStore();\n  const { hasPermission } = usePermissions(storeId ?? null);\n  const canCreateTransfers = hasPermission('transfers.create');`,
  'leitura de transfers.create',
);

lifecycle = replaceRequired(
  lifecycle,
  `      <ProductStockManagementCards\n        globalSummary={globalSummary}\n        locationRows={managementRows}\n        loading={loadingManagement}\n        error={managementError}\n      />`,
  `      <ProductStockManagementCards\n        globalSummary={globalSummary}\n        locationRows={managementRows}\n        loading={loadingManagement}\n        error={managementError}\n        canCreateTransfers={canCreateTransfers}\n      />`,
  'prop canCreateTransfers',
);

cards = replaceRequired(
  cards,
  `  error?: string | null;\n};`,
  `  error?: string | null;\n  canCreateTransfers?: boolean;\n};`,
  'tipo da prop canCreateTransfers',
);

cards = replaceRequired(
  cards,
  `  loading,\n  error,\n}: ProductStockManagementCardsProps) {`,
  `  loading,\n  error,\n  canCreateTransfers = false,\n}: ProductStockManagementCardsProps) {`,
  'desestruturação canCreateTransfers',
);

cards = replaceRequired(
  cards,
  `  const handleCreateTransfer = (\n    row: ProductStockManagementRow,\n    source: ProductLifecycleSourceLocation\n  ) => {`,
  `  const handleCreateTransfer = (\n    row: ProductStockManagementRow,\n    source: ProductLifecycleSourceLocation\n  ) => {\n    if (!canCreateTransfers) {\n      toast.error('Você não tem permissão para criar transferências.');\n      return;\n    }`,
  'guard handleCreateTransfer',
);

cards = replaceRequired(
  cards,
  `  const openManualTransferDraft = (row: ProductStockManagementRow) => {`,
  `  const openManualTransferDraft = (row: ProductStockManagementRow) => {\n    if (!canCreateTransfers) {\n      toast.error('Você não tem permissão para criar transferências.');\n      return;\n    }`,
  'guard openManualTransferDraft',
);

cards = replaceRequired(
  cards,
  `  const handleCreateManualTransferDraft = async () => {\n    if (!globalSummary || !manualTransferDraft) return;`,
  `  const handleCreateManualTransferDraft = async () => {\n    if (!canCreateTransfers) {\n      toast.error('Você não tem permissão para criar transferências.');\n      return;\n    }\n\n    if (!globalSummary || !manualTransferDraft) return;`,
  'guard handleCreateManualTransferDraft',
);

cards = replaceRequired(
  cards,
  `                {activeLocationRows.length > 1 && (`,
  `                {canCreateTransfers && activeLocationRows.length > 1 && (`,
  'ocultar transferência manual',
);

cards = replaceRequired(
  cards,
  `              {action === 'transfer' && bestSource && (`,
  `              {canCreateTransfers && action === 'transfer' && bestSource && (`,
  'ocultar criar transferência sugerida',
);

cards = replaceRequired(
  cards,
  `      {manualTransferDraft && globalSummary && (`,
  `      {canCreateTransfers && manualTransferDraft && globalSummary && (`,
  'ocultar modal de transferência manual',
);

fs.writeFileSync(lifecyclePath, lifecycle, 'utf8');
fs.writeFileSync(cardsPath, cards, 'utf8');

console.log('[product-lifecycle-transfer-permissions] Permissões aplicadas com sucesso.');
