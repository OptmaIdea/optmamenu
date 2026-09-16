# Homologação — Camada 0C.3 — Schema real remoto

Data: 2026-08-23
Branch: `agent/homologacao-geral-20260820`
Projeto Supabase: `lgkkfmqzaorrutuoqeax`

## Evidência local

No worktree descartável `D:\OptmaIdea\optmamenu-migration-audit`, foi executado com sucesso:

```powershell
npx supabase db dump --linked --schema public --keep-comments --file .\supabase\audit\remote_public_schema_20260823.sql
```

Resultado:

- dump concluído sem erro;
- arquivo gerado em `supabase/audit/remote_public_schema_20260823.sql`;
- tamanho informado pelo filesystem: `2.004.711` bytes;
- o arquivo permanece apenas no worktree de auditoria e não foi commitado.

## Inventário remoto read-only do schema `public`

Consulta direta ao projeto remoto em 2026-08-23:

- tabelas base: **87**;
- views: **33**;
- funções: **398**;
- tabelas com RLS habilitado: **87**;
- policies: **268**;
- triggers não internos: **74**;
- índices: **396**.

## Conclusão

A camada agora possui três fontes independentes para a reconstrução:

1. `migrations_legacy/` — história que existia no Git;
2. `migrations/` — história recuperada da tabela remota de migrations;
3. `remote_public_schema_20260823.sql` — estado efetivo atual do schema `public`.

O histórico remoto, isoladamente, não deve ser tratado como bootstrap confiável: existe um intervalo significativo sem migrations remotas apesar de o schema atual conter objetos que dependem das evoluções desse período. O dump do estado real passa a ser a referência técnica para desenhar uma baseline reproduzível.

## Próximo passo seguro

Antes de versionar ou promover esse dump a baseline, validar localmente:

- checksum SHA-256 do arquivo;
- ausência de segredos/credenciais no texto;
- presença esperada de definições de tabelas, views, funções, policies, triggers, índices e grants;
- capacidade de aplicar o schema em um ambiente local descartável sem tocar no projeto remoto.

Até essa validação, continuam proibidos no projeto vinculado:

- `supabase db push`;
- `supabase db reset`;
- `supabase migration repair` em massa;
- renomear a cadeia histórica para forçar alinhamento;
- aplicar migrations reconstruídas por aproximação.
