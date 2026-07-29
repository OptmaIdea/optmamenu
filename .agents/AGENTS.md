# 🧠 MEMORY — Contexto Geral do Projeto OptmaMenu

> **Leia este arquivo primeiro.** Ele contém o contexto essencial do projeto e as regras obrigatórias que governam comunicação, documentação e desenvolvimento. Todas as outras skills em `.antigravity/skills/` complementam este arquivo.

---

## 📋 Regras Obrigatórias de Comunicação

> ⚠️ **REGRA INVIOLÁVEL:** Todo texto destinado ao usuário deve ser em **Português (Brasil) — pt-BR**.

1. Todas as conversas, explicações, respostas, perguntas e interações de interface com o usuário devem ocorrer estritamente em **Português (Brasil)**.
2. Documentos internos destinados ao usuário também devem ser em pt-BR.
3. O tom deve ser profissional, claro, objetivo e amigável.

---

## 📋 Regras Obrigatórias de Desenvolvimento e Documentação

1. **Atualização da Estrutura:** a cada alteração na estrutura física do projeto, atualizar `docs/ESTRUTURA.md`.
2. **Banco de Dados:** não criar migrations SQL, tabelas, views, triggers ou funções sem solicitação explícita do usuário.
3. **Documentação:** ao concluir uma frente funcional, atualizar os documentos relevantes em `docs/` e, quando houver memória nova importante, atualizar este arquivo.
4. **RPCs:** RPCs novas ou alteradas devem ser documentadas em `docs/RPCS_AND_VIEWS.md`.
5. **Advisors Supabase:** problemas de Advisors devem ser tratados em rodada própria, sem misturar hardening de linter com fechamento funcional de UX.
6. **Commits e Push Automáticos:** a cada conjunto de alterações ou correções concluídas e validadas, realizar automaticamente o `git add`, `git commit` e `git push` para manter o GitHub e o Vercel sempre atualizados.

---

## 🏢 Identidade do Projeto

| Atributo | Valor |
|---|---|
| Nome do Projeto | OptmaMenu |
| Ecossistema | Optma (OptmaMenu + OptmaIdea) |
| Tipo | SaaS — painel administrativo para estabelecimentos alimentícios |
| Idioma do Produto | Português (Brasil) |
| Versão Atual | `0.10.0-rc.1` (Início da Fase 10 — Loja Pública, Microsite Comercial e Experiência do Cliente) |
| Repositório local | `OptmaMenu (Workspace)` |

O OptmaMenu oferece cardápio digital, gestão de pedidos, controle de estoque, compras, transferências, fornecedores, clientes, fidelidade, marketing, financeiro e configurações.

---

## ⚙️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite |
| Estilização | Tailwind CSS v4 |
| Rotas | React Router DOM v7 |
| Backend | Supabase / PostgreSQL |
| Estado | Zustand |
| Formulários | React Hook Form + Zod |
| Ícones | Lucide React |
| Toasts | Sonner |

Comandos principais:

```bash
npm run dev
npm run build
npm run lint
npm run format
npm run test
npm run convert:webp
```

---

## 🗂️ Estrutura principal

```txt
src/
├── App.tsx / AppRoutes.tsx
├── components/
│   ├── common/
│   ├── layouts/
│   ├── security/
│   │   └── PermissionLocked.tsx
│   ├── users/
│   └── invites/
├── hooks/
│   ├── usePermissions.ts
│   ├── useRealtimeListener.ts
│   ├── useRefreshFrame.ts
│   └── security/
├── pages/
│   ├── store/
│   └── private/admin/
│       ├── dashboard/
│       ├── commercial/
│       ├── customers/
│       ├── financial/
│       ├── products/
│       ├── suppliers/
│       ├── users/
│       ├── settings/
│       └── support/
├── services/
├── store/
├── types/
└── utils/
    └── permissionEvents.ts
```

Documentação principal em `docs/`.

---

## 🗺️ Mapa funcional atual

| Área | Rotas principais |
|---|---|
| Pessoal | `/admin/my-profile`, `/admin/my-history` |
| Dashboard | `/admin`, `/admin/activity`, `/admin/alerts`, `/admin/reports` |
| Comercial | `/admin/orders`, `/admin/customers`, `/admin/commercial-dashboard`, `/admin/sales-channels`, `/admin/messages-admin`, `/admin/marketing`, `/admin/loyalty` |
| Financeiro | `/admin/cashbook` |
| Produtos | `/admin/products`, `/admin/categories`, `/admin/inventory`, `/admin/transfers`, `/admin/suppliers`, `/admin/stock/movements` |
| Usuários e equipe | `/admin/users` |
| Configurações | `/admin/settings` com abas internas |
| Segurança | `/admin/security` com abas internas |
| Suporte | `/admin/faq`, `/admin/docs`, `/admin/legal` |

---

## 🎨 Design System — Resumo

Fonte:

```css
font-family: "Plus Jakarta Sans", Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

Cores principais:

| Cor | Uso | HEX |
|---|---|---|
| Verde-água | Status ativo/sucesso/seleção | `#19A999` |
| Laranja/Coral | Ações primárias | `#F1613A` |
| Mostarda | Atenção | `#FAA832` |
| Roxo | Premium/indicadores especiais | `#7B2D8E` |
| Vermelho | Erro/exclusão crítica | `#DC2626` |
| Off-white | Background claro | `#F9F6F0` / `#F8F6F2` |

> Não usar azul clássico como cor principal. Vermelho é exclusivo para erro, exclusão ou criticidade.

---

## 🏗️ Padrões de Desenvolvimento

### Página admin

Toda página do painel deve usar `PageContainer` e `useRefreshFrame` quando tiver dados recarregáveis.

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

### Realtime

- Usar `useRealtimeListener` em telas sensíveis.
- Não substituir realtime por `setInterval`.
- Filtrar por `store_id` quando aplicável.
- Para permissões, usar o fluxo central em `store_permission_versions` via `usePermissions`.

### Portal de ações rápidas

Botões globais da página podem usar o portal `#quick-access-actions-portal`.

---

## 🔐 Autenticação, usuários e permissões

- Autenticação: Supabase Auth + Zustand (`useAuthStore`).
- Membros: `store_members`.
- Dados globais: `profiles`.
- Rotas `/admin/*`: protegidas por `ProtectedRoute` e permissões específicas.

### Separação `profiles` x `store_members`

| Tabela | Responsabilidade |
|---|---|
| `profiles` | Nome, CPF, data de nascimento, dados globais, avatar global |
| `store_members` | Vínculo com loja, papel, status, apelido, contatos, avatar do vínculo, permissões, ações sensíveis |

Nunca buscar `internal_alias` em `profiles`; o apelido por loja fica em `store_members`.

---

## 📚 Leituras Recomendadas para Agentes AI

Novos agentes de IA devem consultar prioritariamente a documentação ativa autorizada na raiz de `docs/`:

- `docs/README.md` — Guia de início rápido e índice da documentação
- `docs/PROJECT_STATUS.md` — Status executivo v0.10.0-rc.1 e pendências
- `docs/ARCHITECTURE.md` — Arquitetura técnica e convenções
- `docs/SECURITY_AND_PERMISSIONS.md` — Governança de usuários, permissões e RLS
- `docs/DATABASE_REFERENCE.md` — Modelo de dados, RPCs e Views
- `docs/PUBLIC_STORE_PHASE_10.md` — Especificação da Fase 10 (Loja Pública e Microsite)

> ⚠️ **Aviso**: Consultar `docs/archive/` apenas para investigação histórica. Não usar arquivo arquivado como fonte vigente sem confirmar a implementação real no código.

---

## 🔐 Sistema de permissões — Estado consolidado

Documentos principais:

- `docs/SECURITY_AND_PERMISSIONS.md`
- `docs/DATABASE_REFERENCE.md`


### Hierarquia final

1. Permissão individual em `store_members.permissions`.
2. Função personalizada em `store_custom_roles.permissions`.
3. Papel base em `store_role_permission_templates`.
4. Fallback seguro `false`.
5. `owner` ignora checagens comuns e tem acesso integral.

> O modelo ativo **não usa** `store_member_permissions`; overrides individuais ficam em `store_members.permissions`.

### Realtime de permissões

- Tabela central: `store_permission_versions`.
- Hook: `src/hooks/usePermissions.ts`.
- Escuta direta somente `store_permission_versions`.
- Listeners diretos de `store_role_permission_templates`, `store_custom_roles` e `store_members` foram removidos do fluxo principal para evitar duplicidade, logs excessivos e `CHANNEL_ERROR`.

### `view=false`

- Oculta menu/aba.
- Protege rota.
- Acesso direto pela URL redireciona corretamente.
- Fallback seguro: `/admin/my-profile`.

### `manage=false`

- Tela em modo leitura.
- Inputs/selects/switches desabilitados.
- Botões de ação ocultos.
- Sem toast desnecessário.
- Sem erro de console.
- Usar `PermissionLocked` e `LockedHint` quando aplicável.

Arquivo:

- `src/components/security/PermissionLocked.tsx`

### Segurança

- Grupo separado no sidebar: **SEGURANÇA**.
- Rota: `/admin/security`.
- `security.view` é porteira absoluta.
- Sem `security.view`, nenhuma aba `security.*.view` abre.
- `/admin/security` normaliza para a primeira aba permitida quando a raiz está liberada.

### Configurações — Opção B

- Grupo sidebar: **CONFIGURAÇÕES**.
- Item único: **Configurações da Loja**.
- Rota: `/admin/settings`.
- Abas internas:
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

### Permissões novas/refinadas

- `commercial.dashboard.view`
- `commercial.sales_channels.view`
- `commercial.sales_channels.manage`
- `settings.hours.view`
- `settings.hours.manage`

---

## 📦 Estado Global

| Store | Arquivo | Responsabilidade |
|---|---|---|
| `useAuthStore` | `store/useAuthStore.ts` | Usuário autenticado e sessão |
| `useUsersStore` | `store/useUsersStore.ts` | Usuários e membros da loja |
| `useCartStore` | `store/useCartStore.ts` | Carrinho da loja pública |
| `useCustomerAuth` | `store/useCustomerAuth.ts` | Auth do cliente final |

---

## 🌐 Layouts

| Layout | Arquivo | Usado em |
|---|---|---|
| `PublicLayout` | `components/layouts/PublicLayout` | Rotas públicas |
| `PrivateLayout` | `components/layouts/PrivateLayout` | Rotas `/admin/*` |
| `StoreLayout` | `components/layouts/StoreLayout` | Loja pública |

### PrivateLayout

- Sidebar com menus condicionados por permissão.
- Header com ações rápidas.
- Botão global Atualizar via `useRefreshFrame`.
- Atualização suave de permissões via `usePermissions`.

---

## 🧩 Módulos do Sistema

| Módulo | Descrição |
|---|---|
| Dashboard | Visão geral, atividades, alertas e relatórios |
| Comercial | Pedidos, canais de venda, clientes, fidelidade, mensagens e marketing |
| Financeiro | Livro diário/caixa |
| Produtos | Cardápio, categorias, estoque, transferências, compras e fornecedores |
| Usuários e Equipe | Membros, papéis, histórico e dados do vínculo |
| Configurações | Configurações da loja centralizadas em abas |
| Segurança | Senhas e Acesso, permissões e ações sensíveis |
| Suporte | FAQ, documentação e legal |

---

## 📚 Skills relacionadas

| Skill | Arquivo | Quando consultar |
|---|---|---|
| Identidade visual | `design_system.md` | Sempre que criar/editar UI |
| Layout admin | `page_layout_standard.md` | Ao criar páginas do painel |
| Cabeçalhos | `page_container_header_standard.md` | Ao usar `PageContainer` |
| Refresh | `refresh_frame_standard.md` | Ao criar telas com botão Atualizar |
| Realtime | `realtime_listener_standard.md` | Ao criar/editar telas sensíveis |
| Comunicação pt-BR | `ptbr_communication.md` | Sempre |

---

## Pendências estratégicas atuais

1. Registrar alteração de função/papel no Meu Histórico do usuário afetado.
2. Registrar andamento de solicitações cadastrais no Meu Histórico.
3. Consolidar fluxo de caixa (reconciliação de ocorrências de divergência no fechamento do caixa do dia).
4. Refinar abas de Recebíveis Pendentes no Livro Diário.
5. Evoluir interface de Venda Direta / PDV rápido com regras de descontos.
6. Preparação final, testes reais assistidos e homologação para lançamento oficial em 01/08/2026.

---

*Última atualização: 2026-07-29 | Definição da versão 0.10.0-rc.1 (Início da Fase 10 — Loja Pública, Microsite Comercial e Experiência do Cliente).*
