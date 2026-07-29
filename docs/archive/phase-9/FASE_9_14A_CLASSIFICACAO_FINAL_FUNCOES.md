# Fase 9.14A — Classificação final de funções Advisors

## Status

**Classificação de funções concluída.**

Este documento registra a classificação final das funções `SECURITY DEFINER` apontadas pelo Advisor como executáveis por `anon`.

Base usada:

- `docs/ADVISORS.md`, commit `318cb4f782c7c7804d9be92ff07d269737161405`;
- resultado do diagnóstico `docs/sql_diagnostics/diagnose_advisors_914a_function_grants_only.sql` enviado pelo usuário.

---

## Resultado confirmado pelo diagnóstico

O diagnóstico confirmou que as funções classificadas como administrativas/privadas, internas/técnicas e públicas intencionais estão atualmente com `anon_can_execute = true`.

Também confirmou que as funções públicas intencionais normalmente estão com:

- `anon_can_execute = true`;
- `authenticated_can_execute = false`;
- `service_role_can_execute = true`.

Isso é coerente com uso público por loja pública/slug/OTP/pedido online, mas deve ser mantido apenas para funções realmente públicas.

---

## Grupo A — Authenticated only

Funções que devem perder `anon` e permanecer executáveis por `authenticated`:

- `can_access_security_section(p_store_id uuid, p_section text, p_manage boolean)`;
- `can_access_security_section_v3(p_store_id uuid, p_section text, p_manage boolean)`;
- `can_access_settings_section(p_store_id uuid, p_section text, p_manage boolean)`;
- `can_access_settings_section_v3(p_store_id uuid, p_section text, p_manage boolean)`;
- `get_default_admin_landing_path_v3(p_store_id uuid)`;
- `get_effective_store_member_permissions_v2(p_store_id uuid, p_member_id uuid)`;
- `get_login_store_options()`;
- `get_my_visible_activity_logs(p_store_id uuid, p_start_date date, p_end_date date, p_action text, p_outcome text)`;
- `get_store_permission_catalog()`;
- `get_store_permission_matrix(p_store_id uuid)`;
- `get_store_permission_matrix_v3(p_store_id uuid)`;
- `get_store_security_activity_logs(p_store_id uuid, p_start_date date, p_end_date date, p_user_filter text, p_action_filter text, p_outcome text)`;
- `get_store_security_settings(p_store_id uuid)`;
- `get_store_settings_center(p_store_id uuid)`;
- `update_security_log_member_visibility(p_log_id uuid, p_visible_to_member boolean, p_sensitive boolean)`;
- `update_store_identity_settings(...)`;
- `update_store_idle_timeout_settings(p_store_id uuid, p_idle_timeout_enabled boolean, p_idle_timeout_minutes integer)`;
- `update_store_member_permissions(p_member_id uuid, p_permissions jsonb, p_sensitive_actions jsonb, p_reason text)`;
- `update_store_role_permission_template(p_store_id uuid, p_role text, p_permission_code text, p_allowed boolean, p_reason text)`;
- `update_store_settings_section(p_store_id uuid, p_section text, p_settings jsonb)`.

### Motivo

São funções de administração, segurança, configurações, permissões, histórico ou login de usuário autenticado. Mesmo quando já validam `auth.uid()` internamente, não há necessidade de expor execução para `anon`.

---

## Grupo B — Internas/técnicas

Funções que devem perder `anon` nesta primeira rodada e permanecer sem exposição pública:

- `register_store_permission_v3(...)`;
- `seed_store_role_permissions_for_new_store_v3()`;
- `set_store_role_permission_v3(p_store_id uuid, p_role text, p_permission_code text, p_allowed boolean, p_reason text)`;
- `set_store_role_permissions_bulk_v3(p_store_id uuid, p_role text, p_changes jsonb, p_reason text)`;
- `sync_permission_catalog_v3()`;
- `touch_store_permission_version(p_store_id uuid, p_reason text)`;
- `trg_touch_store_permission_version()`.

### Motivo

São funções de seed, trigger, versionamento, sincronização ou manutenção do catálogo/template de permissões. Execução por `anon` não é necessária.

### Observação

Nesta rodada inicial, a correção proposta remove apenas `anon`. A remoção de `authenticated` para funções puramente internas pode ser avaliada depois, com conferência de dependências e chamadas reais.

---

## Grupo C — Público intencional

Funções que devem manter `anon` por enquanto, pois fazem parte da loja pública, pedido público, OTP/login de cliente ou consulta pública por slug:

- `cancel_reserved_public_order(p_order_id uuid, p_reason text)`;
- `create_public_order_by_slug(...)`;
- `customer_login_with_password(p_phone text, p_password text, p_store_id uuid)`;
- `get_public_catalog_by_slug(p_slug text)`;
- `get_public_customer_loyalty_by_phone(p_slug text, p_phone text)`;
- `get_public_delivery_methods_by_slug(p_slug text)`;
- `get_public_payment_methods_by_slug(p_slug text)`;
- `get_public_sales_channels_by_slug(p_slug text)`;
- `get_public_storefront_by_slug(p_slug text)`;
- `get_store_by_slug(p_slug text)`;
- `send_customer_otp(p_phone text, p_store_id uuid)`.

### Motivo

Essas funções têm uso público por design. Elas devem ser auditadas em rodada própria para escopo, dados expostos, validação de slug, dados sensíveis e proteção contra abuso, mas não devem perder `anon` sem revisão funcional do fluxo público.

---

## Grupo D — Caso resolvido por uso real

### `validate_store_slug(p_store_id uuid, p_slug text)`

Diagnóstico:

- `anon_can_execute = true`;
- `authenticated_can_execute = false`;
- usada no frontend administrativo em `src/services/commercialSettingsService.ts`, método `validateSlug`.

Classificação final:

- `authenticated_only_candidate`.

Direção:

- revogar `anon`;
- conceder `authenticated`.

Motivo:

- o uso atual é em Configurações/Pedido Online, dentro do admin;
- não há fluxo público de autocadastro de loja dependendo dessa função nesta etapa.

---

## RLS/tabelas

O diagnóstico recebido também confirmou contagem de linhas:

- `store_permission_catalog`: 101 registros;
- `store_role_permission_templates_backup_910c`: 1008 registros.

Ainda falta, para migration de RLS/tabelas:

- status de RLS;
- policies existentes;
- grants diretos por tabela.

Portanto, RLS/tabelas deve ficar para uma etapa separada após coleta completa.

---

## Próxima etapa

### 9.14B — Revogar `anon` de funções admin/internas

Escopo recomendado:

- remover `EXECUTE` de `anon` das funções dos grupos A e B;
- remover `EXECUTE` de `anon` de `validate_store_slug`;
- conceder `EXECUTE` de `validate_store_slug` para `authenticated`;
- não mexer nas funções públicas intencionais;
- não mexer ainda em RLS/tabelas.

---

## Critério de sucesso da 9.14B

Após aplicar a migration, o Advisor deve reduzir WARNs de `anon_security_definer_function_executable` para funções administrativas/internas, preservando os WARNs das funções públicas intencionais até a auditoria própria.
