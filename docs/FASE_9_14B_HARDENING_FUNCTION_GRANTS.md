# Fase 9.14B — Hardening de grants em funções SECURITY DEFINER

## Status

**Concluída funcionalmente.**

Esta frente executou a primeira correção segura da rodada Advisors/RLS/hardening, focada apenas em grants de execução de funções `SECURITY DEFINER`.

Não houve alteração funcional em módulos do sistema e não houve alteração em RLS/tabelas nesta etapa.

---

## Base

A 9.14B partiu da classificação final da 9.14A:

- funções administrativas/privadas deveriam perder `anon`;
- funções internas/técnicas deveriam perder `anon`;
- funções públicas intencionais deveriam manter `anon` por enquanto;
- `validate_store_slug` deveria migrar de `anon` para `authenticated`, pois seu uso real atual é administrativo.

Documento base:

- `docs/FASE_9_14A_CLASSIFICACAO_FINAL_FUNCOES.md`

---

## Migrations criadas

### 1. Primeira migration

Arquivo:

- `supabase/migrations/20260627203000_revoke_anon_from_admin_security_definer_functions.sql`

Objetivo:

- revogar `EXECUTE` de `anon` das funções administrativas/internas;
- conceder explicitamente `authenticated` para funções usadas no admin;
- ajustar `validate_store_slug`.

Resultado:

- `validate_store_slug` foi corrigida;
- várias funções permaneceram com `anon_can_execute=true` por herança via pseudo-role `PUBLIC`.

---

### 2. Migration complementar

Arquivo:

- `supabase/migrations/20260627204000_revoke_public_from_admin_security_definer_functions.sql`

Objetivo:

- revogar `EXECUTE` de `PUBLIC` e `anon` nas funções administrativas/internas;
- conceder explicitamente `authenticated` onde o frontend/admin precisa;
- manter funções públicas intencionais fora do escopo.

Resultado:

- correção validada pelo diagnóstico posterior.

---

## Validação pós-migration

Resultado confirmado pelo diagnóstico `docs/sql_diagnostics/diagnose_advisors_914a_function_grants_only.sql`.

### Funções administrativas/privadas

Passaram a ficar com:

- `anon_can_execute=false`;
- `authenticated_can_execute=true`;
- `service_role_can_execute=true`.

Exemplos validados:

- `can_access_security_section`;
- `can_access_security_section_v3`;
- `can_access_settings_section`;
- `can_access_settings_section_v3`;
- `get_default_admin_landing_path_v3`;
- `get_effective_store_member_permissions_v2`;
- `get_login_store_options`;
- `get_my_visible_activity_logs`;
- `get_store_permission_catalog`;
- `get_store_permission_matrix`;
- `get_store_permission_matrix_v3`;
- `get_store_security_activity_logs`;
- `get_store_security_settings`;
- `get_store_settings_center`;
- `update_security_log_member_visibility`;
- `update_store_identity_settings`;
- `update_store_idle_timeout_settings`;
- `update_store_member_permissions`;
- `update_store_role_permission_template`;
- `update_store_settings_section`.

---

### Funções internas/técnicas

Passaram a ficar com:

- `anon_can_execute=false`;
- `authenticated_can_execute=true`;
- `service_role_can_execute=true`.

Exemplos validados:

- `register_store_permission_v3`;
- `seed_store_role_permissions_for_new_store_v3`;
- `set_store_role_permission_v3`;
- `set_store_role_permissions_bulk_v3`;
- `sync_permission_catalog_v3`;
- `touch_store_permission_version`;
- `trg_touch_store_permission_version`.

Observação:

- `authenticated` foi preservado nesta etapa para evitar regressão em fluxos legados.
- A retirada de `authenticated` das funções puramente internas deve ser avaliada em rodada futura, com dependência real.

---

### `validate_store_slug`

Estado validado:

- `anon_can_execute=false`;
- `authenticated_can_execute=true`;
- `service_role_can_execute=true`.

Motivo:

- uso real atual ocorre em Configurações/Pedido Online, via `commercialSettingsService.ts`.

---

### Funções públicas intencionais

Permaneceram com:

- `anon_can_execute=true`;
- `authenticated_can_execute=false`;
- `service_role_can_execute=true`.

Funções preservadas:

- `cancel_reserved_public_order`;
- `create_public_order_by_slug`;
- `customer_login_with_password`;
- `get_public_catalog_by_slug`;
- `get_public_customer_loyalty_by_phone`;
- `get_public_delivery_methods_by_slug`;
- `get_public_payment_methods_by_slug`;
- `get_public_sales_channels_by_slug`;
- `get_public_storefront_by_slug`;
- `get_store_by_slug`;
- `send_customer_otp`.

Essas funções ficam para auditoria própria de exposição pública, validação de entrada, escopo por slug/store e abuso/rate limit lógico.

---

## Resultado esperado nos Advisors

A quantidade de warnings `anon_security_definer_function_executable` deve cair para as funções administrativas/internas.

Ainda devem permanecer warnings para funções públicas intencionais, até uma etapa posterior de auditoria pública.

---

## Fora do escopo

- RLS/tabelas;
- policies;
- remoção de tabelas backup;
- alteração de comportamento de loja pública;
- alteração em OTP/login de cliente;
- alteração em pedido público;
- remoção de `authenticated` em funções internas.

---

## Próxima etapa recomendada

### 9.14C — RLS/tabelas públicas apontadas pelo Advisor

Foco:

- `store_permission_catalog`;
- `store_role_permission_templates_backup_910c`.

Antes de migration:

- rodar diagnóstico separado de tabelas;
- confirmar RLS;
- conferir policies;
- conferir grants diretos;
- decidir entre RLS fechado, policies controladas, remoção ou arquivamento fora do schema exposto.
