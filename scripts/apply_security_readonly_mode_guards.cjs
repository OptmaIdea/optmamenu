#!/usr/bin/env node
/*
 * Aplica ajustes conservadores de UX de permissões na tela de Segurança.
 *
 * Uso:
 *   node scripts/apply_security_readonly_mode_guards.cjs
 *
 * O script é idempotente: pode ser executado mais de uma vez.
 * Ele interrompe com erro se encontrar um trecho inesperado, evitando alterar o arquivo parcialmente.
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  process.cwd(),
  'src/pages/private/admin/settings/security/Security.tsx'
);

function fail(message) {
  console.error(`\n[security-readonly-mode] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(targetPath)) {
  fail(`Arquivo não encontrado: ${targetPath}`);
}

let source = fs.readFileSync(targetPath, 'utf8');
let changed = false;

function replaceOnce(search, replacement, label) {
  if (source.includes(replacement)) {
    return;
  }

  if (!source.includes(search)) {
    fail(`Trecho não encontrado para: ${label}`);
  }

  source = source.replace(search, replacement);
  changed = true;
}

function replaceAllRequired(search, replacement, label) {
  if (!source.includes(search)) {
    if (source.includes(replacement)) {
      return;
    }
    fail(`Trecho não encontrado para: ${label}`);
  }

  const before = source;
  source = source.split(search).join(replacement);
  changed = changed || before !== source;
}

replaceOnce(
  "import { notifyPermissionsChanged } from '@/utils/permissionEvents';",
  "import { notifyPermissionsChanged } from '@/utils/permissionEvents';\nimport PermissionReadOnlyNotice from '@/components/security/PermissionReadOnlyNotice';",
  'import PermissionReadOnlyNotice'
);

replaceOnce(
  "    // const canManageRoles = useMemo(() => canManageSecurityTab('roles'), [canManageSecurityTab]);",
  "    const canManageRoles = useMemo(() => canManageSecurityTab('roles'), [canManageSecurityTab]);",
  'canManageRoles'
);

replaceOnce(
  "    // const canManageUserPermissions = useMemo(() => canManageSecurityTab('user_permissions'), [canManageSecurityTab]);",
  "    const canManageUserPermissions = useMemo(() => canManageSecurityTab('user_permissions'), [canManageSecurityTab]);",
  'canManageUserPermissions'
);

replaceOnce(
  "    // const canManageSensitiveActions = useMemo(() => canManageSecurityTab('sensitive_actions'), [canManageSecurityTab]);",
  "    const canManageSensitiveActions = useMemo(() => canManageSecurityTab('sensitive_actions'), [canManageSecurityTab]);",
  'canManageSensitiveActions'
);

replaceOnce(
  `    const canManageSecurity = useMemo(() => {
        return activeTab ? canManageSecurityTab(activeTab as keyof typeof securityTabPermissions) : false;
    }, [activeTab, canManageSecurityTab]);`,
  `    const canManageSecurity = useMemo(() => {
        return activeTab ? canManageSecurityTab(activeTab as keyof typeof securityTabPermissions) : false;
    }, [activeTab, canManageSecurityTab]);

    const isActiveSecurityTabReadOnly = useMemo(() => {
        if (!activeTab || !(activeTab in securityTabPermissions)) return false;
        const tab = activeTab as keyof typeof securityTabPermissions;
        return canViewSecurityTab(tab) && !canManageSecurityTab(tab);
    }, [activeTab, canViewSecurityTab, canManageSecurityTab]);`,
  'isActiveSecurityTabReadOnly'
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
  'guard saveSelectedCustomRole'
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
  'guard handleCreateCustomRoleSubmit'
);

replaceOnce(
  "            toast.error('Você não tem permissão para alterar configurações de sessão.');",
  "            toast.error('Você não tem permissão para alterar sessões e inatividade.');",
  'mensagem sessões'
);

replaceOnce(
  `        if (!canManageSecurity) {
            toast.error('Você não tem permissão para alterar permissões.');
            return;
        }`,
  `        if (!canManageRoles) {
            toast.error('Você não tem permissão para alterar permissões por papel.');
            return;
        }`,
  'guard permissões por papel 1'
);

replaceOnce(
  `        if (!canManageSecurity) {
            toast.error('Você não tem permissão para alterar permissões.');
            return;
        }`,
  `        if (!canManageRoles) {
            toast.error('Você não tem permissão para alterar permissões por papel.');
            return;
        }`,
  'guard permissões por papel 2'
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
  'guard ações sensíveis'
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
  'guard permissões por usuário'
);

replaceOnce(
  `                            {activeTab === 'roles' && canViewRolesTab && (`,
  `                            {isActiveSecurityTabReadOnly && (
                                <PermissionReadOnlyNotice className="mb-4" />
                            )}

                            {activeTab === 'roles' && canViewRolesTab && (`,
  'aviso modo leitura antes das abas'
);

replaceOnce(
  `                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-4">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                toast.success('Configurações de permissões salvas com sucesso!');
                                                await refreshAdmin();
                                            }}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-green-700 transition"
                                        >
                                            <Save size={14} />
                                            Salvar Alterações
                                        </button>
                                    </div>`,
  `                                    {canManageRoles && (
                                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-4">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    toast.success('Configurações de permissões salvas com sucesso!');
                                                    await refreshAdmin();
                                                }}
                                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-green-700 transition"
                                            >
                                                <Save size={14} />
                                                Salvar Alterações
                                            </button>
                                        </div>
                                    )}`,
  'ocultar salvar permissões por papel'
);

replaceOnce(
  'const itemDisabled = !canManageSecurity || adminLoading.saving;',
  'const itemDisabled = !canManageUserPermissions || adminLoading.saving;',
  'desabilitar permissões por usuário'
);

replaceAllRequired(
  'disabled={!canManageSecurity || adminLoading.saving}',
  'disabled={!canManageSensitiveActions || adminLoading.saving}',
  'desabilitar ações sensíveis'
);

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[security-readonly-mode] Security.tsx atualizado com sucesso.');
} else {
  console.log('[security-readonly-mode] Nenhuma alteração necessária; arquivo já estava atualizado.');
}
