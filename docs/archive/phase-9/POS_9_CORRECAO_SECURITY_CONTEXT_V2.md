# POS_9 — Correção do contexto de segurança v2

## Status

Correção criada, aguardando aplicação no Supabase.

## Erro observado

Após login, o console retornou:

```txt
permission denied for function get_current_user_security_context_v2
```

O erro ocorria em:

- `src/services/securityService.ts`;
- `PrivateLayout.tsx`;
- `useSecurityContext.ts`.

## Causa

Durante a 9.14E13, a função `get_current_user_security_context_v2()` foi classificada como contexto legado e teve `authenticated` revogado.

Depois do teste runtime, foi confirmado que ela ainda é usada pelo frontend para montar o contexto de segurança após login.

## Decisão

Restaurar `authenticated` para essa função específica.

Manter:

- `anon=false`;
- `PUBLIC` revogado;
- `service_role=true`.

## Migration criada

- `supabase/migrations/20260629150000_restore_authenticated_security_context_v2.sql`

## SQL de validação criado

- `docs/sql_diagnostics/validate_security_context_v2_grants.sql`

Resultado esperado:

```txt
anon=false
authenticated=true
service_role=true
```

## Observação

Essa correção altera a classificação da função:

- de legado revogado;
- para exceção intencional ativa, usada no boot/login do painel privado.

## Próximo passo

1. Aplicar a migration.
2. Executar o SQL de validação.
3. Fazer logout/login ou refresh total.
4. Confirmar console limpo para o erro de contexto de segurança.
