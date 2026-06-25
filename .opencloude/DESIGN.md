# DESIGN.md — OptmaMenu

> Sistema de Design Oficial do OptmaMenu — Painel Administrativo para Estabelecimentos Alimentícios
> Ecossistema Optma (OptmaMenu + OptmaIdea)
> Atualizado em: 2026-06-25

---

## 1. CORES (Color)

### 1.1 Paleta da Marca

| Token | HEX | Uso |
|---|---|---|
| `brand-green` | `#21A896` | Verde-água — status ativo, sucesso, concluído, links, hover, foco, seleção |
| `brand-dark` | `#1A867A` | Verde-água escuro — hover profundo, bordas ativas, gradientes |
| `brand-orange` | `#F26541` | Laranja vibrante — botões CTA primários, ações de destaque |
| `brand-light` | `#FBA93C` | Mostarda — alertas, atenção, estoque baixo, ícone de rota ativa |
| `brand-purple` | `#7B2D8E` | Roxo premium — totalizadores, cards de faturamento, indicadores especiais |
| `brand-purple-light` | `#B77ED8` | Roxo claro — fundos e hovers de elementos roxos |
| `brand-gray` | `#6B6258` | Cinza quente — texto secundário, badges neutros |
| `warning-red` | `#DC2626` | Vermelho — **exclusivo** para erro crítico, falha, exclusão, estoque zerado |

### 1.2 Paleta Neutra

| Uso | Light | Dark |
|---|---|---|
| Background página | `#F8F6F2` (off-white) | `gray-950` (`#030712`) |
| Surface/Card | `white` | `gray-800` (`#1F2937`) |
| Texto primário | `#2D2A26` (gray-800) | `gray-100` (`#F3F4F6`) |
| Texto secundário | `#6B6258` (gray-500) | `gray-400` (`#9CA3AF`) |
| Borda/Divisor | `rgba(107,98,88,0.1)` | `gray-700` (`#374151`) |
| Input bg | `gray-50` (`#F9FAFB`) | `gray-700` (`#374151`) |

### 1.3 Badges e Status

| Significado | Fundo | Texto | Ícone (Lucide) |
|---|---|---|---|
| Total / Faturamento | `#7B2D8E` | white | `BarChart3` / `TrendingUp` |
| Sucesso / Ativo / Pago | `#21A896` | white | `CheckCircle2` |
| Pendente / Em preparo | `#F26541` | white | `Clock` |
| Estoque baixo / Rascunho | `#FBA93C` | `#2D2A26` | `AlertTriangle` |
| Cancelado / Neutro | `#6B6258` | white | `XCircle` / `Archive` |
| Crítico / Erro | `#DC2626` | white | `Skull` / `AlertOctagon` |

> ⚠️ **Restrições:** Não usar azul clássico (`#3B82F6`). Vermelho exclusivo para erro/exclusão. Cards de faturamento devem usar roxo, não azul.

---

## 2. TIPOGRAFIA (Typography)

### 2.1 Font Stack

```css
font-family: 'Candara', 'Plus Jakarta Sans', 'Segoe UI', -apple-system, Arial, sans-serif;
```

- **Candara** — fonte principal (primeira escolha, Windows)
- **Plus Jakarta Sans** — fallback premium (macOS/iOS/Linux/Android) — carregada via Google Fonts
- Peso 400 (Regular) para corpo de texto
- Peso 600-700 (Semibold / Bold) para títulos, badges, botões

### 2.2 Tamanhos

| Elemento | Classe | Tamanho | Peso |
|---|---|---|---|
| Título de página (H1) | `text-2xl md:text-3xl font-black` | 24-30px | 900 |
| Subtítulo | `text-sm md:text-base` | 14-16px | 400 |
| Cabeçalho de card | `text-lg font-bold` | 18px | 700 |
| Corpo | `text-sm` | 14px | 400 |
| Label / Badge | `text-xs font-semibold` | 12px | 600 |
| Categoria (breadcrumb) | `text-xs font-semibold uppercase tracking-wider` | 12px | 600 |
| Sidebar item | `text-xs font-bold` | 12px | 700 |
| Sidebar grupo ativo | `text-[13px] font-black` | 13px | 900 |

### 2.3 Utility Classes

- `.font-candara` — peso 400
- `.font-candara-bold` — peso 700

---

## 3. ESPAÇAMENTO (Spacing)

### 3.1 Grid

- Container máximo: `max-w-7xl` (1280px) páginas admin
- Container loja pública: `max-w-5xl`
- Grid responsivo automático: `.auto-grid` — `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem`
- Gutter entre cards/seções: `space-y-6 md:space-y-8`

### 3.2 Padding

| Componente | Padding |
|---|---|
| Card padrão | `p-6` |
| Card header | `px-6 py-5` |
| Sidebar | `p-4` |
| PageContainer conteúdo | `space-y-6 md:space-y-8` |
| Input | `px-4 py-2.5` |
| Botão | `px-4 py-2` |

### 3.3 Border Radius

| Componente | Raio |
|---|---|
| Cards | `rounded-2xl` (16px) |
| Botões primários | `rounded-[50px]` (pill) |
| Botões secundários | `rounded-xl` (12px) |
| Inputs | `rounded-xl` (12px) |
| Modais | `rounded-lg` / `rounded-2xl` |
| Avatar/Badge | `rounded-full` |
| Sidebar item ativo | `rounded-xl` |

### 3.4 Sombras

| Elemento | Light | Hover |
|---|---|---|
| Card | `shadow-sm` | `hover:shadow-md` / `hover:shadow-lg` |
| Card numérico | `0 2px 8px rgba(0,0,0,0.04)` | `0 8px 24px rgba(0,0,0,0.08)` + `translateY(-2px)` |
| Botão CTA | `0 4px 12px rgba(242,101,65,0.3)` | `0 6px 16px rgba(242,101,65,0.4)` + `translateY(-2px)` |
| Sidebar | `shadow-xl` (mobile) |
| Dropdown | `shadow-xl` |
| Modal | `shadow-xl` |

---

## 4. LAYOUT

### 4.1 Estrutura Principal

```
+----------------------------------------------------------+
|  HEADER (73px fixo) — ícone rota + nome + ações + tema   |
+----------------------------------------------------------+
|  BARRA DE ACESSO RÁPIDO — rotas irmãs + portal de ações  |
+----------------------------------------------------------+
|  SIDEBAR (288px / 80px colapsada)  |  CONTEÚDO PRINCIPAL  |
|  +-------------------------------+  |  (rolável)            |
|  | Logo + collapse                |  |                      |
|  | Loja ativa                     |  |  PageContainer        |
|  | Usuário logado                 |  |  +--- category        |
|  | Menu accordion (9 seções)     |  |  +--- title           |
|  |   - Pessoal                    |  |  +--- subtitle        |
|  |   - Dashboard                  |  |  +--- children        |
|  |   - Comercial                  |  |                      |
|  |   - Financeiro                 |  |                      |
|  |   - Produtos                   |  |                      |
|  |   - Usuários                   |  |                      |
|  |   - Configurações              |  |                      |
|  |   - Segurança                  |  |                      |
|  |   - Suporte                    |  |                      |
|  | Tema + Sair                    |  |                      |
|  | Copyright                      |  |                      |
|  +-------------------------------+  |                      |
+----------------------------------------------------------+
```

### 4.2 PrivateLayout (Admin)

- **Sidebar:** Colapsável (288px ↔ 80px), accordion com uma seção aberta por vez. Itens com permissão `view=false` são ocultos. Loja ativa exibe logo, nome e papel. Usuário exibe apelido e tempo de sessão.
- **Header:** 73px fixo. Lado esquerdo: hamburger (mobile) + ícone mostarda + nome da rota em laranja. Centro: relógio da sessão. Direito: ícone loja, sino de mensagens, sino de alertas (com pulse se >0), dark mode toggle, logout vermelho.
- **Barra de Acesso Rápido:** Abaixo do header. Mostra pills de rotas irmãs + botão Atualizar + `#quick-access-actions-portal` para ações das páginas.
- **Conteúdo:** Rolável, com `MyStoreInvitesBanner` no topo e `<Outlet />`.

### 4.3 PublicLayout

- Header fixo branco com logo, dark mode toggle, login/signup (desktop), hamburger (mobile)
- Footer fixo inferior com copyright e links legais
- Botão flutuante scroll-to-top (verde, 200px)
- Fundo: `bg-[#F8F6F2]`

### 4.4 StoreLayout (Loja Pública)

- Botão WhatsApp flutuante (verde)
- FAB de carrinho (laranja) com contador de badge
- `CartDrawer` fixo
- Footer simples

### 4.5 Páginas

Toda página admin usa `PageContainer` com variantes `flat` (minimalista) ou `default` (gradiente + blur decorativo). Suporta `withoutHeader` para evitar duplicação com o header global.

### 4.6 Responsividade

- Tailwind breakpoints padrão: sm (640px), md (768px), lg (1024px), xl (1280px)
- Sidebar: drawer overlay em mobile, fixa em md+
- Grid adaptável com `auto-grid` (min 280px por coluna)
- Tabelas responsivas com overflow-x em mobile

---

## 5. COMPONENTES (Components)

### 5.1 Componentes Comuns

| Componente | Descrição |
|---|---|
| `PageContainer` | Wrapper de página com header, refresh, action slot, variantes flat/default |
| `DataCard` | Card reutilizável com título, badge, ação, footer |
| `StatsCard` | Card de métrica com ícone colorido, valor, indicador de tendência |
| `ProgressCard` | Card de progresso com barra animada, 3 variantes de cor |
| `RecentActivity` | Feed de atividade com avatar, ícone, timestamp, badge |
| `LoadingSpinner` | Spinner centralizado, 3 tamanhos, cor `#21A896` |
| `AlertBanner` | Banner dismissível com 4 variantes (success/warning/error/info) |
| `CookieConsent` | Banner GDPR com accept/reject, persistência localStorage |
| `EmptyState` | Estado vazio com ícone, título, descrição e ação |
| `EmptyTableState` | Estado vazio para linhas de tabela (colSpan) |
| `BackToTopButton` | Botão fixo scroll-to-top (320px) |
| `InfoTooltip` | Tooltip informativo com ícone Info |
| `SecurityConfirmModal` | Modal de confirmação em 2 etapas (senha + token 6 dígitos) |
| `DateRangeFilter` | Seletor de período, portal em quick-access |
| `OrderStatusFilter` | Filtro de status de pedido, portal em quick-access |
| `InfoCard` | Card de info editável com flag sensível |
| `MetaTags` | Gerenciador de SEO dinâmico (title, OG, Twitter, JSON-LD) |

### 5.2 Componentes de Layout

| Componente | Descrição |
|---|---|
| `PublicLayout` | Layout público com header, footer, scroll-to-top, dark mode |
| `PrivateLayout` | Layout admin com sidebar accordion, header, quick-access bar, refresh |
| `StoreLayout` | Layout loja pública com WhatsApp, cart FAB, CartDrawer |

### 5.3 Componentes de Segurança

| Componente | Descrição |
|---|---|
| `ProtectedRoute` | Guarda de rota: verifica sessão, redireciona para /login |
| `RequirePermission` | Guarda de permissão: acesso negado com countdown |
| `RequireActiveStoreMember` | Verifica vínculo ativo com loja |
| `PermissionLocked` | Desabilita UI quando usuário não tem permissão de escrita |
| `LockedHint` | Dica visual "modo leitura" |

### 5.4 Componentes de Usuário

| Componente | Descrição |
|---|---|
| `UserCard` | Card de usuário na lista |
| `UserDetailModal` | Modal com detalhes completos |
| `UserFormModal` | Modal de criação/edição |
| `UserInvitesPanel` | Painel de convites pendentes |
| `UserRoleBadge` | Badge de papel com cor |
| `UserStatusBadge` | Badge de status (ativo/inativo/suspenso) |

### 5.5 Outros Componentes

| Componente | Descrição |
|---|---|
| `MyStoreInvitesBanner` | Banner de convites com botões aceitar |
| `NotificationReceiver` | Receptor PWA de notificações |
| `StorePreview` | Mockup de celular para preview visual da loja |
| `LoyaltyPoints` | UI completa de fidelidade: opt-in, saldo, tiers, recompensas, vouchers, extrato |

### 5.6 Botões

- `.button-primary` — gradiente laranja vertical (`#F26541` → `#E05A36`), `border-radius: 50px`, sombra laranja
- Botões secundários — fundo branco, borda `gray-200`, `rounded-xl`
- Hover: `translateY(-2px)` + sombra elevada

### 5.7 Cards Numéricos

```css
.card-numerico {
  border-radius: 16px;
  padding: 1.25rem;
  border-left: 4px solid;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.card-numerico:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
```

- Borda roxa (`#7B2D8E`) para totalizadores
- Borda verde-água (`#21A896`) para ativos
- Borda laranja (`#F26541`) para pendentes
- Borda mostarda (`#FBA93C`) para alertas
- Borda vermelha (`#DC2626`) para críticos

### 5.8 Glass Card

```css
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

---

## 6. MOVIMENTO (Motion)

### 6.1 Animações CSS

```css
.animate-fadeIn   — opacity 0→1, translateY(10px→0), 0.4s
.animate-slideDown — opacity 0→1, translateY(-10px→0), 0.2s
.animate-slideIn  — opacity 0→1, translateX(-20px→0), 0.3s
.animate-spin-slow — rotação 360°, 1s linear infinite
.card-hover:hover  — translateY(-4px), shadow, 0.3s
```

### 6.2 Transições

- `transition-all duration-300` — sidebar collapse, dark mode, hover cards
- `transition-colors duration-300` — tema escuro/claro
- Hover cards: `transform 0.3s ease, box-shadow 0.3s ease`
- Sidebar: `transition-all duration-300` com `translate-x` para mobile
- Botão Atualizar: animação de rotação durante refresh

### 6.3 framer-motion

Disponível para animações de página e modais (transições de rota, abertura/fechamento de modais).

### 6.4 Efeitos Especiais

- Alerta de inventário: `animate-pulse` no ícone `Bell` quando `attentionCount > 0`
- Loading spinner: `animate-spin`
- `backdrop-blur-sm` no overlay mobile da sidebar
- `blur-3xl` nos círculos decorativos do PageContainer default
- Botão scroll-to-top: `transition-opacity duration-300`

---

## 7. VOZ (Voice)

### 7.1 Idioma

- **Português (Brasil)** — obrigatório em toda interface
- Tom profissional, claro, objetivo e amigável

### 7.2 Convenções de Texto

- Botões: verbos no imperativo ("Salvar", "Excluir", "Criar", "Atualizar")
- Títulos: substantivos curtos ("Pedidos", "Produtos", "Estoque")
- Subtítulos: frases descritivas curtas ("Gerencie os produtos do seu cardápio")
- Erros: "Não foi possível carregar os dados. Tente novamente."
- Confirmações: "Tem certeza que deseja excluir este item?"
- Placeholders: "Digite o nome do produto..."
- Empty states: "Nenhum pedido encontrado" + ação "Criar primeiro pedido"
- Badges de papel: "Proprietário", "Administrador", "Gerente", "Operador de estoque", "Caixa", "Vendas", "Equipe", "Visualizador"

### 7.3 Toast (Sonner)

- `toast.success()` — operação concluída
- `toast.error()` — falha crítica
- `toast.warning()` — alerta (ex: acesso suspenso)
- `toast.info()` — informação (ex: onboarding pendente)

---

## 8. MARCA (Brand)

### 8.1 Identidade

| Atributo | Valor |
|---|---|
| Nome | OptmaMenu |
| Tipo | SaaS — Painel Administrativo para Estabelecimentos Alimentícios |
| Ecossistema | Optma (OptmaMenu + OptmaIdea) |
| Público-alvo | Donos/gerentes de restaurantes, lanchonetes, bares, padarias |
| Proposta | Cardápio digital + gestão de pedidos + estoque + financeiro |
| URL base | `/admin/*` para painel, `/s/:storeSlug` para loja pública |

### 8.2 Logo

- Arquivo: `/assets/OptmaMenuLogo.webp`
- Favicon: `/assets/OptmaMenuLogo.ico`
- Altura na sidebar: `h-10` (40px) expandida, `h-6` colapsada
- Favorito forçado com `?timestamp` para evitar cache

### 8.3 PWA

- `theme_color: '#21A896'`
- `background_color: '#ffffff'`
- Service worker em `public/sw.js`
- Notificações push via `NotificationReceiver`

### 8.4 Dark Mode

- Detecção de preferência do sistema + toggle manual
- Persistência: `localStorage('theme')`
- Classe: `.dark` no `<html>`
- Todos os componentes usam `dark:` variants

### 8.5 Ícones (Lucide React)

**Navegação principal:**
- Dashboard: `LayoutDashboard`
- Comercial: `Store`
- Produtos: `Package`
- Financeiro: `DollarSign`
- Configurações: `Building`
- Segurança: `Shield`
- Suporte: `LifeBuoy`

**Comercial:**
- Pedidos: `ShoppingBag`
- Clientes: `Users`
- Fidelidade: `Heart` / `Star`
- Canais de venda: `RadioTower`
- Mensagens: `MessageSquare`
- Marketing: `Megaphone`

**Produtos e Estoque:**
- Categorias: `Layers`
- Estoque: `FileText`
- Transferências: `ArrowRightLeft`
- Fornecedores: `Truck`
- Movimentações: `History`
- Compras: `ShoppingBag`

---

## 9. ANTIPADRÕES (Anti-patterns)

### ❌ O que NÃO fazer

1. **Usar azul clássico** (`#3B82F6`, `blue-500`, `blue-600`) como cor principal. Substituir por roxo ou verde-água.
2. **Usar vermelho para sucesso** — vermelho é exclusivo para erro, exclusão e criticidade.
3. **Repetir ícones para conceitos diferentes** — cada ícone deve representar apenas uma ação/tabela.
4. **Duplicar cabeçalhos** — quando o header global já mostra o título da rota, usar `withoutHeader` no PageContainer.
5. **Componentes locais de navegação** com ícones circulares gigantes no meio das páginas — usar a barra de acesso rápido e portal.
6. **Atalhos redundantes no topo da sidebar** ("Admin", "Ver Loja") — reduz ruído visual.
7. **Perfil do usuário duplicado** no rodapé da sidebar — o perfil fica apenas no topo da área rolável.
8. **Usar `setInterval` para polling** em vez de `useRealtimeListener` com Supabase Realtime.
9. **Criar migrations SQL, tabelas ou funções sem solicitação explícita** do usuário.
10. **Usar `bg-gray-50` como fundo de página** no modo claro — usar `bg-[#F8F6F2]` (off-white).
11. **Usar emojis na interface** — substituir por ícones Lucide em containers circulares translúcidos.
12. **Fazer fetch de `internal_alias` em `profiles`** — o apelido por loja está em `store_members`.
13. **Buscar dados de permissão diretamente em `store_member_permissions`** — overrides individuais ficam em `store_members.permissions`.
14. **Múltiplas seções do accordion da sidebar abertas ao mesmo tempo** — apenas uma seção pode ficar aberta por vez.
15. **Implementar modais de confirmação sem `SecurityConfirmModal`** para ações sensíveis.

---

## A. MAPA DE ROTAS

### A.1 Rotas Públicas (`PublicLayout`)

| Rota | Página | Descrição |
|---|---|---|
| `/` | Landing | Página de marketing inicial |
| `/login` | Login | Autenticação |
| `/signup` | SignUp | Cadastro |
| `/terms` | Terms | Termos de uso |
| `/politica-privacidade` | PrivacyPolicy | Política de privacidade |

### A.2 Rotas de Loja Pública (`StoreLayout`)

| Rota | Página | Descrição |
|---|---|---|
| `/s/:storeSlug` | Catalog | Cardápio público |
| `/loja/:storeSlug` | Catalog | Alias português |
| `/cardapio/:storeSlug` | Catalog | Alias cardápio |
| `/q/:storeSlug/:tableCode` | Catalog | Modo mesa (QR code) |
| `/mesa/:storeSlug/:tableCode` | Catalog | Alias mesa |
| `/checkout` | Checkout | Finalização de pedido |

### A.3 Rotas Protegidas — Admin (`PrivateLayout`)

| Grupo | Rotas |
|---|---|
| **Pessoal** | `/admin/my-profile`, `/admin/my-history` |
| **Dashboard** | `/admin`, `/admin/activity`, `/admin/alerts`, `/admin/reports` |
| **Comercial** | `/admin/orders`, `/admin/sales-channels`, `/admin/commercial-dashboard`, `/admin/customers`, `/admin/customers/new`, `/admin/customers/:id/edit`, `/admin/customers/:id`, `/admin/loyalty`, `/admin/loyalty/advanced`, `/admin/messages-admin`, `/admin/marketing` |
| **Financeiro** | `/admin/cashbook` |
| **Produtos** | `/admin/products`, `/admin/categories`, `/admin/inventory`, `/admin/products/lifecycle`, `/admin/transfers`, `/admin/transfers/:id`, `/admin/suppliers`, `/admin/suppliers/:id/lifecycle`, `/admin/suppliers/:id`, `/admin/stock/purchase-documents`, `/admin/stock/quotations`, `/admin/stock/movements`, `/admin/cashbook/purchases`, `/admin/stock/purchase-insights` |
| **Usuários** | `/admin/users` |
| **Configurações** | `/admin/settings` (abas: store, commercial, orders, hours, stock, delivery, payment, messages, legal, system, appearance) |
| **Segurança** | `/admin/security` (abas: sessions, roles, custom_roles, permissions, pin) |
| **Suporte** | `/admin/legal`, `/admin/faq`, `/admin/docs` |

---

## B. FUNCIONALIDADES (Módulos)

### B.1 Dashboard
- Painel operacional com métricas em tempo real
- Atividades recentes
- Alertas do sistema
- Relatórios

### B.2 Comercial
- Gestão de pedidos (CRUD + histórico)
- Canais de venda (configuração de canais)
- Dashboard comercial (analytics)
- CRM de clientes (cadastro, ciclo de vida, formulário)
- Programa de fidelidade (configuração, pontos, tiers, recompensas, vouchers)
- Central de mensagens
- Marketing/promoções

### B.3 Financeiro
- Livro diário/caixa (entradas e saídas)

### B.4 Produtos e Estoque
- Gestão de produtos (cardápio digital)
- Categorias
- Estoque por localização
- Ciclo de vida do produto
- Transferências entre locais
- Fornecedores (gestão e ciclo de vida)
- Compras (documentos, insights, cotações)
- Movimentações de estoque

### B.5 Usuários e Equipe
- Membros da loja
- Papéis e funções
- Histórico pessoal
- Convites

### B.6 Configurações
- Dados da loja
- Configurações comerciais
- Pedido online (slug, layout, regras)
- Horários de funcionamento
- Estoque (regras)
- Entrega
- Pagamento
- Mensagens
- Documentos e termos
- Sistema
- Aparência (cores, logo, banner)

### B.7 Segurança
- Senhas e acesso
- Sessões ativas
- Permissões (papéis base + funções personalizadas)
- Ações sensíveis (PIN/token de confirmação)

### B.8 Suporte
- FAQ
- Documentação
- Termos legais

---

## C. TECNOLOGIAS

| Camada | Tecnologia |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite |
| Estilização | Tailwind CSS v4 |
| Rotas | React Router DOM v7 |
| Estado | Zustand |
| Formulários | React Hook Form + Zod |
| Ícones | Lucide React |
| Animações | framer-motion |
| Toasts | Sonner |
| Backend | Supabase / PostgreSQL |
| Drag & Drop | @dnd-kit |
| Machine | colorthief |

---

## D. HOOKS DO SISTEMA

| Hook | Função |
|---|---|
| `usePermissions` | Gerenciamento de permissões em tempo real |
| `useRealtimeListener` | Escuta de mudanças no Supabase Realtime |
| `useRefreshFrame` | Evento global de refresh (`optmamenu.refresh`) |
| `useOrderMonitor` | Monitoramento de pedidos em tempo real |
| `useIdleSessionTimeout` | Timeout de sessão ociosa |
| `useInventoryAttentionCount` | Contagem de alertas de estoque |
| `useSecurityContext` | Contexto de segurança do usuário |

---

## E. PADRÕES DE PÁGINA ADMIN

```tsx
import { useCallback } from 'react';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import PageContainer from '@/components/common/PageContainer';

export default function MinhaPage() {
  const handleRefresh = useCallback(async () => {
    // recarregar dados
  }, []);

  useRefreshFrame(handleRefresh);

  return (
    <PageContainer
      title="Título"
      subtitle="Descrição breve"
      category="GRUPO"
      flat
    >
      {/* conteúdo */}
    </PageContainer>
  );
}
```

---

---

## F. ANÁLISE UX — 3 CAMADAS DE INTERAÇÃO

### F.1 Visão Geral das Personas

| Camada | Persona | Ambiente | Objetivo |
|---|---|---|---|
| **A** | Visitante / Lojista potencial | Landing Page (`PublicLayout`) | Conhecer a solução e converter-se em usuário |
| **B** | Lojista / Gestor | Painel Admin (`PrivateLayout`) | Gerenciar estoque, vendas, financeiro, equipe |
| **C** | Cliente final | Loja Pública / Catálogo (`StoreLayout`) | Visualizar cardápio e comprar |

### F.2 Camada A — Landing Page (Persona: lojista potencial)

**Estado atual:**
- Hero simples com headline + CTA único (`/signup`)
- 2 seções de cards genéricos (Ideal para + Características)
- Sem navbar fixo próprio (herda do `PublicLayout`)
- Sem prova social, demonstração, preview do produto, depoimentos ou estatísticas
- Apenas 1 call-to-action em toda a página

** Problemas identificados:**
- Falta hierarquia de conversão — nenhum diferencial competitivo é vendido visualmente
- `StorePreview` (mockup de celular) existe no código mas não é usado na landing
- Sem seção "Como funciona" em passos
- Sem demonstração interativa do catálogo público

**Recomendações de melhoria:**
1. **Hero com preview interativo** — mockup de celular rodando o catálogo público ao lado do texto, com navegação suave (framer-motion)
2. **Seção "Como funciona"** em 3 passos com ilustrações e animação de scroll
3. **Preview real usando `StorePreview`** — exibir o cardápio de uma loja demo
4. **Seção de números** — "X lojas ativas", "Y pedidos processados" com contador animado
5. **Depoimentos em carrossel** com fotos de lojistas, nota e frase de efeito
6. **Footer com links estratégicos** — login, cadastro, termos, FAQ

### F.3 Camada B — Painel Admin (Persona: lojista/gestor)

**Estado atual:**
- Sidebar accordion com 9 seções e ~30 itens, condicionados por permissão
- Dashboard com `StatsCard`, `ProgressCard`, `RecentActivity`, `AlertBanner`
- `PageContainer` com variantes flat/default, suporte a `withoutHeader`
- Permissões granulares por view/manage com `PermissionLocked`
- Onboarding redireciona para `/my-profile` mas sem orientação visual
- Refresh global via evento `optmamenu.refresh` e `useRefreshFrame`

** Problemas identificados:**
- Sidebar densa demais para mobile — sem busca, sem bottom-nav alternativa
- Dashboard genérico — métricas sem contexto acionável para cada papel
- Onboarding raso — não guia o lojista no primeiro uso
- Mobile: sidebar drawer overlay ok, mas conteúdo admin não adapta interações para toque
- `PermissionLocked` desabilita inputs sem explicar o motivo claramente

**Recomendações de melhoria:**
1. **Sidebar com busca** — campo `Search` que filtra itens do menu pelo nome
2. **Dashboard personalizado por papel** — `owner` vê financeiro, `cashier` vê pedidos, `stock_operator` vê estoque
3. **Tour guiado no primeiro acesso** — overlay com `framer-motion` explicando os módulos principais
4. **Cards de atalho acionáveis** — "3 pedidos pendentes → Ver pedidos", "Estoque baixo → Conferir"
5. **Mobile: bottom navigation** substitui sidebar em telas < md com 5 abas fixas
6. **PageContainer responsivo** — headers ocupam menos espaço em mobile, ações migram para bottom sheet
7. **Notificações com preview dropdown** — resumo sem navegar, com ação direta

### F.4 Camada C — Loja Pública (Persona: cliente final)

**Estado atual:**
- `Catalog.tsx` — 1380 linhas monolíticas, difícil manter
- Carrinho inline na página principal junto com produtos
- `Checkout.tsx` — URL de loja hardcoded (`gelinharessjn`)
- 4 banners/cards informativos empilhados antes dos produtos
- Login em 4 estados (menu, password, register, OTP, welcome) no mesmo componente
- `CartDrawer` importado mas comentado no código

** Problemas identificados:**
- Monolito de 1380 linhas — todo o estado e UI da loja pública em um só arquivo
- Carrinho inline polui o layout — deveria ser drawer ou bottom sheet
- Checkout hardcoded (store slug fixo) — quebra para multi-loja
- Seções desordenadas — cliente demora a ver o que importa (produtos)
- Banners fixos/sticky com cores que conflitam com o design system
- Login complexo demais para cliente final

**Recomendações de melhoria (prioridade máxima):**
1. **Ativar `CartDrawer`** (já existe, está comentado) — remover seção inline de carrinho
2. **Reordenar seções: produtos primeiro** — banners informativos depois ou em abas
3. **Banners recolhíveis** — cards colapsáveis com `show more / show less`
4. **Refatorar Checkout** — remover hardcoded, usar dados dinâmicos do store
5. **Bottom sheet para filtros** em mobile (categoria e busca)
6. **Sticky FAB "Fechar pedido"** quando carrinho tiver itens (já existe no `StoreLayout`)
7. **Simplificar login do cliente** — apenas telefone + OTP, sem estados intermediários
8. **Quebrar `Catalog.tsx`** em componentes menores:
   - `StoreHeader`
   - `StoreBanners`
   - `ProductGrid`
   - `CartSection` (ou usar o drawer)
   - `CustomerAuthModal`

---

## G. PRIORIDADE DE MELHORIAS UX/UI

| Prioridade | Melhoria | Camada | Impacto | Esforço |
|---|---|---|---|---|
| 🔴 Alta | Ativar CartDrawer + remover carrinho inline | C | Cliente vê produtos primeiro | Baixo |
| 🔴 Alta | Desacoplar Checkout de hardcoded | C | Multi-loja funcional | Médio |
| 🔴 Alta | Quebrar Catalog.tsx em componentes | C | Manutenibilidade | Alto |
| 🟡 Média | Landing com preview interativo + provas sociais | A | Conversão de visitantes | Alto |
| 🟡 Média | Tour guiado onboarding + dashboard personalizado | B | Retenção de lojistas | Alto |
| 🟢 Baixa | Busca na sidebar + bottom nav mobile | B | Navegação admin | Médio |
| 🟢 Baixa | Banners recolhíveis na loja pública | C | Poluição visual | Baixo |

---

*Este documento segue o schema Open Design 9-section e descreve todo o sistema de design, componentes, layouts, funcionalidades e padrões visuais do OptmaMenu. Inclui análise de UX para as 3 camadas de interação (Landing, Admin, Loja Pública).*

*Atualizado em: 2026-06-25 | Contexto: Sessão de análise de UI/UX com recomendações para evolução operacional e visual.*
