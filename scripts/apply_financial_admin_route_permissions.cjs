#!/usr/bin/env node
/*
 * Aplica as novas permissões administrativas financeiras nas rotas e menu.
 *
 * Uso:
 *   node scripts/apply_financial_admin_route_permissions.cjs
 *
 * Corrige Plano de Contas e Contas Financeiras para não herdarem cashbook.view.
 */

const fs = require('fs');
const path = require('path');

const files = [
  path.join(process.cwd(), 'src/AppRoutes.tsx'),
  path.join(process.cwd(), 'src/components/layouts/PrivateLayout.tsx'),
];

function fail(message) {
  console.error(`\n[financial-admin-route-permissions] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[financial-admin-route-permissions] Aviso: ${message}`);
}

const replacementsByFile = {
  'src/AppRoutes.tsx': [
    {
      label: 'rota Plano de Contas',
      search: '<Route path="/admin/account-plan" element={<RequirePermission permission="cashbook.view"><AccountPlanPage /></RequirePermission>} />',
      replacement: '<Route path="/admin/account-plan" element={<RequirePermission permission="financial.account_plan.view"><AccountPlanPage /></RequirePermission>} />',
    },
    {
      label: 'rota Contas Financeiras',
      search: '<Route path="/admin/financial-accounts" element={<RequirePermission permission="cashbook.view"><FinancialAccountsSettingsPage /></RequirePermission>} />',
      replacement: '<Route path="/admin/financial-accounts" element={<RequirePermission permission="financial.accounts.view"><FinancialAccountsSettingsPage /></RequirePermission>} />',
    },
  ],
  'src/components/layouts/PrivateLayout.tsx': [
    {
      label: 'menu Plano de Contas',
      search: "{ path: '/admin/account-plan', icon: FolderTree, label: 'Plano de contas', permission: 'cashbook.view' }",
      replacement: "{ path: '/admin/account-plan', icon: FolderTree, label: 'Plano de contas', permission: 'financial.account_plan.view' }",
    },
    {
      label: 'menu Contas Financeiras',
      search: "{ path: '/admin/financial-accounts', icon: Building, label: 'Contas financeiras', permission: 'cashbook.view' }",
      replacement: "{ path: '/admin/financial-accounts', icon: Building, label: 'Contas financeiras', permission: 'financial.accounts.view' }",
    },
  ],
};

let changedFiles = 0;

for (const targetPath of files) {
  if (!fs.existsSync(targetPath)) {
    fail(`Arquivo não encontrado: ${targetPath}`);
  }

  const relativePath = path.relative(process.cwd(), targetPath).replace(/\\/g, '/');
  const replacements = replacementsByFile[relativePath];
  if (!replacements) continue;

  let source = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');
  let changed = false;

  for (const item of replacements) {
    if (source.includes(item.replacement)) {
      continue;
    }

    if (!source.includes(item.search)) {
      warn(`trecho não encontrado para: ${item.label}; pode já estar aplicado ou variar nesta versão.`);
      continue;
    }

    source = source.replace(item.search, item.replacement);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(targetPath, source, 'utf8');
    changedFiles += 1;
    console.log(`[financial-admin-route-permissions] Atualizado: ${relativePath}`);
  }
}

if (changedFiles === 0) {
  console.log('[financial-admin-route-permissions] Nenhuma alteração necessária; rotas e menu já parecem corrigidos.');
} else {
  console.log(`[financial-admin-route-permissions] Concluído. Arquivos alterados: ${changedFiles}.`);
}
