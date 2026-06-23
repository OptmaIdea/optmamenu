# Fase 9.13 — Permissões, Segurança, Realtime e padrão manage=false

## Status

**Concluída tecnicamente até 9.13.1F.**

Este documento registra o fechamento da frente de permissões e segurança trabalhada após a consolidação da área de usuários. Ele complementa:

- `docs/FASE_9_USUARIOS_GOVERNANCA.md`
- `docs/PERMISSOES_USUARIOS.md`
- `docs/GUIA_SISTEMA_PERMISSOES_REALTIME.md`
- `docs/RPCS_AND_VIEWS.md`
- `docs/RLS_AND_SECURITY.md`

---

## 1. Objetivo da frente

A frente 9.13 teve como objetivo transformar o sistema de permissões em uma estrutura operacional, visual e reativa, capaz de controlar:

- menus do sidebar;
- rotas protegidas;
- abas internas;
- botões de ação;
- inputs, selects e switches;
- permissões por papel;
- funções personalizadas;
- permissões individuais;
- atualizações em tempo real;
- comportamento `view=false` e `manage=false`.

---

## 2. Modelo final de resolução de permissões

A hierarquia final validada é:

1. **Permissão individual** em `store_members.permissions`.
2. **Função personalizada** em `store_custom_roles.permissions`.
3. **Papel base** em `store_role_permission_templates`.
4. **Padrão seguro**: `false` quando não houver permissão resolvida.
5. **Owner**: acesso total, ignorando checagens comuns.

> Observação importante: não existe mais dependência conceitual da tabela `store_member_permissions`. As permissões individuais são armazenadas no JSONB `store_members.permissions`.

---

## 3. Papéis nativos

Papéis base usados pelo sistema:

- `owner`
- `admin`
- `manager`
- `stock_operator`
- `cashier`
- `sales`
- `staff`
- `viewer`

O `owner` tem acesso integral e não deve ser tratado como papel editável comum.

---

## 4. Tela de Segurança — `/admin/security`

A tela **Senhas e Acesso** foi consolidada como módulo próprio de segurança, separado de Configurações.

### Grupo lateral

O sidebar agora separa:

- **Configurações**
  - Configurações da Loja
- **Segurança**
  - Senhas e Acesso

### Regra raiz

`security.view` é porteira absoluta.

Se `security.view=false`:

- o grupo Segurança fica oculto;
- `/admin/security` redireciona para `/admin/my-profile`;
- `/admin/security?tab=context` redireciona para `/admin/my-profile`;
- qualquer aba de Segurança fica inacessível, mesmo que a permissão específica da aba esteja `true`.

Se `security.view=true`:

- ao menos uma aba `security.*.view` deve estar liberada para o menu aparecer;
- `/admin/security` normaliza para a primeira aba permitida;
- acessar uma aba bloqueada redireciona para a primeira aba permitida;
- se nenhuma aba estiver liberada, o usuário vai para `/admin/my-profile`.

### Abas finais de Segurança

- `security.context.view` — Contexto de acesso
- `security.logs.view` — Histórico de atividades
- `security.roles.view` — Permissões por papel
- `security.custom_roles.view` — Funções personalizadas
- `security.user_permissions.view` — Permissões por usuário
- `security.sensitive_actions.view` — Ações sensíveis
- `security.pin_token.view` — PIN e Token
- `security.sessions.view` — Sessões e inatividade

Cada aba possui seu respectivo `.manage`, exceto áreas meramente informativas quando o gerenciamento não se aplica.

---

## 5. Permissões por papel

A aba **Permissões por papel** permite configurar o template base de cada papel.

### Regras validadas

- `view=false` remove menus, abas e rotas correspondentes.
- `manage=false` mantém visualização, mas impede edição.
- O botão **Salvar alterações** só aparece quando o usuário pode gerenciar aquela área.
- Alterações são propagadas em tempo real para usuários afetados.
- Logs de auditoria usam mensagens amigáveis.

### Grupo `security_general`

Foi consolidado para representar somente:

- `security.view`

`security.manage` permanece oculto da matriz (`show_in_permission_ui=false`) para evitar confusão. O gerenciamento é feito por item/aba específica.

---

## 6. Funções personalizadas

A aba **Funções personalizadas** permite criar papéis específicos por loja.

### Regras consolidadas

- A função personalizada herda um papel base.
- Permissões customizadas podem liberar ou bloquear chaves específicas.
- Usuários vinculados a funções personalizadas recebem recalculação em tempo real.
- Alterações de função aparecem na sidebar e nos detalhes do usuário sem reload.

### Pendência futura

Ao inativar uma função personalizada com usuários vinculados, o sistema deve:

1. exibir alerta;
2. listar usuários afetados;
3. permitir migrar para outra função;
4. permitir manter papel base;
5. permitir cancelar a inativação.

---

## 7. Permissões por usuário

Permissões individuais são armazenadas em `store_members.permissions` como JSONB.

### Regras finais

- Permissão individual tem prioridade sobre função personalizada e papel base.
- Owner não deve ter permissões individuais alteradas.
- Usuário não deve alterar suas próprias permissões administrativas.
- Alterações disparam recalculação em tempo real.
- `update_store_member_permissions` registra auditoria.

---

## 8. Realtime de permissões

A arquitetura final usa `store_permission_versions` como canal central.

### Tabela central

`store_permission_versions`

Campos principais:

- `store_id`
- `version`
- `reason`
- `changed_by`
- `changed_at`

### Fluxo final

1. Owner/admin altera permissão, função ou papel.
2. Backend atualiza `store_permission_versions`.
3. Supabase Realtime publica evento da loja.
4. `usePermissions` agenda refresh silencioso.
5. Sidebar, rotas e botões refletem alteração sem reload manual.

### Decisão final

`usePermissions` escuta apenas `store_permission_versions` via Realtime.

Os listeners diretos em `store_role_permission_templates`, `store_custom_roles` e `store_members` foram removidos do fluxo principal para evitar conflitos como:

- `CHANNEL_ERROR`
- `mismatch between server and client bindings for postgres changes`
- logs excessivos;
- múltiplos refreshes ruidosos.

---

## 9. Padrão final `view=false` e `manage=false`

### `view=false`

Quando uma permissão de visualização está falsa:

- menu some;
- aba some;
- rota é protegida;
- acesso direto pela barra de endereço redireciona corretamente;
- fallback seguro é `/admin/my-profile`.

### `view=true` + `manage=false`

Quando visualiza mas não gerencia:

- tela abre em modo leitura;
- inputs, selects e switches ficam desabilitados;
- botões de ação ficam ocultos;
- não há falso salvamento;
- não há erro de console;
- não há toast desnecessário;
- tooltip/título informa falta de permissão para alteração.

### Componente criado

`src/components/security/PermissionLocked.tsx`

Exporta:

- `NO_WRITE_PERMISSION_MESSAGE`
- `PermissionLocked`
- `LockedHint`

---

## 10. Configurações — Opção B consolidada

O menu lateral não mostra mais cada configuração como item solto.

### Sidebar

- **Configurações**
  - Configurações da Loja

### Abas internas de `/admin/settings`

- Dados da Loja — `settings.store.view/manage`
- Comercial — `settings.commercial.view/manage`
- Pedido Online — `settings.orders.view/manage`
- Horários — `settings.hours.view/manage`
- Estoque — `settings.stock.view/manage`
- Entrega — `settings.delivery.view/manage`
- Pagamento — `settings.payment.view/manage`
- Mensagens — `messages.view/manage`
- Documentos e Termos — `settings.legal.view/manage`
- Sistema — `settings.system.view/manage`

### Regra raiz

`settings.view` controla o acesso ao conjunto **Configurações da Loja**.

Cada aba tem sua própria permissão de `view/manage`.

---

## 11. Rotas ajustadas ou validadas

### Fallback de acesso negado

Quando `/admin` não está liberado por `dashboard.view`, o fallback é:

- `/admin/my-profile`

Quando uma rota protegida é negada, o fallback também deve ser:

- `/admin/my-profile`

### Rotas de configurações

- `/admin/settings` — entrada geral de Configurações da Loja.
- `/admin/settings?tab=hours` — Horários integrado como aba.
- `/admin/hours` — rota legada redirecionada para `/admin/settings?tab=hours`.

### Rotas comerciais com permissões próprias

- `/admin/commercial-dashboard` — `commercial.dashboard.view`
- `/admin/sales-channels` — `commercial.sales_channels.view`

---

## 12. Permissões novas ou refinadas

### Comercial

- `commercial.dashboard.view`
- `commercial.sales_channels.view`
- `commercial.sales_channels.manage`

### Configurações

- `settings.hours.view`
- `settings.hours.manage`

### Segurança

- `security.view` como porteira absoluta.
- `security.manage` oculto da matriz.

---

## 13. Histórico de atividades

O histórico de atividades da área Segurança foi ajustado para exibir mensagens mais amigáveis, por exemplo:

- “Permissões por papel atualizadas”
- “Acesso bloqueado: Senhas e Acesso”
- “Acesso liberado: Contexto de acesso”

### Pendência futura

O **Meu Histórico** pessoal ainda deve registrar:

- alteração de função/papel;
- função anterior;
- nova função;
- responsável;
- motivo;
- loja;
- data/hora.

Também deve registrar o andamento de solicitações cadastrais.

---

## 14. Advisors do Supabase

Foi revisado o arquivo `docs/ADVISORS.md`.

Pontos de atenção atuais:

- `store_permission_catalog` aparece com RLS desabilitado.
- tabela backup `store_role_permission_templates_backup_910c` aparece com RLS desabilitado.
- há WARNs de funções `SECURITY DEFINER` executáveis por `anon`.

Decisão: tratar Advisors em rodada própria de hardening, após fechamento funcional da etapa de permissões. Não misturar correções de linter do Supabase com UX/fluxo funcional.

---

## 15. Pendências para próxima conversa/fase

1. Histórico pessoal de alteração de função.
2. Histórico pessoal de solicitações cadastrais.
3. Configurações reais da aba Mensagens.
4. Pedido Online: slug, layout público básico e regras de pedido.
5. Revisão final de Advisors/RLS.
6. Documentação fina de RPCs conforme validação no banco.
7. Futura área de superusuário/global admin.

---

## 16. Resultado da etapa

A frente de permissões ficou funcionalmente estabilizada:

- permissões atualizam em tempo real;
- menus respeitam permissões;
- rotas estão protegidas;
- Configurações e Segurança foram separadas;
- `view=false` e `manage=false` têm comportamento padronizado;
- console ficou limpo;
- build validado pelo usuário.
