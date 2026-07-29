# Fase 10 — Loja Pública, Microsite Comercial e Experiência do Cliente

> **Versão Oficial:** `0.10.0-rc.1`  
> **Escopo:** Loja Pública, Microsite Comercial Mobile-First, Checkout do Cliente, Governança e Experiência do Consumidor.

---

## 🎯 1. Objetivos da Fase 10

A **Fase 10** do OptmaMenu é a ponte entre a operação administrativa interna do estabelecimento e o seu cliente final. O objetivo central é fornecer um **Microsite Comercial leve, ultra-rápido, responsivo (mobile-first)** e de alta conversão, permitindo que qualquer estabelecimento exponha seu catálogo, receba pedidos online, gerencie reservas de estoque e ofereça uma experiência de compra fluida via link direto ou QR Code.

---

## 🏬 2. Governança da Slug e Identidade Visual

### 2.1 Identificador Único da Loja (Slug)
- A loja pública é acessada via rota amigável `/loja/:slug` (ex: `/loja/pizzaria-optma`).
- A slug é governed por regras estritas de formato: minúsculas, hífens, sem acentos nem caracteres especiais.
- Suporte a aliases históricos na tabela `public_store_slug_aliases` para evitar links quebrados em caso de alteração oficial da slug principal.

### 2.2 Microsite Comercial Mobile-First
- Design otimizado para dispositivos móveis (smartphones) com carregamento instantâneo.
- Suporte a tema claro e escuro tailandês tailo-made com CSS moderno.
- Banner de capa, logo da loja, horário de funcionamento em tempo real, status (aberto/fechado) e badge de canal de entrega.

---

## 📦 3. Catálogo Online, Estoque e Reservas

### 3.1 Exibição do Catálogo
- Organização por categorias dinâmicas e grupos de destaque.
- Busca em tempo real por nome ou tag de produto.
- Imagens otimizadas automaticamente em formato WebP via pipeline do Supabase Storage.
- Suporte a regras de preço do atacado combinado (descontos progressivos aplicados automaticamente no carrinho).

### 3.2 Estoque Online e Proteção de Saldo
- Exibição condicional de disponibilidade com base nos saldos em `inventory_location_balances`.
- **Baixa Disponibilidade**: Alerta visual quando o estoque estiver abaixo do limite configurado.
- **Reserva Temporária de Estoque**: Ao adicionar itens ao carrinho e avançar para a finalização, o estoque é temporariamente reservado.
- **Expiração Automática de Reservas**: Reservas não concluídas no prazo estipulado (configurável em `stores.config.online_order_settings`) são expiradas automaticamente via job agendado no Supabase, liberando os itens de volta ao saldo disponível.

---

## 🛒 4. Carrinho e Checkout do Cliente

### 4.1 Experiência de Checkout
- **Visitantes (Guest Checkout)**: Permite a realização de pedidos rápidos informando apenas Nome e Telefone/WhatsApp para contato.
- **Cliente Registrado**: Login simplificado permitindo acesso ao histórico de pedidos e fidelidade.
- **Opções de Entrega / Retirada**:
  - Entrega (Delivery) com cálculo de taxa por bairro/região.
  - Retirada no Balcão (Takeout/Pickup).
  - Consumo no Local (Mesa/Comanda digital — integrado ao módulo PDV).
- **Meios de Pagamento Configuráveis**:
  - PIX com chave e QR Code estático/dinâmico.
  - Cartão de Crédito/Débito na entrega.
  - Dinheiro com solicitação de troco.

---

## 🛡️ 5. Governança, Segurança Infantil e Regras Comerciais

### 5.1 Proteção de Conteúdo e Responsabilidade Social
- **Segurança Infantil e Produtos Restritos**: Bloqueio compulsório de venda de bebidas alcoólicas ou produtos restritos para menores de 18 anos, exigindo confirmação de maioridade na entrada da loja pública.
- **Mecanismo de Denúncia e Moderação**: Botão de denúncia visual e canal direto para comunicação de irregularidades na loja pública.
- **Políticas de Uso e LGPD**: Links visíveis no rodapé para os Termos de Uso, Política de Privacidade e consentimento explícito para comunicações via WhatsApp (`preserve_public_customer_marketing_consent`).

---

## ⚙️ 6. Feature Flags e Arquitetura de Comunicação

### 6.1 Feature Flags da Loja Pública
- A disponibilidade de recursos avançados na loja pública é controlada por feature flags em `stores.config`:
  - `online_orders_enabled`: Ativa/desativa recebimento de novos pedidos online.
  - `loyalty_enabled`: Habilita resgate e acúmulo de pontos na loja pública.
  - `table_orders_enabled`: Habilita pedidos por QR Code de mesa.

### 6.2 Integração com OptmaSMSGate
- A confirmação de código de validação via SMS e notificações ativas pelo WhatsApp utiliza a integração background com a infraestrutura do ecossistema **OptmaSMSGate** (`OptmaIdea/optmasmsgate`).
- Em ambientes de teste ou sem gateway ativo, o sistema opera de forma graciosa via links diretos para WhatsApp Web (`wa.me`).
