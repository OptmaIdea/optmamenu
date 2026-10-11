# Homologação — Camada 0C.5B — Baseline reconstruída localmente

Data: 2026-08-23

## Objetivo

Validar se o dump real do schema `public` capturado do Supabase remoto consegue reconstruir o estado estrutural atual do OptmaMenu sobre um Supabase local limpo, sem depender da migration history divergente.

## Evidência

O arquivo utilizado foi:

`supabase/audit/remote_public_schema_20260823.sql`

O dump havia sido previamente validado com SHA256:

`14EA1546C0A19BA0F8B377B318C250B000E0F01D43D2E6A6DFFC0DA76DE5A36B`

O Supabase local foi iniciado com:

- `supabase/migrations/` vazio;
- `seed.sql` vazio;
- project id local isolado `optmamenu_migration_audit`;
- banco local limpo após `supabase stop --no-backup`.

O dump foi então aplicado ao Postgres local com `psql --single-transaction -v ON_ERROR_STOP=1`.

Resultado:

`ExitCode=0`

O log terminou com comandos `GRANT` e `ALTER DEFAULT PRIVILEGES`, sem erro SQL.

## Inventário pós-reconstrução

O inventário do schema reconstruído localmente foi:

- tabelas: 87
- views: 33
- funções: 398
- policies: 268
- triggers não internos: 74
- índices: 396
- tabelas `public` com RLS habilitado: 87

Esses números coincidem exatamente com o inventário read-only do schema remoto atual.

## Conclusão

PASS.

O dump real do schema `public` atual é capaz de reconstruir, sobre um Supabase local limpo, o mesmo inventário estrutural observado no projeto remoto.

Isso demonstra que o estado atual do schema é reproduzível por uma baseline consolidada, independentemente da migration history antiga, que está divergente/incompleta.

Essa evidência sustenta a estratégia de saneamento por baseline governada em vez de `migration repair` em massa ou renome de arquivos históricos.

## Limite da prova

A igualdade de contagens não prova, sozinha, igualdade byte a byte de todas as definições. A próxima microetapa deve comparar o dump do schema reconstruído localmente com o dump remoto original, preferencialmente por um diff textual/canônico antes de formalizar a baseline como nova cadeia oficial.

## Restrições mantidas

Até a baseline ser formalizada e validada:

- não executar `db push` no remoto;
- não executar `migration repair` no remoto;
- não renomear migrations antigas em massa;
- não substituir a migration history oficial sem preservar/archivear a história anterior;
- não considerar o histórico remoto recuperado como bootstrap válido.
