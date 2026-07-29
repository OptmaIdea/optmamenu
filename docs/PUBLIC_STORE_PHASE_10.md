# Especificação Técnica da Fase 10 — Loja Pública, Microsite Comercial e Experiência do Cliente

> **Versão Oficial:** `0.10.0-rc.1`
> **Status:** Release Candidate (Início da Fase 10)
> **Última Validação:** 29/07/2026
> **Fonte Principal:** Handoff homologado (`docs/archive/handoffs/HANDOFF_FASE_10_LOJA_PUBLICA_MICROSITE_COMERCIAL_20260729.md`)

---

## 📑 Sumário

1. [Escopo, Visão Geral e Urgência Responsável](#1-escopo-visão-geral-e-urgência-responsável)
2. [Direção Visual, Área Institucional e Microsite Mobile-First](#2-direção-visual-área-institucional-e-microsite-mobile-first)
3. [Mapeamento de Rotas Reais no Código e Aliases](#3-mapeamento-de-rotas-reais-no-código-e-aliases)
4. [Governança de Estoque Online, Reserva Mínima Local e Limite Máximo](#4-governança-de-estoque-online-reserva-mínima-local-e-limite-máximo)
5. [Regras de Carrinho sem Reserva ao Adicionar e Reserva no Checkout](#5-regras-de-carrinho-sem-reserva-ao-adicionar-e-reserva-no-checkout)
6. [Identidade do Cliente e OptmaSMSGate como Dependência Futura](#6-identidade-do-cliente-e-optmasmsgate-como-dependência-futura)
7. [Fidelidade, Histórico e Área do Cliente](#7-fidelidade-histórico-e-área-do-cliente)
8. [Meios de Pagamentos, Modalidades de Entrega e Opções de Frete](#8-meios-de-pagamentos-modalidades-de-entrega-e-opções-de-frete)
9. [Publicidade de Terceiros, Banners Promocionais e Moderação de Conteúdo](#9-publicidade-de-terceiros-banners-promocionais-e-moderação-de-conteúdo)
10. [Analytics, Métrica de Conversão e Inteligência Comercial](#10-analytics-métrica-de-conversão-e-inteligência-comercial)
11. [Planos Comerciais, Níveis SaaS e Feature Flags](#11-planos-comerciais-níveis-saas-e-feature-flags)
12. [Detalhamento Completo das Subfases 10.1 a 10.9](#12-detalhamento-completo-das-subfases-101-a-109)
13. [Matriz de Factualidade e Classificação das Capacidades](#13-matriz-de-factualidade-e-classificação-das-capacidades)

---

## 1. Escopo, Visão Geral e Urgência Responsável

A **Fase 10** representa o marco comercial de expansão do OptmaMenu para o consumidor final. O estabelecimento ganha um microsite comercial de alta conversão, responsivo e independente de aplicativos nativos pesados, operando diretamente no navegador móvel do cliente.

- **Objetivo Comercial**: Permitir que o estabelecimento venda via WhatsApp, redes sociais e QR Code presencial sem pagar comissões abusivas por pedido a intermediários.
- **Princípio da Urgência Responsável**: Garantir que o aumento de fluxo online não comprometa o estoque físico da loja presencial, não gere sobrecarga operacional no balcão e não resulte em pedidos sem atendimento.

---

## 2. Direção Visual, Área Institucional e Microsite Mobile-First

- **Design System**: Mobile-first, adaptável a telas desktop, desenvolvido em Tailwind CSS v4, com suporte a tema claro e escuro.
- **Área Institucional do Estabelecimento**:
  - Banner de capa (`store_cover_url`) e logomarca oficial (`store_logo_url`).
  - Identificação institucional completa: Razão Social, Nome Fantasia, CNPJ, Telefone e Endereço Físico.
  - Indicador de status da loja em tempo real (Aberto / Fechado / Pausado para pedidos).
  - Horários de funcionamento detalhados por dia da semana (`store_hours`).
  - Mensagem personalizada de boas-vindas e aviso de sobrecarga quando o tempo de espera exceder o padrão.

---

## 3. Mapeamento de Rotas Reais no Código e Aliases

As **rotas reais** do microsite público e da experiência do cliente implementadas no arquivo autêntico [`src/AppRoutes.tsx`](../src/AppRoutes.tsx) são:

| Rota / Padrão | Tipo | Descrição e Finalidade | Status no Código |
|---|---|---|---|
| `/loja/:storeSlug` | Rota Principal (pt-BR) | Acesso primário amigável ao microsite comercial | `EXISTENTE` |
| `/s/:storeSlug` | Alias Curto | Link reduzido para compartilhamento em redes e SMS | `EXISTENTE` |
| `/cardapio/:storeSlug` | Alias Legado | Compatibilidade com links descritivos pré-existentes | `EXISTENTE` |
| `/q/:storeSlug/:tableCode` | Rota QR Code Curta | Acesso rápido por QR Code de mesa ou comanda | `EXISTENTE` |
| `/mesa/:storeSlug/:tableCode` | Rota QR Code Amigável | Acesso descritivo por mesa no restaurante | `EXISTENTE` |
| `/checkout` | Checkout Público | Tela unificada de finalização de pedido do cliente | `EXISTENTE` |
| `/p/:publicOrderToken` | Rastreamento Público | Acompanhamento de pedido via token público seguro | `EXISTENTE` |

---

## 4. Governança de Estoque Online, Reserva Mínima Local e Limite Máximo

Para evitar o esgotamento do estoque presencial da loja física por vendas virtuais aceleradas, a disponibilidade do catálogo público obedece às regras de segurança:

### 4.1 Fórmulas Matemáticas de Disponibilidade

O saldo físico disponível total no estabelecimento é calculado por:

$$\text{saldo\_fisico\_disponivel} = \text{on\_hand} - \text{reserved}$$

A quantidade disponível para exibição e venda online considera a `reserva_minima_local` (para proteger as vendas de balcão) e o `limite_maximo_online` parametrizado pelo gestor da loja:

$$\text{disponivel\_online} = \min\left( \max(0, \text{saldo\_fisico\_disponivel} - \text{reserva\_minima\_local}), \text{limite\_maximo\_online} \right)$$

---

## 5. Regras de Carrinho sem Reserva ao Adicionar e Reserva no Checkout

> ⚠️ **CONTRATO RIGOROSO DE RESERVA DE ESTOQUE**:
> 1. **Adicionar ao Carrinho**: Apenas valida se `disponivel_online > 0`. **NÃO cria reserva física** no banco de dados.
> 2. **Alterar Quantidade no Carrinho**: Revalida a quantidade solicitada contra `disponivel_online`. **NÃO cria reserva física**.
> 3. **Iniciar Checkout (Preenchimento de Dados)**: **Cria a reserva temporária** na tabela `stock_reservations` com TTL (Tempo de Vida) parametrizado (ex: 15 minutos).
> 4. **Finalizar Pedido (Confirmação)**: Converte a reserva temporária em itens efetivos do pedido (`orders` / `order_items`).
> 5. **Abandonar Checkout / Expirar TTL**: O serviço de limpeza remove a reserva temporária expirada e restaura o saldo `disponivel_online`.

---

## 6. Identidade do Cliente e OptmaSMSGate como Dependência Futura

> ⚠️ **DECLARAÇÃO FORMAL DE DEPENDÊNCIA**: O projeto `OptmaIdea/optmasmsgate` (repositório independente) está em fase de fundação de backend e **NÃO é uma integração ativa ou dependência obrigatória do OptmaMenu v0.10.0-rc.1**.

- **Comportamento Atual (`EXISTENTE`)**: Validação básica de contato via número de WhatsApp e direcionamento do pedido com mensagem formatada via link `wa.me`.
- **Comportamento Futuro (`DEPENDENTE DO SMSGATE`)**: Envio automatizado de códigos OTP de verificação via SMS e WhatsApp API oficial através do gateway dedicado OptmaSMSGate.

---

## 7. Fidelidade, Histórico e Área do Cliente

- **Área do Cliente**: Acesso rápido ao histórico de pedidos ativos e concluídos.
- **Acúmulo de Pontos**: Atribuído automaticamente após a conclusão do pedido para clientes identificados por CPF/E-mail.
- **Resgate de Prêmios**: Vouchers de desconto e itens gratuitos do catálogo de prêmios cadastrados na biblioteca `reward_media_library`.

---

## 8. Meios de Pagamentos, Modalidades de Entrega e Opções de Frete

### 8.1 Meios de Pagamento Suportados
- **Dinheiro**: Com indicação opcional do valor para troco (`troco_para`).
- **Cartões (Débito / Crédito)**: Pagamento presencial na entrega ou retirada através da maquininha da loja.
- **Pix Estático / Chave Cadastrada**: (`HOMOLOGADA`) Exibição da chave Pix e instrução para envio do comprovante.
- **Pix Dinâmico / QR Code API**: (`PLANEJADA`) Geração de cobrança Pix dinâmica com reconciliação automática via gateway parceiro.

### 8.2 Modalidades de Atendimento e Frete
- **Entrega (Delivery)**: Exige preenchimento de endereço e bairro. Frete calculado por tabela fixa por bairro/região.
- **Retirada (Takeout)**: Cliente realiza a retirada presencial no balcão da loja sem cobrança de frete.
- **Consumo no Local (Mesa / Comanda)**: Identificado pelas rotas `/q/:storeSlug/:tableCode` e `/mesa/:storeSlug/:tableCode`.

---

## 9. Publicidade de Terceiros, Banners Promocionais e Moderação de Conteúdo

- **Banners Promocionais da Loja**: Gestão de banners rotativos cadastrados no painel administrativo em Configurações de Aparência.
- **Publicidade de Terceiros**: Quando ativada pelo plano comercial do estabelecimento, exige rotulagem clara obrigatoriamente com a tag `"Publicidade"` ou `"Conteúdo Patrocinado"`.
- **Moderação e Denúncia**: Canal direto no rodapé para reporte de inconsistências de cardápio ou abuso.
- **Proteção a Menores (Segurança Infantil)**: Restrição compulsória para produtos da categoria de bebidas alcoólicas, exigindo confirmação de maioridade (+18) antes da adição ao carrinho.

---

## 10. Analytics, Métrica de Conversão e Inteligência Comercial

- **Métricas do Microsite**: Registro anônimo de visualizações de página, produtos mais consultados e taxa de conversão (carrinho iniciado vs pedidos finalizados).
- **Funil de Vendas Online**: Indicadores consolidados exibidos no Comercial Dashboard do painel administrativo.

---

## 11. Planos Comerciais, Níveis SaaS e Feature Flags

As funcionalidades ativas no microsite público são controladas pelas feature flags da loja (`stores.config`):
- `online_orders_enabled`: Habilita o recebimento de pedidos online.
- `loyalty_enabled`: Ativa a exibição do programa de fidelidade para o cliente.
- `table_orders_enabled`: Ativa o módulo de atendimento em mesa via QR Code.

---

## 12. Detalhamento Completo das Subfases 10.1 a 10.9

- **Fase 10.1 — Governança de Slugs e Roteamento**: Mapeamento de `/loja/:slug`, `/s/:slug` e `/cardapio/:slug`. (`HOMOLOGADA`)
- **Fase 10.2 — Microsite Comercial e Catálogo Mobile-First**: Apresentação visual, busca de produtos e filtros. (`EXISTENTE`)
- **Fase 10.3 — Carrinho e Checkout Público**: Fluxo de checkout e reserva temporária em `stock_reservations`. (`EXISTENTE`)
- **Fase 10.4 — Rastreamento Público por Token**: Acompanhamento de status em tempo real via `/p/:publicOrderToken`. (`EXISTENTE`)
- **Fase 10.5 — Identidade do Cliente e Integração SMSGate**: Autenticação OTP via gateway externo. (`DEPENDENTE DO SMSGATE`)
- **Fase 10.6 — Atendimento em Mesa / Comanda por QR Code**: Pedidos presenciais via `/mesa/:storeSlug/:tableCode`. (`EXISTENTE`)
- **Fase 10.7 — Banners Promocionais e Gestão de Anúncios**: Banners de destaque e anúncios patrocinados. (`PLANEJADA`)
- **Fase 10.8 — Pix Dinâmico e Conciliação Automática**: Cobrança Pix com baixa automática via webhook. (`PLANEJADA`)
- **Fase 10.9 — Homologação Piloto e Preparação v1.0.0**: Testes reais em estabelecimentos parceiros antes do lançamento oficial. (`PLANEJADA`)

---

## 13. Matriz de Factualidade e Classificação das Capacidades

| Capacidade / Recurso | Classificação Factual | Fonte Autoritativa / Referência |
|---|---|---|
| Rotas `/loja/:slug`, `/s/:slug`, `/checkout` | `EXISTENTE` | [`src/AppRoutes.tsx`](../src/AppRoutes.tsx) |
| Rastreamento Público `/p/:publicOrderToken` | `EXISTENTE` | [`src/pages/store/PublicOrderTracking.tsx`](../src/pages/store/PublicOrderTracking.tsx) |
| Reservas no Checkout (`stock_reservations`) | `EXISTENTE` | Migration `202607231600_fix_public_order_tracking_and_expired_reservation_access.sql` |
| Fórmulas `reserva_minima_local` e `limite_maximo_online` | `HOMOLOGADA` | Especificação de produto e RPCs de estoque |
| Autenticação OTP via SMS / OptmaSMSGate | `DEPENDENTE DO SMSGATE` | Repositório `OptmaIdea/optmasmsgate` em desenvolvimento |
| Pix Dinâmico via Gateway Pagador | `PLANEJADA` | Roadmap pós-v1.0.0 |
| Frete Dinâmico por Geolocalização / API de Mapas | `DEPENDENTE DE PROVEDOR EXTERNO` | Roadmap futuro |
