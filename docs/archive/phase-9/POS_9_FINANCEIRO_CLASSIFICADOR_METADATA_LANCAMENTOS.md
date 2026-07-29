# POS_9 - Financeiro - Classificador por metadata dos lançamentos

## Status

Criado trigger para classificar automaticamente lançamentos do Livro Diario com base em metadata.

## Migration criada

- `supabase/migrations/20260703040000_cashbook_entries_metadata_classifier.sql`

Commit:

- `27131fe52669ba6a814ea271cf564b316e453955`

## Validação criada

- `docs/sql_diagnostics/validate_cashbook_metadata_classifier.sql`

Commit:

- `58c8d29962a2fbe548bdc9a903bcfa38a41ad753`

## Função criada

- `apply_cashbook_entry_metadata_classification`

## Trigger criado

- `trg_cashbook_entry_metadata_classification`

Tabela:

- `cashbook_entries`

Momento:

- `BEFORE INSERT OR UPDATE OF metadata`

## Campos aceitos em metadata

```txt
account_plan_code
source_financial_account_code
destination_financial_account_code
is_transfer
affects_cash_drawer
affects_financial_result
```

## Campos preenchidos na tabela

```txt
account_plan_code
source_financial_account_id
destination_financial_account_id
is_transfer
affects_cash_drawer
affects_financial_result
```

## Utilidade

Esse classificador permite evoluir o Livro Diario sem quebrar a RPC atual `create_cashbook_entry`.

A UI ou uma RPC futura pode enviar classificações via metadata, e o banco converte isso para campos estruturados.

## Casos suportados

- reposição de divergência;
- reforço de troco;
- aporte do proprietário;
- sangria;
- caixa para cofre;
- cofre para caixa;
- caixa para banco;
- troca de cédulas/moedas;
- recebimento pendente;
- despesa operacional.

## Próxima etapa

Evoluir os lançamentos manuais do Livro Diario para selecionar:

- categoria;
- origem;
- destino;
- se afeta caixa físico;
- se afeta resultado financeiro.
