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
Atribui, troca ou remove função personalizada de um membro da loja.

### Parâmetros esperados
- membro;
- função personalizada, ou `null` para remoção;
- loja inferida pelo vínculo do membro;
- motivo/contexto quando disponível;
- indicador para limpar overrides individuais;
- indicador para criação de ocorrência pessoal.

### Permissões
- `owner` ou `users.manage`/permissão administrativa equivalente.

### Efeitos colaterais
- Atualizar `store_members.custom_role_id`.
- Registrar auditoria em `store_security_logs`.
- Atualizar `store_permission_versions`.
- Quando solicitado pelo frontend, criar ocorrência pessoal visível em `store_member_occurrences` com `occurrence_type='role_change'`.
- Permitir que o usuário afetado veja a alteração em `/admin/my-history`.

### Onde é usada
- `src/hooks/security/useStoreCustomRoles.ts`
- modal/tela de usuários ao atribuir ou remover função personalizada.

---

## 1.9 `change_store_member_role`

### Objetivo
Altera o papel base de um membro da loja por meio de RPC dedicada, evitando update direto em `store_members.role` pelo frontend.

### Parâmetros esperados
- `p_member_id uuid`
- `p_new_role text`
- `p_reason text`
- `p_clear_individual_overrides boolean`
- `p_create_occurrence boolean`

### Permissões
- `owner` ou `users.manage`/permissão administrativa equivalente.

### Efeitos colaterais
- Atualizar `store_members.role`.
- Registrar auditoria em `store_security_logs`.
- Atualizar versão/caches de permissões quando aplicável.
- Quando `p_create_occurrence=true`, criar ocorrência pessoal visível para o membro afetado.
- Preservar dados necessários para exibição amigável no Meu Histórico, como função anterior, nova função, responsável e motivo, quando disponíveis no backend.

### Onde é usada
- `src/store/useUsersStore.ts`
- `src/pages/private/admin/users/Users.tsx`

### Observações
- A 9.13.1G consolidou este fluxo como base para alteração de função/papel no Meu Histórico.
- A conferência fina do corpo SQL deve ser feita no snapshot `docs/supabase_audit/schema_public_current.sql` ou no SQL Editor do Supabase quando necessário.

---

## 1.10 `add_store_member_by_email`

### Objetivo
Adiciona um usuário/membro à loja por e-mail.

### Permissões
- `owner` ou `users.manage`.

### Observações
Foi ajustada para não depender apenas de `owner`, permitindo administração por permissão granular.

---

## 1.11 `get_current_user_security_context_v2`

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

## 1.12 `get_my_visible_activity_logs`

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

Após a 9.13.1G, o retorno esperado inclui, de forma amigável:

- eventos pessoais de sessão e segurança;
- eventos em que o usuário logado é o alvo/afetado;
- ocorrências visíveis de `store_member_occurrences`;
- alteração de função/papel;
- função anterior;
- nova função;
- função personalizada atribuída/removida;
- responsável;
- motivo;
- solicitações cadastrais do próprio usuário;
- andamento de solicitações cadastrais.

### Onde é usada
- `/admin/my-history`
- `src/services/myHistoryService.ts`
- `src/pages/private/admin/settings/myHistory/MyHistory.tsx`

### Observações
- Esta pendência foi fechada funcionalmente na frente `9.13.1G`, documentada em `docs/FASE_9_13_1G_HISTORICO_PESSOAL.md`.
- O Meu Histórico não deve virar auditoria operacional ampla; ações de vendas, compras, produtos, estoque e financeiro ficam para auditoria operacional futura, salvo quando forem eventos pessoais/visíveis do colaborador.
- Dados sensíveis devem continuar filtrados no backend e renderizados somente quando apropriado.
- O snapshot `docs/supabase_audit/schema_public_current.sql` contém o schema público atual. Por ser grande, a conferência automatizada do corpo desta RPC pode exigir validação localizada no SQL Editor do Supabase ou busca manual no snapshot.

---

## 1.13 RPCs de solicitações cadastrais pessoais

### RPCs envolvidas

- `create_my_profile_change_request_v2`
- `list_my_profile_change_requests`
- `list_store_profile_change_requests`
- `review_store_profile_change_request`
- `propose_store_profile_change_request`
- `respond_my_profile_change_request`
- `cancel_my_profile_change_request`

### Objetivo
Controlar o ciclo de solicitações cadastrais de colaboradores, separando:

- solicitações criadas pelo próprio usuário;
- solicitações propostas pela administração;
- revisão/aprovação/rejeição;
- pedido de correção;
- confirmação do membro;
- cancelamento;
- aplicação das alterações aprovadas.

### Onde são usadas
- `src/services/securityService.ts`
- `/admin/my-profile`
- componentes de Meus Dados;
- tela de Usuários para análise administrativa.

### Observações
- O andamento das solicitações do próprio usuário deve aparecer no Meu Histórico.
- Informações sensíveis devem respeitar permissões específicas de usuários e dados sensíveis.
- O fluxo foi concluído funcionalmente na 9.13.1G.

---

## 1.14 `touch_store_permission_version`

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
- `settings.appearance.view/manage`
- `settings.hours.view/manage`
- `settings.stock.view/manage`
- `settings.delivery.view/manage`
- `settings.payment.view/manage`
- `settings.legal.view/manage`
- `settings.system.view/manage`

### Onde é usada
- `src/components/RequirePermission.tsx`
- rotas/abas de `/admin/settings`

---

## 2.2 `can_access_security_section_v3`

### Objetivo
Verifica acesso a uma seção de Segurança.

### Regra central
`security.view` é porteira absoluta antes de qualquer aba específica.

### Permissões por seção
- `security.context.view/manage`
- `security.logs.view/manage`
- `security.roles.view/manage`
- `security.custom_roles.view/manage`
- `security.user_permissions.view/manage`
- `security.sensitive_actions.view/manage`
- `security.pin_token.view/manage`
- `security.sessions.view/manage`

### Onde é usada
- `/admin/security`
- proteção de abas internas da área Segurança.

---

# 3. PDV

## 3.1 `get_pos_bootstrap`

### Objetivo

Retorna, em uma única chamada autenticada, o contexto reduzido necessário para
abrir o PDV dedicado.

### Parâmetros

- `p_store_id uuid`
- `p_location_id uuid default null`

### Permissão

- proprietário da loja; ou
- `pdv.view`.

Também exige vínculo ativo em `store_members`.

### Retorno

Objeto JSON com:

- loja;
- operador;
- locais ativos com `allow_sales=true`;
- local selecionado;
- categorias ativas;
- produtos ativos;
- códigos ativos de produto;
- estoque disponível por local.

O estoque disponível é calculado por:

```text
greatest(on_hand - reserved, 0)
```

### Segurança

A RPC evita conceder `products.view` ao operador somente-PDV e não retorna custo
ou campos administrativos do produto.

### Onde é usada

- `src/services/pdvService.ts`
- `/admin/pdv`

### Efeitos relacionados

- `inventory_location_balances` participa do Realtime do PDV;
- `product_codes` possui RLS própria e não é acessível por `anon`.

---

# 4. Controle de atualização deste documento

Sempre que uma RPC for criada ou alterada:

1. Atualizar este arquivo.
2. Indicar onde ela é usada no frontend.
3. Registrar efeitos colaterais, especialmente logs e realtime.
4. Conferir `docs/ADVISORS.md`.
5. Não misturar documentação funcional com rodada de hardening Advisors/RLS.


## Correção PDV — 2026-07-24

### `create_admin_direct_sale_order_safe`

- aceita operador com `pdv.sell` quando o canal é `in_person`;
- continua recalculando preços no backend;
- exige `pdv.discount.apply` para descontos de operador do PDV;
- propaga a exceção de estoque somente para owner ou usuário autorizado no PDV;
- registra `pdv_stock_exception` em `audit_logs`.

### `create_admin_direct_sale_order_legacy_internal`

- quando a exceção foi validada pela função pública segura, permite concluir a
  venda acima do disponível;
- o saldo físico é limitado a zero;
- a diferença fica registrada para reconciliação, sem saldo negativo silencioso.

### `quote_pos_cart_safe`

- Parâmetros: `p_store_id uuid`, `p_items jsonb`.
- Retorna a mesma estrutura de `calculate_store_cart_pricing`, incluindo preço-base,
  preço unitário aplicado, origem da regra, faixa, subtotal-base, desconto e total.
- Exige autenticação, vínculo ativo em `store_members` e `pdv.view` ou proprietário.
- É usada pelo carrinho do PDV para mostrar a mesma precificação aplicada na slug
  antes do pagamento e do cálculo de troco.
- `calculate_store_cart_pricing` permanece como motor interno, sem execução direta
  por `public`, `anon` ou `authenticated`.
