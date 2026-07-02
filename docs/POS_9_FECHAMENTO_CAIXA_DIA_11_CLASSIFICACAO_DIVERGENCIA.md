# POS_9 - Financeiro - Fechamento do caixa do dia - Classificacao de divergencia

## Status

Classificacao backend implementada.

## Migration criada

- `supabase/migrations/20260702203500_classify_cashbook_closing_divergence.sql`

Commit:

- `0d24d8ec354e70bec693d76822785220288fe0ef`

## Objetivo

Classificar automaticamente divergencias de caixa no backend ao salvar fechamento.

Isso garante que a regra seja aplicada mesmo se, no futuro, outro front, API ou automacao salvar o fechamento.

## Regra inicial temporaria

Enquanto ainda nao temos configuracao por loja:

| Diferenca total | Classificacao |
| --- | --- |
| 0 | none |
| ate R$ 2,00 | low |
| ate R$ 20,00 | relevant |
| acima de R$ 20,00 | critical |

## Tipo de divergencia

- `none`: sem divergencia;
- `shortage`: falta, quando conferido menor que esperado;
- `surplus`: sobra, quando conferido maior que esperado.

## Metadata salva

A RPC `save_cashbook_day_closing_safe` agora salva:

```json
{
  "has_divergence": true,
  "divergence_type": "shortage",
  "divergence_level": "relevant",
  "occurrence_required": true,
  "divergence_tolerance_snapshot": {
    "low_until": 2,
    "relevant_until": 20,
    "critical_above": 20,
    "currency": "BRL",
    "source": "temporary_backend_rule"
  },
  "divergence_snapshot": {
    "expected_total": 100,
    "confirmed_total": 95,
    "difference_total": -5
  }
}
```

## Observacao obrigatoria

Se o fechamento for `closed` e houver divergencia, a RPC exige observacao.

Erro retornado:

```txt
divergence_notes_required
```

Mensagem:

```txt
Informe uma observacao para fechar caixa com divergencia.
```

## Backfill

A migration tambem classifica fechamentos existentes que ainda nao tinham `has_divergence` no metadata.

## Validacao manual sugerida

Execute no Supabase apos aplicar a migration:

```sql
select
  id,
  closing_date,
  status,
  expected_total,
  confirmed_total,
  difference_total,
  metadata ->> 'has_divergence' as has_divergence,
  metadata ->> 'divergence_type' as divergence_type,
  metadata ->> 'divergence_level' as divergence_level,
  metadata ->> 'occurrence_required' as occurrence_required,
  notes,
  closed_by,
  closed_at
from public.cashbook_day_closings
order by closing_date desc, updated_at desc
limit 20;
```

Resultado esperado para caixa sem diferenca:

```txt
has_divergence = false
divergence_type = none
divergence_level = none
occurrence_required = false
```

Resultado esperado para caixa com diferenca:

```txt
has_divergence = true
divergence_type = shortage ou surplus
divergence_level = low, relevant ou critical
occurrence_required = true
```

## Proxima etapa visual

Depois de validar a migration, o historico deve destacar divergencias com uma etiqueta visual:

- Sem divergencia;
- Divergencia leve;
- Divergencia relevante;
- Divergencia critica.

Futuramente, criar tabela propria de ocorrencias financeiras.
