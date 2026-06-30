# POS_9 — Financeiro — Pagamento pendente não compõe saldo do caixa

## Status

Correção preparada.

## Contexto

Após a criação/validação do PDV rápido, foi observado que vendas concluídas com forma de pagamento:

- `pending`;

estavam indo para o Livro Diário de Caixa e compondo o saldo.

## Problema

Pagamento pendente representa:

- pagamento a combinar;
- pagamento ainda não recebido;
- valor comercial vendido, mas ainda sem entrada financeira efetiva.

Portanto, não deve compor:

- entradas efetivas;
- saldo atual do caixa;
- total acumulado financeiro.

## Regra de negócio

```txt
Pagamento recebido = entra no caixa e compõe saldo.
Pagamento pendente = aparece como venda/pedido, mas não compõe saldo.
Pagamento futuro confirmado = entra no caixa no momento da confirmação.
```

## Escopo da correção

A correção foi feita no ponto mais seguro:

- preservar pedido;
- preservar venda;
- preservar estoque;
- preservar dashboard comercial;
- preservar PDV;
- impedir apenas a geração/impacto financeiro quando o pagamento está pendente.

## Migration criada

Arquivo:

- `supabase/migrations/20260630153000_fix_pending_cashbook_balance.sql`

Commit:

- `d540e6e780577d9a498590a23b77dc571bc7ff5b`

## O que a migration faz

### 1. Ajusta venda direta

Na função:

- `create_admin_direct_sale_order_safe(...)`

Substitui a chamada direta de:

- `create_cashbook_entry_from_order(v_order_id)`

por uma guarda:

```txt
Se payment_method_code != pending e affects_cashbook=true:
  gera lançamento no caixa
Senão:
  não gera lançamento financeiro efetivo
```

### 2. Corrige lançamentos pendentes já criados

Atualiza lançamentos existentes em `cashbook_entries` ligados a pedidos com pagamento pendente:

- mantém o lançamento no histórico;
- muda `affects_balance=false`;
- muda status para `pending` quando ainda estava ativo;
- registra metadados de correção.

Assim eles deixam de compor saldo.

## Validação criada

Arquivo:

- `docs/sql_diagnostics/validate_pending_cashbook_balance.sql`

Commit:

- `6be2039ebe9eab126d6ff06f6aae7b0503260269`

## Validação esperada

Após aplicar a migration, executar o SQL de validação.

Resultado esperado:

```txt
pending_affecting_balance = 0
function_has_guard = true
```

## Observação sobre permissões

A tela de venda direta continua dependendo de permissão.

A rota e o fluxo continuam usando a proteção existente:

- `orders.manage`.

Nenhuma permissão nova foi criada.

## Próxima frente

Depois de validar que pagamentos pendentes não impactam saldo, voltar ao financeiro para:

- separar vendas recebidas de pendentes;
- exibir pendentes como recebíveis/pendências;
- criar fluxo de confirmação de recebimento;
- definir se Pix/Dinheiro/Cartão entram automaticamente no caixa;
- definir se pagamento pendente deve aparecer em seção própria.
