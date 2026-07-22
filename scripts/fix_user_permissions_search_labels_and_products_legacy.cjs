#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  process.cwd(),
  'src/pages/private/admin/settings/security/Security.tsx'
);

if (!fs.existsSync(filePath)) {
  console.error(`[fix-user-permissions-v2] Arquivo não encontrado: ${filePath}`);
  process.exit(1);
}

let source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
let changes = 0;

function replaceOnce(oldText, newText, label) {
  if (source.includes(oldText)) {
    source = source.replace(oldText, newText);
    changes += 1;
    return;
  }
  if (!source.includes(newText)) {
    console.error(`[fix-user-permissions-v2] Trecho não encontrado: ${label}`);
    process.exit(1);
  }
}

replaceOnce(
  `                permissions: [\n                    'products.view',\n                    'products.manage',`,
  `                permissions: [\n                    'products.manage',`,
  'remoção de products.view da árvore'
);

replaceOnce(
  `    const [permissionSearch, setPermissionSearch] = useState('');\n    const [userPermissionSearch, setUserPermissionSearch] = useState('');`,
  `    const [permissionSearch, setPermissionSearch] = useState('');\n    const [userPermissionSearch, setUserPermissionSearch] = useState('');\n\n    useEffect(() => {\n        if (activeTab === 'user_permissions') {\n            setUserPermissionSearch('');\n        }\n    }, [activeTab]);`,
  'limpeza da busca ao abrir a aba'
);

replaceOnce(
  `                                        type="text"\n                                        placeholder="Pesquisar permissões..."\n                                        value={userPermissionSearch}`,
  `                                        type="search"\n                                        name="optmamenu-permission-filter"\n                                        autoComplete="off"\n                                        data-lpignore="true"\n                                        data-1p-ignore="true"\n                                        placeholder="Pesquisar permissões..."\n                                        value={userPermissionSearch}`,
  'proteção contra autofill no filtro'
);

replaceOnce(
  `                                                                    <span className="text-xs text-slate-400">\n                                                                        {code}\n                                                                    </span>`,
  ``,
  'remoção do código técnico na matriz por papel'
);

replaceOnce(
  `                                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[240px]" title={code}>\n                                                                            {code}\n                                                                        </span>`,
  ``,
  'remoção do código técnico nos cards por usuário'
);

fs.writeFileSync(filePath, source, 'utf8');
console.log(`[fix-user-permissions-v2] Concluído. Alterações aplicadas: ${changes}.`);
