# Fase 9.14E.11 — Configurações

## Status

Correção preparada.

Advisor informado: `5bc54e36c52690c32804ecefa421c887410a4263`.

Base atual: 161 funções no diagnóstico, com 8 no grupo de Configurações.

## Preservadas

Foram preservadas as funções em uso direto pelo Centro de Configurações, Segurança/Sessão e validação de slug.

Locais encontrados:

- `src/services/onlineOrderSettingsService.ts`
- `src/pages/private/admin/settings/messages/MessageSettings.tsx`
- `src/pages/private/admin/settings/storeSettings/StoreSettings.tsx`
- `src/hooks/useIdleSessionTimeout.ts`
- `src/pages/private/admin/settings/security/Security.tsx`
- `src/services/commercialSettingsService.ts`

Decisão: manter como exceções operacionais intencionais.

## Tratadas

Foram tratadas 3 funções antigas/auxiliares sem uso direto operacional atual encontrado.

Decisão:

- remover acesso direto de `authenticated`;
- remover também `anon` e `PUBLIC` por garantia;
- preservar `service_role`;
- não dropar funções.

## Migration

Arquivo:

- `supabase/migrations/20260628103500_revoke_authenticated_from_settings_legacy_helpers.sql`

Commit:

- `ebf443d6c6fcc183f4adc36751d1079e4faa0717`

## Validação esperada

Após aplicar a migration:

- contagem deve cair de 161 para 158;
- as 3 funções antigas devem sair do diagnóstico;
- as funções ativas de Configurações/Sessão/Slug devem permanecer.
