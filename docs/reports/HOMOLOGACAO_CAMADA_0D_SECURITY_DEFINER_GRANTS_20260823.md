# Homologação — Camada 0D — SECURITY DEFINER, grants e RLS

Data: 2026-08-23

## Objetivo

Reduzir a superfície de execução direta de funções `SECURITY DEFINER`, separar RPC pública/autenticada/interna e validar que RLS/grants não introduzem acesso cross-store óbvio antes de avançar para E2E.

## Estado inicial conhecido

Antes desta frente, a auditoria havia identificado:

- 303 funções `SECURITY DEFINER` no schema `public`;
- 57 executáveis por `anon`;
- 206 executáveis por `authenticated`;
- funções administrativas e funções trigger aparecendo como RPCs diretamente executáveis.

## 0D.1 — funções trigger internas

Foram identificadas 8 funções `SECURITY DEFINER` com retorno `trigger` e `EXECUTE` externo por herança/grant:

- `capture_store_slug_change()`;
- `enforce_public_customer_identity_context()`;
- `enforce_reward_media_asset_delete()`;
- `enforce_reward_media_asset_limit()`;
- `enrich_stock_movement_order_metadata()`;
- `sync_customer_primary_contacts()`;
- `sync_pdv_stock_exception_occurrence()`;
- `trg_sync_cashbook_closing_occurrence()`.

Foi aplicada migration que revoga `EXECUTE` de `PUBLIC`, `anon` e `authenticated` nessas funções.

Validação pós-migration: todas as funções trigger `SECURITY DEFINER` passaram a retornar `false` para `has_function_privilege(..., 'EXECUTE')` em `anon`, `authenticated` e `PUBLIC`.

## 0D.2 — remover dependência de PUBLIC EXECUTE

Ainda havia 15 funções `SECURITY DEFINER` dependentes de `PUBLIC EXECUTE`.

Foi aplicada migration que:

- remove `PUBLIC EXECUTE` de todas elas;
- mantém `quote_public_order_by_slug(text,jsonb)` explicitamente para `anon` e `authenticated`;
- mantém RPCs administrativas explicitamente para `authenticated`;
- remove `anon` das RPCs administrativas.

Resultado:

- `secdef_public_exec`: 15 → 0;
- `secdef_anon_exec`: 49 → 35.

## 0D.3 — RPCs exclusivas de equipe e manutenção

Foram removidos grants de `anon` das RPCs de equipe:

- `adjust_customer_loyalty_points_safe`;
- `complete_my_store_member_onboarding`;
- `delete_reward_media_asset_atomic`;
- `get_active_stock_reservation_origins`;
- `get_loyalty_customers_safe`;
- `get_store_members_for_permissions`;
- `is_cashbook_account_plan_system_protected(text)`;
- `update_my_profile_social_links`.

### Finding crítico fechado

`reconcile_inventory_reservations(uuid, boolean)` aceitava `p_store_id NULL` para manutenção global e seu guard anterior só verificava permissões quando `p_store_id IS NOT NULL` e `auth.uid() IS NOT NULL`.

Com o grant anterior, um cliente externo poderia atingir um caminho de reconciliação global/fora da loja se chamasse a função diretamente.

A função foi classificada como `INTERNAL`:

- `anon EXECUTE`: false;
- `authenticated EXECUTE`: false;
- `service_role EXECUTE`: true.

Não foi necessário alterar a lógica interna nesta etapa porque a fronteira de execução foi fechada no grant.

Resultado consolidado após 0D.3:

- `SECURITY DEFINER total`: 303;
- `anon EXECUTE`: 26;
- `authenticated EXECUTE`: 197;
- `PUBLIC EXECUTE`: 0.

## Classificação das 26 SECURITY DEFINER ainda expostas a anon

A lista residual pertence, de forma preliminar, às superfícies que realmente precisam operar antes de um login Supabase de equipe:

### Storefront / pedido público

- `get_public_catalog_by_slug`;
- `get_public_storefront_by_slug`;
- `get_public_delivery_methods_by_slug`;
- `get_public_payment_methods_by_slug`;
- `get_public_sales_channels_by_slug`;
- `get_store_by_slug`;
- `resolve_public_store_id_by_slug`;
- `quote_public_order_by_slug`;
- `create_public_order_by_slug`;
- `create_public_order_by_slug_v2`;
- `get_public_order_by_token`.

### Cadastro/login/OTP do cliente

- `check_customer_phone_registration_safe`;
- `register_public_customer_safe`;
- `customer_login_with_password`;
- `send_customer_otp`;
- `verify_customer_otp`;
- `get_public_customer_loyalty_by_phone`.

### Autoatendimento do cliente por contexto JWT próprio

- `get_customer_self_profile_safe`;
- `get_customer_self_addresses_safe`;
- `get_customer_self_consents_safe`;
- `get_customer_self_notifications_safe`;
- `set_customer_self_consent_safe`;
- `update_customer_self_profile_safe`;
- `upsert_customer_self_address_safe`;
- `delete_customer_self_address_safe`;
- `mark_customer_self_notification_read_safe`.

Essas 26 não foram revogadas em massa porque fazem parte da superfície pública/customer existente e precisam ser tratadas junto ao threat model específico do cliente.

## Finding de privacidade pendente

`get_public_customer_loyalty_by_phone(slug, phone)` permite consulta anônima por slug + telefone e retorna pontos, tier atual/próximo e data de atividade. Isso conflita com a direção aprovada de área do cliente protegida por senha + OTP.

Não foi revogada nesta subetapa para evitar quebrar fluxo existente sem validar o consumidor frontend. Deve ser tratada na subcamada de customer auth/OTP antes de homologar a área logada do cliente.

## Search path

Auditoria de todas as 303 funções `SECURITY DEFINER` confirmou:

- 0 funções sem `SET search_path` explícito.

O finding de advisor sobre `mutable search_path` restante, portanto, não está nestas 303 `SECURITY DEFINER`; deve ser tratado em auditoria separada de funções comuns.

## RLS sem policy

As três tabelas com RLS habilitado e zero policies foram verificadas:

- `customer_credentials`;
- `order_message_events`;
- `reserved_store_slugs`.

Para `anon` e `authenticated`, todas também estão sem grants diretos de `SELECT/INSERT/UPDATE/DELETE`.

Conclusão: o estado atual é compatível com deny-by-default intencional. Não adicionar policy permissiva apenas para satisfazer advisor.

## Scan de policies cross-store

Foi feito scan read-only em tabelas com `store_id` procurando policies que não mencionem `store_id`, membership, owner ou helpers de permissão.

Os resultados restantes foram apenas policies explicitamente bloqueadoras (`false`) em tabelas como OTP, fechamento de caixa e backups de permissão.

Não foi encontrada policy ampla `USING (true)` em tabela tenant-scoped para `anon/authenticated`.

A única policy `authenticated` com `USING (true)` encontrada foi `cashbook_account_plan_audit_select_authenticated`, em tabela global sem coluna `store_id`.

## Arquivos adicionados

- `supabase/migrations/20260823055600_revoke_execute_from_internal_security_definer_triggers.sql`;
- `supabase/migrations/20260823055900_harden_security_definer_rpc_execute_grants.sql`;
- `supabase/migrations/20260823060300_harden_staff_only_security_definer_rpcs.sql`;
- `scripts/homologation/sql/05_security_definer_execute_boundary.sql`.

## Estado da Camada 0D

**PARCIAL / núcleo P0 de EXECUTE fechado.**

Fechado nesta rodada:

- nenhum trigger `SECURITY DEFINER` exposto como RPC externa;
- nenhuma função `SECURITY DEFINER` dependente de `PUBLIC EXECUTE`;
- RPCs administrativas removidas de `anon`;
- manutenção global de reservas isolada em `service_role`;
- RLS sem policy classificado como deny-by-default, sem correção artificial;
- nenhuma policy cross-store ampla óbvia encontrada no scan inicial.

Pendente antes de considerar 0D totalmente encerrada:

1. threat model das 26 RPCs públicas/customer, com foco em enumeração por telefone e fidelidade;
2. revisão de `authenticated EXECUTE` residual por classe, sem revogação em massa;
3. advisor `mutable search_path` em funções não-SECURITY-DEFINER;
4. regressão de frontend/REST dos fluxos administrativos afetados pelos novos grants.
