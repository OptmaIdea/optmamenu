# Homologação — Camada 0C.5A — Bootstrap local validado

Data: 2026-08-23

## Objetivo

Validar que um stack Supabase local isolado pode iniciar sem aplicar a cadeia histórica divergente de migrations do OptmaMenu, preservando o projeto remoto.

## Preparação confirmada

No worktree descartável `optmamenu-migration-audit`:

- `supabase/migrations/` foi deixado vazio;
- `supabase/migrations_remote_history/` preserva o histórico recuperado do remoto;
- `supabase/migrations_legacy/` preserva a história antiga do Git;
- `supabase/seed.sql` foi criado vazio apenas para o teste;
- `project_id` local foi alterado para `optmamenu_migration_audit`;
- o estado local anterior foi removido com `supabase stop --no-backup --project-id optmamenu_migration_audit`.

## Resultado

`npx supabase start` concluiu com sucesso e exibiu `Started supabase local development setup`.

Não houve aplicação de migrations do OptmaMenu durante o bootstrap. O fluxo observado foi apenas:

- start do banco;
- inicialização dos schemas internos;
- seed global de roles;
- seed local vazio;
- start dos containers;
- health checks.

`npx supabase status` confirmou `supabase local development setup is running`.

Serviços `imgproxy` e `pooler` apareceram como parados, sem impedir o funcionamento do stack base. O pooler está desabilitado no `config.toml`; imgproxy não é requisito para esta prova de baseline.

## Segurança operacional

As chaves exibidas pelo CLI pertencem ao ambiente Supabase local descartável e não são credenciais do projeto hospedado. Não devem ser versionadas nem reutilizadas em produção.

O aviso de Analytics no Windows é específico do ambiente local e não bloqueou o start.

## Estado da camada

0C.5A: PASS.

O ambiente local limpo está pronto para a próxima etapa: aplicar apenas o dump `remote_public_schema_20260823.sql` no Postgres local e medir se a fotografia real do schema remoto é reconstruível sem depender da migration history antiga.

Nenhuma alteração foi feita no banco remoto.
