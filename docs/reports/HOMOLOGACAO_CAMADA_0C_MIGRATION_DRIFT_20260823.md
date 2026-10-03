# Homologação — Camada 0C: drift de migrations

**Data:** 23/08/2026  
**Branch:** `agent/homologacao-geral-20260820`  
**Projeto Supabase:** `lgkkfmqzaorrutuoqeax`

## Resultado

A saída de `npx supabase migration list` confirma drift histórico relevante entre `supabase/migrations` local e `supabase_migrations.schema_migrations` remoto.

Contagem apurada a partir da saída fornecida:

- 164 linhas de versões listadas;
- 10 versões com correspondência local/remota;
- 100 versões presentes somente no local;
- 54 versões presentes somente no remoto;
- 0 linhas com uma versão local pareada explicitamente a uma versão remota diferente;
- 1 versão local duplicada: `202607232155` aparece duas vezes;
- nenhuma migration local começando por `20260801` foi encontrada pelo `Get-ChildItem` executado no clone local.

As quatro migrations remotas de 01/08 permanecem ausentes do diretório local:

- `20260801123553_storefront_inventory_location_and_online_availability`;
- `20260801141629_reconcile_reservations_and_backfill_completed_order_cashbook`;
- `20260801141735_fix_public_order_cashbook_completion_and_pending_receivables`;
- `20260801175630_normalize_transfer_insufficient_stock_message`.

## Interpretação

O problema é maior do que quatro arquivos ausentes. Existem duas histórias de migration que divergiram por um período significativo:

1. migrations locais que não constam como aplicadas na tabela de histórico remoto;
2. migrations aplicadas remotamente que não existem no diretório local;
3. ao menos um timestamp local duplicado.

Isso significa que `supabase db push`, `migration up`, `db reset` ou `migration repair` não devem ser usados até reconciliarmos a história. Um `db push` poderia tentar reaplicar dezenas de migrations locais antigas sobre um schema que já recebeu mudanças equivalentes ou sucessoras por outros caminhos.

O fato de o schema operacional atual estar funcionando e os testes/build passarem não significa que a cadeia de migrations seja reproduzível.

## Próxima subetapa 0C.1 — inventário somente leitura

Executar localmente, sem mutação:

```powershell
Get-ChildItem .\supabase\migrations\ -File |
  Sort-Object Name |
  Select-Object -ExpandProperty Name |
  Set-Content .\docs\reports\LOCAL_MIGRATIONS_20260823.txt
```

Depois localizar o timestamp duplicado:

```powershell
Get-ChildItem .\supabase\migrations\ -File |
  Where-Object { $_.Name -match '^202607232155' } |
  Select-Object Name, FullName
```

E gerar um recorte das migrations locais de 21/07 a 26/07:

```powershell
Get-ChildItem .\supabase\migrations\ -File |
  Where-Object { $_.Name -match '^2026072[1-6]' } |
  Sort-Object Name |
  Select-Object -ExpandProperty Name
```

## Não executar ainda

```text
supabase db push
supabase db reset
supabase migration repair
supabase migration up
```

Também não renomear migrations antigas nem criar arquivos vazios apenas para fazer a lista alinhar.

## Estratégia de reconciliação — ainda não executar

Depois do inventário, escolheremos entre:

### Estratégia A — reconciliação histórica

Recuperar/identificar cada migration remota ausente, mapear equivalências com arquivos locais e reparar a tabela de histórico de forma controlada. Preserva a história completa, mas é mais trabalhosa.

### Estratégia B — baseline reproduzível

Congelar o schema remoto atual como baseline testável, preservar migrations históricas em arquivo, validar o baseline em ambiente isolado/local e iniciar uma cadeia limpa a partir dele. Pode ser mais segura quando a história antiga foi aplicada por múltiplos caminhos, mas exige desenho cuidadoso para não alterar indevidamente o histórico do projeto remoto atual.

A escolha deve ocorrer apenas depois de conhecermos nomes/conteúdo das 100 migrations local-only e a relação semântica com as 54 remote-only.
