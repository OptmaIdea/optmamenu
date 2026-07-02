# POS_9 - Financeiro - Fechamento do caixa do dia - Backfill de ocorrencias divergentes

## Status

Diagnostico/backfill criado.

## Contexto

Durante o teste, a UI mostrou corretamente um fechamento com:

```txt
Divergencia Leve · Falta · Ocorrencia obrigatoria
```

No entanto, o arquivo SQL anexado mostrou que a RPC de ocorrencias ainda retornava:

```json
{
  "ok": true,
  "items": []
}
```

Isso pode acontecer se a validacao tiver sido rodada antes do fechamento divergente ou se o trigger/base de ocorrencias ainda nao estiver sincronizado com fechamentos divergentes ja existentes.

## Arquivo criado

- `docs/sql_diagnostics/sync_cashbook_closing_occurrences_backfill.sql`

Commit:

- `36ee3d24e3941c0c31ee7a2be6be734a4d1dc28d`

## O que o script faz

1. Lista fechamentos divergentes sem ocorrencia.
2. Cria/atualiza ocorrencias para todos os fechamentos com divergencia e `occurrence_required=true`.
3. Lista as ocorrencias apos o backfill.
4. Mostra contagem por status.

## Quando usar

Use se:

- a UI mostra fechamento com divergencia;
- mas `list_cashbook_closing_occurrences_safe` retorna lista vazia;
- ou apos aplicar a migration de ocorrencias em uma base que ja possuia fechamentos divergentes.

## Resultado esperado apos o teste divergente

Para o fechamento de 05/05/2026 com falta de R$ 1,00, deve aparecer uma ocorrencia parecida com:

```txt
status: open
divergence_type: shortage
divergence_level: low
difference_total: -1.00
opening_notes: Faltou 1,00 no caixa, troco errado
```

## Proxima etapa

Depois de confirmar que a ocorrencia aparece no SQL:

1. criar service frontend para listar/resolver ocorrencias;
2. mostrar no modal do fechamento se existe ocorrencia vinculada;
3. permitir atualizar status para `under_review`, `waiting_external_confirmation` ou `resolved`;
4. exigir observacao ao resolver.
