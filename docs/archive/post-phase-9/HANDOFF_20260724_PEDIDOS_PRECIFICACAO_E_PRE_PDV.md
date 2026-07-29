# Handoff — Pedidos, comunicação, precificação e preparação do PDV

Data de consolidação: 24/07/2026

## 1. Objetivo deste documento

Registrar o estado validado do OptmaMenu após as frentes de:

- pedido público por slug;
- acompanhamento público por token;
- fluxo operacional de pedidos;
- comunicação assistida por WhatsApp;
- prazos, reserva, expiração e tolerância;
- alerta global de pedidos;
- fechamento com forma real de pagamento;
- motor central de precificação;
- atacado por categoria e por produto;
- upload de imagens de categoria.

Este documento deve ser lido antes de iniciar a frente do PDV dedicado.

---

## 2. Estado validado do pedido público

### 2.1 Fluxo real

O checkout público cria pedido real no Supabase. O fluxo legado que apenas abria o WhatsApp foi substituído.

Fluxo atual:

```text
Cliente adiciona produtos
→ abre checkout
→ informa nome e WhatsApp
→ escolhe pagar na retirada
→ pedido é recalculado no backend
→ pedido é criado
→ estoque é reservado
→ link público é gerado
→ WhatsApp é aberto
→ retorno ao slug exibe sucesso
→ pedido aparece no painel administrativo
```

### 2.2 Acompanhamento público

Rota:

```text
/p/<public_order_token>
```

O token público é a credencial do pedido. A página usa cliente Supabase anônimo isolado, sem reutilizar sessão administrativa ou JWT do portal do cliente.

Validado em computador e celular:

- abre pedido corretamente;
- mostra itens;
- mostra pagamento;
- mostra forma de entrega/retirada;
- botão de voltar retorna à slug correta;
- console limpo.

### 2.3 Estados do pedido

Fluxo operacional atual:

```text
reserved
→ confirmed
→ ready
→ completed
```

Saídas alternativas:

```text
reserved / confirmed / ready
→ cancelled
```

Os estados de pedido, pagamento e reserva de estoque são separados.

---

## 3. Regras de prazo, reserva e tolerância

Configurações existentes:

```text
timer_duration_minutes
extension_minutes
ready_hold_minutes
expiration_grace_minutes
```

Regra consolidada:

### Novo / reservado

- prazo inicial configurável;
- prorrogação antes do aceite serve para análise interna da loja;
- finalidade: conferir estoque físico e capacidade de atendimento.

### Aceito / em preparo

- ao aceitar, o prazo passa a ser contado a partir do aceite;
- prazo padrão atual: 10 minutos;
- pode haver prorrogação manual durante o preparo.

### Pronto

- ao clicar em “Avisar que está pronto”, o pedido muda para `ready`;
- o prazo configurável de pronto é somado ao tempo restante;
- não reinicia obrigatoriamente a contagem;
- exemplo: restavam 7 minutos + `ready_hold_minutes = 5` → novo prazo de 12 minutos;
- depois desse prazo ainda se aplica a tolerância configurável.

### Expiração

Pedido não pago:

```text
prazo encerra
→ aguarda tolerância
→ cancela
→ libera reserva
```

Pedido pago:

```text
não cancela automaticamente
→ permanece para decisão gerencial
→ opções futuras: aguardar, cancelar e estornar
```

---

## 4. Pagamento

O catálogo separa duas ideias:

### Pagar aqui

- reservado para PIX/cartão online;
- permanece desabilitado enquanto não houver integração real;
- não deve transmitir falsa impressão de pagamento antecipado.

### Pagar na retirada

- pedido nasce com pagamento pendente;
- cliente não escolhe previamente dinheiro, PIX ou cartão;
- a forma real é informada pelo atendente na finalização.

Ao finalizar o pedido:

```text
abre modal de pagamento
→ operador escolhe PIX, dinheiro, débito ou crédito
→ payment_status = paid
→ reserva é consumida
→ estoque é baixado
→ pedido é concluído
→ lançamento é criado no Livro Diário
```

A finalização foi validada.

---

## 5. Comunicação cliente ↔ loja

### 5.1 Diretriz

O acompanhamento do pedido deve acontecer principalmente dentro do OptmaMenu. O WhatsApp deve levar o cliente ao sistema, e não reproduzir todos os detalhes do pedido em mensagens longas.

### 5.2 Eventos previstos

```text
order_confirmation
order_accepted
order_ready
order_reminder
order_expired
order_cancelled
```

### 5.3 Comunicação assistida

Sem API oficial do WhatsApp, o sistema:

- prepara a mensagem;
- abre o WhatsApp;
- registra a ação como preparada/aberta;
- não afirma envio, entrega ou leitura automáticos.

Existe base de histórico em `order_message_events`.

### 5.4 Futuro Centro de Atendimento

Registrar para etapas finais:

- ícone de mensagens já existente poderá virar Centro de Atendimento;
- caixa compartilhada depende de WhatsApp oficial/webhooks;
- notas internas devem ser separadas das mensagens externas;
- conversas devem permitir atribuição entre atendentes;
- futuro canal interno para clientes, usuários e demais participantes vinculados à loja.

Permissões sugeridas para o futuro:

```text
messages.inbox.view
messages.inbox.reply
messages.inbox.assign
messages.inbox.manage
messages.templates.manage
```

---

## 6. Alertas de pedidos

### 6.1 Alerta flutuante global

Existe alerta visível em qualquer tela administrativa quando há pedido aguardando.

Comportamento validado:

- mostra quantidade;
- mostra pedido mais antigo;
- mostra tempo de espera;
- botão abre `/admin/orders`;
- ao clicar em “Abrir pedidos”, o alerta fecha;
- só reaparece quando entra pedido novo ou muda a composição de pedidos pendentes.

### 6.2 Atalho no cabeçalho

Há atalho de Pedidos próximo ao acesso da loja pública, com badge de pedidos ativos.

Contagem considera:

```text
reserved
confirmed
ready
```

Respeita `orders.view`.

---

## 7. Motor central de precificação

### 7.1 Princípio

O backend é a autoridade final. O frontend apenas simula e apresenta.

Todos os canais devem usar a mesma regra:

```text
slug
checkout
Venda Direta
PDV
mesa/QR
futuras APIs
```

### 7.2 Estruturas atuais reaproveitadas

Categoria:

```text
categories.price_logic_type
categories.price_rules
categories.pricing_strategy
```

Produto:

```text
products.use_category_pricing
products.price_logic_type
products.price_rules
```

### 7.3 Estratégias suportadas

#### Produto herda categoria

```text
use_category_pricing = true
```

A categoria define a lógica.

#### Produto usa regra própria

```text
use_category_pricing = false
```

A regra própria prevalece sobre a categoria.

#### Sem regra aplicável

Usa preço-base do produto.

---

## 8. Atacado por categoria

A categoria suporta duas estratégias.

### 8.1 Volume combinado

```text
pricing_strategy.volume_scope = combined
```

Exemplo:

```text
7 Chiclete + 1 Chocolate
→ quantidade combinada = 8
→ ambos recebem a faixa de 8 unidades
```

### 8.2 Volume individual por produto

```text
pricing_strategy.volume_scope = per_product
```

Exemplo:

```text
7 Chiclete
1 Chocolate
→ Chiclete usa faixa de 7
→ Chocolate usa faixa de 1
```

Com:

```text
8 Chiclete
1 Chocolate
→ Chiclete entra na faixa de 8
→ Chocolate permanece na faixa de 1
```

Ambas as estratégias foram validadas na slug e no backend.

---

## 9. Atacado por produto

Um produto pode sair da regra da categoria:

```text
use_category_pricing = false
price_logic_type = category_volume
price_rules = faixas próprias
```

Caso validado:

```text
Crocante de amendoim
1 unidade → R$ 7,00
8 unidades → R$ 6,25
```

A regra própria:

- persiste no painel;
- é exposta no catálogo público;
- prevalece sobre a categoria;
- é recalculada no carrinho;
- é recalculada no backend ao criar o pedido.

---

## 10. Sincronização da slug

A RPC pública de catálogo agora expõe:

Categoria:

```text
price_logic_type
price_rules
pricing_strategy
```

Produto:

```text
use_category_pricing
price_logic_type
price_rules
```

O carrinho persistido é reidratado quando o catálogo carrega, evitando regras antigas no `localStorage`.

Estado validado:

- painel salva;
- slug recebe;
- carrinho recalcula;
- backend confirma;
- console limpo.

---

## 11. Snapshot comercial do pedido

O backend preserva no item do pedido informações como:

```text
pricing_source
pricing_quantity
base_price
unit_price
discount_total
line_total
applied_tier
category_id
category_name
```

Isso permite explicar futuramente por que determinado preço foi aplicado, mesmo após alteração das regras.

---

## 12. Upload de imagem de categoria

O upload foi movido para o bucket funcional `products`, em pasta própria:

```text
products/<store_id>/categories/<category_id>/<timestamp>-<uuid>.<ext>
```

Características:

- nome único;
- sem `upsert`;
- evita dependência de `UPDATE` no Storage;
- substituição de imagem validada;
- console limpo.

---

## 13. Arquivos principais desta frente

Frontend:

```text
src/pages/store/Catalog.tsx
src/pages/store/Checkout.tsx
src/pages/store/PublicOrderTracking.tsx
src/services/publicOrderService.ts
src/services/publicStorefrontService.ts
src/services/orderCommunicationService.ts
src/store/useCartStore.ts
src/components/orders/PendingOrdersFloatingAlert.tsx
src/hooks/useOrderMonitor.ts
src/pages/private/admin/commercial/orders/Orders.tsx
src/pages/private/admin/products/category/components/CategoryFormFields.tsx
src/pages/private/admin/products/category/hooks/useCategorySave.ts
src/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal.tsx
```

Migrações relevantes incluem as frentes de:

- acompanhamento público por token;
- histórico de comunicação;
- estado `ready` e pagamento separado;
- tolerância e prazo de pedido pronto;
- alerta/monitor de pedidos;
- finalização com forma real de pagamento;
- motor central de precificação;
- volume combinado e individual;
- exposição completa da configuração pública de preços.

---

## 14. Validações concluídas

Foram validados manualmente:

- pedido criado pelo celular;
- pedido criado pelo computador;
- pedido aparece no painel;
- acompanhamento público funciona em celular e computador;
- retorno para slug funciona;
- console limpo;
- aceitar pedido;
- prorrogar antes do aceite;
- prorrogar durante preparo;
- marcar como pronto;
- prazo adicional ao ficar pronto;
- tolerância;
- cancelar;
- finalizar com forma real de pagamento;
- alerta flutuante;
- badge no cabeçalho;
- controle `− / quantidade / +` no checkout;
- atacado combinado por categoria;
- atacado individual por produto dentro da categoria;
- regra própria do produto prevalecendo;
- carrinho persistido sincronizado;
- substituição de imagem de categoria.

---

## 15. Pendências imediatas antes ou junto do PDV

### Interface gerencial de produtos

- melhorar modal de visualização do produto;
- mostrar origem do preço;
- mostrar regra herdada da categoria;
- mostrar faixas efetivas;
- adicionar aba de movimentações com filtros;
- preparar indicadores gerenciais.

### Categorias

- corrigir rolagem horizontal da tabela no desktop;
- manter primeira coluna e ações utilizáveis em telas estreitas;
- considerar simulador de preço no modal.

### Produto / estoque

- mostrar nome do produto corretamente na Vida do Produto;
- clicar em “Reservado” e ver origem da reserva;
- mostrar pedido, local, quantidade e expiração da reserva.

### Presença online

- revisar se já existe implementação parcial;
- criar/validar permissão específica para visualizar usuários online.

### Comunicação futura

- Centro de Atendimento;
- integração oficial com WhatsApp;
- caixa compartilhada;
- canal interno.

---

## 16. Próxima frente: PDV dedicado

O PDV deve nascer consumindo o motor central já validado.

Diretriz:

- não começar por aplicativo Android nativo;
- criar rota dedicada e reduzida;
- preferir PWA instalável;
- futuramente empacotar a mesma base para Android.

Requisitos mínimos:

```text
rota dedicada
permissão específica
acesso exclusivo ao PDV
redirecionamento automático quando for o único módulo
isolamento por loja e local de estoque
busca por nome, código interno e EAN
leitor de código de barras
botões − / quantidade / +
carrinho persistente
limpar carrinho
cliente de balcão ou cadastrado
estoque em tempo real
forma real de pagamento
dinheiro recebido e troco
fechamento rápido
auditoria do operador
integração com estoque, caixa, clientes e fidelidade
```

O PDV deve usar exatamente o mesmo motor de preços da slug.

---

## 17. Decisão de sequência

Sequência recomendada:

```text
1. Melhorias gerenciais mínimas de produto/categoria
2. Correção de rolagem da tabela de categorias
3. Diagnóstico do PDV Rápido e Venda Direta existentes
4. Arquitetura do PDV dedicado
5. Permissões e acesso exclusivo
6. Implementação do PDV
7. Integração com estoque, caixa e clientes
8. Presença de usuários online
9. Centro de Atendimento
10. Canal interno e WhatsApp oficial
```

A nova frente não deve reabrir decisões já validadas neste documento sem evidência de regressão.