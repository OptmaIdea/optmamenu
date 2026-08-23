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

## Contagem textual inicial

Resultado do primeiro regex:

- Tables: 0
- Views: 0
- Functions: 0
- Policies: 268
- Triggers: 0

Esses zeros não indicam ausência dos objetos. A inventariação read-only feita diretamente no banco já confirmou 87 tabelas, 33 views, 398 funções, 268 policies, 74 triggers e 396 índices no schema `public`.

A explicação mais provável é apenas incompatibilidade do regex com a forma de emissão do `pg_dump`, que tende a usar identificadores entre aspas e, dependendo do objeto, `IF NOT EXISTS` / `OR REPLACE`.

## Próxima verificação

Inspecionar as primeiras linhas `CREATE ...` do dump e repetir as contagens com regex tolerante a:

- `"public"."objeto"`;
- `IF NOT EXISTS`;
- `OR REPLACE`.

Nenhuma alteração no banco remoto foi necessária ou realizada nesta etapa.
