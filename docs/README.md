# OptmaMenu — Documentação Oficial do Projeto

> **Versão Oficial:** `0.10.0-rc.1` (Fase 10 — Loja Pública, Microsite Comercial e Experiência do Cliente)
> **Repositório:** `OptmaIdea/optmamenu`
> **Branch Principal:** `main`


---

## 📚 Documentação Ativa Autorizada

A documentação do OptmaMenu é organizada em 10 documentos autoritativos na raiz de `docs/`. Qualquer investigação técnica ou tomada de decisão deve priorizar estes arquivos:

| Documento | Assunto / Conteúdo |
|---|---|
| 📋 [`docs/PROJECT_STATUS.md`](./PROJECT_STATUS.md) | Status executivo do projeto, versão `0.10.0-rc.1`, ambiente, ressalvas e pendências |
| 🏗️ [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | Arquitetura técnica, convenções de código, roteamento, Supabase, Realtime e Vercel |
| 🎯 [`docs/PRODUCT_AND_ROADMAP.md`](./PRODUCT_AND_ROADMAP.md) | Visão institucional do produto, evolução das fases e roadmap estratégico |
| 🔐 [`docs/SECURITY_AND_PERMISSIONS.md`](./SECURITY_AND_PERMISSIONS.md) | Usuários, papéis, permissões hierárquicas em realtime, RLS, audit logs e Meu Histórico |
| 🗄️ [`docs/DATABASE_REFERENCE.md`](./DATABASE_REFERENCE.md) | Referência oficial do banco Supabase/PostgreSQL, tabelas, views, RPCs e hardening |
| ⚙️ [`docs/OPERATIONS_GUIDE.md`](./OPERATIONS_GUIDE.md) | Guia operacional de Produtos, Estoque Multilocal, Compras, Fornecedores e PDV Rápido |
| 🛒 [`docs/COMMERCIAL_AND_CUSTOMERS.md`](./COMMERCIAL_AND_CUSTOMERS.md) | Pedidos, Venda Direta, Clientes 360, Fidelidade, Central de Marketing e Atacado |
| 🏬 [`docs/PUBLIC_STORE_PHASE_10.md`](./PUBLIC_STORE_PHASE_10.md) | Especificação da Fase 10: Loja Pública, Microsite Mobile-First e Checkout |
| 📝 [`docs/CHANGELOG_FASES.md`](./CHANGELOG_FASES.md) | Histórico resumido de fases, versões e notas de entrega |
| 📁 [`docs/archive/README.md`](./archive/README.md) | Repositório documental histórico e preservação de relatórios legados |

---

## ⚡ Guia Prático para Agentes e Desenvolvedores

1. **Vou desenvolver uma nova tela admin?** Leia [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) e a skill `.agents/skills/page_container_header_standard/SKILL.md`.
2. **Vou adicionar uma nova permissão?** Siga o checklist em [`docs/SECURITY_AND_PERMISSIONS.md`](./SECURITY_AND_PERMISSIONS.md).
3. **Vou consultar/criar uma RPC ou Tabela?** Consulte [`docs/DATABASE_REFERENCE.md`](./DATABASE_REFERENCE.md) e verifique os arquivos em `supabase/migrations/`.
4. **Vou trabalhar na Loja Pública / Checkout?** Leia [`docs/PUBLIC_STORE_PHASE_10.md`](./PUBLIC_STORE_PHASE_10.md).
