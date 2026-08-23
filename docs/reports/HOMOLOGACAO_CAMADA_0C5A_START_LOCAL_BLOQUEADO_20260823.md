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

## Observação operacional importante

O objetivo da 0C.5A era iniciar o stack com `supabase/migrations/` vazio. Como o CLI efetivamente tentou aplicar `20260626190000...`, é necessário confirmar o conteúdo atual de `supabase/migrations/` antes de repetir `supabase start`.

No trecho de comandos recebido para esta tentativa não aparece a etapa de renomear `supabase/migrations` para `supabase/migrations_remote_history` e recriar `supabase/migrations` vazio. Portanto, a hipótese prioritária é que o diretório ativo ainda continha o histórico remoto recuperado.

## Estado

- banco remoto: não alterado;
- worktree: descartável;
- containers locais: interrompidos automaticamente após a falha;
- schema dump remoto preservado;
- conclusão arquitetural anterior reforçada: será necessária uma baseline real do schema atual, não simples reaplicação do migration history remoto.

## Próxima ação segura

Antes de qualquer nova tentativa de `supabase start`:

1. listar diretórios `migrations*` em `supabase/`;
2. listar os primeiros arquivos do diretório ativo `supabase/migrations/`;
3. somente depois isolar corretamente a história remota e deixar `supabase/migrations/` vazio para subir o stack base.

Não executar `db push`, `db reset --linked`, `migration repair` ou `migration up` nesta etapa.
