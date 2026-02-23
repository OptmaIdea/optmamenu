# Estrutura do Projeto OptmaMenu

## Visão Geral

Este documento descreve a organização de diretórios e arquivos do projeto OptmaMenu.

**Última Atualização:** Fevereiro 2026
**Versão:** 2.0

## Status das Funcionalidades (Fevereiro 2026)

### ✅ Implementado e Producao

- ✅ **Autenticação** (Admin e Cliente)
- ✅ **Produtos** (CRUD completo)
- ✅ **Categorias** (com precificação por volume)
- ✅ **Estoque** (controle e movimentações)
- ✅ **Pedidos** (fluxo completo)
- ✅ **PDV** (venda balcão)
- ✅ **Clientes** (cadastro e histórico)
- ✅ **Fidelidade** (pontos, rewards, tiers)
- ✅ **Configurações** (loja, horários, aparência)
- ✅ **Segurança** (PIN, logs, auditoria)
- ✅ **RPC Architecture** (22 arquivos migrados)

### 🟡 Em Desenvolvimento

- 🟡 **Marketing** (33% - Página "Em Breve" ativa)
- 🟡 **Pagamentos** (25% - Página "Em Breve" ativa)
- 🟡 **Entregas** (15% - Página "Em Breve" ativa)
- 🟡 **Usuários (RBAC)** (Placeholder)
- 🟡 **Relatórios Avançados** (Em planejamento)

### 🔵 Planejamento

- 🔵 **Multi-Loja Avançado** (Transferências)
- 🔵 **API de Integrações** (Webhooks)
- 🔵 **App Mobile** (React Native)
- 🔵 **Modo Offline**

## Estrutura de Diretórios

```
optmamenusys/
├── docs/                           # Documentação do projeto
│   ├── ARCHITECTURE.md            # Arquitetura do sistema
│   ├── ATUALIZACOES_IMPLEMENTADAS.md  # 🆕 Atualizações técnicas
│   ├── ESTRUTURA.md               # Este arquivo
│   ├── GUIA_MARKETING_MENSAGENS_ANIVERSARIANTES.md
│   ├── GUIA_MOVIMENTACAO_CATEGORIAS.md
│   ├── GUIA_USUARIOS_CLIENTES_FIDELIDADE.md
│   ├── IMPLEMENTATION_PLAN.md     # Plano de implementação
│   ├── PLANO_DE_NEGOCIOS.md       # Plano original (v1.0)
│   ├── PLANO_DE_NEGOCIOS_ATUALIZACAO_2026_02.md  # 🆕 Atualização (v1.1)
│   ├── RESUMO_EXECUTIVO.md
│   └── SQL_EXTRAS_EM_SUPABASE_COM_EXITO.md
│
├── public/                         # Arquivos públicos estáticos
│   ├── assets/                    # Logotipos e imagens
│   │   ├── OptmaIdeaLogo.png
│   │   ├── OptmaIdeaLogo.webp
│   │   ├── OptmaMenuLogo.webp
│   │   └── OptmaMenuLogoRnd.webp
│   ├── favicon-gelinhares.ico
│   ├── favicon.ico
│   ├── logo-gelinhares.png
│   ├── logo.jpg
│   ├── manifest.json
│   ├── OptmaMenuLogo.ico
│   ├── OptmaMenuSysLogo.ico
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   ├── sw.js                      # Service Worker
│   └── vite.svg
│
├── scripts/                        # Scripts utilitários
│   └── convert-to-webp.js         # Conversão de imagens para WebP
│
├── src/                            # Código fonte da aplicação
│   ├── __tests__/                 # Testes automatizados
│   │   ├── store/
│   │   │   └── useCartStore.test.ts
│   │   └── utils/
│   │       └── timezoneUtils.test.ts
│   │
│   ├── assets/                     # Assets da aplicação
│   │   └── react.svg
│   │
│   ├── components/                 # Componentes reutilizáveis
│   │   ├── admin/                  # Componentes específicos do admin
│   │   │   ├── StorePreview.tsx
│   │   │   └── index.ts           # Barrel export
│   │   ├── common/                 # Componentes compartilhados
│   │   │   ├── AlertBanner.tsx
│   │   │   ├── CookieConsent.tsx
│   │   │   ├── DataCard.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── MetaTags.tsx
│   │   │   ├── PageContainer.tsx
│   │   │   ├── ProgressCard.tsx
│   │   │   ├── RecentActivity.tsx
│   │   │   ├── SecurityConfirmModal.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   └── index.ts           # Barrel export
│   │   ├── layouts/                # Layouts da aplicação
│   │   │   ├── PrivateLayout.tsx
│   │   │   ├── PublicLayout.tsx
│   │   │   └── StoreLayout.tsx
│   │   ├── mobile/                 # Componentes mobile
│   │   │   └── NotificationReceiver.tsx
│   │   ├── LoyaltyPoints.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── index.ts                # Barrel export
│   │
│   ├── constants/                  # Constantes da aplicação
│   │   └── legalTemplates.ts      # Templates para documentos legais
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── useOrderMonitor.ts
│   │   └── useStoreSecurityConfig.ts
│   │
│   ├── lib/                        # Configurações de bibliotecas
│   │   └── supabase.ts            # Cliente Supabase
│   │
│   ├── pages/                      # Páginas da aplicação
│   │   ├── createStore/            # Criação de loja
│   │   │   └── CreateStore.tsx
│   │   ├── initial/                # Páginas iniciais (públicas)
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   └── SignUp.tsx
│   │   │   ├── home/
│   │   │   │   └── Landing.tsx
│   │   │   └── legal/
│   │   │       ├── PrivacyPolicy.tsx
│   │   │       └── Terms.tsx
│   │   ├── private/
│   │   │   └── admin/              # Área administrativa
│   │   │       ├── commercial/     # Gestão comercial
│   │   │       │   ├── customers/  # Clientes
│   │   │       │   ├── loyalty/    # Fidelidade
│   │   │       │   ├── messages/   # Mensagens
│   │   │       │   └── orders/     # Pedidos
│   │   │       ├── dashboard/      # Dashboard e relatórios
│   │   │       │   ├── Activity.tsx
│   │   │       │   ├── Alerts.tsx
│   │   │       │   ├── Reports.tsx
│   │   │       │   └── push/
│   │   │       ├── marketing/      # 🆕 Marketing (Em breve)
│   │   │       │   ├── Marketing.tsx
│   │   │       │   └── index.ts
│   │   │       ├── payments/       # 🆕 Pagamentos (Em breve)
│   │   │       │   ├── Payments.tsx
│   │   │       │   └── index.ts
│   │   │       ├── delivery/       # 🆕 Entregas (Em breve)
│   │   │       │   ├── Delivery.tsx
│   │   │       │   └── index.ts
│   │   │       ├── products/       # Produtos e estoque
│   │   │       │   ├── category/   # Módulo de categorias
│   │   │       │   ├── inventory/  # Módulo de estoque
│   │   │       │   ├── products/   # Módulo de produtos
│   │   │       │   ├── Categories.tsx
│   │   │       │   ├── Inventory.tsx
│   │   │       │   ├── Products.tsx
│   │   │       │   └── StockMovements.tsx
│   │   │       ├── settings/       # Configurações da loja
│   │   │       │   ├── appearance/ # Aparência
│   │   │       │   ├── hours/      # Horários
│   │   │       │   ├── messages/   # Mensagens
│   │   │       │   ├── profile/    # Perfil
│   │   │       │   ├── security/   # Segurança
│   │   │       │   ├── storeSettings/ # Dados da loja
│   │   │       │   └── users/      # 🆕 Usuários (Em breve)
│   │   │       └── support/        # Suporte e documentação
│   │   │           ├── Documentation.tsx
│   │   │           ├── FAQ.tsx
│   │   │           └── Legal.tsx
│   │   │   └── admin/              # Páginas administrativas
│   │   │       ├── commercial/     # Funcionalidades comerciais
│   │   │       │   ├── customers/
│   │   │       │   │   └── Customers.tsx
│   │   │       │   ├── loyalty/
│   │   │       │   │   ├── LoyaltyConfig.tsx
│   │   │       │   │   └── settings/
│   │   │       │   │       ├── CategoryRules.tsx
│   │   │       │   │       ├── LevelsConfig.tsx
│   │   │       │   │       ├── ManualPoints.tsx
│   │   │       │   │       └── RewardsConfig.tsx
│   │   │       │   │   └── terms/
│   │   │       │   │       └── LegalTerms.tsx
│   │   │       │   ├── messages/
│   │   │       │   │   └── Messages.tsx
│   │   │       │   ├── orders/
│   │   │       │   │   ├── OrderHistory.tsx
│   │   │       │   │   ├── Orders.tsx
│   │   │       │   │   └── index.ts
│   │   │       │   └── index.ts
│   │   │       ├── dashboard/      # Dashboard e relatórios
│   │   │       │   ├── Activity.tsx
│   │   │       │   ├── Alerts.tsx
│   │   │       │   ├── Dashboard.tsx
│   │   │       │   ├── Reports.tsx
│   │   │       │   ├── push/
│   │   │       │   │   └── PushNotifications.tsx
│   │   │       │   └── index.ts
│   │   │       ├── products/       # Gestão de produtos
│   │   │       │   ├── Categories.tsx
│   │   │       │   ├── Inventory.tsx
│   │   │       │   ├── Products.tsx
│   │   │       │   ├── category/   # Módulo de categorias
│   │   │       │   │   ├── components/
│   │   │       │   │   │   ├── CategoryCard.tsx
│   │   │       │   │   │   ├── CategoryDeleteConfirmModal.tsx
│   │   │       │   │   │   ├── CategoryEditModal.tsx
│   │   │       │   │   │   ├── CategoryFormFields.tsx
│   │   │       │   │   │   ├── CategoryProductsModal.tsx
│   │   │       │   │   │   ├── CategoryProductsSimpleModal.tsx
│   │   │       │   │   │   ├── CategoryRow.tsx
│   │   │       │   │   │   ├── CategoryTable.tsx
│   │   │       │   │   │   ├── CategoryThumb.tsx
│   │   │       │   │   │   └── CategoryViewModal.tsx
│   │   │       │   │   ├── hooks/
│   │   │       │   │   │   ├── useCategories.ts
│   │   │       │   │   │   ├── useCategoryFilters.ts
│   │   │       │   │   │   ├── useCategoryForm.ts
│   │   │       │   │   │   ├── useCategoryModals.ts
│   │   │       │   │   │   └── useCategorySave.ts
│   │   │       │   │   ├── types/
│   │   │       │   │   │   └── category.types.ts
│   │   │       │   │   └── utils/
│   │   │       │   │       └── categoryPricing.ts
│   │   │       │   ├── inventory/  # Módulo de inventário
│   │   │       │   │   ├── StockMovements.tsx
│   │   │       │   │   ├── components/
│   │   │       │   │   │   ├── InventoryItem.tsx
│   │   │       │   │   │   ├── InventoryList.tsx
│   │   │       │   │   │   ├── PrintableStockMovements.tsx
│   │   │       │   │   │   ├── StockAdjustmentModal.tsx
│   │   │       │   │   │   └── StockClearanceModal.tsx
│   │   │       │   │   ├── hooks/
│   │   │       │   │   │   ├── useInventory.ts
│   │   │       │   │   │   ├── useInventoryFilters.ts
│   │   │       │   │   │   ├── useStockAdjustment.ts
│   │   │       │   │   │   └── useStockMovement.ts
│   │   │       │   │   ├── types/
│   │   │       │   │   │   └── inventory.types.ts
│   │   │       │   │   └── utils/
│   │   │       │   │       └── inventoryHelpers.ts
│   │   │       │   └── products/   # Módulo de produtos
│   │   │       │       ├── components/
│   │   │       │       │   ├── AdminProductEditModal/
│   │   │       │       │   │   ├── AdminProductEditModal.tsx
│   │   │       │       │   │   ├── CategorySelector.tsx
│   │   │       │       │   │   ├── DeactivateProductModal.tsx
│   │   │       │       │   │   ├── FormSection.tsx
│   │   │       │       │   │   ├── ImageSection.tsx
│   │   │       │       │   │   ├── PriceSection.tsx
│   │   │       │       │   │   ├── ReactivateProductModal.tsx
│   │   │       │       │   │   ├── SortableThumb.tsx
│   │   │       │       │   │   ├── StockFields.tsx
│   │   │       │       │   │   └── panels/
│   │   │       │       │   │       ├── FormPanel.tsx
│   │   │       │       │   │       ├── ImagesPanel.tsx
│   │   │       │       │   │       └── ProductFormPanel.tsx
│   │   │       │       │   ├── AdminProductViewModal.tsx
│   │   │       │       │   ├── DiscontinuedProductsModal.tsx
│   │   │       │       │   ├── FilterBar.tsx
│   │   │       │       │   ├── FilteredProductsModal.tsx
│   │   │       │       │   ├── PrintableReport.tsx
│   │   │       │       │   ├── ProductActionModal.tsx
│   │   │       │       │   ├── ProductDeleteConfirmModal.tsx
│   │   │       │       │   ├── ProductRow.tsx
│   │   │       │       │   ├── ProductTable.tsx
│   │   │       │       │   ├── ProductThumb.tsx
│   │   │       │       │   ├── StatsCards.tsx
│   │   │       │       │   └── productForm/
│   │   │       │       │       ├── ProductFormModal.tsx
│   │   │       │       │       ├── product.schema.ts
│   │   │       │       │       ├── sections/
│   │   │       │       │       │   ├── DangerZone.tsx
│   │   │       │       │       │   ├── MainFields.tsx
│   │   │       │       │       │   ├── MediaManager.tsx
│   │   │       │       │       │   ├── Pricing.tsx
│   │   │       │       │       │   └── Stock.tsx
│   │   │       │       │       └── useProductForm.ts
│   │   │       │       └── hooks/
│   │   │       │           ├── useExport.ts
│   │   │       │           ├── useFilters.ts
│   │   │       │           ├── useModals.ts
│   │   │       │           ├── useProductCategories.ts
│   │   │       │           ├── useProductDelete.ts
│   │   │       │           ├── useProductForm.ts
│   │   │       │           ├── useProductImages.ts
│   │   │       │           ├── useProductPricing.ts
│   │   │       │           ├── useProducts.ts
│   │   │       │           ├── useProductSave.ts
│   │   │       │           ├── useStorePassword.ts
│   │   │       │           ├── types/
│   │   │       │           │   └── product.types.ts
│   │   │       │           └── utils/
│   │   │       │               └── securityLog.ts
│   │   │       ├── settings/       # Configurações
│   │   │       │   ├── appearance/
│   │   │       │   │   ├── Appearance.tsx
│   │   │       │   │   └── index.ts
│   │   │       │   ├── hours/
│   │   │       │   │   ├── Hours.tsx
│   │   │       │   │   └── index.ts
│   │   │       │   ├── messages/
│   │   │       │   │   ├── MessageSettings.tsx
│   │   │       │   │   └── index.ts
│   │   │       │   ├── profile/
│   │   │       │   │   ├── Profile.tsx
│   │   │       │   │   └── index.ts
│   │   │       │   ├── security/
│   │   │       │   │   ├── Security.tsx
│   │   │       │   │   └── index.ts
│   │   │       │   ├── storeSettings/
│   │   │       │   │   ├── StoreSettings.tsx
│   │   │       │   │   ├── index.ts
│   │   │       │   │   ├── storeSettings.types.ts
│   │   │       │   │   └── tabs/
│   │   │       │   │       ├── AddressTab.tsx
│   │   │       │   │       ├── ContactsTab.tsx
│   │   │       │   │       ├── CorporateTab.tsx
│   │   │       │   │       └── LegalTab.tsx
│   │   │       │   ├── users/
│   │   │       │   │   ├── Users.tsx
│   │   │       │   │   └── index.ts
│   │   │       │   └── index.ts
│   │   │       └── support/        # Suporte e documentação
│   │   │           ├── Documentation.tsx
│   │   │           ├── FAQ.tsx
│   │   │           ├── Legal.tsx
│   │   │           └── index.ts
│   │   └── store/                  # Loja do cliente
│   │       ├── Catalog.tsx
│   │       ├── Checkout.tsx
│   │       └── components/
│   │           ├── CartDrawer.tsx
│   │           ├── CustomerProfile.tsx
│   │           ├── ProductCard.tsx
│   │           └── ProductModal.tsx
│   │
│   ├── services/                   # Lógica de negócio e API
│   │   ├── customerAuth.ts
│   │   ├── customerService.ts
│   │   ├── index.ts                # Barrel export
│   │   ├── notificationService.ts
│   │   └── notifications/
│   │       └── notificationService.ts
│   │
│   ├── store/                      # Gerenciamento de estado (Zustand)
│   │   ├── index.ts
│   │   ├── useAuthStore.ts
│   │   ├── useCartStore.ts
│   │   └── useCustomerAuth.ts
│   │
│   ├── types/                      # Definições TypeScript
│   │   ├── admin.ts
│   │   ├── index.ts
│   │   ├── loyalty.ts
│   │   ├── order.ts
│   │   └── store.ts
│   │
│   ├── utils/                      # Funções utilitárias
│   │   ├── supabaseStorage.ts
│   │   └── timezoneUtils.ts
│   │
│   ├── App.css                     # Estilos do App
│   ├── App.tsx                     # Componente principal
│   ├── AppRoutes.tsx               # Configuração de rotas
│   ├── index.css                   # Estilos globais
│   └── main.tsx                    # Entry point
│
├── supabase/                       # Configurações Supabase
│   ├── config.toml                 # Configuração do CLI Supabase
│   ├── migrations/                 # Migrações do banco de dados
│   │   ├── 20260202120000_initial_schema.sql
│   │   ├── 20260202123000_seed_data.sql
│   │   ├── 20260204163000_add_store_id_to_orders.sql
│   │   ├── 20260213160000_fix_products_view.sql
│   │   ├── 20260213161000_assign_data_to_store.sql
│   │   ├── add_metadata_to_orders.sql
│   │   ├── add_sms_toggle.sql
│   │   ├── cancel_orders_func.sql
│   │   ├── create_stock_movements.sql
│   │   ├── create_store_hours.sql
│   │   ├── fix_register_stock_movement.sql
│   │   ├── fix_rpc_ambiguity.sql
│   │   ├── fix_rpc_status_enum.sql
│   │   ├── fix_stock_movements_id.sql
│   │   ├── recreate_stock_movements.sql
│   │   └── update_products_with_stock_view.sql
│   ├── schema/                     # Schema do banco de dados
│   │   ├── functions/              # Funções e stored procedures
│   │   │   ├── admin_schema.sql
│   │   │   ├── loyalty_schema.sql
│   │   │   ├── schema.sql
│   │   │   ├── schema_dump.sql
│   │   │   ├── schema_v2.sql
│   │   │   └── update_schema.sql
│   │   ├── policies/               # Políticas de segurança (RLS)
│   │   │   └── fix_storage_policies.sql
│   │   ├── seed/                   # Dados de seed
│   │   │   └── seed.sql
│   │   └── tables/                 # Definições de tabelas
│   │       ├── category_bucket_migration.sql
│   │       ├── category_extras_migration.sql
│   │       ├── category_migration.sql
│   │       ├── create_orders_full.sql
│   │       ├── enable_realtime.sql
│   │       ├── fix_rls_orders.sql
│   │       ├── fix_storage_final.sql
│   │       ├── logo_migration.sql
│   │       ├── products_bucket_migration.sql
│   │       ├── sms_migration.sql
│   │       └── update_rpc_last_sale.sql
│   └── seed.sql                    # Seed principal
│
├── .env                            # Variáveis de ambiente
├── .env.example                    # Exemplo de variáveis de ambiente
├── .gitignore                      # Arquivos ignorados pelo Git
├── .prettierignore                 # Ignores do Prettier
├── .prettierrc                     # Configuração do Prettier
├── eslint.config.js                # Configuração ESLint
├── index.html                      # HTML principal
├── package.json                    # Dependências do projeto
├── package-lock.json               # Lockfile do npm
├── postcss.config.js               # Configuração PostCSS
├── README.md                       # Documentação principal
├── schema_export.sql               # Export do schema do banco
├── tailwind.config.js              # Configuração Tailwind
├── tsconfig.app.json               # Configuração TypeScript (app)
├── tsconfig.json                   # Configuração TypeScript
├── tsconfig.node.json              # Configuração TypeScript (node)
├── vite.config.ts                  # Configuração Vite
└── vitest.config.ts                # Configuração Vitest (testes)
```

## Convenções de Nomenclatura

### Arquivos
- **Componentes React**: PascalCase (ex: `ProductCard.tsx`, `AdminProductEditModal.tsx`)
- **Hooks customizados**: camelCase com prefixo `use` (ex: `useProducts.ts`, `useCategoryForm.ts`)
- **Serviços**: camelCase (ex: `customerService.ts`, `notificationService.ts`)
- **Utilitários**: camelCase (ex: `timezoneUtils.ts`, `supabaseStorage.ts`)
- **Tipos TypeScript**: camelCase com sufixo `.types.ts` (ex: `product.types.ts`, `inventory.types.ts`)
- **Schemas de validação**: camelCase com sufixo `.schema.ts` (ex: `product.schema.ts`)
- **Configuração**: camelCase ou kebab-case (ex: `vite.config.ts`, `tailwind.config.js`)
- **Barrel Exports**: `index.ts`
- **Migrações SQL**: `YYYYMMDDHHMMSS_descricao.sql` (ex: `20260202120000_initial_schema.sql`)

### Diretórios
- **Componentes**: lowercase (ex: `components/`, `common/`, `layouts/`)
- **Páginas**: lowercase (ex: `pages/`, `admin/`, `store/`)
- **Features por domínio**: lowercase (ex: `commercial/`, `dashboard/`, `products/`, `settings/`)
- **Módulos internos**: lowercase (ex: `category/`, `inventory/`, `products/`)
- **Configuração**: lowercase (ex: `docs/`, `public/`, `supabase/`)

## Padrões de Organização

### Barrel Exports
Cada diretório com múltiplos componentes exporta todos os itens públicos via `index.ts`:

```typescript
// components/common/index.ts
export { AlertBanner } from './AlertBanner'
export { CookieConsent } from './CookieConsent'
export { DataCard } from './DataCard'
// ...
```

### Separação de Responsabilidades
- **`components/`**: Componentes de UI reutilizáveis, sem lógica de negócio específica
- **`pages/`**: Componentes de página, organizados por contexto (initial, private, store)
- **`services/`**: Lógica de negócio, chamadas API e integração com Supabase
- **`hooks/`**: Hooks customizados compartilhados entre múltiplos componentes
- **`store/`**: Estado global da aplicação (Zustand)
- **`types/`**: Definições de tipos TypeScript compartilhados
- **`utils/`**: Funções utilitárias puras
- **`constants/`**: Constantes e templates estáticos

### Organização por Domínio (Feature-based)
Dentro de `pages/private/admin/`, os arquivos são organizados por domínio de negócio:

```
admin/
├── commercial/      # Gestão comercial (pedidos, clientes, fidelidade, mensagens)
├── dashboard/       # Dashboard, relatórios, atividades, notificações push
├── products/        # Gestão de produtos, categorias e inventário
├── settings/        # Configurações da loja, perfil, segurança, usuários
└── support/         # Suporte, documentação, FAQ, termos legais
```

### Módulos de Features
Cada módulo (ex: `category/`, `inventory/`, `products/`) segue a estrutura:

```
module-name/
├── components/      # Componentes específicos do módulo
├── hooks/           # Hooks específicos do módulo
├── types/           # Tipos TypeScript específicos
├── utils/           # Utilitários específicos
└── ModulePage.tsx   # Página principal do módulo
```

### Separação Admin vs Store
- **`pages/private/admin/`**: Interface administrativa (gestão da loja)
- **`pages/store/`**: Interface do cliente (catálogo, carrinho, checkout)
- **`pages/initial/`**: Páginas públicas iniciais (landing, login, signup)

### Componentes Específicos vs Compartilhados
- Componentes dentro de módulos (ex: `products/components/`) são específicos daquele domínio
- Componentes em `src/components/` são compartilhados e reutilizáveis

## Fluxo de Dados

```
User Interaction
    ↓
Page Component (pages/)
    ↓
Reusable Component (components/)
    ↓
Custom Hook (hooks/ ou module hooks)
    ↓
Service Layer (services/)
    ↓
Supabase Client (lib/supabase.ts)
    ↓
Database (PostgreSQL)
    ↓
Real-time Updates (Supabase Realtime)
```

## Tecnologias por Diretório

| Diretório | Tecnologias Principais |
|-----------|------------------------|
| `src/components/` | React, TypeScript, Tailwind CSS, Lucide Icons |
| `src/pages/` | React Router, React, TypeScript, Tailwind CSS |
| `src/services/` | Supabase Client, TypeScript |
| `src/hooks/` | React Hooks, TypeScript |
| `src/store/` | Zustand, TypeScript |
| `src/types/` | TypeScript |
| `src/utils/` | TypeScript, JavaScript |
| `src/__tests__/` | Vitest, React Testing Library |
| `supabase/` | PostgreSQL, SQL, Supabase CLI |
| `docs/` | Markdown |
| `scripts/` | Node.js, Sharp (processamento de imagens) |

## Estrutura de Testes

Os testes são organizados espelhando a estrutura do código fonte:

```
src/__tests__/
├── store/
│   └── useCartStore.test.ts      # Testes do store de carrinho
└── utils/
    └── timezoneUtils.test.ts     # Testes de utilitários
```

## Configurações de Build e Tooling

| Arquivo | Propósito |
|---------|-----------|
| `vite.config.ts` | Configuração do Vite (build e dev server) |
| `vitest.config.ts` | Configuração do Vitest (testes) |
| `tailwind.config.js` | Configuração do Tailwind CSS |
| `postcss.config.js` | Configuração do PostCSS |
| `eslint.config.js` | Configuração do ESLint (linting) |
| `.prettierrc` | Configuração do Prettier (formatação) |
| `tsconfig.json` | Configuração TypeScript |
| `tsconfig.app.json` | Configuração TypeScript (código da aplicação) |
| `tsconfig.node.json` | Configuração TypeScript (configurações de build) |

## Melhorias Futuras

1. **Storybook**: Adicionar documentação visual e desenvolvimento isolado de componentes
2. **CI/CD**: Adicionar `.github/workflows/` para automação de testes e deploy
3. **Internacionalização**: Adicionar `i18n/` para suporte a múltiplos idiomas
4. **E2E Testing**: Adicionar testes end-to-end com Playwright ou Cypress
5. **API Mock**: Adicionar mocks para desenvolvimento offline
