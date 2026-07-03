# POS_9 - Financeiro - Classificacao da reposicao de divergencia

## Status

Implementado backend para classificar automaticamente reposicoes de divergencia no Livro Diario.

## Migration criada

- `supabase/migrations/20260703033000_classify_replenishment_cashbook_entry.sql`

Commit:

- `6c83d09dec7ba5112cdf320e766c9edbd5dab4ec`

## Validacao criada

- `docs/sql_diagnostics/validate_replenishment_cashbook_classification.sql`

Commit:

- `14a3c5c178272c278572fcd375996a8f300593bc`

## Regra aplicada

Quando uma ocorrencia de fechamento for resolvida por reposicao de valor:

```txt
account_plan_code = closing_replenishment
destino = cash_drawer
affects_cash_drawer = true
affects_financial_result = false
is_transfer = false
```

## Por que isso e importante

A reposicao de divergencia aumenta o dinheiro fisico disponivel no caixa, mas nao deve ser tratada como venda ou receita operacional.

Ela representa recuperacao posterior de um valor que faltou no fechamento.

## Backfill

A migration tambem aplica uma classificacao leve em reposicoes ja criadas anteriormente, quando identificadas por metadata:

```txt
source = cashbook_closing_occurrence_resolution
financial_effect = cash_replenishment
```

## Impacto

Nao altera telas existentes.

Nao muda ainda o calculo visual do Livro Diario.

Apenas prepara os dados para separar futuramente:

- saldo fisico do caixa;
- movimento financeiro;
- transferencias internas;
- despesas reais;
- ajustes.

## Proxima etapa sugerida

Evoluir os lancamentos manuais para selecionar:

- categoria/plano;
- conta de origem;
- conta de destino;
- se afeta gaveta fisica;
- se afeta resultado financeiro.
