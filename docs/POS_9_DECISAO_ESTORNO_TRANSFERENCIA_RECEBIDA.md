# POS_9 — Decisão: estorno de transferência recebida

## Contexto

Durante os testes de permissões granulares de Transferências, foi validado que:

- `transfers.view` permite visualizar lista e detalhe;
- `transfers.create` permite criar rascunhos;
- `transfers.confirm` permite enviar e receber;
- `transfers.cancel` permite cancelar enquanto o fluxo ainda não foi encerrado.

Também foi identificado que uma transferência com status `received` não possui fluxo de estorno/cancelamento operacional.

## Decisão

Transferência recebida **não deve usar o mesmo cancelamento de rascunho/enviada**.

Após o recebimento, o estoque já foi movimentado:

1. no envio, a origem foi baixada;
2. no recebimento, o destino recebeu a quantidade informada;
3. divergências podem ter gerado perda, falta aceita ou retorno para origem.

Portanto, o fluxo correto é uma ação própria:

```txt
Estornar recebimento
```

## Regra funcional esperada

Ao estornar uma transferência recebida, o sistema deve:

1. exigir motivo obrigatório;
2. validar permissão operacional;
3. validar se a transferência está em status `received` ou, em etapa posterior controlada, `divergent`;
4. bloquear o estorno quando o destino não tiver saldo suficiente para devolver a quantidade recebida;
5. retirar do destino a quantidade recebida;
6. devolver para a origem a quantidade recebida;
7. registrar movimentos inversos em `stock_movements`;
8. preservar o histórico da transferência;
9. marcar no `metadata` que houve estorno;
10. atualizar a timeline operacional;
11. impedir novo estorno sobre a mesma transferência.

## Permissão

Na etapa atual, o botão de estorno pode usar:

```txt
transfers.cancel
```

Justificativa: é uma ação destrutiva/corretiva equivalente a cancelar operacionalmente uma transferência já recebida.

Possível refinamento futuro:

```txt
transfers.reverse
```

ou

```txt
transfers.refund
```

Mas não será criada agora para evitar ampliar a matriz antes do pré-publicação.

## Regras de segurança

O estorno deve ser feito no backend/RPC, não apenas no frontend.

A RPC deve:

- rodar em transação;
- bloquear linhas de transferência, itens e saldos afetados com `FOR UPDATE`;
- validar `auth.uid()`;
- validar vínculo com a loja;
- validar permissão ou, no mínimo, membro ativo até a conclusão do hardening de permissões de RPC;
- não permitir saldo negativo no destino;
- registrar `created_by`/`user_id` nos movimentos quando possível.

## UX esperada

No detalhe da transferência:

- status `draft`: permite enviar/cancelar conforme permissões;
- status `shipped`: permite receber/cancelar conforme permissões;
- status `received`: mostra botão `Estornar recebimento` se `transfers.cancel=true`;
- status `received` sem permissão: mostra aviso de leitura;
- status já estornado: mostra badge/aviso e não exibe nova ação.

## Nomes sugeridos

### Serviço frontend

```ts
stockService.reverseReceivedStockTransfer({
  transferId,
  reason,
})
```

### RPC

```sql
public.reverse_received_stock_transfer(
  p_transfer_id uuid,
  p_reason text
)
```

## Resultado esperado

Depois de implementado, o lojista conseguirá corrigir uma transferência recebida por engano sem apagar histórico e sem manipular estoque manualmente.

O sistema deve manter rastreabilidade completa: transferência original, movimentos de envio/recebimento e movimentos inversos do estorno.
