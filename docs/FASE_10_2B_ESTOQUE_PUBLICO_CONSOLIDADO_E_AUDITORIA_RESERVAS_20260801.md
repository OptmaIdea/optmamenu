# Fase 10.2B — Estoque público consolidado e auditoria de reservas

Data: 01/08/2026
Branch: `agent/fase-10-loja-publica-blueprint`
PR: `#7`

## Objetivo

Consolidar o comportamento implementado para o estoque da loja pública por slug e registrar a auditoria inicial da camada de reservas antes da homologação externa com o parceiro da Gelinhares.

## Fonte autoritativa do catálogo público

A disponibilidade pública é calculada exclusivamente a partir do local vinculado em:

```text
stores.public_sales_location_id
```

Para a slug `gelinharessjn`, o local configurado é:

```text
Loja SJN — LOJA-SJN
```

O catálogo não soma estoques de outros locais e não usa o saldo global para decidir se um produto está disponível na slug.

## Cálculo da quantidade online

```text
disponível_local = físico_local - reservado_local
saldo_após_reserva = max(disponível_local - reserva_presencial, 0)
disponível_online = min(saldo_após_reserva, teto_online)
```

Quando não existe teto online, `disponível_online` corresponde ao saldo restante após a reserva presencial.

O resultado nunca pode ser negativo.

## Configurações gerais

Disponíveis em:

```text
/admin/settings → Pedido Online → Estoque da loja pública
```

Campos:

- local de estoque vinculado à slug;
- reserva mínima para venda local;
- limite máximo disponível online;
- limite de poucas unidades;
- exibição da quantidade exata em estoque baixo;
- publicação de produtos por padrão.

A seção foi posicionada abaixo da área principal de salvamento e permanece recolhida inicialmente.

## Regras por produto

A tabela `storefront_product_settings` permite sobrescrever por produto:

- publicação na slug;
- reserva mínima presencial;
- teto online;
- limite de poucas unidades;
- exibição da quantidade exata.

Campos individuais vazios herdam a regra geral da loja.

## Estados públicos

```text
0 unidades online                  → Indisponível no momento
1 até o limite configurado         → Poucas unidades
acima do limite configurado        → Disponível
```

A quantidade exata somente é exibida quando:

1. o produto está classificado como `low_stock`;
2. a regra efetiva permite mostrar quantidade exata.

Exemplos:

```text
1 unidade disponível
3 unidades disponíveis
Poucas unidades
Indisponível no momento
```

Produtos com estoque normal não exibem a quantidade exata.

## Validação concluída

- o produto Abacaxi deixou de usar saldo global e passou a refletir saldo zero na Loja SJN;
- o catálogo passou a ordenar indisponíveis ao final;
- a grade administrativa consulta o saldo do local vinculado;
- a quantidade exata passou a aparecer somente em estoque baixo;
- o commit `8df47b705bdeb61b0d8622431643f67b3e772c43` foi confirmado como `Ready` na Vercel.

## Auditoria inicial de reservas

Foi comparado o campo `inventory_location_balances.reserved` da Loja SJN com reservas efetivamente ativas em `stock_reservations`.

Resultado encontrado em 01/08/2026:

| Produto | Físico | Reservado no saldo | Reserva ativa válida |
|---|---:|---:|---:|
| Abacate | 17 | 3 | 0 |
| Acerola | 2 | 2 | 0 |
| Amendoim | 7 | 2 | 0 |
| Graviola | 12 | 9 | 0 |
| Menta | 8 | 5 | 0 |

Também não foram encontradas reservas com status `active` já expiradas para esses produtos no local.

## Diagnóstico preliminar

Existe divergência entre:

```text
inventory_location_balances.reserved
```

e a soma das reservas válidas em:

```text
stock_reservations
```

O saldo reservado materializado está reduzindo indevidamente a disponibilidade pública, mesmo sem reserva ativa correspondente.

## Próxima frente obrigatória antes da homologação externa

Revisar o ciclo completo de reservas:

1. criação da reserva;
2. incremento do saldo reservado por local;
3. confirmação e consumo;
4. cancelamento;
5. expiração;
6. decremento do saldo reservado;
7. idempotência;
8. recomposição segura de saldos legados divergentes.

Funções existentes que precisam ser revisadas em conjunto:

- `reserve_order_stock`;
- `reserve_stock`;
- `confirm_reserved_stock`;
- `confirm_reserved_public_order`;
- `cancel_order_reservations`;
- `cancel_reservation_only`;
- `cancel_expired_reservations`;
- `cleanup_expired_reservations`;
- `expire_public_order_reservations`;
- `get_active_stock_reservation_origins`.

## Regra de segurança para o saneamento

Não zerar `reserved` indiscriminadamente.

O saneamento deve recalcular o reservado por produto e local com base nas reservas efetivamente válidas, preservar reservas legítimas e registrar a correção para auditoria.

## Próximas etapas após reservas

Depois de fechar a consistência das reservas:

1. homologação interna do catálogo e checkout;
2. revisão do fluxo de indisponibilidade durante o checkout;
3. aceite legal no checkout;
4. revisão dos cartões informativos ainda sem ação;
5. pacote de homologação externa para o parceiro via deploy público da Vercel.
