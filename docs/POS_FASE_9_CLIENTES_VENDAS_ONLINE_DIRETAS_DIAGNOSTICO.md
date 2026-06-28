# Pós-Fase 9 — Diagnóstico de Clientes, vendas online e vendas diretas

## Status

Diagnóstico inicial concluído.

Esta frente abre a sequência funcional após o fechamento da Fase 9, com foco em clientes, vendas online, vendas diretas e proteção de dados.

## Premissa

Clientes e vendas são centrais para o OptmaMenu.

A camada precisa atender simultaneamente:

- cliente vindo da loja pública;
- cliente vindo do WhatsApp;
- cliente vindo de QR/mesa;
- cliente cadastrado manualmente pelo admin;
- cliente usado em venda direta/presencial;
- histórico de pedidos;
- fidelidade;
- marketing;
- proteção de dados sensíveis;
- permissões de acesso e edição.

## Base já existente

### Fase 8 Comercial

A Fase 8 já declarou como concluídos:

- loja pública por slug;
- pedidos públicos;
- clientes;
- Clientes 360º / Vida do Cliente;
- fidelidade inicial;
- dashboard comercial;
- marketing manual seguro;
- segmentos e campanhas.

Rotas/documentação registradas:

- `/admin/customers`;
- `/admin/customers/:id/lifecycle`;
- `/admin/loyalty/advanced`;
- `/admin/marketing`.

Objetos relevantes já registrados:

- `customers`;
- `customer_segments`;
- `customer_segment_members`;
- `promotion_campaigns`;
- `promotion_campaign_recipients`;
- `customer_benefit_rules`;
- `loyalty_point_rules`;
- `loyalty_transactions`;
- `orders`;
- `order_items`.

## Serviço atual de Clientes 360º

Arquivo principal:

- `src/services/customers360Service.ts`.

O serviço já define uma base importante:

### Origem do cliente

Tipos já previstos:

- `admin`;
- `public_store`;
- `whatsapp`;
- `qr_table`;
- `direct_sale`;
- `import`;
- `other`.

### Propriedade/controle dos dados

Tipos já previstos:

- `store_managed`;
- `customer_owned`;
- `mixed`.

### Campos de listagem

A listagem já considera:

- nome;
- telefone;
- e-mail;
- CPF;
- data de nascimento;
- status;
- origem;
- propriedade dos dados;
- se é editável pela loja;
- preferência de contato;
- consentimento de marketing;
- opt-in de fidelidade;
- pontos;
- nível;
- tags;
- observações internas;
- último login;
- última atividade de pontos;
- último pedido;
- total de pedidos;
- total gasto.

### Vida do Cliente

O serviço já prevê retorno 360º com:

- dados do cliente;
- pedidos;
- transações de fidelidade;
- endereços;
- consentimentos.

### RPCs usadas

- `get_admin_customers_safe`;
- `get_customer_360_safe`;
- `create_admin_customer_safe`;
- `update_admin_customer_safe`.

## Tela atual de Clientes

Arquivo principal:

- `src/pages/private/admin/commercial/customers/Customers.tsx`.

A tela atual possui:

- listagem de clientes;
- busca por nome/apelido/telefone/e-mail;
- visualização de detalhes;
- carregamento de endereços;
- indicação de dados sensíveis;
- visualização de fidelidade/pontos;
- telefone/e-mail/data de nascimento;
- estado vazio;
- modal de detalhes.

## Pedidos e vínculo com cliente

A tabela `orders` já possui campos relevantes:

- `customer_id`;
- `customer_name`;
- `customer_phone`;
- `customer_snapshot`;
- `sales_channel`;
- `fulfillment_type`;
- `order_code`;
- `delivery_address_snapshot`;
- `payment_method_code`;
- `delivery_method_code`;
- `subtotal`;
- `delivery_fee`;
- `commercial_metadata`.

Isso permite amarrar:

- pedido público;
- pedido por WhatsApp;
- pedido por QR/mesa;
- venda direta;
- histórico do cliente;
- fidelidade;
- campanhas.

## Diagnóstico funcional

A base já é boa, mas a próxima frente precisa organizar a experiência final em torno de três eixos.

### 1. Cliente público / WhatsApp / loja pública

Objetivo:

- cliente criado ou identificado a partir de pedido online, WhatsApp ou QR/mesa.

Regras desejadas:

- dados pessoais protegidos;
- loja pode visualizar o necessário para operação;
- edição completa pela loja deve ser limitada ou bloqueada quando `data_ownership = customer_owned`;
- observações internas podem ser editadas pela loja;
- histórico de pedidos deve aparecer;
- consentimentos devem ser respeitados;
- marketing só com consentimento.

### 2. Cliente administrativo / venda direta

Objetivo:

- permitir cadastro e uso de cliente em vendas diretas/presenciais.

Regras desejadas:

- cliente criado pelo admin deve ter `source = admin` ou `direct_sale`;
- dados podem ser `store_managed`;
- loja pode editar dados cadastrais se tiver permissão;
- cliente pode ser selecionado em venda direta;
- venda direta deve preencher `orders.customer_id` e `orders.customer_snapshot`;
- histórico deve aparecer na Vida do Cliente.

### 3. Proteção de dados e permissões

Objetivo:

- garantir que dados de cliente sejam acessados de acordo com papel/permissão.

Regras desejadas:

- `customers.view` para listar/ver clientes;
- `customers.manage` para criar/editar clientes administráveis;
- futura permissão `customers.sensitive.view` ou equivalente para CPF/dados sensíveis;
- marketing respeitando consentimento;
- clientes públicos com edição restrita;
- observações internas separadas de dados pessoais.

## Lacunas principais identificadas

### Experiência de venda direta

Ainda precisa ser consolidada a jornada:

- criar venda direta;
- selecionar cliente existente;
- criar cliente rápido no fluxo da venda;
- marcar origem como `direct_sale`;
- vincular pedido ao cliente;
- atualizar histórico, total gasto, último pedido e fidelidade.

### Tela Clientes 360º moderna

Há serviço 360º robusto, mas a tela atual de clientes ainda parece mais simples/legada.

Próximo passo recomendado:

- evoluir `/admin/customers` para usar integralmente `customers360Service`;
- criar/validar rota de detalhe `/admin/customers/:id/lifecycle`;
- separar abas: Resumo, Pedidos, Fidelidade, Endereços, Consentimentos, Observações.

### Proteção visual de dados sensíveis

A tela já possui indícios de dados sensíveis, mas a regra final deve ficar clara:

- exibir parcialmente telefone/CPF/e-mail quando necessário;
- mostrar cadeado ou aviso para dados protegidos;
- permitir edição apenas quando `editable_by_store = true` e `manage=true`;
- bloquear edição de dados vindos do cliente quando `data_ownership = customer_owned`.

### Permissões granulares

Confirmar ou criar, se necessário:

- `customers.view`;
- `customers.manage`;
- `customers.sensitive.view`;
- `customers.marketing.manage`;
- `orders.view`;
- `orders.manage`;
- `sales.direct.manage` ou equivalente para venda direta.

Seguir o padrão da Fase 9:

- catálogo;
- templates;
- versões;
- UI/constants;
- consumidores.

## Proposta de sequência

### Etapa 1 — Diagnóstico técnico de tabelas/RPCs

Objetivo:

- confirmar schema atual de `customers`, `customer_addresses`, `customer_consents`, `orders`, `loyalty_transactions` e permissões existentes.

Entregáveis:

- SQL diagnóstico;
- documento de matriz cliente/venda/permissões.

### Etapa 2 — Reorganizar tela de Clientes

Objetivo:

- transformar a tela atual em uma tela alinhada ao serviço 360º.

Entregáveis:

- listagem com filtros;
- criação rápida de cliente admin/direct sale;
- detalhe 360º;
- indicadores: total gasto, pedidos, pontos, origem, consentimento;
- UX de dados protegidos.

### Etapa 3 — Venda direta com cliente

Objetivo:

- permitir que vendas diretas usem cliente cadastrado ou criem cliente rápido.

Entregáveis:

- seleção de cliente no pedido/venda direta;
- criação rápida no fluxo;
- vínculo com `customer_id`;
- snapshot do cliente;
- atualização de histórico e fidelidade.

### Etapa 4 — Proteção e permissões

Objetivo:

- garantir que `view/manage` e dados sensíveis funcionem corretamente.

Entregáveis:

- permissions audit;
- UX `manage=false`;
- dados sensíveis mascarados quando necessário;
- bloqueio de edição de clientes públicos/customer-owned.

### Etapa 5 — Integração com marketing/fidelidade

Objetivo:

- usar clientes, segmentos, consentimentos e fidelidade de forma unificada.

Entregáveis:

- segmentos por origem/recência/gasto/pontos;
- campanhas respeitando consentimento;
- benefícios por cliente/nível;
- histórico de comunicações.

## Decisão recomendada

Abrir a próxima etapa como:

- `POS_9_CLIENTES_360_VENDAS_DIRETAS_1_DIAGNOSTICO_TECNICO`.

Não iniciar implementação de tela antes de confirmar schema/RPCs/permissões atuais.

## Resultado

A frente Clientes/Vendas Online/Vendas Diretas é considerada prioritária e deve seguir como próxima frente funcional principal após a Fase 9.
