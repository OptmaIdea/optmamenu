#!/usr/bin/env node
/*
 * Aplica somente os guards críticos de permissão na tela de Segurança.
 *
 * Esta versão evita alterações visuais frágeis em JSX grande. Ela também remove
 * sobras opcionais de tentativa anterior que poderiam causar noUnusedLocals.
 *
 * Uso:
 *   node scripts/apply_security_readonly_mode_guards_v2.cjs
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  process.cwd(),
  'src/pages/private/admin/settings/security/Security.tsx'
);

function fail(message) {
  console.error(`\n[security-readonly-mode-v2] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[security-readonly-mode-v2] Aviso: ${message}`);
}

if (!fs.existsSync(targetPath)) {
  fail(`Arquivo não encontrado: ${targetPath}`);
}

let source = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');
let changed = false;

function replaceOnce(search, replacement, label, alreadyAppliedNeedle = replacement) {
  if (source.includes(alreadyAppliedNeedle)) return true;
  if (!source.includes(search)) {
    warn(`trecho não encontrado para: ${label}; pode já estar aplicado ou variar nesta versão.`);
    return false;
  }
  source = source.replace(search, replacement);
  changed = true;
  return true;
}

function replaceAll(search, replacement, label) {
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

function removeBlockIfUnused(startNeedle, endNeedle, label) {
  const startIndex = source.indexOf(startNeedle);
  if (startIndex === -1) return false;

  const endIndex = source.indexOf(endNeedle, startIndex);
  if (endIndex === -1) return false;

  const blockEnd = endIndex + endNeedle.length;
  source = source.slice(0, startIndex) + source.slice(blockEnd);
  changed = true;
  warn(`removido bloco opcional sem uso: ${label}`);
  return true;
}

// Limpa sobras de tentativa anterior caso o aviso visual não tenha sido inserido.
if (!source.includes('<PermissionReadOnlyNotice')) {
  replaceOnce(
    "import PermissionReadOnlyNotice from '@/components/security/PermissionReadOnlyNotice';\n",
    '',
    'remover import PermissionReadOnlyNotice',
    "import PermissionReadOnlyNotice from '@/components/security/PermissionReadOnlyNotice';\n"
  );

  removeBlockIfUnused(
    `    const isActiveSecurityTabReadOnly = useMemo(() => {`,
    `    }, [activeTab, canViewSecurityTab, canManageSecurityTab]);\n`,
    'isActiveSecurityTabReadOnly'
  );
}

replaceOnce(
  "    // const canManageRoles = useMemo(() => canManageSecurityTab('roles'), [canManageSecurityTab]);",
  "    const canManageRoles = useMemo(() => canManageSecurityTab('roles'), [canManageSecurityTab]);",
  'canManageRoles',
  "const canManageRoles = useMemo(() => canManageSecurityTab('roles'), [canManageSecurityTab]);"
);

replaceOnce(
  "    // const canManageUserPermissions = useMemo(() => canManageSecurityTab('user_permissions'), [canManageSecurityTab]);",
  "    const canManageUserPermissions = useMemo(() => canManageSecurityTab('user_permissions'), [canManageSecurityTab]);",
  'canManageUserPermissions',
  "const canManageUserPermissions = useMemo(() => canManageSecurityTab('user_permissions'), [canManageSecurityTab]);"
);

replaceOnce(
  "    // const canManageSensitiveActions = useMemo(() => canManageSecurityTab('sensitive_actions'), [canManageSecurityTab]);",
  "    const canManageSensitiveActions = useMemo(() => canManageSecurityTab('sensitive_actions'), [canManageSecurityTab]);",
  'canManageSensitiveActions',
  "const canManageSensitiveActions = useMemo(() => canManageSecurityTab('sensitive_actions'), [canManageSecurityTab]);"
);

replaceOnce(
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

replaceOnce(
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

replaceOnce(
  "            toast.error('Você não tem permissão para alterar configurações de sessão.');",
  "            toast.error('Você não tem permissão para alterar sessões e inatividade.');",
  'mensagem sessões',
  "toast.error('Você não tem permissão para alterar sessões e inatividade.');"
);

replaceAll(
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

replaceOnce(
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

replaceOnce(
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

replaceOnce(
  'const itemDisabled = !canManageSecurity || adminLoading.saving;',
  'const itemDisabled = !canManageUserPermissions || adminLoading.saving;',
  'desabilitar permissões por usuário',
  'const itemDisabled = !canManageUserPermissions || adminLoading.saving;'
);

replaceAll(
  'disabled={!canManageSecurity || adminLoading.saving}',
  'disabled={!canManageSensitiveActions || adminLoading.saving}',
  'desabilitar ações sensíveis'
);

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[security-readonly-mode-v2] Security.tsx atualizado com guards críticos.');
} else {
  console.log('[security-readonly-mode-v2] Nenhuma alteração necessária; guards já parecem aplicados.');
}
