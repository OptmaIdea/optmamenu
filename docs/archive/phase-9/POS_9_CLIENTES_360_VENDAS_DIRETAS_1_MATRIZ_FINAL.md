# POS_9 — Clientes 360º e vendas diretas — Matriz final do diagnóstico técnico

## Status

Diagnóstico técnico concluído.

Esta etapa fecha a leitura do resultado SQL de Clientes 360º, vendas online e vendas diretas.

## Resultado do diagnóstico

O diagnóstico retornou:

- 765 linhas JSON;
- 53 funções/RPCs relacionadas ao domínio;
- 241 colunas de tabelas;
- 23 policies RLS;
- 280 grants de tabela;
- 159 grants de função;
- 9 permissões encontradas no catálogo.

## Tabelas mapeadas

Foram mapeadas 14 tabelas:

- `customers`;
- `customer_addresses`;
- `customer_consent_logs`;
- `customer_benefit_rules`;
- `customer_segments`;
- `customer_segment_members`;
- `loyalty_point_rules`;
- `loyalty_transactions`;
- `orders`;
- `order_items`;
- `promotion_campaigns`;
- `promotion_campaign_recipients`;
- `store_permission_catalog`;
- `store_role_permission_templates`.

Observação:

- `customer_consents` não apareceu com colunas no diagnóstico atual;
- a estrutura efetiva de consentimentos de cliente está em `customer_consent_logs`.

## Schema de clientes

A tabela `customers` possui 32 colunas e já cobre a maior parte da modelagem necessária.

Campos fundamentais encontrados:

- `store_id`;
- `full_name`;
- `phone`;
- `email`;
- `cpf`;
- `birth_date`;
- `source`;
- `data_ownership`;
- `editable_by_store`;
- `internal_notes`;
- `customer_metadata`;
- `marketing_consent`;
- `loyalty_opt_in`;
- `loyalty_points`;
- `loyalty_tier`;
- `current_tier_id`;
- `current_stamps`;
- `last_point_activity_at`;
- `last_order_at`;
- `total_orders`;
- `total_spent`;
- `tags`;
- `status`.

### Decisão

A tabela `customers` já suporta:

- cliente criado pelo admin;
- cliente vindo da loja pública;
- cliente vindo de WhatsApp;
- cliente vindo de QR/mesa;
- cliente para venda direta;
- dados protegidos pelo cliente;
- dados administrados pela loja;
- observações internas;
- consentimento de marketing;
- opt-in de fidelidade;
- resumo comercial.

Não há necessidade inicial de migration de schema para a tabela `customers`.

## Schema de pedidos

A tabela `orders` possui 31 colunas e já sustenta vínculo com clientes e canais.

Campos fundamentais encontrados:

- `store_id`;
- `customer_id`;
- `customer_name`;
- `customer_phone`;
- `customer_snapshot`;
- `sales_channel`;
- `fulfillment_type`;
- `order_code`;
- `public_order_token`;
- `table_code`;
- `delivery_address_snapshot`;
- `payment_method_code`;
- `payment_metadata`;
- `delivery_method_code`;
- `delivery_fee`;
- `subtotal`;
- `total`;
- `status`;
- `commercial_metadata`;
- `metadata`.

### Decisão

A tabela `orders` já suporta:

- pedido público;
- pedido via WhatsApp;
- pedido QR/mesa;
- pedido por telefone;
- venda presencial;
- venda direta;
- snapshot do cliente no momento da venda;
- histórico do cliente;
- baixa de estoque/reserva;
- fidelidade;
- caixa/livro diário.

Não há necessidade inicial de migration de schema para a tabela `orders`.

## Permissões encontradas

O catálogo retornou 9 permissões relevantes:

- `customers.view`;
- `customers.manage`;
- `orders.view`;
- `orders.manage`;
- `orders.cancel`;
- `loyalty.view`;
- `loyalty.manage`;
- `marketing.view`;
- `marketing.manage`.

### Permissões ausentes

Não foram encontradas no catálogo:

- `customers.sensitive.view`;
- `customers.marketing.manage`;
- `sales.direct.manage`.

### Decisão

Para a próxima implementação, usar o conjunto atual:

- listar/ver clientes: `customers.view`;
- criar/editar cliente administrável: `customers.manage`;
- listar/ver pedidos: `orders.view`;
- criar/avançar venda direta/pedido admin: `orders.manage`;
- cancelar pedido: `orders.cancel`;
- fidelidade: `loyalty.view` / `loyalty.manage`;
- marketing/campanhas: `marketing.view` / `marketing.manage`.

Não criar novas permissões agora.

Motivo:

- a Fase 9 acabou de estabilizar catálogo/templates/UI;
- as permissões existentes já cobrem a primeira entrega;
- `sales.direct.manage` pode ser criada depois se venda direta se tornar módulo independente;
- `customers.sensitive.view` pode ser criada depois se a UI realmente exigir mascaramento por papel.

## RPCs de Clientes 360º

### `get_admin_customers_safe`

Status: usar.

Proteção:

- owner;
- `customers.view`;
- `customers.manage`.

Uso recomendado:

- listagem de clientes;
- cards/resumo;
- filtros locais iniciais;
- origem/propriedade/dados protegidos.

### `get_customer_360_safe`

Status: usar.

Proteção:

- owner;
- `customers.view`;
- `customers.manage`.

Retorna:

- cliente;
- pedidos;
- transações de fidelidade;
- endereços;
- logs de consentimento.

Uso recomendado:

- página `/admin/customers/:id/lifecycle`;
- modal/detalhe 360º;
- abas de resumo, pedidos, fidelidade, endereços, consentimentos e observações.

### `create_admin_customer_safe`

Status: usar para cadastro administrativo.

Proteção:

- owner;
- `customers.manage`.

Comportamento:

- cria `source='admin'`;
- cria `data_ownership='store_managed'`;
- cria `editable_by_store=true`.

Uso recomendado:

- botão Novo Cliente;
- criação rápida de cliente no fluxo de venda direta, inicialmente como cliente administrado.

### `update_admin_customer_safe`

Status: usar.

Proteção:

- owner;
- `customers.manage`.

Comportamento importante:

- se `editable_by_store=false` ou `data_ownership='customer_owned'`, preserva dados pessoais e atualiza apenas campos internos/operacionais.

Uso recomendado:

- edição de clientes administráveis;
- edição parcial de observações/tags/status/consentimentos em clientes protegidos;
- UI deve refletir `protected_data=true` quando retornado.

## RPCs de pedidos/admin

### `get_admin_orders_safe`

Status: usar.

Proteção atual:

- `is_store_member`.

Uso atual:

- tela administrativa de pedidos.

Observação:

- a tela `Orders.tsx` usa essa RPC para carregar pedidos e filtrar status.

### `confirm_order_payment`

Status: usar para aceitar/confirmar pedido.

Uso atual:

- tela administrativa de pedidos.

### `admin_complete_public_order_safe`

Status: usar para finalizar pedido confirmado.

Uso atual:

- tela administrativa de pedidos.

### `admin_cancel_public_order_safe`

Status: usar para cancelar pedido.

Uso atual:

- tela administrativa de pedidos.

## Pedido público e cliente público

### `create_public_order_by_slug`

Status: manter público intencional.

Grants:

- `anon=true`;
- `authenticated=false`;
- `service_role=true`.

Comportamento relevante:

- aceita `sales_channel` em `whatsapp`, `public_store`, `qr_table`, `direct`, `phone`, `in_person`, `other`;
- valida loja pública habilitada;
- normaliza telefone;
- cria/identifica cliente público;
- cria pedido com vínculo/snapshot.

Decisão:

- manter para loja pública/WhatsApp/QR;
- não usar como fluxo principal de venda direta administrativa, mesmo aceitando canais `direct`/`in_person`.

## Fidelidade

Camada recomendada:

- `calculate_order_loyalty_points_advanced`;
- `apply_order_loyalty_points_advanced`;
- `handle_new_order_points_v2`;
- `get_loyalty_advanced_settings_safe`;
- `upsert_loyalty_point_rule_safe`;
- `upsert_customer_benefit_rule_safe`.

Camada legada a não mexer nesta etapa:

- `award_loyalty_points`;
- `handle_new_customer_loyalty`;
- `handle_new_order_points`;
- `redeem_reward`.

Decisão:

- a nova tela Clientes 360º deve consumir dados de fidelidade já retornados por `get_customer_360_safe`;
- a venda direta deve deixar a pontuação ocorrer quando o pedido chegar a `completed` e possuir `customer_id`.

## Marketing e segmentos

RPCs presentes:

- `upsert_customer_segment_safe`;
- `refresh_customer_segments_safe`;
- `upsert_promotion_campaign_safe`;
- `build_campaign_recipients_preview_safe`;
- `prepare_campaign_recipients_safe`;
- `get_campaign_recipients_safe`;
- `mark_campaign_recipient_manual_sent_safe`.

Permissões existentes:

- `marketing.view`;
- `marketing.manage`.

Decisão:

- manter marketing manual;
- respeitar `marketing_consent` na seleção/preparação de destinatários;
- não criar automação real nesta etapa.

## Venda direta

### Diagnóstico

Não existe, no resultado atual, uma RPC administrativa específica do tipo:

- `create_admin_direct_sale_order_safe`;
- `create_direct_sale_with_customer_safe`;
- `create_admin_order_safe`.

A base de dados permite a venda direta, mas a jornada administrativa ainda precisa ser consolidada.

### Decisão de arquitetura inicial

Criar uma RPC administrativa própria para venda direta com cliente.

Nome recomendado:

- `create_admin_direct_sale_order_safe`.

Permissão inicial:

- owner ou `orders.manage`.

Permissão adicional para cliente rápido:

- owner ou `customers.manage` quando a RPC precisar criar cliente novo.

Sem criar `sales.direct.manage` neste momento.

### Requisitos mínimos da RPC

A RPC deve:

1. exigir `p_store_id`;
2. exigir `auth.uid()` para chamadas authenticated;
3. exigir owner ou `orders.manage`;
4. aceitar cliente existente opcional;
5. permitir criação rápida de cliente se tiver `customers.manage`;
6. gravar `orders.customer_id` quando houver cliente;
7. gravar `orders.customer_name` e `orders.customer_phone`;
8. gravar `orders.customer_snapshot`;
9. gravar `sales_channel='direct'` ou `sales_channel='in_person'`;
10. gravar `fulfillment_type='takeout'` ou equivalente operacional;
11. inserir `order_items`;
12. reservar/baixar estoque conforme regra definida;
13. gerar `order_code` `PED-...`;
14. integrar com conclusão, caixa e fidelidade já existentes.

## Fluxo recomendado da UI

### Clientes 360º

Evoluir `/admin/customers` para:

- listagem com busca/filtros;
- indicadores no topo;
- origem do cliente;
- propriedade dos dados;
- status de consentimento;
- pontos e nível;
- total de pedidos;
- total gasto;
- último pedido;
- botão Novo Cliente;
- acesso ao detalhe 360º.

### Detalhe/Vida do Cliente

Criar ou consolidar `/admin/customers/:id/lifecycle` com abas:

1. Resumo;
2. Pedidos;
3. Fidelidade;
4. Endereços;
5. Consentimentos;
6. Observações internas.

### Dados protegidos

Quando `editable_by_store=false` ou `data_ownership='customer_owned'`:

- bloquear campos pessoais;
- permitir observações internas/tags/status quando permitido;
- mostrar aviso visual de dados protegidos;
- não depender apenas de toast.

### Venda direta

Criar fluxo administrativo com:

- seleção de cliente existente;
- criação rápida de cliente;
- carrinho/itens;
- método de pagamento;
- canal `direct`/`in_person`;
- confirmação/finalização;
- vínculo com cliente;
- atualização automática do resumo comercial via trigger;
- pontuação de fidelidade na conclusão.

## Migrations recomendadas para próxima etapa

### Migration 1 — RPC de venda direta admin

Criar:

- `public.create_admin_direct_sale_order_safe(...)`.

Grants:

- revogar `PUBLIC` e `anon`;
- conceder `authenticated`;
- conceder `service_role`.

Proteções:

- owner ou `orders.manage`;
- se criar cliente rápido, owner ou `customers.manage`;
- validar loja;
- validar produtos/estoque;
- validar método de pagamento/entrega quando aplicável.

### Migration 2 — opcional, somente se necessário

Criar função auxiliar:

- `public.create_direct_sale_customer_safe(...)`.

Alternativa preferida inicial:

- reaproveitar `create_admin_customer_safe` para cliente rápido.

### Sem migration de permissões neste momento

Não criar agora:

- `sales.direct.manage`;
- `customers.sensitive.view`;
- `customers.marketing.manage`.

Essas permissões ficam anotadas como evolução futura, se a UX exigir separação mais fina.

## Próxima etapa recomendada

Abrir:

- `POS_9_CLIENTES_360_VENDAS_DIRETAS_2_RPC_VENDA_DIRETA_ADMIN`.

Objetivo:

- criar a RPC segura de venda direta administrativa;
- documentar assinatura;
- preservar estoque/pedido/cliente/fidelidade/caixa;
- validar com SQL e depois integrar na UI.
