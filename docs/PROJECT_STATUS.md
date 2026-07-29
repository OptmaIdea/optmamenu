# Status do Projeto OptmaMenu

> **Última Atualização:** 29/07/2026 (Auditoria Documental Homologada)  

> **Versão Oficial Atual:** `0.10.0-rc.1` (Release Candidate — Início da Fase 10)  
> **Branch de Produção:** `main`  
> **Snapshot de Commit EmProdução:** `5eeb3b3bcd63e00ecb8ad92f64de70ebd18d9cc6`  

---

## 🏢 Visão Geral do Estado Atual

O **OptmaMenu** é um SaaS completo para gestão comercial e operacional de estabelecimentos alimentícios (restaurantes, lanchonetes, padarias, mercados e delivery).

A plataforma encerrou com sucesso a **Fase 9** (Governança, Usuários, Permissões Hierárquicas em Realtime, Segurança e Hardening de Advisors Supabase) e a reformulação completa do módulo de **Produtos, Estoque Multilocal e Vida do Produto**.

Atualmente, o projeto iniciou a **Fase 10 — Loja Pública, Microsite Comercial e Experiência do Cliente**, sob a versão `0.10.0-rc.1`.

---

## 🗺️ Módulos Concluídos e Homologados

| Módulo / Frente | Status | Descrição |
|---|---|---|
| **Produtos & Categorias** | Concluído | Gestão de catálogo, imagens WebP otimizadas, códigos de barras/SKU e categorias com grupos de precificação |
| **Estoque Multilocal & Vida do Produto** | Concluído | Saldos por localização física, histórico de preços/margens (`DateRangeFilter`), transferências internas e ajuste de divergências |
| **PDV & Venda Direta** | Concluído | Interface rápida para operador de caixa, atalhos, fechamento parcial e prévia de comanda digital |
| **Livro Diário & Financeiro** | Concluído | Fechamento diário de caixa, sangrias, reforços, classificação em plano de contas e conciliação de divergências |
| **Usuários, Equipe & Segurança** | Concluído | Separação entre `profiles` e `store_members`, papéis, funções personalizadas, realtime de permissões e Meu Histórico (`/admin/my-history`) |
| **Configurações Centralizadas** | Concluído | Painel unificado por abas (Dados da Loja, Horários, Pedido Online, Mensagens/LGPD, Pagamentos e Aparência) |
| **Clientes, Fidelidade & Marketing** | Concluído | Visão Clientes 360, programa de recompensas com biblioteca de mídias e mensageria assistida via WhatsApp |

---

## ⚠️ Ressalvas e Testes Conhecidos

1. **Suíte de Testes Automatizados**:
   - Total de testes: 43.
   - Status: **42/43 Aprovados**.
   - **Falha Conhecida Preexistente**: 1 falha em `src/__tests__/utils/timezoneUtils.test.ts` referente à formatação de offset ISO. Esta falha é conhecida, isolada e não afeta as operações em produção.

2. **Dependência do Ecossistema Optma**:
   - **OptmaSMSGate**: O repositório irmão `OptmaIdea/optmasmsgate` está em desenvolvimento paralelo para prover a infraestrutura de mensageria SMS e WhatsApp via gateways dedicados.

---

## 🚀 Próximas Etapas (Fase 10)

1. Desenvolvimento do **Microsite Comercial Mobile-First** (catálogo público dinâmico via slug `/loja/:slug`).
2. Autenticação simplificada do cliente final (visitante x cliente cadastrado).
3. Checkout público com reserva automática de estoque e expiração parametrizada.
4. Homologação final e testes assistidos para o lançamento oficial do marco estável `1.0.0` (planejado para 01/08/2026).
