# PDV — correção de saldo local ausente

**Data:** 24/07/2026  
**Origem:** homologação real após o commit `1131f310ffd3e122e9323f7b61fa0d128ed9822f`.

## Cenário e causa raiz

O produto **Brigadeiro** aparecia com zero disponível na **Loja SJN**. Mesmo
após o operador confirmar “Continuar a venda e registrar a divergência de
estoque para reconciliação”, a venda falhava com `stock_balance_not_found`.

A correção anterior cobria uma linha existente em
`inventory_location_balances` com saldo insuficiente, mas não a ausência total
da linha para loja + local + produto. O catálogo tratava a ausência como zero,
enquanto a finalização retornava antes de considerar a exceção confirmada.

## Contrato corrigido

Sem confirmação da divergência:

- retorna `insufficient_stock` com produto e local;
- não cria linha zerada residual;
- não cria pedido, movimento, caixa ou auditoria.

Com confirmação da divergência:

- cria a linha local zerada com `INSERT ... ON CONFLICT DO NOTHING`;
- bloqueia a linha com `FOR UPDATE`;
- conclui a venda sem saldo negativo;
- registra movimento, pedido e `pdv_stock_exception`;
- preserva a idempotência da tentativa;
- mantém a ocorrência disponível para reconciliação.

A leitura também passou a filtrar `variant_id IS NULL`, evitando ambiguidade
com futuros saldos por variante.

## Experiência do operador

`DirectSalesService` não exibe mais códigos internos diretamente. Erros
conhecidos têm mensagens em pt-BR; falhas desconhecidas usam orientação neutra
para atualizar o PDV e tentar novamente.

## Validação transacional

O caso real **Brigadeiro + Loja SJN** foi testado com `ROLLBACK`:

1. sem confirmação retornou `insufficient_stock` e não criou saldo;
2. com confirmação concluiu a venda e manteve saldo local em zero;
3. criou um evento `pdv_stock_exception`;
4. a repetição retornou replay idempotente;
5. pedido, movimento, auditoria e saldo de teste foram revertidos.

## Relação com a proposta de precificação

A proposta anexada trata de agrupamento de categorias e autoridade de preço.
Ela não causou esta falha. O PDV continua usando o motor central de preços; esta
correção altera somente estoque local e comunicação da finalização.
