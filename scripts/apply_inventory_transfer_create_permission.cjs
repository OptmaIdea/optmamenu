#!/usr/bin/env node
/*
 * Ajusta a tela Estoque por local para respeitar transfers.create
 * ao exibir/invocar o atalho "Criar transferência".
 *
 * Uso:
 *   node scripts/apply_inventory_transfer_create_permission.cjs
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(
  process.cwd(),
  'src/pages/private/admin/products/inventory/InventoryByLocationPage.tsx',
);

function fail(message) {
  console.error(`\n[inventory-transfer-permission] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  fail(`Arquivo não encontrado: ${filePath}`);
}

let source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
let changed = false;

if (!source.includes("@/hooks/usePermissions")) {
  const marker = "import PageContainer from '@/components/common/PageContainer';";
  const replacement = `${marker}\nimport { usePermissions } from '@/hooks/usePermissions';\nimport { hasEffectivePermission } from '@/utils/permissions';`;

  if (!source.includes(marker)) fail('Ponto de importação não encontrado.');
  source = source.replace(marker, replacement);
  changed = true;
}

if (!source.includes("const canCreateTransfers = hasEffectivePermission(permissions, 'transfers.create');")) {
  const marker = `  const { rows: rawRows, loading, storeId } = useInventoryByLocation();\n  const { rows: transitRows } = useInventoryTransit(storeId);`;
  const replacement = `  const { rows: rawRows, loading, storeId } = useInventoryByLocation();\n  const { rows: transitRows } = useInventoryTransit(storeId);\n  const { permissions } = usePermissions(storeId ?? null);\n  const canCreateTransfers = hasEffectivePermission(permissions, 'transfers.create');`;

  if (!source.includes(marker)) fail('Ponto para flags de permissão não encontrado.');
  source = source.replace(marker, replacement);
  changed = true;
}

if (!source.includes("Você não tem permissão para criar transferências.")) {
  const marker = `  const handleCreateTransferFromRow = (row: any) => {\n    const sourceLocations = Array.isArray(row.source_locations)`;
  const replacement = `  const handleCreateTransferFromRow = (row: any) => {\n    if (!canCreateTransfers) {\n      return;\n    }\n\n    const sourceLocations = Array.isArray(row.source_locations)`;

  if (!source.includes(marker)) fail('Guard da ação Criar transferência não encontrado.');
  source = source.replace(marker, replacement);
  changed = true;
}

const buttonConditionBefore = `{row.recommended_action === 'transfer' && bestSource ? (`;
const buttonConditionAfter = `{row.recommended_action === 'transfer' && bestSource && canCreateTransfers ? (`;

if (!source.includes(buttonConditionAfter)) {
  if (!source.includes(buttonConditionBefore)) fail('Condição do botão Criar transferência não encontrada.');
  source = source.replace(buttonConditionBefore, buttonConditionAfter);
  changed = true;
}

if (changed) {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('[inventory-transfer-permission] Estoque atualizado para transfers.create.');
} else {
  console.log('[inventory-transfer-permission] Nenhuma alteração necessária.');
}
