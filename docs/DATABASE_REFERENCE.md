# Referência do Banco de Dados Supabase / PostgreSQL

> **Versão Autorizada:** `0.10.0-rc.1`  
> **Projeto Supabase:** `lgkkfmqzaorrutuoqeax`  
> **Fonte Operacional Autorizada:** O código-fonte autoritativo e versionado de todas as tabelas, funções e políticas RLS encontra-se no diretório local `supabase/migrations/`.

---

## 🏗️ 1. Governança e Regra do Banco de Dados

> ⚠️ **REGRA INVIOLÁVEL**: Nunca criar migrations SQL, tabelas, views, triggers ou funções sem solicitação explícita do usuário. As alterações no esquema do banco são rigorosamente versionadas através dos arquivos numerados em `supabase/migrations/`.

---

## 🗄️ 2. Mapeamento das Tabelas Principais

### 2.1 Identidade, Lojas e Membros

- `stores`: Cadastro do estabelecimento, razão social, slug pública, logo, endereço e configurações JSONB (`config`).
- `public_store_slug_aliases`: Aliases históricos de slugs públicas para redirecionamento transparente.
- `profiles`: Cadastro global do usuário (vinculado a `auth.users`).
- `store_members`: Vínculo do usuário com a loja, papel (`role`), apelido (`internal_alias`), status e permissões sobrescritas.
- `store_custom_roles`: Funções personalizadas criadas pela loja com matriz própria de permissões.
- `store_permission_versions`: Tabela central de versionamento de permissões para sincronização em Realtime.

### 2.2 Catálogo de Produtos e Estoque

- `products`: Produtos do estabelecimento (nome, SKU, EAN, preço base, status e imagens WebP).
- `product_categories`: Categorias de produtos com ordenação, grupo de precificação e imagem WebP.
- `pricing_groups`: Grupos de precificação em atacado combinado (regras de desconto progressivo por quantidade).
- `inventory_locations`: Locais físicos de estoque (ex: Depósito Central, Cozinha, Loja).
- `inventory_location_balances`: Saldos físicos de estoque por localização (`on_hand`, `reserved`).
- `stock_movements`: Registro auditável de movimentações de estoque (entradas, saídas, ajustes e vendas).
- `stock_transfers`: Transferências internas de estoque entre localizações.

### 2.3 Pedidos e Venda Direta

- `orders`: Pedidos comerciais (origem slug, PDV, balcão, entrega), status, cliente e valores.
- `order_items`: Itens do pedido com snapshot de preço e complementos.
- `stock_reservations`: Reservas temporárias de estoque associadas a pedidos online pendentes.

### 2.4 Financeiro e Plano de Contas

- `cashbook_entries`: Lançamentos do livro caixa (entradas, saídas, sangrias e reforços).
- `cashbook_day_closings`: Registro de fechamento diário de caixa por operador/turno.
- `cashbook_closing_occurrences`: Ocorrências de divergência física registradas durante o fechamento do caixa.
- `cashbook_account_plan`: Estrutura hierárquica do plano de contas financeiro.
- `store_financial_accounts`: Contas financeiras vinculadas ao estabelecimento (ex: Caixa Físico, Banco, Maquininha).

### 2.5 Compras e Cotações

- `purchase_quotation_rounds`: identifica e governa uma rodada de cotação enviada em lote, incluindo status, prazo e controle idempotente da geração de compras.
- `purchase_quotations.quotation_round_id`: relaciona cada cotação individual à sua rodada de origem.
- `purchase_documents` e `purchase_document_items`: recebem os pedidos em rascunho gerados pelo plano de compra aprovado na análise.

### 2.6 Clientes, Fidelidade e Marketing

- `customers`: Clientes do estabelecimento (identificação pública, CPF, telefone, opt-in marketing).
- `reward_media_library`: Mídias e imagens para programa de recompensas/fidelidade.
- `store_security_activity_logs`: Registro de auditoria de ações sensíveis e logins.

---

## ⚙️ 3. Catálogo de RPCs (Stored Procedures) Principais

| Nome da RPC                                     | Responsabilidade                                                                                 | Contexto de Uso                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `get_product_inventory_lifecycle`               | Retorna o ciclo de vida completo do produto (estoque, compras, vendas, margem e snapshots)       | Vida do Produto (`/admin/products/:id/lifecycle`) |
| `create_admin_direct_sale_order_safe`           | Cria venda direta / PDV no backend de forma autoritativa e idempotente                           | PDV e Venda Direta (`/admin/pdv`)                 |
| `list_cashbook_day_closing_status_safe`         | Lista o status de abertura e fechamento de caixas                                                | Livro Diário (`/admin/cashbook`)                  |
| `get_effective_user_permissions`                | Calcula a matriz final de permissões do membro respeitando a hierarquia                          | Autenticação e Segurança                          |
| `get_login_store_options`                       | Retorna as lojas acessíveis do usuário com papeis e funções amigáveis                            | Login e Seleção de Loja                           |
| `resolve_occurrence_cash_replenishment`         | Trata a resolução de divergências de caixa por sangria ou reforço                                | Fechamento de Caixa                               |
| `create_purchase_quotation_round`               | Cria atomicamente a rodada e uma cotação relacionada para cada fornecedor selecionado            | Cotação em lote (`/admin/stock/quotations/batch`) |
| `get_purchase_quotation_rounds_by_store`        | Lista rodadas com totais de fornecedores, respostas, produtos e propostas expiradas              | Aba Rodadas de cotação                            |
| `generate_purchase_drafts_from_quotation_round` | Valida o plano por produto e cria um rascunho de compra por fornecedor; impede geração duplicada | Análise concorrencial da rodada                   |
| `save_purchase_document_draft_atomic`           | Cria ou edita cabeçalho e itens do rascunho na mesma transação, validando permissão e fornecedor | Compras (`/admin/purchases`)                      |
| `confirm_purchase_document_at_location`         | Confirma o recebimento total e aplica a compra ao local físico explicitamente selecionado        | Recebimento de compras                            |

---

## 🔒 4. Hardening de RLS e Supabase Advisors

Todas as tabelas do schema `public` possuem **Row Level Security (RLS)** ativado por padrão.
Conforme homologado nas frentes de hardening 9.14:

- Funções `SECURITY DEFINER` foram auditadas para revogar privilégios desnecessários dos papéis `anon` e `authenticated`.
- Acesso anônimo restrito estritamente às RPCs públicas da loja (`/loja/:slug`, rastreamento por token e catalogo público).
