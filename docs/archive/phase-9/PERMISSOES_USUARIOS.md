# Permissões de Usuários — Referência Atual

Este documento registra o estado atual do sistema de permissões do OptmaMenu após a consolidação da frente 9.13 e complementos funcionais 9.13.1G/9.13.1H.

Documentos relacionados:

- `docs/FASE_9_USUARIOS_GOVERNANCA.md`
- `docs/FASE_9_13_PERMISSOES_SEGURANCA.md`
- `docs/FASE_9_13_1G_HISTORICO_PESSOAL.md`
- `docs/FASE_9_13_1H_PEDIDO_ONLINE_CONFIGURACOES.md`
- `docs/GUIA_SISTEMA_PERMISSOES_REALTIME.md`
- `docs/RPCS_AND_VIEWS.md`

---

## 1. Papéis nativos

| Papel | Valor | Observação |
|---|---|---|
| Proprietário | `owner` | Acesso integral; ignora checagens comuns |
| Admin | `admin` | Acesso administrativo conforme permissões |
| Gerente | `manager` | Gestão operacional conforme permissões |
| Estoque | `stock_operator` | Operação de estoque |
| Caixa | `cashier` | Operação financeira/caixa |
| Vendas | `sales` | Operação comercial |
| Equipe | `staff` | Colaborador geral |
| Visualizador | `viewer` | Leitura quando liberado |

---

## 2. Hierarquia de permissões

A resolução efetiva segue esta ordem:

1. Permissão individual em `store_members.permissions`.
2. Função personalizada em `store_custom_roles.permissions`.
3. Papel base em `store_role_permission_templates`.
4. Fallback seguro `false`.
5. `owner` tem acesso total.

> O modelo atual não usa `store_member_permissions`; overrides individuais são JSONB em `store_members.permissions`.

---

## 3. Regras visuais

### `view=false`

- menu oculto;
- aba oculta;
- rota protegida;
- acesso direto redireciona para `/admin/my-profile` ou primeira aba permitida, conforme contexto.

### `view=true` + `manage=false`

- tela abre em modo leitura;
- inputs/selects/switches desabilitados;
- botões de ação ocultos;
- sem falso salvamento;
- sem toast desnecessário;
- sem erro de console.

Componente padrão:

- `src/components/security/PermissionLocked.tsx`

---

## 4. Dashboard e Relatórios

| Código | Significado |
|---|---|
| `dashboard.view` | Acessar painel operacional `/admin` |
| `dashboard.activity.view` | Ver atividades recentes |
| `dashboard.alerts.view` | Ver alertas |
| `reports.view` | Ver relatórios |
| `reports.export` | Gerar/exportar relatórios |

---

## 5. Comercial

| Código | Significado |
|---|---|
| `commercial.view` | Acessar grupo Comercial |
| `commercial.dashboard.view` | Acessar Dashboard Comercial |
| `commercial.sales_channels.view` | Visualizar Canais de Venda |
| `commercial.sales_channels.manage` | Gerenciar Canais de Venda |
| `orders.view` | Visualizar pedidos |
| `orders.manage` | Gerenciar pedidos |
| `orders.cancel` | Cancelar pedidos |
| `customers.view` | Visualizar clientes |
| `customers.manage` | Gerenciar clientes |
| `messages.view` | Visualizar mensagens/central |
| `messages.manage` | Gerenciar mensagens/configurações de mensagens |
| `marketing.view` | Visualizar Marketing |
| `marketing.manage` | Gerenciar Marketing |
| `loyalty.view` | Visualizar Fidelidade |
| `loyalty.manage` | Gerenciar Fidelidade |

---

## 6. Financeiro

| Código | Significado |
|---|---|
| `financial.view` | Acessar grupo Financeiro |
| `cashbook.view` | Visualizar Livro Diário |
| `cashbook.create` | Criar entradas/saídas |
| `cashbook.cancel` | Cancelar lançamentos |

Pendente futuro:

- `cashbook.export` para relatórios/PDF próprios do livro diário.

---

## 7. Produtos, Estoque, Compras e Fornecedores

| Código | Significado |
|---|---|
| `products.view` | Visualizar Produtos |
| `products.manage` | Criar/editar produtos |
| `categories.view` | Visualizar Categorias |
| `categories.manage` | Gerenciar Categorias |
| `stock.view` | Visualizar Estoque, Inventário e Movimentações |
| `stock.adjust` | Registrar ajuste de estoque |
| `stock.manage` | Reservado para gestão ampla/regras de estoque quando aplicável |
| `transfers.view` | Visualizar Transferências |
| `transfers.create` | Criar Transferências |
| `transfers.confirm` | Enviar/receber/confirmar Transferências |
| `transfers.cancel` | Cancelar Transferências |
| `purchases.view` | Visualizar Compras/Cotações |
| `purchases.create` | Criar Compras |
| `purchases.confirm` | Confirmar/aplicar Compra ao estoque |
| `purchases.cancel` | Cancelar Compra |
| `suppliers.view` | Visualizar Fornecedores |
| `suppliers.manage` | Gerenciar Fornecedores e ações de lifecycle |

Pendências futuras:

- `products.life.view`
- `quotations.view/manage`
- `stock.export`
- permissões sensíveis específicas para fornecedores.

---

## 8. Usuários e Equipe

| Código | Significado |
|---|---|
| `users.view` | Visualizar usuários |
| `users.manage` | Criar/editar usuários e vínculos |
| `users.owner.view` | Visualizar owners quando aplicável |
| `users.sensitive.view` | Ver dados sensíveis de usuários |
| `users.sensitive.manage` | Gerenciar dados sensíveis |
| `users.additional_info.view` | Ver informações adicionais |
| `users.additional_info.manage` | Gerenciar informações adicionais |
| `users.additional_info_sensitive.view` | Ver informações adicionais sensíveis |
| `users.additional_info_sensitive.manage` | Gerenciar informações adicionais sensíveis |
| `users.profile_requests.view` | Ver solicitações cadastrais |
| `users.profile_requests.review` | Analisar solicitações cadastrais |
| `users.profile_requests.manage` | Gerenciar/aplicar solicitações cadastrais |

Todos os usuários autenticados devem acessar:

- `/admin/my-profile`
- `/admin/my-history`

### Histórico pessoal e solicitações cadastrais

Concluído funcionalmente na frente `9.13.1G`:

- alteração de papel/função aparece no Meu Histórico do usuário afetado;
- função anterior, nova função, responsável e motivo são exibidos de forma amigável quando disponíveis;
- atribuição/remoção de função personalizada também é registrada como evento pessoal;
- solicitações cadastrais do próprio usuário aparecem no Meu Histórico e em Meus Dados;
- dados sensíveis seguem protegidos conforme permissões e fluxo de revisão.

---

## 9. Segurança

`security.view` é porteira absoluta.

| Código | Significado |
|---|---|
| `security.view` | Acessar módulo Segurança/Senhas e Acesso |
| `security.context.view` | Ver Contexto de acesso |
| `security.logs.view` | Ver Histórico de atividades |
| `security.roles.view` | Ver Permissões por papel |
| `security.roles.manage` | Gerenciar Permissões por papel |
| `security.custom_roles.view` | Ver Funções personalizadas |
| `security.custom_roles.manage` | Gerenciar Funções personalizadas |
| `security.user_permissions.view` | Ver Permissões por usuário |
| `security.user_permissions.manage` | Gerenciar Permissões por usuário |
| `security.sensitive_actions.view` | Ver Ações sensíveis |
| `security.sensitive_actions.manage` | Gerenciar Ações sensíveis |
| `security.pin_token.view` | Ver PIN e Token |
| `security.pin_token.manage` | Gerenciar PIN e Token |
| `security.sessions.view` | Ver Sessões e inatividade |
| `security.sessions.manage` | Gerenciar Sessões e inatividade |

`security.manage` existe por compatibilidade/catalogação, mas fica oculto na matriz (`show_in_permission_ui=false`) e não deve ser usado para liberar abas.

---

## 10. Configurações

`settings.view` é porteira do conjunto **Configurações da Loja**.

A estratégia final é a **Opção B**: um único item no sidebar e abas internas em `/admin/settings`.

| Código | Aba/uso |
|---|---|
| `settings.view` | Acessar Configurações da Loja |
| `settings.store.view` | Ver Dados da Loja |
| `settings.store.manage` | Gerenciar Dados da Loja |
| `settings.commercial.view` | Ver Configurações Comerciais |
| `settings.commercial.manage` | Gerenciar Configurações Comerciais |
| `settings.orders.view` | Ver Pedido Online |
| `settings.orders.manage` | Gerenciar Pedido Online |
| `settings.appearance.view` | Ver Aparência da Loja |
| `settings.appearance.manage` | Gerenciar Aparência da Loja |
| `settings.hours.view` | Ver Horários |
| `settings.hours.manage` | Gerenciar Horários |
| `settings.stock.view` | Ver Configurações de Estoque |
| `settings.stock.manage` | Gerenciar Configurações de Estoque |
| `settings.delivery.view` | Ver Entrega |
| `settings.delivery.manage` | Gerenciar Entrega |
| `settings.payment.view` | Ver Pagamento |
| `settings.payment.manage` | Gerenciar Pagamento |
| `messages.view` | Ver Configurações/Mensagens |
| `messages.manage` | Gerenciar Configurações/Mensagens |
| `settings.legal.view` | Ver Documentos e Termos |
| `settings.legal.manage` | Gerenciar Documentos e Termos |
| `settings.system.view` | Ver Sistema |
| `settings.system.manage` | Gerenciar Sistema |

### Estado das abas recentes

- Pedido Online foi concluído funcionalmente na frente `9.13.1H`.
- Aparência da Loja foi separada em aba própria e concluída funcionalmente na frente `9.13.1H`.

---

## 11. Permissões novas/refinadas na 9.13

- `commercial.dashboard.view`
- `commercial.sales_channels.view`
- `commercial.sales_channels.manage`
- `settings.hours.view`
- `settings.hours.manage`
- `settings.appearance.view`
- `settings.appearance.manage`

---

## 12. Realtime

Permissões em tempo real usam:

- `store_permission_versions`
- `usePermissions`
- `permissionEvents`

O frontend não deve manter listeners diretos duplicados nas tabelas de templates, funções ou membros para permissões.

---

## 13. Pendências

Pendências funcionais/documentais remanescentes:

- Configurações reais de Mensagens.
- Hardening final dos Advisors/RLS.
- Documentação fina de RPCs conforme validação localizada no banco/snapshot Supabase.
- Fluxo futuro de migração ao inativar função personalizada com usuários vinculados.

Itens já concluídos e removidos da lista de pendências:

- Histórico pessoal de alteração de função — fechado na `9.13.1G`.
- Histórico pessoal de solicitações cadastrais — fechado na `9.13.1G`.
- Pedido Online como configuração funcional completa — fechado na `9.13.1H`.
- Aparência da Loja — fechado na `9.13.1H`.
