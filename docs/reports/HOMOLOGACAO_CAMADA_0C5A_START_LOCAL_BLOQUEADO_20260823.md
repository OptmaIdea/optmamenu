# Homologação — Camada 0C.5A — Start local bloqueado por migration history incompleta

Data: 2026-08-23

## Contexto

O worktree descartável `optmamenu-migration-audit` foi preparado para subir um Supabase local isolado e, em seguida, testar a reconstrução do schema real capturado do remoto.

Durante `npx supabase start`, a primeira tentativa enfrentou limitação temporária do registry (`toomanyrequests: Rate exceeded`). Na segunda tentativa, as imagens necessárias já estavam presentes e o bloqueio de rede deixou de ser o problema principal.

## Falha real observada

O stack local iniciou o banco, inicializou os schemas internos do Supabase e então tentou aplicar:

`20260626190000_fix_effective_permissions_custom_roles.sql`

A migration falhou com:

`ERROR: relation "public.store_permission_versions" does not exist (SQLSTATE 42P01)`

no `INSERT INTO public.store_permission_versions (...)`.

Isso prova duas coisas:

1. a migration `20260626190000_fix_effective_permissions_custom_roles.sql` não é uma migration de bootstrap independente; ela pressupõe schema anterior já existente;
2. o histórico recuperado do remoto não constitui, sozinho, uma cadeia capaz de reconstruir o banco do zero.

## Confirmação posterior

Foi inspecionado o worktree após a falha.

Diretórios encontrados em `supabase/`:

- `migrations/`;
- `migrations.back/`;
- `migrations_legacy/`.

Não existia ainda `migrations_remote_history/`.

O diretório ativo `supabase/migrations/` continha efetivamente o histórico remoto recuperado, começando por:

- `20260626190000_fix_effective_permissions_custom_roles.sql`;
- `20260627163000_fix_user_display_identity_full_name.sql`;
- `20260627190000_fix_login_store_options_custom_role.sql`;
- `20260721213440_add_store_member_invite_email_delivery.sql`;
- e demais migrations recuperadas via `migration fetch`.

Portanto, a hipótese operacional foi confirmada: o `supabase start` não estava sendo executado com `supabase/migrations/` vazio.

## Estado

- banco remoto: não alterado;
- worktree: descartável;
- containers locais: interrompidos automaticamente após a falha;
- schema dump remoto preservado;
- conclusão arquitetural anterior reforçada: será necessária uma baseline real do schema atual, não simples reaplicação do migration history remoto.

## Próxima ação segura

No worktree descartável:

1. renomear `supabase/migrations/` para `supabase/migrations_remote_history/`;
2. recriar `supabase/migrations/` vazio;
3. manter o seed original preservado e usar `seed.sql` vazio neste teste;
4. iniciar novamente o stack local e confirmar `supabase status`;
5. somente depois testar a aplicação do dump do schema real no banco local.

Não executar `db push`, `db reset --linked`, `migration repair` ou `migration up` nesta etapa.
