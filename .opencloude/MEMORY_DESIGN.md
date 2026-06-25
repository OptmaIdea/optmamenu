# MEMÓRIA DE SESSÃO — UI/UX OptmaMenu

> Sessão: 2026-06-25
> Contexto: Análise de frontend, criação do DESIGN.md, recomendações de UX para 3 camadas de interação

---

## Resumo da Sessão

1. **Exploração completa do frontend** — mapeamento de todos os componentes, layouts, páginas, rotas, hooks e estilos do OptmaMenu
2. **Criação do `DESIGN.md`** seguindo schema Open Design 9-section (color, typography, spacing, layout, components, motion, voice, brand, anti-patterns)
3. **Pesquisa sobre Open Design** — ferramenta open-source (nexu-io/open-design) alternativa ao Claude Design, que usa DESIGN.md para gerar artefatos visuais via agentes de IA
4. **Análise UX das 3 camadas de interação**:
   - **Camada A** (Landing Page — lojista potencial)
   - **Camada B** (Painel Admin — lojista/gestor)
   - **Camada C** (Loja Pública — cliente final)

---

## Estrutura do .opencloude

```
.opencloude/
├── DESIGN.md      # Sistema de design completo + análise UX + prioridades
└── MEMORY.md      # Esta memória de sessão
```

---

## Principais Descobertas

### Stack Frontend
React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router DOM v7 + Zustand + Lucide React + framer-motion

### 3 Layouts Principais
- `PublicLayout` — landing, login, signup, termos
- `PrivateLayout` — admin com sidebar accordion, header 73px, barra de acesso rápido
- `StoreLayout` — loja pública com FABs WhatsApp/carrinho

### Problemas Críticos Identificados
| # | Problema | Local |
|---|---|---|
| 1 | Catalog.tsx monolítico (1380 linhas) | `src/pages/store/Catalog.tsx` |
| 2 | CartDrawer importado mas comentado | `Catalog.tsx` linha 11 |
| 3 | Checkout com URL hardcoded | `src/pages/store/Checkout.tsx` linha 72/87/98 |
| 4 | Landing sem preview interativo | `src/pages/initial/home/Landing.tsx` |
| 5 | Sidebar admin densa sem busca | `src/components/layouts/PrivateLayout.tsx` |

---

## Próximos Passos (Priorizados)

### Fase Operacional (antes de UI/UX)
1. Evoluir parte operacional do sistema (conforme decisão do usuário)
2. Preparar terreno para melhorias de UI/UX

### Fase UI/UX (futuro)
1. 🔴 Ativar `CartDrawer` e remover carrinho inline do Catalog
2. 🔴 Desacoplar slugs hardcoded do Checkout
3. 🔴 Refatorar Catalog.tsx em componentes menores
4. 🟡 Melhorar Landing Page com preview interativo
5. 🟡 Tour guiado de onboarding
6. 🟢 Busca na sidebar + bottom nav mobile

---

## Links Uteis

- Open Design (ferramenta): https://open-design.ai | https://github.com/nexu-io/open-design
- Design system skill: `.antigravity/skills/design_system.md`
- MEMORY principal do projeto: `.antigravity/skills/MEMORY.md`
- Layout skill: `.antigravity/skills/page_layout_standard.md`
- Página admin padrão: skill `page_container_header_standard.md`
