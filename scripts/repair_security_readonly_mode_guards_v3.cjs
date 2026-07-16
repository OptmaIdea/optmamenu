#!/usr/bin/env node
/*
 * Reparo pontual para completar os guards críticos de Security.tsx após aplicação parcial.
 *
 * Uso:
 *   node scripts/repair_security_readonly_mode_guards_v3.cjs
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  process.cwd(),
  'src/pages/private/admin/settings/security/Security.tsx'
);

function fail(message) {
  console.error(`\n[security-readonly-mode-v3] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[security-readonly-mode-v3] Aviso: ${message}`);
}

if (!fs.existsSync(targetPath)) {
  fail(`Arquivo não encontrado: ${targetPath}`);
}

let source = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');
let changed = false;

function insertAfterIfMissing(anchor, insertion, label, needle) {
  if (source.includes(needle)) {
    return true;
  }

  if (!source.includes(anchor)) {
    fail(`Ponto de inserção não encontrado para: ${label}`);
  }

  source = source.replace(anchor, `${anchor}\n${insertion}`);
  changed = true;
  return true;
}

function replaceOnceIfPresent(search, replacement, label, needle = replacement) {
  if (source.includes(needle)) return true;

  if (!source.includes(search)) {
    warn(`trecho não encontrado para: ${label}; pode já estar aplicado ou variar nesta versão.`);
    return false;
  }

  source = source.replace(search, replacement);
  changed = true;
  return true;
}

function replaceAllIfPresent(search, replacement, label) {
  if (!source.includes(search)) {
    if (!source.includes(replacement)) {
      warn(`trecho não encontrado para: ${label}; pode já estar aplicado ou variar nesta versão.`);
    }
    return false;
  }

  const before = source;
  source = source.split(search).join(replacement);
  changed = changed || before !== source;
  return true;
}

// Completa as constantes que os guards passaram a usar. A âncora é estável na tela atual.
insertAfterIfMissing(
  "    const canManageCustomRoles = useMemo(() => canManageSecurityTab('custom_roles'), [canManageSecurityTab]);",
  "    const canManageRoles = useMemo(() => canManageSecurityTab('roles'), [canManageSecurityTab]);\n    const canManageUserPermissions = useMemo(() => canManageSecurityTab('user_permissions'), [canManageSecurityTab]);\n    const canManageSensitiveActions = useMemo(() => canManageSecurityTab('sensitive_actions'), [canManageSecurityTab]);",
  'constantes canManage por aba',
  "const canManageRoles = useMemo(() => canManageSecurityTab('roles'), [canManageSecurityTab]);"
);

// Remove comentários antigos, se ainda existirem, evitando duplicidade visual.
replaceAllIfPresent(
  "    // const canManageRoles = useMemo(() => canManageSecurityTab('roles'), [canManageSecurityTab]);\n",
  '',
  'comentário canManageRoles'
);

replaceAllIfPresent(
  "    // const canManageUserPermissions = useMemo(() => canManageSecurityTab('user_permissions'), [canManageSecurityTab]);\n",
  '',
  'comentário canManageUserPermissions'
);

replaceAllIfPresent(
  "    // const canManageSensitiveActions = useMemo(() => canManageSecurityTab('sensitive_actions'), [canManageSecurityTab]);\n",
  '',
  'comentário canManageSensitiveActions'
);

// Garante os guards principais caso a aplicação anterior tenha sido parcial.
replaceOnceIfPresent(
  `    async function saveSelectedCustomRole(reason?: string) {
        if (!selectedCustomRole) return;
        setSaving(true);`,
  `    async function saveSelectedCustomRole(reason?: string) {
        if (!selectedCustomRole) return;
        if (!canManageCustomRoles) {
            toast.error('Você não tem permissão para alterar funções personalizadas.');
            return;
        }
        setSaving(true);`,
  'guard saveSelectedCustomRole',
  "toast.error('Você não tem permissão para alterar funções personalizadas.');"
);

replaceOnceIfPresent(
  `    const handleCreateCustomRoleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCustomRoleName.trim()) {`,
  `    const handleCreateCustomRoleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManageCustomRoles) {
            toast.error('Você não tem permissão para alterar funções personalizadas.');
            return;
        }
        if (!newCustomRoleName.trim()) {`,
  'guard handleCreateCustomRoleSubmit',
  `const handleCreateCustomRoleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManageCustomRoles) {`
);

replaceAllIfPresent(
  `        if (!canManageSecurity) {
            toast.error('Você não tem permissão para alterar permissões.');
            return;
        }`,
  `        if (!canManageRoles) {
            toast.error('Você não tem permissão para alterar permissões por papel.');
            return;
        }`,
  'guards permissões por papel'
);

replaceOnceIfPresent(
  `        if (!canManageSecurity) {
            toast.error('Você não tem permissão para alterar ações sensíveis.');
            return;
        }`,
  `        if (!canManageSensitiveActions) {
            toast.error('Você não tem permissão para alterar ações sensíveis.');
            return;
        }`,
  'guard ações sensíveis',
  `if (!canManageSensitiveActions) {
            toast.error('Você não tem permissão para alterar ações sensíveis.');`
);

replaceOnceIfPresent(
  `    const saveSelectedMemberPermissions = async () => {
        if (!selectedMember) return;
        setSaving(true);`,
  `    const saveSelectedMemberPermissions = async () => {
        if (!selectedMember) return;
        if (!canManageUserPermissions) {
            toast.error('Você não tem permissão para alterar permissões por usuário.');
            return;
        }
        setSaving(true);`,
  'guard permissões por usuário',
  "toast.error('Você não tem permissão para alterar permissões por usuário.');"
);

replaceOnceIfPresent(
  'const itemDisabled = !canManageSecurity || adminLoading.saving;',
  'const itemDisabled = !canManageUserPermissions || adminLoading.saving;',
  'desabilitar permissões por usuário',
  'const itemDisabled = !canManageUserPermissions || adminLoading.saving;'
);

replaceAllIfPresent(
  'disabled={!canManageSecurity || adminLoading.saving}',
  'disabled={!canManageSensitiveActions || adminLoading.saving}',
  'desabilitar ações sensíveis'
);

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[security-readonly-mode-v3] Security.tsx reparado com guards críticos.');
} else {
  console.log('[security-readonly-mode-v3] Nenhuma alteração necessária; guards já parecem completos.');
}
