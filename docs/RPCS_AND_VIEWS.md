# RPCs, functions e views

## Objetivo

Documentar funções, RPCs e views usadas pelo sistema.

## Modelo de documentação

Cada RPC deve ser documentada com:

- nome;
- objetivo;
- parâmetros;
- retorno;
- permissões/RLS relevantes;
- dependências;
- onde é usada no frontend;
- observações e pendências.

---

## Convenções atuais

- RPCs administrativas devem exigir usuário autenticado (`auth.uid()`).
- RPCs administrativas devem validar vínculo ativo em `store_members`.
- RPCs críticas devem validar `owner` ou permissão granular correspondente.
- RPCs `SECURITY DEFINER` devem usar `search_path` controlado.
- RPCs públicas (`anon`) só devem existir para loja pública, pedido público, OTP/login de cliente ou fluxos explicitamente públicos.
- Toda RPC usada por permissões deve ser revisada contra `docs/ADVISORS.md` antes de publicação.

---

# 1. Permissões, Segurança e Usuários

## 1.1 `get_store_permission_matrix_v3`

### Objetivo
Retorna a matriz administrativa de permissões por papel para uma loja.

### Parâmetros
- `p_store_id uuid`

### Retorno
Linhas com permissões configuráveis, metadados de UI e colunas/valores por papel.

Campos esperados no frontend incluem, conforme evolução da função:

- `permission_code`
- `group_key`
- `group_label`
- `item_key`
- `item_label`
- `action_key`
- `action_label`
- valores por papel (`owner`, `admin`, `manager`, `stock_operator`, `cashier`, `sales`, `staff`, `viewer`)

### Permissões
Deve exigir:

- usuário autenticado;
- vínculo com a loja;
- `owner` ou `security.roles.view` para leitura.

### Onde é usada
- `src/hooks/security/useSecurityPermissionsAdmin.ts`
- `src/pages/private/admin/settings/security/Security.tsx`

### Observações
- No SQL Editor do Supabase, chamadas diretas podem falhar com “Usuário não autenticado” porque `auth.uid()` é nulo.
- A função deve respeitar `show_in_permission_ui=true`.
- Novas permissões precisam existir nos catálogos e em `store_role_permission_templates` para aparecerem corretamente.

---

## 1.2 `bulk_update_store_role_permissions_v3`

### Objetivo
Atualiza permissões por papel em lote.

### Parâmetros esperados
- `p_store_id uuid`
- payload JSONB ou estrutura equivalente com permissões alteradas
- motivo ou contexto quando disponível

### Retorno
Resultado de sucesso/falha e dados suficientes para atualizar o estado da matriz.

### Permissões
Deve exigir:

- `owner` ou `security.roles.manage`;
- usuário autenticado;
- vínculo ativo com a loja.

### Onde é usada
- Aba **Permissões por papel** em `/admin/security?tab=roles`.

### Efeitos colaterais obrigatórios
- Registrar auditoria em `store_security_logs`.
- Atualizar `store_permission_versions` para acionar realtime.

### Observações
- O histórico de atividades deve exibir mensagens amigáveis, como “Permissões por papel atualizadas”.
- Bulk updates podem tocar várias linhas; a versão central evita múltiplos listeners diretos no frontend.

---

## 1.3 `get_effective_store_member_permissions_v2`

### Objetivo
Retorna as permissões efetivas de um membro específico da loja.

### Parâmetros
- `p_store_id uuid`
- `p_member_id uuid`

### Retorno
Lista de permissões resolvidas, normalmente com:

- `permission_code`
- `role_allowed`
- `custom_role_override`
- `individual_override`
- `effective_allowed`
- `source`

### Hierarquia aplicada
1. Permissão individual em `store_members.permissions`.
2. Função personalizada em `store_custom_roles.permissions`.
3. Papel base em `store_role_permission_templates`.
4. Fallback seguro `false`.

### Permissões
Deve exigir autenticação e checagem de acesso ao contexto da loja.

### Onde é usada
- `usePermissions`
- área de permissões individuais;
- contexto de segurança;
- telas que precisam recalcular permissões após alteração.

### Observações
- A tabela `store_member_permissions` não é usada no modelo atual; overrides individuais ficam em `store_members.permissions`.
- Deve ser mantida compatível com realtime silencioso.

---

## 1.4 `update_store_member_permissions`

### Objetivo
Atualiza permissões individuais e ações sensíveis de um membro.

### Parâmetros
- `p_member_id uuid`
- `p_permissions jsonb`
- `p_sensitive_actions jsonb`
- `p_reason text`

### Permissões
Deve exigir:

- `owner` ou `security.user_permissions.manage`;
- usuário autenticado;
- vínculo ativo com a loja.

### Regras
- Não permitir alterar permissões individuais de `owner`.
- Não permitir que o usuário altere suas próprias permissões administrativas.
- Validar JSONB como objeto.

### Efeitos colaterais
- Registrar antes/depois em `store_security_logs`.
- Atualizar `store_permission_versions`.

### Onde é usada
- `/admin/security?tab=user_permissions`

---

## 1.5 `list_store_custom_roles`

### Objetivo
Lista funções personalizadas da loja.

### Parâmetros
- `p_store_id uuid`

### Retorno
Lista de funções personalizadas, incluindo:

- id;
- nome;
- descrição;
- papel base;
- permissões;
- status ativo/inativo;
- metadados de criação/alteração.

### Permissões
- `owner` ou `security.custom_roles.view`.

### Onde é usada
- `/admin/security?tab=custom_roles`
- seleção de função personalizada no modal de usuários.

---

## 1.6 `create_store_custom_role`

### Objetivo
Cria função personalizada para uma loja.

### Parâmetros esperados
- `p_store_id uuid`
- nome;
- descrição opcional;
- `base_role`;
- `permissions jsonb`

### Permissões
- `owner` ou `security.custom_roles.manage`.

### Efeitos colaterais
- Registrar auditoria.
- Atualizar `store_permission_versions`.

---

## 1.7 `update_store_custom_role`

### Objetivo
Atualiza uma função personalizada existente.

### Permissões
- `owner` ou `security.custom_roles.manage`.

### Efeitos colaterais
- Registrar auditoria.
- Atualizar `store_permission_versions`.
- Usuários vinculados devem receber atualização em tempo real.

### Pendência futura
Ao inativar função com usuários vinculados, exibir fluxo de migração/alerta.

---

## 1.8 `assign_store_custom_role_to_member`

### Objetivo
Atribui função personalizada a um membro da loja.

### Parâmetros esperados
- membro;
- função personalizada;
- loja;
- motivo/contexto quando disponível.

### Permissões
- `owner` ou `users.manage`/permissão administrativa equivalente.

### Efeitos colaterais
- Atualizar `store_members.custom_role_id`.
- Registrar auditoria.
- Atualizar `store_permission_versions`.

---

## 1.9 `add_store_member_by_email`

### Objetivo
Adiciona um usuário/membro à loja por e-mail.

### Permissões
- `owner` ou `users.manage`.

### Observações
Foi ajustada para não depender apenas de `owner`, permitindo administração por permissão granular.

---

## 1.10 `get_current_user_security_context_v2`

### Objetivo
Retorna o contexto atual do usuário logado na loja ativa.

### Retorno esperado
- usuário;
- loja atual;
- papel atual;
- status;
- PIN/configuração pessoal;
- ações sensíveis;
- vínculos e lojas relacionadas;
- indicadores administrativos.

### Onde é usada
- `/admin/security?tab=context`
- `PrivateLayout`
- telas de contexto do usuário.

### Observações
O campo “É proprietário?” deve se referir ao vínculo na loja atual, não a qualquer loja do Supabase.

`Global admin` é reservado para futura área de superusuário/plataforma e atualmente permanece como “Não” nos usuários comuns.

---

## 1.11 `get_my_visible_activity_logs`

### Objetivo
Retorna registros visíveis para o Meu Histórico do usuário logado.

### Parâmetros
- `p_store_id uuid`
- `p_start_date date`
- `p_end_date date`
- `p_action text`
- `p_outcome text`

### Retorno
Eventos visíveis conforme o usuário e suas permissões.

### Onde é usada
- `/admin/my-history`

### Pendência
Ainda deve incluir, de forma amigável:

- alteração de função/papel;
- função anterior;
- nova função;
- responsável;
- motivo;
- solicitações cadastrais e andamento.

---

## 1.12 `touch_store_permission_version`

### Objetivo
Atualiza a versão de permissões da loja para acionar sincronização em tempo real.

### Entrada típica
- `store_id`
- `reason`
- `changed_by`

### Onde é usada
- Triggers em tabelas de permissões.
- RPCs de escrita de permissões.

### Observações
A tabela central `store_permission_versions` é o canal único escutado pelo frontend para atualizar permissões.

---

# 2. Configurações e Loja

## 2.1 `can_access_settings_section_v3`

### Objetivo
Verifica se o usuário pode acessar ou gerenciar uma seção de Configurações.

### Parâmetros
- `p_store_id uuid`
- `p_section text`
- `p_manage boolean`

### Permissões
Deve resolver permissões como:

- `settings.view`
- `settings.store.view/manage`
- `settings.commercial.view/manage`
- `settings.orders.view/manage`
- `settings.hours.view/manage`
- `settings.stock.view/manage`
- `settings.delivery.view/manage`
- `settings.payment.view/manage`
- `settings.legal.view/manage`
- `settings.system.view/manage`
- `messages.view/manage`

### Observações
A UI atual centralizou Configurações na Opção B: um único item de menu “Configurações da Loja” com abas internas.

---

## 2.2 `can_access_security_section_v3`

### Objetivo
Verifica acesso às seções da área Segurança.

### Parâmetros
- `p_store_id uuid`
- `p_section text`
- `p_manage boolean`

### Regra especial
`security.view` é porteira absoluta. Sem ela, nenhuma aba de Segurança deve ser acessível, mesmo que permissões específicas estejam `true`.

---

# 3. Clientes e loja pública

## 3.1 `get_admin_customers_safe`

### Objetivo
Retorna clientes para o painel administrativo, preservando dados protegidos quando necessário.

### Permissões
- `owner` ou `customers.view` ou `customers.manage`.

---

## 3.2 `create_admin_customer_safe`

### Objetivo
Cria cliente pela administração.

### Permissões
- `owner` ou `customers.manage`.

---

## 3.3 `update_admin_customer_safe`

### Objetivo
Atualiza cliente pela administração respeitando propriedade dos dados.

### Permissões
- `owner` ou `customers.manage`.

### Regra
Dados controlados pelo cliente não devem ser sobrescritos indevidamente pela loja.

---

## 3.4 `get_customer_360_safe`

### Objetivo
Retorna visão 360º segura do cliente.

### Permissões
- `owner` ou `customers.view` ou `customers.manage`.

---

# 4. Fornecedor 360º

## 4.1 `get_supplier_360_summary`

**Objetivo:** retorna o resumo gerencial do fornecedor.

## 4.2 `get_supplier_purchase_history`

**Objetivo:** retorna histórico de compras do fornecedor, usando `document_code` como referência operacional.

## 4.3 `get_supplier_supplied_products`

**Objetivo:** retorna produtos fornecidos, volumes, custos e última compra.

## 4.4 `get_supplier_price_evolution`

**Objetivo:** retorna evolução de custos por produto e documento.

## 4.5 `get_supplier_contacts`

**Objetivo:** retorna contatos consolidados do fornecedor, unindo `supplier_contacts` e contatos do cadastro principal.

## 4.6 `get_supplier_relationship_timeline`

**Objetivo:** retorna eventos manuais de relacionamento.

## 4.7 `get_supplier_quotation_history`

**Objetivo:** retorna histórico de cotações vinculadas ao fornecedor.

## 4.8 `get_supplier_unified_timeline`

**Objetivo:** retorna linha do tempo unificada, combinando eventos manuais e eventos operacionais.

## 4.9 `create_supplier_contact`

**Objetivo:** cria contato estruturado do fornecedor.

## 4.10 `create_supplier_relationship_event`

**Objetivo:** cria evento manual de relacionamento.

## 4.11 `update_supplier_operational_status`

**Objetivo:** atualiza status operacional do fornecedor, incluindo bloqueio, desbloqueio, aprovação e rejeição.

---

# 5. Itens ainda prioritários para documentar em detalhes

- `apply_stock_movement_delta`
- funções de confirmação/cancelamento de compra;
- views de histórico e posição de estoque;
- views/queries de transferências;
- RPCs de Pedido Online;
- RPCs de Loja Pública;
- RPCs de OTP e cliente público;
- funções listadas nos Advisors do Supabase.
