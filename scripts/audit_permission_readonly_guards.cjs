#!/usr/bin/env node
/*
 * Audita pontos do front-end que ainda usam guards/toasts de permissão.
 *
 * Uso:
 *   node scripts/audit_permission_readonly_guards.cjs
 *
 * Saída:
 *   - resumo por arquivo
 *   - linhas com mensagens de permissão
 *   - linhas com uso de canManage/canView/managePermission/usePermissions
 *
 * O script é somente leitura e não altera nenhum arquivo.
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const scanRoots = ['src'];
const extensions = new Set(['.ts', '.tsx']);
const ignoredDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);

const permissionPatterns = [
  /Você não tem permissão/i,
  /sem permissão/i,
  /permission/i,
  /permissions/i,
  /canManage/i,
  /canView/i,
  /usePermissions/i,
  /hasEffectivePermission/i,
  /RequirePermission/i,
  /PermissionLocked/i,
  /managePermission/i,
];

const actionPatterns = [
  /toast\.error/i,
  /onClick=/i,
  /onSubmit=/i,
  /disabled=/i,
  /hidden=/i,
  /create/i,
  /update/i,
  /delete/i,
  /save/i,
  /submit/i,
  /remove/i,
  /cancel/i,
  /approve/i,
  /convert/i,
  /transfer/i,
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function classifyFile(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.includes('/settings/security/')) return 'security';
  if (normalized.includes('/products/products/')) return 'products';
  if (normalized.includes('/products/inventory/')) return 'inventory';
  if (normalized.includes('/financial/cashbook/')) return 'cashbook';
  if (normalized.includes('/customers/')) return 'customers';
  if (normalized.includes('/suppliers/')) return 'suppliers';
  if (normalized.includes('/commercial/')) return 'commercial';
  if (normalized.includes('/settings/')) return 'settings';
  if (normalized.includes('/users/')) return 'users';
  return 'other';
}

function priorityFor(relativePath, matches) {
  const group = classifyFile(relativePath);
  const hasPermissionToast = matches.some((m) => /Você não tem permissão|sem permissão/i.test(m.text));
  const hasAction = matches.some((m) => actionPatterns.some((pattern) => pattern.test(m.text)));

  if (['cashbook', 'inventory', 'products'].includes(group) && (hasPermissionToast || hasAction)) return 'high';
  if (['customers', 'suppliers', 'commercial', 'settings', 'users'].includes(group) && (hasPermissionToast || hasAction)) return 'medium';
  return 'review';
}

const files = scanRoots.flatMap((root) => walk(path.join(rootDir, root)));
const results = [];

for (const file of files) {
  const relativePath = path.relative(rootDir, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const matches = [];

  lines.forEach((line, index) => {
    if (permissionPatterns.some((pattern) => pattern.test(line))) {
      matches.push({
        line: index + 1,
        text: line.trim(),
      });
    }
  });

  if (matches.length > 0) {
    results.push({
      file: relativePath,
      group: classifyFile(relativePath),
      priority: priorityFor(relativePath, matches),
      matches,
    });
  }
}

const priorityOrder = { high: 0, medium: 1, review: 2 };
results.sort((a, b) => {
  const byPriority = priorityOrder[a.priority] - priorityOrder[b.priority];
  if (byPriority !== 0) return byPriority;
  return a.file.localeCompare(b.file);
});

console.log('\n[permission-readonly-audit] Arquivos com uso de permissões/guards no front:\n');

if (results.length === 0) {
  console.log('Nenhum ponto encontrado.');
  process.exit(0);
}

const summary = results.reduce((acc, item) => {
  acc[item.priority] = (acc[item.priority] || 0) + 1;
  return acc;
}, {});

console.log(`Resumo: high=${summary.high || 0}, medium=${summary.medium || 0}, review=${summary.review || 0}, total=${results.length}\n`);

for (const item of results) {
  console.log(`- [${item.priority}] ${item.file} (${item.group})`);
  for (const match of item.matches.slice(0, 8)) {
    console.log(`  L${String(match.line).padStart(4, ' ')}: ${match.text}`);
  }
  if (item.matches.length > 8) {
    console.log(`  ... +${item.matches.length - 8} ocorrência(s)`);
  }
  console.log('');
}
