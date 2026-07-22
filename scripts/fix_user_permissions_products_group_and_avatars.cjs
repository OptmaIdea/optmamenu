#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  process.cwd(),
  'src/pages/private/admin/settings/security/Security.tsx'
);

if (!fs.existsSync(filePath)) {
  console.error(`[fix-user-permissions] Arquivo não encontrado: ${filePath}`);
  process.exit(1);
}

let source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
let changes = 0;

const oldGroup = `            {
                id: 'products_stock',
                label: 'Produtos e Estoque',
                accessPermission: 'products.view',`;

const newGroup = `            {
                id: 'products',
                label: 'Produtos e Estoque',
                accessPermission: 'products.manage',`;

if (source.includes(oldGroup)) {
  source = source.replace(oldGroup, newGroup);
  changes += 1;
} else if (!source.includes("id: 'products',\n                label: 'Produtos e Estoque'")) {
  console.error('[fix-user-permissions] Bloco Produtos e Estoque não encontrado.');
  process.exit(1);
}

const oldAvatar = `                                                    {/* Avatar */}
                                                    <div className={\`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold \${isSelected
                                                        ? 'bg-green-200 text-green-850 dark:bg-green-800 dark:text-green-100'
                                                        : 'bg-gray-100 text-gray-650 dark:bg-gray-700 dark:text-gray-300'
                                                        }\`}>
                                                        {initials}
                                                    </div>`;

const newAvatar = `                                                    {/* Avatar */}
                                                    {member.avatar_url || member.profile_avatar_url ? (
                                                        <img
                                                            src={member.avatar_url || member.profile_avatar_url || ''}
                                                            alt={name}
                                                            className={\`h-8 w-8 shrink-0 rounded-full object-cover border \${isSelected
                                                                ? 'border-green-500'
                                                                : 'border-gray-200 dark:border-gray-700'
                                                                }\`}
                                                        />
                                                    ) : (
                                                        <div className={\`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold \${isSelected
                                                            ? 'bg-green-200 text-green-850 dark:bg-green-800 dark:text-green-100'
                                                            : 'bg-gray-100 text-gray-650 dark:bg-gray-700 dark:text-gray-300'
                                                            }\`}>
                                                            {initials}
                                                        </div>
                                                    )}`;

if (source.includes(oldAvatar)) {
  source = source.replace(oldAvatar, newAvatar);
  changes += 1;
} else if (!source.includes('member.avatar_url || member.profile_avatar_url')) {
  console.error('[fix-user-permissions] Bloco de avatar dos colaboradores não encontrado.');
  process.exit(1);
}

fs.writeFileSync(filePath, source, 'utf8');
console.log(`[fix-user-permissions] Concluído. Alterações aplicadas: ${changes}.`);
