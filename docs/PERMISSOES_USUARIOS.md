# Permissões de Usuários - Referência Completa

> Este documento lista todas as permissões configuráveis do sistema, seus significados e as templates de permissões por perfil.

---

## 1. Papéis (Roles) do Sistema

O sistema possui **8 papéis built-in**, definidos em `src/types/security.ts`:

| Papel | Valor | Descrição |
|---|---|---|---|
| Proprietário | `owner` | Acesso total (ignora todas verificações de permissão) |
| Admin | `admin` | Acesso administrativo |
| Gerente | `manager` | Gerente/supervisor |
| Estoque | `stock_operator` | Operador de estoque/inventário |
| Caixa | `cashier` | Operador de caixa |
| Vendas | `sales` | Equipe de vendas |
| Equipe | `staff` | Membro geral da equipe |
| Visualizador | `viewer` | Acesso somente leitura |

---

## 2. Módulos e Permissões

### 2.1 Dashboard

| Código | Descrição | Ação |
|---|---|---|
| `dashboard.view` | Painel - Ver | Visualizar o painel de controle |

### 2.2 Relatórios

| Código | Descrição | Ação |
|---|---|---|
| `reports.view` | Relatórios - Ver | Visualizar relatórios do sistema |

### 2.3 Produtos

| Código | Descrição | Ação |
|---|---|---|
| `products.view` | Produtos - Ver | Listar e visualizar produtos |
| `products.create` | Produtos - Criar | Criar novos produtos |
| `products.update` | Produtos - Editar | Alterar dados de produtos existentes |
| `products.delete` | Produtos - Excluir | Excluir produtos do catálogo |

### 2.4 Estoque

| Código | Descrição | Ação |
|---|---|---|
| `stock.view` | Estoque - Ver | Visualizar níveis de estoque |
| `stock.transfer` | Estoque - Transferir | Transferir estoque entre locais/filiais |
| `stock.adjust` | Estoque - Ajustar | Realizar ajustes manuais de estoque |

### 2.5 Compras

| Código | Descrição | Ação |
|---|---|---|
| `purchases.view` | Compras - Ver | Visualizar pedidos de compra |
| `purchases.create` | Compras - Criar | Criar novos pedidos de compra |
| `purchases.confirm` | Compras - Confirmar | Confirmar recebimento de compras |
| `purchases.cancel` | Compras - Cancelar | Cancelar pedidos de compra |

### 2.6 Fornecedores

| Código | Descrição | Ação |
|---|---|---|
| `suppliers.view` | Fornecedores - Ver | Listar e visualizar fornecedores |
| `suppliers.manage` | Fornecedores - Gerenciar | Criar, editar e remover fornecedores |

### 2.7 Pedidos (Vendas)

| Código | Descrição | Ação |
|---|---|---|
| `orders.view` | Pedidos - Ver | Visualizar pedidos de clientes |
| `orders.manage` | Pedidos - Gerenciar | Gerenciar status e detalhes de pedidos |
| `orders.cancel` | Pedidos - Cancelar | Cancelar pedidos de clientes |

### 2.8 Livro Diário (Cashbook)

| Código | Descrição | Ação |
|---|---|---|
| `cashbook.view` | Livro Diário - Ver | Visualizar lançamentos financeiros diários |
| `cashbook.create` | Livro Diário - Criar | Criar novos lançamentos no livro diário |
| `cashbook.cancel` | Livro Diário - Cancelar | Cancelar lançamentos do livro diário |

### 2.9 Clientes

| Código | Descrição | Ação |
|---|---|---|
| `customers.view` | Clientes - Ver | Visualizar lista de clientes |
| `clients.view` | Clientes - Ver | Visualizar lista de clientes (alias) |
| `clients.manage` | Clientes - Gerenciar | Criar, editar e remover cadastros de clientes |

### 2.10 Marketing

| Código | Descrição | Ação |
|---|---|---|
| `marketing.view` | Marketing - Ver | Visualizar campanhas e promoções |
| `marketing.manage` | Marketing - Gerenciar | Criar e gerenciar campanhas de marketing |

### 2.11 Fidelidade

| Código | Descrição | Ação |
|---|---|---|
| `loyalty.view` | Fidelidade - Ver | Visualizar programa de fidelidade |
| `loyalty.manage` | Fidelidade - Gerenciar | Gerenciar regras e pontos do programa de fidelidade |

### 2.12 Usuários

| Código | Descrição | Ação |
|---|---|---|
| `users.view` | Usuários - Ver | Visualizar lista de usuários |
| `users.manage` | Usuários - Gerenciar | Criar, editar e remover usuários |
| `users.sensitive.view` | Usuários - Ver dados sensíveis | Visualizar dados sensíveis de usuários (CPF, salário, etc.) |
| `users.sensitive.manage` | Usuários - Gerenciar dados sensíveis | Alterar dados sensíveis de usuários |
| `users.additional_info.view` | Usuários - Ver informações adicionais | Visualizar informações adicionais dos usuários |
| `users.additional_info.manage` | Usuários - Gerenciar informações adicionais | Editar informações adicionais dos usuários |
| `users.additional_info_sensitive.view` | Usuários - Ver informações adicionais sensíveis | Visualizar informações adicionais sensíveis |
| `users.additional_info_sensitive.manage` | Usuários - Gerenciar informações adicionais sensíveis | Editar informações adicionais sensíveis |
| `users.profile_requests.view` | Usuários - Ver solicitações cadastrais | Visualizar solicitações de alteração de cadastro |
| `users.profile_requests.review` | Usuários - Analisar solicitações cadastrais | Analisar solicitações de alteração de cadastro |
| `users.profile_requests.manage` | Usuários - Gerenciar solicitações cadastrais | Aprovar/rejeitar solicitações de alteração de cadastro |

### 2.13 Segurança

| Código | Descrição | Ação |
|---|---|---|
| `security.view` | Segurança - Ver | Visualizar configurações de segurança |
| `security.manage` | Segurança - Gerenciar | Gerenciar configurações de segurança |
| `security.context.view` | Segurança - Ver contexto | Visualizar contexto de segurança |
| `security.context.manage` | Segurança - Gerenciar contexto | Gerenciar contexto de segurança |
| `security.logs.view` | Segurança - Ver logs | Visualizar logs de auditoria |
| `security.logs.manage` | Segurança - Gerenciar logs | Gerenciar logs de auditoria |
| `security.roles.view` | Segurança - Ver papéis | Visualizar papéis do sistema |
| `security.roles.manage` | Segurança - Gerenciar papéis | Gerenciar papéis e suas permissões |
| `security.custom_roles.view` | Segurança - Ver papéis personalizados | Visualizar papéis personalizados |
| `security.custom_roles.manage` | Segurança - Gerenciar papéis personalizados | Criar, editar e remover papéis personalizados |
| `security.user_permissions.view` | Segurança - Ver permissões de usuários | Visualizar permissões individuais de usuários |
| `security.user_permissions.manage` | Segurança - Gerenciar permissões de usuários | Alterar permissões individuais de usuários |
| `security.sensitive_actions.view` | Segurança - Ver ações sensíveis | Visualizar regras de ações sensíveis |
| `security.sensitive_actions.manage` | Segurança - Gerenciar ações sensíveis | Gerenciar regras de ações sensíveis |
| `security.pin_token.view` | Segurança - Ver PIN e token | Visualizar configurações de PIN e token |
| `security.pin_token.manage` | Segurança - Gerenciar PIN e token | Gerenciar configurações de PIN e token |
| `security.sessions.view` | Segurança - Ver sessões e inatividade | Visualizar sessões ativas e políticas de inatividade |
| `security.sessions.manage` | Segurança - Gerenciar sessões e inatividade | Gerenciar sessões e políticas de inatividade |

### 2.14 Configurações

| Código | Descrição | Ação |
|---|---|---|
| `settings.view` | Configurações - Ver dados da loja | Visualizar dados gerais da loja *(não deve ser usada para liberar rotas/abas sensíveis)* |
| `settings.manage` | Configurações - Gerenciar dados da loja | Alterar dados gerais da loja |
| `settings.store.view` | Configurações da Loja - Ver | Visualizar configurações da loja |
| `settings.store.manage` | Configurações da Loja - Gerenciar | Alterar configurações da loja |
| `settings.commercial.view` | Configurações Comerciais - Ver | Visualizar configurações comerciais |
| `settings.commercial.manage` | Configurações Comerciais - Gerenciar | Alterar configurações comerciais |
| `settings.orders.view` | Configurações de Pedidos - Ver | Visualizar configurações de pedidos |
| `settings.orders.manage` | Configurações de Pedidos - Gerenciar | Alterar configurações de pedidos |
| `settings.stock.view` | Configurações de Estoque - Ver | Visualizar configurações de estoque |
| `settings.stock.manage` | Configurações de Estoque - Gerenciar | Alterar configurações de estoque |
| `settings.delivery.view` | Configurações de Entrega - Ver | Visualizar configurações de entrega |
| `settings.delivery.manage` | Configurações de Entrega - Gerenciar | Alterar configurações de entrega |
| `settings.payment.view` | Configurações de Pagamento - Ver | Visualizar configurações de pagamento |
| `settings.payment.manage` | Configurações de Pagamento - Gerenciar | Alterar configurações de pagamento |
| `settings.legal.view` | Documentos Legais - Ver | Visualizar documentos legais |
| `settings.legal.manage` | Documentos Legais - Gerenciar | Editar documentos legais |
| `settings.system.view` | Sistema - Ver | Visualizar configurações do sistema |
| `settings.system.manage` | Sistema - Gerenciar | Alterar configurações do sistema |

---

## 3. Resumo por Módulo

| Módulo | Permissões | Total |
|---|---|---|
| Dashboard | view | 1 |
| Relatórios | view | 1 |
| Produtos | view, create, update, delete | 4 |
| Estoque | view, transfer, adjust | 3 |
| Compras | view, create, confirm, cancel | 4 |
| Fornecedores | view, manage | 2 |
| Pedidos | view, manage, cancel | 3 |
| Livro Diário | view, create, cancel | 3 |
| Clientes | view, manage | 2 |
| Marketing | view, manage | 2 |
| Fidelidade | view, manage | 2 |
| Usuários | view, manage, sensitive.view, sensitive.manage, additional_info.view, additional_info.manage, additional_info_sensitive.view, additional_info_sensitive.manage, profile_requests.view, profile_requests.review, profile_requests.manage | 11 |
| Segurança | view, manage, context.view, context.manage, logs.view, logs.manage, roles.view, roles.manage, custom_roles.view, custom_roles.manage, user_permissions.view, user_permissions.manage, sensitive_actions.view, sensitive_actions.manage, pin_token.view, pin_token.manage, sessions.view, sessions.manage | 18 |
| Configurações | view, manage, store.view, store.manage, commercial.view, commercial.manage, orders.view, orders.manage, stock.view, stock.manage, delivery.view, delivery.manage, payment.view, payment.manage, legal.view, legal.manage, system.view, system.manage | 18 |
| **Total** | | **~74** |

---

## 4. Templates de Permissões por Papel

As templates definem as permissões padrão para cada papel. São armazenadas na tabela `store_role_permissions` e gerenciadas via a função RPC `update_store_role_permission_template`.

### 4.1 Proprietário (`owner`)

> **Acesso total.** O proprietário ignora todas as verificações de permissão. Nenhuma restrição se aplica.

### 4.2 Admin (`admin`)

| Módulo | Permissões |
|---|---|
| Dashboard | view ✓ |
| Relatórios | view ✓ |
| Produtos | view ✓, create ✓, update ✓, delete ✓ |
| Estoque | view ✓, transfer ✓, adjust ✓ |
| Compras | view ✓, create ✓, confirm ✓, cancel ✓ |
| Fornecedores | view ✓, manage ✓ |
| Pedidos | view ✓, manage ✓, cancel ✓ |
| Livro Diário | view ✓, create ✓, cancel ✓ |
| Clientes | view ✓, manage ✓ |
| Marketing | view ✓, manage ✓ |
| Fidelidade | view ✓, manage ✓ |
| Usuários | view ✓, manage ✓, sensitive.view ✓, sensitive.manage ✓, additional_info.view ✓, additional_info.manage ✓, additional_info_sensitive.view ✓, additional_info_sensitive.manage ✓, profile_requests.view ✓, profile_requests.review ✓, profile_requests.manage ✓ |
| Segurança | view ✓, manage ✓, context.view ✓, context.manage ✓, logs.view ✓, logs.manage ✓, roles.view ✓, roles.manage ✓, custom_roles.view ✓, custom_roles.manage ✓, user_permissions.view ✓, user_permissions.manage ✓, sensitive_actions.view ✓, sensitive_actions.manage ✓, pin_token.view ✓, pin_token.manage ✓, sessions.view ✓, sessions.manage ✓ |
| Configurações | view ✓, manage ✓, store.view ✓, store.manage ✓, commercial.view ✓, commercial.manage ✓, orders.view ✓, orders.manage ✓, stock.view ✓, stock.manage ✓, delivery.view ✓, delivery.manage ✓, payment.view ✓, payment.manage ✓, legal.view ✓, legal.manage ✓, system.view ✓, system.manage ✓ |

### 4.3 Gerente (`manager`)

| Módulo | Permissões |
|---|---|
| Dashboard | view ✓ |
| Relatórios | view ✓ |
| Produtos | view ✓, create ✓, update ✓ |
| Estoque | view ✓, transfer ✓, adjust ✓ |
| Compras | view ✓, create ✓, confirm ✓ |
| Fornecedores | view ✓, manage ✓ |
| Pedidos | view ✓, manage ✓, cancel ✓ |
| Livro Diário | view ✓, create ✓ |
| Clientes | view ✓, manage ✓ |
| Marketing | view ✓, manage ✓ |
| Fidelidade | view ✓, manage ✓ |
| Usuários | view ✓, manage ✓, additional_info.view ✓, additional_info.manage ✓ |
| Segurança | view ✓, logs.view ✓, roles.view ✓ |
| Configurações | store.view ✓, commercial.view ✓, orders.view ✓, stock.view ✓, delivery.view ✓, payment.view ✓ |

> **Nota:** `settings.view` foi removido do template do manager. Essa permissão pode existir no catálogo, mas não deve ser utilizada para liberar rotas ou abas sensíveis.

### 4.4 Estoque (`stock_operator`)

| Módulo | Permissões |
|---|---|
| Dashboard | view ✓ |
| Produtos | view ✓ |
| Estoque | view ✓, transfer ✓, adjust ✓ |
| Compras | view ✓, confirm ✓ |
| Fornecedores | view ✓ |
| Pedidos | view ✓ |
| Livro Diário | view ✓ |
| Clientes | view ✓ |

### 4.5 Caixa (`cashier`)

| Módulo | Permissões |
|---|---|
| Dashboard | view ✓ |
| Produtos | view ✓ |
| Estoque | view ✓ |
| Pedidos | view ✓, manage ✓ |
| Livro Diário | view ✓, create ✓ |
| Clientes | view ✓ |

### 4.6 Vendas (`sales`)

| Módulo | Permissões |
|---|---|
| Dashboard | view ✓ |
| Produtos | view ✓ |
| Estoque | view ✓ |
| Pedidos | view ✓, manage ✓ |
| Clientes | view ✓, manage ✓ |
| Marketing | view ✓ |
| Fidelidade | view ✓ |

### 4.7 Equipe (`staff`)

| Módulo | Permissões |
|---|---|
| Dashboard | view ✓ |
| Produtos | view ✓ |
| Estoque | view ✓ |
| Pedidos | view ✓ |
| Clientes | view ✓ |

### 4.8 Visualizador (`viewer`)

| Módulo | Permissões |
|---|---|
| Dashboard | view ✓ |
| Relatórios | view ✓ |
| Produtos | view ✓ |
| Estoque | view ✓ |
| Compras | view ✓ |
| Fornecedores | view ✓ |
| Pedidos | view ✓ |
| Livro Diário | view ✓ |
| Clientes | view ✓ |
| Marketing | view ✓ |
| Fidelidade | view ✓ |
| Usuários | view ✓ |

---

## 5. Ações Sensíveis

Ações de alto risco que exigem verificação adicional (PIN, senha mestra, token, etc.):

| Código | Descrição |
|---|---|
| `product_delete` | Exclusão/descontinuação de produto |
| `stock_adjustment` | Ajuste de estoque |
| `purchase_cancel` | Cancelamento de compra |
| `user_role_change` | Alteração de papel de usuário |
| `user_status_change` | Alteração de status de usuário |
| `sensitive_view` | Visualização de dados sensíveis |
| `sensitive_manage` | Gerenciamento de dados sensíveis |

### 5.1 Tipos de Requisito para Ações Sensíveis

| Requisito | Descrição |
|---|---|
| `none` | Nenhuma verificação adicional necessária |
| `pin` | Requer PIN |
| `master_password` | Requer senha mestra |
| `pin_or_master` | PIN ou senha mestra |
| `owner_approval` | Requer aprovação do proprietário |
| `token` | Requer token interno |
| `pin_and_token` | PIN + token necessários |

---

## 6. Níveis de Risco

| Nível | Descrição |
|---|---|
| `low` | Baixo risco - operações de visualização |
| `medium` | Médio risco - criação e edição |
| `high` | Alto risco - exclusões e cancelamentos |
| `critical` | Crítico - ações que afetam dados sensíveis ou financeiros |

---

## 7. Hierarquia de Resolução de Permissões

A ordem de resolução das permissões é:

1. **Owner** - Ignora todas as verificações
2. **Override individual** (`store_member_permissions`) - Permissões específicas do membro
3. **Permissão padrão do papel** (`store_role_permissions`) - Permissões padrão do papel

Função SQL: `user_has_store_permission_v2` em `supabase/migrations/20260609_create_get_store_settings_center.sql`

---

## 8. Papéis Personalizados

Papéis personalizados são definidos na tabela `store_custom_roles` e possuem:

- `name` - Nome de exibição
- `description` - Descrição do papel
- `base_role` - Herda de um dos 8 papéis built-in
- `permissions` - Mapa de permissões personalizadas (`Record<string, boolean>`)
- `sensitive_actions` - Mapa de ações sensíveis personalizadas
- `active` - Status ativo/inativo

---

## 9. Arquivos de Referência

| Arquivo | Descrição |
|---|---|
| `src/types/security.ts` | Definições de tipos de segurança |
| `src/types/permissions.ts` | Tipos de permissões (EffectiveStorePermission, SensitiveActionRequirementResult, RiskLevel) |
| `src/services/permissionService.ts` | Camada de serviço para chamadas RPC de permissões |
| `src/hooks/usePermissions.ts` | Hook React para carregar e verificar permissões |
| `src/utils/permissions.ts` | Funções utilitárias (hasEffectivePermission, hasAnyEffectivePermission, hasAllEffectivePermissions) |
| `src/components/RequirePermission.tsx` | Componente de guarda de rotas |
| `src/hooks/security/useSecurityPermissionsAdmin.ts` | Hook para administração de permissões |
| `src/hooks/security/useStoreCustomRoles.ts` | Hook para gerenciamento de papéis personalizados |
| `src/pages/private/admin/settings/security/Security.tsx` | Página de administração de segurança |
| `src/components/users/UserDetailModal.tsx` | Modal de detalhes do usuário com mapeamento de labels |
| `src/components/layouts/PrivateLayout.tsx` | Layout com itens de menu condicionados a permissões |
| `src/AppRoutes.tsx` | Definições de rotas com guards RequirePermission |
