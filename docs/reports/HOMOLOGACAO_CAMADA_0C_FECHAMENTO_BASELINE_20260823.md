# Homologação — Camada 0C — Fechamento da baseline de migrations

Data: 2026-08-23

## Resultado final

A camada 0C foi concluída com PASS técnico para a estratégia de baseline do schema atual.

### Evidências consolidadas

1. O histórico local de migrations e o histórico remoto estavam divergentes em timestamps, cobertura e, em alguns casos, conteúdo.
2. O histórico remoto recuperado via `migration fetch` não constitui uma cadeia completa de bootstrap; a tentativa de iniciar um banco novo aplicando esse histórico falhou já na migration `20260626190000_fix_effective_permissions_custom_roles.sql` por depender de objetos anteriores ausentes.
3. Foi capturado um dump somente do schema `public` remoto e validado com SHA256:
   `14EA1546C0A19BA0F8B377B318C250B000E0F01D43D2E6A6DFFC0DA76DE5A36B`.
4. O dump não continha os marcadores de segredo verificados (`sb_secret_`, `SUPABASE_SERVICE_ROLE_KEY`, `BEGIN PRIVATE KEY`, `smtp-relay`, `SMTP_PASSWORD`).
5. A fotografia remota contém exatamente:
   - 87 tabelas;
   - 33 views;
   - 398 funções;
   - 268 policies;
   - 74 triggers;
   - 396 índices;
   - 87 tabelas com RLS habilitado.
6. O dump foi aplicado, em transação única, sobre um Supabase local limpo e descartável, com `ExitCode=0`.
7. O banco reconstruído apresentou exatamente os mesmos sete totais estruturais do remoto.
8. O primeiro redump local revelou apenas divergências de ACL causadas pelos `DEFAULT PRIVILEGES` do ambiente local. Foram removidos, somente no banco local descartável, os privilégios extras `REFERENCES`, `TRIGGER`, `TRUNCATE` e `MAINTAIN` concedidos a `anon` e/ou `authenticated` em 22/16 objetos respectivamente.
9. Após a normalização, o diff final não apresentou diferença semântica. Restaram apenas:
   - tokens aleatórios `\\restrict` / `\\unrestrict` do `pg_dump`;
   - três pares de linhas visualmente idênticas de `GRANT ALL ... TO service_role`, atribuíveis a serialização/whitespace/EOL, sem mudança de privilégio.
10. O repositório principal permaneceu limpo durante toda a auditoria; todas as mutações ocorreram exclusivamente no worktree e no stack Supabase local descartável.

## Decisão

- Não executar `migration repair` em massa.
- Não renomear migrations antigas apenas para coincidir timestamps remotos.
- Não tratar o histórico remoto recuperado como cadeia de bootstrap completa.
- Preservar a história antiga apenas como evidência/histórico.
- Adotar como referência técnica o schema atual validado e, quando a baseline for materializada no repositório, incluir normalização explícita de ACL para evitar herança indevida dos `DEFAULT PRIVILEGES` em bancos novos.
- A partir deste fechamento, novas alterações de banco devem voltar a seguir migrations versionadas, monotônicas e reproduzíveis.

## Status

**Camada 0C: PASS / FECHADA.**

Próxima camada da homologação: **0D — segurança Supabase**, com auditoria e correção por classe de função (`PUBLIC_ANON`, `AUTHENTICATED`, `INTERNAL`), `SECURITY DEFINER`, grants, `search_path`, RLS e isolamento cross-store.

## Limpeza do laboratório

O worktree `optmamenu-migration-audit` e seu stack local podem ser descartados após este fechamento. Os ~292 arquivos vistos no worktree são artefatos deliberados da auditoria e não devem ser commitados.
