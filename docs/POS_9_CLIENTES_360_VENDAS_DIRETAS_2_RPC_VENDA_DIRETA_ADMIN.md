# POS_9 — Clientes 360º e vendas diretas — 2 RPC de venda direta administrativa

## Status

Implementada em migration, aguardando aplicação e validação no Supabase.

## Objetivo

Criar uma RPC segura para venda direta/presencial pelo painel administrativo, sem usar a RPC pública por slug como fluxo principal do admin.

## Migration criada

Arquivo:

- `supabase/migrations/20260629141000_create_admin_direct_sale_order_safe.sql`

Função criada:

- `public.create_admin_direct_sale_order_safe(...)`

## Por que esta RPC é importante

Clientes e vendas diretas são parte central da demonstração do produto.

A nova RPC aproxima o OptmaMenu de um fluxo completo de venda administrativa porque permite:

- venda presencial/direta;
- seleção de cliente existente;
- criação rápida de cliente administrado;
- vínculo com `orders.customer_id`;
- gravação de `customer_snapshot`;
- baixa física imediata de estoque;
- criação de `order_items`;
- registro de `stock_movements`;
- atualização de resumo comercial do cliente;
- aplicação de fidelidade avançada quando aplicável;
- criação de lançamento no livro diário/caixa via `create_cashbook_entry_from_order`.

## Assinatura

```sql
public.create_admin_direct_sale_order_safe(
  p_store_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_payment_method_code text default 'pending',
  p_notes text default null,
  p_location_id uuid default null,
  p_sales_channel text default 'direct',
  p_fulfillment_type text default 'in_person',
  p_create_customer_if_missing boolean default true,
  p_marketing_consent boolean default false,
  p_loyalty_opt_in boolean default true,
  p_metadata jsonb default '{}'::jsonb
)
```

Retorno:

- `jsonb`.

## Segurança

Grants definidos:

- `anon=false`;
- `authenticated=true`;
- `service_role=true`;
- `PUBLIC` revogado.

Gates:

- exige `auth.uid()` em chamadas autenticadas;
- exige owner ou `orders.manage` para criar venda direta;
- exige owner ou `customers.manage` quando precisar criar cliente rápido.

## Comportamento da venda

A RPC cria a venda como pedido já concluído:

- `orders.status = completed`;
- `confirmed_at = now()`;
- `completed_at = now()`;
- `sales_channel = direct` por padrão;
- `fulfillment_type = in_person` por padrão;
- `delivery_fee = 0`;
- `order_code = PED-...` via `generate_public_order_code()`.

## Cliente

### Cliente existente

Quando `p_customer_id` é informado:

- valida se o cliente pertence à loja;
- usa nome/telefone do cliente como fallback;
- grava `orders.customer_id`;
- grava `customer_snapshot`.

### Cliente rápido

Quando não há `p_customer_id`, mas há telefone:

- procura cliente existente por loja + telefone;
- se não encontrar e `p_create_customer_if_missing=true`, cria cliente com:
  - `source='direct_sale'`;
  - `data_ownership='store_managed'`;
  - `editable_by_store=true`;
  - `marketing_consent` conforme parâmetro;
  - `loyalty_opt_in` conforme parâmetro.

### Venda sem cliente identificado

Se não houver cliente nem telefone válido:

- a venda ainda pode ser registrada como `Cliente balcão`;
- `customer_id` fica nulo;
- não há pontuação de fidelidade;
- não há resumo de cliente para atualizar.

## Itens

`p_items` deve ser um array JSON.

Formato esperado:

```json
[
  {
    "product_id": "uuid-do-produto",
    "quantity": 2,
    "unit_price": 10.5,
    "discount": 0
  }
]
```

Regras:

- `product_id` obrigatório;
- `quantity` maior que zero;
- máximo de 100 itens por chamada;
- `unit_price` opcional, usa preço atual do produto se ausente;
- `discount` opcional.

## Estoque

A RPC:

1. localiza local de venda;
2. valida estoque disponível em `inventory_location_balances`;
3. trava linhas com `FOR UPDATE` durante a transação;
4. baixa `on_hand` do local;
5. baixa `on_hand` global em `inventory_balances`;
6. registra `stock_movements` com:
   - `source='direct_sale'`;
   - `reason_code='direct_sale_completed'`;
   - `affects_physical=true`;
   - vínculo com `order_id`.

## Integrações pós-venda

Após criar o pedido e baixar estoque:

- chama `refresh_customer_commercial_summary` se houver cliente;
- chama `apply_order_loyalty_points_advanced` se houver cliente;
- chama `create_cashbook_entry_from_order` para gerar lançamento no caixa, respeitando `payment_metadata.affects_cashbook`.

## Decisões técnicas

### Não usar `create_public_order_by_slug`

A RPC pública por slug continua correta para loja pública/WhatsApp/QR.

Mas o painel admin precisa de fluxo próprio, com:

- usuário autenticado;
- permissão `orders.manage`;
- possibilidade de cliente rápido;
- baixa imediata;
- rastreabilidade administrativa.

### Não criar permissões novas ainda

Foram usadas permissões existentes:

- `orders.manage`;
- `customers.manage`.

Não foram criadas agora:

- `sales.direct.manage`;
- `customers.sensitive.view`;
- `customers.marketing.manage`.

Essas ficam como evolução futura se a UX exigir separação mais fina.

## SQL de validação criado

Arquivo:

- `docs/sql_diagnostics/validate_pos9_direct_sale_rpc.sql`

Valida:

- existência da função;
- assinatura;
- `SECURITY DEFINER`;
- grants para `anon`, `authenticated` e `service_role`;
- prévia da definição.

## Próximo passo

1. Aplicar a migration no Supabase.
2. Executar:
   - `docs/sql_diagnostics/validate_pos9_direct_sale_rpc.sql`.
3. Enviar o resultado.

## Próxima etapa depois da validação

Após validar a RPC:

- integrar no frontend em fluxo de venda direta/admin;
- ou criar primeiro um service TypeScript para encapsular a chamada;
- depois evoluir a tela de Clientes 360º e permitir iniciar venda a partir do cliente.
