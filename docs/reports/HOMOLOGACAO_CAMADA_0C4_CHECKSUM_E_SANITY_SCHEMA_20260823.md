# Homologação — Camada 0C.4 — Checksum e sanity check do schema remoto

Data: 2026-08-23

## Evidência local recebida

Dump analisado:

`supabase/audit/remote_public_schema_20260823.sql`

SHA256:

`14EA1546C0A19BA0F8B377B318C250B000E0F01D43D2E6A6DFFC0DA76DE5A36B`

## Checagem de possíveis segredos

Foram pesquisados apenas os marcadores abaixo, por contagem, sem exposição de conteúdo:

- `sb_secret_`: 0
- `SUPABASE_SERVICE_ROLE_KEY`: 0
- `BEGIN PRIVATE KEY`: 0
- `smtp-relay`: 0
- `SMTP_PASSWORD`: 0

Resultado: PASS para os marcadores verificados.

## Sintaxe real do dump

A inspeção das primeiras linhas `CREATE ...` confirmou que o `pg_dump` usa identificadores entre aspas, por exemplo:

- `CREATE TABLE IF NOT EXISTS "public"."..."`
- `CREATE OR REPLACE FUNCTION "public"."..."`
- `CREATE TYPE "public"."..."`

Por isso o primeiro regex, que esperava `public.objeto` sem aspas, retornou zero para alguns tipos de objeto.

## Contagem textual corrigida

Após ajustar os regex para a sintaxe real do dump, as contagens foram:

- Tables: 87
- Views: 33
- Functions: 398
- Policies: 268
- Triggers: 74

## Comparação com inventário read-only do banco remoto

Inventário independente obtido diretamente no schema `public` do projeto remoto:

- Tables: 87
- Views: 33
- Functions: 398
- Policies: 268
- Triggers: 74
- Indexes: 396
- RLS enabled tables: 87

As cinco classes de objeto comparáveis entre o dump textual e a consulta read-only bateram exatamente.

Resultado: PASS.

## Conclusão

O arquivo `remote_public_schema_20260823.sql` é uma captura coerente do schema `public` atual do projeto remoto no momento da coleta, com checksum conhecido e sem ocorrência dos marcadores de segredo verificados.

Isto não prova, por si só, que o dump é suficiente para reconstruir sozinho todo o ambiente Supabase, pois schemas gerenciados como `auth`, `storage` e extensões são tratados separadamente pelo stack. A próxima etapa deve testar o dump em um stack local descartável, sem aplicar a cadeia histórica divergente de migrations.

Nenhuma alteração no banco remoto foi necessária ou realizada nesta etapa.
