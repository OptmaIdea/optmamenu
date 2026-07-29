# PDV — Fase 1: fundação segura do backend

Data: 24/07/2026

## Escopo concluído

Esta etapa prepara a Venda Direta e o futuro PDV dedicado para usar o mesmo
motor central já validado na loja pública.

Implementado:

- `calculate_store_cart_pricing` passou a ser a autoridade final da Venda Direta;
- preços, origem e faixa enviados pelo frontend deixaram de ser confiáveis;
- desconto manual continua separado do desconto automático;
- `orders.idempotency_key` é único por loja;
- `orders.idempotency_fingerprint` detecta reutilização da chave com outro conteúdo;
- repetição legítima retorna o pedido original sem nova baixa;
- a tela mantém a mesma chave enquanto a tentativa não for alterada ou concluída;
- Cliente de balcão foi marcado como operacional e saiu da fidelidade futura;
- os 148 pontos históricos do Cliente de balcão foram preservados para auditoria;
- foram cadastradas 12 permissões específicas do PDV.

## Permissões cadastradas

```text
pdv.view
pdv.sell
pdv.discount.apply
pdv.price.override
pdv.item.cancel
pdv.sale.cancel
pdv.customer.select
pdv.payment.change
pdv.cash.open
pdv.cash.close
pdv.history.view
pdv.receipt.reprint
```

O proprietário recebe acesso integral pelo modelo vigente. Os padrões iniciais
para `admin`, `manager` e `cashier` foram propagados pelos triggers do catálogo
para todas as lojas e todos os oito papéis existentes.

## Compatibilidade

A assinatura pública de `create_admin_direct_sale_order_safe` foi preservada.
A implementação anterior foi renomeada para
`create_admin_direct_sale_order_legacy_internal`, sem `EXECUTE` para `anon` ou
`authenticated`. A nova função pública:

1. valida acesso à loja;
2. resolve e bloqueia a chave de idempotência;
3. recalcula o carrinho no motor central;
4. monta itens autoritativos;
5. executa a transação legada já validada de pedido, estoque e caixa;
6. grava o snapshot do motor e a chave no pedido;
7. retorna replay seguro quando a mesma tentativa reaparece.

## Validação executada

Foi executada uma venda de teste em subtransação revertida usando:

- produto `Melancia`;
- preço forjado no cliente: R$ 0,01;
- preço-base/autoritativo: R$ 3,75;
- mesmo `idempotency_key` em duas chamadas;
- terceira chamada com a mesma chave e quantidade diferente;
- Cliente de balcão.

Resultados:

```text
primeira venda criada: OK
preço do frontend ignorado: OK
preço autoritativo gravado: R$ 3,75
snapshot do motor central: OK
estoque baixado uma vez: OK
replay devolveu o mesmo pedido: OK
replay não baixou estoque novamente: OK
reutilização conflitante bloqueada: OK
fidelidade do Cliente de balcão ignorada: OK
estoque restaurado após rollback do teste: OK
pedido de teste removido pelo rollback: OK
```

O deploy Vercel do commit final desta etapa concluiu com sucesso.

## Próxima etapa

Iniciar a Fase PDV-2:

1. estrutura extensível de códigos do produto (`internal`, `EAN`, `SKU`, outros);
2. rota `/admin/pdv`;
3. `PdvLayout` exclusivo;
4. bootstrap de loja, local e operador;
5. redirecionamento automático para usuário somente-PDV;
6. catálogo reduzido com estoque disponível em tempo real;
7. RPC própria `create_pos_sale_safe`, reutilizando o motor e a idempotência
   desta fundação.

Ainda não fazem parte desta entrega:

- sessão de caixa;
- venda offline;
- câmera para código de barras;
- impressão térmica;
- empacotamento Android;
- Centro de Atendimento e WhatsApp oficial.
