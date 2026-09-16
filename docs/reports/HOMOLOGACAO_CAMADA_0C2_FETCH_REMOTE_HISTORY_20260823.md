# Homologação — Camada 0C.2 — Fetch do histórico remoto de migrations

**Data:** 23/08/2026  
**Branch:** `agent/homologacao-geral-20260820`  
**Projeto Supabase:** `lgkkfmqzaorrutuoqeax`

## Objetivo

Separar, sem alterar o banco remoto, três fontes distintas de verdade para análise de drift:

1. migrations atualmente versionadas no Git;
2. migrations registradas no histórico remoto do Supabase;
3. schema efetivamente materializado no banco remoto.

## Procedimento executado

Foi criado um worktree temporário em:

```text
D:\OptmaIdea\optmamenu-migration-audit
```

No worktree:

- o diretório original `supabase/migrations` foi preservado como `supabase/migrations_legacy`;
- um novo `supabase/migrations` vazio foi criado;
- o worktree foi vinculado ao projeto Supabase;
- foi executado `supabase migration fetch --linked`.

## Resultado do fetch

O comando concluiu sem erro e materializou em `supabase/migrations` exatamente o conjunto registrado em `supabase_migrations.schema_migrations` no remoto.

O conjunto remoto recuperado começa em:

```text
20260626190000_fix_effective_permissions_custom_roles.sql
20260627163000_fix_user_display_identity_full_name.sql
20260627190000_fix_login_store_options_custom_role.sql
```

e depois salta para:

```text
20260721213440_add_store_member_invite_email_delivery.sql
```

seguindo até:

```text
20260801175630_normalize_transfer_insufficient_stock_message.sql
```

As quatro migrations críticas de 01/08, anteriormente ausentes no Git, foram recuperadas fielmente pelo `migration fetch`:

- `20260801123553_storefront_inventory_location_and_online_availability.sql`;
- `20260801141629_reconcile_reservations_and_backfill_completed_order_cashbook.sql`;
- `20260801141735_fix_public_order_cashbook_completion_and_pending_receivables.sql`;
- `20260801175630_normalize_transfer_insufficient_stock_message.sql`.

## Interpretação do `git status`

O grande número de `D`, `M` e `??` no worktree é esperado e não representa corrupção:

- `D` = arquivo que existia na história local/Git e não existe no histórico remoto recuperado;
- `??` = migration existente no histórico remoto e ausente no caminho original versionado;
- `M` = mesma versão/caminho existia local e remotamente, mas o conteúdo recuperado do remoto difere do conteúdo versionado;
- `supabase/migrations_legacy/` preserva a história local original integralmente.

Também foram alterados arquivos `.temp` do Supabase CLI durante `link/fetch`; isso é tooling e não deve ser confundido com alteração de schema.

## Finding estrutural crítico

O histórico remoto **não é uma cadeia completa capaz, por si só, de reconstruir o projeto desde um banco vazio**.

Entre `20260627190000` e `20260721213440` há um grande intervalo sem migrations registradas no remoto, enquanto o Git contém dezenas de migrations nesse período. O schema atual certamente contém muitas estruturas criadas/evoluídas nesse intervalo.

Portanto:

- `migration fetch` recupera fielmente o que a tabela de histórico remoto registrou;
- isso não significa que o conjunto recuperado represente toda a história real de criação do schema;
- tentar tornar o remoto reproduzível apenas renomeando/reparando timestamps antigos criaria uma história artificial e arriscada.

## Outro finding importante

Até migrations com **mesma versão** aparecem como `M`, provando que timestamp igual não garante conteúdo igual entre Git e remoto.

Isso reforça que o saneamento não pode ser feito por simples `migration repair` ou renomeação em massa.

## Estratégia recomendada a partir daqui

A estratégia preferencial passa a ser uma **baseline reproduzível do schema remoto atual**, preservando as histórias antiga/local e remota como arquivos de auditoria.

Antes de qualquer alteração no histórico remoto:

1. gerar dump schema-only do banco remoto atual em arquivo separado e read-only;
2. identificar objetos que o dump padrão não cobre adequadamente (auth/storage gerenciados, buckets, cron, DML/seeds necessários etc.);
3. testar a baseline em ambiente local/branch descartável;
4. somente após reconstrução limpa comprovada, decidir como arquivar/substituir a cadeia histórica para futuras migrations.

## Operações ainda proibidas nesta camada

Não executar ainda no projeto remoto:

```text
supabase db push
supabase db reset --linked
supabase migration repair
supabase migration up --linked
```

Também não commitar o conteúdo do worktree temporário como se fosse a nova cadeia oficial antes de validar a baseline.

## Estado

**Camada 0C.2: PASS diagnóstico.**

O drift está comprovado e a recuperação do histórico remoto foi bem-sucedida. Próxima microetapa: capturar o **schema efetivamente materializado** do banco remoto via dump read-only para desenhar a baseline.
