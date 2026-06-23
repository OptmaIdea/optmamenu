# OptmaMenu - Documentação do Projeto

## Visão Geral

Sistema SaaS multi-tenant para **gestão de restaurantes/delivery** com catálogo digital, pedidos, fidelidade, estoque, financeiro e administração completa.

---

## Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 19 + TypeScript + Vite 7 |
| **Styling** | TailwindCSS 4 + PostCSS |
| **Estado** | Zustand (stores) + React Hook Form + Zod |
| **UI** | Radix UI + Lucide Icons + Framer Motion |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| **Roteamento** | React Router DOM 7 |
| **PWA** | vite-plugin-pwa + Workbox |
| **Testes** | Vitest + React Testing Library + jsdom |
| **Qualidade** | ESLint 9 + TypeScript ESLint + Prettier |

---

## Arquitetura

### Dual Client Supabase (`src/lib/supabase.ts`)

```typescript
// Admin/Backoffice - Auth padrão Supabase
export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// Customer/Loja - SEM GoTrue auth, injeta JWT customizado
export const supabaseCustomer = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: async (url, options) => {
      // Injeta Authorization: Bearer <customer_jwt> em REST/RPC/Storage/Functions
    }
  }
});
```

### Roteamento & Permissões (`src/AppRoutes.tsx`)

| Tipo | Rotas | Proteção |
|------|-------|----------|
| **Públicas** | `/`, `/login`, `/signup`, `/terms`, `/s/:slug`, `/q/:slug/:table` | `PublicLayout` |
| **Protegidas** | `/admin/*` | `ProtectedRoute` + `RequirePermission` + `RequireActiveStoreMember` |

**RBAC Granular**: Permissões por feature (`orders.view`, `products.view`, `security.view`, etc.)

---

## Módulos Principais (Admin)

```
📁 Dashboard
  ├─ Atividade, Alertas, Relatórios, Comercial

📁 Comercial
  ├─ Pedidos, Clientes, Fidelidade, Canais de Venda, Mensagens, Marketing

📁 Financeiro
  ├─ Caixa (Cashbook)

📁 Produtos/Estoque
  ├─ Produtos, Categorias, Inventário por local, Transferências
  ├─ Fornecedores, Compras, Movimentações, Cotações, Insights

📁 Usuários
  ├─ Gestão de membros/permissões

📁 Configurações
  ├─ Perfil, Horários, Mensagens, Segurança, Pagamentos, Delivery
```

---

## Segurança & Multi-tenancy

- **RLS (Row Level Security)** no Supabase - policies por `store_id`
- **Edge Function**: `issue_customer_jwt` emite JWTs para clientes
- **Roles**: `owner`, `manager`, `staff` + permissions granulares
- **Active Store Context**: `localStorage` + hook `useActiveStoreId`

---

## Banco de Dados (`supabase/migrations/`)

**30+ migrations** evolutivas. Tabelas core:

| Tabela | Descrição |
|--------|-----------|
| `stores` | Lojas/tenants |
| `store_memberships` | Usuários ↔ Lojas (role, status) |
| `products`, `categories` | Catálogo |
| `orders`, `order_items` | Pedidos |
| `customers` | Clientes da loja |
| `loyalty_*` | Programa de fidelidade |
| `stock_movements` | Movimentações de estoque |
| `suppliers` | Fornecedores |
| `cashbook_entries` | Lançamentos financeiros |
| `store_hours` | Horários de funcionamento |

**RPCs** para lógica complexa (ex: `get_default_admin_landing_path_v3`)

---

## Estrutura de Pastas (src/)

```
src/
├── components/          # Componentes reutilizáveis
│   ├── admin/          # Componentes específicos do admin
│   ├── common/         # UI genérica (buttons, modals, etc)
│   ├── invites/        # Convites de loja/membros
│   ├── layouts/        # PublicLayout, PrivateLayout, StoreLayout
│   ├── mobile/         # Componentes mobile-first
│   └── users/          # User-related components
├── hooks/              # Custom hooks organizados por domínio
│   ├── inventory/      # Estoque
│   ├── security/       # Segurança/permissões
│   ├── stock/          # Movimentações
│   └── store/          # Loja ativa
├── pages/              # Páginas (lazy loaded)
│   ├── initial/        # Landing, auth, legal
│   ├── private/        # Admin (dashboard, commercial, products, settings...)
│   └── store/          # Catálogo público, checkout
├── services/           # Camada de serviços (Supabase RPCs, REST)
├── store/              # Zustand stores (auth, cart, users)
├── types/              # TypeScript types (barrel exports)
├── utils/              # Helpers (permissions, date, pricing, etc)
└── lib/                # Clients (supabase, jwt)
```

---

## Scripts Disponíveis

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "serve:local": "node scripts/serve-local.cjs",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:watch": "vitest",
  "preview": "vite preview",
  "convert:webp": "node scripts/convert-to-webp.js"
}
```

---

## Variáveis de Ambiente Obrigatórias

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> ⚠️ **Nota**: `src/lib/supabase.ts:8` tem fallback hardcoded `'SEU_ANON_KEY_AQUI'` - validar no build.

---

## Pontos de Atenção

1. **React 19** - versão beta/RC, monitorar breaking changes
2. **Migrations** - 30+ arquivos, considerar squash/consolidação
3. **Tipos `any`** - 263 erros de lint `@typescript-eslint/no-explicit-any`
4. **React Hooks** - múltiplas violações `setState` em `useEffect`, `exhaustive-deps`
5. **Funções impuras** - `Math.random()`, `Date.now()` durante render

---

## Próximos Passos Recomendados

- [ ] Remover fallback hardcoded da anon key
- [ ] Adicionar validação de env vars no build (fail fast)
- [ ] Corrigir violations de React Hooks (setState em effects)
- [ ] Substituir `any` por tipos explícitos
- [ ] Consolidar migrations antigas
- [ ] Adicionar testes de integração (checkout, auth, permissions)
- [ ] Documentar RPCs e schema no README
- [ ] Migrar para React 19 estável quando lançado

---

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build produção
npm run build

# Verificar tipos
npx tsc --noEmit

# Lint + fix
npm run lint:fix

# Formatar
npm run format

# Testes
npm run test

# Preview build
npm run preview
```

---

*Documentação gerada em 23/06/2026 - Atualizar conforme evolução do projeto*