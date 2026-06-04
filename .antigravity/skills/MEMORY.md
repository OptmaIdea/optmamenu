# 🧠 MEMORY — Contexto Geral do Projeto OptmaMenu

> **Leia este arquivo primeiro.** Ele contém o contexto essencial do projeto e as regras obrigatórias que governam toda comunicação e desenvolvimento. Todas as outras skills em `.antigravity/skills/` complementam este arquivo.

---

## 📋 Regras Obrigatórias de Comunicação

> ⚠️ **REGRA INVIOLÁVEL:** Todo texto destinado ao usuário deve ser em **Português (Brasil) — pt-BR**.

As seguintes regras de comunicação são **obrigatórias e não negociáveis** (extraídas de `ptbr_communication.md`):

1. **Idioma de Comunicação**: Todas as conversas, explicações, respostas, perguntas e interações de interface com o usuário devem ocorrer estritamente em **Português (Brasil)** (pt-BR).
2. **Documentação Interna e de Planejamento**: Todos os documentos gerados pelo agente destinados ao usuário devem ser redigidos em pt-BR. Isso inclui:
   - `implementation_plan.md` (Planos de Implementação)
   - `walkthrough.md` (Resumos de mudanças)
   - Qualquer outro arquivo de documentação no workspace
3. **Tom de Voz**: A comunicação deve ser **profissional, clara, objetiva e amigável**.

---

## 🏢 Identidade do Projeto

| Atributo | Valor |
|---|---|
| **Nome do Projeto** | OptmaMenu |
| **Ecossistema** | Optma (OptmaMenu + OptmaIdea) |
| **Tipo** | SaaS — Painel administrativo para estabelecimentos (restaurantes, lanchonetes, etc.) |
| **Idioma do Produto** | Português (Brasil) |
| **Repositório** | `d:\optmamenu` |

**Descrição**: O OptmaMenu é uma plataforma SaaS completa que oferece cardápio digital, gestão de pedidos, controle de estoque, financeiro, clientes/fidelidade, marketing e configurações para estabelecimentos alimentícios.

---

## ⚙️ Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| **Framework UI** | React | 19.x |
| **Linguagem** | TypeScript | ~5.8 |
| **Build Tool** | Vite | 7.x |
| **Estilização** | Tailwind CSS | v4 |
| **Roteamento** | React Router DOM | v7 |
| **Backend / DB** | Supabase (PostgreSQL) | SDK v2 |
| **Estado Global** | Zustand | v5 |
| **Formulários** | React Hook Form + Zod | — |
| **Animações** | Framer Motion | v12 |
| **Ícones** | Lucide React | v0.563+ |
| **Drag and Drop** | @dnd-kit | v6+ |
| **Toasts** | Sonner | v2 |
| **PWA** | vite-plugin-pwa | v1 |
| **Testes** | Vitest + Testing Library | — |
| **Formatação** | Prettier + ESLint | — |

### Comandos Principais
```bash
npm run dev          # Servidor de desenvolvimento (Vite HMR)
npm run build        # Build de produção (tsc + vite build)
npm run lint         # Verificar código com ESLint
npm run format       # Formatar com Prettier
npm run test         # Executar testes com Vitest
npm run convert:webp # Converter imagens para WebP
```

---

## 🗂️ Estrutura de Diretórios

```
d:\optmamenu\
├── .antigravity/skills/      # ← Skills e memória do agente de IA
│   ├── MEMORY.md             # Este arquivo — contexto geral
│   ├── design_system.md      # Identidade visual completa (paleta, tipografia, ícones)
│   ├── page_layout_standard.md   # Padrão de layout das páginas admin
│   ├── page_container_header_standard.md # Padrão de cabeçalhos (Flat vs Card)
│   ├── refresh_frame_standard.md # Padrão do hook useRefreshFrame
│   └── ptbr_communication.md     # Regras de idioma pt-BR
│
├── src/
│   ├── App.tsx / AppRoutes.tsx   # Entrypoint e configuração de rotas
│   ├── main.tsx                  # Bootstrap da aplicação
│   ├── index.css                 # Estilos globais e design tokens
│   │
│   ├── components/               # Componentes reutilizáveis
│   │   ├── common/               # PageContainer, botões, inputs, modais...
│   │   ├── layouts/              # PublicLayout, PrivateLayout, StoreLayout
│   │   ├── admin/                # Componentes específicos do painel admin
│   │   ├── mobile/               # Componentes mobile
│   │   ├── users/                # Componentes de usuários
│   │   └── invites/              # Componentes de convites
│   │
│   ├── pages/
│   │   ├── initial/              # Landing, Login, SignUp, Terms, PrivacyPolicy
│   │   ├── store/                # Catalog (cardápio público), Checkout
│   │   ├── CreateStore.tsx       # Onboarding de novo estabelecimento
│   │   └── private/admin/        # Painel administrativo (área logada)
│   │       ├── dashboard/        # Dashboard, Atividades, Alertas, Relatórios
│   │       ├── commercial/       # Pedidos, Canais de Venda, Pagamentos, Mensagens...
│   │       ├── customers/        # Clientes, formulários, lifecycle
│   │       ├── financial/        # Caixa (CashbookPage)
│   │       ├── products/         # Produtos, Categorias, Estoque, Transferências...
│   │       ├── suppliers/        # Fornecedores
│   │       ├── delivery/         # Delivery
│   │       ├── loyalty/          # Fidelidade avançada
│   │       ├── marketing/        # Centro de Marketing
│   │       ├── users/            # Usuários do sistema
│   │       ├── settings/         # Configurações (Loja, Perfil, Horários, Segurança...)
│   │       └── support/          # FAQ, Documentação, Legal
│   │
│   ├── services/                 # Camada de acesso a dados (Supabase)
│   │   ├── stockService.ts       # Estoque e movimentações
│   │   ├── customerService.ts    # Gestão de clientes
│   │   ├── cashbookService.ts    # Livro caixa
│   │   ├── securityService.ts    # Segurança e sessões
│   │   └── ...outros services
│   │
│   ├── store/                    # Estado global (Zustand)
│   │   ├── useAuthStore.ts       # Autenticação do usuário
│   │   ├── useUsersStore.ts      # Usuários e membros da loja
│   │   ├── useCartStore.ts       # Carrinho (área pública)
│   │   └── useCustomerAuth.ts    # Auth do cliente final
│   │
│   ├── hooks/                    # Hooks customizados
│   │   ├── useRefreshFrame.ts    # Hook do botão "Atualizar" (ver skill específica)
│   │   ├── usePermissions.ts     # Sistema de permissões
│   │   ├── useStoreMemberDetails.ts
│   │   └── ...outros hooks
│   │
│   ├── types/                    # Tipos TypeScript
│   │   ├── index.ts              # Tipos principais (Product, Category, Customer...)
│   │   ├── admin.ts              # Tipos do painel admin
│   │   ├── security.ts           # Tipos de segurança
│   │   └── ...outros tipos
│   │
│   └── utils/                    # Utilitários e helpers
│
├── supabase/                     # Migrations e configuração do Supabase
├── scripts/                      # Scripts auxiliares (convert-to-webp, serve-local)
├── docs/                         # Documentação adicional
├── public/                       # Assets públicos estáticos
└── schema_export.sql             # Exportação do schema do banco de dados
```

---

## 🗺️ Mapa de Rotas

| Rota | Componente | Área |
|---|---|---|
| `/` | Landing | Pública |
| `/login` | Login | Pública |
| `/signup` | SignUp | Pública |
| `/terms` | Terms | Pública |
| `/politica-privacidade` | PrivacyPolicy | Pública |
| `/s/:storeSlug` | Catalog | Loja Pública |
| `/cardapio/:storeSlug` | Catalog | Loja Pública |
| `/q/:storeSlug/:tableCode` | Catalog (mesa) | Loja Pública |
| `/checkout` | Checkout | Loja Pública |
| `/onboarding/create-store` | CreateStore | Onboarding |
| `/admin` | Dashboard | Admin |
| `/admin/activity` | Atividades | Admin |
| `/admin/alerts` | Alertas | Admin |
| `/admin/reports` | Relatórios | Admin |
| `/admin/orders` | Pedidos | Admin — Comercial |
| `/admin/customers` | Clientes | Admin — Comercial |
| `/admin/loyalty` | Fidelidade | Admin — Comercial |
| `/admin/commercial-dashboard` | Dashboard Comercial | Admin — Comercial |
| `/admin/sales-channels` | Canais de Venda | Admin — Comercial |
| `/admin/payment-methods` | Métodos de Pagamento | Admin — Comercial |
| `/admin/delivery` | Delivery | Admin — Comercial |
| `/admin/marketing` | Marketing | Admin — Comercial |
| `/admin/cashbook` | Caixa | Admin — Financeiro |
| `/admin/products` | Produtos | Admin — Produtos |
| `/admin/categories` | Categorias | Admin — Produtos |
| `/admin/inventory` | Estoque por Local | Admin — Produtos |
| `/admin/transfers` | Transferências | Admin — Produtos |
| `/admin/suppliers` | Fornecedores | Admin — Produtos |
| `/admin/stock-movements` | Movimentações | Admin — Produtos |
| `/admin/users` | Usuários | Admin — Configurações |
| `/admin/settings` | Configurações da Loja | Admin — Configurações |
| `/admin/my-profile` | Perfil | Admin — Configurações |
| `/admin/hours` | Horários | Admin — Configurações |
| `/admin/security` | Segurança | Admin — Configurações |
| `/admin/config` | Aparência | Admin — Configurações |
| `/admin/faq` | FAQ | Admin — Suporte |
| `/admin/docs` | Documentação | Admin — Suporte |
| `/admin/legal` | Legal | Admin — Suporte |

---

## 🎨 Design System (Resumo — ver `design_system.md` para detalhes completos)

### Fonte
```css
font-family: 'Candara', 'Plus Jakarta Sans', 'Segoe UI', -apple-system, Arial, sans-serif;
```
- **Windows**: Candara (fonte oficial da marca)
- **Fallback**: Plus Jakarta Sans (Google Fonts)

### Paleta de Cores Principais
| Cor | Uso | HEX |
|---|---|---|
| **Verde-água (Brand)** | Status ativo, sucesso, item selecionado | `#21A896` |
| **Verde-água Escuro** | Hovers, estados ativos | `#1A867A` |
| **Laranja (Primary CTA)** | Botões principais, ações primárias | `#F26541` |
| **Mostarda** | Atenção, alertas intermediários | `#FBA93C` |
| **Roxo Premium** | Totalizadores, cards de faturamento | `#7B2D8E` |
| **Vermelho** | Erros críticos, exclusões (uso exclusivo!) | `#DC2626` |
| **Off-white** | Background claro | `#F8F6F2` |
| **Cinza Quente** | Texto secundário | `#6B6258` |
| **Texto Principal** | Conteúdo principal | `#2D2A26` |

> ⚠️ **NUNCA** use azul clássico (`#3B82F6`), verde puro ou amarelo comum. O vermelho é **exclusivo** para erros/exclusões críticas.

### Ícones (Lucide React — Regra de Ouro)
Um ícone = um conceito. Não reutilize o mesmo ícone para ações diferentes.

| Seção | Ícone |
|---|---|
| Dashboard | `LayoutDashboard` |
| Comercial / Vendas | `Store` |
| Produtos / Estoque | `Package` |
| Financeiro | `DollarSign` |
| Configurações | `Settings` |
| Suporte / Ajuda | `LifeBuoy` |
| Pedidos | `ShoppingCart` |
| Clientes | `Users` |
| Fidelidade | `Star` |
| Canais de Venda | `Smartphone` |
| Métodos de Pagamento | `CreditCard` |
| Categorias | `Folders` |
| Estoque por Local | `Warehouse` |
| Transferências | `ArrowLeftRight` |
| Fornecedores | `Building2` |
| Movimentações | `Activity` |

---

## 🏗️ Padrões de Desenvolvimento

### 1. Estrutura de uma Página Admin
Toda página do painel administrativo deve seguir este padrão:

```tsx
import { useCallback } from 'react';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import PageContainer from '@/components/common/PageContainer';
import { IconName } from 'lucide-react';

export default function MinhaPage() {
  const handleRefresh = useCallback(async () => {
    // Recarregar dados do Supabase
  }, [/* dependências */]);

  useRefreshFrame(handleRefresh); // Conecta ao botão "Atualizar" global

  return (
    <PageContainer
      title="Título da Página"
      subtitle="Breve descrição do objetivo da tela"
      category="GRUPO DO MENU"   // Ex: "CONFIGURAÇÕES", "FINANCEIRO"
      icon={<IconName size={28} className="text-[#21A896]" />}
      flat  // Use flat para listagens; omita para formulários de destaque
    >
      {/* Conteúdo */}
    </PageContainer>
  );
}
```

### 2. Hook `useRefreshFrame` (obrigatório em toda página admin)
- Importar de `@/hooks/useRefreshFrame`
- Registrar a função de recarga envolve em `useCallback`
- Conecta ao botão **Atualizar** da barra de acesso rápido do `PrivateLayout`
- Evento customizado: `optmamenu.refresh`

### 3. Hook `useRealtimeListener` (obrigatório em telas sensíveis)
- Importar de `@/hooks/useRealtimeListener`
- Usa **Supabase Realtime** (`postgres_changes`) via WebSocket para escutar mudanças no banco
- **Requisito do Banco**: Para que o listener funcione, a replicação (realtime) da tabela correspondente **deve estar ativada** no Painel do Supabase (Database -> Replication -> habilitar para a tabela, ex: `orders`, `store_members`).
- **Não usar `setInterval`** como substituto para busca de dados — apenas para timers de UI
- Sempre filtrar por `store_id` e usar `enabled: !!storeId` (para tabelas vinculadas a lojas)
- Deve coexistir com `useRefreshFrame` na mesma página
- Telas obrigatórias: Pedidos (`/admin/orders`), Usuários (`/admin/users`), Dashboard, Estoque, Movimentações, Atividades, Alertas, Caixa
- **Robustez de Autenticação**: O cliente Supabase (`supabase.ts`) possui um interceptador que desloga o usuário (`signOut`) imediatamente se a sessão for revogada/invalidada no backend (evitando o estado 'zumbi' na UI).
- Ver `realtime_listener_standard.md` para o código completo do hook e exemplos

### 3. Portal de Ações Rápidas
Botões de ação globais da página (ex: "+ Novo Produto") devem ser injetados via React Portal no elemento `#quick-access-actions-portal`:

```tsx
import { createPortal } from 'react-dom';

// Dentro do componente:
{mounted && document.getElementById('quick-access-actions-portal') && createPortal(
  <button className="...">+ Nova Ação</button>,
  document.getElementById('quick-access-actions-portal')!
)}
```

### 4. Variantes do `PageContainer`
| Prop | Quando usar |
|---|---|
| `flat` | Listagens, dashboards, configurações (recomendado para a maioria) |
| *(sem flat)* | Formulários de destaque, páginas isoladas |
| `category` | Sempre informar — corresponde ao grupo do menu lateral |
| `withoutHeader={true}` | Quando o cabeçalho superior já exibe a informação |

### 5. Padrão de Acesso a Dados
- Toda comunicação com o banco de dados passa pela camada `src/services/`
- Backend: **Supabase** (PostgreSQL)
- Autenticação: Zustand (`useAuthStore`) + ProtectedRoute
- Dados do usuário logado e da loja: via `useUsersStore` e `useStoreMemberDetails`

### 6. Imagens
- Formato obrigatório: **WebP** (usar `npm run convert:webp`)
- Assets em: `public/assets/` e `src/assets/`
- Logo da marca: `/assets/OptmaMenuLogo.webp`

---

## 🔐 Autenticação e Permissões

- **Autenticação**: Supabase Auth + Zustand (`useAuthStore`)
- **Membros**: Tabela `store_members` com campo `role`
- **Permissões granulares**: Hook `usePermissions` + `permissionService.ts`
- **Segurança**: Hook `useSecurityContext` + `securityService.ts`
- **Rotas protegidas**: Componente `<ProtectedRoute />` envolve todo `/admin/*`

### Roles disponíveis (formatados via `formatLayoutRole`)
Verificar em `src/types/admin.ts` para a lista completa de roles.

---

## 📦 Estado Global (Zustand Stores)

| Store | Arquivo | Responsabilidade |
|---|---|---|
| `useAuthStore` | `store/useAuthStore.ts` | Usuário autenticado e sessão |
| `useUsersStore` | `store/useUsersStore.ts` | Usuários e membros da loja |
| `useCartStore` | `store/useCartStore.ts` | Carrinho da loja pública |
| `useCustomerAuth` | `store/useCustomerAuth.ts` | Auth do cliente final |

---

## 🌐 Layouts Disponíveis

| Layout | Arquivo | Usado em |
|---|---|---|
| `PublicLayout` | `components/layouts/PublicLayout` | `/`, `/login`, `/signup`, `/terms`, `/politica-privacidade` |
| `PrivateLayout` | `components/layouts/PrivateLayout` | Todas as rotas `/admin/*` |
| `StoreLayout` | `components/layouts/StoreLayout` | `/s/:storeSlug`, `/cardapio/:storeSlug`, etc. |

### Estrutura do PrivateLayout
- **Sidebar** (73px topo fixo): Logo + botão colapso → menu accordion + perfil + seletor de loja
- **Header** (73px fixo): ícone de rota + cronômetro de sessão + ações rápidas (loja, mensagens, alertas, tema, logout)
- **Barra de Acesso Rápido**: links irmãos + portal de ações + botão Atualizar
- **Área de Conteúdo**: onde as páginas são renderizadas

---

## 🧩 Módulos do Sistema

| Módulo | Rotas | Descrição |
|---|---|---|
| **Dashboard** | `/admin`, `/admin/activity`, `/admin/alerts`, `/admin/reports` | Visão geral, atividades, alertas e relatórios |
| **Comercial** | `/admin/orders`, `/admin/commercial-dashboard`, etc. | Pedidos, canais de venda, pagamentos, mensagens |
| **Clientes** | `/admin/customers/*` | CRM, lifecycle, formulários |
| **Fidelidade** | `/admin/loyalty`, `/admin/loyalty/advanced` | Programa de pontos e tiers |
| **Marketing** | `/admin/marketing` | Centro de marketing e campanhas |
| **Financeiro** | `/admin/cashbook` | Caixa/livro de registros financeiros |
| **Produtos** | `/admin/products`, `/admin/categories` | Cardápio e categorias |
| **Estoque** | `/admin/inventory`, `/admin/transfers`, `/admin/stock-movements` | Controle de estoque por local, transferências, movimentações |
| **Compras** | `/admin/cashbook/purchases`, `/admin/stock/purchase-documents` | Ledger de compras, documentos, cotações |
| **Fornecedores** | `/admin/suppliers` | Gestão de fornecedores e lifecycle |
| **Delivery** | `/admin/delivery` | Configuração de entrega |
| **Usuários** | `/admin/users` | Membros e permissões do painel |
| **Configurações** | `/admin/settings`, `/admin/my-profile`, `/admin/hours`, `/admin/security`, `/admin/config` | Loja, perfil, horários, segurança, aparência |
| **Suporte** | `/admin/faq`, `/admin/docs`, `/admin/legal` | FAQ, documentação, termos legais |

---

## 📚 Skills Relacionadas

Consulte os arquivos abaixo para diretrizes específicas antes de desenvolver:

| Skill | Arquivo | Quando consultar |
|---|---|---|
| **Identidade Visual Completa** | `design_system.md` | Sempre que criar/editar UI |
| **Layout de Páginas Admin** | `page_layout_standard.md` | Ao criar páginas do painel |
| **Cabeçalhos (Flat vs Card)** | `page_container_header_standard.md` | Ao usar o `PageContainer` |
| **Hook de Refresh** | `refresh_frame_standard.md` | Ao criar páginas com recarregamento de dados |
| **Listener Realtime** | `realtime_listener_standard.md` | Ao criar/editar telas sensíveis (pedidos, estoque, dashboard...) |
| **Comunicação pt-BR** | `ptbr_communication.md` | Sempre |

---

## 👤 Identidade do Usuário Logado (Sidebar/Header)

> ⚠️ **REGRA CRÍTICA**: `profiles` NÃO tem `internal_alias`. Nunca buscar alias em `profiles`.

### Separação de responsabilidades

| Tabela | Dados |
|---|---|
| `profiles` | Nome, telefone, CPF, endereço, redes sociais, `avatar_url` |
| `store_members` | `internal_alias` (apelido por loja), `job_title`, `department` |

### Como salvar (tela Meus Dados)
```ts
// 1. Dados pessoais → profiles:
await updateCurrentUserProfile({ name, phone, ... });  // sem internalAlias

// 2. Apelido → store_members:
await updateMyStoreMemberAlias({ storeId: getActiveStoreId(), internalAlias });
```

### Como buscar o apelido na sidebar
```ts
const { data: memberRow } = await supabase
    .from('store_members')
    .select('internal_alias, avatar_url')
    .eq('user_id', user.id)
    .eq('store_id', selectedMembership.store_id)
    .maybeSingle();

const displayName =
    selectedMembership?.internal_alias ||  // RPC retorna se FIX.3 aplicado
    memberRow?.internal_alias ||           // query direta (RLS safe via user_id)
    profileRow?.name ||                   // nome completo
    user.email?.split('@')[0] || 'Usuário';

const fullName =
    profileRow?.name ||
    selectedMembership?.profile_name ||
    user.email;
```

> 📄 Detalhes completos: `docs/9.9H-arquitetura-identidade-usuario.md`

### Pendente no Supabase (FIX.3)
Adicionar `sm.internal_alias` na CTE e no `jsonb_build_object` da função
`get_current_user_security_context_v2` para eliminar a query extra no layout.

---

*Última atualização: 2026-06-04 | Adicionada seção de identidade do usuário (profiles vs store_members).*
