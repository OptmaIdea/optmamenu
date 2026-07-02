# POS_9 - Financeiro - Fechamento do caixa do dia - Base de ocorrencias de divergencia

## Status

Base backend criada para ocorrencias de divergencia em fechamento de caixa.

## Migration criada

- `supabase/migrations/20260702221000_create_cashbook_closing_occurrences.sql`

Commit:

- `ce884435ca968a31509eff973c7153d67d8e2bb7`

## Validacao criada

- `docs/sql_diagnostics/validate_cashbook_closing_occurrences.sql`

Commit:

- `00d8744eecd3f2c93f3b0d4e2bd2f816daf78fd3`

## Objetivo

Separar o fechamento do caixa da auditoria/resolucao de divergencias.

O fechamento registra o resultado do caixa.

A ocorrencia registra que existe uma divergencia que precisa ser acompanhada, revisada ou resolvida.

## Tabela criada

- `public.cashbook_closing_occurrences`

## Relacionamento

Cada ocorrencia fica vinculada a um fechamento:

- `closing_id -> cashbook_day_closings.id`

Foi criada constraint unica:

- uma ocorrencia por fechamento.

## Campos principais

- `store_id`;
- `closing_id`;
- `closing_date`;
- `status`;
- `divergence_type`;
- `divergence_level`;
- `expected_total`;
- `confirmed_total`;
- `difference_total`;
- diferencas por forma de pagamento;
- `opening_notes`;
- `resolution_type`;
- `resolution_notes`;
- `resolved_by`;
- `resolved_at`;
- `metadata`.

## Status suportados

- `open`;
- `waiting_external_confirmation`;
- `under_review`;
- `resolved`;
- `cancelled`;
- `converted_to_loss`;
- `converted_to_adjustment`.

## Gatilho automatico

Criado trigger:

- `trg_sync_cashbook_closing_occurrence`

Ele roda apos insert/update em `cashbook_day_closings`.

Se o fechamento tiver divergencia e `occurrence_required=true`, cria ou atualiza a ocorrencia.

Se o fechamento deixar de ter divergencia, cancela ocorrencia aberta relacionada.

## Backfill

A migration faz backfill de fechamentos divergentes existentes.

Como os fechamentos atuais testados estavam sem divergencia, a expectativa atual pode ser zero ocorrencias.

## RPCs criadas

### Listar ocorrencias

```sql
public.list_cashbook_closing_occurrences_safe(
  p_store_id uuid,
  p_status text default null,
  p_limit integer default 50
)
```

### Resolver/atualizar ocorrencia

```sql
public.resolve_cashbook_closing_occurrence_safe(
  p_store_id uuid,
  p_occurrence_id uuid,
  p_status text,
  p_resolution_type text,
  p_resolution_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
```

## Permissoes atuais

Leitura:

- owner;
- `cashbook.view`;
- `cashbook.create`.

Escrita/resolucao:

- owner;
- `cashbook.create`.

Permissoes granulares futuras sugeridas:

- `cashbook.occurrence.view`;
- `cashbook.occurrence.review`;
- `cashbook.occurrence.resolve`.

## Importante

A tabela de ocorrencias nao substitui o fechamento.

Ela complementa o fechamento.

Regra conceitual:

```txt
Fechamento com divergencia = caixa encerrado + pendencia de auditoria/resolucao.
```

## Proxima etapa recomendada

1. Aplicar a migration no Supabase.
2. Rodar a validacao.
3. Depois criar service frontend para listar/resolver ocorrencias.
4. Depois criar UI simples no historico/modal para mostrar e resolver ocorrencias.
