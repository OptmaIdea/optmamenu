# Checklist para novas permissões

## Objetivo

Este checklist deve ser usado sempre que uma nova permissão granular for adicionada ao OptmaMenu.

A experiência da Fase 9.13.1I, com `settings.messages.view` e `settings.messages.manage`, confirmou que inserir apenas no banco não é suficiente: a permissão também precisa existir nas árvores/estruturas fixas usadas pela interface de Segurança.

---

## Checklist obrigatório

### 1. Catálogo de permissões

Inserir ou atualizar a permissão em:

- `store_permission_catalog`

Campos que devem ser conferidos:

- `permission_key`
- `category`
- `label`
- `description`
- `active`
- `sort_order`
- `macro_group`
- `group_key`
- `group_label`
- `item_key`
- `item_label`
- `action_key`
- `action_label`
- `depends_on`
- `access_permission_key`
- `ui_sort_order`
- `show_in_permission_ui`

Quando houver permissão de escrita/gerenciamento, ela deve depender da permissão de visualização correspondente.

---

### 2. Templates por papel

Inserir ou atualizar a permissão em:

- `store_role_permission_templates`

Conferir todos os papéis usados pelo sistema:

- `owner`
- `admin`
- `manager`
- `stock_operator`
- `cashier`
- `sales`
- `staff`
- `viewer`

Definir explicitamente `allowed=true/false` para cada papel, evitando fallback ambíguo.

---

### 3. Realtime/versionamento

Após alterar catálogo/templates, atualizar:

- `store_permission_versions`

Motivo:

- acionar refresh de permissões;
- manter `usePermissions` escutando apenas a tabela central de versionamento;
- evitar listeners diretos em `store_role_permission_templates`, `store_custom_roles` ou `store_members`.

---

### 4. Árvore de permissões por papel

Atualizar obrigatoriamente a árvore usada na tela de permissões por papel:

- `ROLE_PERMISSION_TREE`

Sem essa inclusão, a permissão pode existir no banco e ainda assim não aparecer corretamente na interface.

Exemplo da 9.13.1I:

```ts
{
    id: 'settings_messages',
    label: 'Mensagens',
    accessPermission: 'settings.messages.view',
    permissions: [
        'settings.messages.view',
        'settings.messages.manage',
    ],
}
```

---

### 5. Agrupamento visual da matriz

Atualizar, quando aplicável:

- `PERMISSION_GROUP_DEFINITIONS`

O prefixo deve refletir o padrão real da permissão.

Exemplo correto para Mensagens em Configurações:

```ts
{
    id: 'settings_messages',
    macroGroup: 'settings',
    label: 'Mensagens',
    description: 'Configurações de mensagens, modelos, canais e preferências de comunicação.',
    prefixes: ['settings.messages.'],
}
```

---

### 6. Ordenação visual

Conferir manualmente a ordem de exibição.

A árvore não garante ordenação alfabética perfeita em todos os pontos da UI, então a posição do novo item deve ser revisada manualmente.

---

### 7. Tela consumidora

Atualizar a rota, aba ou componente que consome a permissão.

Exemplo:

```ts
permissionView: 'settings.messages.view'
permissionManage: 'settings.messages.manage'
```

Também revisar `manage=false`:

- inputs desabilitados;
- switches desabilitados;
- botões de ação ocultos;
- sem toast de “sem permissão” quando a UI já impede a ação.

---

### 8. Validações finais

Testar pelo menos:

- `owner`;
- `admin`;
- `manager`;
- papel com `view=true/manage=false`;
- papel com `view=false`.

Critérios esperados:

- `view=false` oculta menu/aba/rota;
- `view=true/manage=false` exibe leitura;
- `manage=true` permite alteração;
- build limpo;
- console limpo;
- mudança refletida no usuário afetado quando o realtime/versionamento estiver ativo.

---

## Observações da Fase 9.13.1I

Durante a criação de `settings.messages.view` e `settings.messages.manage`, foi confirmado que:

- catálogo e templates podem estar corretos, mas a permissão não aparecer se `ROLE_PERMISSION_TREE` não for atualizado;
- `PERMISSION_GROUP_DEFINITIONS` também precisa usar o prefixo novo correto;
- permissões antigas como `messages.view/manage` devem ficar reservadas para Central de Mensagens/Marketing, não para Configurações da Loja;
- permissões de Configurações devem seguir o padrão `settings.<aba>.view/manage`.

---

## Pendências observadas fora da 9.13.1I

Estas pendências devem ser tratadas em rodada própria de Segurança/Funções Personalizadas:

- revisar listener/realtime para refletir alterações de permissões entre usuários sem reload;
- revisar exibição de nome de colaborador quando cai para e-mail, exemplo Henrique/Rick aparecendo por e-mail em permissões por usuário;
- revisar atribuição/revogação de permissões em funções personalizadas, especialmente quando a função personalizada herda de um papel base, exemplo `Subgerente Nível I` com base `Gerente`;
- validar se alterações em `store_custom_roles.permissions` atualizam `store_permission_versions` e disparam refresh no usuário afetado.
